#!/bin/bash
MAX_SCORE=${1:-100}
SCORE_VAL=0

# 1. Task 1: Check for VS Code setup window screenshot (40 pts)
if [ -f setup-ui.png ] || [ -f assets/setup-ui.png ]; then
  SCORE_VAL=$((SCORE_VAL + 40))
fi

# 2. Task 2: Check for Live Server preview screenshot (40 pts)
if [ -f html-preview.png ] || [ -f assets/html-preview.png ]; then
  SCORE_VAL=$((SCORE_VAL + 40))
fi

# 3. Task 3: Check for completed checkboxes in env-check.md (20 pts)
if [ -f env-check.md ] || [ -f README.md ]; then
  p="env-check.md"
  if [ ! -f "$p" ]; then
    p="README.md"
  fi
  TOTAL_BOXES=$(grep -c '^\s*[-*]\s+\[[ xX]\]' "$p" || true)
  CHECKED_BOXES=$(grep -c '^\s*[-*]\s+\[[xX]\]' "$p" || true)
  if [ "$TOTAL_BOXES" -gt 0 ]; then
    CHECKED_RATIO=$(echo "$CHECKED_BOXES $TOTAL_BOXES" | awk '{print $1/$2}')
    TASK3_SCORE=$(echo "$CHECKED_RATIO" | awk '{printf "%d", $1 * 20}')
    SCORE_VAL=$((SCORE_VAL + TASK3_SCORE))
  else
    # Fallback: if no checkboxes, check if file is modified
    NON_EMPTY=$(grep -cve '^\s*$' "$p" || true)
    if [ "$NON_EMPTY" -gt 5 ]; then
      SCORE_VAL=$((SCORE_VAL + 20))
    fi
  fi
fi

if [ "$SCORE_VAL" -gt "$MAX_SCORE" ]; then
  SCORE_VAL="$MAX_SCORE"
fi

echo "$SCORE_VAL"
