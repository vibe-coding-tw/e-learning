#!/usr/bin/env node
/**
 * Backfill metadata_lessons metadataType / isPhysical consistency.
 *
 * Goal:
 * - Make metadataType the source of truth.
 * - Normalize legacy_product -> product.
 * - Keep isPhysical as a compat field that always matches metadataType.
 *
 * Usage:
 *   node functions/scripts/backfill_metadata_lessons_metadata_type.js --dry-run
 *   node functions/scripts/backfill_metadata_lessons_metadata_type.js --apply
 *   node functions/scripts/backfill_metadata_lessons_metadata_type.js --apply --delete-isPhysical
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();
const DELETE = admin.firestore.FieldValue.delete();

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    deleteIsPhysical: false,
    syncIsPhysical: false,
    limit: 0,
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (token === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
    } else if (token === "--delete-isPhysical") {
      args.deleteIsPhysical = true;
    } else if (token === "--sync-isPhysical") {
      args.syncIsPhysical = true;
    } else if (token.startsWith("--limit=")) {
      const raw = Number(token.split("=")[1] || "0");
      args.limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    }
  }

  return args;
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function deriveMetadataType(lesson = {}) {
  const metadataType = normalizeText(lesson.metadataType || "").toLowerCase();
  const isPhysical = lesson.isPhysical === true;

  if (metadataType === "product" || metadataType === "legacy_product" || isPhysical) return "product";
  return "course";
}

function buildPatch(lesson = {}, { deleteIsPhysical = false, syncIsPhysical = false } = {}) {
  const nextMetadataType = deriveMetadataType(lesson);
  const nextIsPhysical = nextMetadataType === "product";
  const patch = {
    metadataType: nextMetadataType,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (deleteIsPhysical) {
    patch.isPhysical = DELETE;
  } else if (syncIsPhysical) {
    patch.isPhysical = nextIsPhysical;
  }

  return patch;
}

function diffSummary(current = {}, next = {}, { deleteIsPhysical = false, syncIsPhysical = false } = {}) {
  const changed = [];
  const keys = deleteIsPhysical || syncIsPhysical ? ["metadataType", "isPhysical"] : ["metadataType"];
  for (const key of keys) {
    const currentValue = current?.[key];
    const nextValue = next?.[key];
    if (key === "isPhysical" && deleteIsPhysical) {
      if (currentValue !== undefined) changed.push(key);
      continue;
    }
    if (JSON.stringify(currentValue ?? null) !== JSON.stringify(nextValue ?? null)) {
      changed.push(key);
    }
  }
  return changed;
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "APPLY" : "DRY_RUN";
  const deleteHint = args.deleteIsPhysical ? " delete-isPhysical" : "";
  console.log(`[backfill_metadata_lessons_metadata_type] mode=${mode}${deleteHint}`);

  const snap = await db.collection("metadata_lessons").get();
  const docs = snap.docs.slice(0, args.limit > 0 ? args.limit : undefined);
  console.log(`[backfill_metadata_lessons_metadata_type] docs=${docs.length}`);

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const data = doc.data() || {};
    const patch = buildPatch(data, { deleteIsPhysical: args.deleteIsPhysical, syncIsPhysical: args.syncIsPhysical });
    const changedKeys = diffSummary(data, patch, { deleteIsPhysical: args.deleteIsPhysical, syncIsPhysical: args.syncIsPhysical });

    if (changedKeys.length === 0) {
      skipped += 1;
      continue;
    }

    console.log(`\n[DOC] ${doc.id}`);
    console.log(`metadataType: ${normalizeText(data.metadataType || "") || "(empty)"} -> ${patch.metadataType}`);
    console.log(`changedKeys=${changedKeys.join(",")}`);

    if (args.apply) {
      await doc.ref.set(patch, { merge: true });
      updated += 1;
      console.log("[UPDATED]");
    } else {
      console.log("[DRY-RUN] would update");
    }
  }

  console.log(`\n[SUMMARY] updated=${updated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error("[ERROR]", err && err.stack ? err.stack : err);
  process.exit(1);
});
