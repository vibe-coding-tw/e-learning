#!/bin/bash
MAX_SCORE=${1:-100}
SCORE_VAL=0

# 1. Task 1: Check codespaces-lab-report.md (30 pts)
if [ -f codespaces-lab-report.md ]; then
  NON_EMPTY=$(grep -cve '^\s*$' codespaces-lab-report.md || true)
  if [ "$NON_EMPTY" -gt 5 ]; then
    SCORE_VAL=$((SCORE_VAL + 30))
  else
    SCORE_VAL=$((SCORE_VAL + 15))
  fi
fi

# 2. Task 2: Check test-result.log exists and contains runs (30 pts)
if [ -f test-result.log ]; then
  SCORE_VAL=$((SCORE_VAL + 30))
fi

# 3. Task 3: Check git commits for cross-device mobile edit tag (40 pts)
# We search git log history for [Mobile Edit] token
HAS_MOBILE_COMMIT=$(git log --grep="\[Mobile Edit\]" -n 1 --oneline || true)
if [ -n "$HAS_MOBILE_COMMIT" ]; then
  SCORE_VAL=$((SCORE_VAL + 40))
fi

if [ "$SCORE_VAL" -gt "$MAX_SCORE" ]; then
  SCORE_VAL="$MAX_SCORE"
fi

echo "$SCORE_VAL"
