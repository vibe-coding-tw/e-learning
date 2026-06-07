# Content Runtime V2 (External Repo First)

## 1. Goal

- Make external content repo the primary runtime source.
- Keep Firestore as source of truth for authorization and mapping.
- Treat course HTML as the canonical content payload, while allowing shared stylesheet layers for course shell and reusable quiz/content components.

> **2026-05-27 決策**：`private_courses_i18n` local mirror 層已廢除。
> 課程內容以 content-repo (GitHub) 為主，所有降級邏輯都以 pinned 版本與 branch fallback 處理，不再使用本地內容 fallback。

---

## 2. Responsibility Split

- Firestore：
  - Access control
  - Unit/course mapping
  - Runtime version selection (`contentVersion`)
- External repo (`vibe-coding-tw/content-repo`)：
  - Course HTML content（primary，所有語系）
  - Shared course stylesheet assets for unit pages (`course-base.css`, `course-components.css`, `course-quiz.css`)
  - Localized support entry pages (`/tw/students.html`, `/en/students.html`, `/tw/tutors.html`, `/en/tutors.html`) are fetched on demand through `serveCourse` from `content-repo/public/en/` or `content-repo/public/zh-TW/` and are not stored as local mirror files in this repo.

---

## 3. Firestore Schema

Collection: `metadata_settings`  
Document: `content_runtime`

Fields:

- `enabled`: `boolean` — `true` 代表啟用 external repo 抓取
- `repoOwner`: `string`（`vibe-coding-tw`）
- `repoName`: `string`（`content-repo`）
- `contentVersion`: `string`（pinned commit SHA，建議使用）
- `defaultLocale`: `string`（`en`）
- `fallbackEnabled`: `boolean`（僅控制是否允許退回較舊的 pinned 版本）
- `cacheTtlSec`: `number`（建議 `300`）
- `updatedAt`: Firestore Timestamp
- `updatedBy`: `string`（admin email/uid）

---

## 4. Runtime Resolve Order (V2)

```
1. External repo（content-repo）at pinned contentVersion  ← primary
2. External repo at branch fallback（通常 main，disabled by default）
```

> ~~Local mirror `functions/private_courses_i18n/`~~ ← **已移除（2026-05-27）**
> ~~Legacy local fallback `functions/private_courses/`~~ ← **已停用**

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
2. 若該次變更包含課程 shell / 共用元件調整，確認課程 HTML 已引用最新的 `course-base.css` / `course-components.css` / `course-quiz.css`。
3. 取得 commit SHA。
4. 更新 `metadata_settings/content_runtime.contentVersion` 為該 SHA。
5. 驗證 2 個 sample 課程可正常讀取。

---

## 9. Rollback SOP

- **最快**：將 `contentVersion` 改回前一個 SHA。
- **保守停用**：設 `enabled=false`，暫停外部 repo 抓取。

---

## 10. Non-goals

- No live-edit publish from dashboard.
- No per-user personalized content variants.
- No write-back to external repo from runtime path.
- ~~No local i18n mirror sync~~ ← 已廢除。
- ~~No legacy local content fallback~~ ← 已停用。
