# Migration History

Last updated: 2026-05-30

This document consolidates the historical migration notes that used to live in:

- `docs/dashboard-legacy-migration-plan.md`
- `docs/legacy-id-migration.md`

It records the legacy cleanup work that has already been executed or is retained only for audit reference.

---

## 1. Purpose

- Normalize historical legacy IDs to current canonical IDs in Firestore.
- Remove dashboard compatibility behavior that depended on legacy maps or sanitized keys.
- Keep a single reference for migration history and verification artifacts.

## 2. Canonical Model

- Course id source of truth: `metadata_lessons.courseId`
- Unit id source of truth: `metadata_lessons.courseUnits[]`
- Unit authorization source of truth: `course_configs/{unitId}`
- Teacher authorization fields:
  - `authorizedTeachers`
  - `teacherDetails`
- Parent course config `course_configs/{courseId}` should only keep course-level settings.
- `githubClassroomUrls` should store assignment/invite links only, not teacher authorization state.

## 3. Legacy Patterns Removed

- Parent-course teacher authorization fallback.
- Sanitized teacher keys such as `rover_DOT_k_DOT_chen@gmail_DOT_com`.
- Malformed nested keys such as `githubClassroomUrls.{unitId}.html`.
- Mixed unit aliases such as:
  - `start-01-unit-...`
  - `01-unit-...`
  - key variants without `.html`
- Backend legacy maps used as the default runtime path.
- Frontend alias matching helpers used for runtime display and access checks.

## 4. Firestore Collections Covered

- `users`
  - `unitAssignments` keys
  - `tutorConfigs` keys
  - `courseProgress` keys
- `orders`
  - `items` keys
  - `courseId`
- `assignments`
  - `courseId`, `unitId`
- `tutor_applications`
  - `unitId`
- `referral_links`
  - `unitId`
- `metadata_lessons`
  - `courseId`, `courseUnits[]`

## 5. Scripts

- [migrate_legacy_ids_firestore.js](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/scripts/migrate_legacy_ids_firestore.js)
- [audit_canonical_runtime_state.js](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/scripts/audit_canonical_runtime_state.js)
- [normalize_runtime_canonical_fields.js](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/scripts/normalize_runtime_canonical_fields.js)
- [audit_referral_links_canonical_state.js](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/scripts/audit_referral_links_canonical_state.js)
- [normalize_referral_links_unit_ids.js](/Users/roverchen/Documents/Apps/vibe-coding-tw/functions/scripts/normalize_referral_links_unit_ids.js)

Historical dashboard migration scripts referenced in older planning docs have been folded into the current canonical runtime audit flow and are no longer maintained as separate entry points.

## 6. Current State

- Historical `orders.items` legacy cleanup has been applied.
- Historical `referral_links.unitId` cleanup has been applied.
- Referral runtime no longer resolves legacy master unit ids.
- `mapLegacyMasterToCanonical()` is retained only for old URL redirect and explicit legacy token scope compatibility.
- `*-master-*` compatibility remains active only because production logs still show real legacy traffic.

## 7. Usage

Dry-run:
```bash
GOOGLE_CLOUD_PROJECT=e-learning-942f7 GCLOUD_PROJECT=e-learning-942f7 \
node functions/scripts/migrate_legacy_ids_firestore.js --dry-run
```

Apply:
```bash
GOOGLE_CLOUD_PROJECT=e-learning-942f7 GCLOUD_PROJECT=e-learning-942f7 \
node functions/scripts/migrate_legacy_ids_firestore.js --apply
```

Recommended safety flow:
1. Run audit first.
2. Review legacy findings.
3. Run dry-run migration.
4. Apply only after confirming the output.

## 8. Verification

- Confirm `metadata_lessons` canonical fields are clean.
- Confirm order and referral legacy keys are gone.
- Confirm dashboard tab visibility matches the canonical unit policy.
- Confirm any remaining `*-master-*` handling exists only as explicit compatibility.
