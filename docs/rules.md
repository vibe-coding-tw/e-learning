# 系統權限與角色規範 (System Rules)

本文檔定義 Vibe Coding 平台的權限模型。本系統採用「最小權限原則」，區分「全域角色 (Roles)」與「單元狀態 (Status)」。

## 1. 全域角色 (Global Roles)

系統中只有兩大類行為主體：

1.  **管理員 (Admin)**: 
    *   具有系統最高權限。
    *   可審核導師申請、管理所有課程內容、檢視全站分潤明細。
    *   **導師模式 (Tutor Mode)**: 管理員專屬功能。開啟時獲得所有單元的導師權限；**關閉時則忽略（隱藏）本身的單元合格教師狀態**，以純管理員或學生視角進行操作。
2.  **一般使用者 (Standard User)**: 
    *   非管理員之所有登入帳號。
    *   **資料庫中的 `role` 欄位必須為空**。
    *   權限存取僅依據購買狀態 (Paid) 與 單元授權狀態 (Qualified Status) 決定。

> [!IMPORTANT]
> **「導師 (Tutor)」並非一個全域角色。** 
> 資料庫中的 `role` 欄位僅應儲存 `admin`。若無特殊權限，該欄位應為空或 `student`。

---

## 2. 單元授權狀態 (Unit Authorization Status)

使用者是否能以「導師」身份操作特定課程單元，取決於其在該單元下的**狀態**：

*   **合格導師 (Qualified Tutor Status)**:
    *   透過「申請與審核」機制獲得。
    *   紀錄於 `users` 集合中的 `tutorConfigs` 映射內。
    *   **權限範圍**: 僅限於獲得授權的單元或課程。包括：
        1. 檢閱學生在該單元的作業。
        2. 查看該單元的教學指引 (Tutor Guide) 與 評分標準 (Benchmark)。
        3. 修改該單元的專屬課程設定 (Unit Settings)。
        4. 獲獲該單元的專屬推薦碼並參與分潤。

---

## 3. 介面顯示邏輯 (Dashboard Rules)

管理介面 (Dashboard) 的標籤顯示遵循以下邏輯：

| 介面 / 功能 | 管理員 (Admin) | 合格導師 (Qualified Status) | 一般學生 (No Status) |
| :--- | :--- | :--- | :--- |
| **課程管理控制台 (Admin Console)** | ✅ 恆見 | ❌ 隱藏 | ❌ 隱藏 |
| **作業批改 (Assignments)** | ✅ 開啟導師模式時可見 | ✅ 僅限授權單元可見 | ❌ 隱藏 |
| **課程設定 & 分潤 (Settings/Profit)** | ✅ 開啟導師模式時可見 | ✅ 僅限授權單元可見 | ❌ 隱藏 |
| **導師模式開關 (Tutor Mode)** | ✅ 恆見 | ❌ 無此開關 | ❌ 隱藏 |

---

## 4. 資料庫維護準則

1.  **禁止手動修改 Role**: 除非確定為系統管理員，否則不應將使用者的 `role` 欄位改為 `tutor`。
2.  **單元 ID 規範**: 由於單元 ID 包含點號（如 `.html`），在 Firestore 更新 `tutorConfigs` 時，必須強制使用 `admin.firestore.FieldPath`，嚴禁使用樣板字串路徑更新。
