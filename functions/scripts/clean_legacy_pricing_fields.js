#!/usr/bin/env node
/**
 * Migration script to clean legacy pricing fields from metadata_lessons collection.
 *
 * Usage:
 *   node functions/scripts/clean_legacy_pricing_fields.js --dry-run
 *   node functions/scripts/clean_legacy_pricing_fields.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

const fieldsToDelete = [
  "price",
  "pricing",
  "prices",
  "priceByLocale",
  "priceByRegion",
  "priceMap",
  "price_twd",
  "price_usd",
  "currency",
  "pricingVersion",
  "pricingUpdatedAt",
  "pricingUpdatedBy",
  "localizedPrices",
  "localizedPricing",
  "priceLocales",
  "pricesByRegion"
];

async function main() {
  const isApply = process.argv.includes("--apply");
  const mode = isApply ? "APPLY" : "DRY_RUN";

  console.log(`[clean_legacy_pricing_fields] Starting in mode=${mode}...`);

  const snap = await db.collection("metadata_lessons").get();
  console.log(`[clean_legacy_pricing_fields] Found ${snap.size} metadata_lessons documents.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    const patch = {};
    const foundFields = [];

    fieldsToDelete.forEach((field) => {
      if (data[field] !== undefined) {
        patch[field] = admin.firestore.FieldValue.delete();
        foundFields.push(field);
      }
    });

    if (foundFields.length === 0) {
      skippedCount += 1;
      continue;
    }

    console.log(`[metadata_lessons] docId=${doc.id} | Found fields to delete: ${foundFields.join(", ")}`);

    if (isApply) {
      await doc.ref.update(patch);
      updatedCount += 1;
    } else {
      updatedCount += 1;
    }
  }

  console.log(`[clean_legacy_pricing_fields] Summary: updated=${updatedCount} skipped=${skippedCount} mode=${mode}`);
}

main().catch((err) => {
  console.error("[clean_legacy_pricing_fields] failed:", err);
  process.exit(1);
});
