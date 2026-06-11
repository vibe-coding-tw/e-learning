# Distributor Tutor API Contract
**Version**: 2026.06.05.V1
**Purpose**: Define the backend interfaces needed for distributor-owned pricing, tutor binding, and settlement.

## 1. Authentication

All endpoints are assumed to require authenticated requests.

| Caller | Auth scope |
| :--- | :--- |
| Platform/Admin | Full management scope |
| Distributor | Own distributor scope only |
| Tutor | Own tutor scope only |
| Customer | Checkout or read-only public scope |

## 2. Endpoints

### 2.1 Price book management

#### `GET /api/admin/distributors/:distributorId/price-books`

Returns price books for one distributor.

Response:

```json
{
  "distributorId": "dist-001",
  "items": [
    {
      "id": "pb-001",
      "productId": "prod-001",
      "salePrice": 12900,
      "promoPrice": 11900,
      "currency": "TWD",
      "effectiveFrom": "2026-06-01T00:00:00.000Z",
      "effectiveTo": null,
      "isActive": true,
      "version": "v3"
    }
  ]
}
```

#### `POST /api/admin/distributors/:distributorId/price-books`

Creates or updates a price book.

Request:

```json
{
  "productId": "prod-001",
  "salePrice": 12900,
  "promoPrice": 11900,
  "currency": "TWD",
  "effectiveFrom": "2026-06-01T00:00:00.000Z",
  "effectiveTo": null,
  "isActive": true
}
```

Validation:

1. `salePrice` must be non-negative.
2. `promoPrice`, if present, must be less than or equal to `salePrice`.
3. The caller must own the distributor scope.
4. The update must create an audit log entry.

### 2.2 Distributor resolution

#### `GET /api/checkout/distributor-resolution`

Resolves the distributor before checkout finalization.

Query:

- `region`
- `tutorId`
- `promotionCode`
- `productId`
- `customerId`

Response:

```json
{
  "distributorId": "dist-001",
  "priceBookId": "pb-001",
  "routingReason": "promotionCode->tutor->distributor"
}
```

Resolution priority:

1. Promotion code
2. Tutor binding
3. Geographic fallback
4. Manual selection

#### `GET /api/checkout/distributor-recommendation`

Returns the preferred distributor for the current user and region before checkout.

Query:

- `region`
- `locale`
- `customerId`
- `productId`

Response:

```json
{
  "region": "TW",
  "distributorId": "dist-001",
  "distributorName": "Taipei Distributor",
  "reason": "region-default",
  "preferred": true
}
```

#### `PATCH /api/users/me/distributor-preference`

Persists the user's chosen routing preference after onboarding or checkout.

Request:

```json
{
  "preferredRegion": "TW",
  "preferredDistributorId": "dist-001"
}
```

Validation:

1. `preferredRegion` must be a supported region or empty.
2. `preferredDistributorId` must belong to the selected region when both are provided.
3. The caller can only update their own profile.

### 2.3 Checkout pricing

#### `POST /api/checkout/quote`

Returns frozen pricing before payment.

Request:

```json
{
  "customerId": "user-001",
  "productId": "prod-001",
  "region": "TW",
  "tutorId": "tutor-001",
  "locale": "zh-TW"
}
```

Response:

```json
{
  "distributorId": "dist-001",
  "priceBookId": "pb-001",
  "salePrice": 12900,
  "currency": "TWD",
  "serviceAmount": 3000,
  "pricingVersion": "v3",
  "expiresAt": "2026-06-05T12:30:00.000Z"
}
```

### 2.4 Settlement

#### `POST /api/admin/settlements/run`

Runs monthly settlement.

Request:

```json
{
  "period": "2026-06"
}
```

Response:

```json
{
  "period": "2026-06",
  "ledgerCount": 120,
  "status": "OK"
}
```

### 2.5 Tutor binding lookup

#### `GET /api/admin/tutors/:tutorId`

Returns tutor profile and distributor binding.

Response fields:

- `id`
- `name`
- `status`
- `distributorId`
- `promotionCode`
- `serviceSplitRuleId`

## 3. Error Codes

| Code | Meaning | Typical cause |
| :--- | :--- | :--- |
| `400` | Invalid request | Missing field, bad price |
| `401` | Unauthorized | Not logged in |
| `403` | Forbidden | Wrong scope |
| `404` | Not found | Missing distributor or price book |
| `409` | Conflict | Price book version conflict |
| `422` | Validation failed | Promo price above sale price |

## 4. Event Hooks

Recommended event names:

1. `distributor.price_book.updated`
2. `order.distributor.resolved`
3. `order.quote.frozen`
4. `settlement.monthly.completed`
5. `tutor.binding.changed`

## 5. Implementation Notes

1. Pricing quote and payment confirmation must use the same frozen `pricingVersion`.
2. `distributorId` resolved in quote must be copied into the order before payment.
3. `currency` must be copied from the active price book into the order before payment.
4. Language and currency are independent inputs; UI locale must not override a distributor quote.
5. Consumer-facing prices should be shown as tax-inclusive and shipping-inclusive totals, while the order still stores `subtotalAmount`, `taxAmount`, `shippingAmount`, and `totalAmount` separately.
6. `paymentGateway` and `logisticsProvider` must be tracked independently; a provider such as ECPay may be used for one or both capabilities, but fulfillment ownership still belongs to the distributor.
7. Settlement must use snapshot data, not live config, for past periods.
