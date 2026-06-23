#!/usr/bin/env bash
set -euo pipefail

# Batch-create sync PRs from unit template repo to student assignment repos.
# Default mode is DRY RUN for safety.

usage() {
  cat <<'USAGE'
Usage:
  scripts/sync_classroom_repos.sh --csv <path> [options]

Required:
  --csv <path>                 CSV file with header.

CSV columns:
  student_repo,upstream_repo,base_branch,upstream_branch

  student_repo      e.g. vibe-coding-classroom/student-a-01-unit-vscode-setup
  upstream_repo     e.g. vibe-coding-classroom/01-unit-vscode-setup-template
  base_branch       optional, default: main
  upstream_branch   optional, default: main

Options:
  --branch-prefix <value>      Sync branch prefix (default: sync)
  --date-tag <YYYY-MM-DD>      Branch/date tag (default: today)
  --apply                      Execute git push + gh pr create (default: dry-run)
  --workdir <path>             Temp workdir (default: /tmp/classroom-sync-<pid>)
  --pr-label <label>           Add one label to created PR
  --help                       Show this help

Examples:
  scripts/sync_classroom_repos.sh --csv docs/examples/classroom-sync-sample.csv
  scripts/sync_classroom_repos.sh --csv ./sync_targets.csv --apply --pr-label classroom-sync
USAGE
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[ERROR] Missing command: $1" >&2
    exit 1
  }
}

CSV_PATH=""
BRANCH_PREFIX="sync"
DATE_TAG="$(date +%F)"
APPLY="false"
WORKDIR="/tmp/classroom-sync-$$"
PR_LABEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv)
      CSV_PATH="${2:-}"; shift 2 ;;
    --branch-prefix)
      BRANCH_PREFIX="${2:-}"; shift 2 ;;
    --date-tag)
      DATE_TAG="${2:-}"; shift 2 ;;
    --apply)
      APPLY="true"; shift ;;
    --workdir)
      WORKDIR="${2:-}"; shift 2 ;;
    --pr-label)
      PR_LABEL="${2:-}"; shift 2 ;;
    --help|-h)
      usage; exit 0 ;;
    *)
      echo "[ERROR] Unknown option: $1" >&2
      usage
      exit 1 ;;
  esac
done

if [[ -z "$CSV_PATH" ]]; then
  echo "[ERROR] --csv is required" >&2
  usage
  exit 1
fi

if [[ ! -f "$CSV_PATH" ]]; then
  echo "[ERROR] CSV not found: $CSV_PATH" >&2
  exit 1
fi

require_cmd git
require_cmd gh

mkdir -p "$WORKDIR"
REPORT_FILE="$WORKDIR/sync_report_${DATE_TAG}.csv"
echo "student_repo,status,detail,pr_url" > "$REPORT_FILE"

echo "[INFO] Mode: $([[ "$APPLY" == "true" ]] && echo APPLY || echo DRY-RUN)"
echo "[INFO] Workdir: $WORKDIR"
echo "[INFO] Report: $REPORT_FILE"

# Skip header
{ read -r _header || true
  while IFS=, read -r student_repo upstream_repo base_branch upstream_branch || [[ -n "${student_repo}${upstream_repo}${base_branch}${upstream_branch}" ]]; do
    # Trim spaces
    student_repo="${student_repo//[$'\t\r\n ']}"
    upstream_repo="${upstream_repo//[$'\t\r\n ']}"
    base_branch="${base_branch//[$'\t\r\n ']}"
    upstream_branch="${upstream_branch//[$'\t\r\n ']}"

    [[ -z "$student_repo" ]] && continue
    [[ "$student_repo" =~ ^# ]] && continue

    base_branch="${base_branch:-main}"
    upstream_branch="${upstream_branch:-main}"

    if [[ -z "$upstream_repo" ]]; then
      echo "[WARN] $student_repo -> missing upstream_repo, skip"
      echo "$student_repo,skipped,missing upstream_repo," >> "$REPORT_FILE"
      continue
    fi

    repo_dir="$WORKDIR/${student_repo##*/}"
    sync_branch="${BRANCH_PREFIX}/${DATE_TAG}-${upstream_repo##*/}"

    echo "\n[INFO] Processing: $student_repo"
    echo "       Upstream:  $upstream_repo"
    echo "       Branch:    $sync_branch"

    if [[ "$APPLY" != "true" ]]; then
      echo "[DRY] gh repo clone $student_repo $repo_dir"
      echo "[DRY] git fetch upstream $upstream_branch"
      echo "[DRY] git checkout -B $sync_branch origin/$base_branch"
      echo "[DRY] git merge --no-ff --no-edit upstream/$upstream_branch"
      echo "[DRY] git push -u origin $sync_branch"
      echo "[DRY] gh pr create --repo $student_repo --base $base_branch --head $sync_branch"
      echo "$student_repo,dry-run,planned," >> "$REPORT_FILE"
      continue
    fi

    rm -rf "$repo_dir"
    if ! gh repo clone "$student_repo" "$repo_dir" -- -q; then
      echo "[ERROR] clone failed: $student_repo"
      echo "$student_repo,error,clone failed," >> "$REPORT_FILE"
      continue
    fi

    (
      set -e
      cd "$repo_dir"

      if git remote get-url upstream >/dev/null 2>&1; then
        git remote set-url upstream "https://github.com/${upstream_repo}.git"
      else
        git remote add upstream "https://github.com/${upstream_repo}.git"
      fi

      git fetch origin "$base_branch" --quiet
      git fetch upstream "$upstream_branch" --quiet
      git checkout -B "$sync_branch" "origin/$base_branch" >/dev/null

      set +e
      git merge --no-ff --no-edit "upstream/$upstream_branch"
      merge_rc=$?
      set -e

      if [[ $merge_rc -ne 0 ]]; then
        git merge --abort || true
        echo "[WARN] merge conflict: $student_repo"
        echo "$student_repo,conflict,manual merge required," >> "$REPORT_FILE"
        exit 0
      fi

      if [[ -z "$(git status --porcelain)" ]]; then
        echo "[INFO] no changes: $student_repo"
        echo "$student_repo,noop,already up to date," >> "$REPORT_FILE"
        exit 0
      fi

      git push -u origin "$sync_branch" --quiet

      pr_title="chore: sync from ${upstream_repo##*/} (${DATE_TAG})"
      pr_body=$(cat <<PRBODY
This PR syncs latest updates from template repo.

- upstream: ${upstream_repo}
- upstream branch: ${upstream_branch}
- sync date: ${DATE_TAG}

Please review carefully and merge if it does not overwrite student-specific work.
PRBODY
)

      pr_cmd=(gh pr create --repo "$student_repo" --base "$base_branch" --head "$sync_branch" --title "$pr_title" --body "$pr_body")
      if [[ -n "$PR_LABEL" ]]; then
        pr_cmd+=(--label "$PR_LABEL")
      fi

      set +e
      pr_url="$(${pr_cmd[@]} 2>/tmp/gh_pr_err.txt)"
      pr_rc=$?
      set -e

      if [[ $pr_rc -ne 0 ]]; then
        err_msg="$(tr '\n' ' ' < /tmp/gh_pr_err.txt | sed 's/,/;/g')"
        echo "[ERROR] PR create failed: $student_repo"
        echo "$student_repo,error,pr create failed: ${err_msg}," >> "$REPORT_FILE"
        exit 0
      fi

      echo "[OK] PR: $pr_url"
      echo "$student_repo,opened,success,$pr_url" >> "$REPORT_FILE"
    )

  done
} < "$CSV_PATH"

echo "\n[DONE] Report generated: $REPORT_FILE"
