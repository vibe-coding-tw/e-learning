#!/usr/bin/env bash
set -euo pipefail

CSV_PATH="${1:-docs/examples/classroom-bridge-sync-units-only.csv}"
MODE="${2:---dry-run}"
BRANCH="${3:-main}"

if [[ ! -f "$CSV_PATH" ]]; then
  echo "CSV not found: $CSV_PATH" >&2
  exit 1
fi

OUT="/tmp/remove_bridge_tutor_guide_$(date +%Y%m%d_%H%M%S).csv"
echo "repo,path,status,detail" > "$OUT"

action_delete_file() {
  local repo="$1"
  local path="$2"

  set +e
  local get_resp
  get_resp=$(gh api "repos/$repo/contents/$path?ref=$BRANCH" 2>/tmp/gh_get_err.txt)
  local get_code=$?
  set -e

  if [[ $get_code -ne 0 ]]; then
    local err
    err=$(tr '\n' ' ' < /tmp/gh_get_err.txt | sed 's/,/;/g')
    if echo "$err" | grep -qi "Not Found\|404"; then
      echo "$repo,$path,noop,not found" >> "$OUT"
      return 0
    fi
    echo "$repo,$path,error,get failed: $err" >> "$OUT"
    return 0
  fi

  local sha
  sha=$(printf '%s' "$get_resp" | jq -r '.sha // empty')
  if [[ -z "$sha" ]]; then
    echo "$repo,$path,error,missing sha" >> "$OUT"
    return 0
  fi

  if [[ "$MODE" != "--apply" ]]; then
    echo "$repo,$path,dry-run,would delete" >> "$OUT"
    return 0
  fi

  local payload
  payload=$(jq -cn --arg msg "chore: remove $path from bridge repo" --arg sha "$sha" --arg branch "$BRANCH" '{message:$msg,sha:$sha,branch:$branch}')

  set +e
  local del_resp
  del_resp=$(gh api -X DELETE "repos/$repo/contents/$path" -f message="chore: remove $path from bridge repo" -f sha="$sha" -f branch="$BRANCH" 2>/tmp/gh_del_err.txt)
  local del_code=$?
  set -e

  if [[ $del_code -ne 0 ]]; then
    local err
    err=$(tr '\n' ' ' < /tmp/gh_del_err.txt | sed 's/,/;/g')
    echo "$repo,$path,error,delete failed: $err" >> "$OUT"
  else
    local commit_url
    commit_url=$(printf '%s' "$del_resp" | jq -r '.commit.html_url // empty')
    echo "$repo,$path,deleted,${commit_url:-ok}" >> "$OUT"
  fi
}

# Read repos from first CSV column, skip header
repos=$(tail -n +2 "$CSV_PATH" | cut -d',' -f1 | sed '/^\s*$/d' | sort -u)

count=0
while IFS= read -r repo; do
  [[ -z "$repo" ]] && continue
  count=$((count + 1))
  echo "[INFO] ($count) $repo"
  action_delete_file "$repo" "tutor-guide.md"
  action_delete_file "$repo" ".github/tutor_guide.md"
done <<< "$repos"

echo "[DONE] report: $OUT"
