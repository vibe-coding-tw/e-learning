#!/usr/bin/env bash
# check-local-env.sh — 驗證 local development 環境完整性
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

echo ""
echo "=== 1. 關鍵檔案存在性 ==="

if [[ -f "${ROOT_DIR}/public/js/firebase-local.js" ]]; then
  pass "public/js/firebase-local.js"
else
  fail "public/js/firebase-local.js (缺少，NAV 無法連接 emulator)"
fi

for f in \
  public/js/nav-component.js \
  public/js/course-shared.js \
  public/index.html \
  public/learning-path.html \
  public/auth.html; do
  if [[ -f "${ROOT_DIR}/${f}" ]]; then
    pass "${f}"
  else
    fail "${f}"
  fi
done

echo ""
echo "=== 2. Emulator 連線 ==="

check_port() {
  local host="$1" port="$2" label="$3"
  if node -e "const n=require('node:net'); const s=n.createConnection({host:'${host}',port:${port}}); s.once('connect',()=>{s.end();process.exit(0)}); s.once('error',()=>process.exit(1)); setTimeout(()=>process.exit(1),1000)" >/dev/null 2>&1; then
    pass "${label} (${host}:${port})"
  else
    fail "${label} (${host}:${port}) — 未啟動"
  fi
}

check_port "127.0.0.1" "18080" "Firestore emulator"
check_port "127.0.0.1" "19099" "Auth emulator"
check_port "127.0.0.1" "15001" "Functions emulator"
check_port "127.0.0.1" "15002" "Hosting emulator"

echo ""
echo "=== 3. Emulator 設定 (content_runtime) ==="

CONFIG=$(curl -s "http://127.0.0.1:18080/v1/projects/e-learning-942f7/databases/(default)/documents/metadata_settings/content_runtime" \
  -H "Authorization: Bearer owner" 2>/dev/null)

if echo "$CONFIG" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('fields',{}).get('enabled',{}).get('booleanValue') else 1)" 2>/dev/null; then
  pass "content_runtime.enabled == true"
else
  fail "content_runtime.enabled 不是 true（課程內容無法抓取）"
fi

REPO_OWNER=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('fields',{}).get('repoOwner',{}).get('stringValue',''))" 2>/dev/null)
REPO_NAME=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('fields',{}).get('repoName',{}).get('stringValue',''))" 2>/dev/null)
CV=$(echo "$CONFIG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('fields',{}).get('contentVersion',{}).get('stringValue',''))" 2>/dev/null)

if [[ -n "${REPO_OWNER}" && -n "${REPO_NAME}" ]]; then
  pass "content_runtime → ${REPO_OWNER}/${REPO_NAME} @ ${CV:-(main)}"
else
  fail "content_runtime repoOwner/repoName 未設定"
fi

echo ""
echo "=== 4. Node.js 相依性 ==="

for codebase in functions functions-admin functions-autograde functions-payment; do
  if [[ -d "${ROOT_DIR}/${codebase}/node_modules" ]]; then
    pass "${codebase}/node_modules"
  else
    fail "${codebase}/node_modules （執行 npm ci）"
  fi
  if [[ -f "${ROOT_DIR}/${codebase}/package-lock.json" ]]; then
    pass "${codebase}/package-lock.json"
  else
    fail "${codebase}/package-lock.json"
  fi
done

echo ""
echo "=== 5. Core .tgz 一致性 ==="

TGZ_SRC="${ROOT_DIR}/shared-function-core/vibe-functions-core-1.0.0.tgz"
if [[ -f "${TGZ_SRC}" ]]; then
  REF_HASH=$(shasum -a 256 "${TGZ_SRC}" | cut -d' ' -f1)
  pass "shared-function-core/vibe-functions-core-1.0.0.tgz"
  for codebase in functions functions-admin functions-autograde functions-payment; do
    TGZ_TARGET="${ROOT_DIR}/${codebase}/vibe-functions-core-1.0.0.tgz"
    if [[ -f "${TGZ_TARGET}" ]]; then
      T_HASH=$(shasum -a 256 "${TGZ_TARGET}" | cut -d' ' -f1)
      if [[ "${REF_HASH}" == "${T_HASH}" ]]; then
        pass "  ${codebase}/vibe-functions-core-1.0.0.tgz ✓"
      else
        fail "  ${codebase}/vibe-functions-core-1.0.0.tgz SHA256 不符（執行 scripts/sync-core.sh）"
      fi
    else
      fail "  ${codebase}/vibe-functions-core-1.0.0.tgz 遺失"
    fi
  done
else
  fail "shared-function-core/vibe-functions-core-1.0.0.tgz 遺失（執行 scripts/sync-core.sh）"
fi

echo ""
echo "================================"
echo "  通過: ${PASS}  失敗: ${FAIL}"
echo "================================"
exit ${FAIL}
