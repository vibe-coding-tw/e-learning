# Remaining Improvements — Phase 1

> ✅ **已完成** (2026-07-02) — 所有 A1-A3、B1-B2、C 均已套用。

## A1: Remove dead `Object.assign` in `functions-payment/index.js`

**File**: `functions-payment/index.js:525`

```diff
-Object.assign(exports, financeCallables);

 module.exports = {
```

`...financeCallables` is already spread on the `module.exports` literal two lines later.

---

## A2: Remove dead `HttpsError` threading chain

### A2a: `functions/index.js:1`

```diff
-const { onCall, HttpsError } = require("firebase-functions/v2/https");
+const { onCall } = require("firebase-functions/v2/https");
```

### A2b: `functions/lib/index-export-registry.js:6,14`

Remove `HttpsError` from the destructured parameter and the `registerIndexExports` call site:

```diff
 const registerIndexExports = ({
     target,
     proxyAutogradeCallable,
     proxyAutogradeRequest,
     proxyPaymentCallable,
     proxyAdminCallable,
     proxyAdminRequest,
     onCall,
-    HttpsError,
     createOnUserCreatedTrigger,
     createMapReplyHandler
 }) => {
```

### A2c: `functions/lib/index-export-autograde.js:5`

```diff
-const registerAutogradeExports = ({ target, proxyAutogradeCallable, proxyAutogradeRequest, onCall, HttpsError }) => {
+const registerAutogradeExports = ({ target, proxyAutogradeCallable, proxyAutogradeRequest, onCall }) => {
```

---

## A3: Move mid-file imports to top in `functions-autograde/index.js`

**File**: `functions-autograde/index.js`

Move lines 830-833 (`execSync`, `fs`, `path`, `https`) to end of the top import block (after line 47):

```diff
+const { execSync } = require("child_process");
+const fs = require("fs");
+const path = require("path");
+const https = require("https");
 const GitHubAPIHelper = require("./github-api-helper");
```

And remove the originals at lines 830-833:

```diff
-const { execSync } = require("child_process");
-const fs = require("fs");
-const path = require("path");
-const https = require("https");
-
 function downloadFile(url, destPath) {
```

---

## B1: i18n for `public/courses-management.html` alert() calls

**File**: `public/courses-management.html`

Replace 7 hardcoded `alert()` calls:

| Line | Old | New |
|------|-----|-----|
| 1498 | `alert("請輸入單元檔名。");` | `alert(window.t('alert_enter_filename', '請輸入單元檔名。'));` |
| 1928 | `alert("請先選擇一門課程。");` | `alert(window.t('alert_select_course_first', '請先選擇一門課程。'));` |
| 1951 | `alert("請先儲存課程後，再調整可見性。");` | `alert(window.t('alert_save_course_first', '請先儲存課程後，再調整可見性。'));` |
| 1983 | `` alert(`儲存課程失敗：${err.message}`); `` | `` alert(window.t('alert_save_course_failed', '儲存課程失敗：{msg}').replace('{msg}', err.message)); `` |
| 2011 | `alert("請先儲存課程後，再建立價格表。");` | `alert(window.t('alert_save_course_first', '請先儲存課程後，再建立價格表。'));` (reuse key from 1951) |
| 2026 | `` alert(`儲存價格表失敗：${err.message}`); `` | `` alert(window.t('alert_save_price_failed', '儲存價格表失敗：{msg}').replace('{msg}', err.message)); `` |
| 2044 | `` alert(`載入價格表失敗：${err.message}`); `` | `` alert(window.t('alert_load_price_failed', '載入價格表失敗：{msg}').replace('{msg}', err.message)); `` |

Also add i18n keys to `public/js/i18n-helper.js`:

zh-TW section (before `"alert_cart_empty"` block):
```js
"alert_enter_filename": "請輸入單元檔名。",
"alert_select_course_first": "請先選擇一門課程。",
"alert_save_course_first": "請先儲存課程後，再調整可見性。",
"alert_save_course_failed": "儲存課程失敗：{msg}",
"alert_save_price_failed": "儲存價格表失敗：{msg}",
"alert_load_price_failed": "載入價格表失敗：{msg}",
```

en section:
```js
"alert_enter_filename": "Please enter a unit filename.",
"alert_select_course_first": "Please select a course first.",
"alert_save_course_first": "Please save the course first.",
"alert_save_course_failed": "Failed to save course: {msg}",
"alert_save_price_failed": "Failed to save price book: {msg}",
"alert_load_price_failed": "Failed to load price book: {msg}",
```

---

## B2: i18n for `public/investor-portal.html` hardcoded strings

**File**: `public/investor-portal.html:207-213`

Replace 4 hardcoded strings with reusable i18n keys (keys already exist in `i18n-helper.js`):

```diff
-if (deniedTitle) deniedTitle.innerText = '👋 您好！閣下尚未登入';
+if (deniedTitle) deniedTitle.innerText = window.t('dash_hello_guest', '👋 您好！閣下尚未登入');

-if (deniedMsg) deniedMsg.innerText = '本頁面為投資人入口，請登入以查看您的資訊。';
+if (deniedMsg) deniedMsg.innerText = window.t('investor_denied_guest_msg', '本頁面為投資人入口，請登入以查看您的資訊。');

-if (deniedTitle) deniedTitle.innerText = '⛔ 權限不足';
+if (deniedTitle) deniedTitle.innerText = window.t('dash_denied_title', '⛔ 權限不足');

-if (deniedMsg) deniedMsg.innerText = '只有管理員或投資人可以訪問此頁面。';
+if (deniedMsg) deniedMsg.innerText = window.t('investor_denied_msg', '只有管理員或投資人可以訪問此頁面。');
```

Add 2 new i18n keys to `i18n-helper.js`:

zh-TW:
```js
"investor_denied_guest_msg": "本頁面為投資人入口，請登入以查看您的資訊。",
"investor_denied_msg": "只有管理員或投資人可以訪問此頁面。",
```

en:
```js
"investor_denied_guest_msg": "This is the investor portal. Please log in to view your information.",
"investor_denied_msg": "Only admins or investors can access this page.",
```

---

## C: Fingerprint

```
node scripts/fingerprint-static-assets.js
```

---

## Order of Execution

1. A1 + A2 + A3 (parallel — independent files)
2. B1 + B2 (parallel — independent files)
3. Re-run fingerprint
4. (Phase 2: dashboard.js will be a separate plan)

## Verification

After all changes:
- `grep -rn "HttpsError" functions/index.js functions/lib/index-export-registry.js functions/lib/index-export-autograde.js` — should only find zero mentions
- `grep -n 'alert("' public/courses-management.html` — should only find `window.t(` wrapped calls
- `grep -c "investor_denied" public/js/i18n-helper.js` — should be 4 (2 zh-TW + 2 en)
