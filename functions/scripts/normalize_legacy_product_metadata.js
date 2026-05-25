#!/usr/bin/env node
/**
 * Normalize legacy product-like documents in metadata_lessons.
 *
 * Why:
 * - Keep course metadata and product metadata distinguishable.
 * - Avoid forcing non-course items into courseId canonical pattern.
 *
 * Usage:
 *   node functions/scripts/normalize_legacy_product_metadata.js --dry-run
 *   node functions/scripts/normalize_legacy_product_metadata.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = { apply: false };
  for (const token of argv.slice(2)) {
    if (token === "--apply") args.apply = true;
  }
  return args;
}

const TARGETS = [
  {
    docId: "0WZW0gURA4rOzKIFh64j",
    patch: {
      metadataType: "legacy_product",
      productId: "legacy-car-intro",
      courseKey: "legacy-car-intro",
      category: "prepare",
      isPhysical: true,
      isDeprecated: true,
      hiddenFromCatalog: true,
      normalizationNote: "Legacy car intro product metadata retained for history.",
    },
  },
  {
    docId: "udyru8h76d1z3DhCy5i3",
    patch: {
      metadataType: "legacy_product",
      productId: "legacy-car-advanced",
      courseKey: "legacy-car-advanced",
      category: "prepare",
      isPhysical: true,
      isDeprecated: true,
      hiddenFromCatalog: true,
      normalizationNote: "Legacy car advanced product metadata retained for history.",
    },
  },
  {
    docId: "esp32-c3",
    patch: {
      metadataType: "product",
      productId: "esp32-c3",
      courseKey: "product-esp32-c3",
      category: "prepare",
      isPhysical: true,
      isDeprecated: false,
      hiddenFromCatalog: false,
      normalizationNote: "Physical product metadata for prepare page hardware card.",
    },
  },
  {
    docId: "esp32-s3",
    patch: {
      metadataType: "product",
      productId: "esp32-s3",
      courseKey: "product-esp32-s3",
      category: "prepare",
      isPhysical: true,
      isDeprecated: false,
      hiddenFromCatalog: false,
      normalizationNote: "Physical product metadata for prepare page hardware card.",
    },
  },
];

async function main() {
  const { apply } = parseArgs(process.argv);
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`[normalize_legacy_product_metadata] mode=${mode}`);

  let updated = 0;
  let missing = 0;

  for (const target of TARGETS) {
    const ref = db.collection("metadata_lessons").doc(target.docId);
    const snap = await ref.get();

    if (!snap.exists) {
      console.log(`[MISSING] docId=${target.docId}`);
      missing += 1;
      continue;
    }

    const before = snap.data() || {};
    const patch = {
      ...target.patch,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`\n[DOC] ${target.docId}`);
    console.log(`before.courseId=${before.courseId || ""}`);
    console.log(`before.category=${before.category || ""}`);
    console.log(`before.isPhysical=${before.isPhysical === true ? "true" : "false"}`);
    console.log(`patch=${JSON.stringify(target.patch)}`);

    if (apply) {
      await ref.set(patch, { merge: true });
      console.log("[UPDATED]");
      updated += 1;
    } else {
      console.log("[DRY-RUN] would update");
      updated += 1;
    }
  }

  console.log(`\n[SUMMARY] updated=${updated} missing=${missing} mode=${mode}`);
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});

