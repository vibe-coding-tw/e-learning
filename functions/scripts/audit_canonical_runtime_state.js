#!/usr/bin/env node
/**
 * Audit runtime canonical state for P0.1 / P0.2 cleanup.
 *
 * Usage:
 *   node functions/scripts/audit_canonical_runtime_state.js
 *   node functions/scripts/audit_canonical_runtime_state.js --out=report.json
 */

const fs = require("fs");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STATIC_ORDER_ITEM_ALIAS_TARGETS = {
  ydb63bg: "car-starter-web-app",
  a45cwlak: "car-starter-web-ble",
  a7smdfeq: "car-starter-remote-control",
  hkdq5j3m: "car-starter-touch-events",
  io5rxgxl: "car-starter-joystick-lab",

  "01-master-getting-started.html": "common-developer-identity",
  "02-master-ai-agents.html": "common-agent-mode",
  "03-master-wifi-motor.html": "common-github-classroom",
  "start-01-master-web-app.html": "car-starter-web-app",
  "start-02-master-web-ble.html": "car-starter-web-ble",
  "start-03-master-remote-control.html": "car-starter-remote-control",
  "start-04-master-touch-events.html": "car-starter-touch-events",
  "start-05-master-joystick-lab.html": "car-starter-joystick-lab",
  "basic-01-master-environment.html": "car-basic-environment",
  "adv-01-master-s3-cam.html": "car-advanced-s3-cam",

  // Historical short codes inferred from co-occurring legacy master keys in existing orders.
  "72uyaadl": "common-developer-identity",
  "rs7hx3nf": "car-basic-environment",
  "w4lrkqmk": "car-advanced-s3-cam",

  // Historical proposed prepare course keys
  "tw-common-getting-started": "common-developer-identity",
  "tw-common-ai-agents": "common-agent-mode",
  "tw-common-wifi-motor": "common-github-classroom"
};

function arg(name, fallback = "") {
  const token = process.argv.find((t) => t.startsWith(`${name}=`));
  return token ? token.slice(name.length + 1) : fallback;
}

function normalizeFile(value = "") {
  return String(value || "").split("/").pop().split("?")[0].trim();
}

function normalizeCanonicalCourseKey(value = "") {
  return normalizeFile(value).replace(/\.html$/i, "").replace(/^(?:tw|en)-/i, "");
}

function normalizeLoose(value = "") {
  return normalizeFile(value).replace(/\.html$/i, "").toLowerCase();
}

function isLegacyMaster(value = "") {
  return /(?:^|-)master-.*\.html$/i.test(String(value || ""));
}

function isCourseLike(lesson = {}) {
  const metadataType = String(lesson.metadataType || "").toLowerCase();
  if (metadataType === "product" || metadataType === "legacy_product") return false;
  return Array.isArray(lesson.courseUnits) || String(lesson.courseId || "").endsWith(".html");
}

function pickCatalogIdentity(lesson = {}) {
  return String(
    normalizeCanonicalCourseKey(lesson.docId) ||
    normalizeCanonicalCourseKey(lesson.courseKey) ||
    normalizeCanonicalCourseKey(lesson.contentRef) ||
    normalizeCanonicalCourseKey(lesson.courseId) ||
    normalizeCanonicalCourseKey(lesson.id) ||
    ""
  ).trim();
}

function getPrimaryMetadataIdentity(lesson = {}) {
  const metadataType = String(lesson.metadataType || "").toLowerCase();
  if (metadataType === "product" || metadataType === "legacy_product") {
    return String(lesson.docId || lesson.courseKey || lesson.courseId || lesson.id || "").trim();
  }
  return String(
    normalizeCanonicalCourseKey(lesson.docId) ||
    normalizeCanonicalCourseKey(lesson.courseKey) ||
    normalizeCanonicalCourseKey(lesson.contentRef) ||
    normalizeCanonicalCourseKey(lesson.courseId) ||
    normalizeCanonicalCourseKey(lesson.id) ||
    ""
  ).trim();
}

function resolveCanonicalItemKey(aliasMap, canonicalKeySet, itemKey) {
  const normalized = normalizeLoose(itemKey);
  const direct = aliasMap.get(normalized);
  if (direct) return direct;

  const targetAlias = STATIC_ORDER_ITEM_ALIAS_TARGETS[normalized] || STATIC_ORDER_ITEM_ALIAS_TARGETS[normalizeFile(itemKey)];
  if (!targetAlias) return "";

  if (canonicalKeySet.has(targetAlias)) return targetAlias;
  return aliasMap.get(normalizeLoose(targetAlias)) || targetAlias;
}

