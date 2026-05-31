# Vibe Coding - 網路教學平台 (E-Learning System)

本專案是一個基於 Firebase 的現代化程式教學平台，結合了互動式課程、作業自動化、綠界金流 (ECPay)、硬體出貨管理以及多層級分潤架構。

---

## 最近更新 (Recent Changes)

- **平台原生作業派發計劃 (Native Integration)**：GitHub Classroom 已停用，現行作業派發改為平台直接建立學生私有 Repo、以 Collaborator 身分邀請學生、以及自動回寫自動評分結果。詳見：docs/github-api-native-integration-plan.md
- **前端體驗優化**：學生端新增「一鍵領取作業」流程（Native API 模式），導師端可在 Settings 提供 GitHub Org / Template / PAT 以實現一班一組織的派發隔離。
- **平台擴張計畫 (Platform Expansion)**：新增平台擴張與營運策略文件，說明國際化、合作夥伴模式與分潤延伸策略。詳見：docs/platform-expansion-plan.md


## ✨ 平台特色 (Platform Highlights)

### 1. 平台原生作業派發整合 (Native Repo)
系統支援「事後綁定」：學生點擊「前往作業」後，會先輸入 Tutor Promotion code（或留白採用預設導師），綁定成功後由系統直接建立或開啟對應的學生私有 Repo。GitHub Classroom 已停用，歷史邀請連結僅保留相容與查核用途。
- **平台原生 Repo 模式 (現行)**：當導師於 Dashboard 設定了 GitHub 組織、樣板專案與 GitHub 權杖後，學生點擊作業按鈕即可由系統背景建立專案 Repo，並將學生新增為專案協作者 (Collaborator)，避開所有組織邀請卡點。
Promotion code 若有輸入，必須是該單元合格導師的 code 才能通過；舊版 `正式提交作業 (Submit for Review)` 視窗僅保留作為手動 fallback，不是預設主流程。

### 1.5 Google 帳號直接登入
全站登入以 Google 帳號為主。主導航列的 `登入` 按鈕現在會直接發起 Google 授權：
- 正式站使用 `signInWithRedirect`
- 本地模擬器使用 `signInWithPopup`
- `login.html` 保留作為備援入口，不再是一般使用者的預設登入流程

### 2. 智慧型多層級分潤 (Recursive Sharing)
推薦系統支援遞迴式計算：
- **直接分潤**: 推薦老師獲得 20%。
- **上級獎勵**: 上級導師可獲得下級分潤額的 20%。
- **上級鏈條來源**: 目前由 `users.tutorEmail` 作為上線導師 Email 欄位；若未設定，鏈條將回退至平台帳號。

### 3. 硬體出貨工作流 (Hardware Logistics)
整合綠界 CVS 電子地圖，管理員可從後台標記出貨，並自動寄送出貨提醒。

### 4. 全自動 Email 通知系統
涵蓋付款、導師指派、作業提交、GitHub 自動評分結果更新（學生與導師）、自動評分異常告警（Admin）、出貨完成通知、師資申請審核與管理員待辦提醒（含被推薦候選通知）。

---

## 已完成與現行規則 (Current Live Rules)

以下規則已落地並視為目前生產環境的實際行為：

- `Firestore First`：權限、付款授權、課程開通、導師資格、作業指引與分潤資料皆以 Firestore 為準。
- `登入` 入口直接走 Google 帳號授權，`login.html` 僅保留作為備援。
- `前往作業` 會先要求或確認 Tutor `Promotion code`，通過後直接開啟平台原生作業 Repo，不再預設開啟舊版 `正式提交作業 (Submit for Review)`。
- `learning-path.html` 依 `metadata_lessons` 動態產生分類與卡片，`prepare/start/basic/advanced` 只保留作為相容轉址。
- 課程單元內 `Dashboard` 頁面只保留 `Assignments`，`Settings` 只在合格導師或 `admin + TutorMode=ON` 可見。
- `Assignments` 與 `Settings` 的內容都直接抓課程頁內的隱藏 section：
  - `#assignment-guide`
  - `#tutor-guide`
