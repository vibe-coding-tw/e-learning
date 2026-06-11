# Ledger and Reporting Architecture

Last updated: 2026-06-07

## 1. Purpose

This document defines the recommended system-wide accounting architecture for Vibe Coding:
- every business event enters through one canonical event stream
- every event is translated into ledger postings
- every posting updates one or more read models
- reports are generated from snapshots and projections, not from ad hoc recalculation

The goal is to support:
- automatic bookkeeping
- traceable audit trails
- monthly / quarterly / yearly reporting
- domain-specific ledgers such as revenue share and investor accounting

## 2. Core Principle

The system should treat these as different layers:

1. Event: a business fact, such as `order.paid`, `order.refunded`, `expense.paid`, or `commission.accrued`
2. Posting: accounting entries derived from the event
3. Projection: query-optimized read models such as balances, trial balance, P&L, and balance sheet
4. Report: a rendered output built from projections

Do not use any one layer as a substitute for the others.

## 3. Recommended Data Model

### 3.1 `ledger_events`
Stores the canonical event history.

Suggested fields:
- `eventId`
- `eventType`
- `sourceType`
- `sourceId`
- `sourceLabel`
- `entityType`
- `entityId`
- `currency`
- `grossAmount`
- `occurredAt`
- `metadata`
- `createdAt`

Rules:
- event IDs must be deterministic or otherwise idempotent
- events are append-only
- corrections must be written as new events, not by mutating historical facts

### 3.2 `ledger_postings`
Stores double-entry style postings generated from events.

Suggested fields:
- `postingId`
- `eventId`
- `accountCode`
- `debit`
- `credit`
- `currency`
- `periodYear`
- `periodMonth`
- `unitId`
- `counterpartyId`
- `createdAt`

Rules:
- each event may produce multiple postings
- total debit must equal total credit for balanced entries
- postings should be derived deterministically from the source event

### 3.3 `ledger_accounts`
Stores the chart of accounts.

Suggested fields:
- `accountCode`
- `accountName`
- `accountType`
- `parentCode`
- `enabled`
- `createdAt`
- `updatedAt`

Typical account types:
- asset
- liability
- equity
- revenue
- expense

### 3.4 `ledger_snapshots`
Stores period-based balances derived from postings.

Suggested fields:
- `snapshotId`
- `period`
- `accountCode`
- `openingBalance`
- `debitTotal`
- `creditTotal`
- `closingBalance`
- `currency`
- `locked`
- `createdAt`
- `updatedAt`

### 3.5 `ledger_reports`
Stores finalized reporting outputs when a period is locked.

Suggested fields:
- `reportId`
- `reportType`
- `period`
- `currency`
- `snapshotId`
- `generatedAt`
- `generatedByUid`
- `reportPayload`

## 4. Posting Rules

The mapping from event to posting should be explicit and deterministic.

Examples:

### 4.1 Order paid
- Dr Cash / Bank
- Cr Revenue
- Cr Output VAT
- optional: Dr Commission Expense
- optional: Cr Commission Payable

### 4.2 Order refunded
- Dr Sales Returns or Refunds
- Dr Output VAT Adjustment
- Cr Cash / Bank
- optional: reverse commission postings if the business rule requires it

### 4.3 Expense paid
- Dr Expense account
- Cr Cash / Bank

### 4.4 Commission accrued
- Dr Commission Expense
- Cr Commission Payable

### 4.5 Dividend declared
- Dr Retained Earnings
- Cr Dividend Payable

### 4.6 Dividend paid
- Dr Dividend Payable
- Cr Cash / Bank

## 5. Projection Layer

The projection layer should maintain the read models used by the product and finance team.

Recommended projections:
- daily / monthly account balances
- trial balance
- profit and loss statement
- balance sheet
- cash flow summary
- receivable aging
- payable aging
- settlement summaries by distributor, tutor, or investor

These projections should be rebuilt from `ledger_postings`, not from manual spreadsheets.

## 6. Domain-Specific Ledgers

The system already has domain-specific ledgers, and they should remain separate read models:
- `investor_finance_events`
- `investor_credits`
- `investor_balances`
- `investor_annual_settlements`
- `revenue_share_credits`
- `revenue_share_balances`
- `profit_ledger`
- `balance_sheet_snapshots`

Recommended relationship:
- `ledger_events` is the canonical source of business facts
- domain-specific ledgers are projections or operational views
- finance reports can read from both the general ledger layer and the domain-specific projections

## 7. Idempotency And Reconciliation

1. Every event must have a deterministic key.
2. Every posting must be derived from the event ID.
3. Reprocessing the same source must not create duplicate postings.
4. Period close should produce a locked snapshot.
5. Any correction should be represented as a reversing event or a new adjustment event.

Recommended reconciliation chain:

`report -> snapshot -> postings -> event -> source document`

## 8. Reporting Outputs

Once the ledger is normalized, the system can generate:
- daily revenue report
- monthly profit report
- commission settlement report
- investor dividend report
- cash collection report
- refund and adjustment report
- unit-level settlement report

### 8.1 Standard report payloads

All report payloads should share a small common envelope:
- `reportId`
- `reportType`
- `period`
- `currency`
- `generatedAt`
- `generatedByUid`
- `snapshotCount`
- `rows`
- `totals`

Suggested row shape for `trial_balance`:
- `accountCode`
- `accountName`
- `accountType`
- `openingBalance`
- `debitTotal`
- `creditTotal`
- `closingBalance`

Suggested row shape for `profit_and_loss`:
- `accountCode`
- `accountName`
- `accountType`
- `periodDebit`
- `periodCredit`
- `netAmount`

Suggested row shape for `balance_sheet`:
- `accountCode`
- `accountName`
- `accountType`
- `openingBalance`
- `closingBalance`

Suggested totals:
- `openingBalance`
- `debitTotal`
- `creditTotal`
- `closingBalance`
- optionally `revenueTotal`
- optionally `expenseTotal`
- optionally `netProfit`

Report consumers should treat these payloads as read-only snapshots.

### 8.2 Export interface

The system should expose a read-only export path that can return the same report as:
- `CSV` for spreadsheets and finance ops
- `JSON` for API consumers and downstream automation

The export response should include:
- `fileName`
- `contentType`
- `format`
- `report`
- `content`

## 9. Rollout Strategy

Recommended rollout order:
1. Introduce the canonical event schema.
2. Build the posting mapper.
3. Persist ledger postings.
4. Generate monthly snapshots.
5. Render reports from snapshots.
6. Gradually migrate existing domain ledgers to consume the shared event layer.

## 10. Related Documents

- [Database Schema](./database.md)
- [Investor Ledger System](./investor/investor-ledger-system.md)
- [Cap Table & Tokenization Strategy](./investor/cap-table-and-tokenization-strategy.md)
- [Functions Module Overview](./functions-module-overview.md)
- [Recursive Sharing Spec](./recursive-sharing.md)
