# Database Schema (Firestore)

本文檔記錄 Vibe Coding 平台 Firestore 結構，基於目前線上系統實作。

## 1. `users` 集合 (核心)
儲存所有使用者（學生 / 導師 / 管理員）的個人資料、權限與學習狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `uid` | string | Firebase Auth UID。 |
| `email` | string | 使用者 Email。 |
| `name` / `displayName` | string | 顯示名稱。 |
| `photoURL` | string | 頭像連結。 |
| `role` | string | 系統角色：僅 `admin` 或 `user`。 |
| `tutorConfigs` | map | Tutor 單元授權狀態。Key 為 unitId，常見欄位：`authorized`, `assignmentUrl`, `courseId`, `updatedAt`。 |
| `tutorApplications` | array | 該使用者申請紀錄快照（部分流程使用）。 |
| `hasPendingApplication` | boolean | 是否有待審導師申請。 |
| `unitAssignments` | map | 學生單元指派導師。Key = unitId，Value = tutorEmail。 |
| `courseProgress` | map | 學習進度聚合資料。 |
| `orders` | array | 購買課程/項目識別資料（依版本可能有差異）。 |
| `updatedAt` | timestamp | 最後更新時間。 |
| `createdAt` / `joinedAt` | timestamp | 建立時間。 |

> 註：Tutor 不是 `role`，而是 `tutorConfigs[unitId].authorized === true` 的狀態。

---

## 2. `orders` 集合
儲存綠界付款訂單與後續履約狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `orderNumber` | string | 系統訂單編號（如 `VIBE...`）。 |
| `uid` | string | 購買者 UID。 |
| `amount` | number | 交易金額。 |
| `status` | string | `PENDING`, `SUCCESS`, `FAILED`。 |
| `items` | map | 訂單項目。Key 為 itemId，value 可含 `name`, `price`, `quantity`, `isPhysical`, `referralLink`, `referredTutorEmail`。 |
| `gateway` | string | 付款閘道（例如 `ECPAY`）。 |
| `paidAt` | timestamp | 付款完成時間。 |
| `paymentDate` | string | 金流回傳付款時間字串。 |
| `expiryDate` | timestamp | 課程權限到期時間。 |
| `fulfillmentStatus` | string | 出貨狀態（如 `PENDING`, `SHIPPED`）。 |
| `logistics` | map | 物流資料（門市/收件資訊）。 |
| `ecpayTradeNo` | string | 綠界交易編號。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

> 推薦綁定採 item-level：`items[itemId].referralLink` 與 `items[itemId].referredTutorEmail`。

---

## 3. `metadata_lessons` 集合
儲存課程與單元元資料。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `courseId` | string | 課程唯一識別碼。 |
| `title` | string | 課程/單元標題。 |
| `courseUnits` | array | 該課程包含的單元 HTML 檔列表。 |
| `price` | number | 價格（0 代表免費）。 |
| `category` | string | 課程類別（如 `prepare`, `started`, `basic`, `advanced`）。 |
| `isPhysical` | boolean | 是否為實體商品。 |
| `orderWeight` | number | 排序權重。 |

---

## 4. `assignments` 集合
儲存學生作業提交與評分狀態。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `userId` / `uid` | string | 學生 UID。 |
| `userEmail` / `studentEmail` | string | 學生 Email。 |
| `courseId` | string | 課程識別碼。 |
| `unitId` | string | 單元 ID。 |
| `assignmentTitle` | string | 作業標題。 |
| `submissionUrl` / `submissionText` | string | 提交內容。 |
| `assignedTutorEmail` | string | 該作業對應導師。 |
| `grade` | number | 分數。 |
| `feedback` | string | 評語。 |
| `createdAt` / `updatedAt` | timestamp | 建立/更新時間。 |

---

## 5. `tutor_applications` 集合
儲存導師資格申請審核資料。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `userId` | string | 申請者 UID。 |
| `userEmail` | string | 申請者 Email。 |
| `unitId` | string | 申請單元。 |
| `status` | string | `pending`, `approved`, `rejected`。 |
| `source` | string | 來源（如 `tutor_recommendation`）。 |
| `recommendedByEmail` | string | 推薦老師 Email。 |
| `appliedAt` | timestamp | 申請時間。 |

---

## 6. `profit_ledger` 集合
儲存導師分潤計算明細。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `tutorEmail` | string | 分潤歸屬導師。 |
| `orderId` | string | 關聯訂單 ID。 |
| `shareAmount` | number | 分潤金額。 |
| `level` | number | 分潤層級。 |
| `period` | string | 計算月份（YYYY-MM）。 |

---

## 7. 遷移備註 (Migration Notes)
1. 角色已統一為 `admin` 與 `user`，歷史 `student` 角色需遷移為 `user`。
2. `tutor_applications` 與 `users.tutorApplications` 可能並存於過渡期；新流程以 `tutor_applications` 為主。
3. 單元 key 含 `.html` 時，Firestore update 請使用 `FieldPath` 或一致正規化，避免 dot-in-key 巢狀化問題。
