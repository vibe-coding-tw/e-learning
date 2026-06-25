#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CORE_DIR="${ROOT_DIR}/shared-function-core"
CORE_NAME="vibe-functions-core"
TGZ="${CORE_DIR}/${CORE_NAME}-1.0.0.tgz"

CODEBASES=(
  functions
  functions-admin
  functions-autograde
  functions-payment
)

echo "[sync-core] Rebuilding ${CORE_NAME} tarball..."
cd "${CORE_DIR}"
npm pack --force --pack-destination "${CORE_DIR}" 2>&1 | tail -1

if [[ ! -f "${TGZ}" ]]; then
  echo "[sync-core] ERROR: tarball not created at ${TGZ}"
  exit 1
fi

HASH="$(shasum -a 256 "${TGZ}" | cut -d' ' -f1 | head -c12)"
SIZE="$(stat -f%z "${TGZ}")"
echo "[sync-core] ${CORE_NAME}-1.0.0.tgz  ${SIZE} bytes  ${HASH}"

for codebase in "${CODEBASES[@]}"; do
  TARGET="${ROOT_DIR}/${codebase}"
  if [[ -d "${TARGET}" ]]; then
    cp "${TGZ}" "${TARGET}/"
    echo "[sync-core]   -> ${codebase}/${CORE_NAME}-1.0.0.tgz"
  fi
done

echo "[sync-core] done. Run 'npm install' in each codebase to update lockfiles."
echo "  for d in ${CODEBASES[*]}; do (cd \"${ROOT_DIR}/\$d\" && npm install --package-lock-only); done"
