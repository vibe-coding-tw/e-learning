# Platform Expansion Plan

## 1. Scope

This document consolidates:

1. Course architecture upgrade
2. Content quality standardization
3. I18N content repo MVP
4. Channel partner / revenue share parameterization
5. Distributor / fulfillment partner operating model
6. Distributor-tutor pricing engineering spec

The goal is to keep one source of truth for the next-stage platform changes.

> Historical cleanup and runtime backlog items that overlap with this plan now live in `docs/legacy-and-backlog.md`.

---

## 2. Course Architecture

### 2.1 Objectives

- Decouple routing and business logic from legacy HTML filenames.
- Improve readability of course/unit naming as the catalog grows.
- Prepare for multi-region, multi-language, and external instructor onboarding.
- Preserve current authorization, grading, and writeback during migration.

- 新課程的新增 / 修改 / 停用流程與欄位定義，請以 [`docs/course-management-runbook.md`](course-management-runbook.md) 為準。

### 2.2 Core principles

1. Firestore remains the source of truth.
2. Stable IDs first; display naming can change before canonical IDs do.
3. Display labels and storage keys must be separated.
4. `courseKey` is locale-neutral in Firestore; page filenames / routes may still keep `tw-*` prefixes for content delivery and backward compatibility.
5. Migration must be staged with fallback and rollback paths.

### 2.3 Target data model additions

For `metadata_lessons`:

- `courseKey` (locale-neutral canonical key, e.g. `common-vscode-setup`, `car-starter-web-app`)
- `track`
- `level`
- `entryUnitId`
- `displayName`
- `i18n`
- `contentRef`
- `pricing`
- `priceByLocale`
- `priceByRegion`
- `priceMap`
- `prices`
- `price_twd`
- `price_usd`
- `currency`

### 2.3.1 Current implementation (2026-05-27)

- Course list pages are unified into `public/learning-path.html`.
- `path` query drives category rendering, e.g.:
  - `?path=tw-common`
  - `?path=tw-car-starter`
  - `?path=tw-car-basic`
  - `?path=tw-car-advanced`
- Legacy entry pages `prepare/start/basic/advanced` are compatibility redirects only.
- Top nav learning-path menu is generated dynamically from Firestore `metadata_lessons`:
- grouping key source: `locale + track + level (+ locale-neutral courseKey context)`
  - label source priority:
    1. `learningPathLabelZh/En`
    2. `categoryLabelZh/En`
    3. `navLabelZh/En`
    4. `learningPathLabel|categoryLabel|navLabel`
  - fallback: key humanization if no label is configured.
- Pricing is resolved from Firestore distributor pricing / price book data and is not derived by client-side FX conversion.
  - Language must not be used as a price selector.
  - Historical locale-keyed fields may still exist for compatibility, but new pricing flows should rely on distributor price books and frozen checkout quotes.
  - Course families should keep matching pricing across course metadata, cart items, and fulfillment records.

For `users`:

- `locale`
- `region`
- `preferredRegion`
- `preferredDistributorId`

Language selection in the catalog should remain a content concern only; checkout currency should come from the selected distributor's active price book.
`public/learning-path.html` should resolve the catalog distributor from Firestore user preferences first (`preferredDistributorId`), then fall back to region routing or localStorage only when the user is not signed in.

### 2.3.2 Pricing implementation status (2026-06-03)

- Standard course pricing is now backfilled in Firestore:
  - `started`: TWD 1200 / USD 40
  - `basic`: TWD 1500 / USD 50
  - `advanced`: TWD 1800 / USD 60
- The canonical storage shape is:
  - `pricing.tw` / `pricing.en`
  - `priceByLocale.zh-TW` / `priceByLocale.en`
  - `priceByRegion.tw` / `priceByRegion.en`
  - `priceMap.tw` / `priceMap.en`
  - `price_twd` / `price_usd`
- Frontend and backend price resolvers must prefer Firestore values over local conversion logic.
- Distributor checkout quotes should ignore locale-based currency fallbacks once a price book is available.
- `priceByLocale` and `priceByRegion` remain compatibility aliases only; new logic should not depend on them.

### 2.4 Naming strategy

Short term:

- Hide technical prefixes like `-unit-` in the UI.
- Keep existing canonical `unitId` and `courseId` until migration is complete.

