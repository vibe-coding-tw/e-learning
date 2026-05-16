#!/usr/bin/env bash
set -euo pipefail

CSV_PATH="${1:-docs/examples/classroom-bridge-sync-units-only.csv}"
MODE="${2:---dry-run}"  # --dry-run | --apply
WORKDIR="${3:-/tmp/bridge-prune-$$}"

if [[ ! -f "$CSV_PATH" ]]; then
  echo "CSV not found: $CSV_PATH" >&2
  exit 1
fi

mkdir -p "$WORKDIR"
REPORT="$WORKDIR/bridge_prune_report_$(date +%Y%m%d_%H%M%S).csv"
echo "repo,branch,status,removed_items,commit" > "$REPORT"

while IFS=, read -r repo template branch template_branch || [[ -n "${repo}${template}${branch}${template_branch}" ]]; do
  repo="${repo//[$'\t\r\n ']}"
  branch="${branch//[$'\t\r\n ']}"
  [[ -z "$repo" ]] && continue
  [[ "$repo" =~ ^# ]] && continue
  [[ "$repo" == "bridge_repo" ]] && continue
  [[ -z "$branch" ]] && branch="main"

  echo "[INFO] Processing $repo ($branch)"
  dir="$WORKDIR/${repo##*/}"
  rm -rf "$dir"

  if ! gh repo clone "$repo" "$dir" -- -q; then
    echo "$repo,$branch,error,clone failed," >> "$REPORT"
    continue
  fi

  pushd "$dir" >/dev/null
  git checkout "$branch" >/dev/null 2>&1 || git checkout -b "$branch" "origin/$branch" >/dev/null 2>&1 || true

  entries="$(find . -mindepth 1 -maxdepth 1 \
    ! -name '.git' \
    ! -name '.github' \
    ! -name 'README.md' \
    -print | sed 's#^\./##' | sort)"

  if [[ -n "$entries" ]]; then
    removed_count="$(printf '%s\n' "$entries" | wc -l | tr -d ' ')"
  else
    removed_count="0"
  fi
  if [[ "$removed_count" -eq 0 ]]; then
    echo "$repo,$branch,noop,0," >> "$REPORT"
    popd >/dev/null
    continue
  fi

  if [[ "$MODE" == "--dry-run" ]]; then
    echo "$repo,$branch,dry-run,$removed_count," >> "$REPORT"
    popd >/dev/null
    continue
  fi

  printf '%s\n' "$entries" | while IFS= read -r p; do
    [[ -z "$p" ]] && continue
    rm -rf -- "$p"
  done

  git add -A
  if git diff --cached --quiet; then
    echo "$repo,$branch,noop,$removed_count," >> "$REPORT"
    popd >/dev/null
    continue
  fi

  git commit -m "chore: keep only README.md and .github in bridge repo" >/dev/null
  if git push origin "$branch" >/dev/null 2>&1; then
    commit_sha="$(git rev-parse --short HEAD)"
    echo "$repo,$branch,updated,$removed_count,$commit_sha" >> "$REPORT"
  else
    echo "$repo,$branch,error,$removed_count,push failed" >> "$REPORT"
  fi

  popd >/dev/null

done < "$CSV_PATH"

echo "[DONE] $REPORT"
