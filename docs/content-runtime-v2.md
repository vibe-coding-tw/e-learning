# Content Runtime V2 (External Repo First)

## 1. Goal

- Make external content repo the primary runtime source.
- Keep Firestore as source of truth for authorization and mapping.
- Keep local i18n mirror as safety fallback.

---

## 2. Responsibility Split

- Firestore:
  - Access control
  - Unit/course mapping
  - Runtime version selection (`contentVersion`)
- External repo (`vibe-coding-tw/content-repo`):
  - Course HTML content (`zh-TW`, `en`, ...)
- Local mirror (`functions/private_courses_i18n`):
  - Runtime fallback only

---

## 3. Firestore Schema (new doc)

Collection: `metadata_settings`  
Document: `content_runtime`

Suggested fields:

- `enabled`: `boolean`
  - `true` = runtime tries external first
  - `false` = runtime uses local mirror only
- `repoOwner`: `string` (e.g. `vibe-coding-tw`)
- `repoName`: `string` (e.g. `content-repo`)
- `contentVersion`: `string`
  - pinned commit SHA (recommended)
- `defaultLocale`: `string` (e.g. `zh-TW`)
- `fallbackEnabled`: `boolean` (recommended `true`)
- `cacheTtlSec`: `number` (e.g. `300`)
- `updatedAt`: Firestore Timestamp
- `updatedBy`: `string` (admin email/uid)

---

## 4. Runtime Resolve Order (V2)

For requested `fileName` and locale chain:

1. External repo at pinned `contentVersion` (primary)
2. External repo at branch fallback (optional, usually `main`, disabled by default)
3. Local mirror: `functions/private_courses_i18n/<locale>/<fileName>`
4. Legacy local: `functions/private_courses/<fileName>`

Notes:

- Locale chain: `query.lang` -> `accept-language primary` -> `defaultLocale`
- Authorization remains unchanged and still validated before content fetch.

---

## 5. Caching Strategy

- In-function memory cache:
  - Key: `contentVersion + locale + fileName`
  - TTL: `cacheTtlSec`
- HTTP cache headers:
  - `Cache-Control: private, max-age=60`
- Optional CDN cache:
  - short TTL only

Cache invalidation:

- Change `contentVersion` -> treat all cache keys as new.

---

## 6. Security

- GitHub token stored in Secret Manager only.
- Minimum scope: read-only for target repo.
- Never log token or full authorization header.
- Rotate token periodically.

Required env/secrets:

- `CONTENT_REPO_TOKEN`
- Optional: `CONTENT_REPO_API_BASE` (default GitHub API)

---

## 7. Observability

Add structured logs/metrics:

- `content_source`: `external` | `mirror_i18n` | `legacy_local`
- `content_fetch_ms`
- `content_fetch_error`
- `fallback_hit`

Alert suggestions:

- `external_fetch_error_rate > 3%` (5 min)
- `fallback_hit_rate > 10%` (15 min)
- `p95_content_fetch_ms > 1200ms` (15 min)

---

## 8. Release SOP (External-first)

1. Update content in `content-repo` via PR.
2. Merge PR and get commit SHA.
3. Update `metadata_settings/content_runtime.contentVersion` to that SHA.
4. Smoke test 2 sample units (`zh-TW` + `en`).
5. Monitor fallback/error metrics for 30 minutes.

---

## 9. Rollback SOP

Option A (fastest):

- Switch `enabled=false` in `content_runtime`.
- Runtime returns to local mirror flow.

Option B (version rollback):

- Keep `enabled=true`, set `contentVersion` back to previous SHA.

---

## 10. Rollout Plan

Phase 1:

- Enable V2 for 2 pilot units only (allowlist in config or code flag).

Phase 2:

- Expand to all `tw-common-*` and `tw-car-starter-*`.

Phase 3:

- Expand to `tw-car-basic-*`, `tw-car-advanced-*`.

Phase 4:

- Keep mirror fallback, evaluate removing legacy `private_courses` dependency.

---

## 11. Non-goals (current MVP)

- No live-edit publish from dashboard.
- No per-user personalized content variants.
- No write-back to external repo from runtime path.
