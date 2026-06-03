# 課程 Slug 命名規則

這份文件定義未來課程檔名的標準，目標是讓多國語言內容在命名上保持一致，並減少 `tw-` / `en-` 這類語系前綴對系統的耦合。

## 原則

1. 語系責任只放在資料夾層級。
2. 檔名本身使用語系中立 slug。
3. 舊的 `tw-` / `en-` 檔名只作 alias，不再當成新命名標準。
4. Firestore、前端路由、grader、同步腳本都要讀同一個 canonical slug。

## 建議目錄結構

```text
courses/
  zh-TW/
    common-developer-identity.html
    car-starter-html5-basics.html
  en/
    common-developer-identity.html
    car-starter-html5-basics.html
```

## 命名格式

### 語系目錄

- `zh-TW`：繁體中文內容
- `en`：英文內容

### 檔名 slug

- 使用語系中立的 canonical slug
- 保留課程層級與單元層級的語意，但不再塞語系代碼
- 範例：
  - `common-developer-identity.html`
  - `common-web-agents.html`
  - `car-starter-html5-basics.html`
  - `car-basic-h-bridge.html`
  - `car-advanced-pid-control.html`

## 既有前綴如何處理

舊命名：

- `common-developer-identity.html`
- `common-developer-identity.html`

新命名：

- `courses/zh-TW/common-developer-identity.html`
- `courses/en/common-developer-identity.html`

### 相容層

舊檔名不會立刻刪除，而是作為 alias：

- 舊路由繼續可用
- 內部導覽、授權、付款、grader 逐步改讀 canonical slug
- 舊資料欄位仍可保留一段時間，用 migration 腳本做轉換

## 例外

以下情況可以暫時保留舊前綴：

- 尚未完成雙向 alias 的課程
- 被外部系統直接引用、且短期內不能改的檔案
- 歷史備查文件或 migration 用 sample

## 實作順序

1. 新增 canonical 檔名。
2. 在舊檔名加入 301 / rewrite alias。
3. Firestore 內同時存 canonical slug 與 legacy alias。
4. 前端與後端優先使用 canonical slug。
5. 確認所有外部依賴改完，再移除舊檔名。
