#!/bin/bash
MAX_SCORE=${1:-100}

# 1. If env-check.md or README.md exists, run the checklist parser
if [ -f env-check.md ] || [ -f README.md ]; then
  python3 - <<'PY' "$MAX_SCORE"
import re
import os
import sys
from pathlib import Path

max_score = int(sys.argv[1])
p = Path("env-check.md") if Path("env-check.md").exists() else Path("README.md")
text = p.read_text(encoding="utf-8", errors="ignore")
lines = text.splitlines()

check_re = re.compile(r'^\s*[-*]\s+\[(?P<done>[ xX])\]\s+(?P<body>.+)$')
weight_patterns = [
    re.compile(r'\[w(?:eight)?\s*[:=]\s*(\d+(?:\.\d+)?)\]', re.IGNORECASE),
    re.compile(r'\((\d+(?:\.\d+)?)%\)')
]

items = []
for line in lines:
    m = check_re.match(line)
    if not m:
        continue
    done = m.group("done").lower() == "x"
    body = m.group("body")
    weight = None
    for p_pat in weight_patterns:
        wm = p_pat.search(body)
        if wm:
            try:
                weight = float(wm.group(1))
            except Exception:
                weight = None
            break
    items.append((done, weight))

if not items:
    # No checklist checkboxes: check if there is some text written by student
    score = max_score if text.strip() else 0
    print(score)
    sys.exit(0)

weighted_items = [(d, w) for d, w in items if w is not None and w > 0]
if weighted_items:
    total_w = sum(w for _, w in weighted_items)
    done_w = sum(w for d, w in weighted_items if d)
    ratio = 0 if total_w <= 0 else done_w / total_w
else:
    total = len(items)
    done = sum(1 for d, _ in items if d)
    ratio = 0 if total == 0 else done / total

score = int(round(max_score * ratio))
score = max(0, min(max_score, score))
print(score)
PY
  exit 0
fi

# 2. Fallback: If no checklist files exist, check if the student has pushed any source code files
# We scan for common source files: html, css, js, cpp, h, c, py, md, json, etc.
# We exclude .github folder and hidden files.
student_files=$(find . -maxdepth 3 -not -path '*/.*' -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.cpp" -o -name "*.h" -o -name "*.c" -o -name "*.py" -o -name "*.md" -o -name "*.json" -o -name "*.ino" \) | wc -l)

if [ "$student_files" -gt 0 ]; then
  echo "$MAX_SCORE"
else
  # No files pushed yet
  echo "0"
fi
