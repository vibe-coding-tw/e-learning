# Assignment Guide Audit

這份報告用來檢查兩件事：

1. `content-repo/courses` 裡哪些 HTML 檔真的有 `#assignment-guide`
2. 目前 `metadata_lessons` 裡哪些課程還找不到對應內容檔

## 執行方式

```bash
cd /Users/roverchen/Documents/Apps/vibe-coding-tw/functions
FIREBASE_CONFIG='{\"projectId\":\"e-learning-942f7\"}' GOOGLE_CLOUD_PROJECT=e-learning-942f7 \
node scripts/audit_assignment_guide_coverage.js --out=/tmp/assignment-guide-audit.json
```

可選參數：

- `--content-root=/Users/roverchen/Documents/Apps/content-repo/courses`
- `--out=/tmp/assignment-guide-audit.json`

## 報告欄位

- `matchedButMissingAssignmentGuideCount`
  - 已對到 `metadata_lessons` 的內容檔，但 HTML 裡找不到 `#assignment-guide`
- `unmatchedFilesCount`
  - 在 content repo 裡存在，但目前沒有對到 active `metadata_lessons` 的 HTML
- `activeLessonsMissingContentCount`
  - `metadata_lessons` 有這門課，但 content repo 找不到對應內容檔

## 解讀方式

- 如果 `matchedButMissingAssignmentGuideCount = 0`，表示內容本身沒有缺 `assignment-guide`
- 如果畫面仍顯示載入失敗，多半是 runtime 授權、路由或快取回退問題，不是內容缺頁
- `unmatchedFilesCount` 大量存在通常是正常現象，代表 content repo 裡有很多歷史或尚未掛進 dashboard 的課程檔
- 課程頁若已改用共用樣式分層（`course-base.css` / `course-components.css` / `course-quiz.css`），這不會改變本稽核的判定邏輯；本報告仍只看 HTML 內是否存在 `#assignment-guide`

## Current Baseline

以 2026-06-04 的 live 資料和 `content-repo/courses` 為準：

- `metadataLessonsCount`: `45`
- `htmlFilesCount`: `208`
- `matchedFilesCount`: `80`
- `unmatchedFilesCount`: `128`
- `matchedButMissingAssignmentGuideCount`: `0`
- `activeLessonsMissingContentCount`: `4`

這 6 個目前沒有對應內容檔的 active lesson，可以再收斂成較符合產品語意的邏輯分組：

- `product-esp32-c3`
  - 同一個商品 / 平台入口，已吸收 `car-intro` / `legacy-car-intro`
- `product-esp32-s3`
  - 同一個商品 / 平台入口，已吸收 `car-advanced` / `legacy-car-advanced`
- `spec-recommend-lite`
  - 規格建議頁，不是一般課程單元
- `spec-recommend-pro`
  - 規格建議頁，不是一般課程單元

這份 baseline 的重點是：

- `assignment-guide` 內容沒有缺頁
- 目前若 dashboard 還顯示 `⚠️ 無法載入 assignment-guide`，更可能是授權或抓取回退流程問題
- 這 6 筆不需要補內容，只要保留在 `metadata_lessons` 作為商品頁或規格頁即可

## How to handle `unmatchedFilesCount`

目前 `unmatchedFilesCount = 0`，因為前一輪已將 `metadata_lessons.courseUnits` 全數對齊到 content repo 的現有檔名。即使後續課程頁面將 shell/元件 CSS 抽成共用檔，這個數值也不會因此改變。

目前需要關注的只有這 4 筆非一般課程單元：

- `product-esp32-c3`
- `product-esp32-s3`
- `spec-recommend-lite`
- `spec-recommend-pro`

它們仍會被保留在 `metadata_lessons`，但不需要一般課程單元的 `assignment-guide`。

> 舊版說明：
> 以前 `unmatchedFilesCount = 128` 時，內容倉中存在大量歷史鏡像頁與雙語頁，當時它們是：
>
> - `en/`：64
> - `zh-TW/`：64
>
> 那批檔案已在單元檔名遷移後全部對齊，因此不再是現在的 baseline。
