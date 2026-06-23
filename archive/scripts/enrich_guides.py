#!/usr/bin/env python3
import csv
import subprocess
import json
import sys
import os
import urllib.request
import urllib.error
import ssl
import re

CSV_PATH = "docs/examples/classroom-bridge-sync-units-only.csv"
PRIVATE_COURSES_DIR = "functions/private_courses"
GITHUB_ORG = "vibe-coding-template"

def fetch_raw_github(repo, path, branch='main'):
    url = f"https://raw.githubusercontent.com/{repo}/{branch}/{path}"
    context = ssl._create_unverified_context()
    try:
        with urllib.request.urlopen(url, context=context) as response:
            return response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise e

def render_markdown(text):
    if not text:
        return ""
    payload = json.dumps({"text": text})
    res = subprocess.run(
        ["gh", "api", "/markdown", "--input", "-"],
        input=payload,
        capture_output=True,
        text=True
    )
    if res.returncode != 0:
        raise Exception(f"gh api markdown error: {res.stderr.strip()}")
    return res.stdout

def replace_section_content(html, section_id, new_content):
    # Regex to find the opening tag of <section id="section_id" ...>
    open_tag_regex = re.compile(rf'<section\b[^>]*\bid=["\']{section_id}["\'][^>]*>', re.IGNORECASE)
    open_match = open_tag_regex.search(html)
    if not open_match:
        return html
    
    tag_content_start = open_match.end()
    
    depth = 1
    section_tag_regex = re.compile(r'</?section\b[^>]*>', re.IGNORECASE)
    
    for match in section_tag_regex.finditer(html, pos=tag_content_start):
        tag = match.group(0)
        if not tag.startswith('</'):
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                end_idx = match.start()
                # Construct the new HTML with replacement
                new_html = html[:tag_content_start] + "\n" + new_content + "\n    " + html[end_idx:]
                return new_html
    return html

def main():
    apply_mode = "--apply" in sys.argv
    print(f"Running guide enrichment. Mode: {'APPLY' if apply_mode else 'DRY-RUN'}")
    if not apply_mode:
        print("To execute changes, run this script with the --apply flag.\n")

    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV file not found at {CSV_PATH}")
        sys.exit(1)

    # Read unique template repositories and branches from CSV
    repos = {}
    with open(CSV_PATH, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            repo = row.get("template_repo")
            branch = row.get("template_branch", "main")
            if repo:
                repos[repo] = branch

    print(f"Found {len(repos)} unique template repositories to scan.\n")

    success_count = 0
    skipped_count = 0
    error_count = 0

    for idx, (repo, branch) in enumerate(repos.items(), 1):
        unit_name = repo.split('/')[-1]
        html_filename = f"{unit_name}.html"
        html_path = os.path.join(PRIVATE_COURSES_DIR, html_filename)

        if not os.path.exists(html_path):
            print(f"[{idx}/{len(repos)}] Skipping {repo}: HTML file {html_filename} does not exist.")
            skipped_count += 1
            continue

        print(f"[{idx}/{len(repos)}] Processing {repo} -> {html_filename}...")
        
        try:
            # Fetch guides from GitHub
            tutor_md = fetch_raw_github(repo, "tutor-guide.md", branch)
            readme_md = fetch_raw_github(repo, "README.md", branch)

            if not tutor_md and not readme_md:
                print(f"  -> Warning: Neither tutor-guide.md nor README.md found in template repo.")
                skipped_count += 1
                continue

            with open(html_path, 'r', encoding='utf-8') as hf:
                html_content = hf.read()

            new_html_content = html_content
            updates = []

            # 1. Update assignment-guide with README.md content
            if readme_md:
                readme_html = render_markdown(readme_md)
                temp_content = replace_section_content(new_html_content, "assignment-guide", readme_html)
                if temp_content != new_html_content:
                    new_html_content = temp_content
                    updates.append("assignment-guide")

            # 2. Update tutor-guide with tutor-guide.md content
            if tutor_md:
                tutor_html = render_markdown(tutor_md)
                temp_content = replace_section_content(new_html_content, "tutor-guide", tutor_html)
                if temp_content != new_html_content:
                    new_html_content = temp_content
                    updates.append("tutor-guide")

            if not updates:
                print(f"  -> No changes needed (sections matched exactly or not found).")
                skipped_count += 1
                continue

            if apply_mode:
                with open(html_path, 'w', encoding='utf-8') as hf:
                    hf.write(new_html_content)
                print(f"  -> ✅ Successfully updated {', '.join(updates)} in {html_filename}.")
            else:
                print(f"  -> [DRY-RUN] Would update {', '.join(updates)} in {html_filename}.")
            
            success_count += 1

        except Exception as e:
            print(f"  -> ❌ Error processing {repo}: {e}")
            error_count += 1

    print("\n" + "="*40)
    print("Enrichment Summary:")
    print(f"  Success/Planned: {success_count}")
    print(f"  Skipped:         {skipped_count}")
    print(f"  Errors:          {error_count}")
    print("="*40)

if __name__ == "__main__":
    main()
