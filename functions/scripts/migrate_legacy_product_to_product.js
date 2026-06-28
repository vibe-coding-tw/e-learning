#!/usr/bin/env node
// Migration complete — dry-run confirmed 0 docs with metadataType === "legacy_product" in production.
// This script can be archived if the migration is finalized.
const admin = require("firebase-admin");

const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

if (!DRY_RUN && !APPLY) {
  console.log("Usage: node functions/scripts/migrate_legacy_product_to_product.js --dry-run");
  console.log("       node functions/scripts/migrate_legacy_product_to_product.js --apply");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrate() {
  const snapshot = await db.collection("metadata_lessons")
    .where("metadataType", "==", "legacy_product")
    .get();

  console.log(`Found ${snapshot.size} docs with metadataType === "legacy_product"`);

  if (snapshot.empty) {
    console.log("Nothing to migrate.");
    return;
  }

  const docs = snapshot.docs;
  if (DRY_RUN) {
    for (const doc of docs) {
      console.log(`  WOULD UPDATE ${doc.id}`);
    }
    console.log(`Dry-run: would migrate ${docs.length} docs`);
    return;
  }

  if (!APPLY) return;

  let updated = 0;
  let batch = db.batch();
  for (const doc of docs) {
    console.log(`  UPDATING ${doc.id}`);
    batch.update(doc.ref, { metadataType: "product" });
    updated++;
    if (updated % 500 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (updated % 500 !== 0) {
    await batch.commit();
  }
  console.log(`Migrated ${updated} docs from legacy_product → product`);
}

const DRY_APPLY_STR = DRY_RUN ? "dry-run" : "apply";

migrate()
  .then(() => {
    console.log("Migration complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
