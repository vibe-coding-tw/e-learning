#!/bin/bash
set -euo pipefail

# Inputs passed from GitHub Actions environment variables
USER_ID="${VC_USER_ID:-}"
UNIT_ID="${VC_UNIT_ID:-}"
AUTOGRADE_URL="${VC_AUTOGRADE_URL:-}"
AUTOGRADE_TOKEN="${VC_AUTOGRADE_TOKEN:-}"
MAX_SCORE="100"

if [ -z "$USER_ID" ] || [ -z "$UNIT_ID" ] || [ -z "$AUTOGRADE_URL" ] || [ -z "$AUTOGRADE_TOKEN" ]; then
  echo "Error: Missing required environment variables (VC_USER_ID, VC_UNIT_ID, VC_AUTOGRADE_URL, VC_AUTOGRADE_TOKEN)."
  exit 1
fi

# 1. Create a sandbox directory for grader output
mkdir -p .grader_workspace

# 2. Try to download the unit-specific grader
echo "Attempting to download grader for $UNIT_ID..."
HTTP_CODE=$(curl -s -w "%{http_code}" -o .grader_workspace/grader.sh "https://vibe-coding.tw/graders/${UNIT_ID}.sh" || echo "500")

if [ "$HTTP_CODE" != "200" ]; then
  echo "Grader for $UNIT_ID not found (HTTP $HTTP_CODE). Downloading default grader..."
  curl -fsSL -o .grader_workspace/grader.sh "https://vibe-coding.tw/graders/default.sh"
fi

chmod +x .grader_workspace/grader.sh

# 3. Run the grader script
echo "Running grader..."
# The grader script should output the integer score to stdout
SCORE_VAL=$(bash .grader_workspace/grader.sh "$MAX_SCORE" || echo "0")

# Clean up grader workspace
rm -rf .grader_workspace

# 4. Determine status based on score
if [ "$SCORE_VAL" -ge "$MAX_SCORE" ]; then
  STATUS="completed"
elif [ "$SCORE_VAL" -gt 0 ]; then
  STATUS="in_progress"
else
  STATUS="failed"
fi

# 5. Build Payload containing run metadata
REPO="${GITHUB_REPOSITORY:-}"
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${REPO}/actions/runs/${GITHUB_RUN_ID:-}"
WORKFLOW_NAME="${GITHUB_WORKFLOW:-}"
COMMIT_SHA="${GITHUB_SHA:-}"
ACTOR="${GITHUB_ACTOR:-}"

PAYLOAD=$(jq -cn \
  --arg userId "$USER_ID" \
  --arg unitId "$UNIT_ID" \
  --argjson score "$SCORE_VAL" \
  --argjson maxScore "$MAX_SCORE" \
  --arg status "$STATUS" \
  --arg runUrl "$RUN_URL" \
  --arg workflow "$WORKFLOW_NAME" \
  --arg commitSha "$COMMIT_SHA" \
  --arg repo "$REPO" \
  --arg actor "$ACTOR" \
  '{
    userId: ($userId | select(length > 0)),
    unitId: ($unitId | select(length > 0)),
    score: $score,
    maxScore: $maxScore,
    status: $status,
    runUrl: $runUrl,
    workflow: $workflow,
    commitSha: $commitSha,
    repo: $repo,
    actor: $actor
  }')

# 6. Sign and Send Score to Vibe Coding API
SIG="sha256=$(printf %s "$PAYLOAD" | openssl dgst -sha256 -hmac "$AUTOGRADE_TOKEN" | sed 's/^.* //')"

echo "Sending score to Vibe Coding backend..."
curl -sS -X POST "$AUTOGRADE_URL" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD"

echo ""
echo "Autograding successfully completed! Score: $SCORE_VAL/$MAX_SCORE ($STATUS)"
