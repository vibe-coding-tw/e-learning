#!/usr/bin/env bash
set -euo pipefail

# Classroom starter repo leak preflight checker
# Detects potentially sensitive files (solutions/answers/teacher-only artifacts)

ROOT_DIR="${1:-/Users/roverchen/Documents/Classrooms}"

if [[ ! -d "$ROOT_DIR" ]]; then
  echo "[ERROR] Root directory not found: $ROOT_DIR" >&2
  exit 2
fi

# Filename patterns considered high risk for student starter repos.
RISK_FILE_REGEX='(verify_solution|(^|/)(solutions?|answers?)(/|$)|teacher[-_ ]?only|tutor[-_ ]?only|sample[-_ ]?answer|official[-_ ]?solution|解答|答案|教師版|助教版)'

# Ignore heavy/generated dirs.
IGNORE_GLOBS=(
  "*/node_modules/*"
  "*/.git/*"
  "*/dist/*"
  "*/build/*"
  "*/coverage/*"
)

build_find_cmd() {
  local base="$1"
  shift
  local -a cmd=(find "$base" -type f)
  for g in "${IGNORE_GLOBS[@]}"; do
    cmd+=( -not -path "$g" )
  done
  printf '%q ' "${cmd[@]}"
}

echo "[INFO] Scanning classroom repos under: $ROOT_DIR"

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

# shellcheck disable=SC2046
find "$ROOT_DIR" -type f \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/coverage/*' \
  | rg -i "$RISK_FILE_REGEX" > "$TMP_FILE" || true

HIT_COUNT=$(wc -l < "$TMP_FILE" | tr -d ' ')

if [[ "$HIT_COUNT" -eq 0 ]]; then
  echo "[PASS] No high-risk solution/answer artifacts found."
  exit 0
fi

echo "[FAIL] Found $HIT_COUNT potentially sensitive files:"
cat "$TMP_FILE"

echo
echo "[ACTION] Review these files before publishing starter repos."
exit 1
