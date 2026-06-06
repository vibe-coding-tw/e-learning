# Distributor, Tutor, and Pricing Engineering Spec
**Version**: 2026.06.05.V1
**Objective**: Define a single-platform, multi-distributor commerce model where hardware is sold and priced by distributors, tutors are linked to one distributor for service revenue sharing, same-region multi-distributor pricing can be maintained without forcing a single resale price, and region-based distributor binding stays decoupled from language and currency selection.

See also: [Region, Distributor, Language, and Currency Binding Spec](./region-distributor-binding-spec.md)

## 1. Scope

This spec covers:

1. Distributor-owned hardware pricing
2. Tutor-to-distributor commercial binding
3. Service-based revenue sharing
4. Same-region multiple distributor pricing
5. Backend data model and API contracts
6. Admin and distributor permissions
7. Region-to-distributor binding and locale/currency decoupling

## 2. Commercial Model

### 2.1 Roles

| Role | Main responsibility | Final hardware price authority | Inventory authority | Settlement ownership |
| :--- | :--- | :--- | :--- | :--- |
| Platform/Admin | Product master, policy engine, audit, settlement orchestration | Suggested only | No | System-level control |
| Distributor | Buys hardware, holds inventory, ships goods, runs local business, sets live storefront price | Yes | Yes | Hardware sale + local ops + service split recipient |
| Tutor | Teaches, onboards, enables, and supports learners | No | No | Service split via owning distributor |
| Customer | Buys hardware or services | No | No | N/A |

### 2.2 Required rules

1. Hardware is bought out by the distributor.
2. Tutor compensation is not derived from hardware gross margin.
3. Tutor revenue is service revenue, not resale margin.
4. The platform may display MSRP or suggested pricing, but cannot force downstream resale price.
5. The same region may contain multiple distributors with different final prices.

## 3. Pricing Model

### 3.1 Price types

| Field | Purpose | Editable by | Notes |
| :--- | :--- | :--- | :--- |
| `msrp` | Suggested retail price | Platform/Admin | Informational only |
| `suggested_price_min` | Suggested price floor | Platform/Admin | Informational only |
| `suggested_price_max` | Suggested price ceiling | Platform/Admin | Informational only |
| `sale_price` | Distributor live sale price | Distributor | Used for checkout |
| `promo_price` | Temporary campaign price | Distributor | Used only while campaign is active |
| `service_price` | Training / onboarding / enablement fee | Platform/Admin or Distributor | Used for service settlement |

### 3.2 Same-region rule

1. `region` is a routing and reporting attribute, not a pricing owner.
2. Final hardware price is owned by `distributorId`, not by `region`.
3. Multiple distributors in the same region may have different active prices.
4. Checkout must freeze the selected distributor and its price book before payment.
5. Displayed consumer prices should be tax-inclusive and shipping-inclusive by default; subtotal, tax, and shipping still need to be stored separately for settlement and audit.

### 3.3 Price resolution order

1. Distributor active promo price
2. Distributor active sale price
3. Distributor default sale price
4. Platform suggested price as display fallback only

### 3.4 Region, language, and currency separation

1. `region` only routes the customer to the most suitable distributor.
2. Course language only controls content and UI text.
3. Currency comes from the active distributor price book, not the selected language.
4. Checkout must freeze `distributorId`, `priceBookId`, `currency`, and `pricingVersion` together.
5. Mixed-distributor or mixed-currency carts must be split before payment.
6. `paymentGateway` and `logisticsProvider` are independent capabilities; a provider such as ECPay may appear in one or both roles, but business ownership still belongs to `distributorId`.
7. Price resolution helpers must not use UI locale as a price selector; locale may only affect formatting and translated copy.

## 4. Data Model

### 4.1 `distributors`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Distributor ID |
| `name` | string | Display name |
| `status` | string | `ACTIVE`, `PAUSED`, `INACTIVE` |
| `regions` | array<string> | Supported regions |
| `defaultCurrency` | string | Currency code |
| `pricePolicyMode` | string | `FREE`, `GUIDED`, `ADMIN_ONLY` |
| `settlementMethod` | string | Settlement method identifier |

### 4.2 `tutors`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Tutor ID |
| `name` | string | Display name |
| `status` | string | `ACTIVE`, `PAUSED`, `INACTIVE` |
| `distributorId` | string | Owning distributor |
| `promotionCode` | string | Binding code used by customers |
| `serviceSplitRuleId` | string | Internal split rule identifier |

### 4.3 `products`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Product ID |
| `sku` | string | SKU |
| `name` | string | Product name |
| `isHardware` | boolean | Hardware flag |
| `msrp` | number | Suggested retail price |
| `suggestedPriceMin` | number | Suggested price floor |
| `suggestedPriceMax` | number | Suggested price ceiling |

### 4.4 `dealer_price_books`

