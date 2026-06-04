# Investor Docs Index

Last updated: 2026-06-04

This folder collects the equity, valuation, and investor-ledger documents for Vibe Coding.

## Recommended reading order

1. [Investor FAQ](./faq.md)
2. [Cap Table & Tokenization Overview](./cap-table-investor-overview.md)
3. [Cap Table & Tokenization Strategy](./cap-table-and-tokenization-strategy.md)
4. [Cap Table Implementation Spec](./cap-table-implementation-spec.md)
5. [Investor Ledger System](./investor-ledger-system.md)
6. [Valuation Model](./valuation-model.md)
7. [Funding Roadmap](./funding-roadmap.md)

## What each document is for

- `cap-table-investor-overview.md`
  - Plain-language overview for founders, investors, and advisors
- `faq.md`
  - Short answers to the most common equity, valuation, and tokenization questions
- `cap-table-and-tokenization-strategy.md`
  - System boundaries and the relationship between cap table, valuation, crypto, and future tokenization
- `cap-table-implementation-spec.md`
  - Internal engineering and operations spec
- `investor-ledger-system.md`
  - Event, credit, balance, and annual settlement model
- `valuation-model.md`
  - Valuation assumptions and pricing anchors
- `funding-roadmap.md`
  - Stage-based fundraising roadmap and milestones

## System summary

- Ownership master stays off-chain by default.
- Valuation snapshots freeze issuance pricing at a moment in time.
- Investor ledger events stay separate from revenue-share logic.
- Crypto may be used as a payment or treasury tool, but it does not replace the cap table.

## Related schema

- [Database Schema](../database.md)
