# Investor Ledger System

Last updated: 2026-06-03

## 1. Goal
把投資人計劃變成可執行的系統模組：
- 每一筆收入 / 支出都形成可追蹤的 event
- 每一筆 event 依投資人份額拆成 credit
- 年度結算時發放股利
- 結算後保留最後餘額，作為下一年度的起始餘額

## 2. Core Rules
1. 投資人份額以 `shareUnits` 表示。
2. 所有 active 投資人份額加總後，依比例分配每筆金額。
3. 收入為正 credit，支出為負 credit。
4. 事件建立時就寫入 `investor_finance_events` 與 `investor_credits`。
5. `investor_balances.currentBalance` 會即時累積。
6. 年度結算時：
   - 計算當年度 credits 的收入與支出總和
   - 計算應發股利 `dividendPayable`
   - 若有收款帳號，視為已發放 `dividendPaid`
   - 結算後更新 `endingBalance`

## 3. Data Flow
1. 來源事件發生。
2. 系統寫入 `investor_finance_events/{eventId}`。
3. 系統依 `shareUnits` 拆分為 `investor_credits/{creditId}`。
4. 系統同步更新 `investor_balances/{investorId}`。
5. 每年 1 月 1 日執行年度結算，產生 `investor_annual_settlements/{year-investorId}`。

## 4. Current Integration Points
- 訂單成功付款後，會自動建立 `income` 類 investor event。
- `manual` 支出可透過 admin callable 補登。
- `calculateAnnualInvestorDividends` 為年度結算排程。

## 5. Related Collections
- `investor_profiles`
- `investor_finance_events`
- `investor_credits`
- `investor_balances`
- `investor_annual_settlements`

## 6. Notes
- 若未來有退款、補貼、行銷費、雲端成本等來源，可全部走同一套 event 入口。
- 這套模型刻意與 `revenue_share_*` 分離，避免投資人結算與 tutor/agent 分潤互相污染。
