# Course Activation Settings
**Last updated**: 2026-06-25

這份文件整理目前「課程是否已開通」的正式設定來源、判定順序與相關欄位，方便排查卡片 CTA、`auth.html` 轉跳，以及付款後自動開通流程。

## 1. 課程開通的真實來源

課程開通不是單一欄位決定，而是由 Firestore、課程 metadata、價格表、訂單與登入狀態共同組成。

### 1.1 主要資料來源

- `metadata_lessons`
  - 提供課程 canonical identity、`courseUnits`、分類、層級與內容結構。
  - `id` / `docId` 是課程主鍵。
  - `courseId`、`entryUnitId`、`contentRef` 只保留作相容或 migration 用途。
- `dealer_price_books`
  - 提供課程價格與促銷價格。
  - 沒有對應 price book 的課程，視為未定價，不應被當成免費課程放行。
- `orders`
  - 提供付款成功與到期狀態。
  - `status === "SUCCESS"` 且 `expiryDate > now` 才算有效訂單。
- `users`
  - 提供註冊時間、導師模式、購買快取與推薦綁定資訊。
  - 其中 `paid`, `hasStarterAccess`, `lastPaidOrderId` 是派生快取，不是主授權來源。

### 1.2 前端與後端共同使用的請求參數

`checkPaymentAuthorization` 與 `learning-path.html` 目前會一起使用以下欄位：

- `docId`
- `pageId`
- `fileName`
- `price`
- `currency`
- `tutorMode`

其中 `docId` / `pageId` / `fileName` 必須能對回 `metadata_lessons` 的 canonical lesson。

---

## 2. 現行開通判定順序

目前 `checkPaymentAuthorization` 的判定順序如下：

1. **免費課程**
   - 若 `dealer_price_books` 算出的價格 `<= 0`，且使用者已登入，直接視為已開通。
2. **Starter 30 天體驗**
   - 若課程屬於 starter 類型，且使用者註冊時間距今未滿 30 天，直接視為已開通。
3. **導師模式**
   - 若 `tutorMode === true`，且使用者在**目標單元**的 `users.tutorConfigs[unitId].authorized === true`，直接視為已開通。
   - `tutorMode` 只是切換到導師測試路徑，不代表全站或全課程自動開通。
   - 管理員可走獨立的模擬路徑，該路徑只用於後台測試，不應被視為正式授權來源。
4. **有效付款訂單**
   - `orders` 中必須存在該 `uid` 的 `SUCCESS` 訂單。
   - 訂單不能過期。
   - 訂單 item 必須能透過課程 metadata 的 `courseUnits` 對上目標單元。

若以上都不符合，後端回傳 `payment-required`。

---

## 3. 目前會影響開通的欄位

### 3.1 `metadata_lessons`

| 欄位 | 用途 |
| :--- | :--- |
| `id` / `docId` | canonical lesson id，前後端主要比對鍵 |
| `courseUnits` | 課程內可授權的單元清單 |
| `category` | 判斷 starter/basic/advanced/common 分類 |
| `level` | 例如 `starter`、`basic`、`advanced` |
| `metadataType` | `course` / `product`，用來區分課程與實體商品 |
| `hiddenFromCatalog` | 是否從 catalog 隱藏 |
| `isDeprecated` | 是否為歷史停用資料 |

### 3.2 `dealer_price_books`

| 欄位 | 用途 |
| :--- | :--- |
| `docId` | 對應的 lesson id |
| `distributorId` | 經銷商作用域 |
| `salePrice` | 正價 |
| `promoPrice` | 促銷價 |
| `promoEffectiveFrom` / `promoEffectiveTo` | 促銷期間 |
| `isActive` | 是否啟用 |

### 3.3 `orders`

| 欄位 | 用途 |
| :--- | :--- |
| `uid` | 訂單所屬使用者 |
| `status` | 必須是 `SUCCESS` |
| `expiryDate` | 必須未過期 |
| `items` | 必須可對到課程 metadata |
| `activationValidated` | 付款後是否完成開通驗證 |
| `activationValidationStatus` | `passed` / `failed` / `error` |
| `activationAlerts` | 開通失敗警示 |
| `activationCheckedItems` | 每個 item 的對照結果 |

### 3.4 `users`

| 欄位 | 用途 |
| :--- | :--- |
| `createdAt` / `joinedAt` | 用來判斷 starter 30 天體驗 |
| `paid` | 派生購買快取 |
| `hasStarterAccess` | 派生 starter 快取 |
| `lastPaidOrderId` | 最近一次成功訂單 |
| `unitAssignments` | 作業導師綁定 |
| `unitAssignmentMeta` | 作業導師綁定 metadata |

#### 導師資格判定

- `tutorMode` 本身不是授權來源，只是開啟導師測試路徑的參數。
- 合格導師必須在目標單元的 `users.tutorConfigs[unitId].authorized === true`。
- 系統不再以全域 tutor flag、`role: tutor` 或「只要有任何 tutorConfigs」來判斷導師資格。

---

## 4. 付款後自動開通會做什麼

`paymentNotify` 收到成功付款後，會立即執行：

1. 解析訂單項目，確認每個數位商品能映射到 canonical course。
2. 對每個課程檢查 `courseUnits` 與共用授權邏輯。
3. 寫入訂單的 `activationValidated` / `activationValidationStatus` / `activationCheckedItems`。
4. 更新使用者快取，例如 `paid`、`hasStarterAccess`、`lastPaidOrderId`。
5. 若有導師或推薦綁定，再同步寫入 `unitAssignments` 與 `unitAssignmentMeta`。

實體商品不需要 `courseUnits`，但仍會保留付款與履約資料。

---

## 5. 排查順序

如果課程卡片還是顯示「加入購物車」，建議按這個順序查：

1. `metadata_lessons` 的 `docId` 是否能對到前端送出的 `docId` / `pageId` / `fileName`。
2. `dealer_price_books` 是否有對應的 price book。
3. `orders` 是否存在 `SUCCESS` 且未過期的訂單。
4. 該訂單 item 是否真的能透過 `courseUnits` 對上目標單元。
5. 後端 logs 的 `checkPaymentAuthorization` 回傳 reason 是什麼。
6. 前端是否仍在吃舊的 static asset 或舊快取。

---

## 6. 相關文件

- [`docs/courses/course-management-runbook.md`](./course-management-runbook.md)
- [`docs/courses/course-ui-runtime-spec.md`](./course-ui-runtime-spec.md)
- [`docs/database.md`](../database.md)
- [`docs/database-permissions-index.md`](../database-permissions-index.md)
