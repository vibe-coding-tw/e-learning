# Functions Module Overview
**Updated**: 2026-06-11

> 這份文件是 `functions/` 內部模組的快速地圖，方便理解哪些 helper 已經拆出去、各模組負責什麼，以及現在 `index.js` 還扮演什麼角色。

## 1. Current Shape

目前 `functions/index.js` 主要負責：

- 啟動時先呼叫 bootstrap helper，處理 `.env` 載入與 V2 global options
- 透過單一 registry 呼叫，集中註冊大量 admin / payment / autograde proxy 入口
- 掛載少量特殊 handler，例如 `gradeAssignment`、`onUserCreated`、`mapReply`

真正的共用 helper 已逐步拆到下列模組：

| 模組 | 負責範圍 |
|---|---|
| `functions/lib/revenue-sharing.js` | 月結分潤、policy snapshot、credit/payout/balance 組裝 |
| `functions/lib/ledger-engine.js` | 全域 canonical event、double-entry postings、snapshot / report 產生 |
| `functions/lib/investor-ledger.js` | 投資人事件流水、資產負債快照、valuation snapshot、credit/年度結算、股利與餘額彙整 |
| `functions/lib/assignment-flow.js` | 作業提交、autograde payload、intervention 同步、history / repo assignment 組裝 |
| `functions/lib/tutor-utils.js` | 導師 config、申請紀錄、推薦碼、name resolver、dashboard tutor config 彙整 |
| `functions/lib/course-lookup.js` | 課程 / 單元 canonical、lookup、alias 與 dashboard 正規化 helper |
| `functions/lib/order-utils.js` | 訂單 / 物流 / referral link / order normalization / shipment reminder / order authorization |
| `functions/lib/order-access.js` | 訂單開通、學生授權、導師綁定、推薦碼與 referral backfill 的共用 access flow |
| `functions/lib/distributor-portal.js` | 經銷商 portal 的 scoped users、orders、tutors 聚合 helpers |
| `functions/lib/proxy-utils.js` | callable / request proxy wrappers，統一轉發 admin / payment / autograde 入口 |
| `functions/lib/index-export-registry.js` | `functions/index.js` 的資料驅動 export 註冊與少量特殊 handler 組裝 |
| `functions/lib/functions-bootstrap.js` | `functions/index.js` 的 `.env` 載入、環境檢查與 V2 global options 初始化 |
| `functions/lib/user-triggers.js` | 新用戶建立後的 Firestore 初始化與 welcome email handler |
| `functions/lib/ecpay-webhooks.js` | ECPay 綠界回傳 webhooks / redirect handler |
| `functions-admin/dashboard-utils.js` | dashboard / user row / tutor rows / hardware orders / hidden section 的共用聚合 helper |
| `functions-admin/index.js` | Admin lessons metadata、system config / cache purge、admin pricing / distributor admin、distributor routing / portal、admin dashboard、student assignment tutor report、debug tutor auth、admin tutor assignment actions、tutor config save/read、assignment access / tutor application admin flow、revenue share policy / investor ledger admin entrypoints |
| `functions-payment/lib/content-runtime.js` | course runtime / lesson lookup / runtime injection / metadata_lessons fetch |
| `functions-payment/index.js` | Payment / shipment / order-fulfillment / serveCourse / payment authorization handlers |
| `shared-reminders/` | `remindAdminPendingAssignments` / `remindAdminPendingShipments` 的共用 runner，供 `functions/` 與 `functions-admin/` 共用 |
| `functions/emailService.js` | Email template helper 與各通知流程 |

If a shared ledger layer is introduced later, it should live in a separate helper such as `functions/lib/ledger-engine.js` or a similarly named module, and the domain helpers above should consume it rather than reimplementing event posting logic.

Current ledger-facing callable surface:
- `getRevenueSharePolicies` / `upsertRevenueSharePolicy` / `getInvestorProfiles` / `upsertInvestorProfile` / `upsertValuationSnapshot` / `upsertBalanceSheetSnapshot` / `issueInvestorEquity` / `recordInvestorFinanceEvent` / `settleAnnualInvestorDividends`: public callable proxies in `functions/index.js`, forwarded to `functions-admin/index.js`
- `recordLedgerEvent` / `generateLedgerReport` / `exportLedgerReport` / `recordOrderRefundEvent`: public callable proxies in `functions/index.js`, forwarded to `functions-admin/index.js`
- `resolveDistributorCheckoutQuote`: public callable proxy in `functions/index.js`, forwarded to `functions-admin/index.js`
- `verifyReferralLink` / `verifyPromoCode` / `findClassroomInviteBinding` / `findClassroomInviteBindingHttp` / `precheckGithubClassroomAccess`: public proxies in `functions/index.js`, forwarded to `functions-admin/index.js`
- `recordLedgerEvent`: generic canonical event ingestion
- `recordOrderRefundEvent`: admin refund / reversal entry point for orders
- `generateLedgerReport`: materialize a period report from snapshots
- `exportLedgerReport`: return CSV or JSON output for download or downstream processing

