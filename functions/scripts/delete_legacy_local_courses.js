#!/usr/bin/env node
/**
 * Delete legacy course lesson docs and matching dealer_price_books entries
 * from the local Firestore emulator only.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 node functions/scripts/delete_legacy_local_courses.js --dry-run
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 node functions/scripts/delete_legacy_local_courses.js --apply
 */

const admin = require("firebase-admin");

const TARGET_KEYS = [
  "adv-01-master-esp32-s3-camera",
  "adv-02-master-image-streaming",
  "adv-03-master-advanced-ble-communication",
  "adv-04-master-sensor-integration",
  "adv-05-master-computer-vision-basics",
  "adv-06-master-advanced-computer-vision",
  "adv-07-master-ui-framework-design",
  "adv-08-master-image-processing-practice",
  "adv-09-master-ai-recognition-applications",
  "adv-10-master-differential-drive-control",
  "adv-11-master-photoelectric-sensors",
  "adv-12-master-pid-control",
  "adv-13-master-system-robustness",
  "adv-14-master-the-art-of-debugging",
  "adv-15-master-system-architecture-design",
  "basic-01-master-environment",
  "basic-02-master-environment",
  "basic-03-master-environment",
  "basic-04-master-environment",
  "basic-05-master-environment",
  "basic-06-master-environment",
  "basic-07-master-environment",
  "basic-08-master-environment",
  "basic-09-master-environment",
  "basic-10-master-environment",
  "car-advanced.html",
  "car-basic.html",
  "car-starter-car-starter-joystick-lab",
  "car-starter-car-starter-remote-control",
  "car-starter-car-starter-touch-events",
  "car-starter-car-starter-web-app",
  "car-starter-car-starter-web-ble",
  "car-starter.html"
];

function normalizeKey(value = "") {
  return String(value || "")
    .trim()
    .split("/")
    .pop()
    .split("?")[0]
    .split("#")[0]
    .replace(/\.html$/i, "")
    .toLowerCase();
}

function normalizeLegacyKey(value = "") {
  let v = normalizeKey(value);
  if (!v) return "";
  v = v.replace(/^(?:tw|en)-/i, "");
  v = v.replace(/^prepare-/i, "common-");
  v = v.replace(/^(start)-\d{2}-unit-/i, "car-starter-");
  v = v.replace(/^(basic)-\d{2}-unit-/i, "car-basic-");
  v = v.replace(/^(adv|advanced)-\d{2}-unit-/i, "car-advanced-");
  v = v.replace(/^\d{2}-(?:unit|lesson|master)-/i, "common-");
  v = v.replace(/-master-/i, "-unit-");
  return v;
}

function addKeySet(keys, value) {
  if (!value) return;
  const raw = String(value).trim();
  if (!raw) return;
  keys.add(raw);
  keys.add(raw.replace(/\.html$/i, ""));
  keys.add(normalizeKey(raw));
  keys.add(normalizeLegacyKey(raw));
}

function lessonMatchKeys(lesson = {}) {
  const keys = new Set();
  addKeySet(keys, lesson.id);
  addKeySet(keys, lesson.docId);
  addKeySet(keys, lesson.courseId);
  addKeySet(keys, lesson.courseKey);
  addKeySet(keys, lesson.entryUnitId);
  addKeySet(keys, lesson.sku);
  return keys;
}

function priceBookMatchKeys(book = {}) {
  const keys = new Set();
  addKeySet(keys, book.id);
  addKeySet(keys, book.priceBookId);
  addKeySet(keys, book.docId);
  addKeySet(keys, book.sourceDocId);
  addKeySet(keys, book.lessonId);
  addKeySet(keys, book.courseId);
  addKeySet(keys, book.metadataLessonId);
  addKeySet(keys, book.sourceLessonId);
  return keys;
}

async function deleteDocumentRecursive(docRef, stats) {
  const subCollections = await docRef.listCollections();
  for (const subCol of subCollections) {
    const snap = await subCol.get();
    for (const subDoc of snap.docs) {
      await deleteDocumentRecursive(subDoc.ref, stats);
    }
  }
  await docRef.delete();
  stats.deleted += 1;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

  if (!emulatorHost) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required. This script only works against the local emulator.");
  }
  if (!/^127\.0\.0\.1:18080$/.test(emulatorHost) && !/^localhost:18080$/.test(emulatorHost)) {
    throw new Error(`Refusing to run against non-local emulator host: ${emulatorHost}`);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: "e-learning-942f7" });
  }

  const db = admin.firestore();
  const targetSet = new Set(TARGET_KEYS.flatMap((key) => [key, normalizeKey(key), normalizeLegacyKey(key)]).filter(Boolean));
  const stats = {
    lessonsMatched: 0,
    priceBooksMatched: 0,
    deleted: 0
  };

  const lessonSnap = await db.collection("metadata_lessons").get();
  const lessonsToDelete = [];
  lessonSnap.forEach((doc) => {
    const lesson = { id: doc.id, ...(doc.data() || {}) };
    const keys = lessonMatchKeys(lesson);
    const matched = [...keys].some((key) => targetSet.has(key));
    if (matched) {
      lessonsToDelete.push(doc.ref);
    }
  });

  const priceBookSnap = await db.collection("dealer_price_books").get();
  const priceBooksToDelete = [];
  priceBookSnap.forEach((doc) => {
    const book = { id: doc.id, ...(doc.data() || {}) };
    const keys = priceBookMatchKeys(book);
    const matched = [...keys].some((key) => targetSet.has(key));
    if (matched) {
      priceBooksToDelete.push(doc.ref);
    }
  });

  console.log(`[cleanup-legacy-local-courses] mode=${dryRun ? "DRY_RUN" : "APPLY"} emulator=${emulatorHost}`);
  console.log(`[cleanup-legacy-local-courses] lessons to delete: ${lessonsToDelete.length}`);
  console.log(`[cleanup-legacy-local-courses] pricebooks to delete: ${priceBooksToDelete.length}`);
  console.log(`[cleanup-legacy-local-courses] lesson ids: ${lessonsToDelete.map((ref) => ref.id).join(", ")}`);
  console.log(`[cleanup-legacy-local-courses] pricebook ids: ${priceBooksToDelete.map((ref) => ref.id).join(", ")}`);

  if (dryRun) return;

  for (const ref of lessonsToDelete) {
    await deleteDocumentRecursive(ref, stats);
  }
  for (const ref of priceBooksToDelete) {
    await deleteDocumentRecursive(ref, stats);
  }

  console.log(`[cleanup-legacy-local-courses] done deleted=${stats.deleted}`);
}

main().catch((err) => {
  console.error("[cleanup-legacy-local-courses] failed:", err);
  process.exit(1);
});
