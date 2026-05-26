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
4. Course Developer 鏈條：
   - Level 1: `lineAmount * courseDevRate`
   - Level N+1: `previousShare * courseDevUplineRate`
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
- CourseDev L1 = `A * courseDevRate`
- CourseDev L2 = `L1 * courseDevUplineRate`

Example (`A=1000`, policy `tutorRate=0.2`, `tutorUplineRate=0.2`, `agentRate=0.2`, `agentUplineRate=0.1`, `courseDevRate=0.2`):
- Tutor L1 = 200, L2 = 40, L3 = 8...
- Agent L1 = 200, L2 = 20, L3 = 2...
- CourseDev = 200

## 3. Credit And Monthly Settlement
- 訂單付款成功後（`orders.status=SUCCESS`），系統會建立分潤 `credit`（`revenue_share_credits`）。
- 月結時不是一次付清，而是按有效期攤提：
  - `validityMonths = item.validityMonths || order.validityMonths || metadata_settings/revenue_share_config.defaultValidityMonths`
  - `monthlyInstallment = totalCredit / validityMonths`
- 每月支付前會檢查受益者是否有 `users.payoutAccount`：
  - 有：本月支付並扣減 `remainingCredit`
  - 無：本月標記 `missing_payout_account`，credit 保留不扣款
- 系統會同步重建 `revenue_share_balances`，顯示每位受益者的 `totalCredit / totalPaid / remainingBalance`。

## 4. Execution Window
- Function: `calculateMonthlySharing` (Cloud Scheduler)
- Schedule: monthly on day 1 (`0 0 1 * *`)
- Time span: previous calendar month
- Credit generation filter:
  - `orders.status == SUCCESS`
  - `paidAt` within previous month
- Payout settlement filter:
  - `revenue_share_credits.status in [active, pending_account]`
  - `nextPayoutPeriod <= targetPeriod`

## 5. Idempotency & Safety
Each ledger row uses deterministic document id:
- credit id: `sha256("${orderId}|${orderItemId}|${role}|${level}|${recipientEmail}")[:40]`
- payout ledger id: `sha256("${period}|${creditId}|payout")[:40]`
- Stored to `profit_ledger/{idempotencyKey}` with `set(..., { merge: true })`

This prevents duplicate entries when:
1. Scheduler retries.
2. Monthly job is rerun manually for same period.

## 6. Data Contract (`profit_ledger`)
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
- `plannedShareAmount`
- `blockedShareAmount`
- `level`
- `referralLink`
- `policyId`
- `policySnapshot`
- `period`
- `calculatedAt`

See also: `docs/database.md` section `profit_ledger`.

## 7. Operational Runbook
1. If expected share entry is missing:
   - Confirm order `status=SUCCESS`.
   - Confirm `paidAt` falls in target month.
   - Confirm order item amount > 0.
2. If payout rows are always `missing_payout_account`:
   - Check `users.payoutAccount` for recipient email.
3. If upstream share always goes to platform:
   - Check `users/{uid}.tutorEmail` for upline link.
4. If duplicates are suspected:
   - Query by `idempotencyKey` and `period`.
   - Validate scheduler retries / manual rerun history.

## 8. Related Files
- `functions/index.js` (`calculateMonthlySharing`)
- `docs/database.md`
- `README.md`
- `functions/scripts/report_missing_payout_accounts.js`

## 9. CourseDev Upline Mapping
1. `courseDev` 上線來源優先使用 `users.courseDevEmail`。
2. 若未設定，fallback 到 `users.tutorEmail`。
3. 遞迴停止條件與其他角色一致：空值、同值迴圈或 `share < 0.01`。
