# Order Normalization Dependency Injection Plan
**Updated**: 2026-06-24

> 這份文件只描述 `functions/index.js` 中訂單 / referral normalization 邏輯的拆分計畫，不改任何對外契約。

## 1. Current State

目前 `normalizeOrderItems` 這條線已移到 `functions/lib/order-utils.js`，但它仍依賴由 `functions/index.js` 提供的 course / lesson / canonical lookup helper：

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
已搬進 `functions/lib/order-utils.js` 的候選：

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

## 3.4 ⚠️ 已知陷阱

1. **`getLessonLookupKeys` 必須 export**：此函式定義於 `shared-function-core/dashboard-utils-core.js`，但曾未加入 `module.exports`，導致所有從 `.tgz` 引用它的模組（`content-runtime.js`、`dashboard-utils.js`）在執行時崩潰。新增任何輔助函式時須一併檢查 exports。

2. **`resolveLessonForOrderItem` 必須在 resolvers 頂層**：`itemContainsUnit` 從 `resolvers.resolveLessonForOrderItem` 讀取 resolver，若只放在巢狀的 `resolvers.itemContainsUnit` 內部則不被使用（等於永遠取不到 lesson）。

3. **`.tgz` 快取問題**：Cloud Build 在部署時會快取 `node_modules`，即使覆蓋 `.tgz` 檔案，若 `package-lock.json` 的 integrity hash 未更新，仍使用舊版套件。更新共用函式庫後須確認 lockfile 重新產生。

## 4. Non-Goals

- 不改 Firestore schema
- 不改 referral 或 checkout 對外行為
- 不調整 `orders` 資料形狀
- 不動 `normalizeLogisticsData` / `buildShippingContact` / `buildShippingAddress` 這些已經搬到 `order-utils` 的穩定 helper

## 5. Exit Criteria

當以下條件都成立，就可視為完成：

- `functions/index.js` 不再定義上述五個 order normalization helper
- `functions/lib/order-utils.js` 成為唯一實作來源
- `functions/index.js` 只提供 resolver / dependency injection
- `node --check functions/index.js` 與 `node --check functions/lib/order-utils.js` 皆通過
- `docs/index-helper-inventory.md` 已更新
