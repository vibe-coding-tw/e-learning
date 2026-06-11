#!/usr/bin/env node
/**
 * Backfill custom/legacy keys to canonical document IDs in `orders` and `users` collections.
 *
 * Usage:
 *   node functions/scripts/backfill_legacy_keys_to_canonical_document_ids.js --dry-run
 *   node functions/scripts/backfill_legacy_keys_to_canonical_document_ids.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

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

  "72uyaadl": "common-developer-identity",
  "rs7hx3nf": "car-basic-environment",
  "w4lrkqmk": "car-advanced-s3-cam",

  "tw-common-getting-started": "common-developer-identity",
  "tw-common-ai-agents": "common-agent-mode",
  "tw-common-wifi-motor": "common-github-classroom"
};

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    }
    if (token === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
    }
  }

  return args;
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

function getPrimaryMetadataIdentity(lesson = {}) {
  const metadataType = String(lesson.metadataType || "").toLowerCase();
  if (lesson.isPhysical === true || metadataType === "product" || metadataType === "legacy_product") {
    return String(lesson.productId || lesson.courseKey || lesson.courseId || lesson.id || "").trim();
  }
  return String(
    normalizeCanonicalCourseKey(lesson.courseKey) ||
    normalizeCanonicalCourseKey(lesson.contentRef) ||
    normalizeCanonicalCourseKey(lesson.courseId) ||
    normalizeCanonicalCourseKey(lesson.id) ||
    lesson.productId ||
    ""
  ).trim();
}

function resolveCanonicalKey(aliasMap, canonicalKeySet, itemKey) {
  const normalized = normalizeLoose(itemKey);
  const direct = aliasMap.get(normalized);
  if (direct) return direct;

  const targetAlias = STATIC_ORDER_ITEM_ALIAS_TARGETS[normalized] || STATIC_ORDER_ITEM_ALIAS_TARGETS[normalizeFile(itemKey)];
  if (targetAlias && canonicalKeySet.has(targetAlias)) return targetAlias;

  // Cleanup tw/en prefix and start- -> car-starter-
  let canonical = normalized;
  if (/^(?:tw|en)-/i.test(canonical)) {
    canonical = canonical.replace(/^(?:tw|en)-/i, '');
  }
  if (/^start-\d{2}-unit-/i.test(canonical)) {
    canonical = canonical.replace(/^start-\d{2}-unit-/i, 'car-starter-');
  } else if (/^start-/i.test(canonical)) {
    canonical = canonical.replace(/^start-/i, 'car-starter-');
  } else if (/^basic-/i.test(canonical)) {
    canonical = canonical.replace(/^basic-/i, 'car-basic-');
  } else if (/^(?:adv|advanced)-/i.test(canonical)) {
    canonical = canonical.replace(/^(?:adv|advanced)-/i, 'car-advanced-');
  }

  if (canonicalKeySet.has(canonical)) return canonical;
  const aliasMatch = aliasMap.get(canonical);
  if (aliasMatch) return aliasMatch;

  return "";
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";
  console.log(`[backfill] Running in ${mode.toUpperCase()} mode...`);

  // 1. Load lessons metadata
  const lessonsSnap = await db.collection("metadata_lessons").get();
  const lessons = lessonsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  console.log(`Loaded ${lessons.length} lessons.`);

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
    add(lesson.courseId);
    add(lesson.courseKey);
    add(normalizeCanonicalCourseKey(lesson.courseKey));
    add(normalizeCanonicalCourseKey(lesson.contentRef));
    add(lesson.entryUnitId);
    add(lesson.productId);
    if (Array.isArray(lesson.productIds)) lesson.productIds.forEach(add);
    if (Array.isArray(lesson.legacyProductIds)) lesson.legacyProductIds.forEach(add);
    if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
    if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);
  });

  // 2. Backfill orders items map keys
  console.log("Checking orders collection...");
  const ordersSnap = await db.collection("orders").get();
  let updatedOrdersCount = 0;
  for (const doc of ordersSnap.docs) {
    const order = doc.data() || {};
    const items = order.items || {};
    let changed = false;
    const newItems = {};

    for (const [itemKey, itemVal] of Object.entries(items)) {
      const canonicalKey = resolveCanonicalKey(lessonAliasMap, canonicalKeySet, itemKey);
      if (canonicalKey && canonicalKey !== itemKey) {
        newItems[canonicalKey] = itemVal;
        changed = true;
      } else {
        newItems[itemKey] = itemVal;
      }
    }

    if (changed) {
      updatedOrdersCount++;
      console.log(`[orders] Need update docId=${doc.id}`);
      if (args.apply) {
        await doc.ref.update({ items: newItems, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }

  // 3. Backfill users tutorConfigs, unitAssignments, unitAssignmentMeta
  console.log("Checking users collection...");
  const usersSnap = await db.collection("users").get();
  let updatedUsersCount = 0;
  for (const doc of usersSnap.docs) {
    const user = doc.data() || {};
    const patch = {};
    let userChanged = false;

    // Check tutorConfigs
    if (user.tutorConfigs && typeof user.tutorConfigs === "object") {
      const newConfigs = {};
      let changed = false;
      for (const [key, val] of Object.entries(user.tutorConfigs)) {
        const canonicalKey = resolveCanonicalKey(lessonAliasMap, canonicalKeySet, key);
        if (canonicalKey && canonicalKey !== key) {
          newConfigs[canonicalKey] = val;
          changed = true;
        } else {
          newConfigs[key] = val;
        }
      }
      if (changed) {
        patch.tutorConfigs = newConfigs;
        userChanged = true;
      }
    }

    // Check unitAssignments
    if (user.unitAssignments && typeof user.unitAssignments === "object") {
      const newAssignments = {};
      let changed = false;
      for (const [key, val] of Object.entries(user.unitAssignments)) {
        const canonicalKey = resolveCanonicalKey(lessonAliasMap, canonicalKeySet, key);
        if (canonicalKey && canonicalKey !== key) {
          newAssignments[canonicalKey] = val;
          changed = true;
        } else {
          newAssignments[key] = val;
        }
      }
      if (changed) {
        patch.unitAssignments = newAssignments;
        userChanged = true;
      }
    }

    // Check unitAssignmentMeta
    if (user.unitAssignmentMeta && typeof user.unitAssignmentMeta === "object") {
      const newMeta = {};
      let changed = false;
      for (const [key, val] of Object.entries(user.unitAssignmentMeta)) {
        const canonicalKey = resolveCanonicalKey(lessonAliasMap, canonicalKeySet, key);
        if (canonicalKey && canonicalKey !== key) {
          newMeta[canonicalKey] = val;
          changed = true;
        } else {
          newMeta[key] = val;
        }
      }
      if (changed) {
        patch.unitAssignmentMeta = newMeta;
        userChanged = true;
      }
    }

    if (userChanged) {
      updatedUsersCount++;
      console.log(`[users] Need update docId=${doc.id} fields=${Object.keys(patch).join(", ")}`);
      if (args.apply) {
        await doc.ref.update({ ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }

  console.log(`\n[Summary] Mode: ${mode.toUpperCase()}`);
  console.log(`Orders updated: ${updatedOrdersCount}`);
  console.log(`Users updated: ${updatedUsersCount}`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
