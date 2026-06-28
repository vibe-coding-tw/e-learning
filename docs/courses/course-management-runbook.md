# Course Management Runbook
**Last updated**: 2026-06-13

這份文件定義新課程從建立、修改到停用的標準操作方式，目標是讓課程內容、作業、Template repo、評分與 Firestore 資料保持一致。

## 1. 核心原則

1. Firestore 是課程主資料的來源。
2. `content-repo` 只負責課程 HTML 與頁面內容。
3. Template repo / student repo 只保留最小作業骨架與 workflow。
4. 評分規則集中放在 `public/graders`，不要分散到各個 repo。
5. 刪除課程時以「停用」為主，不以硬刪為主。
6. `metadata_lessons.docId` 建立後視為不可直接更改；若要換 ID，請複製成新課程再停用舊資料。

> 建議的 canonical course identity 以 `metadata_lessons.id` / `docId` 為唯一主鍵；不要再另外維護獨立的 course-level key。
>
> 若要批次收斂既有課程資料，優先使用 [`functions/scripts/backfill_metadata_lessons_canonical_schema.js`](../../functions/scripts/backfill_metadata_lessons_canonical_schema.js)；預設只做 normalize，不會主動刪欄位，刪除舊欄位需顯式帶 `--delete=...`。

> 目前可直接使用的 Admin 入口：
> - [`public/courses-management.html`](/Users/roverchen/Documents/Apps/vibe-coding-tw/public/courses-management.html)：課程主檔、多語內容、停用與價格表

---

## 2. 課程 CRUD 欄位設計

下表是 Admin 後台在新增或修改課程時，建議至少支援的欄位。

| 欄位 | 必填 | 來源 / 寫入位置 | 說明 |
|---|---:|---|---|
| `id` / `docId` | 是 | Firestore `metadata_lessons` document ID | canonical lesson id，建立後不建議直接更改；若要變更，請複製成新課程再停用舊資料 |
| `i18n` | 是 | Firestore `metadata_lessons` | 多語內容主結構，key 為 locale，例如 `en`、`zh-TW`、`ja`；每個 locale 內只維護 `title`、`summary`、`description`、`coreContent` |
| `level` | 是 | Firestore `metadata_lessons` | 例如 `starter`、`basic`、`advanced` |
| `category` | 是 | Firestore `metadata_lessons` | 課程分類 canonical key，供 catalog、路由與學習路徑使用；建議使用 `common`、`car-starter`、`car-basic`、`car-advanced` |
| `orderWeight` | 是 | Firestore `metadata_lessons` | 課程排序權重，作為 catalog 與列表排序依據 |
| `course_units` | 是 | Firestore `metadata_lessons` | 外部課程單元檔案名稱清單，只表示課程結構 |
| `metadataType` | 是 | Firestore `metadata_lessons` | `course` / `product`；為主型別欄位。 |
| `docId` | 否 | Firestore `metadata_lessons` | 商品型 metadata 才需要；新流程請以 `docId` / Document ID 為主 |
| `isPhysical` | 否 | Firestore `metadata_lessons` | 相容欄位；一般由 `metadataType` 推導，`course=false`、`product=true` |
| `hiddenFromCatalog` | 否 | Firestore `metadata_lessons` | 是否從前台列表隱藏 |
| `isDeprecated` | 否 | Firestore `metadata_lessons` | 是否為廢止資料，保留歷史相容 |
| `dealerPrice` | 否 | runtime join 後顯示 | 只作回傳顯示，不做主定價來源 |
| `docId` | 視情況 | `dealer_price_books` | price book 對應 lesson 的 document ID |
| `salePrice` | 視情況 | `dealer_price_books` | 正式售價 |
| `promoPrice` | 視情況 | `dealer_price_books` | 促銷價 |
| `currency` | 視情況 | `dealer_price_books` | 例如 `TWD`、`USD` |
| `promoEffectiveFrom` | 視情況 | `dealer_price_books` | 促銷起始時間 |
| `promoEffectiveTo` | 視情況 | `dealer_price_books` | 促銷結束時間 |

