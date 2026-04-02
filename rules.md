# Vibe Coding: 核心開發規則與營運規範 (Project Rules)

本文件定義 Vibe Coding 平台的營運成本規範、權限模型與開發準則。

---

## 1. 零元帳單營運規範 (GCP Zero-Cost Rules)
致力於維持在 **Google Cloud Platform (GCP) 永久免費層級 (Always Free Tier)** 之內。

### 1-A. 存儲與鏡像管理 (Storage Cleanup)
- **規則**: 超過 24 小時的 Docker 鏡像與部署暫存檔 (gcf-sources) 必須自動刪除。
- **目標**: 確保 Artifact Registry 存儲量低於 **0.5 GB** 免費額度。

### 1-B. 算力與 AI 配置 (Compute & AI)
- **規則**: 函數 `minInstances` 恆設為 **0**，記憶體上限為 **128MB**。
- **AI 策略**: 採用「Flash 優先」策略，所有 AI 任務優先調用 **`gemini-1.5-flash`**。

### 1-C. 監控與預警 (Monitoring)
- **警報**: 帳單必須設定 **$1 預算警告**，防止任何資源洩漏。
- **地區**: 核心服務鎖定於 `asia-east1` (台灣)，嚴格禁止跨區域部署。

---

## 2. 系統權限與角色規範 (Access Control)
採用「最小權限原則」，區分「全域角色 (Roles)」與「單元狀態 (Status)」。

### 2-A. 全域角色 (Global Roles)
1. **管理員 (Admin)**: 系統最高權限，可檢閱所有數據。
    - **導師模式 (Tutor Mode: ON)**: 擁有 God Mode，可存取所有數位單元、指派作業、修改 GitHub classroom 連結。
    - **學員視角模擬 (Tutor Mode: OFF)**: **管理員身分不具備特權 (No Override)**。其行為與權限模擬一般學員：非合格導師且未付費（或已過期）者，嚴禁存取收費單元之作業連結與設定內容。
2. **一般使用者 (Standard User)**: `role` 欄位為空或為 `student`。存取權限僅依據購買狀態與單元合格授權。

### 2-B. 支付與過期檢核 (Paywall & Expiry)
- **付費判定**: 系統必須即時比對 `orderRecords` 中的 `expiryDate`。
- **規則**: **已過期 (Expired)** 或 **新用戶 (Free)** 嚴禁造訪付費單元 (Paid Units) 的任何作業 (Assignments) 指引與設定 (Settings)。

### 2-C. 實體產品與課程元數據 (Physical Products & Metadata)
- **實體產品決策**: 凡 `isPhysical` 為 `true` 且有價格的卡片（如：開發平台裝置），無論使用者是否具備管理員權限，在前台銷售頁面（Prepare, Basic, Advanced 等）必須優先顯示 **「🛒 加入購物車」** 與價格，嚴禁管理員 God Mode 自動跳轉為「進入課程」。這是為了確保銷售 UI 的正確性與購買流程的測試完整。
- **單一資料來源**: 所有前台展示的課程標題、價格、核心內容、圖示等元數據，必須以 **Firestore 的 `metadata_lessons` 為唯一準則**，嚴禁在 HTML 中硬編碼過時的資料。

---

## 3. Dashboard 分頁規劃 (V13.0)

### 3-A. 分頁職能矩陣 (Functional Matrix)

| 分頁 (Tab) | 單元視角 (Unit Context) | 全局視角 (Global View) | 存取對象 (Access) |
| :--- | :--- | :--- | :--- |
| **概覽 (Overview)** | ❌ 隱藏 (Hide) | ✅ 顯示 (營運概覽) | Admin Only (Global) |
| **作業 (Assignments)** | ✅ 顯示 (繳交清單) | ✅ 顯示 (全站 Feed) | Admin / Qualified Tutor / Paid Student |
| **課程設定 (Settings)** | ✅ 顯示 (教材/設定) | ❌ 隱藏 | Admin (Tutor ON) / Qualified Tutor |

### 3-B. 導航行為準則
- **進入單元 (Has UnitId)**: 優先導向 **Assignments** 指標。為了視覺專注，**Overview 標籤必須隱藏**。
- **全站視野 (No UnitId)**: 導向 **Overview**。這是管理員的全站儀表板入口。
- **鎖定邏輯**: 非付費/過期用戶在「學員視角」下，即便強行造訪 Assignments/Settings，系統應呈現「🔒 鎖定狀態」或「請先續費」字樣。

### 3-C. Overview 數據展示規範 (V13.6)
- **核心規則**: Overview (概覽) 作為管理員的營運中心，其數據統計（如：總註冊人數、學員清單）**不受「導師模式 (Tutor Mode)」切換的影響**。
- **目標**: 確保管理員即便在模擬導師時，依然能掌握全站 100% 的即時營運數據（如 Firebase 中的完整 9 位學員名單）。

---

## 4. 資料庫維護準則 (Maintenance)
1. **禁止手動更改 Role**: 禁止將使用者 `role` 改為 `tutor`（導師是 Status 而非 Role）。
2. **單一事實來源**: 所有設定資料必須透過 `users` 集合中的 `tutorConfigs` 字段存儲，`course_configs` 集合已廢棄。
3. **過期檢核**: 後端 `checkPaymentAuthorization` 必須包含 `expiryDate.toMillis() > now.toMillis()` 的判定邏輯。

---

## 5. Tutor Dashboard 介面精簡規範 (V13.5 UI Consolidation)
為了最大化教學管理效率，儀表板採取「單一任務中心」佈局。

### 5-A. 「課程設定 (Settings)」標籤整合佈局
在具備單元視角 (Unit Context) 時，Settings 分頁必須依序包含下列區塊 (不可隨意更動順序)：
1. **Classroom Links (作業連結設定)**: URL 邀請連結設置區。
2. **Integrated Assignments (本單元作業批改)**: 顯示該單元的學生繳交名單表格。
3. **Financial Dashboard (分潤紀錄與推薦碼)**: 
    - 需包含「累積總分潤」與「該單元專屬推薦碼」。
    - 需包含「分潤明細 (Ledger)」表格。
4. **Tutor Guides / Attachments (教學指引與附件)**:
    - 位於分頁最底部。
    - 僅顯示導師專用指引 (Tutor Guide) 與補充附件 (Attachments)。

### 5-B. 介面元素刪減準則 (UI Exclusion Rules)
為了維持介面清爽且專注於任務，下列元素**嚴禁顯示**：
- **移除 「合格教師狀態 (Teaching Team)」表格**: 不再顯示管理員/導師清單。
- **隱藏 「學生作業引導 (Assignment Guide)」**: Settings 分頁不顯示給學生的引導文字（僅保留導師批改指南）。
- **取消 「分潤 (Earnings)」獨立分頁**: 該分頁按鈕必須隱藏/移除，所有財務數據統一整合至 Settings 分頁。

### 5-C. 指引顯示規範 (Guide Rendering)
- **Settings 分頁**: 教學指引 (Tutor Guide) 置於最底部。
- **Assignments (作業) 分頁**: 在作業列表下方必須顯示「導師批改指南 (Tutor Benchmarks)」，作為評分參考。
- **緩存機制**: 每次部署介面重大變更，必須更新 `dashboard.js` 的版本查詢字串 (Cache Busting) 以確保用戶即時看到正確佈局。

---
*最後更新日期: 2026-04-02 (V13.6)*
