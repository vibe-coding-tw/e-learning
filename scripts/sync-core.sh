#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

CODEBASES=(
  functions
  functions-admin
  functions-autograde
  functions-payment
)

echo "[sync-core] Syncing vibe-functions-core via file:../shared-function-core"
echo "[sync-core] Running npm install --package-lock-only in each codebase..."

for codebase in "${CODEBASES[@]}"; do
  TARGET="${ROOT_DIR}/${codebase}"
  if [[ -d "${TARGET}" ]]; then
    echo "[sync-core]   -> ${codebase}"
    (cd "${TARGET}" && npm install --package-lock-only)
  fi
done

echo "[sync-core] done."
