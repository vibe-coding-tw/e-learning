# Vibe Coding Agent Policy

本文件定義本專案中所有 AI 代理人與自動化流程必須遵守的專案級規則。
所有 agent 在讀取、修改、部署或評估代碼前，必須先參考此文件。

> **全域規則**：`~/.gemini/GEMINI.md` 定義了跨所有專案的通用規則（Conventional Commits、[skip ci] 規範、enrich_guides 協議等），本文件為專案專屬的補充規範，兩者並行適用。

---

## 1. 代理人使用規則

- **本文件是唯一權威來源**：所有 AI agent 必須以 `AGENT.md` 為準。
- **Firestore 是唯一真實來源**：所有權限、授權、課程內容、元數據及付款狀態都必須以 Firestore 資料為基準。
- **禁止使用硬編碼白名單/相容表**：不得在執行時依賴 legacy mapping、硬編碼 ID 對照表或手動維護的兼容分支。
- **遇到不確定時，請求人工審核**：不要猜測授權、付款狀態或資料一致性。
- **不要在回應中提供視覺化驗證**：禁止截圖、錄影、視覺化 debug 或任何可見的瀏覽器操作影像。

---

## 2. 成本與部署限制

- 目標維持在 Google Cloud Platform 永久免費層級（Always Free）。
- 任何 Docker 鏡像或 GCF 暫存部署檔案超過 24 小時必須自動清除。
- Artifact Registry 存儲量應維持在 0.5 GB 以下。
- Cloud Functions 必須設定 `minInstances: 0`，RAM 上限為 128MB。
- AI 任務優先使用 `gemini-1.5-flash`。
- 核心服務限於 `asia-east1`，禁止跨區域部署。
- 必須設定 $1 預算警報，避免資源洩漏。

---

## 3. 權限與授權規則

- 採用最小權限原則，區分「全域 `role`」與「單元 `tutorConfigs`」。
- `role` 僅應表示 `admin` 或 `user`。導師身分不得以 `role: tutor` 實作。
- 導師資格應由 `users/{uid}.tutorConfigs[unitId].authorized` 來判定。
- 付款授權僅依賴 `orders` 集合中：
  - `status === "SUCCESS"`
  - `expiryDate > now`
- `checkPaymentAuthorization` 與 `resolveAssignmentAccess` 必須共用同一套判定邏輯。
- **`getLessonLookupKeys` 陷阱**：此函式定義於 `dashboard-utils-core.js` 但曾未 export，導致 `resolveLessonForOrderItemRuntime` 與 `findLessonByCourseRef` 崩潰。任何在 `dashboard-utils-core.js` 新增的工具函式若被其他模組使用，必須同時加入 `module.exports`。
- **課程 Token 安全防護（IP 與 UID 雙重綁定）**：
  - 授權 Token 格式升級為 `pageId|scopePart|expiry|uid|clientIp|signature` 6 段式架構。
  - `serveCourse` 在驗證 Token 時，必須提取連線的 Client IP（處理標準化 IPv6 與 `x-forwarded-for` 標頭）並與 Token 中的 IP 比對，不符時以 `403` 拒絕，以防範付費 Token 被任意複製擴散。同時支援 legacy 4 段式 Token 的向下相容。
- 過期或未付費使用者不得存取付費單元的作業指引與設定介面。
- 比對任何單元 ID 時，必須先做歸一化處理，例如移除 `.html` 後綴。
- 課程卡片僅在該課程下所有關聯單元 `authorized: true` 時才視為「已開通」。

---

## 4. 元資料與前台顯示規範

- 所有前台課程標題、價格、核心內容、圖示等元資料必須以 Firestore 中的 `metadata_lessons` 為唯一依據。
- 嚴禁在 HTML 中硬編碼過時資料。
- 實體商品 `isPhysical === true` 且有價格時，前台銷售頁面必須顯示「🛒 加入購物車」與價格，不得自動跳轉為「進入課程」。

---

## 5. 儀表板與介面行為規則

- 課程頁 UI 必須遵守 `docs/course-ui-runtime-spec.md`。
- 課程頁資訊架構必須區分：
  - 上方 TAB：跨課程單元導覽，資料來源為 Firestore `metadata_lessons.courseUnits`。
  - 左側 page menu：目前單元內頁面導覽，資料來源為課程 HTML 的 `window.UNITS` / `#sidebar-nav`。