New naming examples:

- `car-starter-agent-mode`
- `drone-basic-flight-control`

### 2.5 Confirmed Taiwan file naming rules

1. Original preparation/unit files `*-unit-*.html`
   - Rename to `tw-common-*.html` (page filename target only; Firestore `courseKey` remains locale-neutral)
2. Original starter course files `start-*-unit-*.html`
   - Rename to `tw-car-starter-*.html` (page filename target only; Firestore `courseKey` remains locale-neutral)
3. Original basic course files `basic-*-unit-*.html`
   - Rename to `tw-car-basic-*.html` (page filename target only; Firestore `courseKey` remains locale-neutral)
4. Original advanced course files `advanced-*-unit-*.html`
   - Rename to `tw-car-advanced-*.html` (page filename target only; Firestore `courseKey` remains locale-neutral)

This naming rule is a planning target. Existing Firestore keys should migrate gradually.

### 2.6 `*-master-*` retirement

Conclusion:

- `*-master-*.html` can be removed in the new architecture.
- They should not be removed until their responsibilities are detached.

**Completed removals (2025-05):**

- `01-master-getting-started.html` — removed; prepare units now use `prepare-*` naming directly.
- `02-master-ai-agents.html` — removed; three child units replaced by `prepare-04/05/06-*.html`.
- `03-master-wifi-motor.html` — removed; child units migrated to `prepare-07/08/09-*.html`.

**Remaining master files** (still in use by `start`, `basic`, `adv` courses):

- `start-*-master-*.html` (5 files)
- `basic-*-master-*.html` (10 files)
- `adv-*-master-*.html` (15 files)

Dependencies that must be removed before retiring the remaining masters:

1. Entry pages such as `prepare.html` ← **done**: now redirect to `learning-path.html`
2. `serveCourse` scope validation that still uses `classroomUrl/masterFile`
3. Frontend fallbacks that hardcode master filenames

Migration order:

1. Add `entryUnitId`
2. Switch entry pages to `entryUnitId`
3. Change `serveCourse` to validate by `courseKey + unit list`
4. Convert master pages into compatibility redirects
5. Remove master files after validation

### 2.7 Completed file renames (2025-05)

The original `0x-unit-*.html` naming was migrated to a `prepare-NN-*` sequential scheme:

| Old filename | New filename |
|---|---|
| `01-unit-developer-identity.html` | `prepare-01-developer-identity.html` |
| `01-unit-vscode-online.html` | `prepare-02-vscode-online.html` |
| `01-unit-vscode-setup.html` | `prepare-03-vscode-setup.html` |
| `02-unit-agent-mode.html` | `prepare-04-agent-mode.html` (rewritten) |
| `02-unit-vibe-coding.html` | `prepare-05-vibe-coding.html` (rewritten) |
| `02-unit-web-agents.html` | `prepare-06-web-agents.html` (rewritten) |
| `03-unit-github-classroom.html` | `prepare-07-github-classroom.html` |
| `03-unit-motor-ramping.html` | `prepare-08-motor-ramping.html` (rewritten) |
| `03-unit-wifi-setup.html` | `prepare-09-wifi-setup.html` (rewritten) |

Frontend rename:

| Old filename | New filename |
|---|---|
| `public/started.html` | `public/start.html` |

Frontend routing update (2026-05):

| Legacy page | Current behavior |
|---|---|
| `public/prepare.html` | Redirect to `public/learning-path.html?path=tw-common` |
| `public/start.html` | Redirect to `public/learning-path.html?path=tw-car-starter` |
| `public/basic.html` | Redirect to `public/learning-path.html?path=tw-car-basic` |
| `public/advanced.html` | Redirect to `public/learning-path.html?path=tw-car-advanced` |

### 2.8 New tooling files

| File | Purpose |
|---|---|
| `functions/scripts/seed-emulator.js` | Seed Firestore emulator with course metadata and test data |
| `public/js/firebase-local.js` | Auto-detect and connect to local Firebase emulator |
| `functions/private_courses/_add_quiz.py` | Batch script used for inserting quizzes (build-time only) |

---

## 3. Content Quality Standardization (Completed 2025-05)

### 3.1 Objectives

