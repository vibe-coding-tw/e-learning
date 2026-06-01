# Order Normalization Dependency Injection Plan
**Updated**: 2026-06-02

> 這份文件只描述 `functions/index.js` 中訂單 / referral normalization 邏輯的拆分計畫，不改任何對外契約。

## 1. Current State

目前 `normalizeOrderItems` 這條線仍在 `functions/index.js`，原因是它依賴多個 course / lesson / canonical lookup helper：

- `resolveLessonForOrderItem`
- `findLessonByCourseRef`
- `findParentCourseIdByUnit`
- `resolveCanonicalUnitId`
- `normalizeLookupValue`
- `cleanUnitId`
- `getLessonLookupKeys`

同時它還被以下流程共用：

- `initiatePayment`
- `activateOrderPermissionsAndNotify`
- `getDashboardData`
- `backfillTutorReferralForPaidOrders`
- `remindAdminPendingShipments`

## 2. 拆分目標

把訂單 normalization 拆成「純資料層」和「依賴注入層」：

- 純資料層搬進 `functions/lib/order-utils.js`
- lesson / canonical 解析仍由 `functions/index.js` 提供，但改成可注入 callback

## 3. 建議拆法

### 3.1 先抽純資料 helper
優先搬進 `functions/lib/order-utils.js` 的候選：

- `normalizeOrderItems`
- `extractReferralAssignmentsFromOrder`
- `collectPurchasedUnitIds`
- `findMatchingOrderItemIdForReferral`
- `itemContainsUnit`

### 3.2 改成依賴注入
在 `order-utils` 中讓上述 helper 接受一組 resolver：

- `resolveLessonForOrderItem`
- `resolveCanonicalUnitId`
- `findLessonByCourseRef`
- `findParentCourseIdByUnit`
- `normalizeLookupValue`
- `cleanUnitId`

### 3.3 逐步替換 call site
先替換最穩的三個入口：

- `normalizeOrderItems`
- `extractReferralAssignmentsFromOrder`
- `collectPurchasedUnitIds`

最後再處理：

- `findMatchingOrderItemIdForReferral`
- `itemContainsUnit`

## 4. Non-Goals

- 不改 Firestore schema
- 不改 referral 或 checkout 對外行為
- 不調整 `orders` 資料形狀
- 不動 `normalizeLogisticsData` / `buildShippingContact` / `buildShippingAddress` 這些已經搬到 `order-utils` 的穩定 helper

## 5. Exit Criteria

當以下條件都成立，就可視為完成：

- `functions/index.js` 不再定義上述五個 order normalization helper
- `functions/lib/order-utils.js` 成為唯一實作來源
- `node --check functions/index.js` 與 `node --check functions/lib/order-utils.js` 皆通過
- `docs/index-helper-inventory.md` 已更新

