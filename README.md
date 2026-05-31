# Vibe Coding — 程式教學平台 (E-Learning)

Firebase 架構的程式教學平台，整合互動課程、自動評分、綠界金流 (ECPay)、硬體履約與多層級分潤。

---

## ✨ 平台特色

| 功能 | 說明 |
|---|---|
| Google 帳號登入 | 全站以 Google 帳號授權為主，正式站使用 `signInWithRedirect` |
| 平台原生作業派發 | 學生點擊作業後，系統直接於 GitHub 建立私有 Repo 並邀請學生為 Collaborator |
| 自動評分回寫 | GitHub Actions 評分結果透過 Webhook 自動回寫 Firestore |
| 硬體履約工作流 | 平台統一收款，實體商品交由當地經銷商出貨；系統負責派單、追蹤與結算 |
| Email 通知 | 付款、出貨、評分、導師審核等全自動通知 |
| 多層級分潤 | 直接分潤 20%，上線導師再獲 20% 遞迴計算 |

---

## 🏗️ 系統架構

### 前端 (`public/`)
- **技術棧**：原生 HTML5 / Vanilla CSS / JavaScript (ES6+)
- **核心模組**：

| 模組 | 主要功能 |
|---|---|
| `nav-component.js` | 全站導覽列、Google 登入、語系偵測、學習路徑選單 |
| `course-shared.js` | 課程渲染、進度追蹤、作業入口、導師綁定 |
| `dashboard.js` | Assignments / Settings / 分潤 / 物流顯示 |
| `i18n-helper.js` | UI locale 偵測 |
| `footer-component.js` | 全站 footer 注入 |

### 後端 (`functions/`)
- **平台**：Cloud Functions (Node.js 22)，部署於 `asia-east1`，`minInstances: 0`

| 功能群組 | 主要 Functions |
|---|---|
| 金流 / 訂單 | `initiatePayment`, `paymentNotify`, `stripeWebhook` |
| 課程授權 / 內容 | `getLessonsMetadata`, `checkPaymentAuthorization`, `serveCourse` |
| 導師 / 角色 | `setUserRole`, `authorizeTutorForCourse`, `applyForTutorRole`, `decideTutorApplication` |
| 作業 / 評分 | `submitAssignment`, `ingestGithubAutograde`, `createStudentRepository` |
| Dashboard | `getDashboardData` |
| 排程 | `calculateMonthlySharing`, `remindAdminPendingAssignments`, `checkCourseExpiration` |

### Firestore 集合

| 集合 | 說明 |
|---|---|
| `users` | 角色 (`admin`/`user`)、`tutorConfigs`（單元授權）、`unitAssignments`（導師綁定） |
| `orders` | 訂單、金流、物流狀態 (`fulfillmentStatus`, `logistics`) |
| `metadata_lessons` | 課程元資料（**唯一真實來源**，所有授權判斷以此為準） |
| `metadata_settings` | 全域設定（`content_runtime`, `tutor_terms`） |
| `tutor_applications` | 導師申請審核 |
| `activity_logs` | 學習行為追蹤 |
| `profit_ledger` | 分潤計算明細 |

> **Firestore First（強制）**：所有權限判斷、授權邏輯、資料比對一律以 Firestore 為準，禁止前後端維護硬編碼白名單。

---

## 🚀 快速操作

```bash
# 安裝後端依賴
cd functions && npm install

# 本地模擬器（Hosting + Functions + Firestore）
firebase emulators:start --project e-learning-942f7

# 部署全部
firebase deploy --project e-learning-942f7

# 僅部署後端
firebase deploy --only functions --project e-learning-942f7

# 僅部署前端
firebase deploy --only hosting --project e-learning-942f7
```

> 前端改動後需先執行 `node scripts/fingerprint-static-assets.js` 更新靜態資產指紋，再部署 hosting。

---

## ⚙️ 環境變數 (`functions/.env`)

| 類別 | 變數 |
|---|---|
| 金流 | `ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`, `ECPAY_HASH_IV`, `ECPAY_API_URL`, `ECPAY_LOGISTICS_MAP_URL` |
| 郵件 | `MAIL_USER`, `MAIL_PASS` |
| 站點 | `APP_BASE_URL`（預設 `https://vibe-coding.tw`）, `ADMIN_EMAIL` |
| GitHub | `GITHUB_WEBHOOK_SECRET` |

---

## 📖 文件索引

| 文件 | 說明 |
|---|---|
| [AGENT.md](AGENT.md) | Agent 規則、權限模型、開發 SOP（**唯一權威規範來源**） |
| [docs/database.md](docs/database.md) | Firestore 集合結構與欄位說明 |
| [docs/email-notifications.md](docs/email-notifications.md) | Email 通知觸發條件與規格 |
| [docs/recursive-sharing.md](docs/recursive-sharing.md) | 多層級分潤公式與對帳流程 |
| [docs/logistics-mvp.md](docs/logistics-mvp.md) | 硬體訂單履約流程與 Admin Logistics 規格 |
| [docs/tutor-management-mvp.md](docs/tutor-management-mvp.md) | 導師申請、審核與授權流程 |
| [docs/autograde-full-automation.md](docs/autograde-full-automation.md) | GitHub 自動評分回寫設定說明 |
| [docs/platform-expansion-plan.md](docs/platform-expansion-plan.md) | 國際化、合作夥伴與分潤擴張規劃 |
| [docs/distributor-fulfillment-model.md](docs/distributor-fulfillment-model.md) | 經銷商履約角色分工與結算規格 |
| [docs/migration-history.md](docs/migration-history.md) | 歷史遷移紀錄（Dashboard、Firestore ID 等） |

---

## ✅ 發布前檢查清單

每次異動以下項目請同步更新 README / docs：

- [ ] 新增、改名或刪除 Cloud Functions
- [ ] 調整 Firestore 結構（`orders`、`users.tutorConfigs`、`metadata_lessons`）
- [ ] 新增或改名 `.env` 參數
- [ ] 更動角色規則或授權機制

---

Vibe Coding &copy; 2026 | [info@vibe-coding.tw](mailto:info@vibe-coding.tw)
