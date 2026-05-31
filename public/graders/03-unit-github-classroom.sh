#!/bin/bash
MAX_SCORE=${1:-100}
SCORE_VAL=0

# Task 3-1: 啟動 Codespaces 雲端環境 (30 pts)
if [ -f submission/task-3-1.md ]; then
  HAS_REPO_URL=$(grep -Eic 'https://github\.com/.+/.+' submission/task-3-1.md || true)
  NON_EMPTY=$(grep -cve '^\s*$' submission/task-3-1.md || true)
  if [ "$HAS_REPO_URL" -ge 1 ] && [ "$NON_EMPTY" -ge 3 ]; then
    SCORE_VAL=$((SCORE_VAL + 30))
  fi
fi

# Task 3-2: 原子化提交與自動評分 (40 pts)
if [ -f submission/task-3-2.md ]; then
  HAS_ACTIONS_URL=$(grep -Eic 'https://github\.com/.+/actions/runs/[0-9]+' submission/task-3-2.md || true)
  HAS_GREEN=$(grep -Eic '✅|passed|success|green|autograde' submission/task-3-2.md || true)
  HAS_COMMITS=$(grep -Eic '^[a-f0-9]{7,40} ' submission/task-3-2.md || true)
  TASK32_SCORE=0
  if [ "$HAS_ACTIONS_URL" -ge 1 ]; then
    TASK32_SCORE=$((TASK32_SCORE + 20))
  fi
  if [ "$HAS_GREEN" -ge 1 ]; then
    TASK32_SCORE=$((TASK32_SCORE + 10))
  fi
  if [ "$HAS_COMMITS" -ge 2 ]; then
    TASK32_SCORE=$((TASK32_SCORE + 10))
  fi
  SCORE_VAL=$((SCORE_VAL + TASK32_SCORE))
fi

# Task 3-3: Feedback PR 與 Code Review (30 pts)
if [ -f submission/task-3-3.md ]; then
  HAS_PR_URL=$(grep -Eic 'https://github\.com/.+/pull/[0-9]+' submission/task-3-3.md || true)
  NON_EMPTY=$(grep -cve '^\s*$' submission/task-3-3.md || true)
  if [ "$HAS_PR_URL" -ge 1 ] && [ "$NON_EMPTY" -ge 5 ]; then
    SCORE_VAL=$((SCORE_VAL + 30))
  elif [ "$HAS_PR_URL" -ge 1 ]; then
    SCORE_VAL=$((SCORE_VAL + 15))
  fi
fi

if [ "$SCORE_VAL" -gt "$MAX_SCORE" ]; then
  SCORE_VAL="$MAX_SCORE"
fi

echo "$SCORE_VAL"