- 課程 runtime 的單元路由、授權入口、跨單元 TAB 與課程進入連結，執行期只能讀取 `metadata_lessons.courseUnits`；`courseId`、`courseKey`、`entryUnitId` 僅可作歷史資料或 migration 檢查，不得再作為 runtime 的查找來源。
- 跨單元 TAB 僅在同一課程的 `courseUnits` 至少有 2 個有效單元時才可顯示；單一單元課程不得渲染 tabs。
- 平台 runtime 嚴禁使用 `courseUnits` 覆寫 `window.UNITS`、`#sidebar-nav` 或 `#index-unit-list`。
- `.ms-topnav`、TAB、左側 page menu、breadcrumb、語言選單與 FAB 都是課程頁必要元件，不得以 legacy fallback、隱藏或功能縮減掩蓋缺失。
- `.ms-topnav` 必須顯示 Firestore course metadata 的 `title` / `titleEn`，不得顯示目前單元名稱或以硬編碼 mapping 猜測名稱。
- 免費課程需要先登入才能進入；非免費課程未登入時仍必須可以加入購物車。
- `serveCourse` 必須確保課程 runtime scripts 使用可失效 CDN 快取的版本 URL 載入。
- 進入課程內容時，預設必須顯示第一個有效課程單元；不得把 `unit[0]` 的索引字面值或總覽頁當作使用者看到的預設落點。
- 單元視角（`unitId` 存在）時：
  - 隱藏 Overview 標籤。
  - 儀表板分頁順序應為 `Admin Console -> Assignments -> Settings`。
- 全站視角（無 `unitId`）時：
  - 預設導向 Overview。
- 非付費/過期用戶在單元視角下應看到鎖定提示，不得顯示 Assignments/Settings 內容。
- 單元內點擊作業時的行為：
  - 合格導師：開啟導師專屬繳交與審核對話框（或在一般學員模擬視角下工作）。
  - 已付費且有效學員：開啟作業確認/綁定對話框（`assignment-link-modal`），學生可輸入/確認導師的 Promotion code/Email；確認後系統呼叫 `createStudentRepository` 動態在 GitHub 組織中建立專屬私有 Repo，並邀請學生為 Collaborator，同時自動開啟 Feedback PR。
  - 未付費或已過期學員：不允許建立 Repo 或開啟作業，並顯示鎖定提示。
- 作業列表中嚴禁顯示單元標題或課程分類；顯示格式為：上方 `unitId`、下方 `Assignment Title`。
- 單元視角比對 `unitId` 時，應對 `.html` 後綴與常見前綴具容錯性。
- 不應以 `courseId` 精確匹配來排除符合 `unitId` 的作業記錄。
- 管理員全站視野時，Overview/Assignments/Admin 的內容不受 Tutor Mode 切換影響。

---

## 6. 推薦人與導師綁定分潤規則

- **推薦碼/推薦人綁定入口**：學生結帳時購物車不再輸入推薦連結或導師推薦碼。導師綁定移至**作業頁/彈出視窗（Assignment modal）**。
- **Promotion Code 綁定流程**：學生在開始作業前，必須確認或輸入導師的 Promotion code/Email。驗證成功後：
  - 系統將導師資料寫入 `users.unitAssignments[unitId]` 與 `users.unitAssignmentMeta[unitId]`。
  - 後端會自動調用 `backfillTutorReferralForPaidOrders` 回填歷史已付款訂單的 `referredTutorEmail` 與 `referralLink` 欄位，確保該訂單交易與導師正確關聯。
- **分潤計算**：每月 1 號的 `calculateMonthlySharing` 排程工作會讀取已成功付款並回填導師之訂單項目，依據對應的 `revenue_share_policies` 計算並分發利潤明細至 `revenue_share_credits`。
- **導師推廣連結**：歷史 `verifyReferralLink` 仍支援解析舊的作業邀請連結並綁定，但在購物車前台已顯示忽略提示。導師推廣請優先引導學員在作業視窗中直接輸入 Promotion code。
- **作業連結遷移原則**：內部命名與新流程一律維持 `assignment` / `legacyAssignmentUrl`，舊的 `classroom*` / `githubClassroom*` 僅作相容層、歷史資料與 API 契約回傳欄位使用；除非已確認所有 consumer 完成切換，否則不得直接移除 legacy fallback。
- **ID 歸一化**：在進行任何導師單元設定、鏈結解析與訂單回填比對時，必須對 `unitId` 執行 ID 歸一化（如移除 `.html` 後綴）。

