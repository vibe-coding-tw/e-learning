# Cap Table & Tokenization Overview

Last updated: 2026-06-04

## 1. What this means in plain language

Vibe Coding keeps a master record of who owns what.

That record is called the cap table.
- It tells us who the shareholders are
- It tells us how many shares each person has
- It records changes over time
- It is the source of truth for ownership

## 2. Why this is not the same as crypto

Crypto systems often focus on wallet balances and transfers.

Company shares are different:
- shares are issued by company approval
- the total share framework comes from legal documents
- share transfers need governance and record keeping
- a tokenized share is still a security, not a normal coin

## 3. The role of valuation

A valuation snapshot is a frozen pricing reference.

It is used when we issue new shares or convert a service contribution into equity.
- It is not a daily market price
- It is not meant to rewrite older records
- It only applies to the issuance moment that references it

## 4. The role of crypto

Crypto can still be useful, but as a supporting tool:
- payments
- treasury management
- settlement rail
- future mirror of ownership records if we ever choose tokenization

For now, the ownership master should stay off-chain.

## 5. What the system already tracks

The platform already supports:
- investor profiles
- balance sheet snapshots
- valuation snapshots
- equity issuances
- investor positions
- finance events
- credit allocation
- running balances
- annual dividend settlement

## 6. Practical takeaway

The safest setup is:
- keep the cap table as the master record
- store balance-sheet snapshots separately so NAV can be compared against valuation
- use valuation snapshots to price each issuance
- keep operational income and expense separate from equity
- use crypto only where it adds real operational value
- consider tokenization only after legal and tax design are ready

## 7. Related documents

- [Investor FAQ](./faq.md)
- [Valuation & NAV Checklist](./valuation-checklist.md)
- [Cap Table & Tokenization Strategy](./cap-table-and-tokenization-strategy.md)
- [Investor Ledger System](./investor-ledger-system.md)
- [Valuation Model](./valuation-model.md)
