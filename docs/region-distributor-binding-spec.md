# Region, Distributor, Language, and Currency Binding Spec
**Version**: 2026.06.06.V1
**Purpose**: Define how the platform uses `region` to recommend or bind a distributor, while keeping course language and checkout currency decoupled.

## 1. Design Goals

1. Let users land on the most suitable distributor with minimal friction.
2. Keep `region` as a routing and reporting signal, not a pricing signal.
3. Keep `language` as a content signal, not a currency signal.
4. Keep `currency` owned by the distributor price book and frozen at checkout.
5. Allow the same course to be displayed in multiple languages while remaining bound to one distributor and one currency per checkout.

## 2. Core Rules

### 2.1 Region

`region` is used to:

- recommend a default distributor
- constrain eligible distributors
- support reporting and settlement

`region` is not used to:

- infer language
- infer currency
- force a single regional retail price

### 2.2 Language

Language controls:

- course title and description
- navigation and button copy
- content locale and classroom entry text

Language does not control:

- distributor choice
- price book selection
- currency selection

### 2.3 Currency

Currency is resolved from:

1. selected distributor
2. selected product
3. active price book
4. frozen checkout quote

Currency does not follow:

- UI language
- browser locale
- course content locale

## 3. Recommended Binding Flow

### 3.1 First visit

1. Detect or ask for `region`.
2. Look up eligible distributors for that region.
3. Pick the best match using priority rules.
4. Persist the choice to the user profile.
5. When no explicit preference exists, the UI may prefill `region` from the last successful checkout, shipping country, or locale fallback before showing a selector.

### 3.2 Repeat visit

1. Reuse `preferredDistributorId` when still valid.
2. Fall back to region rules if the previous distributor is inactive.
3. Allow manual override only when more than one distributor is eligible.
4. If the user has not explicitly chosen a region, the frontend may auto-adjust it from shipping country changes and keep a local last-successful-region cache.

### 3.3 Checkout

1. Resolve distributor.
2. Resolve price book.
3. Freeze `distributorId`, `priceBookId`, `currency`, and `pricingVersion`.
4. Reject mixed-distributor or mixed-currency carts.

## 4. Priority Rules

Recommended distributor selection order:

1. Explicit distributor selection from storefront or admin link
2. Tutor or promotion-code binding
3. User `preferredDistributorId`
4. Region default distributor
5. Region backup distributor ranked by availability or business priority
6. Manual selection when ambiguous

Recommended region default order:

1. Explicit saved region from user profile or local preference
2. Last successful checkout region
3. Shipping country inferred region
4. Locale-based fallback as a last resort
5. Platform default region

## 5. Recommended Firestore Additions

### 5.1 `users/{uid}`

Suggested fields:

- `preferredRegion`
- `preferredDistributorId`
- `bindingSource`
- `bindingConfidence`
- `bindingUpdatedAt`
- `locale`
- `region`

### 5.2 `region_distributor_rules/{region}`

Recommended fields:

- `region`
- `defaultDistributorId`
- `backupDistributorIds`
- `active`
- `manualOverrideEnabled`
- `rankingMode`
- `updatedAt`

### 5.3 `orders/{orderId}`

Recommended frozen fields:

- `region`
- `contentLocale`
- `distributorId`
- `priceBookId`
- `currency`
- `pricingVersion`

## 6. API Expectations

1. The checkout quote API should return distributor, price book, currency, and pricing version together.
2. A user preference API should persist the recommended distributor after first binding.
3. Admins should be able to maintain region-to-distributor rules without editing price books.

## 7. Frontend Behavior

1. Region selector should appear in onboarding or checkout routing.
2. Language selector should only change content and UI text.
3. Price labels should use the currency returned by quote, not locale fallback.
4. If a cart mixes distributors or currencies, the UI should ask the user to split the checkout.
5. The UI should display the reason for the chosen region when it auto-prefills, such as saved preference, last successful checkout, or shipping country.

## 8. Acceptance Criteria

1. A user can switch course language without changing distributor.
2. A user can switch language without changing currency.
3. A user can change region and receive a new recommended distributor.
4. Checkout freezes one distributor and one currency per order.
5. Admins can update region routing without rewriting product price books.
