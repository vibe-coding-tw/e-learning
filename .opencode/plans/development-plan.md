# Vibe Coding Platform — Development Plan

> 建立日期：2026-07-02
> 專案：vibe-coding.tw（production, Firebase e-learning-942f7）

---

## 系統現狀

- **類型**: Serverless 線上教學平台（Taiwan-based, zh-TW/en）
- **技術**: Firebase (Hosting + Cloud Functions v2 × 4 + Firestore + Auth)
- **前端**: vanilla HTML/CSS/JS + Tailwind CSS (CDN)
- **後端**: Node.js 22, Cloud Functions (`asia-east1`, `minInstances: 0`, 128MB RAM)
- **套件管理**: npm, `vibe-functions-core` via local `.tgz`
- **測試**: Vitest（`shared-function-core/`, 8 test files）
- **版控**: 單一 `main` branch
- **CI**: GitHub Actions, GitHub API (Octokit)
- **付款**: ECPay + Stripe
- **目標**: GCP Always Free 層級，$1 預算警報

### 目錄結構

```
e-learning/
├── public/                        # Firebase Hosting root (HTML/JS/CSS)
│   ├── js/                        # Frontend modules (~20 files)
│   ├── graders/                   # Auto-grader scripts (bash)
│   └── examples/                  # 教學範例頁面，含獨立子專案：ESP32-C3 遙控車
│                                   # (d-pad.html / motor-config.html / wifi-config.html)
│                                   # 韌體與變更記錄不在本 repo，見 public/examples/README.md
├── functions/                     # "default" codebase (proxies, cron, bootstrap)
├── functions-autograde/           # "autograde" codebase
├── functions-payment/             # "payment" codebase
├── functions-admin/               # "admin" codebase
├── shared-function-core/          # Shared library (packed as .tgz)
├── docs/                          # Documentation (~36 files)
├── scripts/                       # Dev utility scripts
├── .opencode/                     # Agent workspace
│   └── plans/                     # Development plans
├── AGENT.md                       # Master agent policy (authoritative)
├── firebase.json                  # Firebase config
└── start-emulator.sh              # Local dev startup
```

---

## 待執行計畫

> `fix-dangling-import-and-i18n.md` 與 `remaining-improvements-phase1.md` 兩份原本列在此處，
> 已於 2026-07-02 完成並經 2026-07-14 重新以 `grep` 對照程式碼逐項複驗（dangling import、
> `Object.assign`、`HttpsError` 死鏈、alert() i18n、cart.html isEn 分支皆已在程式碼中消失/
> 替換），故從「待執行」移除。內容仍保留在各自檔案中作為歷史紀錄。

### security-fixes-2026-07-15.md（2026-07-15 新增）

全系統審查（程式碼 + 文件，e-learning 與 esp32c3-vehicle 兩個 repo）發現的付款/驗證安全漏洞。
4 項全部已修復：`initiatePayment` 金額改成後端用 `resolveDistributorCheckoutQuote()` 重新計算、
ECPay `paymentNotify` 的 `CheckMacValue` 改成強制驗證、`stripeWebhook` 加上簽章驗證（fail closed，
需要使用者設定 `STRIPE_WEBHOOK_SECRET` secret 才能真正收款）、`debugTutorAuth` 加上 admin 驗證。
詳見該文件。**使用者待辦**：`firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`（否則
`stripeWebhook` 會持續回 503，Stripe 付款完全無法使用——這比目前完全沒驗證安全，但代表 Stripe
金流目前是停用狀態，需要使用者決定何時要啟用）。

### distributor/distributor-tutor-development-tasks.md §7（2026-07-14 新增）

一次文件一致性審查（`docs/` 對照實際程式碼）的後續事項，屬於 P4.3「文件同步機制」的
一次實例。已完成履約狀態擴充（8 階段）與 REST API 層（對齊 `distributor-tutor-api-contract.md`）。
還沒決定的：`settlements/run`（背後是會觸發真實撥款的死碼，需要財務流程 owner 拍板）、
`tutors/:tutorId`（文件描述的功能從未實作，需要先定義要不要做）。另外還有兩處文件本身
的殘留問題（`distributor-tutor-ui-permissions.md` 概念模型過時、`.opencode/plans/courses/`
快照開始跟 `docs/courses/` 分岔）尚未處理。詳見該文件 §7。