### 2.1 不建議做成主操作欄位的資料

- `price`、`price_twd`、`price_usd`：只保留相容用途，不應作為新課程正式定價主來源。
- `githubClassroomUrl`、`githubClassroomUrls`：只保留舊流程相容，不要作為新資料主要欄位。
- `courseId`：只做顯示與歷史相容，不要作為新的主關聯鍵。
- `legacy product ID`：只保留商品型相容；新資料請直接寫 `docId` / Document ID。

---

## 3. 新課程操作流程

### 3.1 新增課程

1. 先定 `docId`
   - 確認這門課的 canonical key，若需要可讀 slug，請直接整合進 document ID。
   - 先決定中文與英文內容是否共用同一組 `course_units`。

2. 建立 `content-repo` 課程 HTML
   - 放入對應語系資料夾，例如 `courses/zh-TW/...`
   - 確認頁面包含 `window.UNITS`、`#sidebar-nav`、`#index-unit-list`
   - 補上 `assignment-guide` 與 `tutor-guide`

3. 建立或更新 Firestore `metadata_lessons`
   - 寫入 `id` / `docId`
   - 寫入 `i18n`
   - 寫入 `course_units`
   - 補上 `level`、`category`、`orderWeight`
   - `category` 優先使用 `common`、`car-starter`、`car-basic`、`car-advanced`

4. 建立 `dealer_price_books`
   - 補上 lesson 的正式價格與幣別
   - 若為促銷課程，設定 `promoPrice` 與有效區間
   - 沒有 price book 的課程視為不可販售
   - `docId` 不會因價格或文案調整而變更

5. 建立多語內容
   - 以 `i18n.en` 作為主體內容
   - 其他 locale 可在同一個課程對話框內一起維護
   - 舊有 `titleEn` / `summaryEn` / `descriptionEn` / `coreContentEn` 只保留過渡讀取相容，不再由新表單寫入

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
- 批次收斂既有資料：使用 [`functions/scripts/backfill_metadata_lessons_canonical_schema.js`](../../functions/scripts/backfill_metadata_lessons_canonical_schema.js)
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
| 課程入口 | `course_units[0]`（或兼容 `entryUnitId`） | 單元頁面與 sidebar | 不負責 | 不負責 |
| 內容路徑 | `contentRef`（相容欄位） | 真正存放課程 HTML 的路徑 | 不負責 | 不負責 |
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
2. `docId` 若承載課程 key，必須保持唯一且可追溯。
3. `i18n.en` 至少存在，其他語言可按需求新增。
4. `course_units` 指向正確外部 HTML。
5. 若仍保留 `entryUnitId`，其值必須等於 `course_units[0]`。
6. `title` / `summary` / `description` 已可由 `i18n` 取代，舊欄位僅作過渡相容。
7. 課程 HTML 可讀到 `assignment-guide` 與 `tutor-guide`。
8. `dealer_price_books` 已建立且價格可查。
9. template repo 的 workflow 只呼叫中央 grader。
10. `public/graders` 有對應腳本或 fallback。
11. `assignments.autoGrade*` 可正常回寫。
12. `hiddenFromCatalog` / `isDeprecated` 能正確控制停用課程的前台顯示。

---

## 7. 課程授權與開通機制 (Course Authorization & Enablement)

本平台採用 Firestore 為唯一授權來源（Firestore First），任何單元的讀取或作業派發，在後端都會透過 `checkOrderAccessForUnit` 進行動態開通與權限驗證。

目前「課程是否已開通」的設定總表請優先參考：

- [`docs/courses/course-activation-settings.md`](./course-activation-settings.md)
- [`docs/database.md`](../database.md)

### 7.1 系統開通/授權的四大途徑

