# Course Management Runbook
**Last updated**: 2026-06-11

這份文件定義新課程從建立、修改到停用的標準操作方式，目標是讓課程內容、作業、Template repo、評分與 Firestore 資料保持一致。

## 1. 核心原則

1. Firestore 是課程主資料的來源。
2. `content-repo` 只負責課程 HTML 與頁面內容。
3. Template repo / student repo 只保留最小作業骨架與 workflow。
4. 評分規則集中放在 `public/graders`，不要分散到各個 repo。
5. 刪除課程時以「停用」為主，不以硬刪為主。
6. `metadata_lessons.docId` 建立後視為不可直接更改；若要換 ID，請複製成新課程再停用舊資料。

> 建議的 canonical course identity 仍以 `metadata_lessons.id` / `docId` 與 `courseKey` 為基礎；舊路徑與舊檔名只作相容用途。

> 目前可直接使用的 Admin 入口：
> - [`public/admin-courses.html`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/admin-courses.html)：課程主檔、多語內容、停用與價格表
> - [`public/admin-i18n.html`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/admin-i18n.html)：舊版雙語欄位維護入口（相容用途）

---

## 2. 課程 CRUD 欄位設計

下表是 Admin 後台在新增或修改課程時，建議至少支援的欄位。

| 欄位 | 必填 | 來源 / 寫入位置 | 說明 |
|---|---:|---|---|
| `id` / `docId` | 是 | Firestore `metadata_lessons` document ID | canonical lesson id，建立後不建議直接更改；若要變更，請複製成新課程再停用舊資料 |
| `courseKey` | 是 | Firestore `metadata_lessons` | locale-neutral 主鍵，例如 `car-starter-web-app` |
| `title` | 是 | Firestore `metadata_lessons` | 中文或預設語系標題 |
| `titleEn` | 否 | Firestore `metadata_lessons` | 英文標題（legacy / compatibility） |
| `summary` | 否 | Firestore `metadata_lessons` | 課程簡介 |
| `summaryEn` | 否 | Firestore `metadata_lessons` | 英文簡介（legacy / compatibility） |
| `description` / `descriptionEn` | 否 | Firestore `metadata_lessons` | 詳細描述與其英文相容欄位 |
| `coreContent` / `coreContentEn` | 否 | Firestore `metadata_lessons` | 核心條列與其英文相容欄位 |
| `i18n` | 否 | Firestore `metadata_lessons` | 多語內容主結構，key 為 locale，例如 `en`、`zh-TW`、`ja`；每個 locale 內可含 `title`、`summary`、`description`、`coreContent` |
| `track` | 是 | Firestore `metadata_lessons` | 例如 `common`、`car` |
| `level` | 是 | Firestore `metadata_lessons` | 例如 `starter`、`basic`、`advanced` |
| `category` | 是 | Firestore `metadata_lessons` | 課程分類，供 catalog 與路由使用 |
| `entryUnitId` | 是 | Firestore `metadata_lessons` | 課程入口單元，必須指向有效單元檔 |
| `courseUnits` | 是 | Firestore `metadata_lessons` | 跨單元 TAB 清單，只表示課程結構 |
| `contentRef` | 是 | Firestore `metadata_lessons` | 外部內容倉路徑，例如 `courses/zh-TW/car-starter-web-app.html` |
| `metadataType` | 是 | Firestore `metadata_lessons` | `course` / `product` / `legacy_product` |
| `productId` | 否 | Firestore `metadata_lessons` | 商品型 metadata 才需要 |
| `isPhysical` | 否 | Firestore `metadata_lessons` | 是否為實體商品 |
| `hiddenFromCatalog` | 否 | Firestore `metadata_lessons` | 是否從前台列表隱藏 |
| `isDeprecated` | 否 | Firestore `metadata_lessons` | 是否為廢止資料，保留歷史相容 |
| `dealerPrice` | 否 | runtime join 後顯示 | 只作回傳顯示，不做主定價來源 |
| `lessonId` | 視情況 | `dealer_price_books` | price book 對應 lesson 的 document ID |
| `salePrice` | 視情況 | `dealer_price_books` | 正式售價 |
| `promoPrice` | 視情況 | `dealer_price_books` | 促銷價 |
| `currency` | 視情況 | `dealer_price_books` | 例如 `TWD`、`USD` |
| `promoEffectiveFrom` | 視情況 | `dealer_price_books` | 促銷起始時間 |
| `promoEffectiveTo` | 視情況 | `dealer_price_books` | 促銷結束時間 |

### 2.1 不建議做成主操作欄位的資料

- `price`、`price_twd`、`price_usd`：只保留相容用途，不應作為新課程正式定價主來源。
- `githubClassroomUrl`、`githubClassroomUrls`：只保留舊流程相容，不要作為新資料主要欄位。
- `courseId`：只做顯示與歷史相容，不要作為新的主關聯鍵。

---

## 3. 新課程操作流程

### 3.1 新增課程

1. 先定 `courseKey`
   - 確認這門課的 canonical slug。
   - 先決定中文與英文內容是否共用同一組單元 slug。

2. 建立 `content-repo` 課程 HTML
   - 放入對應語系資料夾，例如 `courses/zh-TW/...`
   - 確認頁面包含 `window.UNITS`、`#sidebar-nav`、`#index-unit-list`
   - 補上 `assignment-guide` 與 `tutor-guide`

