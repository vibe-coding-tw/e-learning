# Course UI Runtime Specification
**Updated**: 2026-06-25 (FAB mobile auto-hide)

本文件定義 `/courses/**` 課程內容頁的正式 UI 規格、元件責任邊界、資料來源與驗收方式。

> 核心原則：上方課程 shell 由平台提供；單元內頁面結構由課程 HTML 提供。平台不得把跨單元資料覆寫成單元內 page menu。

## 1. UI Information Architecture

課程頁分為兩個不同層級，不得混用：

| 層級 | UI 元件 | 資料來源 | 用途 |
|---|---|---|---|
| 跨單元層級 | 上方 TAB | Firestore `metadata_lessons.courseUnits` 與 `courseUnitTitles` | 在同一課程的不同單元 HTML 之間切換 |
| 單元內層級 | 左側 page menu / sidebar | 當前課程 HTML 的 `window.UNITS`、`#sidebar-nav` 與頁面 sections | 在目前單元內切換課程總覽與各教學頁面 |

強制規則：

- TAB 可以由 Firestore 動態建立。
- 左側 page menu 必須由目前課程 HTML 定義。
- 課程 runtime 的單元路由、授權入口與 TAB 定位只能使用 `metadata_lessons.courseUnits`；`courseId`、`courseKey`、`entryUnitId` 僅允許作歷史相容資料，不得參與執行期查找。
- 跨單元 TAB 僅在同一課程的 `courseUnits` 至少有 2 個有效單元時顯示；單一單元課程不得渲染 tabs。
- `course-shared.js` 不得使用 `metadata_lessons.courseUnits` 覆寫 `window.UNITS`、`#sidebar-nav` 或 `#index-unit-list`。
- 左側 page menu 不得重複顯示上方 TAB 的單元清單。
- `courseUnits` 表示跨單元結構，不表示單元內頁面。

課程開通與 CTA 判定的對應設定，請另參考 [`docs/courses/course-activation-settings.md`](./course-activation-settings.md)。

## 2. Required Course Shell

所有正式課程內容頁都必須具有以下 UI：

| 元件 | 必要行為 |
|---|---|
| `.ms-topnav` | 顯示品牌、課程家族、Firestore 課程名稱與語言選項 |
| `.unit-tabs-wrapper` | 顯示同一課程內的跨單元 TAB；目前單元需有 active 狀態 |
| `.ms-sidebar` | 顯示目前單元的 page menu，不得顯示跨單元列表 |
| `.ms-breadcrumb` | 顯示目前課程與目前頁面位置 |
| `#dashboard-fab` | 開啟目前單元的 dashboard；明確排除頁面或 media mode 除外。Mobile 上頁面滾至底部 150px 內時自動隱藏（避免擋住下一頁按鍵），往上滾再出現 |
| 語言選單 | 可切換內容語系，並保留目前課程位置與必要 query state |

缺少任一必要元件，都視為 course shell 未完整載入，不得以隱藏元件或縮減功能作為修復。

## 3. Component Ownership

### 3.1 Content HTML Owns

外部 `content-repo` 的目前單元 HTML 負責：

- 單元內容與 sections
- `window.UNITS`
- `#sidebar-nav` 的單元內頁面清單
- `#index-unit-list`
- `goToUnit()` 與目前單元內頁面切換
- 單元內頁面標題、時間、內容與完成狀態

### 3.2 `course-shared.js` Owns

`public/js/course-shared.js` 負責：

- 補齊與規格化 `.ms-topnav`
- 建立跨單元 TAB
- 補齊與規格化 breadcrumb
- 補齊 dashboard FAB 與 dashboard modal
- 語言選單與語系切換
- 共用課程樣式、響應式行為、media overlay、作業入口與進度整合
- 根據 topnav 與 TAB 實際高度調整 sidebar 可用高度

`course-shared.js` 可以修改 sidebar 的共用樣式，但不得改寫 sidebar 的課程頁面資料。

`.ms-topnav` 的課程名稱必須直接使用目前 course metadata 的 `title` / `titleEn`；不得顯示目前單元名稱，也不得用檔名或硬編碼 mapping 猜測課程名稱。

`course-shared.js` 與 `learning-path.html` 只可把 `courseUnits` 視為課程結構與單元入口的唯一來源；其他欄位若還存在，只能作為歷史回傳或 migration 盤點用途。

### 3.3 `serveCourse` Owns

`functions-payment/index.js` 的 `serveCourse` 負責：

- 驗證課程 access token
- 從 content runtime 取得正確課程 HTML
- 在送出 HTML 前確保課程 runtime scripts 已載入
- 將既有穩定 script URL 正規化成目前 runtime version URL，避免 CDN 舊快取
- 設定必要的 private/no-store response headers

`serveCourse` 不得自行產生課程內容、TAB 資料或 page menu 資料。

## 4. Layout Rules

### Desktop

- topnav 固定於頁面頂部。
- TAB 固定於 topnav 下方。
- sidebar 固定於 topnav 與 TAB 下方。
- sidebar 高度必須扣除 topnav 與 TAB 的實際高度。
- sidebar header 與底部進度區固定；中間 page menu 可獨立垂直捲動。
- 主內容不得被 sidebar、TAB 或 topnav 遮住。

### Mobile

- sidebar 可改為抽屜或隱藏於 toggle 後，但 page menu 功能不可消失。
- topnav、語言選項、TAB 與 dashboard 入口仍需可操作。
- TAB 可水平捲動，不得因螢幕寬度不足而截斷或換行破版。

## 5. Navigation Rules

