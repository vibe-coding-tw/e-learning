# Cap Table Implementation Spec

Last updated: 2026-06-04

## 1. Purpose

This document defines the internal implementation rules for equity, valuation snapshots, issuance records, and optional tokenization support.

It is intended for engineering, product, and finance operations.

## 2. System of record

- The cap table is the master record for ownership.
- The legal shareholder register must stay consistent with the cap table.
- A blockchain or token layer, if ever added, is only a mirror or transport layer unless the business explicitly adopts tokenized securities.

## 3. Core entities

### 3.1 Authorized shares
- Hard upper bound defined by corporate approval.
- Example: 10,000,000 shares.
- Not the same as live ownership.

### 3.2 Issued / outstanding shares
- The shares currently issued to holders.
- Changes when the company issues, buys back, cancels, or retires shares.

### 3.3 Valuation snapshot
- Frozen pricing input used for one issuance moment.
- Examples: `pre-money`, `post-money`.
- Must never be rewritten retroactively.

### 3.4 Equity issuance
- A record of cash investment, service-for-equity, advisor offset, or other approved consideration.
- Always references exactly one valuation snapshot.

### 3.5 Investor equity position
- Current holdings per participant.
- Derived from issuance history, but stored for fast reads.

## 4. Required data collections

- `investor_profiles`
- `valuation_snapshots`
- `equity_issuances`
- `investor_equity_positions`
- `investor_finance_events`
- `investor_credits`
- `investor_balances`
- `investor_annual_settlements`

## 5. Ownership flow

1. Create or update `investor_profiles`.
2. Freeze a `valuation_snapshots/{valuationId}` record.
3. Create an `equity_issuances/{issuanceId}` record.
4. Update `investor_equity_positions/{investorId}`.
5. Record operational events separately in `investor_finance_events`.
6. Rebuild `investor_credits` and `investor_balances` from event data.
7. Run annual settlement to produce `investor_annual_settlements`.

## 6. Business rules

### 6.1 Founder setup
- Initialize founder records first.
- Keep founder share units explicit.
- Do not infer founder ownership from operational events.

### 6.2 New external investment
- Use the valuation snapshot active at issuance time.
- Derive issue price from valuation and share basis.
- Persist the derived price in the issuance record.

### 6.3 Service-for-equity
- Support employee, consultant, and advisor participation.
- Store `participantType` explicitly.
- If vesting exists, store vesting metadata explicitly.

### 6.4 Income / expense ledger
- Income and expense are not equity issuance.
- They create investor events and credits, not new shares.

### 6.5 Annual settlement
- Compute annual dividend payable from accumulated balances and policy.
- Pay out cash when a payout account exists.
- Carry ending balance into the next year.

## 7. What not to mix

- Do not mix tutor / agent revenue share with investor equity.
- Do not derive valuation from operational balance.
- Do not retroactively rewrite an issuance after a later valuation changes.
- Do not treat a crypto wallet balance as a share balance.

## 8. Future tokenization rule

If tokenization is added:
- the token must represent the ownership record, not replace the legal record
- transfers must be permissioned
- KYC / AML / whitelist controls are required
- custody / recovery / offboarding flows must be defined

## 9. Implementation checklist

- [ ] Founder / original shareholder import
- [ ] Cap table read model
- [ ] Frozen valuation snapshot writes
- [ ] Issuance creation flow
- [ ] Ownership position rebuild job
- [ ] Event-to-credit pipeline
- [ ] Annual settlement job
- [ ] Optional token mirror design