## 2. What Still Lives in `index.js`

以下類型的邏輯已經從主檔移出，現在主要由各 domain helper 處理：

- lesson / canonical lookup
- dashboard 統計彙整
- Cloud Function 入口參數驗證
- Payment / Auth / GitHub / Firestore 的流程串接

`functions/index.js` 現在只保留啟動與註冊，不再持有這些 domain glue。

### 2.1 Slimming Status

`functions/index.js` 的瘦身已經完成「拆 helper」與「集中註冊 proxy 入口」這一段，現在主檔只保留最少量 orchestration 與設定：

- 已完成
  - `order-utils`
  - `tutor-utils`
  - `assignment-flow`
  - `revenue-sharing`
  - `ledger-engine`
  - `investor-ledger`
  - `course-lookup`
  - `order-access`
  - `distributor-portal`
  - `proxy-utils`
  - `index-export-registry`
  - `functions-bootstrap`
  - `user-triggers`
  - `ecpay-webhooks`
  - `functions-admin/dashboard-utils.js`
  - `functions-payment/lib/content-runtime.js`
  - `functions-admin/index.js` 的 admin-facing entrypoints（逐步接手 lessons metadata / dashboard / tutor admin flows / tutor configs / assignment access / tutor applications / debug tools）
  - `functions-admin/index.js` 的 system config / i18n / cache admin entrypoints
  - `functions-admin/index.js` 的 pricing / distributor admin entrypoints
  - `functions-admin/index.js` 的 distributor routing / portal entrypoints
  - `functions-admin/index.js` 的 revenue share policy / investor ledger entrypoints
  - `functions-admin/index.js` 的 referral / classroom binding / GitHub precheck entrypoints
  - `functions-payment/index.js` 的 payment / fulfillment entrypoints
  - `shared-reminders/` 的排程提醒共用 runner
- 仍留在 `index.js`
  - 單一 bootstrap 呼叫
  - 單一 export 註冊呼叫

因此，`functions/index.js` 現在幾乎只剩啟動與註冊兩步；真正的出口組裝與 runtime 初始化已搬到 `functions/lib/index-export-registry.js` 和 `functions/lib/functions-bootstrap.js`。

## 4. Investor Ledger Surface

`functions/lib/investor-ledger.js` 現在除了投資人事件、發股與年度結算，也包含資產負債快照與 NAV 相關資料流：

- `upsertBalanceSheetSnapshot`
- `loadBalanceSheetSnapshots`
- `loadActiveBalanceSheetSnapshot`
- `upsertValuationSnapshot`
- `issueInvestorEquity`
- `recordInvestorFinanceEvent`（會同步推動 current balance sheet snapshot）
- `settleAnnualInvestorDividends`

## 5. Maintenance Rules

- 新增共用 helper 時，優先評估是否應放入對應的 `functions/lib/*.js`
- 如果 helper 需要 lesson / canonical / user context，優先設計成可注入 resolver
- 更新 helper 名稱或模組歸屬時，請同步更新：
  - `docs/index-helper-inventory.md`
  - 本文件
  - 對應 domain spec

## 6. Course Runtime Boundary

- `functions-payment/index.js` 的 `serveCourse` 負責授權、content runtime 取得與 runtime script 注入。
- `serveCourse` 必須將 `/js/course-shared.js` 與 `/js/nav-component.js` 正規化為目前版本 URL，避免 CDN 舊快取。
- `public/js/course-shared.js` 負責課程 shell 與跨單元 TAB。
- 課程 HTML 負責目前單元內的 `window.UNITS`、`#sidebar-nav` 與 page menu。
- 後端與平台 shared JS 都不得以 Firestore `courseUnits` 覆寫單元內 page menu。
- 完整規格見 `docs/course-ui-runtime-spec.md`。
