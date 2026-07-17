# Payment Security Fixes — 2026-07-15

> **Status: COMPLETED (2026-07-15)** — All 4 fixes applied and deployed.

**Context**: found during a full-system audit (code + docs, both `e-learning` and the
sibling `esp32c3-vehicle` repo). Two general-purpose research passes read every
`functions-payment`/`functions-admin` handler and cross-checked docs against code. This
file tracks the 4 payment/auth vulnerabilities found and fixed, plus what still needs a
human to actually finish deploying the fix.

## 1. `initiatePayment` trusted a client-supplied checkout amount — ✅ fixed

**File**: `functions-payment/index.js` (`exports.initiatePayment`)

**Before**: `finalAmount = Math.max(0, Math.round(Number(amount || calculatedAmount) || calculatedAmount))`.
Both `amount` (a raw top-level field in the callable's `data`) and `calculatedAmount`
(summed from each cart item's client-supplied `item.price`, via `resolveCartPrice()`
which just reads `item.price`/`item.currency` off whatever the client sent) were fully
attacker-controlled. Nothing cross-checked either against `dealer_price_books` or lesson
pricing. A client could call `initiatePayment` directly (bypassing `cart.html` entirely)
with any `amount` or per-item `price` and pay whatever they wanted for any cart.

**Fix**: `amount` is no longer read from `data` at all. For every cart item, the backend
now calls `resolveDistributorCheckoutQuote()` from `shared-function-core`
(`vibe-functions-core/distributor-pricing`) — the exact same canonical price-resolution
function `cart.html` already calls client-side when building the cart, and the same one
`functions-admin`'s `/api/checkout/quote` REST endpoint uses. This re-derives the
authoritative price server-side from `dealer_price_books` (or `metadata_lessons` legacy
pricing as fallback) using the item's `docId` + resolved `distributorId`/`priceBookId`,
honoring promo windows the same way the real quote engine does. If any item's price
can't be resolved (`state !== "resolved"`), the whole checkout is rejected with
`failed-precondition` rather than silently trusting the client. The item's `price`/
`currency`/`distributorId`/`priceBookId` fields are also overwritten with the
server-verified values before the order is written to Firestore, so nothing downstream
(order record, ECPay item description, receipts) can be fed the original unverified
snapshot either.

**Verified**: `node --check` + `require()` module load OK; `initiatePayment` still
exports as a function with 23 total exports (unchanged from before the fix). Could not
run an actual checkout end-to-end (needs live Firestore with real `dealer_price_books`
docs) — needs a manual test via `bash start-emulator.sh` before this is fully trusted in
production.

## 2. ECPay `paymentNotify` — CheckMacValue verification was skippable — ✅ fixed

**File**: `functions-payment/index.js` (`exports.paymentNotify`)

**Before**: `if (HASH_KEY && HASH_IV && payload.CheckMacValue) { ...verify... }` — the
verification block only ran if the incoming payload happened to include a
`CheckMacValue` field. A request that simply omitted it skipped verification entirely
and was trusted as a real ECPay payment notification.

**Fix**: when `HASH_KEY`/`HASH_IV` are configured (the real-deployment case),
`CheckMacValue` is now required — a request missing it is rejected the same as one with
a wrong value. Only falls back to accepting unverified requests when the ECPay secrets
themselves aren't configured at all (matches this codebase's existing "no secret →
skip check" convention for local/dev environments with no ECPay credentials).

**Verified**: mock-invoked directly with a payload missing `CheckMacValue` → rejected
with `400 "0|Invalid CheckMacValue"` (confirmed in a local test env where `HASH_KEY`/
`HASH_IV` are set via `.env`, i.e. the "verification required" branch).

## 3. `stripeWebhook` had zero signature verification — ✅ fixed

**File**: `functions-payment/index.js` (`exports.stripeWebhook`)

**Before**: no `Stripe-Signature` header check at all, no `stripe.webhooks.constructEvent`
(the `stripe` npm package isn't even installed — this integration was never fully wired
up). Any POST with a matching `orderId` anywhere in the body would mark that order
`SUCCESS`, and `activateOrderPermissionsAndNotify()` would grant access. This endpoint is
genuinely reachable in production: `cart.html` routes any non-TWD checkout to `gateway:
'STRIPE'` (`shouldUseStripe = !isTwdCheckout || (region && region !== 'TW')`), so
international customers do create real `PENDING` orders with real `orderId`s.

**Fix**: added `verifyStripeSignature()` — a manual implementation of Stripe's documented
webhook signature scheme (HMAC-SHA256 of `"<timestamp>.<rawBody>"`, using
`req.rawBody` which Firebase Functions v2 preserves specifically for this purpose — no
new `stripe` npm dependency added, mirrors the existing hand-rolled ECPay
`generateCheckMacValue` pattern already in this codebase). Declared a new
`STRIPE_WEBHOOK_SECRET` secret via `defineSecret`. **Fails closed**: if the secret isn't
configured, or the `Stripe-Signature` header is missing/invalid, the request is rejected
before any order is touched.

**⚠️ action needed from you**: the endpoint is now locked down by default (returns `503
stripe_webhook_not_configured` until the secret exists), which is the safe state — but
real Stripe payments won't work at all until you run:
```
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```
with the signing secret from the Stripe dashboard's webhook endpoint config, matching
whatever URL you register there against this deployed function. Note the Stripe
integration was already incomplete beyond this (`initiatePayment`'s STRIPE branch never
actually calls the Stripe API to create a real Checkout Session — it just returns a
static `payment-return.html` URL) — this fix only closes the signature-verification hole,
it does not finish building Stripe checkout end-to-end.

**Verified**: mock-invoked with no secret configured → `503
{"error":"stripe_webhook_not_configured"}`, confirming fail-closed behavior.

## 4. `debugTutorAuth` — unauthenticated public PII-leak endpoint — ✅ fixed

**File**: `functions-admin/index.js` (`const debugTutorAuth = onRequest(...)`, exported
at the bottom of the file)

**Before**: no auth check whatsoever. `GET .../debugTutorAuth?email=x@y.com` returned
that user's full Firestore document (`fullDoc: data`, i.e. every field including
`tutorConfigs`), defaulting to a hardcoded personal email
(`rover.k.chen@gmail.com`) if no `email` param was given.