- Bring all 104 course unit files to a consistent MS Learn-style format.
- Ensure every unit has rich educational content, not boilerplate.
- Add knowledge quizzes to all unit files for learner self-assessment.

### 3.2 MS Learn format standard

All unit files now follow a consistent structure:

- Sidebar navigation with progress tracking
- Breadcrumbs linking to course listing
- Content pages using semantic CSS classes: `.ms-note`, `.ms-tip`, `.ms-warning`, `.ms-important`, `.ms-steps`, `.ms-table`, `.ms-code`
- Shared stylesheet layers for course shell and reusable UI: `course-base.css`, `course-components.css`, `course-quiz.css`
- Knowledge quiz page with 4 topic-specific multiple-choice questions, answer validation, and explanations
- Summary page with key takeaways

### 3.3 Phase 1 — Critical defect fixes (adv 50 files)

| Issue | Files affected | Resolution |
|---|---|---|
| Empty index page descriptions | 13 files (adv-01 ~ adv-05) | Filled with topic-specific 1-2 sentence descriptions |
| Unreadable fonts (`text-[8px]`/`[9px]`/`[10px]`) | 38 files | Replaced with `text-[13px]` |
| Task card footer text overflow | 50 files | Added CSS truncation rule |
| H1 titles with emoji/numbering/time | 50 files | Cleaned to topic-only titles |
| Boilerplate intro paragraphs | 50 files | Replaced with topic-specific content |

### 3.4 Phase 2 — Content enrichment (basic 30 + adv 50 = 80 files)

| Task | Files | Details |
|---|---|---|
| Rewrite boilerplate intros and scenarios | 80 files | Unique, topic-specific introductions |
| Fix fonts, footer overflow, H1 format | basic 30 files | Same fixes as adv Phase 1 |
| Rewrite generic learning objectives | basic 30 files | Specific, measurable, action-verb-based outcomes |
| Expand teaching pages | 240 pages across 80 files | From 1-3 sentences to full MS Learn-style content with tables, code examples, callouts, and step-by-step instructions |
| Remove raw Tailwind from content | 80 files | Replaced with MS Learn CSS components and shared shell stylesheet layers |

### 3.5 Phase 3 — Knowledge quizzes (basic 30 + adv 50 = 80 files)

- Inserted a quiz page (4 topic-specific questions) into each file between Lab and Summary.
- Updated JavaScript `UNITS` array, navigation links, progress indicators, and sidebar badges.
- Added `submitQuiz` / `resetQuiz` functions with answer validation and explanations.

### 3.6 Phase 4 — Polish start + prepare (24 files)

| Task | Files | Details |
|---|---|---|
| Add knowledge quiz | start 15 files | 4 topic-specific questions per unit |
| Full content rewrite | `prepare-08-motor-ramping.html` | PWM, BLE binary communication, DataView, ramping algorithms |
| Full content rewrite | `prepare-09-wifi-setup.html` | BLE, Web Bluetooth API, NVS, TextEncoder |
| Quality verification | `prepare-01` ~ `prepare-07` | Already met standards; no changes needed |

### 3.7 Post-polish fixes (2025-05)

- **Start unit styling alignment**: All 15 start unit files updated to match prepare/basic/adv format (top nav brand/label, sidebar module-label hidden, breadcrumb with real module titles).
- **JS init crash in `prepare-08` and `prepare-09`**: `init()` referenced `window.RESOURCES` before it was defined in a later `<script>` block, causing a `TypeError` that prevented breadcrumb and navigation from initializing. Fixed with a defensive `if (window.RESOURCES)` guard.

### 3.8 Remaining content issues

- **46 adv files missing video/doc URLs**: `adv-02` through `adv-15` have empty `video` and `doc` fields in `window.RESOURCES`. Only `adv-01` (3 units) and `adv-04-filter-algorithms` have actual URLs. These require user-provided YouTube and Google Docs links.

---

## 4. I18N Content Repo (Runtime Fetching)

