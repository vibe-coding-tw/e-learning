#!/bin/bash
MAX_SCORE=${1:-100}
SCORE_VAL=0

# 1. Task 1: Check for HUD safety screenshot (40 pts)
if [ -f assets/test_screenshot.png ] || [ -f test_screenshot.png ]; then
  SCORE_VAL=$((SCORE_VAL + 40))
fi

# 2. Task 2 & 3: Check README.md for UX report entries (60 pts)
if [ -f README.md ]; then
  # Checks if they filled in the UX report questions or blind operation records
  HAS_UX_ANSWERS=$(grep -Eic 'Thumb Zone|HUD|STOP|盲操' README.md || true)
  if [ "$HAS_UX_ANSWERS" -ge 2 ]; then
    SCORE_VAL=$((SCORE_VAL + 60))
  elif [ "$HAS_UX_ANSWERS" -ge 1 ]; then
    SCORE_VAL=$((SCORE_VAL + 30))
  fi
fi

if [ "$SCORE_VAL" -gt "$MAX_SCORE" ]; then
  SCORE_VAL="$MAX_SCORE"
fi

echo "$SCORE_VAL"
