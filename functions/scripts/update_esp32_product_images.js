#!/usr/bin/env node
/**
 * Restore external image URLs for esp32-c3 and esp32-s3 product docs.
 *
 * Usage:
 *   node functions/scripts/update_esp32_product_images.js --dry-run
 *   node functions/scripts/update_esp32_product_images.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

const PRODUCT_IMAGE_PATCHES = {
  "esp32-c3": {
    cardImageUrl: "https://down-tw.img.susercontent.com/file/tw-11134208-81ztp-me1d6y243mdjc3",
    imageUrl: "https://down-tw.img.susercontent.com/file/tw-11134208-81ztp-me1d6y243mdjc3",
  },
  "esp32-s3": {
    cardImageUrl: "https://www.kidstoylover.com/cdn/shop/files/1_adc99452-bd07-49f0-95a1-a5d7990ed0f5.jpg?v=1715839568&width=1445",
    imageUrl: "https://www.kidstoylover.com/cdn/shop/files/1_adc99452-bd07-49f0-95a1-a5d7990ed0f5.jpg?v=1715839568&width=1445",
  },
};

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    dryRun: argv.includes("--dry-run") || !argv.includes("--apply"),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "APPLY" : "DRY-RUN";
  console.log(`[update_esp32_product_images] mode=${mode}`);

  for (const [docId, patch] of Object.entries(PRODUCT_IMAGE_PATCHES)) {
    const ref = db.collection("metadata_lessons").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`[missing] ${docId}`);
      continue;
    }

    const before = snap.data() || {};
    console.log(`\n[doc] ${docId}`);
    console.log(`before.imageUrl=${before.imageUrl || ""}`);
    console.log(`before.cardImageUrl=${before.cardImageUrl || ""}`);
    console.log(`patch=${JSON.stringify(patch)}`);

    if (args.apply) {
      await ref.set({
        ...patch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: "system-product-image-update",
      }, { merge: true });
      console.log("[updated]");
    } else {
      console.log("[dry-run] would update");
    }
  }
}

main().catch((err) => {
  console.error("[update_esp32_product_images] failed:", err);
  process.exit(1);
});
