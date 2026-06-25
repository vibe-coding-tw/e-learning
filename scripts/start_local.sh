#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIREBASE_EMULATOR_PROJECT:-${FIREBASE_STAGING_PROJECT:-e-learning-942f7}}"
EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:18080}"
FUNCTIONS_HOST="${FUNCTIONS_EMULATOR_HOST:-127.0.0.1:15001}"
AUTH_HOST="${AUTH_EMULATOR_HOST:-127.0.0.1:19099}"
HOSTING_HOST="${HOSTING_EMULATOR_HOST:-127.0.0.1:15002}"
HUB_HOST="${FIREBASE_EMULATOR_HUB:-127.0.0.1:14405}"
LOGGING_HOST="${FIREBASE_EMULATOR_LOGGING:-127.0.0.1:14505}"
LOG_FILE="${TMPDIR:-/tmp}/vibe-local-emulators.log"
EMULATOR_PID=""

ensure_deps() {
  local dir="$1"
  if [[ ! -d "${dir}/node_modules" ]]; then
    echo "[start_local] installing dependencies in ${dir}"
    (cd "${dir}" && npm install --ignore-scripts --no-audit --no-fund)
  fi
}

wait_for_port() {
  local host="$1"
  local port="$2"
  local label="$3"
  local attempts="${4:-60}"
  local i

  for ((i = 1; i <= attempts; i++)); do
    if node -e "const net = require('node:net'); const socket = net.createConnection({ host: process.argv[1], port: Number(process.argv[2]) }); socket.once('connect', () => { socket.end(); process.exit(0); }); socket.once('error', () => process.exit(1)); setTimeout(() => process.exit(1), 1000);" "$host" "$port" >/dev/null 2>&1; then
      echo "[start_local] ${label} ready on ${host}:${port}"
      return 0
    fi
    sleep 1
  done

  echo "[start_local] timed out waiting for ${label} on ${host}:${port}"
  if [[ -f "$LOG_FILE" ]]; then
    tail -n 80 "$LOG_FILE" || true
  fi
  return 1
}

cleanup() {
  if [[ -n "${EMULATOR_PID}" ]] && kill -0 "${EMULATOR_PID}" >/dev/null 2>&1; then
    kill "${EMULATOR_PID}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

ensure_deps "$(dirname "$0")/.."
ensure_deps "$(dirname "$0")/../functions"
ensure_deps "$(dirname "$0")/../functions-admin"
ensure_deps "$(dirname "$0")/../functions-payment"
ensure_deps "$(dirname "$0")/../functions-autograde"

echo "[start_local] starting Firebase emulators for ${PROJECT_ID}"
firebase emulators:start --project "${PROJECT_ID}" --only auth,functions,firestore,hosting >"${LOG_FILE}" 2>&1 &
EMULATOR_PID="$!"

wait_for_port "${HUB_HOST%:*}" "${HUB_HOST##*:}" "hub" 90
wait_for_port "${LOGGING_HOST%:*}" "${LOGGING_HOST##*:}" "logging" 90
wait_for_port "${AUTH_HOST%:*}" "${AUTH_HOST##*:}" "auth"
wait_for_port "${FUNCTIONS_HOST%:*}" "${FUNCTIONS_HOST##*:}" "functions"
wait_for_port "${EMULATOR_HOST%:*}" "${EMULATOR_HOST##*:}" "firestore"
wait_for_port "${HOSTING_HOST%:*}" "${HOSTING_HOST##*:}" "hosting"

echo "[start_local] syncing local Firestore from source project"
./scripts/bootstrap_local_emulator_data.sh

echo "[start_local] local stack is ready"
wait "${EMULATOR_PID}"
