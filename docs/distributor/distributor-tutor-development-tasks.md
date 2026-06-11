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
