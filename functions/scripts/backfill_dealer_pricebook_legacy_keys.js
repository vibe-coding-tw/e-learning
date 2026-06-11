#!/usr/bin/env node
/**
 * Backfill dealer_price_books with canonical lessonId / sourceLessonId.
 *
 * This is a migration tool only. It does not change pricing fields.
 *
 * Usage:
 *   node functions/scripts/backfill_dealer_pricebook_legacy_keys.js --dry-run
 *   node functions/scripts/backfill_dealer_pricebook_legacy_keys.js --apply
 *   node functions/scripts/backfill_dealer_pricebook_legacy_keys.js --apply --limit=100
 *   node functions/scripts/backfill_dealer_pricebook_legacy_keys.js --apply --price-book-id=docId
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    limit: 0,
    priceBookId: "",
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
      continue;
    }
    if (token === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
      continue;
    }
    if (token.startsWith("--limit=")) {
      args.limit = Number(token.split("=")[1] || "0") || 0;
      continue;
    }
    if (token.startsWith("--price-book-id=")) {
      args.priceBookId = token.split("=")[1] || "";
      continue;
    }
  }

  return args;
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeKey(value = "") {
  const raw = normalizeText(value);
  if (!raw) return "";
  return raw.replace(/\.html$/i, "").split("/").pop().split("?")[0];
}

function buildLessonAliases(lesson = {}) {
  const keys = new Set();
  const add = (value) => {
    const raw = normalizeKey(value);
    if (!raw) return;
    keys.add(raw);
    keys.add(`${raw}.html`);
  };

  add(lesson.id);
  add(lesson.courseId);
  add(lesson.courseKey);
  add(lesson.entryUnitId);
  add(lesson.contentRef);
  add(lesson.productId);
  add(lesson.sku);
  if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
  if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);
  return keys;
}

function buildLessonIndex(lessons = []) {
  const byId = new Map();
  const byAlias = new Map();

  for (const lesson of lessons) {
    const lessonId = normalizeText(lesson.id);
    if (!lessonId) continue;
    byId.set(lessonId, lesson);

    const aliases = buildLessonAliases(lesson);
    for (const alias of aliases) {
      if (!byAlias.has(alias)) byAlias.set(alias, lesson);
    }
  }

  return { byId, byAlias };
}

function resolveLessonFromPriceBook(priceBook = {}, lessonIndex) {
  const directLessonId = normalizeText(priceBook.lessonId || priceBook.sourceLessonId);
  const candidateProductId = normalizeText(priceBook.productId);
  const candidates = [
    directLessonId,
    normalizeKey(directLessonId),
    candidateProductId,
    normalizeKey(candidateProductId),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (lessonIndex.byId.has(candidate)) {
      return lessonIndex.byId.get(candidate);
    }
    if (lessonIndex.byAlias.has(candidate)) {
      return lessonIndex.byAlias.get(candidate);
    }
  }

  return null;
}

function buildPatch(priceBook = {}, lesson = null) {
  if (!lesson) return null;

  const canonicalLessonId = normalizeText(lesson.id);
  if (!canonicalLessonId) return null;

  const currentLessonId = normalizeText(priceBook.lessonId);
  const currentSourceLessonId = normalizeText(priceBook.sourceLessonId);
  const sourceLessonId = currentSourceLessonId || currentLessonId || normalizeText(priceBook.productId) || canonicalLessonId;

  const patch = {};
  if (currentLessonId !== canonicalLessonId) {
    patch.lessonId = canonicalLessonId;
  }
  if (!currentSourceLessonId) {
    patch.sourceLessonId = sourceLessonId;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

async function loadLessons() {
  const snap = await db.collection("metadata_lessons").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function loadPriceBooks(args) {
  if (args.priceBookId) {
    const doc = await db.collection("dealer_price_books").doc(args.priceBookId).get();
    return doc.exists ? [doc] : [];
  }

  const snap = await db.collection("dealer_price_books").get();
  let docs = snap.docs;
  if (args.limit > 0) docs = docs.slice(0, args.limit);
  return docs;
}

async function commitBatch(batchOps) {
  if (batchOps.length === 0) return;
  const batch = db.batch();
  for (const { ref, patch } of batchOps) {
    batch.set(ref, {
      ...patch,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      dealerPriceBookLegacyBackfillAt: admin.firestore.FieldValue.serverTimestamp(),
      dealerPriceBookLegacyBackfillSource: "functions/scripts/backfill_dealer_pricebook_legacy_keys.js",
    }, { merge: true });
  }
  await batch.commit();
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";

  const [lessons, priceBookDocs] = await Promise.all([
    loadLessons(),
    loadPriceBooks(args),
  ]);

  const lessonIndex = buildLessonIndex(lessons);
  console.log(`[backfill_dealer_pricebook_legacy_keys] mode=${mode} lessons=${lessons.length} priceBooks=${priceBookDocs.length}`);

  let inspected = 0;
  let updated = 0;
  let skipped = 0;
  let unmatched = 0;
  const pendingWrites = [];

  for (const doc of priceBookDocs) {
    inspected += 1;
    const data = doc.data() || {};
    const lesson = resolveLessonFromPriceBook(data, lessonIndex);
    const patch = buildPatch(data, lesson);

    if (!lesson) {
      unmatched += 1;
      continue;
    }

    if (!patch) {
      skipped += 1;
      continue;
    }

    updated += 1;
    console.log(
      `[dealer_price_books] ${mode.toUpperCase()} docId=${doc.id} ` +
      `lessonId=${normalizeText(data.lessonId)} -> ${normalizeText(patch.lessonId || data.lessonId)} ` +
      `sourceLessonId=${normalizeText(data.sourceLessonId)} -> ${normalizeText(patch.sourceLessonId || data.sourceLessonId)}`
    );

    if (args.apply) {
      pendingWrites.push({ ref: doc.ref, patch });
      if (pendingWrites.length >= 400) {
        await commitBatch(pendingWrites.splice(0, pendingWrites.length));
      }
    }
  }

  if (args.apply && pendingWrites.length > 0) {
    await commitBatch(pendingWrites);
  }

  console.log(
    `[summary] inspected=${inspected} updated=${updated} skipped=${skipped} unmatched=${unmatched} mode=${mode}`
  );
}

main().catch((err) => {
  console.error("[backfill_dealer_pricebook_legacy_keys] failed:", err);
  process.exit(1);
});