- TAB 點擊必須走授權流程並使用該單元實際 dealer price，不得無條件附加 `price=0`。
- 沒有 price book 資料的課程不得被當成免費課程。
- 免費課程需要使用者先登入，登入後才可進入課程內容。
- 非免費課程在未登入狀態下仍可加入購物車；不得強迫使用者先登入才能加入購物車。
- 結帳或進入付費課程內容時，再依付款與登入流程執行必要驗證。
- page menu 點擊只切換目前單元內頁面，不得重新導向其他課程單元。
- breadcrumb 必須反映目前單元與目前 page menu 頁面。
- 語言切換只改內容與 UI 語系，不得改變 dealer price 或幣別來源。

## 5.1 Learning-Path Distributor Source

`public/learning-path.html` 在讀取課程清單與價格時，必須遵守下列優先序：

1. 若使用者已登入，優先讀取 Firestore `users/{uid}` 的 `preferredDistributorId`。
2. 若 Firestore 沒有 `preferredDistributorId`，再退回 `users/{uid}.distributorId` 或 `commercial.distributorId`。
3. 若上述欄位皆不存在，再依 `preferredRegion` / `region` 推導 `default-twd` 或 `default-usd`。
4. 僅在未登入時才退回本機 `localStorage` 的 distributor 偏好。

這條規則的目的，是避免舊的 localStorage 值覆蓋 Firestore 上的正式 routing 偏好，導致價格顯示與實際使用者地區不一致。

## 5.2 Learning-Path Label Source

`public/learning-path.html` 的頁面標題與 `nav-component.js` 的 learning-path 下拉選單標籤，必須使用同一份 Firestore `metadata_settings/learning_paths.categoryLabels`，並且以同一個 locale 決定顯示字串。

實作規則：

1. `nav-component.js` 先解析目前 locale，再從 `metadata_settings/learning_paths.categoryLabels` 取對應的 canonical path label。
2. `learning-path.html` 必須讀取同一份 `categoryLabels`，並與 nav 共用相同的 label resolver。
3. 若頁面尚未載入或無法取得 Firestore，前後端都應保持空白或未設定狀態，不得使用任何本地 fallback。
4. `window.__vibeLocale` 可作為同頁共用 locale 狀態，但不得作為分類 label 的來源或快取。

驗收重點：

- 中文版與英文版的 learning-path H1、`document.title`、nav dropdown label 必須一致。
- `common`、`car-starter`、`car-basic`、`car-advanced` 都應對應 `metadata_settings/learning_paths.categoryLabels` 的同一組 canonical key。
- 不得以 `titleizeCategoryKey()`、檔名推導，或單頁 local fallback 取代 Firestore 的分類字典。

## 6. Runtime And Cache Rules

- 課程 HTML 必須載入 `/js/course-shared.js` 與 `/js/nav-component.js`。
- `serveCourse` 注入 runtime script 時必須使用明確版本參數，避免 CDN 舊快取讓已部署修復無效。
- 修改 `public/js/*` 後必須執行 `node scripts/fingerprint-static-assets.js` 並部署 hosting。
- 修改 `serveCourse` 注入、授權或 content runtime 行為後，必須部署 `functions:payment:serveCourse`。
- 修改外部課程 HTML 後，必須更新 Firestore `contentVersion` 使內容快取失效。
- 不得將帶 hash 的靜態檔案當作 source 手動編輯。
- 本文件所述的 runtime 規格以正式環境為準；若只為 local emulator 相容性修正，必須維持正式資料來源、授權流程與 shell 結構不變，並優先使用與正式環境同源的 callable / adapter 路徑處理本地差異。

## 7. Prohibited Implementations

- 禁止用 `metadata_lessons.courseUnits` 覆寫 `window.UNITS`。
- 禁止由平台層直接重建 `#sidebar-nav` 或 `#index-unit-list`。
- 禁止以硬編碼 course ID / filename mapping 猜測 UI 結構。
- 禁止用 legacy fallback 隱藏缺失的 topnav、TAB、sidebar、breadcrumb、語言選單或 FAB。
- 禁止因 shell 節點缺失而默默隱藏必要 UI。
- 禁止同一課程頁顯示重複 global nav 或重複 course shell。
- 禁止讓 CDN 舊快取成為修復是否生效的不確定因素。

## 8. Acceptance Checklist

每次調整課程 UI、content runtime 或 `serveCourse` 後，至少驗證：

- topnav 顯示品牌、課程家族、Firestore 課程名稱與語言選單。
- 未登入時，免費課程顯示登入 CTA；非免費課程顯示加入購物車 CTA。
- TAB 顯示跨單元清單，且 active 單元正確。
- sidebar 顯示目前單元內頁面，不與 TAB 重複。
- sidebar page menu 可完整捲動，header 與進度區仍可見。
- breadcrumb 顯示目前位置。
- FAB 顯示且可開啟目前單元 dashboard。
- 語言切換保留目前單元位置。
- TAB 切換通過授權與 dealer price 規則。
- desktop 與 mobile 均可操作。
- 正式站 runtime script 為本次部署版本，而不是 CDN 舊快取。

## 9. Related Files

- `../../AGENT.md`
- [`public/js/course-shared.js`](../../public/js/course-shared.js)
- [`public/js/nav-component.js`](../../public/js/nav-component.js)
- [`functions-payment/index.js`](../../functions-payment/index.js)
- [`docs/legacy-and-backlog.md`](./legacy-and-backlog.md)
- [`docs/platform-expansion-plan.md`](./platform-expansion-plan.md)
- [`docs/database.md`](../database.md)
