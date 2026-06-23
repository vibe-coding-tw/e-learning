# Distributor Tutor UI Permissions
**Version**: 2026.06.05.V1
**Purpose**: Define which pages and actions each role can see for distributor pricing, tutor binding, and settlement workflows.

## 1. Page Map

| Page | Purpose | Primary audience |
| :--- | :--- | :--- |
| `Admin Console` | Manage distributors, tutors, pricing, settlement, audit | Platform/Admin |
| `Distributor Storefront` | Publish distributor-specific hardware pricing | Distributor |
| `Tutor Dashboard` | View tutor binding, service summary, and tutor email | Tutor |
| `Checkout` | Resolve distributor and show frozen quote | Customer |
| `Settlement View` | Inspect monthly ledger and payout status | Platform/Admin, Distributor |

## 2. Permission Matrix

| Action | Platform/Admin | Distributor | Tutor | Customer |
| :--- | :--- | :--- | :--- | :--- |
| View MSRP | Yes | Yes | Yes | Yes |
| Edit MSRP | Yes | No | No | No |
| View distributor price books | Yes | Yes, own scope | No | No |
| Edit distributor sale price | No | Yes, own scope | No | No |
| Edit promo price | No | Yes, own scope | No | No |
| Create price book | Yes | Yes, own scope | No | No |
| Bind tutor to distributor | Yes | Yes, own scope | No | No |
| View tutor service settlement | Yes | Yes, own scope | Yes, own scope | No |
| View hardware settlement | Yes | Yes, own scope | No | No |
| Run settlement | Yes | No | No | No |
| Force downstream resale price | No | No | No | No |

## 3. UI Behavior Rules

### 3.1 Distributor storefront

Must show:

- distributor name
- region badge
- active sale price
- promo price if active
- pricing version
- inventory or availability status

Must allow:

- edit own sale price
- create promo window
- view own order list
- view own settlement summary

### 3.2 Tutor dashboard

Must show:

- bound distributor
- tutor email (or legacy promotion code)
- linked student count
- service revenue summary
- internal split preview

Must not allow:

- editing hardware sale price
- editing distributor-wide price rules
- modifying settlement snapshots

### 3.3 Admin console

Must show:

- all distributors
- all tutors
- all price books
- settlement runs
- audit logs

Must allow:

- override inactive or broken price books
- review price dispersion in the same region
- inspect tutor binding consistency

### 3.4 Checkout

Must:

1. Resolve distributor before price is shown.
2. Freeze the price book for the session.
3. Display the selected distributor name.
4. Requote if the distributor changes.
5. Keep language selection separate from currency display.

## 4. Same-Region Multi-Distributor UX

If more than one distributor exists in the same region:

1. Do not collapse them into one regional price.
2. Show a distributor selector when the route is ambiguous.
3. If the customer arrives from a tutor link, preselect the tutor's distributor.
4. If the customer arrives from a distributor storefront, lock to that distributor.
5. If the customer changes the distributor, the cart must be repriced.
6. Changing language should not trigger a distributor change.
7. Changing language should not trigger a currency change.

## 5. State and Visibility Rules

### 5.1 Price book state

| State | Visible in UI | Editable | Usable in checkout |
| :--- | :--- | :--- | :--- |
| Draft | Yes | Yes | No |
| Active | Yes | Yes | Yes |
| Scheduled | Yes | Yes | No until effectiveFrom |
| Expired | Yes | No | No |

### 5.2 Tutor binding state

| State | Meaning | UI action |
| :--- | :--- | :--- |
| Unbound | No distributor binding yet | Prompt binding |
| Bound | Linked to distributor | Show distributor name |
| Suspended | Binding temporarily inactive | Hide revenue actions |

## 6. Copy and Label Guidance

Recommended labels:

- `Suggested Price`
- `Your Distributor Price`
- `Promo Price`
- `Service Fee`
- `Tutor Service Share`
- `Language`
- `Currency`

Avoid labels that imply:

- mandatory resale price
- fixed retail price enforcement
- penalty for discounting
- treating language and currency as the same setting

## 7. QA Checklist

1. Different distributors in one region show different prices.
2. Tutor dashboard cannot edit hardware pricing.
3. Admin console can inspect all price books.
4. Checkout price changes when distributor changes.
5. Settlement view shows snapshot-based historical values.
