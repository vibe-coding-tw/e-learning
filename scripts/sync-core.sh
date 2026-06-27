#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

CODEBASES=(
  functions
  functions-admin
  functions-autograde
  functions-payment
)

echo "[sync-core] Rebuilding vibe-functions-core .tgz and reinstalling in each codebase..."

SHARED_CORE="${ROOT_DIR}/shared-function-core"

if [[ ! -d "${SHARED_CORE}" ]]; then
  echo "[sync-core] ERROR: shared-function-core not found at ${SHARED_CORE}"
  exit 1
fi

echo "[sync-core]   -> packing shared-function-core..."
(cd "${SHARED_CORE}" && npm pack --quiet 2>/dev/null)

TGZ_FILE=$(ls "${SHARED_CORE}"/vibe-functions-core-*.tgz 2>/dev/null | head -1)
if [[ -z "${TGZ_FILE}" ]]; then
  echo "[sync-core] ERROR: no .tgz file generated in shared-function-core/"
  exit 1
fi
echo "[sync-core]   -> tgz: $(basename "${TGZ_FILE}")"

for codebase in "${CODEBASES[@]}"; do
  TARGET="${ROOT_DIR}/${codebase}"
  if [[ -d "${TARGET}" ]]; then
    echo "[sync-core]   -> reinstalling in ${codebase}..."
    cp "${TGZ_FILE}" "${TARGET}/"
    rm -rf "${TARGET}/node_modules/vibe-functions-core" "${TARGET}/package-lock.json"
    (cd "${TARGET}" && npm install --quiet 2>/dev/null)
    rm -f "${TARGET}/$(basename "${TGZ_FILE}")"
  fi
done

rm -f "${TGZ_FILE}"
echo "[sync-core] done."
