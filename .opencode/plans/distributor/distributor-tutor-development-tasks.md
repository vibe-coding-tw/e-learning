# Distributor Tutor Development Tasks
**Version**: 2026.06.05.V1
**Purpose**: Break the distributor, tutor, and pricing model into implementation tasks that can be assigned directly to engineering.

## 1. Task Groups

### 1.1 Data model tasks

1. Add `distributors` collection
2. Add `tutors.distributorId`
3. Add `dealer_price_books` collection
4. Add `orders.distributorId`
5. Add `orders.priceBookId`
6. Add `orders.pricingVersion`
7. Add `users.preferredRegion` and `users.preferredDistributorId`
8. Add `region_distributor_rules`
9. Add `revenue_share_policies` snapshots for service settlement
10. Add `settlement_ledger`

### 1.2 Backend tasks

1. Implement distributor resolution helper
2. Implement distributor price book CRUD
3. Implement checkout quote endpoint
4. Freeze pricing version at payment time
5. Implement settlement runner with snapshots
6. Add audit logging for price changes
7. Persist user distributor preference after successful binding
8. Keep language selection independent from currency resolution

### 1.3 Frontend tasks

1. Add distributor storefront price editor
2. Add same-region distributor selector
3. Add tutor dashboard distributor binding panel
4. Add checkout quote preview
5. Add settlement summary UI
6. Add admin audit log view
7. Separate language selector from currency display in catalog and cart

### 1.4 Policy tasks

1. Define allowed price types
2. Define same-region multi-distributor behavior
3. Define tutor service split policy
4. Define hardware exclusion from tutor gross margin
5. Define price change audit policy
6. Define region routing defaults and fallback distributor ranking

## 2. Priority Order

### Phase 1

1. Build price book model
2. Add distributor resolution
3. Freeze checkout quote
4. Store order-level pricing version
5. Add region distributor rules and user preference persistence

### Phase 2

1. Build distributor storefront editor
2. Build tutor binding UI
3. Add monthly settlement snapshot
4. Add admin audit log

### Phase 3

1. Add same-region distributor comparison
2. Add promo campaign windows
3. Add settlement analytics
4. Add distributor-internal tutor split preview

## 3. Acceptance Criteria

### 3.1 Price control

- A distributor can edit its own `salePrice`
- A distributor cannot edit another distributor's `salePrice`
- Platform can view all price books but does not overwrite them with a global fixed price

### 3.2 Tutor settlement

- Tutor service revenue is split through the owning distributor
- Hardware gross margin is not auto-shared to tutors
- Tutor binding is visible in dashboard and audit trail

### 3.3 Same-region pricing

- Two distributors in the same region can have different active prices
- Checkout displays the selected distributor price only
- Changing distributor causes a re-quote

### 3.4 Language and currency decoupling

- Changing course language does not change distributor binding
- Changing course language does not change currency
- Checkout currency is taken from the frozen price book
- Mixed-language carts are allowed if the quote currency remains the same

## 4. QA Checklist

1. Create two distributors in the same region with different prices.
2. Confirm checkout selects one distributor and freezes `priceBookId`.
3. Confirm tutor dashboard cannot change price book data.
4. Confirm settlement uses snapshot policy, not live policy.
5. Confirm admin can review all price changes in the audit log.

## 5. Region and Routing Task Plan

### 5.1 This week

1. Auto-prefill `region` on first visit using saved preference, last successful checkout, shipping country, then locale fallback.
2. Recommend the distributor from `region_distributor_rules`.
3. Freeze `region`, `distributorId`, and `priceBookId` at checkout.
4. Recalculate quote immediately when `region` changes.
5. Keep consumer prices displayed as tax-inclusive and shipping-inclusive totals.
6. Keep `paymentGateway` and `logisticsProvider` separate in order records.

### 5.2 Next week

1. Backfill `preferredRegion`.
2. Backfill `preferredDistributorId`.
3. Show the reason for the selected region or distributor.
4. Persist `last_success_region` after successful payment.
5. Allow manual override of the region preference from account or cart UI.

### 5.3 Later

1. Add more regions and routing rules.
2. Add region and distributor reporting.
3. Add same-region price dispersion analysis.
4. Add weighted recommendation rules for history, shipping country, tutor binding, and inventory.

## 6. Acceptance Criteria by Task

### 6.1 Auto region default

- A first-time user sees a prefilled region without manually entering one.
- The UI can explain why the region was chosen.
- Manual region selection overrides the automatic value.

### 6.2 Distributor recommendation

- A region resolves to one recommended distributor.
- If multiple distributors are eligible, the UI surfaces a manual choice.
- The recommendation uses `region_distributor_rules` first, then distributor region support.