3. 建立或更新 Firestore `metadata_lessons`
   - 寫入 `id` / `docId`
   - 寫入 `courseKey`
   - 寫入 `entryUnitId`
   - 寫入 `courseUnits`
   - 寫入 `contentRef`
   - 補上 `track`、`level`、`category`

4. 建立 `dealer_price_books`
   - 補上 lesson 的正式價格與幣別
   - 若為促銷課程，設定 `promoPrice` 與有效區間
   - 沒有 price book 的課程視為不可販售
   - `docId` 不會因價格或文案調整而變更

5. 建立多語內容
   - 以 `i18n.en` 作為主體內容
   - 其他 locale 可在同一個課程對話框內一起維護
   - 舊有 `titleEn` / `summaryEn` / `descriptionEn` / `coreContentEn` 保留相容用途

6. 建立 template repo / student repo workflow
   - `.github/workflows/autograde-and-sync.yml` 保持最小化
   - 只呼叫中央 grader

7. 建立對應 grader
   - `public/graders/<unit>.sh` 放特殊規則
   - 無特例就走 `default.sh`

8. 驗證 Dashboard 與回寫
   - 確認課程頁可開啟
   - 確認作業入口可找到
   - 確認 `assignments.autoGrade*` 可回寫

### 3.2 修改課程

按修改範圍分流：

- 改內容：只改 `content-repo`
- 改結構：改 `metadata_lessons`
- 改多語：在同一個課程對話框內更新 `metadata_lessons.i18n`
- 改價格：改 `dealer_price_books`
- 改作業規格：改 `content-repo` 內的 `assignment-guide` / `tutor-guide`
- 改評分邏輯：改 `public/graders`
- 改作業骨架或 GitHub Actions：改 template repo / student repo workflow

### 3.3 停用課程

建議的停用方式：

- `hiddenFromCatalog = true`
- `isDeprecated = true`

不建議直接 hard delete，原因是該課程可能仍被：

- 訂單
- 作業紀錄
- 導師授權
- grader
- 舊 URL / 舊快取

引用。

### 3.4 硬刪除

只有在以下情況才考慮硬刪：

- 完全沒有訂單與作業紀錄
- 沒有授權與 tutor binding
- 沒有外部 content / repo 引用
- 只屬於草稿或測試資料

若任何關聯存在，請改用停用而不是刪除。

---

## 4. Firestore / content-repo / template repo / grader 對照表

| 面向 | Firestore | content-repo | template repo / student repo | `public/graders` |
|---|---|---|---|---|
| 課程主檔 | `metadata_lessons` | 課程 HTML 的內容源 | 不負責 | 不負責 |
| 課程入口 | `entryUnitId`、`courseUnits` | 單元頁面與 sidebar | 不負責 | 不負責 |
| 內容路徑 | `contentRef` | 真正存放課程 HTML 的路徑 | 不負責 | 不負責 |
| 作業說明 | 從課程 HTML 的 `assignment-guide` / `tutor-guide` 讀取 | 存放與維護 | 不負責 | 不負責 |
| 作業骨架 | 只保留關聯與授權資料 | 可附帶說明頁 | `.github/workflows/autograde-and-sync.yml` | 不負責 |
| 自動評分 | 只寫回結果到 `assignments` | 不負責 | 只觸發中央 grader | `run.sh` + 對應 unit grader |
| 評分結果 | `assignments.autoGrade*` | 不負責 | push 後寫回 | webhook 來源 |
| 價格 | `dealer_price_books` | 可在內容中顯示價格文案，但不得當來源 | 不負責 | 不負責 |
| 導師授權 | `users.tutorConfigs[unitId]` | 可顯示教學說明 | 不負責 | 不負責 |

### 4.1 變更時的判斷規則

- 若變更會影響「頁面內容」，優先改 `content-repo`
- 若變更會影響「課程是否可被找得到、能否授權、入口在哪裡」，改 Firestore
- 若變更會影響「學生 repo 如何觸發評分」，改 template repo
- 若變更會影響「怎麼算分」，改 `public/graders`

---

## 5. 建議驗收清單

1. `metadata_lessons.docId` 與 Firestore doc ID 一致，且建立後不直接改動。
2. `courseKey` 是 locale-neutral，且沒有跟檔名綁死。
3. `i18n.en` 至少存在，其他語言可按需求新增。
4. `contentRef` 指向正確 HTML。
5. `entryUnitId` 有效且屬於 `courseUnits`。
6. 課程 HTML 可讀到 `assignment-guide` 與 `tutor-guide`。
7. `dealer_price_books` 已建立且價格可查。
8. template repo 的 workflow 只呼叫中央 grader。
9. `public/graders` 有對應腳本或 fallback。
10. `assignments.autoGrade*` 可正常回寫。
11. `hiddenFromCatalog` / `isDeprecated` 能正確控制停用課程的前台顯示。

---

## 6. Related Docs

- [`docs/database.md`](./database.md)
- [`docs/platform-expansion-plan.md`](./platform-expansion-plan.md)
- [`docs/unit-repo-collaboration-workflow.md`](./unit-repo-collaboration-workflow.md)
- [`docs/autograde-full-automation.md`](./autograde-full-automation.md)
- [`docs/course-ui-runtime-spec.md`](./course-ui-runtime-spec.md)
- [`docs/examples/unit-contentref-mapping.csv`](./examples/unit-contentref-mapping.csv)
