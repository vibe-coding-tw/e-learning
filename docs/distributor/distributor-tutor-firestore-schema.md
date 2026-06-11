# Distributor Tutor Firestore Schema
**Version**: 2026.06.05.V1
**Purpose**: Define the Firestore shape required for distributor-owned hardware pricing, tutor-to-distributor binding, and service settlement.

## 1. Collection Overview

| Collection | Purpose | Canonical owner |
| :--- | :--- | :--- |
| `distributors` | Distributor profile, regions, status, pricing mode | Platform/Admin |
| `tutors` | Tutor profile and distributor binding | Platform/Admin |
| `products` | Product master, MSRP, suggested price band | Platform/Admin |
| `region_distributor_rules` | Region-to-distributor routing defaults and ranking | Platform/Admin |
| `dealer_price_books` | Distributor-specific sale and promo prices | Distributor |
| `orders` | Customer checkout, frozen pricing, settlement references | Platform/Admin |
| `revenue_share_policies` | Service split rules and frozen snapshots | Platform/Admin |
| `settlement_ledger` | Monthly payout lines and audit snapshot | Platform/Admin |

## 2. Document Schemas

### 2.1 `distributors/{distributorId}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | yes | Display name |
| `status` | string | yes | `ACTIVE`, `PAUSED`, `INACTIVE` |
| `regions` | array<string> | yes | Supported regions |
| `defaultCurrency` | string | yes | Currency code |
| `pricePolicyMode` | string | yes | `FREE`, `GUIDED`, `ADMIN_ONLY` |
| `settlementMethod` | string | no | Settlement method identifier |
| `createdAt` | timestamp | yes | Creation time |
| `updatedAt` | timestamp | yes | Update time |

### 2.2 `tutors/{tutorId}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | yes | Display name |
| `status` | string | yes | `ACTIVE`, `PAUSED`, `INACTIVE` |
| `distributorId` | string | yes | Owning distributor |
| `promotionCode` | string | yes | Tutor binding code |
| `serviceSplitRuleId` | string | no | Internal split rule |
| `createdAt` | timestamp | yes | Creation time |
| `updatedAt` | timestamp | yes | Update time |

### 2.3 `products/{productId}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `sku` | string | yes | SKU |
| `name` | string | yes | Product name |
| `isHardware` | boolean | yes | Hardware flag |
| `msrp` | number | no | Suggested retail price |
| `suggestedPriceMin` | number | no | Suggested price floor |
| `suggestedPriceMax` | number | no | Suggested price ceiling |
| `currency` | string | yes | Currency code |
| `active` | boolean | yes | Active flag |

### 2.4 `dealer_price_books/{priceBookId}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `distributorId` | string | yes | Owner distributor |
| `productId` | string | yes | Product reference |
| `currency` | string | yes | Currency code |
| `salePrice` | number | yes | Live sale price |
| `promoPrice` | number | no | Campaign price |
| `effectiveFrom` | timestamp | yes | Start time |
| `effectiveTo` | timestamp | no | End time |
| `isActive` | boolean | yes | Active flag |
| `version` | string | yes | Price book version |
| `updatedBy` | string | yes | Editor UID |
| `updatedAt` | timestamp | yes | Last update time |

### 2.5 `region_distributor_rules/{region}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `region` | string | yes | Region code |
| `defaultDistributorId` | string | yes | Preferred distributor for the region |
| `backupDistributorIds` | array<string> | no | Ordered fallback distributors |
| `rankingMode` | string | yes | `default_only`, `priority_list`, `availability_weighted` |
| `manualOverrideEnabled` | boolean | yes | Whether manual selection is allowed |
| `active` | boolean | yes | Active flag |
| `updatedAt` | timestamp | yes | Last update time |

