#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHECK_SCRIPT="${ROOT_DIR}/scripts/check-local-env.sh"
START_SCRIPT="${ROOT_DIR}/start-emulator.sh"
EMULATOR_LOG="${TMPDIR:-/tmp}/vibe-local-emulator.log"
CHECK_LOG="${TMPDIR:-/tmp}/vibe-local-env-check.log"
HOSTING_URL="${LOCAL_HOSTING_URL:-http://127.0.0.1:15002/index.html}"
PROJECT_ID="${FIREBASE_EMULATOR_PROJECT:-demo-e-learning-942f7}"
READY=0

if bash "${CHECK_SCRIPT}" >"${CHECK_LOG}" 2>&1; then
  READY=1
else
  echo "[start_local] Local env not ready yet; starting Firebase emulators for ${PROJECT_ID}..."
  FIREBASE_EMULATOR_PROJECT="${PROJECT_ID}" nohup bash "${START_SCRIPT}" >"${EMULATOR_LOG}" 2>&1 </dev/null &

  for _ in $(seq 1 180); do
    if bash "${CHECK_SCRIPT}" >"${CHECK_LOG}" 2>&1; then
      READY=1
      break
    fi
    sleep 2
  done
fi

if [[ "${READY}" -ne 1 ]]; then
  echo "[start_local] Timed out waiting for scripts/check-local-env.sh to pass."
  cat "${CHECK_LOG}" || true
  exit 1
fi

cat "${CHECK_LOG}"
echo "[start_local] Local env is ready."

if command -v open >/dev/null 2>&1; then
  open "${HOSTING_URL}" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${HOSTING_URL}" >/dev/null 2>&1 || true
else
  echo "[start_local] Open this URL manually: ${HOSTING_URL}"
fi
