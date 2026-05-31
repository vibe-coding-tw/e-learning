#!/bin/bash
MAX_SCORE=${1:-100}
SCORE_VAL=0

# 1. Task 1: Check my_profile.md (30 pts)
if [ -f my_profile.md ]; then
  # Check for 2FA confirmation keyword
  HAS_2FA=$(grep -Eic '2FA|兩步驟驗證|兩階段驗證' my_profile.md || true)
  if [ "$HAS_2FA" -ge 1 ]; then
    SCORE_VAL=$((SCORE_VAL + 30))
  else
    # Exists but lacks 2FA confirmation
    SCORE_VAL=$((SCORE_VAL + 15))
  fi
fi

# 2. Task 2: Check assets/ directory is not empty (20 pts)
if [ -d assets ] && [ "$(find assets -type f | wc -l)" -gt 0 ]; then
  SCORE_VAL=$((SCORE_VAL + 20))
fi

# 3. Task 3: Check submission.md contains public repository URL (50 pts)
if [ -f submission.md ]; then
  # Checks for github.com repository URL format
  HAS_REPO_URL=$(grep -Eic 'https://github\.com/[a-zA-Z0-9_-]+/hello-world' submission.md || true)
  if [ "$HAS_REPO_URL" -ge 1 ]; then
    SCORE_VAL=$((SCORE_VAL + 50))
  else
    # Fallback checking general github link
    HAS_ANY_REPO=$(grep -Eic 'https://github\.com/.+/.+' submission.md || true)
    if [ "$HAS_ANY_REPO" -ge 1 ]; then
      SCORE_VAL=$((SCORE_VAL + 30))
    fi
  fi
fi

if [ "$SCORE_VAL" -gt "$MAX_SCORE" ]; then
  SCORE_VAL="$MAX_SCORE"
fi

echo "$SCORE_VAL"
