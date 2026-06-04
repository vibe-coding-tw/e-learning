# Valuation & NAV Checklist

Last updated: 2026-06-04

## 1. Purpose

This checklist helps compare:
- book value / net asset value
- valuation anchor
- per-share price
- realized transaction evidence

It is a working template, not a formal fairness opinion.

## 2. Definitions

### 2.1 Net Asset Value (NAV)
`NAV = total assets - total liabilities`

Use this when you want to understand the current balance-sheet value of the company.

### 2.2 Pre-money valuation
The agreed company value before new money enters.

Use this when pricing a new issuance or comparing fundraising proposals.

### 2.3 Share price
`share price = valuation / share count`

Use the share count that matches the context:
- authorized shares: upper bound only
- issued shares: actual current ownership base
- valuation basis shares: the basis used in the financing model

### 2.4 Realized transaction price
The actual price agreed in a secondary transfer or primary issuance.

This is the strongest market validation for a specific moment, but it is not the only way value exists.

## 3. Input template

Fill in the following numbers:

- Total assets:
- Total liabilities:
- Cash:
- Accounts receivable:
- Accounts payable:
- Annual revenue:
- Annual gross profit:
- Annual net profit:
- Authorized shares:
- Issued shares:
- Valuation basis shares:
- Target pre-money valuation:
- Observed transaction price, if any:

## 4. Calculation sheet

### 4.1 NAV
`NAV = total assets - total liabilities`

### 4.2 NAV per issued share
`NAV per issued share = NAV / issued shares`

### 4.3 Pre-money share price
`share price = target pre-money valuation / valuation basis shares`

### 4.4 Post-money valuation
`post-money valuation = pre-money valuation + new money`

### 4.5 Dilution check
`post-issue ownership = investor shares / total issued shares after issuance`

## 5. Quick interpretation rules

- If valuation is far above NAV, that is normal for an early-stage company with growth potential.
- If valuation is close to NAV, the market is valuing the company mostly as an asset pool.
- If realized transaction price exists, it is strong evidence for that moment.
- If there is no transaction, value can still be estimated from cash flow, comparables, or financing terms.

## 6. Example using current internal anchor

Assume:
- target pre-money valuation = NTD 220M
- valuation basis shares = 10,000,000

Then:
- share price = 220,000,000 / 10,000,000 = NTD 22 per share

If you instead use only issued shares, replace the denominator with the actual issued share count.

## 7. What to collect before deciding whether the valuation is reasonable

1. Latest balance sheet
2. Cash balance
3. Debt / liabilities
4. 12-month revenue
5. 12-month gross profit
6. 12-month net profit
7. Realized transfer or issuance price, if any
8. Comparable company multiples
9. Growth and retention indicators

## 8. Where this lives in the system

- Balance sheet snapshots are stored in `balance_sheet_snapshots`
- Valuation snapshots are stored in `valuation_snapshots`
- The dashboard compares both values so you can see book value, NAV, and the fundraising anchor side by side
- Operational income / expense events automatically update the system-managed `auto-current` balance sheet snapshot, while manually locked snapshots remain available as historical references

## 9. Related documents

- [Cap Table & Tokenization Strategy](./cap-table-and-tokenization-strategy.md)
- [Cap Table Implementation Spec](./cap-table-implementation-spec.md)
- [Cap Table & Tokenization Overview](./cap-table-investor-overview.md)
- [Investor FAQ](./faq.md)
- [Valuation Model](./valuation-model.md)