One active price book per distributor per SKU is the default operating model.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Price book document ID |
| `distributorId` | string | Owning distributor |
| `productId` | string | Product or SKU |
| `currency` | string | Currency code |
| `salePrice` | number | Current sale price |
| `promoPrice` | number | Active promo price |
| `effectiveFrom` | timestamp | Start time |
| `effectiveTo` | timestamp | End time |
| `isActive` | boolean | Active flag |
| `updatedBy` | string | Last editor |
| `updatedAt` | timestamp | Last update time |

### 4.5 `orders`

| Field | Type | Description |
| :--- | :--- | :--- |
| `region` | string | Customer region for routing and reporting |
| `contentLocale` | string | UI / course locale used for the order |
| `distributorId` | string | Final distributor owner of the order |
| `tutorId` | string | Bound tutor, if any |
| `priceBookId` | string | Price book used during checkout |
| `currency` | string | Frozen checkout currency |
| `pricingVersion` | string | Frozen pricing version |
| `subtotalAmount` | number | Product subtotal before shipping / tax |
| `taxAmount` | number | Tax snapshot captured at checkout |
| `shippingAmount` | number | Shipping snapshot captured at checkout |
| `totalAmount` | number | Final payable total |
| `taxIncluded` | boolean | Whether consumer-facing price is tax-inclusive |
| `shippingIncluded` | boolean | Whether consumer-facing price is shipping-inclusive |
| `paymentGateway` | string | Payment provider used for collection |
| `logisticsProvider` | string | Shipping / fulfillment integration used for the order |
| `fulfillmentOwnerType` | string | Business owner of fulfillment, typically `distributor` |
| `fulfillmentOwnerId` | string | Distributor or partner responsible for fulfillment |
| `channelType` | string | `direct`, `tutor_referral`, `distributor_storefront`, etc. |
| `orderType` | string | `hardware`, `service`, `bundle` |
| `salePrice` | number | Final hardware charge |
| `serviceAmount` | number | Final service charge |
| `settlementPolicyId` | string | Applied settlement policy |

### 4.6 `revenue_share_policies`

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | string | Policy ID |
| `scope` | string | `service`, `course`, `onboarding`, `maintenance` |
| `distributorRate` | number | Distributor share |
| `tutorRate` | number | Tutor share |
| `platformRate` | number | Platform share |
| `active` | boolean | Enabled flag |
| `snapshotVersion` | string | Frozen version used in settlement |

### 4.7 `users`

The checkout and onboarding flow may persist the following user-preference fields:

| Field | Type | Description |
| :--- | :--- | :--- |
| `preferredRegion` | string | Default routing region |
| `preferredDistributorId` | string | Last successful or manually chosen distributor |
| `bindingSource` | string | `explicit`, `tutor`, `promotionCode`, `regionDefault`, `manual` |
| `bindingConfidence` | number | Internal confidence score for routing |
| `bindingUpdatedAt` | timestamp | Last binding update time |

## 5. Settlement Rules

### 5.1 Hardware

1. Hardware sales belong to the distributor.
2. Hardware gross margin is not automatically shared with the tutor.
3. Any special tutor bonus must be stored as a separate service or bonus line.

### 5.2 Service

Service items include:

- training fee
- onboarding fee
- enablement fee
- maintenance fee
- performance bonus

Suggested settlement flow:

1. Platform collects payment.
2. Order is classified as `service` or `bundle`.
3. Settlement engine loads `revenue_share_policies`.
4. Service revenue is split to the distributor first.
5. Distributor performs its internal tutor settlement.

### 5.3 Tutor binding

1. Each tutor belongs to one distributor in the commercial model.
2. Tutor revenue from course learning is attributed to the owning distributor first.
3. Distributor-internal tutor split is separate from platform settlement.

## 6. API Spec

### 6.1 Distributor price books

`GET /api/admin/distributors/:distributorId/price-books`

Returns all active and inactive price books for one distributor.

`POST /api/admin/distributors/:distributorId/price-books`

Creates or updates a distributor price book entry.

Validation:

1. `salePrice` must be numeric and non-negative.
2. `promoPrice`, if present, must be less than or equal to `salePrice`.
3. Updated records must be versioned and audited.

### 6.2 Distributor resolution

`GET /api/checkout/distributor-resolution`

Resolves the distributor before checkout.

Request query:

- `region`
- `tutorId`
- `promotionCode`
- `productId`
- `customerId`

Resolution order:

1. promotion code -> tutor -> distributor
2. customer geo -> distributor
3. manual distributor selection

`GET /api/checkout/distributor-recommendation`

Returns the preferred distributor for the current user and region before checkout.

Request query:

- `region`
- `locale`
- `customerId`
- `productId`

`PATCH /api/users/me/distributor-preference`

Persists the user's chosen region and distributor after onboarding or checkout.

Request:

```json
{
  "preferredRegion": "TW",
  "preferredDistributorId": "dist-001"
}
```

