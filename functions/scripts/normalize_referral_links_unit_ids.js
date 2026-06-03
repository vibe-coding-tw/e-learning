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
  "01-master-getting-started.html": "common-developer-identity.html",
  "02-master-ai-agents.html": "common-agent-mode.html",
  "03-master-wifi-motor.html": "common-github-classroom.html",
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

const LEGACY_UNIT_TO_CANONICAL_UNIT = {
  "01-unit-vscode-online.html": "common-vscode-online.html",
  "01-unit-vscode-setup.html": "common-vscode-setup.html",
  "02-unit-agent-mode.html": "common-agent-mode.html",
  "02-unit-vibe-coding.html": "common-vibe-coding.html",
  "02-unit-web-agents.html": "common-web-agents.html",
  "03-unit-github-classroom.html": "common-github-classroom.html",
  "03-unit-motor-ramping.html": "common-motor-ramping.html",
  "03-unit-wifi-setup.html": "common-wifi-setup.html"
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

function normalizeGitHubUrl(url = "") {
  let s = String(url || "").trim();
  if (!s) return "";
  s = s.replace(/^http:\/\//i, "https://");
  if (!/^https?:\/\//i.test(s)) {
    if (/^classroom\.github\.com\//i.test(s)) s = `https://${s}`;
    else if (/^github\.com\/classroom\//i.test(s)) s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    if (host === "classroom.github.com" && /^\/a\/[A-Za-z0-9_-]+$/i.test(path)) {
      return `https://classroom.github.com${path}`;
    }
    if (host === "github.com" && /^\/classroom\/a\/[A-Za-z0-9_-]+$/i.test(path)) {
      return `https://github.com${path}`;
    }
  } catch (_) {}
  return "";
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
    deletedMalformed: [],
    unresolved: []
  };

  for (const doc of linksSnap.docs) {
    const data = doc.data() || {};
    const rawUnitId = normalizeFile(data.unitId || "");
    if (!rawUnitId) {
      report.unresolved.push({ docId: doc.id, unitId: "", reason: "missing" });
      continue;
    }

    const mappedLegacy = LEGACY_UNIT_TO_CANONICAL_UNIT[rawUnitId] || LEGACY_MASTER_TO_CANONICAL[rawUnitId] || rawUnitId;
    const canonicalUnitId = unitAliasMap.get(normalizeLoose(mappedLegacy)) || "";

    if (!canonicalUnitId) {
      const normalizedUrl = normalizeGitHubUrl(data.normalizedUrl || data.url || "");
      if (!normalizedUrl) {
        report.deletedMalformed.push({
          docId: doc.id,
          unitId: rawUnitId,
          url: String(data.url || "").trim(),
          normalizedUrl: String(data.normalizedUrl || "").trim(),
          reason: "malformed-referral-index"
        });
        if (args.apply) {
          await doc.ref.delete();
        }
        continue;
      }
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
    deletedMalformed: report.deletedMalformed.length,
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
