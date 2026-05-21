#!/usr/bin/env bash
set -euo pipefail
CSV="${1:-docs/examples/classroom-bridge-sync-units-only.csv}"
MODE="${2:-off}" # off|on
OUT="/tmp/bridge_actions_${MODE}_$(date +%Y%m%d_%H%M%S).csv"

if [[ "$MODE" == "off" ]]; then
  ENABLED=false
elif [[ "$MODE" == "on" ]]; then
  ENABLED=true
else
  echo "mode must be off|on" >&2
  exit 1
fi

echo "repo,status,detail" > "$OUT"

tail -n +2 "$CSV" | while IFS=, read -r repo _rest; do
  repo="$(echo "$repo" | tr -d '[:space:]')"
  [[ -z "$repo" ]] && continue
  payload=$(jq -cn --argjson enabled "$ENABLED" '{enabled:$enabled}')
  if gh api -X PUT "repos/$repo/actions/permissions" --input - <<<"$payload" >/tmp/gh_actions_out.txt 2>/tmp/gh_actions_err.txt; then
    echo "$repo,updated,enabled=$ENABLED" >> "$OUT"
  else
    err="$(tr '\n' ' ' < /tmp/gh_actions_err.txt | sed 's/,/;/g')"
    echo "$repo,error,$err" >> "$OUT"
  fi
done

echo "$OUT"