**Fix**: now requires a valid Bearer token (via the same `resolveRestAuth()` helper
`distributorApi` already uses elsewhere in this file) resolving to a user with
`role === 'admin'`, requires an explicit `email` query param (no hardcoded default), and
no longer returns the full document — only the `tutorConfigs` field, which appears to be
what this was actually built to inspect.

**Verified**: mock-invoked with no `Authorization` header → `401 unauthenticated`; with a
garbage Bearer token → `401 unauthenticated` (caught by `resolveRestAuth`'s
`verifyIdToken` try/catch). Could not test the admin-role-required or happy-path
branches without live Firebase Auth + Firestore.

## Not covered by this pass (found, documented elsewhere, not fixed here)

These were found in the same audit but are separate, lower-severity, or need a decision
rather than being pure bugs — tracked in
`.opencode/plans/distributor/distributor-tutor-development-tasks.md` §7 and the
2026-07-15 chat session, not repeated in full here:

- `functions/index.js` gates `onUserCreated`/`mapReply`/`autoGradingCron` behind
  `if (process.env.FUNCTIONS_EMULATOR)`, which is never set on a real `firebase deploy`
  — these three functions silently never run in production as currently written.
- `AGENT.md` §6 and `docs/functions-module-overview.md` both describe things that don't
  match the current codebase (a "monthly scheduled" function that's actually dead code;
  several module files that don't exist at the paths described).
- `public/js/investor-portal.js` and `public/js/distributor-portal.js` still have ~20+
  hardcoded zh-TW `alert()`/`confirm()` calls with no i18n (the earlier P1.6/P1.7 pass
  only fixed the inline `<script>` in the HTML files, not these separate JS modules).
