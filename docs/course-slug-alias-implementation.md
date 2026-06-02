# 課程 Alias 實作方案

這份文件說明如何在不破壞現有路由與資料相容性的前提下，逐步把課程檔名從 `tw-` / `en-` 前綴遷移到語系中立 slug。

## 目標

- 保留舊網址可用
- 讓新內容使用 canonical slug
- 讓 Firestore、前端、grader、同步腳本都讀同一份映射

## 建議架構

### 1. 檔案層

每個 canonical slug 對應兩個語系版本：

- `courses/zh-TW/<canonical>.html`
- `courses/en/<canonical>.html`

舊的 `tw-<canonical>.html`、`en-<canonical>.html` 只當 alias。

### 2. 路由層

需要一層 mapping resolver：

- 輸入 legacy slug 時，先轉成 canonical slug
- 再依 locale 決定實際檔案路徑
- 找不到 canonical 時，再 fallback legacy 檔名

### 3. Firestore 層

建議欄位：

- `courseSlug`: canonical slug
- `legacyCourseIds`: 舊版 id 陣列
- `entryUnitId`: canonical entry page
- `aliases`: 路由 alias map

### 4. 同步腳本

需要處理的腳本：

- `functions/scripts/seed-emulator.js`
- `functions/scripts/update_prepare_lessons.js`
- `functions/scripts/migrate_lessons_classroom_urls.js`
- `functions/scripts/normalize_runtime_canonical_fields.js`
- `functions/scripts/normalize_referral_links_unit_ids.js`
- `functions/scripts/audit_canonical_runtime_state.js`

## 遷移策略

### Phase 1: 增加 alias，不改現有內容

- 先新增 canonical 檔案
- 舊檔案維持不動
- 路由與資料讀取雙向相容

### Phase 2: 讓新資料只寫 canonical

- 新課程、更新課程、價格欄位都只寫 canonical
- 舊欄位只作 fallback

### Phase 3: 清除 legacy 依賴

- 移除 grader 與 script 中的 legacy mapping
- 清理 Firestore 中不再需要的舊欄位

### Phase 4: 刪除舊 alias

- 確認歷史連結、SEO、外部引用都完成轉換後，再移除舊檔名

## 建議實作方式

最安全的做法不是直接 rename，而是：

1. 新增 canonical 檔名
2. 舊檔名回傳 301 / rewrite
3. 前端導覽與後端查詢都改用 canonical slug
4. 等資料全數切換完成後，再刪掉 legacy 檔名

## 風險控管

- 每次改名都要保留 fallback
- 每次切換都要有 mapping 表可追
- 每次部署後都要驗證：
  - 課程頁可開
  - `learning-path.html` 可列出課程
  - `checkPaymentAuthorization` 可正常授權
  - grader 可找到對應單元