### 2.6 `orders/{orderId}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `region` | string | yes | Customer region |
| `contentLocale` | string | no | UI / course locale used in checkout |
| `distributorId` | string | yes | Final distributor owner |
| `tutorId` | string | no | Bound tutor |
| `priceBookId` | string | yes | Frozen price book |
| `currency` | string | yes | Frozen checkout currency |
| `pricingVersion` | string | yes | Frozen pricing version |
| `amount` | number | yes | Compatibility total amount; equals `totalAmount` |
| `subtotalAmount` | number | yes | Product subtotal before shipping / tax |
| `taxAmount` | number | yes | Tax snapshot captured at checkout |
| `shippingAmount` | number | yes | Shipping snapshot captured at checkout |
| `totalAmount` | number | yes | Final payable total |
| `taxIncluded` | boolean | yes | Consumer-facing price is tax-inclusive |
| `shippingIncluded` | boolean | yes | Consumer-facing price is shipping-inclusive |
| `gateway` | string | yes | Compatibility payment gateway field |
| `paymentGateway` | string | yes | Payment provider used for collection |
| `logisticsProvider` | string | no | Shipping / fulfillment integration used for the order |
| `fulfillmentOwnerType` | string | yes | Usually `distributor` |
| `fulfillmentOwnerId` | string | yes | Distributor or partner responsible for fulfillment |
| `channelType` | string | yes | `direct`, `tutor_referral`, `distributor_storefront`, etc. |
| `orderType` | string | yes | `hardware`, `service`, `bundle` |
| `salePrice` | number | yes | Final hardware charge |
| `serviceAmount` | number | no | Final service charge |
| `settlementPolicyId` | string | no | Policy reference |
| `status` | string | yes | Order status |
| `createdAt` | timestamp | yes | Creation time |
| `updatedAt` | timestamp | yes | Update time |

### 2.7 `revenue_share_policies/{policyId}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `scope` | string | yes | `service`, `course`, `onboarding`, `maintenance` |
| `distributorRate` | number | yes | Distributor share |
| `tutorRate` | number | yes | Tutor share |
| `platformRate` | number | yes | Platform share |
| `active` | boolean | yes | Enabled flag |
| `snapshotVersion` | string | yes | Frozen version |
| `createdAt` | timestamp | yes | Creation time |
| `updatedAt` | timestamp | yes | Update time |

### 2.8 `users/{uid}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `preferredRegion` | string | no | Preferred routing region |
| `preferredDistributorId` | string | no | Preferred distributor |
| `bindingSource` | string | no | `explicit`, `tutor`, `promotionCode`, `regionDefault`, `manual` |
| `bindingConfidence` | number | no | Internal routing score |
| `bindingUpdatedAt` | timestamp | no | Last preference update time |
| `locale` | string | no | UI locale |
| `region` | string | no | Current user region |

### 2.9 `settlement_ledger/{ledgerId}`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `period` | string | yes | Settlement period |
| `sourceType` | string | yes | `hardware`, `service`, `adjustment` |
| `sourceId` | string | yes | Order or adjustment source |
| `beneficiaryType` | string | yes | `distributor`, `tutor`, `platform` |
| `beneficiaryId` | string | yes | Target owner |
| `amount` | number | yes | Settlement amount |
| `policyId` | string | no | Applied policy |
| `policySnapshot` | map | no | Frozen policy data |
| `status` | string | yes | `PENDING`, `CONFIRMED`, `PAID` |
| `createdAt` | timestamp | yes | Creation time |

## 3. Query Patterns

### 3.1 Price book lookup

Common query:

- `dealer_price_books where distributorId == X and productId == Y and isActive == true`

### 3.2 Distributor lookup

Common query:

- `tutors where promotionCode == X`
- then resolve `distributorId`
- `region_distributor_rules where region == X`
- then resolve default or fallback distributor

### 3.3 Settlement lookup

Common query:

- `orders where pricingVersion == X and distributorId == Y`
- `settlement_ledger where period == YYY-MM`

## 4. Index Guidance

Recommended composite indexes:

1. `dealer_price_books(distributorId, productId, isActive, effectiveFrom)`
2. `orders(distributorId, status, createdAt)`
3. `orders(tutorId, status, createdAt)`
4. `settlement_ledger(period, beneficiaryType, beneficiaryId)`

## 5. Validation Rules

1. `salePrice >= 0`
2. `promoPrice <= salePrice` when present
3. `orders.distributorId` must be set before payment confirmation
4. `orders.priceBookId` and `orders.pricingVersion` must be frozen at checkout
5. `orders.taxIncluded` and `orders.shippingIncluded` should be true for consumer-facing cart totals
6. `orders.paymentGateway` and `orders.logisticsProvider` are separate dimensions; a provider may support one or both capabilities
7. `tutors.distributorId` must exist and reference an active distributor
8. `settlement_ledger.policySnapshot` must match the policy used for calculation

## 6. Migration Notes

1. Backfill new fields into existing orders before enabling distributor-specific pricing.
2. Do not infer distributor ownership from region alone.
3. Keep platform suggested prices in `products` only; do not overwrite distributor price books with them.
4. Existing users should have `preferredRegion` and `preferredDistributorId` backfilled from their current `region` and routing rules before enabling sticky routing UX.
5. Treat `priceByLocale` and `priceByRegion` as compatibility aliases only; do not use UI language as a live price selector.