> [!NOTE]
> 本章節多語系（I18N）教材倉庫結構、執行期讀取與發佈更新工作流之說明已抽離，統一集中至 [i18n_progress_audit.md](file:///Users/roverchen/.gemini/antigravity/brain/baad103e-f43a-454f-ade1-5e28f917cf42/i18n_progress_audit.md) 管理與進度追蹤。

---

## 5. Channel Partner And Revenue Share

### 5.1 Objectives

- Make tutor and agent revenue share ratios configurable.
- Support multi-market and multi-channel policies.
- Preserve future room for course development revenue share.

### 5.2 Role model

Roles:

- Tutor
- Agent
- CourseDev

Notes:

- Tutors may belong to an agent.
- The system distributes revenue by role instead of using a single bundled partner model.
- Physical goods fulfillment should be handled by regional distributors / partners while the platform remains the payment and order-control layer.
- Current courses do not have an owner, so `CourseDev` share is reserved but not paid.

### 5.3 Confirmed initial parameters

- `tutorRate = 0.20`
- `agentRate = 0.20`
- `courseDevRate = 0.20` as reserved parameter only

Operational rules:

1. If a course has no owner, do not issue `courseDevRate`.
2. Taiwan can also have agents.
3. If a tutor has no agent, the agent share stays with the platform.
4. Upline revenue share can apply to both tutor and agent.
5. If there is no upline configured, do not issue upline share.
6. Margin guardrails should be adjustable based on real operating conditions, not hardcoded to a fixed threshold.

### 5.4 Firestore additions

New collection:

- `revenue_share_policies`

Recommended `orders` additions:

- `region`
- `channelType`
- `policyId`
- `pricingVersion`

### 5.5 Calculation changes

`calculateMonthlySharing` should:

1. Read the order's `policyId`
2. Load the policy snapshot
3. Calculate:
   - tutor share
   - agent share
   - course development share if applicable
   - upline share if applicable
4. Store ledger lines with `policySnapshot`

### 5.6 Admin MVP

Admin needs:

1. Policy CRUD
2. Enable/disable policy
3. Revenue simulation
4. Audit trail

### 5.7 Distributor and tutor commercial split

The distributor-owned hardware pricing model and the tutor service-sharing model are now documented in a dedicated engineering spec:

- [Distributor, Tutor, and Pricing Engineering Spec](./distributor-tutor-pricing-engineering-spec.md)

This spec covers:

1. Distributor-owned hardware pricing
2. Tutor service revenue sharing
3. Same-region multiple distributor price books
4. Checkout distributor resolution
5. Backend API and permission matrix

---

## 6. Confirmed Decisions

1. Use locale-neutral `courseKey` as the new main course key.
2. Use pure display names such as `Agent Mode`.
3. `track` and `level` use fixed enums, not instructor-defined free text.
4. Keep guides embedded for now instead of splitting them out.
5. Remove `*-master-*` as soon as validation is complete.
6. Use role-based revenue share parameters instead of the old bundled partner wording.

---

## 7. Execution Roadmap

### Phase 0 — Content & naming groundwork ✅ Completed 2025-05

1. ~~Hide technical prefixes in UI~~
2. ~~Group courses by `track` and `level`~~
3. ~~Align naming and planning docs~~
4. Migrate prepare-course files from `0x-unit-*` to `prepare-NN-*` naming ✅
5. Remove 3 legacy master files (`01-master`, `02-master`, `03-master`) ✅
6. Rename `started.html` → `start.html` ✅
7. Enrich all 104 course files to MS Learn standard ✅
8. Add knowledge quizzes to all 95 unit files ✅
9. Add `seed-emulator.js` and `firebase-local.js` for local dev ✅
10. Align start unit files to match prepare/basic/adv styling ✅
    - Top nav: `Vibe Coding Learn` → `Vibe Coding` + rocket icon, nav label linked to `/start.html`
    - Sidebar: hide `module-label` via `display: none`
    - Breadcrumb: replace generic `Start 03`/`入門課程單元` with actual module titles
11. Fix `prepare-08` and `prepare-09` JS init crash (`window.RESOURCES` accessed before definition) ✅

### Phase 1

1. Add `courseKey/track/level/entryUnitId/contentRef` (with locale-neutral `courseKey`)
2. Switch entry pages to `entryUnitId`
3. Start `zh-TW/en` content repo pilot
4. Add `revenue_share_policies`
5. Make monthly share calculation read policies
6. Fill 46 missing video/doc URLs in advanced course files

### Phase 2

1. Remove master-file dependency from `serveCourse`
2. Add admin revenue share management UI
3. Add simulation and warnings
4. Add order-level `region/channelType/policyId`

---

## 7. Implementation Checklist (Live Status)

### 7.1 Data model and Firestore

- [x] Add locale-neutral `courseKey` to `metadata_lessons`
- [x] Add `track` to `metadata_lessons`
- [x] Add `level` to `metadata_lessons`
- [x] Add `entryUnitId` to `metadata_lessons`
- [x] Add `contentRef` to `metadata_lessons`
- [x] Normalize known non-canonical metadata records into explicit product types (`metadataType=product|legacy_product`)
- [x] Add `locale` to `users`
- [x] Add `region` to `users`
- [x] Add `region` to `orders`
- [x] Add `channelType` to `orders`
- [x] Add `policyId` to `orders`
- [x] Add `pricingVersion` to `orders`
- [x] Create `revenue_share_policies` collection

### 7.2 Content routing and serving

- [x] Add locale-aware content lookup in `serveCourse`
- [x] Add old-filename -> new-filename fallback for i18n content paths
- [x] Restrict compatibility fallback to legacy `-master-` token scopes only
- [x] Add `/courses/*` global nav injection with iframe-safe guard (avoid duplicate nav in master iframes)
- [x] Remove invalid injected placeholder script (`P26...`) from `functions/private_courses/*.html` and restore canonical `/js/course-shared.js` loading
- [x] Repair broken runtime boot script in all unit files (104 files updated to canonical `/js/course-shared.js?v=...`)
- [x] Restore dashboard FAB and `.ms-topnav` normalization by removing invalid script dependencies from served course HTML
- [x] Make `entryUnitId` the primary course entry target
  - `prepare`: now mapped to existing `prepare-*` unit pages
  - `start/basic/advanced`: now mapped directly to first unit pages
- [x] Convert remaining `*-master-*` pages into compatibility redirects
- [x] Remove `*-master-*` dependencies from token generation and entry links

### 7.3 External content repo MVP

- [x] Create `sync_i18n_private_courses.sh` MVP tool (已廢除且於 2026-05-27 刪除)
- [x] Create external private content repo
- [x] Add first `zh-TW` pilot content
- [x] Add first `en` pilot content
- [x] Define runtime fetch resolution & caching (替代原本的 local mirror 同步流程，已實作於 serveCourse)
- [x] Verify fallback order with one migrated unit

### 7.4 Naming migration

- [x] Confirm new lowercase naming examples
- [x] Create old filename -> new filename mapping table
- [x] Create old `unitId` -> `contentRef` mapping table
- [x] Remove `master` check from shared nav FAB injection logic
- [ ] Hide `-unit-` technical prefixes in all UI surfaces
- [ ] Move prepare course units from `prepare-*` compatibility names to target `tw-common-*` / `tw-car-*` page naming (Firestore `courseKey` stays locale-neutral)

Reference artifacts:

- `docs/examples/content-filename-mapping.csv`
- `docs/examples/unit-contentref-mapping.csv`
- `docs/examples/master-retirement-mapping.csv`
- `docs/examples/metadata-lessons-migration-template.csv`
- `docs/examples/metadata-lessons-pricing-template.csv`

### 7.5 Revenue share system

- [x] Store role-based revenue share policies in Firestore
- [x] Add tutor share calculation by policy
- [x] Add agent share calculation by policy
- [x] Add single-level `courseDevRate` support (owner-present only)
- [x] Add upline share calculation for tutor
- [x] Add upline share calculation for agent
- [x] Add upline share calculation for course developer (`courseDevUplineRate`)
- [x] Persist `policySnapshot` into ledger records
- [x] Add admin policy CRUD (MVP: list + inline update in Admin Console)
- [x] Add admin revenue simulation UI (read-only calculator in Tutor Management)

### 7.6 Validation and pilot rollout

- Pilot selection (2026-05-26):
  - `tw-common` proxy pilot: `prepare-01-developer-identity.html`
  - `tw-car-starter` proxy pilot: `start-01-unit-html5-basics.html`
  - Note: naming migration to `tw-*` is pending; current pilot uses existing canonical filenames as proxies.

- [x] Pick 1 `tw-common-*` unit as pilot
- [x] Pick 1 `tw-car-starter-*` unit as pilot
- [x] Verify course open flow
- [x] Verify authorization scope
- [x] Verify dashboard lesson entry
- [x] Verify assignment-guide and tutor-guide rendering
- [x] Verify autograde and writeback are unaffected
- [x] Remove `*-master-*` only after pilot validation succeeds

Billing window note (2026-05):
- GitHub Actions execution is temporarily blocked by billing limits.
- Therefore, `autograde + writeback` end-to-end runtime verification is temporarily deferred.
- During this window, do **not** retire `*-master-*` pages yet.

Pilot verification notes (2026-05-26):
- Course open flow: verified at code-path level
  - `public/start.html|basic.html|advanced.html` resolve entry by `entryUnitId` first
  - pilot master page links point to existing unit files
- Authorization scope: verified in `serveCourse`
  - scope resolution now checks `courseId/courseKey/entryUnitId/classroomUrl/contentRef/courseUnits`
  - legacy fallback limited to `-master-` scope only
- Dashboard lesson entry: verified in `getDashboardData`
  - related files aggregation includes `entryUnitId + courseUnits + classroomUrl`
  - hidden sections extraction for `assignment-guide` and `tutor-guide` confirmed in both pilot files
- Autograde/writeback: not yet passed
  - audit sample file: `/tmp/autograde_consistency_audit_20260526_134707.csv`
  - sample scope (34 repos): `workflow_ok=no` for 34/34, `last_writeback_ok=no` for 34/34
  - current blocker: GitHub Actions billing window; runtime runs cannot be executed this month

Deferred verification plan (next billing cycle):

1. Trigger 1 pilot bridge repo autograde workflow manually
2. Confirm Actions run status = success
3. Confirm `ingestGithubAutograde` writes Firestore `autoGrade*` fields
4. Re-run consistency audit and capture new report path
5. Only then mark:
   - `Verify autograde and writeback are unaffected`
   - `Remove *-master-* only after pilot validation succeeds`

Operational note:
- Course UI ownership and acceptance rules are defined in `docs/course-ui-runtime-spec.md`.
- Changes to `public/js/*` require fingerprinting and hosting deployment.
- Changes to course runtime injection, token validation, or served HTML normalization require deploying `functions:payment:serveCourse`.
- Changes to external `content-repo` course HTML require updating Firestore `contentVersion` to invalidate content caches.
- Firestore `courseUnits` drives cross-unit TAB navigation only; it must never overwrite the current unit's sidebar page menu.

Hotfix note (2026-05-26):
- A malformed placeholder script token (`P26.05.26...`) was accidentally written into course HTML files and caused:
  - missing FAB
  - inconsistent `.ms-topnav`
  - partial course runtime boot failures
- The token has been fully replaced with canonical script paths and redeployed.

---

## 8. Immediate Next Steps

1. Finish start/master parity pass:
   - align all `start-*-master-*.html` tab wrapper and iframe behavior with `basic/adv` baseline
   - verify `.ms-topnav` text structure consistency on all start units
2. Apply `users` and `orders` regional fields (`locale`, `region`, `channelType`, `policyId`, `pricingVersion`) with migration script.
3. Complete role-based sharing (`tutor/agent/courseDev`) with policy snapshot mode.
4. Add admin UI for setting `courseDev` ownership/upline mapping quality checks.
5. Implement distributor-owned price books and tutor service settlement as a dedicated commerce workflow.

---

## 9. Execution Runbook (Next Sprint)

### 9.1 Phase A: Master-page stability gate

Goal: make current `start/basic/adv` fully stable before structural migration.

Tasks:

1. Verify all master pages load canonical runtime scripts only:
   - `/js/nav-component.js?v=...`
   - `/js/course-shared.js?v=...`
   - runtime version must bypass stale CDN cache after a UI hotfix
2. Verify unit pages no longer contain invalid placeholder script tokens.
3. Confirm per track:
   - `prepare-*`: FAB visible, no duplicate global nav
   - `start-*`: tab + `.ms-topnav` consistent with `basic/adv`
   - `basic-*`, `adv-*`: unchanged behavior after patch
   - sidebar page menu shows the current unit's pages and does not duplicate TAB items
4. Smoke-test authorization path:
   - `checkPaymentAuthorization` -> token -> `serveCourse` works
5. Deploy sequence:
   - if `functions/private_courses/*` changed -> deploy functions
   - if only `public/js/*` changed -> deploy hosting

Exit criteria:

- No missing FAB reports on prepare/start/basic/adv unit pages
- No duplicated nav on `/courses/*`
- No `File not found` from token-to-course opens for active units

Validation matrix (Phase A):

| Area | Check item | Method | Owner | Status |
|---|---|---|---|---|
| Runtime script loading | No invalid placeholder script token in served course HTML | `rg "P26\\.05\\.26"` on `functions/private_courses/*.html` | Engineering | Completed (2026-05-26 recheck: 0 hit) |
| FAB visibility | FAB shows on `prepare-*`, `start-*`, `basic-*`, `adv-*` unit pages | Manual open + hard refresh on each track sample | QA/PM | In progress (manual validation pending) |
| Nav de-duplication | No duplicate global nav on `/courses/*` | Manual check on 5 master pages + 4 unit pages | QA/PM | In progress (manual validation pending) |
| Start parity | `start` tab + iframe behavior matches `basic/adv` | Compare master wrappers (`start-01..05-master-*`) | Engineering | Completed |
| Access route | token-based open does not return `File not found` on active units | Open from catalog + dashboard deep link | QA/PM | In progress (manual validation pending) |

Validation note (2026-05-26):

- `functions/private_courses/*.html` now uniformly loads hashed runtime asset:
  - `/js/course-shared.1151b0620be1.js`
- This confirms fingerprint pipeline is active for private course pages.
- Remaining Phase A gate items require live-browser manual confirmation on production routes.

Phase A manual test checklist (ready to execute):

1. FAB visibility
   - `https://vibe-coding.tw/courses/prepare-01-developer-identity.html`
   - `https://vibe-coding.tw/courses/start-01-unit-html5-basics.html`
   - `https://vibe-coding.tw/courses/basic-01-unit-esp32-architecture.html`
   - `https://vibe-coding.tw/courses/adv-01-unit-jpeg-quality.html`
   - Pass criteria: each page shows one dashboard FAB at bottom-right.

2. Nav de-duplication
   - `https://vibe-coding.tw/courses/car-starter-web-app.html`
   - `https://vibe-coding.tw/courses/car-starter-web-ble.html`
   - `https://vibe-coding.tw/courses/car-basic-environment.html`
   - `https://vibe-coding.tw/courses/car-advanced-s3-cam.html`
   - Pass criteria: no duplicated global nav/header blocks.

3. Access route (no `File not found`)
   - Open from catalog: `https://vibe-coding.tw/start.html`, `https://vibe-coding.tw/basic.html`, `https://vibe-coding.tw/advanced.html`
   - Open from dashboard deep link sample:
     - `https://vibe-coding.tw/dashboard.html?unitId=start-01-unit-html5-basics.html&tab=assignments`
   - Pass criteria: active unit open succeeds, no `File not found`.

Checklist result placeholder:

- [x] FAB visibility passed on all 4 sample pages
- [x] Nav de-duplication passed on all 4 sample pages
- [x] Access route passed (catalog + dashboard deep link)

### 9.2 Phase B: `entryUnitId` promotion

Goal: reduce dependency on `*-master-*` as runtime entry.

Tasks:

1. For each `metadata_lessons` record, ensure `entryUnitId` points to a valid unit file.
2. Update entry pages (`start.html`, `basic.html`, `advanced.html`) to navigate by `entryUnitId`.
3. Keep master pages as compatibility wrappers during one full teaching cycle.

Exit criteria:

- Entry flows do not require `classroomUrl` master file to boot
- Course landing pages still preserve current UX

### 9.3 Phase C: Master retirement

Goal: convert remaining masters into lightweight compatibility redirects, then remove.

Tasks:

1. Generate redirect mapping from each `*-master-*` to `entryUnitId`.
2. Add migration note and rollback plan for each removed master.
3. Remove master references from:
   - token generation
   - frontend fallback logic
   - admin/debug tools

Exit criteria:

- `serveCourse` scope checks based on course/unit mapping, not master filename
- No production link depends on `*-master-*`

---

## 10. Milestones And KPIs

### M1 (stability)

- Scope: complete Phase A
- KPI:
  - Course page critical UI incident (`FAB missing`, `duplicate nav`, `broken topnav`) = 0 for 7 consecutive days
  - `/courses/*` support tickets related to page shell < 2 per week

### M2 (entry migration)

- Scope: complete Phase B
- KPI:
  - `entryUnitId` coverage in `metadata_lessons` = 100%
  - Start/basic/advanced entry click-through success > 99%

### M3 (master retirement)

- Scope: complete Phase C
- KPI:
  - Runtime dependency on `*-master-*` = 0
  - Rollback test for at least 3 representative courses passed
3. Prepare first external content repo pilot (`zh-TW` + `en`, one unit each).
4. Plan master-page retirement for `start/basic/advanced` after tabs are replaced by unit-page native navigation.
5. Collect 46 missing video/doc URLs for advanced course files from content owners.

Status update (2026-05-26):

- Step 1 completed via:
  - `functions/scripts/backfill_users_orders_region_fields.js --apply`
  - Applied defaults:
    - users: `locale=zh-TW`, `region=TW`
    - orders: `region=TW`, `channelType=direct`, `policyId=""`, `pricingVersion=v1`
- Step 2 completed:
  - `calculateMonthlySharing` now reads `orders.policyId` (fallback to `default-v1`)
  - `profit_ledger` now stores `policyId` + `policySnapshot`
  - role-based ledger lines: `tutor`, `agent`, `courseDev`
  - script added: `functions/scripts/seed_revenue_share_policies.js`
- Seeding & Order Compatibility updates:
  - Added robust backward-compatible purchase matching (`itemContainsUnit` fallback) in `hasActiveOrderForCourse` and `resolveStudentAssignmentAccess`.
  - Configured `functions/scripts/seed-emulator.js` to seed canonical `courseId` in orders items, users/orders regional defaults, and default revenue share policies.
  - Set prepare track landing to target resolved unit entries, while preserving original master entry URLs for started/basic/advanced tracks.

---

## 9. Risks And Controls

Risks:

1. Authorization regressions during route migration
2. Grade writeback failures during ID migration
3. Content version drift between repo and deployment
4. Cache confusion after deploys
5. Revenue policy misconfiguration affecting margin

Controls:

1. Backward-compatible fallback while migrating (now narrowed to legacy master tokens)
2. Ledger policy snapshots
3. Versioned content sync
4. Cache busting
5. Admin audit trail and simulation

---

## 11. Immediate Cleanup Queue (2026-05-26)

### 11.1 `*-master-*` retirement inventory (no deletion yet)

Current master wrappers still present in runtime content:

- `functions/private_courses/*-master-*.html`: **30 files**
  - `start`: 5
  - `basic`: 10
  - `adv`: 15

Blocking dependencies still active:

1. `public/start.html`, `public/basic.html`, `public/advanced.html` explicitly keep master-entry behavior for tab UX.
2. `functions/index.js` still contains legacy master-scope compatibility fallback for authorization (`serveCourse`).
3. `public/js/dashboard.js` still has master-aware rendering/filter branches in Tutor/Admin views.

Decision:

- Keep all 30 master wrappers during current pilot window.
- Do not remove until Actions billing window resumes and full validation matrix is re-run.

### 11.2 Firestore-only cleanup candidates (safe to do now)

These are low-risk doc/script/runtime cleanups we can do before master retirement:

1. Docs consistency: [Completed 2026-05-26]
   - replace examples that imply master IDs are primary course IDs.
   - keep wording: Firestore canonical data is source of truth.
2. Script defaults: [Completed 2026-05-26]
   - `functions/scripts/seed-emulator.js` still seeds many `*-master-*` IDs; migrate seed set to canonical `entryUnitId` + unit IDs.
3. Dashboard cleanup: [Completed 2026-05-26]
   - trim non-essential master-title fallback branches that are only for legacy display.

### 11.3 Deferred items (wait for billing recovery)

1. `Verify autograde and writeback are unaffected` (requires Actions run evidence).
2. `Remove *-master-* only after pilot validation succeeds`.