---

## 7. 資料庫維護規範

- 禁止手動將使用者 `role` 設為 `tutor`。
- 所有設定資料應透過 `users.tutorConfigs` 儲存，`course_configs` 已廢棄。
- 屬性過期判定必須使用 `expiryDate.toMillis() > now.toMillis()`。
- 發現資料不一致時，優先進行資料遷移，禁止新增執行期 fallback。
- **共享快取規範**：
  - 課程 HTML 快取儲存於 `content_cache` 集合，藉此實作多實例共享二級快取以保護外部 Git 存取限制。

---

## 8. AI 代理人開發與驗證原則

- AI agent 必須在背景完成驗證，不得向使用者展示瀏覽器截圖或錄影。
- 所有驗證結果應以簡短文字總結呈現，避免無關細節。
- 使用者看到的輸出應以「結果屬實」為主，非操作過程描述。
- 只為本地開發或 emulator 相容性修正時，必須維持正式系統的資料來源與授權流程不變；允許調整本地前端、可呼叫函式、或 emulator adapter，但不得為了修 local 問題而放寬 Firestore rules、改寫正式 schema、或在 production path 新增不必要的 runtime fallback。

---

## 9. GitHub Repo 與 Actions 規則

- Push 到 **`vibe-coding-classroom/*`** 下的任何 repo 時：
  - commit message **必須**包含 `[skip ci]`，避免觸發無學生提交檔案的 workflow。
- Push 到 **`vibe-coding-template/*`** 下的任何 repo 時：
  - commit message **必須**包含 `[skip ci]`，避免觸發 `autograde-and-sync.yml`。
- **所有的 agents 在 push 資料到 `vibe-coding-tw` 與 `vibe-coding-classroom` 組織底下的任何 repos 時，都必須先暫時關閉 Actions 的功能（例如使用 GitHub CLI API），推送完成後再重新開啟，以節省 Actions 使用額度**。
- 避免自動化推送觸發大量不必要的 workflow 執行。

```
# ✅ 正確
git commit -m "docs: update README [skip ci]"

# ❌ 錯誤 — 會觸發 Actions 並造成失敗
git commit -m "docs: update README"
```

---

## 10. 開發與部署流程
 
- **本地優先驗證原則 (Local-First Validation)**：所有的修正、功能調整或代碼變更，**都必須先在本地端（Local / Emulator 環境）進行開發與完整功能驗證**，確保運行完全沒有任何問題（語法檢驗通過、邏輯正確、模擬器測試無誤）後，才可以執行部署到 Production。
  - 啟動前先執行環境檢查：`bash scripts/check-local-env.sh`
  - 啟動 emulator：`npx firebase emulators:start --project e-learning-942f7`
  - 本地 functions：`http://127.0.0.1:15001`，本地 Firestore：`127.0.0.1:18080`
  - 若修改 `shared-function-core/`，執行 `bash scripts/sync-core.sh` 自動重建 `.tgz` 並同步到所有 codebase，再於各目錄執行 `npm install --package-lock-only` 更新 lockfile，最後用 `node -e "require('vibe-functions-core/...')"` 確認新 export 正確。
- 任何功能更新、Bug 修復或設定調整完成後：
  1. 若有修改前端靜態資源 (JS/CSS)，必須先執行 `node scripts/fingerprint-static-assets.js` 更新資產指紋。
  2. `git add .`
  3. `git commit`（commit 訊息需符合 Conventional Commits 與 `[skip ci]` 規範）
  4. 依循 Rule 6a，在 `git push` 前暫時關閉 Actions 功能，推送後重開。
  5. 部署至 Firebase：`firebase deploy --project e-learning-942f7` (或依需求指定 `--only`)
- **服務快取失效策略**：
  - 當更新外部 `content-repo` 課程 HTML 後，執行 `bash scripts/update-content-version.sh` 自動將最新 commit SHA 寫入 Firestore emulator 與 `CONTENT_VERSION` 檔案，強制使所有實例的快取失效。
