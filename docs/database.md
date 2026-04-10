# Database Schema (Firestore)

本文檔記錄 Vibe Coding 平台的 Firestore 資料庫結構，旨在幫助維護系統數據的一致性，特別是在「以使用者為中心 (User-Centric)」的架構遷移之後。

## 1. `users` 集合 (核心)
儲存所有使用者（包含學生、導師與管理員）的個人資料、權限與學習狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `uid` | string | Firebase Auth 的唯一識別碼。 |
| `email` | string | 使用者的電子郵件。 |
| `name` / `displayName` | string | 使用者的顯示名稱。 |
| `photoURL` | string | 使用者的頭像連結。 |
| `role` | string | 系統權限角色：僅 `admin` (管理員)。所有非管理員之使用者該欄位 **必須為空**。 |
| `tutorConfigs` | map | **關鍵欄位**。單元合格導師狀態 (Status)。Key 為單元 ID (如 `01-unit-setup.html`)。 |
| `tutorApplications` | array | 該使用者的導師申請歷史紀錄。 |
| `hasPendingApplication` | boolean | 是否有待審核中的申請。 |
| `unitAssignments` | map | **學生專用**。Key 為單元 ID，Value 為指派之導師 Email。 |
| `courseProgress` | map | 學習進度數據。Key 為單元 ID 或課程 ID。 |
| `orders` | array | 已購課程 ID 列表。 |
| `referralLinks` | map | **導師專用**。單元對應之老師作業連結內容映射。 |
| `referredByTutor` | string | **學生專用**。記錄最初推薦該學員入站的導師。 |
| `updatedAt` | timestamp | 最後更新時間。 |
| `joinedAt` | timestamp | 加入時間。 |

---

## 2. `orders` 集合
儲存所有來自藍新 (ECPay) 的交易紀錄。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `merchantTradeNo` | string | 藍新交易編號。 |
| `uid` | string | 購買者的 UID。 |
| `amount` | number | 交易金額。 |
| `status` | string | `PENDING`, `SUCCESS`, `FAILED`。 |
| `referralTutor` | string | 推薦此單元的導師 Email。 |
| `paidAt` | timestamp | 付款完成時間。 |

---

## 3. `metadata_lessons` 集合
儲存課程元數據，通常從 GitHub 同步。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `courseId` | string | 課程唯一識別碼。 |
| `title` | string | 課程/單元標題。 |
| `courseUnits` | array | 選項。該課程包含的所有單元 HTML 檔案列表。 |
| `price` | number | 價格 (0 為免費)。 |
| `category` | string | 課程類別 (e.g., `basic`, `advanced`, `started`)。 |

---

## 4. `profit_ledger` 集合
儲存導師分潤與計算明細。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `tutorEmail` | string | 應得分潤的導師。 |
| `orderId` | string | 關聯的交易 ID。 |
| `shareAmount` | number | 該筆交易所產生的分潤金額。 |
| `level` | number | 分潤層級（直接推薦為 1）。 |
| `period` | string | 所屬計算月份 (YYYY-MM)。 |

---

## 5. 遷移備註 (Migration Notes)
*   **Legacy Sync**: 原 `course_configs` 與 `tutor_applications` 已逐步遷移至 `users` 集合。
*   **Dot-in-Key Fix**: 由於單元 ID 包含點號（如 `.html`），在執行 `update` 時必須使用 `admin.firestore.FieldPath` 來避免非預期的物件嵌套。