async function main() {
  const outPath = arg("--out", "");
  const lessonsSnap = await db.collection("metadata_lessons").get();
  const ordersSnap = await db.collection("orders").get();

  const lessons = lessonsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const orders = ordersSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

  const report = {
    generatedAt: new Date().toISOString(),
    metadataLessons: {
      total: lessons.length,
      courseLike: 0,
      legacyMasterRefs: [],
      missingCanonicalFields: [],
      entryUnitNotInCourseUnits: [],
      duplicateVisibleCards: []
    },
    orders: {
      total: orders.length,
      ordersWithLegacyItemKeys: [],
      unknownItemKeys: []
    }
  };

  const visibleCourseBuckets = new Map();

  for (const lesson of lessons) {
    if (!isCourseLike(lesson)) continue;
    report.metadataLessons.courseLike += 1;

    const refs = {
      courseId: normalizeFile(lesson.courseId || ""),
      entryUnitId: normalizeFile(lesson.entryUnitId || ""),
      contentRef: normalizeFile(lesson.contentRef || ""),
      courseUnits: (Array.isArray(lesson.courseUnits) ? lesson.courseUnits : []).map((x) => normalizeFile(x))
    };

    const legacyFields = [];
    if (isLegacyMaster(refs.courseId)) legacyFields.push("courseId");
    if (isLegacyMaster(refs.entryUnitId)) legacyFields.push("entryUnitId");
    if (isLegacyMaster(refs.contentRef)) legacyFields.push("contentRef");
    if (refs.courseUnits.some(isLegacyMaster)) legacyFields.push("courseUnits");
    if (legacyFields.length) {
      report.metadataLessons.legacyMasterRefs.push({
        docId: lesson.id,
        courseKey: lesson.courseKey || "",
        title: lesson.title || "",
        fields: legacyFields
      });
    }

    const missing = [];
    if (!String(lesson.courseKey || "").trim()) missing.push("courseKey");
    if (!refs.entryUnitId) missing.push("entryUnitId");
    if (!Array.isArray(lesson.courseUnits) || lesson.courseUnits.length === 0) missing.push("courseUnits");
    if (missing.length) {
      report.metadataLessons.missingCanonicalFields.push({
        docId: lesson.id,
        courseId: lesson.courseId || "",
        title: lesson.title || "",
        missing
      });
    }

    if (refs.entryUnitId && Array.isArray(lesson.courseUnits) && lesson.courseUnits.length > 0) {
      const hasEntry = lesson.courseUnits.some((unitId) => normalizeLoose(unitId) === normalizeLoose(refs.entryUnitId));
      if (!hasEntry) {
        report.metadataLessons.entryUnitNotInCourseUnits.push({
          docId: lesson.id,
          courseId: lesson.courseId || "",
          entryUnitId: refs.entryUnitId,
          courseUnits: refs.courseUnits
        });
      }
    }

    if (lesson.hiddenFromCatalog !== true && lesson.isDeprecated !== true) {
      const bucketKey = normalizeLoose(pickCatalogIdentity(lesson));
      if (!visibleCourseBuckets.has(bucketKey)) visibleCourseBuckets.set(bucketKey, []);
      visibleCourseBuckets.get(bucketKey).push({
        docId: lesson.id,
        courseId: lesson.courseId || "",
        courseKey: lesson.courseKey || "",
        title: lesson.title || ""
      });
    }
  }

  for (const [bucketKey, items] of visibleCourseBuckets.entries()) {
    if (items.length > 1) {
      report.metadataLessons.duplicateVisibleCards.push({
        identity: bucketKey,
        items
      });
    }
  }

  const lessonAliasMap = new Map();
  const canonicalKeySet = new Set();
  lessons.forEach((lesson) => {
    const canonicalKey = getPrimaryMetadataIdentity(lesson);
    if (!canonicalKey) return;
    canonicalKeySet.add(canonicalKey);
    const add = (value) => {
      const key = normalizeLoose(value);
      if (!key) return;
      if (!lessonAliasMap.has(key)) lessonAliasMap.set(key, canonicalKey);
    };
    add(lesson.id);
    add(lesson.docId);
    add(lesson.courseId);
    add(lesson.courseKey);
    add(normalizeCanonicalCourseKey(lesson.courseKey));
    add(normalizeCanonicalCourseKey(lesson.contentRef));
    add(lesson.entryUnitId);
    if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
    if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);
  });

  for (const order of orders) {
    const items = order.items || {};
    const legacyKeys = [];
    const unknownKeys = [];
    Object.keys(items).forEach((itemKey) => {
      if (isLegacyMaster(itemKey)) legacyKeys.push(itemKey);
      const resolved = resolveCanonicalItemKey(lessonAliasMap, canonicalKeySet, itemKey);
      if (!resolved) unknownKeys.push(itemKey);
    });
    if (legacyKeys.length) {
      report.orders.ordersWithLegacyItemKeys.push({
        orderId: order.id,
        uid: order.uid || "",
        keys: legacyKeys
      });
    }
    if (unknownKeys.length) {
      report.orders.unknownItemKeys.push({
        orderId: order.id,
        uid: order.uid || "",
        keys: unknownKeys
      });
    }
  }

  const summary = {
    metadataLegacyMasterRefs: report.metadataLessons.legacyMasterRefs.length,
    metadataMissingCanonicalFields: report.metadataLessons.missingCanonicalFields.length,
    metadataEntryUnitMismatch: report.metadataLessons.entryUnitNotInCourseUnits.length,
    metadataDuplicateVisibleCards: report.metadataLessons.duplicateVisibleCards.length,
    ordersWithLegacyItemKeys: report.orders.ordersWithLegacyItemKeys.length,
    ordersWithUnknownItemKeys: report.orders.unknownItemKeys.length
  };

  console.log(JSON.stringify(summary, null, 2));
  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`report written: ${outPath}`);
  }
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
