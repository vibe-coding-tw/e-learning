# Content Runtime V2 (External Repo First)

## 1. Goal

- Make external content repo the primary runtime source.
- Keep Firestore as source of truth for authorization and mapping.

> **2026-05-27 決策**：`private_courses_i18n` local mirror 層已廢除。
> 課程內容僅由 content-repo (GitHub) 提供，Legacy fallback 為 `private_courses/` 目錄。

---

## 2. Responsibility Split

- Firestore：
  - Access control
  - Unit/course mapping
  - Runtime version selection (`contentVersion`)
- External repo (`vibe-coding-tw/content-repo`)：
  - Course HTML content（primary，所有語系）
- Legacy local (`functions/private_courses`)：
  - Fallback only（僅限舊版未遷移課程）

---

## 3. Firestore Schema

Collection: `metadata_settings`  
Document: `content_runtime`

Fields:

- `enabled`: `boolean` — `true` 代表啟用 external repo 抓取
- `repoOwner`: `string`（`vibe-coding-tw`）
- `repoName`: `string`（`content-repo`）
- `contentVersion`: `string`（pinned commit SHA，建議使用）
- `defaultLocale`: `string`（`zh-TW`）
- `fallbackEnabled`: `boolean`（建議 `true`）
- `cacheTtlSec`: `number`（建議 `300`）
- `updatedAt`: Firestore Timestamp
- `updatedBy`: `string`（admin email/uid）

---

## 4. Runtime Resolve Order (V2)

```
1. External repo（content-repo）at pinned contentVersion  ← primary
2. External repo at branch fallback（通常 main，disabled by default）
3. Legacy local: functions/private_courses/<fileName>      ← legacy fallback
```

> ~~Local mirror `functions/private_courses_i18n/`~~ ← **已移除（2026-05-27）**

---

## 5. Caching Strategy

- In-function memory cache：
  - Key: `contentVersion + locale + fileName`
  - TTL: `cacheTtlSec`
- HTTP cache headers：`Cache-Control: private, max-age=60`

Cache invalidation：
- 修改 `contentVersion` → 所有快取 key 視為新的。

---

## 6. Security

- GitHub token 儲存於 Secret Manager（`CONTENT_REPO_TOKEN`）。
- 最小權限：目標 repo read-only。
- 禁止在 log 中印出 token。

---

## 7. Content Source Logging

Log 欄位：
- `content_source`: `external` | `external-cache` | `local` | `none`
- `content_fetch_ms`

---

## 8. Release SOP

1. 在 `content-repo` 更新課程 HTML（PR → merge）。
2. 取得 commit SHA。
3. 更新 `metadata_settings/content_runtime.contentVersion` 為該 SHA。
4. 驗證 2 個 sample 課程可正常讀取。

---

## 9. Rollback SOP

- **最快**：設 `enabled=false`，runtime 退回 legacy local fallback。
- **版本回退**：保持 `enabled=true`，將 `contentVersion` 改回前一個 SHA。

---

## 10. Non-goals

- No live-edit publish from dashboard.
- No per-user personalized content variants.
- No write-back to external repo from runtime path.
- ~~No local i18n mirror sync~~ ← 已廢除。
