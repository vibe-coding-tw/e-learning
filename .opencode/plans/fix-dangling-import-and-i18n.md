# Fix Dangling Import + i18n Region/Distributor Labels

> ✅ **已完成** (2026-07-02) — 所有 5 個 fix 均已套用。

## Fix 1: Remove dangling import in `functions/index.js`

**File**: `functions/index.js:19-21`

Remove the unused `registerAdminExports` import:

```diff
 const {
     registerIndexExports
 } = require('./lib/index-export-registry');
-const {
-    registerAdminExports
-} = require('./lib/index-export-admin');
 const {
     initializeFunctionsRuntime
 } = require('./lib/functions-bootstrap');
```

---

## Fix 2: Convert `localizeDistributorName` to `window.t()` in `cart.html:289-300`

**File**: `public/cart.html`

Replace the hardcoded `isEn` map with i18n key lookups:

```diff
         function localizeDistributorName(name) {
             if (!name) return '';
             const key = String(name).trim();
             const map = {
-                '預設台幣經銷商': 'Default TWD Distributor',
-                '預設美金經銷商': 'Default USD Distributor',
-                'default-twd': 'Default TWD Distributor',
-                'default-usd': 'Default USD Distributor'
+                '預設台幣經銷商': 'dist_name_default_twd',
+                '預設美金經銷商': 'dist_name_default_usd',
+                'default-twd': 'dist_name_default_twd',
+                'default-usd': 'dist_name_default_usd'
             };
-            if (isEn && map[key]) return map[key];
-            return name;
+            const i18nKey = map[key];
+            return i18nKey ? window.t(i18nKey, name) : name;
         }
```

---

## Fix 3: Convert `localizeRegionLabel` to `window.t()` in `cart.html:302-315`

**File**: `public/cart.html`

Replace the `isEn ? 'EN' : 'ZH'` ternary map:

```diff
         function localizeRegionLabel(region) {
             if (!region) return '';
             const key = String(region).trim().toUpperCase();
             const map = {
-                'TW': isEn ? 'TW / Taiwan' : 'TW / 台灣',
-                'US': isEn ? 'US / United States' : 'US / 美國',
-                'CA': isEn ? 'CA / Canada' : 'CA / 加拿大',
-                'JP': isEn ? 'JP / Japan' : 'JP / 日本',
-                'SG': isEn ? 'SG / Singapore' : 'SG / 新加坡',
-                'HK': isEn ? 'HK / Hong Kong' : 'HK / 香港',
-                'MY': isEn ? 'MY / Malaysia' : 'MY / 馬來西亞'
+                'TW': 'region_label_tw',
+                'US': 'region_label_us',
+                'CA': 'region_label_ca',
+                'JP': 'region_label_jp',
+                'SG': 'region_label_sg',
+                'HK': 'region_label_hk',
+                'MY': 'region_label_my'
             };
-            return map[key] || region;
+            const i18nKey = map[key];
+            return i18nKey ? window.t(i18nKey, region) : region;
         }
```

---

## Fix 4: Add i18n keys to `i18n-helper.js`

**File**: `public/js/i18n-helper.js`

After the last `routing_reason_unknown` key in the zh-TW section (line ~304), add:

```js
            "dist_name_default_twd": "預設台幣經銷商",
            "dist_name_default_usd": "預設美金經銷商",
            "region_label_tw": "TW / 台灣",
            "region_label_us": "US / 美國",
            "region_label_ca": "CA / 加拿大",
            "region_label_jp": "JP / 日本",
            "region_label_sg": "SG / 新加坡",
            "region_label_hk": "HK / 香港",
            "region_label_my": "MY / 馬來西亞",
```

After the same keys in the English section, add:

```js
            "dist_name_default_twd": "Default TWD Distributor",
            "dist_name_default_usd": "Default USD Distributor",
            "region_label_tw": "TW / Taiwan",
            "region_label_us": "US / United States",
            "region_label_ca": "CA / Canada",
            "region_label_jp": "JP / Japan",
            "region_label_sg": "SG / Singapore",
            "region_label_hk": "HK / Hong Kong",
            "region_label_my": "MY / Malaysia",
```

---

## Fix 5: Re-run fingerprint

```
node scripts/fingerprint-static-assets.js
```
