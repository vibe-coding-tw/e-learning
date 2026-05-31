#!/bin/bash
MAX_SCORE=${1:-100}
SCORE_VAL=0

if [ -f style.css ]; then
  # 1. Check if Flexbox is used (40 pts)
  HAS_FLEX=$(grep -Eic 'display\s*:\s*flex' style.css || true)
  if [ "$HAS_FLEX" -ge 1 ]; then
    SCORE_VAL=$((SCORE_VAL + 40))
  fi

  # 2. Check for absolute positioning / float bypass (30 pts)
  # The task forbids absolute position or float for layout alignment.
  HAS_ABSOLUTE_OR_FLOAT=$(grep -Eic 'position\s*:\s*absolute|float\s*:\s*(left|right)' style.css || true)
  if [ "$HAS_ABSOLUTE_OR_FLOAT" -eq 0 ]; then
    SCORE_VAL=$((SCORE_VAL + 30))
  fi

  # 3. Check for media queries (30 pts)
  HAS_MEDIA_QUERY=$(grep -Eic '@media' style.css || true)
  if [ "$HAS_MEDIA_QUERY" -ge 1 ]; then
    SCORE_VAL=$((SCORE_VAL + 30))
  fi
else
  # Fallback to checking index.html if style.css is missing
  if [ -f index.html ]; then
    SCORE_VAL=40
  fi
fi

if [ "$SCORE_VAL" -gt "$MAX_SCORE" ]; then
  SCORE_VAL="$MAX_SCORE"
fi

echo "$SCORE_VAL"
