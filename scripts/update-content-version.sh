#!/usr/bin/env bash
# update-content-version.sh — 更新 Firestore contentVersion 到 content-repo 最新 commit
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="${ROOT_DIR}/CONTENT_VERSION"

REPO_OWNER="${1:-vibe-coding-tw}"
REPO_NAME="${2:-content-repo}"
EMULATOR_HOST="${FIRESTORE_EMULATOR_HOST:-127.0.0.1:18080}"
PROJECT_ID="${FIREBASE_EMULATOR_PROJECT:-e-learning-942f7}"

echo "[update-content-version] Fetching latest commit from ${REPO_OWNER}/${REPO_NAME}..."

LATEST_SHA=$(git ls-remote "https://github.com/${REPO_OWNER}/${REPO_NAME}.git" HEAD 2>/dev/null | awk '{print $1}')

if [[ -z "${LATEST_SHA}" ]]; then
  echo "[update-content-version] ERROR: 無法取得最新 commit SHA"
  exit 1
fi

SHORT_SHA="${LATEST_SHA:0:7}"
echo "[update-content-version] Latest: ${SHORT_SHA} (${LATEST_SHA})"

# 寫入本地 VERSION 記錄
echo "${REPO_OWNER}/${REPO_NAME} @ ${LATEST_SHA}" > "${VERSION_FILE}"
echo "  → 已寫入 ${VERSION_FILE}"

# 更新 emulator Firestore
echo "[update-content-version] Updating emulator Firestore..."

curl -s -X PATCH \
  "http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/metadata_settings/content_runtime" \
  -H "Authorization: Bearer owner" \
  -H "Content-Type: application/json" \
  -d "{\"fields\": {\"contentVersion\": {\"stringValue\": \"${LATEST_SHA}\"}}}" \
  >/dev/null 2>&1

# 驗證
CV=$(curl -s "http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents/metadata_settings/content_runtime" \
  -H "Authorization: Bearer owner" 2>/dev/null | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('fields',{}).get('contentVersion',{}).get('stringValue','FAIL'))" 2>/dev/null)

if [[ "${CV}" == "${LATEST_SHA}" ]]; then
  echo "[update-content-version] ✅ Emulator contentVersion = ${CV}"
else
  echo "[update-content-version] ⚠️  Emulator 更新結果: ${CV} (預期 ${LATEST_SHA})"
fi
