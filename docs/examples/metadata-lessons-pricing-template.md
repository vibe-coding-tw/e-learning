# metadata_lessons Pricing Template

這份範例對應 `metadata_lessons` 的多地區價格欄位。

## 欄位說明

| 欄位 | 說明 |
|---|---|
| `course_id` | Firestore `metadata_lessons` 文件 ID 或課程識別碼。 |
| `category` | 課程家族類型，通常是 `started`、`basic`、`advanced`。 |
| `pricing.tw.amount` | 中文 / 台灣價格金額。 |
| `pricing.tw.currency` | 中文 / 台灣價格幣別，通常為 `TWD`。 |
| `pricing.en.amount` | 英文 / 美國價格金額。 |
| `pricing.en.currency` | 英文 / 美國價格幣別，通常為 `USD`。 |
| `price_twd` | 相容欄位，台幣金額。 |
| `price_usd` | 相容欄位，美金金額。 |
| `currency` | 預設幣別，通常保留 `TWD`。 |
| `notes` | 備註。 |

## 標準定價

| 課程家族 | TW | EN / US |
|---|---:|---:|
| 入門 `started` | 1200 TWD | 40 USD |
| 基礎 `basic` | 1500 TWD | 50 USD |
| 進階 `advanced` | 1800 TWD | 60 USD |

## 範例資料

```csv
course_id,category,pricing.tw.amount,pricing.tw.currency,pricing.en.amount,pricing.en.currency,price_twd,price_usd,currency,notes
start-01-master-web-app.html,started,1200,TWD,40,USD,1200,40,TWD,Starter course family
basic-01-master-environment.html,basic,1500,TWD,50,USD,1500,50,TWD,Basic course family
adv-01-master-s3-cam.html,advanced,1800,TWD,60,USD,1800,60,TWD,Advanced course family
```

## 使用原則

1. 前端和後端都優先讀 Firestore，避免在程式端做匯率換算。
2. 中文頁面讀 `pricing.tw`，英文頁面讀 `pricing.en`。
3. 舊欄位 `price_twd` / `price_usd` / `currency` 只保留做相容。
4. 若要新增其他地區價格，請先擴充 `pricing` 與對應別名欄位，再同步更新前後端 resolver。