- **Git pre-commit hook**：`.githooks/pre-commit` 會自動檢查關鍵檔案是否被誤刪，以及 `.tgz` 同步一致性。已設定 `git config core.hooksPath .githooks`。
- **可用腳本一覽**：
  - `scripts/sync-core.sh` — 重建 shared-function-core .tgz 並同步到所有 codebase
  - `scripts/check-local-env.sh` — 驗證 local dev 環境完整性（檔案、emulator、設定、node_modules）
  - `scripts/update-content-version.sh` — 更新 content-repo commit 到 Firestore emulator
- 確保生產環境與最新程式碼同步。

---

---

## 11. Distributor Portal UI Behavior

- **Page layout (top→bottom)**: Header → Distributor tabs → Stat cards (專屬訂單/待出貨/Tutor數/本期佣金) → 經銷商定價維護 section
- **Stat cards**: 4 total — 專屬訂單, 待出貨, Tutor數, 本期佣金. 可套用商品 card is in the filter card row within 定價維護 section.
- **可套用商品 card**: onClick calls `window.distributorPortalSeedProducts()`, invokes `seedDistributorPriceBooksFromLessons` with `salePrice: 0`. Display formula: `seedableProductCount - priceBooks.length`. Prevent re-seed when count is 0.
- **Price Book Modal (`#portal-pricebook-modal`)**:
  - Form fields (in order): 經銷商ID, 價格表ID, docId, 幣別, 售價, 活動價, 促銷開始, 促銷結束, 版本, 啟用
  - 主價格生效日/失效日 fields are **removed** from modal. `effectiveFrom`/`effectiveTo` still exist in the backend schema but are not exposed in UI.
  - **Save** (`saveForm`): validates → calls `upsertDistributorPriceBook` → `showPriceBookModal(false)` (closes modal) → reloads price books. Does NOT repopulate the form.
  - **Delete** (red button, replaces old "清空"): calls `deleteDistributorPriceBook` callable → `showPriceBookModal(false)` → reloads. Confirms first.
  - **ESC key**: closes modal via `keydown` event listener registered on open, cleaned up on close.
  - Clicking overlay or "關閉" button calls `showPriceBookModal(false)`.
- **Price book list table**: No "操作" column (edit button removed). Entire `<tr>` row is clickable and opens modal via `distributorPortalOpenPriceBookModal(id)`.
- **Price book list date display**: Shows 主價格 start date only. 主價格迄 line removed from row display.
- **Filter cards**: `.filter-card` with `data-pricebook-filter` and `.filter-card.active` styling. Filter toggle uses `[data-pricebook-filter]:not(.filter-card)` selector for pill buttons and `.classList.toggle` for filter cards.
- **新增價格表 button**: Located in 經銷商定價維護 section's search/filter row, before the search input.
- **Distributor tabs**: Displayed in a standalone card section between header and stat cards. Each tab calls `window.distributorPortalSelectDistributor(id)`.

## 12. Courses Management Modal & Stat Cards

- **編輯課程 Modal (`.editor-area > .modal-wrap`)**: Full-screen (`position: fixed; inset: 0;`), no padding/radius/shadow. Header (`.modal-chrome`) is `position: sticky; top: 0;` with white background. All tab content and `.action-row` are inside `.modal-body-scroll` (flex column, `overflow-y: auto`).
- **Stat cards**: 4 filterable cards — 全部課程, 啟用中, 已隱藏, 已停用. Grid uses `grid-cols-4`.
- **Stat card numbers**: Update based on search input only (via `updateStats(searchFiltered)`). Clicking a stat card does not change the numbers — only the list filter changes.
- **Filter logic**: `renderLessons` computes `searchFiltered` (search only), then `filtered` (search + status). `updateStats(searchFiltered)` keeps numbers tied to search alone.
- **Sub-modals** (`#course-unit-modal`, `#pricebook-modal`): Use `.section-modal` with `position: fixed; z-index: 90`, overlaying the full-screen main modal.
- **Stat card colors**: 全部課程 slate, 啟用中 emerald, 已隱藏 orange, 已停用 red.

> 最後更新：2026-06-26