### 6.3 Settlement

`POST /api/admin/settlements/run`

Runs monthly settlement for hardware and service items.

Outputs:

- hardware settlement lines
- service settlement lines
- tutor payout lines
- adjustment lines

## 7. Backend Jobs

### 7.1 `resolveOrderDistributor`

Purpose:

- Decide which distributor owns a checkout before payment is finalized.

Inputs:

- region
- tutor binding
- promotion code
- customer address

Outputs:

- distributorId
- priceBookId
- routing reason

### 7.2 `calculateMonthlySharing`

Purpose:

- Calculate service revenue share using frozen policy snapshots.

Must:

1. Read `orders.settlementPolicyId`
2. Load the policy snapshot
3. Produce ledger entries per beneficiary
4. Persist the snapshot used for the calculation

### 7.3 `syncDistributorPriceBooks`

Purpose:

- Publish active distributor price books to frontend caches.

Rules:

1. Never overwrite distributor price with platform suggested price.
2. Only sync active records.
3. Preserve previous published versions for auditability.

## 8. Frontend Pages

### 8.1 Distributor storefront

Required UI elements:

- distributor name
- region badge
- active price
- promo price
- availability status
- shipping / fulfillment owner

### 8.2 Admin console

Required tabs:

- Distributors
- Tutors
- Price Books
- Settlement
- Audit Log

### 8.3 Tutor dashboard

Required modules:

- bound distributor
- linked students
- service revenue summary
- promotion code
- internal split preview

### 8.4 Checkout

Required behavior:

1. Resolve distributor before final price is shown.
2. Show the distributor-specific price, not a global shared price.
3. If the customer switches distributor, refresh price and settlement preview.

## 9. Permission Matrix

| Action | Platform/Admin | Distributor | Tutor | Customer |
| :--- | :--- | :--- | :--- | :--- |
| View MSRP | Yes | Yes | Yes | Yes |
| Edit MSRP | Yes | No | No | No |
| Edit distributor sale price | No | Yes | No | No |
| Edit promo price | No | Yes | No | No |
| Create price book | Yes | Yes, within own scope | No | No |
| Bind tutor to distributor | Yes | Yes, if allowed | No | No |
| View service settlement | Yes | Yes, scoped | Yes, own scope only | No |
| View hardware settlement | Yes | Yes, scoped | No | No |
| Change tutor split rule | Yes | Yes, own internal rule only | No | No |
| Force downstream resale price | No | No | No | No |

## 10. Same-Region Multiple Distributor Rules

When more than one distributor exists in one region:

1. The region does not own the final price.
2. Each distributor owns its own price book.
3. A customer session must be tied to exactly one distributor at checkout time.
4. If the customer enters via a tutor link, the tutor's distributor wins.
5. If the customer enters via a distributor storefront, that distributor wins.
6. If the customer enters via a neutral landing page, the system may auto-pick by geography, show a distributor list, or ask the customer to select one.

Recommended UI policy:

- If selection is ambiguous, show distributor choices.
- If a distributor is selected, freeze the distributor and price book for the checkout session.
- If the user changes distributor, re-price the cart before payment submission.

## 11. Validation Rules

1. `salePrice` must come from an active distributor price book.
2. `serviceAmount` must come from a service settlement rule.
3. `order.distributorId` must be immutable after payment unless an admin performs a controlled correction.
4. `order.pricingVersion` must be persisted at checkout.
5. Tutor revenue cannot be derived from hardware gross margin unless the policy explicitly defines a separate bonus line.
6. Price changes must be logged with before/after values and editor identity.

## 12. Rollout Plan

### Phase 1

1. Add distributor-owned price book model.
2. Add order-level `distributorId` and `priceBookId`.
3. Add distributor-resolution logic at checkout.
4. Keep platform suggested pricing visible but non-binding.

### Phase 2

1. Add distributor storefront editor.
2. Add same-region distributor selection UI.
3. Add monthly service settlement snapshots.
4. Add audit log and price change history.

### Phase 3

1. Add distributor-internal tutor settlement preview.
2. Add promo pricing and campaign windows.
3. Add reporting for same-region price dispersion.

## 13. Related Specs

- [Platform Expansion Plan](./platform-expansion-plan.md)
- [Tutor Management MVP](./tutor-management-mvp.md)
- [Distributor Fulfillment Model](./distributor-fulfillment-model.md)
- [Distributor Fulfillment Operations](./distributor-fulfillment-operations.md)

## 14. Companion Engineering Artifacts

The following companion docs break this spec into implementation-ready slices:

1. [Firestore Schema](./distributor-tutor-firestore-schema.md)
2. [API Contract](./distributor-tutor-api-contract.md)
3. [Frontend Permissions Matrix](./distributor-tutor-ui-permissions.md)
4. [Development Task Breakdown](./distributor-tutor-development-tasks.md)