### 6.3 Checkout freeze

- One checkout stores one `region`.
- One checkout stores one `distributorId`.
- One checkout stores one `priceBookId`.
- The quote and payment payload must match the frozen values.

### 6.4 Price display

- The cart shows a single all-in total by default.
- The cart may expose subtotal, tax, and shipping only as supporting detail.
- The user should not need to mentally add shipping to understand the payable total.

### 6.5 Payment and logistics separation

- Payment provider and logistics provider are separate fields.
- ECPay can be used as payment only, logistics only, or both.
- Fulfillment ownership remains with the distributor even when ECPay is used.

## 7. 2026-07-14 現況與待決事項

這節記錄一次平台文件一致性審查（比對 `docs/distributor/` 底下的規格文件跟實際程式碼）後
新增/確認的實作，以及審查中發現、需要有人拍板才能繼續的事項。詳細變更理由見對應的
git commit message（`feat(distributor): extend fulfillment status to 8 stages + add REST
API layer matching api-contract.md`）。

### 7.1 已完成

- **履約狀態擴充**：`orders.fulfillmentStatus` 從 4 個值擴充成完整 8 階段
  （`PENDING`/`ASSIGNED`/`ACCEPTED`/`PACKING`/`SHIPPED`/`DELIVERED`/`EXCEPTION`/
  `CANCELLED`，對齊 `distributor-fulfillment-operations.md` §7），`paymentUpdateOrderFulfillmentStatus`
  加上白名單驗證，`distributor-portal.html` 的下拉選單/待出貨統計/狀態徽章同步更新。
- **REST API 層**：`distributor-tutor-api-contract.md` 描述的 5 個端點（price-books
  GET/POST、checkout/distributor-resolution、checkout/distributor-recommendation、
  users/me/distributor-preference、checkout/quote）已經是真的可以打的 REST 路徑
  （`functions-admin/index.js` 的 `distributorApi`），內部委派給既有 callable 的同一份
  邏輯，callable 呼叫端沒有變動。

### 7.2 待決事項（需要有人先做決定，不是純工程任務）

- **`POST /api/admin/settlements/run` 要不要接上**：對應的 `calculateMonthlySharing()`
  （`functions-payment/lib/finance-callables.js`）目前完全沒被任何 trigger 呼叫，是死碼，
  而且會實際觸發經銷商佣金撥款。需要負責財務/結算流程的人確認這段邏輯現在能不能用、
  要不要排程或做成 admin-only 手動觸發，才適合接上 REST 或 callable 入口。
- **`GET /api/admin/tutors/:tutorId` 要不要真的做**：目前整個 codebase 沒有任何地方讀寫
  `serviceSplitRuleId`，代表文件描述的「查 tutor profile + distributor binding」這個查詢
  從來沒被實作過。如果確定要做，這是一個新功能（要決定 response 形狀、要不要曝光
  `serviceSplitRuleId`），不是照現有邏輯包一層 REST 就能生出來的東西。

### 7.3 已知範圍界線（不是漏做，是刻意先不做）

- 這次只是幫**既有的** `orders.fulfillmentStatus` 單一欄位擴充列舉值。
  `distributor-fulfillment-operations.md` 描述的完整任務派單架構
  （`fulfillment_tasks`/`fulfillment_partners`/`fulfillment_events`/
  `fulfillment_settlements` 四個獨立 collection、經銷商後台、自動派單規則、
  結算對帳報表）完全沒有動，還是「尚待補齊」。
- REST API 層只做過語法檢查（`node --check`）跟路由比對邏輯的獨立單元驗證，還沒有在
  `firebase emulators:start` 或實際部署環境跑過一次真實 HTTP 請求。部署後、正式依賴
  這層 REST API 之前，建議先手動測一輪。

### 7.4 文件本身的殘留問題（次要，不影響功能）

- `docs/distributor/distributor-tutor-ui-permissions.md` 還在描述「Admin Console /
  Distributor Storefront / Tutor Dashboard」三個獨立頁面的概念模型，但實際是同一個
  `distributor-portal.html` 用 tab + 角色隱藏做出來的單頁應用，概念層級對不上，需要
  之後重寫這份文件的架構描述。
- `.opencode/plans/courses/curriculum-migration-plan.md` 跟 `docs/courses/curriculum-migration-plan.md`
  有一行連結路徑分岔（`.opencode/plans/courses/` 底下那批 2026-07-04 的快照檔案已經開始
  跟 `docs/` 走鐘）。這批快照（`.opencode/plans/docs/`、`.opencode/plans/courses/` 底下
  共 12 組同名檔案，11 組目前逐位元組相同）建議之後直接砍掉或改成 symlink，不然還會
  繼續分岔。
