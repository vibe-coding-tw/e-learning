# Distributor Tutor UI Permissions
**Version**: 2026.07.14.V2
**Purpose**: Define which pages and actions each role can see for distributor pricing, tutor binding, and settlement workflows.

> **2026-07-14 architecture note**: earlier revisions of this document (V1) described
> `Admin Console`, `Distributor Storefront`, `Tutor Dashboard`, and `Settlement View` as
> four independent pages. That was never built that way. The actual implementation is a
> single page, `public/distributor-portal.html` (logic in `public/js/distributor-portal.js`),
> split into 5 content tabs (`admin` / `pricing` / `orders` / `tutor` / `settlement`) that
> show/hide `<div>` panels — see `AGENT.md` §11 for the exact tab wiring. Role-based access
> is done by hiding tabs/panels, not by routing to different URLs. The table below is kept
> as a **capability map** (what each role can see/do), reframed against the tabs that
> actually exist. `Checkout` is the one row that is genuinely a separate page
> (`public/cart.html` + checkout flow), unrelated to `distributor-portal.html`.
>
> One capability in the old V1 map does **not** exist in code: there is no tutor
> self-service login/dashboard. The `tutor` tab inside `distributor-portal.html` is a
> **distributor/admin-facing** read-only table listing which tutors are bound to that
> distributor (`portal-tutor-table-body`) — it is not a page a tutor logs into to see their
> own binding or revenue. If tutor self-service is still wanted, it is an unbuilt feature
> (see `.opencode/plans/distributor/distributor-tutor-development-tasks.md` §7.2 for the
> related open decision on `GET /api/admin/tutors/:tutorId`).

## 1. Page Map

| Page / Tab | Purpose | Primary audience | Status |
| :--- | :--- | :--- | :--- |
| `distributor-portal.html` → `admin` tab | Manage distributors, price-book oversight, audit | Platform/Admin | ✅ built, hidden from non-admin via `MutationObserver` |
| `distributor-portal.html` → `pricing` tab | Publish/edit distributor-specific hardware pricing (default tab) | Distributor, Admin | ✅ built |
| `distributor-portal.html` → `orders` tab | View/update fulfillment status for this distributor's orders | Distributor, Admin | ✅ built |
| `distributor-portal.html` → `tutor` tab | **Distributor/Admin view** of tutors bound to this distributor (read-only list, not a tutor self-service view) | Distributor, Admin | ✅ built |
| `distributor-portal.html` → `settlement` tab | Inspect monthly ledger and payout status | Platform/Admin, Distributor | ⚠️ UI reads existing data; `settlements/run` trigger itself is not wired up (dead code, needs finance sign-off — see `.opencode/plans/distributor/distributor-tutor-development-tasks.md` §7.2) |
| `Checkout` (`public/cart.html`) | Resolve distributor and show frozen quote | Customer | ✅ built, separate page from the portal |
| Tutor self-service dashboard | Tutor views own binding, service summary | Tutor | ❌ not built — see note above |

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

> Sections 3.1–3.3 below describe required behavior per capability area. Each maps to a
> tab inside `distributor-portal.html` (see §1), not a standalone page.

### 3.1 Distributor storefront (→ `pricing` tab)

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

### 3.2 Tutor binding view (→ `tutor` tab, distributor/admin-facing)

**Not a tutor-facing dashboard** (see architecture note in §1) — this is what the
distributor/admin sees when reviewing tutors bound to their distributor. The
tutor-self-service version of this (tutor logging in to see their own binding/revenue)
described below is aspirational and unbuilt.

Must show (as seen by distributor/admin today):

- tutor name, email, authorized units, binding status (implemented: `portal-tutor-table-body`)

Must show (aspirational, tutor's own view — not built):

- bound distributor
- linked student count
- service revenue summary
- internal split preview

Must not allow (applies once/if a tutor-facing view is built):

- editing hardware sale price
- editing distributor-wide price rules
- modifying settlement snapshots

### 3.3 Admin console (→ `admin` tab)

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
