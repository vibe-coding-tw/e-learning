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
   - **導師模式 (Tutor Mode)**: 開啟時獲全站權限；**關閉時則隱藏本身狀態，改以純管理員或學生視角操作**。
2. **一般使用者 (Standard User)**: `role` 欄位為空或為 `student`。存取權限僅依據購買狀態與單元合格授權。

### 2-B. 單元授權狀態 (Unit Status)
- **合格導師 (Qualified Status)**: 紀錄於 `users` -> `tutorConfigs` 映射內。
- **權限範圍**: 僅限於獲得授權的單元，可查看該單元作業、教師指引、推薦碼分潤與 GitHub Classroom 設定。

---

## 3. 介面與資料過濾邏輯 (UI & Data Rules)

### 3-A. Dashboard 分頁規劃 (Tab Planning)
| 分頁 (Tab) | 1. 管理員 (Tutor Mode: OFF) | 2. 管理員 (Tutor Mode: ON) | 3. 一般學員 (Student) |
| :--- | :--- | :--- | :--- |
| **概覽 (Overview)** | ✅ 顯示 (全站概覽) | ✅ 顯示 (營運概覽) | ✅ 顯示 (個人學習進度) |
| **學生狀態 (Assignments)** | ✅ 顯示 (已繳費學員清單) | ❌ 隱藏 (改至 Assignments) | ❌ 隱藏 |
| **作業 (Assignments)** | ❌ 隱藏 (改至 Students) | ✅ 顯示 (待批改作業列表) | ✅ 顯示 (我的作業) |
| **課程設定 (Settings)** | ❌ 隱藏 | ✅ 顯示 (Classroom/導師指引) | ❌ 隱藏 |
| **分潤 (Earnings)** | ❌ 隱藏 (改至 Admin 面板) | ✅ 顯示 (個人推薦碼分潤) | ❌ 隱藏 |

### 3-B. 導航行為準則
- **Context Based**: 若網址不帶 `unitId` (全局視角)，優先顯示 **Overview (概覽)**；若帶有 `unitId`，則優先顯示現有作業或設定。
- **命名準則**: 「課程設定」分頁一律顯示為 **課程設定 (Settings)**。

---

## 4. 資料庫維護準則 (Maintenance)
1. **禁止手動更改 Role**: 禁止將使用者 `role` 改為 `tutor`（導師是 Status 而非 Role）。
2. **單元 ID 更新**: 處理包含點號（如 `.html`）的 ID 時，必須使用 `admin.firestore.FieldPath` 更新 `tutorConfigs`。
3. **單一事實來源**: 所有設定資料必須透過 `users` 集合中的 `tutorConfigs` 字段存儲，`course_configs` 集合已廢棄。

---
*最後更新日期: 2026-04-02*
