#!/usr/bin/env node
/**
 * Migrate metadata_lessons in production Firestore.
 * - Converts legacy courseId (e.g. *-master-*.html) to canonical entry unit courseId.
 * - Updates classroomUrl to point directly to the entryUnitId.
 * - Deletes legacy random alphanumeric documents and master-named documents.
 * 
 * Usage:
 *   node functions/scripts/migrate_lessons_classroom_urls.js --dry-run
 *   node functions/scripts/migrate_lessons_classroom_urls.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Exact mappings of legacy master pages to canonical unit IDs
const LEGACY_MASTER_TO_CANONICAL = {
  '01-master-getting-started.html': 'common-developer-identity.html',
  '02-master-ai-agents.html': 'common-agent-mode.html',
  '03-master-wifi-motor.html': 'common-github-classroom.html',
  'adv-01-master-s3-cam.html': 'adv-01-unit-jpeg-quality.html',
  'adv-02-master-video.html': 'adv-02-unit-bandwidth-fps.html',
  'adv-03-master-ble-advanced.html': 'adv-03-unit-ble-mtu.html',
  'adv-04-master-sensors.html': 'adv-04-unit-filter-algorithms.html',
  'adv-05-master-cv.html': 'adv-05-unit-centroid-error.html',
  'adv-06-master-cv-advanced.html': 'adv-06-unit-centroid-algorithm.html',
  'adv-07-master-ui-framework.html': 'adv-07-unit-chart-canvas.html',
  'adv-08-master-image-processing.html': 'adv-08-unit-color-spaces.html',
  'adv-09-master-ai-recognition.html': 'adv-09-unit-cnn-audio.html',
  'adv-10-master-diff-drive.html': 'adv-10-unit-api-design.html',
  'adv-11-master-photoelectric.html': 'adv-11-unit-hardware-interrupts.html',
  'adv-12-master-pid.html': 'adv-12-unit-code-logic.html',
  'adv-13-master-robustness.html': 'adv-13-unit-robustness.html',
  'adv-14-master-debugging-art.html': 'adv-14-unit-debugging-art.html',
  'adv-15-master-architecture.html': 'adv-15-unit-ble-async.html',
  'basic-01-master-environment.html': 'basic-01-unit-drivers-ports.html',
  'basic-02-master-ota-architecture.html': 'basic-02-unit-ota-principles.html',
  'basic-03-master-io-mapping.html': 'basic-03-unit-adc-resolution.html',
  'basic-04-master-pwm-control.html': 'basic-04-unit-h-bridge.html',
  'basic-05-master-ble-gatt.html': 'basic-05-unit-advertising-connection.html',
  'basic-06-master-http-web.html': 'basic-06-unit-cors-security.html',
  'basic-07-master-wifi-modes.html': 'basic-07-unit-async-webserver.html',
  'basic-08-master-joystick-math.html': 'basic-08-unit-joystick-mapping.html',
  'basic-09-master-multitasking.html': 'basic-09-unit-hardware-timer.html',
  'basic-10-master-fsm.html': 'basic-10-unit-fsm.html',
  'start-01-master-web-app.html': 'start-01-unit-flexbox-layout.html',
  'start-02-master-web-ble.html': 'start-02-unit-ble-async.html',
  'start-03-master-remote-control.html': 'start-03-unit-control-panel.html',
  'start-04-master-touch-events.html': 'start-04-unit-long-press.html',
  'start-05-master-joystick-lab.html': 'start-05-unit-canvas-joystick.html'
};

function buildContentRef(entryUnitId) {
  const file = String(entryUnitId || '').replace(/\.html$/i, '');
  if (!file) return '';
  if (/^start-\d{2}-unit-/.test(file)) return `courses/zh-TW/${file.replace(/^start-\d{2}-unit-/, 'tw-car-starter-')}.html`;
  if (/^basic-\d{2}-unit-/.test(file)) return `courses/zh-TW/${file.replace(/^basic-\d{2}-unit-/, 'tw-car-basic-')}.html`;
  if (/^(adv|advanced)-\d{2}-unit-/.test(file)) return `courses/zh-TW/${file.replace(/^(adv|advanced)-\d{2}-unit-/, 'tw-car-advanced-')}.html`;
  if (/^\d{2}-unit-/.test(file)) return `courses/zh-TW/${file.replace(/^\d{2}-unit-/, 'tw-common-')}.html`;
  return `courses/zh-TW/${file}.html`;
}

function normalizeCanonicalCourseKey(value = '') {
  return String(value || '')
    .split('/')
    .pop()
    .split('?')[0]
    .replace(/\.html$/i, '')
    .replace(/^(?:tw|en)-/i, '')
    .trim();
}

function resolveCanonicalCourseId(data) {
  const rawCourseId = String(data.courseId || '').trim();
  const firstUnit = Array.isArray(data.courseUnits) && data.courseUnits.length > 0 ? data.courseUnits[0] : '';
  const entryUnitId = String(data.entryUnitId || firstUnit || '').trim();
  
  if (LEGACY_MASTER_TO_CANONICAL[rawCourseId]) {
    return LEGACY_MASTER_TO_CANONICAL[rawCourseId];
  }
  
  if (rawCourseId.includes('-master-') && entryUnitId.endsWith('.html')) {
    return entryUnitId;
  }
  return rawCourseId || entryUnitId;
}

async function run() {
  const isApply = process.argv.includes("--apply");
  console.log(`🚀 Migrate Lessons Classroom URLs - Mode: ${isApply ? "APPLY" : "DRY RUN"}`);

  const snapshot = await db.collection("metadata_lessons").get();
  console.log(`Found ${snapshot.size} documents in production.\n`);

  for (const doc of snapshot.docs) {
    const docId = doc.id;
    const data = doc.data();

    // Preserve specs and spec recommendations
    if (data.metadataType === 'spec' || docId.startsWith('spec-') || docId === 'esp32-s3') {
      console.log(`  ℹ️ Preserving spec/product doc: ${docId}`);
      continue;
    }

    const category = data.category || '';
    if (!['prepare', 'starter', 'started', 'basic', 'advanced'].includes(category)) {
      console.log(`  ℹ️ Preserving unrelated category doc: ${docId} (${category})`);
      continue;
    }

    const firstUnit = Array.isArray(data.courseUnits) && data.courseUnits.length > 0 ? data.courseUnits[0] : '';
    const resolvedEntryUnitId = data.entryUnitId || firstUnit;

    if (!resolvedEntryUnitId) {
      console.warn(`  ⚠️ Warning: Document ${docId} has no units. Skipping.`);
      continue;
    }

    const canonicalCourseId = resolveCanonicalCourseId(data);
    const updatedPayload = {
      ...data,
      courseId: canonicalCourseId,
      entryUnitId: resolvedEntryUnitId,
      classroomUrl: `/courses/${resolvedEntryUnitId}`,
      contentRef: data.contentRef || buildContentRef(resolvedEntryUnitId),
      courseKey: normalizeCanonicalCourseKey(data.courseKey || data.contentRef || canonicalCourseId),
      track: data.track || (canonicalCourseId.startsWith('start-') || canonicalCourseId.startsWith('basic-') || canonicalCourseId.startsWith('adv-') ? 'car' : 'common'),
      level: data.level || (
        canonicalCourseId.startsWith('start-') ? 'starter' :
        canonicalCourseId.startsWith('basic-') ? 'basic' :
        canonicalCourseId.startsWith('adv-') ? 'advanced' :
        'common'
      )
    };

    const isRandomDocId = /^[a-zA-Z0-9]{20}$/.test(docId);
    const isLegacyMasterDocId = docId.includes('-master-');

    if (isRandomDocId || isLegacyMasterDocId || docId !== canonicalCourseId) {
      if (isApply) {
        // Write the canonical document
        await db.collection("metadata_lessons").doc(canonicalCourseId).set(updatedPayload);
        console.log(`  [WRITE] Canonical doc: ${canonicalCourseId}`);

        // Delete the legacy document
        await db.collection("metadata_lessons").doc(docId).delete();
        console.log(`  [DELETE] Legacy doc ID: ${docId} (was courseId: ${data.courseId})`);
      } else {
        console.log(`  [DRY RUN] Would write canonical doc '${canonicalCourseId}' and delete legacy doc '${docId}'`);
      }
    } else {
      // Document is already in correct place, just update the payload to canonical
      if (isApply) {
        await db.collection("metadata_lessons").doc(docId).update({
          courseId: canonicalCourseId,
          entryUnitId: resolvedEntryUnitId,
          classroomUrl: `/courses/${resolvedEntryUnitId}`,
          contentRef: updatedPayload.contentRef,
          courseKey: updatedPayload.courseKey,
          track: updatedPayload.track,
          level: updatedPayload.level
        });
        console.log(`  [UPDATE] Document ${docId} in place.`);
      } else {
        console.log(`  [DRY RUN] Would update document '${docId}' in place.`);
      }
    }
  }

  console.log("\nDone!");
}

run().catch(console.error);
