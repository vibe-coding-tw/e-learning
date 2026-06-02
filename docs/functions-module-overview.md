# Functions Module Overview
**Updated**: 2026-06-02

> 這份文件是 `functions/` 內部模組的快速地圖，方便理解哪些 helper 已經拆出去、各模組負責什麼，以及現在 `index.js` 還扮演什麼角色。

## 1. Current Shape

目前 `functions/index.js` 主要負責：

- Cloud Functions handler orchestration
- Firestore / Auth / GitHub / ECPay / email service 的流程串接
- 提供 lesson / canonical / lookup resolvers 給可重用 helper

真正的共用 helper 已逐步拆到下列模組：

| 模組 | 負責範圍 |
|---|---|
| `functions/lib/revenue-sharing.js` | 月結分潤、policy snapshot、credit/payout/balance 組裝 |
| `functions/lib/assignment-flow.js` | 作業提交、autograde payload、intervention 同步、history / repo assignment 組裝 |
| `functions/lib/tutor-utils.js` | 導師 config、申請紀錄、推薦碼、name resolver、dashboard tutor config 彙整 |
| `functions/lib/order-utils.js` | 訂單 / 物流 / referral link / order normalization / shipment reminder / order authorization |
| `functions/emailService.js` | Email template helper 與各通知流程 |

## 2. What Still Lives in `index.js`

以下類型的邏輯仍留在主檔，因為它們屬於 orchestration 或高度依賴 domain resolver：

- lesson / canonical lookup
- dashboard 統計彙整
- Cloud Function 入口參數驗證
- Payment / Auth / GitHub / Firestore 的流程串接

其中 `normalizeOrderItems` 這條線已經搬到 `functions/lib/order-utils.js`，但仍透過 resolver injection 使用 `index.js` 的 lesson/canonical helpers。

## 3. Maintenance Rules

- 新增共用 helper 時，優先評估是否應放入對應的 `functions/lib/*.js`
- 如果 helper 需要 lesson / canonical / user context，優先設計成可注入 resolver
- 更新 helper 名稱或模組歸屬時，請同步更新：
  - `docs/index-helper-inventory.md`
  - 本文件
  - 對應 domain spec