- GitHub Autograde 會透過 `ingestGithubAutograde` 自動回寫分數到 Firestore，並保留 Admin 告警。
- 分潤、物流、導師審核、學生推廣與同步 PR 流程都已做成可重複執行的正式 SOP。
- 外部內容倉以 [vibe-coding-tw/content-repo](https://github.com/vibe-coding-tw/content-repo) 為主，`private_courses_i18n` 本地鏡像層已廢除。
- 國際付款 / 物流目前只有**部分完成**：
  - `cart.html` 已支援英文/非中文介面的 Stripe 路由與國際地址欄位。
  - `orders.logistics` 已預留國際直郵資料結構。
  - 但 EasyPost / Shippo / DHL / FedEx 類的真正國際物流聚合、運單產生、報關與海外出貨後台流程仍屬擴展規劃，尚未正式完成。

歷史遷移內容已整併為：
- `docs/migration-history.md`

---

## 📖 相關文件 (Documentation)
- **[📈 估值模型 (Valuation Model)](docs/investor/valuation-model.md)**：市場大小、三年情境、公司估值與系統估值框架（含可調參數 CSV）。
- **[🧭 融資計劃 (Funding Roadmap)](docs/investor/funding-roadmap.md)**：F/Angel 到 Seed/Pre-A 再到 A round 的里程碑與 KPI 規劃。
- **[⚖️ 開發與營運規範 (Project Rules)](AGENT.md)**：包含零元帳單規範、權限模型、ID 歸一化準則與開發 SOP。
- **[🗄️ Firestore 結構文件](docs/database.md)**：集合、欄位與遷移備註（以實作為準）。
- **[✉️ Email 通知規格](docs/email-notifications.md)**：通知觸發條件、收件者、深連結與異常告警規範。
- **[📘 學生操作指南](public/students.html)**：包含付款、導師指派、作業提交及師資申請流程。
- **[🧑‍🏫 導師操作指南](public/tutors.html)**：導師端日常操作與協作流程說明。
- **[學習路徑入口 (Learning Path)](public/learning-path.html)**：依 `metadata_lessons` 動態分類渲染課程卡片（`?path=tw-common|tw-car-starter|tw-car-basic|tw-car-advanced`）。
- **[🚚 物流管理 MVP](docs/logistics-mvp.md)**：硬體訂單出貨流程與 Admin Logistics 分頁規格。
- **[✅ 合格教師管理 MVP](docs/tutor-management-mvp.md)**：申請、推薦、審核與授權流程。
- **[💸 多層級分潤規格](docs/recursive-sharing.md)**：分潤公式、上線鏈條、冪等與對帳流程。
- **[🧭 平台擴張整合規劃](docs/platform-expansion-plan.md)**：整合課程架構升級、外部私有內容倉 i18n MVP、導師/代理/課程開發分潤參數化規劃。
- **[🤝 導師與學生的互動層 MVP](docs/tutor-student-interaction-mvp.md)**：自動評分之外的教學互動設計（卡點、提示階梯、成長軌跡、介入任務）。
- **[🧩 單元 Repo 協作改善流程](docs/unit-repo-collaboration-workflow.md)**：學生、導師、管理員共同迭代 README、tutor-guide 與測試/流程設定的提案與審核流程。
- **[🤖 Autograde 全自動化](docs/autograde-full-automation.md)**：批次設定 `userId+unitId` 對應、workflow 觸發策略與分數回寫模式。
- **[🔄 舊版學生 Repo 同步 PR 流程（歷史備查）](docs/classroom-sync-pr-workflow.md)**：template 更新後，批次對學生作業 repo 開同步 PR（含 dry-run 與衝突處理；僅供歷史與舊 repo 維護）。
- **[🧱 舊版中間層同步流程（歷史備查）](docs/classroom-bridge-sync-workflow.md)**：批次將 `vibe-coding-classroom-*` 中間層 repo 從 canonical template repo 同步更新（僅供歷史與舊 repo 維護）。
- **[🛡️ Starter Repo 安全檢查](docs/classroom-safety-preflight.md)**：發佈前檢查 starter repo 是否含解答/教師專用檔案，避免外洩。

### 📦 Archive / 歷史遷移文件
- **[🧭 歷史遷移總覽 (Migration History)](docs/migration-history.md)**：Dashboard legacy、Firestore legacy ID、canonical cleanup 的整併歷史紀錄。

---

## 🏗️ 系統架構 (System Architecture)

### 前端 (Frontend)
- **技術棧**: 原生 HTML5 / CSS3 (Vanilla CSS) / JavaScript (ES6+), TailwindCSS (部分組件)。
- **核心模組**:
  - `nav-component.js`: 跨頁面統一導覽、純 CSS Hover 注入、身份驗證狀態管理與直接 Google 登入入口。
  - `footer-component.js`: 全站底欄渲染與相對路徑解析中心。
  - `course-shared.js`: 單元內容渲染、進度追蹤、作業派發與導師綁定主流程。
- **數據通訊**: 透過 Firebase JS SDK 與 Firestore 及 Cloud Functions 交互。

### 後端 (Backend - Firebase)
- **Cloud Functions (Node.js 22)**:
  - **API 服務**: 
    - `initiatePayment` / `paymentNotify`: 綠界金流整合與付款回寫（實體商品需通過物流資料驗證；缺漏會標記 `logisticsMissing`）。
    - `getLogisticsMapParams` / `mapReply`: 綠界物流電子地圖整合。
    - `verifyReferralLink` / `verifyPromoCode`: 推薦連結與折扣碼驗證。
    - `resolveAssignmentAccess`: 判定使用者是否有權存取特定單元的作業指引。
    - `submitAssignment`: 作業紀錄建立與正式提交。
    - `ingestGithubAutograde`: 自動評分結果回寫。
    - `getDashboardData`: 提供儀表板統計與作業 Feed 數據。
    - `serveCourse`: 安全分發私有單元內容。
    - `logActivity`: 毫秒級學習行為追蹤 API。
  - **權限與導師管理**:
    - `setUserRole`: 管理員設置使用者全域角色。
    - `authorizeTutorForCourse` / `getTutorConfigs` / `saveTutorConfigs`: 導師單元授權與設定管理。
    - `applyForTutorRole` / `decideTutorApplication`: 導師申請與審核工作流。
    - `recommendTutorForUnit` / `submitTutorRecommendationInviteLink`: 導師主動推薦流程與連結綁定。
    - `bindTutorByPromotionCode` / `bindTutorToUnit` / `assignStudentToTutor`: 學生與導師的單元級綁定。
    - `precheckGithubClassroomAccess`：檢查學生是否已完成作業存取防呆機制（函式名保留歷史相容名稱）。
    - `checkPaymentAuthorization`: 確認單元存取權限並核發安全 Token。
  - **系統輔助工具 (Utilities)**:
    - `findClassroomInviteBinding` / `findClassroomInviteBindingHttp`：管理員查詢歷史綁定狀態用。
  - **出貨處理**:
    - `markOrderShipped`: 管理員手動標記已出貨。
  - **定時任務 (Scheduled Functions)**:
    - `calculateMonthlySharing`: 每月 1 號結算分潤。
    - `remindAdminPendingAssignments`: 每日提醒「學生本人」尚未完成導師綁定的付費單元。
    - `remindAdminPendingShipments`: 每日提醒待出貨硬體訂單。
    - `checkTrialExpiration` / `checkCourseExpiration`: 權限到期自動檢核與提醒。

### 數據庫結構 (Firestore)
- **`users`**: 核心使用者文件，角色僅 `admin` 與 `user`。
  - `unitAssignments`: 學生各單元對應導師 Email。
  - `tutorConfigs`: 單元授權狀態 (Status)，非全域角色。比對時強制執行 **ID 歸一化** (移除 `.html`)。
  - `tutorMode`: 管理員專用開關，開啟時模擬導師視角，關閉時模擬學員視角（遵循 `AGENT.md` 規範）。
- **`orders`**: 訂單紀錄。
  - `items[itemId]` 為購買項目本身（導師綁定不在購物車階段處理）。
  - `fulfillmentStatus` / `logistics`（硬體出貨狀態與物流資訊）。
  - `logisticsMissing`（實體商品付款後物流資料不完整時的警示旗標）。
- **`activity_logs`**: 學習行為追蹤（主要欄位：`courseId`, `action`, `duration`, `metadata`, `timestamp`）。
- **`tutor_applications`**: 導師申請審核資料（由推薦/申請流程建立）。
- **`referral_links`**: 導師推薦/綁定連結索引（含歷史 Classroom 相容資料）。
- **`metadata_settings`**: 全域設定（目前包含 `tutor_terms`）。
- **`profit_ledger`**: 分潤計算明細。

> 課程授權判斷（含免費課程）以 Firestore `metadata_lessons` 為單一真實來源；
> 課程單元鍵值異動請先更新 `metadata_lessons.courseUnits`，再部署程式碼。
>
> **Firestore First 原則（強制）**：
> - 所有「資料比對 / 權限判斷 / 邏輯驗證 / 寫入儲存」一律以 Firestore 為準。
> - 禁止在前端或後端維護硬編碼白名單、相容名單、舊 ID 對照表作為執行期判斷依據。
> - 若資料不一致，先修 Firestore 資料與遷移腳本，不新增 fallback 白名單邏輯。
> - `metadata_lessons.courseId` 以 canonical page URL 為主，`entryUnitId` 為主要課程入口；舊版 `*-master-*.html` 目前僅保留最小相容層，供歷史網址與歷史訂單使用，尚未完全刪除。

### 學習路徑頁（新）
- `public/learning-path.html` 為唯一課程列表頁，依 `path` 參數與 Firestore `metadata_lessons` 動態渲染。
- `public/prepare.html`、`public/start.html`、`public/basic.html`、`public/advanced.html` 保留為相容轉址頁。
- 導覽列分類與名稱維護以 Firestore 欄位為主：`locale`, `track`, `level`, `courseKey`，顯示名稱可用 `learningPathLabel*` / `categoryLabel*` / `navLabel*`。

### 前端 / 後端功能模組索引

#### 前端共用模組 (`public/js`)
| 模組 | 主要功能 |
|---|---|
| `nav-component.js` | 全站導覽列、Google 直接登入、語系偵測、學習路徑選單、Dashboard FAB / modal 注入、品牌連結修正 |
| `footer-component.js` | 全站 footer 注入與相對路徑解析 |
| `course-shared.js` | 課程單元頁共用邏輯：tab 生成、課程渲染、FAB、全螢幕 dashboard、作業入口、媒體 overlay、響應式調整 |
| `dashboard.js` | Dashboard 主程式：資料載入、Assignments / Settings / Tutor Management、guide 抽取、授權判斷、Tutor 綁定、作業/分潤/物流顯示 |
| `firebase-local.js` | Firebase config 與 emulator 連線工具 |
| `i18n-helper.js` | UI locale 偵測 |
| `ble-client.js` | Web BLE 客戶端（ESP32 / 裝置連線） |
| `quantifier.js` | 學習行為 / 連線 metrics 收集 |

#### 後端主程式與主要 Cloud Functions (`functions/index.js`)
| 功能群組 | 主要入口 |
|---|---|
| 金流 / 訂單 / 付款 | `initiatePayment`, `paymentNotify`, `stripeWebhook`, `getLogisticsMapParams` |
| 課程資料 / 授權 / 課程頁 | `getLessonsMetadata`, `updateLessonI18n`, `checkPaymentAuthorization`, `serveCourse` |
| 角色 / 導師 / 分潤 / 稽核 | `setUserRole`, `getRevenueSharePolicies`, `upsertRevenueSharePolicy`, `logActivity`, `saveTutorConfigs`, `getTutorConfigs`, `resolveAssignmentAccess`, `precheckGithubClassroomAccess`, `authorizeTutorForCourse`, `applyForTutorRole`, `debugTutorAuth`, `recommendTutorForUnit`, `submitTutorRecommendationInviteLink`, `decideTutorApplication`, `assignStudentToTutor`, `bindTutorToUnit`, `bindTutorByPromotionCode`, `submitTutorCoachingLog` |
| 作業 / 評分 / 自動評分 | `submitAssignment`, `gradeAssignment`, `ingestGithubAutograde`, `createStudentRepository`, `testGithubToken` |
| Dashboard / 檢視資料 | `getDashboardData` |
| 使用者 / 通知 / 排程 | `onUserCreated`, `checkTrialExpiration`, `checkCourseExpiration`, `remindAdminPendingAssignments`, `remindAdminPendingShipments`, `mapReply` |
| 邀請 / 綁定 / 推薦 / 分潤補助 | `verifyReferralLink`, `verifyPromoCode`, `findClassroomInviteBinding`, `findClassroomInviteBindingHttp`, `calculateMonthlySharing`, `markOrderShipped`, `submitStudentBlocker`, `submitAttemptSummary`, `resolveStudentBlocker` |

> 補充：`public/js/*.hash.js` 與未帶 hash 的源檔功能相同；維護時以無 hash 檔為主。`functions/index.js` 內部仍有大量 helper，不逐一列在主文件中。

---

## 🚀 開發與部署 (DevOps)

### 維運腳本（後端 / 專案級）
- 後端維運與資料修補腳本：`functions/scripts/`
- 專案級維運與站點工具：`scripts/`
- 舊 Classroom / bridge 類批次工具僅保留歷史備查；若目前沒有遷移、回補或相容需求，可列入退役候選。

#### 目前仍建議保留
- `scripts/fingerprint-static-assets.js`：Firebase Hosting 直接引用，用於靜態資產指紋化與快取更新。
- `scripts/audit-rover-tutor-configs.js`：稽核導師設定覆蓋率，對維護 `tutorConfigs` 仍有價值。
- `scripts/audit_autograde_consistency.sh`：檢查 autograde workflow / README / secrets 是否一致。
- `scripts/toggle_actions.py`、`scripts/toggle_bridge_actions.sh`：批次開關 GitHub Actions，適合大量維運時保留。

#### 可退役候選（若已無遷移 / 回補需求）
- `scripts/sync_classroom_repos.sh`
- `scripts/sync_classroom_bridge_repos.sh`
- `scripts/bootstrap_classroom_repo_autograde.sh`
- `scripts/generate_and_distribute_autograde_token.sh`
- `scripts/standardize_classroom_readme_autograde.sh`
- `scripts/sync_check_assignment_from_template.sh`
- `scripts/rewrite_template_org_in_csv.sh`
- `scripts/prune_bridge_repo_contents.sh`
- `scripts/remove_bridge_readme_title_prefix.sh`
- `scripts/remove_bridge_tutor_guide.sh`
- `scripts/merge_classroom_workflows.sh`
- `scripts/sync_bridge_readme_from_assignment_guide.py`
- `scripts/enrich_guides.py`
- `scripts/enrich_html5_basics.py`
- `scripts/migrate_tutor_guides.py`
- `scripts/normalize_bridge_readme_tone.sh`
- `scripts/revert_readme_autograde_section.sh`
- `scripts/setup_autograde_repo_mapping.sh`
- `scripts/check_classroom_solution_leak.sh`
- `scripts/translate_courses.py`
- `scripts/03-unit-github-classroom-README.md`（模板資產，非執行檔）
- `scripts/03-unit-github-classroom-tutor-guide.md`（模板資產，非執行檔）

> 註：這些腳本多半屬於歷史遷移或批次維運工具。若後續完全不再做舊 Classroom / bridge 相關作業，可再進一步搬到 `archive/` 或直接移除。

詳單請參考：[腳本退役候選清單](docs/script-retirement-candidates.md)

### 環境變數 (`functions/.env`)
- 金流：
  - `ECPAY_MERCHANT_ID`
  - `ECPAY_HASH_KEY`
  - `ECPAY_HASH_IV`
  - `ECPAY_API_URL`
  - `ECPAY_LOGISTICS_MAP_URL`
- 郵件：
  - `MAIL_USER`
  - `MAIL_PASS`
- 站點與通知：
  - `APP_BASE_URL`（email 連結基底，預設 `https://vibe-coding.tw`）
  - `ADMIN_EMAIL`（管理員通知信收件人；未設定時 fallback 至 `MAIL_USER`）
- GitHub 自動評分：
  - `GITHUB_WEBHOOK_SECRET`（用於驗證 `ingestGithubAutograde` 的 `X-Hub-Signature-256`）
- 物流資料回補：
  - `ECPAY_LOGISTICS_QUERY_URL`（選填；預設 `https://logistics.ecpay.com.tw/Helper/QueryLogisticsTradeInfo/V5`）

### GitHub 自動評分回寫 (Autograding Webhook)
- Webhook/API 入口：`ingestGithubAutograde`（HTTP POST）
- 功能：將 GitHub Actions / 作業 Repo 評分結果寫回 `assignments` 文件的 `autoGrade` 欄位。
- 運作機制：直接在學生作業 repo 或平台產生的專案設定中配置 Webhook，指向 `ingestGithubAutograde` 端點。
- 支援對象：
  - **平台原生模式**：Repo 命名通常為 `[作業名稱]-[學生帳號]`，Webhook 由系統在建立專案時自動設定。
- Workflow 定義與觸發條件由各教材範本或 bridge repo 維護，這個 repo 只負責後端接收與處理 Webhook，不包含 autograde 專屬 workflow 檔案。
- 觸發策略（省額度）：
  - 預設建議手動 `workflow_dispatch`
  - 若要 push 觸發，需滿足其一：
    - Repo variable `VC_AUTOGRADE_ON_PUSH=true`
    - commit message 含 `[autograde]`
- 文件定位方式：由 Webhook payload 傳入之 `userId + unitId`，或是透過 Repo 名稱解析 `githubUsername` 反查 `userId`，並搭配 `unitId`（自動執行 ID 歸一化），自動定位該生對應單元的最新作業。
- 安全策略：只寫入 `autoGrade*` 欄位，不覆蓋人工評分的 `grade`。

### 學生 Repo 同步（歷史備查）
- 歷史工具腳本：`scripts/sync_classroom_repos.sh`
- 目的：template repo 更新後，批次建立學生 repo 同步 PR（舊流程，僅保留歷史維護用途）。
- 操作文件：`docs/classroom-sync-pr-workflow.md`
- 先 dry-run，再 `--apply` 正式開 PR。

範例 payload：
```json
{
  "userId": "uid_xxx",
  "unitId": "01-unit-developer-identity.html",
  "score": 92,
  "maxScore": 100,
  "status": "completed",
  "runUrl": "https://github.com/org/repo/actions/runs/123",
  "workflow": "autograde",
  "commitSha": "abc123"
}
```

範例 GitHub Actions（呼叫 Cloud Function）：
```yaml
- name: Send auto grade to Vibe Coding
  env:
    VC_AUTOGRADE_URL: ${{ secrets.VC_AUTOGRADE_URL }}
    VC_AUTOGRADE_TOKEN: ${{ secrets.VC_AUTOGRADE_TOKEN }}
  run: |
    payload='{"userId":"'"$VC_USER_ID"'","unitId":"'"$VC_UNIT_ID"'","score":92,"maxScore":100,"status":"completed","runUrl":"'"$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"'","workflow":"'"$GITHUB_WORKFLOW"'","commitSha":"'"$GITHUB_SHA"'"}'
    sig="sha256=$(printf %s "$payload" | openssl dgst -sha256 -hmac "$VC_AUTOGRADE_TOKEN" | sed 's/^.* //')"
    curl -sS -X POST "$VC_AUTOGRADE_URL" \
      -H "Content-Type: application/json" \
      -H "X-Hub-Signature-256: $sig" \
      -d "$payload"
```

### 部署命令
```bash
# 全域部署
firebase deploy --project e-learning-942f7

# 僅部署後端函式
firebase deploy --only functions --project e-learning-942f7

# 僅部署前端
firebase deploy --only hosting --project e-learning-942f7
```

### 課程頁故障排查（FAB / `.ms-topnav` / 重複 nav）
- 症狀：
  - 課程右下角 `FAB` 不見
  - `start` 課程的 `.ms-topnav` 和 `basic/advanced` 不一致
  - 課程頁出現重複 nav
- 常見根因：
  - `functions/private_courses/*.html` 誤載入無效腳本（例如 `P26...` 字串），導致 `/js/course-shared.js` 沒執行
  - 只部署 hosting，未部署 functions（`/courses/*` 由 `serveCourse` 提供，內容來源在 functions）
- 標準修復：
  1. 確認課程 HTML 載入的是 `/js/course-shared.js?v=...`（不要是未知字串）
  2. 部署 `functions`：`firebase deploy --only functions --project e-learning-942f7`
  3. 若有改 `public/js/*` 再部署 `hosting`
  4. 前端驗證時使用硬重新整理 `Cmd+Shift+R`

### 課程單元內 Dashboard 開啟規範
- 課程單元頁右下角 `FAB`（📊）與支援中心中的 Dashboard 入口，需開啟「全螢幕 Dialog」內嵌 Dashboard（`mode=iframe`），不可直接離開當前單元頁。
- 使用者按下 `Esc` 時，若 Dashboard Dialog 開啟中，必須先關閉 Dialog 並回到原課程單元頁面。

### Dashboard 分頁顯示規則（強制）
- 非課程單元（`?unitId` 不存在）：只有 `admin` 可存取 Dashboard。
- 課程單元（`?unitId=...`）：
  - `Settings` 僅限 `isQualifiedTutor` 或 `admin + TutorMode=ON`。
  - 其餘情況導回 `Assignments`。
  - 在單元情境只顯示 `Assignments` / `Settings`；`Overview` / `Admin` / `Shipments` / `Earnings` 不顯示。

### CI/CD 自動化流程 (GitHub Actions)
1. **PR 預覽部署 (`firebase-hosting-pull-request.yml`)**
   - 觸發時機：發起 Pull Request 時。
   - 用途：部署到 Preview Channel，提供審核網址。
2. **正式上線部署 (`firebase-hosting-merge.yml`)**
   - 觸發時機：合併至 `main` 時。
   - 用途：部署 Hosting 與 Functions 至生產環境。

> 注意：本 repo 的 GitHub Actions 只涵蓋 Firebase 部署；學生作業 repo / bridge repo 的 autograde workflow 定義由外部 repo 維護，並不在此 repository 中。

---

## ✅ 文件同步檢查清單 (Release Checklist)
每次改動下列項目時，請同步更新 README / docs：
1. 新增、改名或刪除 Cloud Functions。
2. 調整 Firestore 結構（尤其 `orders.items.*`、`users.unitAssignments`、`users.tutorConfigs`）。
3. 新增或改名 `.env` 參數。
4. 更動角色規則（`admin|user`）或授權機制（Tutor 資格）。

---
Vibe Coding &copy; 2026 | [info@vibe-coding.tw](mailto:info@vibe-coding.tw)
