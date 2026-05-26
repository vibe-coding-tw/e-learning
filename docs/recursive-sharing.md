# Recursive Sharing Spec
**Version**: 2026.05.26.V2  
**Objective**: Define how multi-level referral sharing is computed, persisted, and audited.

## 1. Business Rule
1. 分潤比例由 `orders.policyId -> revenue_share_policies/{policyId}` 決定（找不到時 fallback `default-v1`）。
2. Tutor 鏈條：
   - Level 1: `lineAmount * tutorRate`
   - Level N+1: `previousShare * tutorUplineRate`
3. Agent 鏈條：
   - Level 1: `lineAmount * agentRate`
   - Level N+1: `previousShare * agentUplineRate`
4. Course Developer：
   - `lineAmount * courseDevRate`（單層，無遞迴）
5. Tutor 上線來源為 `users.tutorEmail`；Agent 上線來源為 `users.agentEmail`。
6. Tutor 鏈若缺上線，回落到平台帳號 `info@vibe-coding.tw`。
7. 迭代停止條件：
   - `currentTutorEmail` is empty, or
   - `currentShare < 0.01`, or
   - current tutor is already `info@vibe-coding.tw`.

## 2. Formula
Given order line amount `A`:
- Tutor L1 = `A * tutorRate`
- Tutor L2 = `L1 * tutorUplineRate`
- Agent L1 = `A * agentRate`
- Agent L2 = `L1 * agentUplineRate`
- CourseDev = `A * courseDevRate`

Example (`A=1000`, policy `tutorRate=0.2`, `tutorUplineRate=0.2`, `agentRate=0.2`, `agentUplineRate=0.1`, `courseDevRate=0.2`):
- Tutor L1 = 200, L2 = 40, L3 = 8...
- Agent L1 = 200, L2 = 20, L3 = 2...
- CourseDev = 200

## 3. Execution Window
- Function: `calculateMonthlySharing` (Cloud Scheduler)
- Schedule: monthly on day 1 (`0 0 1 * *`)
- Time span: previous calendar month
- Order filter:
  - `orders.status == SUCCESS`
  - `paidAt` within previous month

## 4. Idempotency & Safety
Each ledger row uses deterministic document id:
- `idempotencyKey = sha256("${period}|${orderId}|${orderItemId}|${role}|${level}|${recipientEmail}")[:40]`
- Stored to `profit_ledger/{idempotencyKey}` with `set(..., { merge: true })`

This prevents duplicate entries when:
1. Scheduler retries.
2. Monthly job is rerun manually for same period.

## 5. Data Contract (`profit_ledger`)
Core fields:
- `idempotencyKey`
- `role` (`tutor|agent|courseDev`)
- `tutorEmail`
- `recipientEmail`
- `studentUid`
- `orderId`
- `orderItemId`
- `orderAmount`
- `shareAmount`
- `level`
- `referralLink`
- `policyId`
- `policySnapshot`
- `period`
- `calculatedAt`

See also: `docs/database.md` section `profit_ledger`.

## 6. Operational Runbook
1. If expected share entry is missing:
   - Confirm order `status=SUCCESS`.
   - Confirm `paidAt` falls in target month.
   - Confirm order item amount > 0.
2. If upstream share always goes to platform:
   - Check `users/{uid}.tutorEmail` for upline link.
3. If duplicates are suspected:
   - Query by `idempotencyKey` and `period`.
   - Validate scheduler retries / manual rerun history.

## 7. Related Files
- `functions/index.js` (`calculateMonthlySharing`)
- `docs/database.md`
- `README.md`
