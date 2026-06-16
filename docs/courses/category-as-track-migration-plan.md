# Category-as-Track Migration Plan
**Last updated**: 2026-06-14

> Historical note: this migration has now been applied in the canonical schema. `metadata_lessons` 目前已改為 `category` + `orderWeight` 為主，`track` 只保留在舊資料與相容流程的歷史脈絡中。

這份文件描述一條較激進的收斂路線：讓 `category` 承擔原本 `track` 的分類角色，最後逐步移除 `metadata_lessons.track`。

這條路線可以做，但**不能直接刪 `track`**。  
原因是目前前台、後台、授權與匯入流程都還在讀它。

---

## 1. Goal

目標是把課程分類鍵收斂成更少的欄位，最終讓：

- `category` 承擔「課程家族 / 路徑識別」
- `level` 承擔「層級」
- `track` 只在遷移期間保留，最後停用

建議最後的語意長這樣：

- `category = common | car-starter | car-basic | car-advanced`
- `level = starter | basic | advanced | common`
- `track` 僅作過渡相容欄位

---

## 2. Why `category` Can Work

如果把 `category` 提升成複合分類鍵，它可以承接目前 `track` 的角色，因為：

- 前台學習路徑本來就用 `track + level` 組路徑
- `category` 已經被 catalog 與路由讀取
- `categoryLabels` 已經是前台分類標籤的來源之一

但要注意：

- `category` 現在在很多地方仍偏向「粗分類」
- 若要取代 `track`，必須把 `category` 變成更精確的 canonical key
- 不能讓 `category = car` 繼續同時代表 starter/basic/advanced 三條線，否則會失去分組能力

---

## 3. Recommended Final Schema

如果真的要收斂，建議最後定成：

```json
{
  "category": "car-starter",
  "level": "starter"
}
```

或：

```json
{
  "category": "car-basic",
  "level": "basic"
}
```

對 `common` 線則可用：

```json
{
  "category": "common",
  "level": "common"
}
```

這樣前台就可以直接用 `category` 當路徑鍵，不必再依賴 `track`。

---

## 4. Migration Phases

### Phase A: Introduce composite category keys

先讓新資料開始寫入複合 `category`：

- `common`
- `car-starter`
- `car-basic`
- `car-advanced`

同時保留舊 `track`：

- `common`
- `car`

這個階段的重點是：

- 新資料雙寫
- 舊資料不動
- 前台先兼容讀兩套欄位

### Phase B: Switch readers to category-first

把前台與後台的讀取邏輯改成：

1. 先讀 `category`
2. 若 `category` 缺失，再 fallback `track + level`
3. 再 fallback 舊 alias

### Phase C: Backfill existing documents

把既有 `metadata_lessons` 一次補齊成新的 category key。

例如：

- `track = car`, `level = starter` → `category = car-starter`
- `track = car`, `level = basic` → `category = car-basic`
- `track = car`, `level = advanced` → `category = car-advanced`

### Phase D: Freeze `track` writes

當所有寫入流程都已經改成 category-first：

- 停止新增或修改 `track`
- 保留 `track` 只給舊資料相容

### Phase E: Remove `track`

最後才可以：

- 從匯入腳本移除 `track`
- 從 admin 表單移除 `track`
- 從前台判斷移除 `track`
- 從後端授權與路由移除 `track`

---

## 5. Files That Must Change

### Frontend

- `public/index.html`
- `public/learning-path.html`
- `public/js/nav-component.js`
- `public/js/learning-path-local.js`
- `public/js/dashboard.js`
- `public/admin-courses.html`

### Backend

- `functions/lib/order-access.js`
- `functions/scripts/import_lesson_level_metadata_lessons.js`
- `functions/scripts/seed-emulator.js`
- `functions/scripts/update_prepare_lessons.js`
- `functions/scripts/backfill_metadata_lessons_expansion.js`

### Docs

- `docs/database.md`
- `docs/courses/course-management-runbook.md`
- `docs/courses/metadata-lessons-versioning-workflow.md`
- `docs/courses/curriculum-migration-plan.md`

---

## 6. Risk Areas

### Risk 1: Learning path breaks

如果前台只認 `track`，而新資料只寫 `category`，首頁與 learning path 會失去分類。

### Risk 2: Admin loses edit compatibility

後台表單現在還有 `track` 欄位；若直接刪除，編輯既有資料會不完整。

### Risk 3: Authorization logic drifts

`order-access` 與相關授權流程還讀 `category`、`level`、`track` 的混合邏輯，必須一起收斂。

### Risk 4: Existing documents become ambiguous

如果 `category` 只寫 `car`，那它無法區分 starter/basic/advanced。

---

## 7. Safe Recommendation

如果你真的想往這條路走，我建議順序是：

1. 先把 `category` 定義成複合路徑鍵
2. 前台讀取改成 category-first
3. 後台寫入改成 category-first
4. 匯入腳本改成雙寫
5. backfill 舊資料
6. 最後才移除 `track`

如果你現在就要動，最安全的做法不是直接刪欄位，而是先把 `category` 改成可承接 `track` 的複合鍵，再做遷移。

---

## 8. Related Docs

- [`docs/courses/course-management-runbook.md`](./course-management-runbook.md)
- [`docs/courses/curriculum-migration-plan.md`](./curriculum-migration-plan.md)
- [`docs/database.md`](../database.md)
- [`docs/courses/metadata-lessons-versioning-workflow.md`](./metadata-lessons-versioning-workflow.md)
