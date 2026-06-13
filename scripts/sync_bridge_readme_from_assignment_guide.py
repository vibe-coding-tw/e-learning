#!/usr/bin/env python3
import argparse
import base64
import csv
import json
import re
import subprocess
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_COURSES = ROOT / "functions" / "private_courses"
DEFAULT_CSV = ROOT / "docs" / "examples" / "classroom-bridge-sync-units-only.csv"


def run(cmd):
    p = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    return p.returncode, p.stdout, p.stderr


def extract_section(html: str, section_id: str) -> str:
    m = re.search(rf'<section\b[^>]*id=["\']{re.escape(section_id)}["\'][^>]*>([\s\S]*?)</section>', html, re.I)
    return m.group(1).strip() if m else ""


def normalize_title(text: str, unit_slug: str) -> str:
    t = (text or "").strip()
    if not t:
        return unit_slug
    t = re.sub(r'^(?:[a-z]+-\\d{2}-)?unit-[a-z0-9-]+\\s*[：:]\\s*', '', t, flags=re.I)
    t = re.sub(r'^[a-z0-9]+-unit-[a-z0-9-]+\\s*[：:]\\s*', '', t, flags=re.I)
    t = re.sub(r'^(導師合作|Tutor Collaboration)\\s*[-：:|｜]\\s*[a-z0-9-]+\\s*', r'\\1：', t, flags=re.I)
    t = re.sub(r'\\s*\\(([a-z0-9]+-unit-[a-z0-9-]+)\\)\\s*$', '', t, flags=re.I)
    t = re.sub(r'\\s+', ' ', t).strip(' -：:')
    return t or unit_slug


def build_readme(unit_slug: str, assignment_html: str) -> str:
    soup = BeautifulSoup(assignment_html, 'html.parser')
    for a in soup.select('a.anchor'):
        a.decompose()

    heading_el = soup.find(['h1', 'h2', 'h3'])
    heading = normalize_title(heading_el.get_text(' ', strip=True) if heading_el else '', unit_slug)
    if heading_el:
        heading_el.decompose()

    body_html = str(soup).strip()
    note = (
        "<!-- AUTO-GENERATED: synced from functions/private_courses/<unit>.html#assignment-guide -->\\n"
        "<!-- 請在平台 assignment-guide 編修，勿直接在 bridge README 手動改寫。 -->"
    )
    return f"# {heading}\\n\\n{note}\\n\\n{body_html}\\n"


def gh_get_sha(repo: str, branch: str):
    code, out, _ = run(f"gh api repos/{repo}/contents/README.md?ref={branch}")
    if code != 0:
        return None
    try:
        return json.loads(out).get('sha')
    except Exception:
        return None


def gh_put_readme(repo: str, branch: str, content: str, sha: str | None):
    payload = {
        "message": "docs: sync README from assignment-guide",
        "content": base64.b64encode(content.encode('utf-8')).decode('ascii'),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha

    cmd = f"gh api -X PUT repos/{repo}/contents/README.md --input -"
    p = subprocess.run(cmd, shell=True, input=json.dumps(payload, ensure_ascii=False), text=True, capture_output=True)
    return p.returncode, p.stdout, p.stderr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', default=str(DEFAULT_CSV))
    ap.add_argument('--apply', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()

    rows = []
    with open(args.csv, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    if args.limit > 0:
        rows = rows[:args.limit]

    report = Path(f"/tmp/bridge_readme_from_assignment_guide_{'apply' if args.apply else 'dryrun'}_{Path(args.csv).stem}.csv")
    with report.open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['repo', 'unit', 'status', 'detail'])

        for r in rows:
            repo = (r.get('bridge_repo') or '').strip()
            template_repo = (r.get('template_repo') or '').strip()
            branch = (r.get('base_branch') or 'main').strip() or 'main'
            if not repo or not template_repo:
                continue

            unit_slug = template_repo.split('/')[-1]
            unit_html = PRIVATE_COURSES / f"{unit_slug}.html"
            if not unit_html.exists():
                w.writerow([repo, unit_slug, 'skip', 'missing_private_course_html'])
                continue

            html = unit_html.read_text(encoding='utf-8', errors='ignore')
            section = extract_section(html, 'assignment-guide')
            if not section:
                w.writerow([repo, unit_slug, 'skip', 'assignment-guide_not_found'])
                continue

            readme = build_readme(unit_slug, section)

            if not args.apply:
                w.writerow([repo, unit_slug, 'dry-run', f'prepared_len={len(readme)}'])
                continue

            sha = gh_get_sha(repo, branch)
            code, _, err = gh_put_readme(repo, branch, readme, sha)
            if code == 0:
                w.writerow([repo, unit_slug, 'updated', 'ok'])
            else:
                w.writerow([repo, unit_slug, 'error', (err or 'gh_put_failed').strip().replace('\n', ' ')[:300]])

    print(str(report))


if __name__ == '__main__':
    main()