學員或使用者符合以下任一條件，系統即視為「已開通/授權」該單元：

1. **免費課程 (Free Course)**：
   - 該單元對應之課程在 `dealer_price_books` 中設定的價格 `<= 0`。
2. **新手 30 天體驗期 (Trial Access)**：
   - 單元屬於入門級別（`level` 為 `starter`，或 `category` 為 `car-starter`，或 `docId` 以 `car-starter-` 開頭）。
   - 學員帳號建立時間（Auth `creationTime` 或 User 文件的註冊時間）距離當前時間小於 **30 天**。
3. **付費訂單開通 (Active Paid Order)**：
   - `orders` 集合中存在該學員對應此課程且狀態為 `SUCCESS` 的訂單。
   - 訂單的 `expiryDate` 未過期（或未設定代表永久有效）。
4. **導師測試開通 (Qualified Tutor)**：
   - 使用者開啟 `tutorMode`，且在**目標單元**的 `users.tutorConfigs[unitId].authorized === true`。
   - `tutorMode` 只是切換導師測試路徑，不代表全站授權。
   - 管理員在後台的模擬路徑是獨立的測試機制，不代表一般學員的授權規則。

### 7.2 付款後自動開通與驗證流程 (Post-Payment Activation)

當金流通知成功付款（`paymentNotify`）時，系統會觸發以下自動開通流程：

1. **數位內容驗證**：
   - 後端解析訂單內項目，確認每門數位課程具備對應的 `courseUnits`。
   - 透過 `checkOrderAccessForUnit` 模擬首次開通授權。
   - 驗證成功後，在訂單寫入 `activationValidated: true`、`activationValidationStatus: "passed"`，並記錄 `activationCheckedItems`。
   - 若發生異常（例如課程無單元定義），會標記為 `failed` 並寫入 `activationAlerts` 同步告警 Admin。
2. **權限與購買快取同步 (Purchase Cache Sync)**：
   - 調用 `syncUserPurchaseCacheFromOrder`，將購買狀態寫入 `users` 集合（例如 `hasStarterAccess = true`、`lastPaidOrderId` 等）。
3. **導師與推薦關係綁定 (Tutor Binding)**：
   - 檢查訂單中是否有帶入推薦關係或作業連結。
   - 若有，自動在學員 User 文件的 `unitAssignments` 寫入對應單元的導師 Email。

### 7.3 開通判定時實際會看的欄位

- `metadata_lessons.id` / `docId`
- `metadata_lessons.courseUnits`
- `metadata_lessons.category`
- `metadata_lessons.level`
- `dealer_price_books.docId`
- `dealer_price_books.salePrice` / `promoPrice`
- `orders.uid`
- `orders.status`
- `orders.expiryDate`
- `orders.items`
- `users.createdAt` / `users.joinedAt`
- `users.paid`
- `users.hasStarterAccess`
- `users.lastPaidOrderId`

注意：

- `users.paid`、`users.hasStarterAccess`、`users.lastPaidOrderId` 屬於派生快取，不是主授權來源。
- 真正的授權判斷仍以 `checkOrderAccessForUnit` / `checkPaymentAuthorization` 的共用邏輯為準。
- 若課程卡片顯示不對，先確認前端送出的 `docId` / `pageId` / `fileName` 是否能對回 `metadata_lessons`。

---

## 8. Related Docs

- [`docs/database.md`](../database.md)
- [`docs/platform-expansion-plan.md`](./platform-expansion-plan.md)
- [`docs/unit-repo-collaboration-workflow.md`](./unit-repo-collaboration-workflow.md)
- [`docs/autograde-full-automation.md`](./autograde-full-automation.md)
- [`docs/course-ui-runtime-spec.md`](./course-ui-runtime-spec.md)
- [`docs/examples/unit-contentref-mapping.csv`](../examples/unit-contentref-mapping.csv)
