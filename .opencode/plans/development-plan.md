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
│   └── graders/                   # Auto-grader scripts (bash)
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

### fix-dangling-import-and-i18n.md

移除 `functions/index.js` 的 dangling `registerAdminExports` import，並將 `cart.html` 的 `localizeDistributorName` / `localizeRegionLabel` 改為 `window.t()` i18n 呼叫。共 5 steps + re-fingerprint。

### remaining-improvements-phase1.md

- **A1**: 移除 `functions-payment/index.js` 的 dead `Object.assign`
- **A2**: 清除 `HttpsError` 死鏈（3 個檔案）
- **A3**: 將 `functions-autograde/index.js` 的中段 import 移至檔案頂端
- **B1**: `courses-management.html` 7 個 `alert()` 改 i18n
- **B2**: `investor-portal.html` 4 個硬編碼字串改 i18n
- **C**: Re-fingerprint

---

## 開發計畫

### Phase 1 — 立即清理

| Step | 內容 | 檔案 | 依賴 |
|------|------|------|------|
| P1.1 | 移除 dangling import | `functions/index.js` | 無 |
| P1.2 | cart.html i18n 轉換 + 新增 i18n keys | `public/cart.html`, `public/js/i18n-helper.js` | 無 |
| P1.3 | 移除 dead Object.assign | `functions-payment/index.js` | 無 |
| P1.4 | 清除 HttpsError 死鏈 | `functions/index.js`, `functions/lib/index-export-registry.js`, `functions/lib/index-export-autograde.js` | 無 |
| P1.5 | 中段 import 移至頂端 | `functions-autograde/index.js` | 無 |
| P1.6 | courses-management.html alert i18n | `public/courses-management.html`, `public/js/i18n-helper.js` | 無 |
| P1.7 | investor-portal.html i18n | `public/investor-portal.html`, `public/js/i18n-helper.js` | 無 |
| P1.8 | Re-fingerprint | — | P1.2, P1.6, P1.7 |
| P1.9 | 環境檢查 + emulator smoke test | — | P1.1~P1.8 |

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
| P4.3 | 文件同步機制（docs/ 與實際 schema/behavior 一致） | low |
| P4.4 | 自動化部署腳本標準化 | low |

---

## 執行注意事項

1. **修改 `shared-function-core/` 後** → `bash scripts/sync-core.sh` → `touch functions-*/index.js`
2. **修改前端靜態資源後** → `node scripts/fingerprint-static-assets.js`
3. **部署前** → `bash scripts/check-local-env.sh` → emulator 完整測試
4. **Git push 前** → 暫時關閉 GitHub Actions → push → 重新開啟
5. **Commit 格式** → Conventional Commits + `[skip ci]`（push 到 vibe-coding-classroom / vibe-coding-template 時）
