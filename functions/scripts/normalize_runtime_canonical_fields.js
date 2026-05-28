#!/usr/bin/env node
/**
 * Normalize runtime-facing Firestore fields toward canonical course identity.
 *
 * Scope:
 * - metadata_lessons: fill canonical fields when deterministically resolvable
 * - orders.items: rewrite legacy item keys to canonical course/product ids
 *
 * Usage:
 *   node functions/scripts/normalize_runtime_canonical_fields.js --dry-run
 *   node functions/scripts/normalize_runtime_canonical_fields.js --apply
 *   node functions/scripts/normalize_runtime_canonical_fields.js --apply --out=report.json
 */

const fs = require("fs");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STATIC_ORDER_ITEM_ALIAS_TARGETS = {
  // Legacy starter short codes
  ydb63bg: "tw-car-starter-web-app",
  a45cwlak: "tw-car-starter-web-ble",
  a7smdfeq: "tw-car-starter-remote-control",
  hkdq5j3m: "tw-car-starter-touch-events",
  io5rxgxl: "tw-car-starter-joystick-lab",

  // Legacy master entry pages
  "01-master-getting-started.html": "tw-common-developer-identity",
  "02-master-ai-agents.html": "tw-common-agent-mode",
  "03-master-wifi-motor.html": "tw-common-github-classroom",
  "start-01-master-web-app.html": "tw-car-starter-web-app",
  "start-02-master-web-ble.html": "tw-car-starter-web-ble",
  "start-03-master-remote-control.html": "tw-car-starter-remote-control",
  "start-04-master-touch-events.html": "tw-car-starter-touch-events",
  "start-05-master-joystick-lab.html": "tw-car-starter-joystick-lab",
  "basic-01-master-environment.html": "tw-car-basic-environment",
  "adv-01-master-s3-cam.html": "tw-car-advanced-s3-cam",

  // Historical short codes inferred from co-occurring legacy master keys in existing orders.
  "72uyaadl": "tw-common-developer-identity",
  "rs7hx3nf": "tw-car-basic-environment",
  "w4lrkqmk": "tw-car-advanced-s3-cam",

  // Historical proposed prepare course keys
  "tw-common-getting-started": "tw-common-developer-identity",
  "tw-common-ai-agents": "tw-common-agent-mode",
  "tw-common-wifi-motor": "tw-common-github-classroom"
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

function inferLevel(category = "", level = "") {
  const raw = String(level || category || "").toLowerCase();
  if (raw === "started" || raw === "start") return "starter";
  if (raw === "prepare") return "common";
  return raw || "common";
}

function inferLocale(locale = "") {
  const raw = String(locale || "").toLowerCase();
  if (raw.startsWith("zh")) return "tw";
  if (raw.startsWith("en")) return "en";
  return "tw";
}

function inferTrack(track = "") {
  return String(track || "").trim().toLowerCase() || "common";
}

function buildCourseKeyFromLesson(lesson = {}) {
  const locale = inferLocale(lesson.locale);
  const level = inferLevel(lesson.category, lesson.level);
  const track = inferTrack(lesson.track);
  const entryUnitId = normalizeFile(lesson.entryUnitId || "");
  const stem = entryUnitId.replace(/\.html$/i, "").replace(/^(?:tw|en)-(?:common|car-(?:starter|basic|advanced))-/i, "");
  if (!stem) return "";
  if (level === "common") return `${locale}-common-${stem}`;
  if (track === "common") return `${locale}-${level}-${stem}`;
  return `${locale}-${track}-${level}-${stem}`;
}

function isCourseLike(lesson = {}) {
  if (lesson.isPhysical === true) return false;
  const metadataType = String(lesson.metadataType || "").toLowerCase();
  if (metadataType === "product" || metadataType === "legacy_product") return false;
  return Array.isArray(lesson.courseUnits) || String(lesson.courseId || "").endsWith(".html");
}

function getPrimaryMetadataIdentity(lesson = {}) {
  const metadataType = String(lesson.metadataType || "").toLowerCase();
  if (lesson.isPhysical === true || metadataType === "product" || metadataType === "legacy_product") {
    return String(lesson.productId || lesson.courseKey || lesson.courseId || lesson.id || "").trim();
  }
  return String(lesson.courseKey || lesson.courseId || lesson.productId || lesson.id || "").trim();
}

function resolveCanonicalItemKey(aliasMap, canonicalKeySet, itemKey) {
  const normalized = normalizeLoose(itemKey);
  const direct = aliasMap.get(normalized);
  if (direct) return direct;

  const targetAlias = STATIC_ORDER_ITEM_ALIAS_TARGETS[normalized] || STATIC_ORDER_ITEM_ALIAS_TARGETS[normalizeFile(itemKey)];
  if (!targetAlias) return itemKey;

  if (canonicalKeySet.has(targetAlias)) return targetAlias;
  return aliasMap.get(normalizeLoose(targetAlias)) || targetAlias;
}

async function main() {
  const args = parseArgs(process.argv);
  const lessonsSnap = await db.collection("metadata_lessons").get();
  const lessons = lessonsSnap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...(doc.data() || {}) }));

  const aliasMap = new Map();
  const canonicalKeySet = new Set();
  lessons.forEach((lesson) => {
    const canonicalKey = getPrimaryMetadataIdentity(lesson);
    if (!canonicalKey) return;
    canonicalKeySet.add(canonicalKey);
    const add = (value) => {
      const key = normalizeLoose(value);
      if (!key) return;
      if (!aliasMap.has(key)) aliasMap.set(key, canonicalKey);
    };
    add(lesson.id);
    add(lesson.courseId);
    add(lesson.courseKey);
    add(lesson.entryUnitId);
    add(lesson.productId);
    if (Array.isArray(lesson.legacyProductIds)) lesson.legacyProductIds.forEach(add);
    if (Array.isArray(lesson.productIds)) lesson.productIds.forEach(add);
    if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
    if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? "apply" : "dry-run",
    metadataLessonsUpdated: [],
    ordersUpdated: []
  };

  for (const lesson of lessons) {
    if (!isCourseLike(lesson)) continue;
    const patch = {};
    const entryUnitId = normalizeFile(lesson.entryUnitId || "");
    const courseUnits = Array.isArray(lesson.courseUnits) ? lesson.courseUnits.map(normalizeFile).filter(Boolean) : [];

    if (!entryUnitId && courseUnits.length > 0) {
      patch.entryUnitId = courseUnits[0];
    }

    const nextEntryUnitId = patch.entryUnitId || entryUnitId;
    if (!String(lesson.courseKey || "").trim() && nextEntryUnitId) {
      const nextCourseKey = buildCourseKeyFromLesson({ ...lesson, entryUnitId: nextEntryUnitId });
      if (nextCourseKey) patch.courseKey = nextCourseKey;
    }

    if (Object.keys(patch).length > 0) {
      report.metadataLessonsUpdated.push({ docId: lesson.id, patch });
      if (args.apply) {
        await lesson.ref.set({
          ...patch,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }
  }

  const ordersSnap = await db.collection("orders").get();
  for (const orderDoc of ordersSnap.docs) {
    const data = orderDoc.data() || {};
    const beforeItems = data.items || {};
    const nextItems = {};
    let changed = false;

    for (const [itemKey, value] of Object.entries(beforeItems)) {
      const resolved = resolveCanonicalItemKey(aliasMap, canonicalKeySet, itemKey);
      if (resolved !== itemKey) changed = true;
      if (!(resolved in nextItems)) {
        nextItems[resolved] = value;
      } else {
        changed = true;
      }
    }

    if (changed) {
      report.ordersUpdated.push({
        orderId: orderDoc.id,
        beforeKeys: Object.keys(beforeItems),
        afterKeys: Object.keys(nextItems)
      });
      if (args.apply) {
        await orderDoc.ref.update({
          items: nextItems,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }

  const summary = {
    metadataLessonsUpdated: report.metadataLessonsUpdated.length,
    ordersUpdated: report.ordersUpdated.length,
    mode: report.mode
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