---

## 開發計畫

### Phase 1 — 立即清理

> ✅ P1.1〜P1.8 已完成（2026-07-02 套用，2026-07-14 複驗程式碼確認無殘留）。P1.9 因 sandbox
> 環境限制（無法跨 tool call 保持 `firebase emulators:start` 常駐）尚未執行，需使用者本機跑一次。

| Step | 內容 | 檔案 | 依賴 | 狀態 |
|------|------|------|------|------|
| P1.1 | 移除 dangling import | `functions/index.js` | 無 | ✅ |
| P1.2 | cart.html i18n 轉換 + 新增 i18n keys | `public/cart.html`, `public/js/i18n-helper.js` | 無 | ✅ |
| P1.3 | 移除 dead Object.assign | `functions-payment/index.js` | 無 | ✅ |
| P1.4 | 清除 HttpsError 死鏈 | `functions/index.js`, `functions/lib/index-export-registry.js`, `functions/lib/index-export-autograde.js` | 無 | ✅ |
| P1.5 | 中段 import 移至頂端 | `functions-autograde/index.js` | 無 | ✅ |
| P1.6 | courses-management.html alert i18n | `public/courses-management.html`, `public/js/i18n-helper.js` | 無 | ✅ |
| P1.7 | investor-portal.html i18n | `public/investor-portal.html`, `public/js/i18n-helper.js` | 無 | ✅ |
| P1.8 | Re-fingerprint | — | P1.2, P1.6, P1.7 | ✅ |
| P1.9 | 環境檢查 + emulator smoke test | — | P1.1~P1.8 | ⚠️ 待使用者本機執行 |

### Phase 2 — 程式碼健康度

| Step | 內容 | 預估工時 |
|------|------|----------|
| P2.1 | 補強 `shared-function-core` 測試覆蓋率 | 中 |
| P2.2 | 全面掃描殘留 hardcoded `alert()` / `confirm()` | 小 |
| P2.3 | 檢查 4 個 codebase 的 dangling require/exports | 小 |
| P2.4 | 確認所有 `module.exports` 與實際使用一致 | 小 |

### Phase 3 — 功能演進

| Step | 內容 | 優先級 |
|------|------|--------|
| P3.1 | 數位商品購買流程強化 | medium |
| P3.2 | 導師管理後台 (tutorConfigs UI) | medium |
| P3.3 | 投資人入口功能擴充 | low |
| P3.4 | 站點分析儀表板（活動紀錄、營收趨勢） | low |

### Phase 4 — 基礎設施

| Step | 內容 | 優先級 |
|------|------|--------|
| P4.1 | 設定 staging Firebase project | high |
| P4.2 | CI/CD pipeline 強化（pre-deploy lint/test） | medium |
| P4.3 | 文件同步機制（docs/ 與實際 schema/behavior 一致）— 2026-07-14 對 distributor 相關文件做過一次人工審查與修正，見 `distributor/distributor-tutor-development-tasks.md` §7；還沒有自動化機制，其餘 ~70 份文件未逐一審查 | low |
| P4.4 | 自動化部署腳本標準化 | low |

---

## 執行注意事項

1. **修改 `shared-function-core/` 後** → `bash scripts/sync-core.sh` → `touch functions-*/index.js`
2. **修改前端靜態資源後** → `node scripts/fingerprint-static-assets.js`
3. **部署前** → `bash scripts/check-local-env.sh` → emulator 完整測試
4. **Git push 前** → 暫時關閉 GitHub Actions → push → 重新開啟
5. **Commit 格式** → Conventional Commits + `[skip ci]`（push 到 vibe-coding-classroom / vibe-coding-template 時）
