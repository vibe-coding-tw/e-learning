# System Improvement Backlog

Last updated: 2026-05-27

This backlog captures the highest-value system improvements identified from reviewing the live implementation, Firestore data, and current documentation.

## Goals

- Make Firestore the real runtime source of truth.
- Reduce legacy compatibility logic that leaks into daily operation.
- Make course access, payment activation, dashboard tabs, and learning-path rendering predictable.
- Separate current production rules from migration history.

## P0

### 1. Firestore-first runtime cleanup

Problem:
- The docs say runtime decisions must be Firestore-first, but the system still contains hardcoded compatibility lists and display rules.

Examples:
- `functions/index.js`: `LEGACY_MASTER_TO_CANONICAL`
- `public/js/dashboard.js`: prepare-unit title and list mapping
- `public/learning-path.html`: hidden course keys, category labels, preview-disabled unit list

Target:
- Move runtime display and access decisions into Firestore fields.
- Keep only the smallest possible compatibility layer for old URLs and old paid orders.

Acceptance:
- Learning-path category labels, hidden cards, preview behavior, entry unit, tab ordering, and course grouping no longer depend on hardcoded frontend arrays.

### 2. Canonical course identity normalization

Problem:
- `courseId`, `courseKey`, and `unitId` are still mixed across payment, routing, tabs, and dashboard logic.

Target model:
- `courseKey`: stable business/category key
- `courseId`: canonical course entry page URL
- `entryUnitId`: first unit to open for the course
- `courseUnits[]`: ordered units in the course
- `unitId`: concrete unit page URL

Acceptance:
- Payment activation, learning-path navigation, dashboard unit context, and course tabs all use the same canonical mapping.

### 3. Order activation validation

Problem:
- A paid order can succeed but still fail to unlock a course if `orders.items` and course metadata do not match cleanly.

Target:
- Add a post-payment validation pass that verifies:
- each paid item maps to a canonical course
- each canonical course resolves to valid units
- the student can pass `checkPaymentAuthorization`

Acceptance:
- Any failed activation is detectable immediately after payment success and generates an actionable admin alert.

### 4. Unit dashboard hard-rule enforcement

Problem:
- Unit dashboards still carry extra compatibility branches for hidden tabs and fallback routes.

Target:
- In unit context, only allow:
- `Assignments`
- `Settings` when `isQualifiedTutor` or `admin + TutorMode=ON`

Acceptance:
- `Overview`, `Tutor Management`, `Shipments`, and `Earnings` cannot render or be navigated to in unit context.

## P1

### 5. Remove duplicate legacy course cards from Firestore

Problem:
- Legacy cards such as `03-unit-github-classroom.html` still coexist with canonical `tw-*` cards.

Target:
- Keep only one production card per course.
- Mark legacy entries as migration artifacts or remove them after validation.

Acceptance:
- No duplicated course card can appear from Firestore data alone.

### 6. Learning-path fully metadata-driven

Problem:
- `learning-path.html` is partially driven by Firestore but still contains manual business logic for some card behavior.

Target:
- Move these into Firestore:
- category label
- sort order
- card visibility
- preview availability
- hardware/spec card grouping
- card subtitle/summary
- image/video metadata

Acceptance:
- The page can be reconfigured by Firestore edits without touching frontend code.

### 7. Course tabs fully metadata-driven

Problem:
- Tabs now use Firestore course membership, but tab titles still fall back to filename parsing.

Target:
- Add per-unit display title and ordered tab metadata to Firestore or content metadata.

Acceptance:
- Tabs always show the intended human title and order without filename heuristics.

### 8. Content-runtime separation

Problem:
- Platform logic and course content logic are still partially mixed.

Target:
- Platform handles auth, payment, dashboard, access control, and routing.
- Content repo handles course HTML, assignment guide, tutor guide, and locale content.
- Firestore handles runtime metadata and display rules.

Acceptance:
- Course presentation updates do not require platform logic edits unless behavior rules change.

## P2

### 9. Documentation split: current spec vs migration history

Problem:
- Several docs mix production truth with transitional notes.

Target:
- Separate:
- current production rules
- migration notes
- backlog / future architecture

Acceptance:
- A reader can tell which rules are live today and which are historical.

### 10. Master-page retirement plan finalization

Problem:
- Some docs say `*-master-*` is already retired; others correctly say it is still in compatibility mode.

Target:
- Keep one authoritative statement:
- runtime support remains only for legacy compatibility
- production navigation must use canonical unit entry
- delete compatibility only after pilot validation

Acceptance:
- No document claims full retirement before the code and Firestore are actually clear.

### 11. Activation and referral audit tooling

Problem:
- Debugging paid access, tutor assignment, and referral share issues still requires manual Firestore inspection.

Target:
- Add scripts and/or admin tools to audit:
- order to course activation
- missing tutor assignment by paid unit
- referral/share metadata completeness
- payout readiness

Acceptance:
- Common support issues can be diagnosed without ad hoc data spelunking.

## Suggested execution order

1. P0.1 Firestore-first runtime cleanup
2. P0.2 Canonical course identity normalization
3. P0.3 Order activation validation
4. P0.4 Unit dashboard hard-rule enforcement
5. P1.5 Remove duplicate legacy course cards
6. P1.6 Learning-path fully metadata-driven
7. P1.7 Course tabs fully metadata-driven
8. P1.8 Content-runtime separation
9. P2.9 Documentation split
10. P2.10 Master-page retirement finalization
11. P2.11 Activation/referral audit tooling

## Notes

- Keep compatibility for historical paid orders, but do not let compatibility logic become the default runtime path.
- Prefer fixing Firestore data and metadata shape before adding new frontend or backend fallbacks.
- Whenever a rule must stay in code temporarily, document it explicitly as transitional.
