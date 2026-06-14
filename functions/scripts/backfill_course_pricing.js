#!/usr/bin/env node
/**
 * Backfill dealer_price_books from metadata_lessons.
 *
 * This script no longer writes legacy price fields back to metadata_lessons.
 * It only seeds or updates the default distributor price books that the
 * runtime now treats as the source of truth.
 *
 * Supported course families:
 * - started  -> TWD 1200 / USD 40
 * - basic    -> TWD 1500 / USD 50
 * - advanced -> TWD 1800 / USD 60
 *
 * Usage:
 *   node functions/scripts/backfill_course_pricing.js --dry-run
 *   node functions/scripts/backfill_course_pricing.js --apply
 *   node functions/scripts/backfill_course_pricing.js --apply --limit=20
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
    overwrite: false,
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
    if (token === "--overwrite") {
      args.overwrite = true;
      continue;
    }
    if (token.startsWith("--limit=")) {
      args.limit = Number(token.split("=")[1] || "0") || 0;
    }
  }

  return args;
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function buildDocId(lesson = {}) {
  return normalizeText(
    lesson.id ||
    lesson.courseId ||
    lesson.courseKey ||
    lesson.entryUnitId ||
    lesson.sku ||
    ""
  );
}

function getDefaultPrice(category, currency = "TWD") {
  const normalizedCategory = normalizeText(category).toLowerCase();
  const isUsd = String(currency || "").toUpperCase() === "USD";
  const table = {
    started: { TWD: 1200, USD: 40 },
    basic: { TWD: 1500, USD: 50 },
    advanced: { TWD: 1800, USD: 60 },
  };
  const categoryPrice = table[normalizedCategory];
  if (categoryPrice) {
    return categoryPrice[isUsd ? "USD" : "TWD"];
  }
  return 0;
}

function buildPriceBookId(distributorId, docId) {
  return normalizeText(`${distributorId}_${docId}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, "-");
}

function buildPriceBookPayload({ distributorId, docId, title, currency, salePrice }) {
  return {
    distributorId,
    docId,
    sourceDocId: docId,
    sourceDocTitle: title || docId,
    currency,
    salePrice: normalizeAmount(salePrice),
    isActive: true,
    version: "v1",
    updatedBy: "backfill_course_pricing",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function shouldBackfill(docData = {}) {
  const category = normalizeText(docData.category || "").toLowerCase();
  return category === "started" || category === "basic" || category === "advanced";
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";
  const snap = await db.collection("metadata_lessons").get();
  const docs = args.limit > 0 ? snap.docs.slice(0, args.limit) : snap.docs;

  console.log(`[backfill_course_pricing] mode=${mode} docs=${docs.length} overwrite=${args.overwrite ? "yes" : "no"}`);

  let inspected = 0;
  let updated = 0;
  let skipped = 0;
  let createdBooks = 0;

  for (const doc of docs) {
    inspected += 1;
    const data = doc.data() || {};
    if (!shouldBackfill(data)) {
      skipped += 1;
      continue;
    }

    const docId = normalizeText(doc.id || data.id || data.docId);
    const resolvedDocId = buildDocId({ ...data, id: docId });
    const title = normalizeText(data.title || data.name || resolvedDocId);
    const twPrice = getDefaultPrice(data.category, "TWD");
    const usdPrice = getDefaultPrice(data.category, "USD");

    const items = [
      {
        distributorId: "default-twd",
        currency: "TWD",
        salePrice: twPrice,
      },
      {
        distributorId: "default-usd",
        currency: "USD",
        salePrice: usdPrice,
      },
    ];

    for (const item of items) {
      const priceBookId = buildPriceBookId(item.distributorId, resolvedDocId);
      const ref = db.collection("dealer_price_books").doc(priceBookId);
      const snap = await ref.get();
      const exists = snap.exists;
      const current = snap.data() || {};

      if (exists && !args.overwrite) {
        skipped += 1;
        continue;
      }

        const payload = buildPriceBookPayload({
          distributorId: item.distributorId,
          docId: resolvedDocId,
          title,
          currency: item.currency,
          salePrice: item.salePrice,
        });

        const changed = JSON.stringify({
          distributorId: current.distributorId,
          docId: current.docId,
          sourceDocId: current.sourceDocId,
          currency: current.currency,
          salePrice: current.salePrice,
          isActive: current.isActive,
          version: current.version,
        }) !== JSON.stringify({
          distributorId: payload.distributorId,
          docId: payload.docId,
          sourceDocId: payload.sourceDocId,
          currency: payload.currency,
          salePrice: payload.salePrice,
          isActive: payload.isActive,
        version: payload.version,
      });

      if (!changed) {
        skipped += 1;
        continue;
      }

      console.log(
        `[dealer_price_books] ${mode.toUpperCase()} docId=${priceBookId} ` +
        `docId=${resolvedDocId} distributorId=${item.distributorId} currency=${item.currency} salePrice=${item.salePrice}`
      );

      if (args.apply) {
        await ref.set({
          ...payload,
          createdAt: exists && current.createdAt ? current.createdAt : payload.createdAt,
        }, { merge: true });
      }
      updated += 1;
      createdBooks += exists ? 0 : 1;
    }
  }

  console.log(`[summary] inspected=${inspected} updated=${updated} createdBooks=${createdBooks} skipped=${skipped} mode=${mode}`);
}

main().catch((err) => {
  console.error("[backfill_course_pricing] failed:", err);
  process.exit(1);
});
