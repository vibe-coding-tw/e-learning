# Dashboard Legacy Migration Plan

## Goal

Unify Dashboard data onto one canonical model and remove legacy compatibility layers.

## Canonical Model

- Course id source of truth: `metadata_lessons.courseId`
- Unit id source of truth: `metadata_lessons.courseUnits[]`
- Unit authorization source of truth: `course_configs/{unitId}`
- Teacher authorization fields:
  - `authorizedTeachers`
  - `teacherDetails`
- Parent course config `course_configs/{courseId}` should only keep course-level settings
- `githubClassroomUrls` should store assignment/invite links only, not teacher authorization state

## Legacy Patterns To Remove

- Parent-course teacher authorization fallback:
  - `course_configs/{courseId}.githubClassroomUrls.{unitId}.{teacherEmail} = "authorized"`
- Sanitized teacher keys:
  - `rover_DOT_k_DOT_chen@gmail_DOT_com`
- Malformed nested keys:
  - `githubClassroomUrls.{unitId}.html`
- Mixed unit aliases:
  - `start-01-unit-...`
  - `01-unit-...`
  - key variants without `.html`
- Backend legacy maps:
  - `legacyMap`
- Frontend alias matching:
  - `getEquivalentUnitIds`
  - `unitIdsMatch`

## Phase 1: Audit

- Inventory Firestore legacy data by collection
- Inventory code paths that still read/write legacy data
- Confirm canonical ids for every lesson/unit from `metadata_lessons`

Artifacts:

- [audit_dashboard_legacy_state.js](/Users/roverchen/Documents/web/vibe-coding-tw/functions/audit_dashboard_legacy_state.js)
- [phase2_dashboard_legacy_migration.js](/Users/roverchen/Documents/web/vibe-coding-tw/functions/phase2_dashboard_legacy_migration.js)

## Phase 2: Data Migration

- Rewrite all unit references to canonical unit ids
  - `users.unitAssignments`
  - `assignments.unitId`
  - `promo_codes.courseId`
- Merge legacy unit docs into canonical `course_configs/{unitId}`
- Normalize teacher identifiers to real emails
- Move any unit teacher authorization stored under parent course docs into unit docs
- Remove malformed parent-course keys

Exit criteria:

- No sanitized teacher keys remain
- No malformed `githubClassroomUrls.*.html` structures remain
- No non-canonical unit ids remain in Firestore
- For each unit doc:
  - `authorizedTeachers` and `teacherDetails` are consistent

## Phase 3: Backend Cutover

- `getDashboardData` reads only canonical unit docs for authorization
- Teacher apply/approve/remove writes only canonical unit docs
- Remove `legacyMap`
- Remove authorization fallback via parent `githubClassroomUrls`
- Keep only temporary read-only fallback behind a feature flag if needed during rollout

## Phase 4: Frontend Cutover

- Remove unit alias helpers after data migration is complete
- Tab visibility checks use only canonical unit authorization
- Teacher list uses only canonical unit doc
- Assignment guide application button uses only canonical unit auth state
- Settings/Earnings visibility uses only canonical unit auth state

## Phase 5: Cleanup

- Delete one-off migration scripts after verification
- Remove dead comments and compatibility code
- Re-run audit and confirm zero legacy findings

## Verification Checklist

- Admin opens `dashboard.html` without `unitId`
- Non-admin is denied when `unitId` is missing
- Qualified teacher sees:
  - `Assignments`
  - `Course Settings`
  - `Earnings`
- Non-qualified admin sees:
  - `Admin Console`
  - not `Course Settings`
  - not `Earnings`
- Non-qualified user sees assignment application button below assignment guide
- Teacher list shows each teacher once with normal email formatting
- Started-course units resolve correctly with canonical ids only
