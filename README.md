# Vibe Coding — 程式教學平台

Serverless 教學平台，整合 GitHub 自動評分、金流、履約與導師分潤。

---

## ✨ 平台特色

| 功能 | 說明 |
|---|---|
| Google 帳號登入 | 全站以 Google 帳號授權為主 |
| 原生作業派發 | 點擊作業後直接建立私有 Repo |
| 自動評分 | GitHub Actions 結果自動回寫 Firestore |
| Email 通知 | 付款、出貨、評分、審核等自動通知 |
| 分潤 | 直接分潤 20%，上線導師再獲 20% |
| 硬體履約 | 系統負責派單、追蹤與結算 |

---

## 🏗️ 系統架構

### 前端 (`public/`)
- **技術棧**：HTML5 / CSS / JavaScript
- **核心模組**：

| 模組 | 主要功能 |
|---|---|
| `nav-component.js` | 導覽列、登入、語系 |
| `course-shared.js` | 課程渲染、進度、作業入口 |
| `dashboard.js` | Assignments / Settings / 分潤 / 物流 |
| `i18n-helper.js` | Locale 偵測 |
| `footer-component.js` | Footer 注入 |
| `dashboard-lookup-utils.js` | Dashboard lookup 工具 |
| `repo-slug-utils.js` | repo slug 正規化 |

> `public/js/*.js` 以「無 hash 的 source 檔」作為唯一編輯來源；帶 hash 的同名檔案是 fingerprint 產物，應由 `node scripts/fingerprint-static-assets.js` 自動更新，不要手動維護。

### 後端 (`functions/`)
- **平台**：Cloud Functions (Node.js 22)，`asia-east1`，`minInstances: 0`

| 功能群組 | 主要 Functions |
|---|---|
| 金流 / 訂單 | `initiatePayment`, `paymentNotify`, `stripeWebhook` |
| 課程 / 授權 | `getLessonsMetadata`, `checkPaymentAuthorization`, `serveCourse` |
| 導師 / 角色 | `setUserRole`, `authorizeTutorForCourse`, `applyForTutorRole`, `decideTutorApplication` |
| 作業 / 評分 | `submitAssignment`, `ingestGithubAutograde`, `createStudentRepository` |
| Dashboard | `getDashboardData` |
| 排程 | `calculateMonthlySharing`, `remindAdminPendingAssignments`, `checkCourseExpiration` |

### Firestore 集合

| 集合 | 說明 |
|---|---|
| `users` | 使用者、授權、綁定 |
| `orders` | 訂單、金流、物流 |
| `metadata_lessons` | 課程元資料（唯一真實來源） |
| `metadata_settings` | 全域設定 |
| `tutor_applications` | 導師申請 |
| `activity_logs` | 學習追蹤 |
| `profit_ledger` | 分潤明細 |

> **Firestore First（強制）**：所有權限判斷、授權邏輯、資料比對一律以 Firestore 為準，禁止前後端維護硬編碼白名單。

---

## 🚀 快速操作

```bash
# 安裝依賴
cd functions && npm install

# 本地模擬器
firebase emulators:start --project e-learning-942f7

# 部署全部
firebase deploy --project e-learning-942f7
```

> 前端改動後需先執行 `node scripts/fingerprint-static-assets.js` 更新靜態資產指紋，再部署 hosting。

---

## ⚙️ 環境變數 (`functions/.env`)

| 類別 | 變數 |
|---|---|
| 金流 | `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, `ECPAY_API_URL`, `ECPAY_LOGISTICS_MAP_URL` |
| 郵件 | `MAIL_USER`, `MAIL_PASS` |
| 站點 | `APP_BASE_URL`, `ADMIN_EMAIL` |
| GitHub | `GITHUB_WEBHOOK_SECRET` |

---

## 📖 文件索引

| 文件 | 說明 |
|---|---|
| [AGENT.md](AGENT.md) | Agent 規則與開發 SOP（唯一權威） |
| [docs/database.md](docs/database.md) | Firestore schema |
| [docs/assignment-url-migration-plan.md](docs/assignment-url-migration-plan.md) | 作業連結遷移 |
| [docs/email-notifications.md](docs/email-notifications.md) | Email 通知規格 |
| [docs/tutor-management-mvp.md](docs/tutor-management-mvp.md) | 導師流程 |
| [docs/functions-module-overview.md](docs/functions-module-overview.md) | `functions/` 模組地圖 |
| [docs/index-helper-inventory.md](docs/index-helper-inventory.md) | helper 清單 |
| [docs/recursive-sharing.md](docs/recursive-sharing.md) | 分潤與對帳 |
| [docs/logistics-mvp.md](docs/logistics-mvp.md) | 物流流程 |
| [docs/legacy-and-backlog.md](docs/legacy-and-backlog.md) | 歷史與 backlog |
| [docs/order-normalization-plan.md](docs/order-normalization-plan.md) | 訂單 / referral 拆分 |
| [docs/autograde-full-automation.md](docs/autograde-full-automation.md) | 自動評分整合 |
| [docs/platform-expansion-plan.md](docs/platform-expansion-plan.md) | 擴張規劃 |
| [docs/course-slug-canonical-rules.md](docs/course-slug-canonical-rules.md) | 課程 slug 命名規則 |
| [docs/course-slug-migration-map.md](docs/course-slug-migration-map.md) | 課程 slug 遷移圖 |
| [docs/course-slug-alias-implementation.md](docs/course-slug-alias-implementation.md) | 課程 alias 實作方案 |
| [docs/examples/metadata-lessons-pricing-template.csv](docs/examples/metadata-lessons-pricing-template.csv) | metadata_lessons 價格範例 |
| [docs/examples/metadata-lessons-pricing-template.md](docs/examples/metadata-lessons-pricing-template.md) | metadata_lessons 價格範例說明 |
| [docs/distributor-fulfillment-model.md](docs/distributor-fulfillment-model.md) | 履約結算 |
| [docs/migration-history.md](docs/migration-history.md) | 歷史遷移紀錄（Dashboard、Firestore ID 等） |
| [docs/classroom-legacy-classification.md](docs/classroom-legacy-classification.md) | 歷史資產分類 |

> 收尾原則：內部命名維持中性語意；歷史相容欄位先保留，API 回傳欄位最後再 cutover。
>
> `public/en/` 與 `public/tw/` 的學生 / 導師入口不再保留本地鏡像頁面；這四個入口改由 `serveCourse` 即時從外部 `content-repo/public/en|zh-TW` 取得內容。請直接維護 `content-repo` 中的對應頁面，並以 `contentVersion` 進行版本鎖定。`students` / `tutors` 的繁中與英文入口不要再導去 `learning-path.html` 或 `index.html#core-values`。
>
> `learning-path` 目前直接讀 Firestore 的 `metadata_lessons`，不再使用 `public/data/metadata_lessons.local.json` 這類本地 fallback。

---

## ✅ 發布前檢查清單

每次異動以下項目請同步更新 README / docs：

- [ ] 新增、改名或刪除 Cloud Functions
- [ ] 調整 Firestore 結構（`orders`、`users.tutorConfigs`、`metadata_lessons`）
- [ ] 新增或改名 `.env` 參數
- [ ] 更動角色規則或授權機制

---

Vibe Coding &copy; 2026 | [info@vibe-coding.tw](mailto:info@vibe-coding.tw)
