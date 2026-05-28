#!/usr/bin/env node
/**
 * Normalize referral_links.unitId toward canonical unit ids.
 *
 * Usage:
 *   node functions/scripts/normalize_referral_links_unit_ids.js --dry-run
 *   node functions/scripts/normalize_referral_links_unit_ids.js --apply
 *   node functions/scripts/normalize_referral_links_unit_ids.js --apply --out=report.json
 */

const fs = require("fs");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const LEGACY_MASTER_TO_CANONICAL = {
  "01-master-getting-started.html": "tw-common-developer-identity.html",
  "02-master-ai-agents.html": "tw-common-agent-mode.html",
  "03-master-wifi-motor.html": "tw-common-github-classroom.html",
  "adv-01-master-s3-cam.html": "adv-01-unit-jpeg-quality.html",
  "adv-02-master-video.html": "adv-02-unit-bandwidth-fps.html",
  "adv-03-master-ble-advanced.html": "adv-03-unit-ble-mtu.html",
  "adv-04-master-sensors.html": "adv-04-unit-filter-algorithms.html",
  "adv-05-master-cv.html": "adv-05-unit-centroid-error.html",
  "adv-06-master-cv-advanced.html": "adv-06-unit-centroid-algorithm.html",
  "adv-07-master-ui-framework.html": "adv-07-unit-chart-canvas.html",
  "adv-08-master-image-processing.html": "adv-08-unit-color-spaces.html",
  "adv-09-master-ai-recognition.html": "adv-09-unit-cnn-audio.html",
  "adv-10-master-diff-drive.html": "adv-10-unit-api-design.html",
  "adv-11-master-photoelectric.html": "adv-11-unit-hardware-interrupts.html",
  "adv-12-master-pid.html": "adv-12-unit-code-logic.html",
  "adv-13-master-robustness.html": "adv-13-unit-robustness.html",
  "adv-14-master-debugging-art.html": "adv-14-unit-debugging-art.html",
  "adv-15-master-architecture.html": "adv-15-unit-ble-async.html",
  "basic-01-master-environment.html": "basic-01-unit-drivers-ports.html",
  "basic-02-master-ota-architecture.html": "basic-02-unit-ota-principles.html",
  "basic-03-master-io-mapping.html": "basic-03-unit-adc-resolution.html",
  "basic-04-master-pwm-control.html": "basic-04-unit-h-bridge.html",
  "basic-05-master-ble-gatt.html": "basic-05-unit-advertising-connection.html",
  "basic-06-master-http-web.html": "basic-06-unit-cors-security.html",
  "basic-07-master-wifi-modes.html": "basic-07-unit-async-webserver.html",
  "basic-08-master-joystick-math.html": "basic-08-unit-joystick-mapping.html",
  "basic-09-master-multitasking.html": "basic-09-unit-hardware-timer.html",
  "basic-10-master-fsm.html": "basic-10-unit-fsm.html",
  "start-01-master-web-app.html": "start-01-unit-flexbox-layout.html",
  "start-02-master-web-ble.html": "start-02-unit-ble-async.html",
  "start-03-master-remote-control.html": "start-03-unit-control-panel.html",
  "start-04-master-touch-events.html": "start-04-unit-long-press.html",
  "start-05-master-joystick-lab.html": "start-05-unit-canvas-joystick.html"
};

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    out: (argv.find((t) => t.startsWith("--out=")) || "").split("=")[1] || ""
  };
}

function normalizeFile(value = "") {
  return String(value || "").split("/").pop().split("?")[0].trim();
}

function normalizeLoose(value = "") {
  return normalizeFile(value).replace(/\.html$/i, "").toLowerCase();
}

async function main() {
  const args = parseArgs(process.argv);
  const lessonsSnap = await db.collection("metadata_lessons").get();
  const linksSnap = await db.collection("referral_links").get();

  const lessons = lessonsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const unitAliasMap = new Map();
  lessons.forEach((lesson) => {
    (Array.isArray(lesson.courseUnits) ? lesson.courseUnits : []).forEach((unitId) => {
      unitAliasMap.set(normalizeLoose(unitId), normalizeFile(unitId));
    });
    if (lesson.entryUnitId) {
      const entry = normalizeFile(lesson.entryUnitId);
      unitAliasMap.set(normalizeLoose(entry), entry);
    }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? "apply" : "dry-run",
    updated: [],
    unresolved: []
  };

  for (const doc of linksSnap.docs) {
    const data = doc.data() || {};
    const rawUnitId = normalizeFile(data.unitId || "");
    if (!rawUnitId) {
      report.unresolved.push({ docId: doc.id, unitId: "", reason: "missing" });
      continue;
    }

    const mappedLegacy = LEGACY_MASTER_TO_CANONICAL[rawUnitId] || rawUnitId;
    const canonicalUnitId = unitAliasMap.get(normalizeLoose(mappedLegacy)) || "";

    if (!canonicalUnitId) {
      report.unresolved.push({ docId: doc.id, unitId: rawUnitId, reason: "not-found-in-metadata" });
      continue;
    }

    if (canonicalUnitId === rawUnitId) continue;

    report.updated.push({ docId: doc.id, before: rawUnitId, after: canonicalUnitId });
    if (args.apply) {
      await doc.ref.set({
        unitId: canonicalUnitId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  const summary = {
    mode: report.mode,
    updated: report.updated.length,
    unresolved: report.unresolved.length
  };
  console.log(JSON.stringify(summary, null, 2));
  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
    console.log(`report written: ${args.out}`);
  }
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
