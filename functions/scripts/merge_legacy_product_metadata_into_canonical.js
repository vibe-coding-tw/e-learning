#!/usr/bin/env node
/**
 * Merge legacy product metadata docs into canonical product docs.
 *
 * Goal:
 * - Reduce the active "product/spec" metadata set from 6 docs to 4 docs.
 * - Keep the richer legacy product data, but attach it to the canonical
 *   product docs used by the current runtime.
 *
 * Canonical targets:
 * - esp32-c3  <- merge from 0WZW0gURA4rOzKIFh64j
 * - esp32-s3  <- merge from udyru8h76d1z3DhCy5i3
 *
 * Usage:
 *   node functions/scripts/merge_legacy_product_metadata_into_canonical.js --dry-run
 *   node functions/scripts/merge_legacy_product_metadata_into_canonical.js --apply
 *   node functions/scripts/merge_legacy_product_metadata_into_canonical.js --apply --out=report.json
 */

const fs = require("fs");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "e-learning-942f7"
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    apply: false,
    out: ""
  };
  for (const token of argv.slice(2)) {
    if (token === "--apply") args.apply = true;
    if (token === "--dry-run") args.apply = false;
    if (token.startsWith("--out=")) args.out = token.slice("--out=".length).trim();
  }
  return args;
}

function uniqueStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [values]).map((v) => String(v || "").trim()).filter(Boolean)));
}

function unionArrays(...arrays) {
  return uniqueStrings(arrays.flat());
}

function mergeLegacyIntoCanonical(source = {}, target = {}, canonical = {}) {
  const merged = {
    ...source,
    ...target,
    ...canonical
  };

  merged.courseId = canonical.courseId || target.courseId || target.productId || target.id || source.productId || source.courseId || source.id || "";
  merged.productId = canonical.productId || target.productId || target.courseKey || source.productId || source.courseId || "";
  merged.courseKey = canonical.courseKey || target.courseKey || `product-${merged.productId || target.id || ""}`;
  merged.metadataType = "product";
  merged.isPhysical = true;
  merged.isDeprecated = false;
  merged.hiddenFromCatalog = false;
  merged.courseUnits = [];
  merged.aliases = unionArrays(
    source.aliases,
    target.aliases,
    canonical.aliases,
    source.courseId,
    source.courseKey,
    source.productId,
    target.courseId,
    target.courseKey,
    target.productId
  );
  merged.legacyProductIds = unionArrays(
    source.legacyProductIds,
    target.legacyProductIds,
    source.courseId,
    source.courseKey,
    source.productId
  );
  merged.productIds = unionArrays(
    source.productIds,
    target.productIds,
    merged.productId
  );
  merged.learningPaths = unionArrays(source.learningPaths, target.learningPaths, canonical.learningPaths);
  merged.normalizationNote = canonical.normalizationNote || target.normalizationNote || source.normalizationNote || "Consolidated legacy product metadata into canonical product doc.";
  merged.updatedAt = admin.firestore.FieldValue.serverTimestamp();

  return merged;
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";
  const merges = [
    {
      sourceDocId: "0WZW0gURA4rOzKIFh64j",
      targetDocId: "esp32-c3",
      canonical: {
        courseId: "esp32-c3",
        productId: "esp32-c3",
        courseKey: "product-esp32-c3",
        normalizationNote: "Consolidated from legacy car intro product metadata."
      }
    },
    {
      sourceDocId: "udyru8h76d1z3DhCy5i3",
      targetDocId: "esp32-s3",
      canonical: {
        courseId: "esp32-s3",
        productId: "esp32-s3",
        courseKey: "product-esp32-s3",
        normalizationNote: "Consolidated from legacy car advanced product metadata."
      }
    }
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    merges: [],
    deletedSourceDocIds: []
  };

  for (const merge of merges) {
    const sourceRef = db.collection("metadata_lessons").doc(merge.sourceDocId);
    const targetRef = db.collection("metadata_lessons").doc(merge.targetDocId);
    const sourceSnap = await sourceRef.get();
    const targetSnap = await targetRef.get();

    if (!sourceSnap.exists) {
      report.merges.push({
        sourceDocId: merge.sourceDocId,
        targetDocId: merge.targetDocId,
        skipped: true,
        reason: "source-missing"
      });
      continue;
    }
    if (!targetSnap.exists) {
      report.merges.push({
        sourceDocId: merge.sourceDocId,
        targetDocId: merge.targetDocId,
        skipped: true,
        reason: "target-missing"
      });
      continue;
    }

    const sourceData = sourceSnap.data() || {};
    const targetData = targetSnap.data() || {};
    const nextData = mergeLegacyIntoCanonical(sourceData, targetData, merge.canonical);

    report.merges.push({
      sourceDocId: merge.sourceDocId,
      targetDocId: merge.targetDocId,
      beforeTarget: {
        courseId: targetData.courseId || "",
        courseKey: targetData.courseKey || "",
        productId: targetData.productId || "",
        title: targetData.title || "",
        price: targetData.price || 0
      },
      source: {
        courseId: sourceData.courseId || "",
        courseKey: sourceData.courseKey || "",
        productId: sourceData.productId || "",
        title: sourceData.title || "",
        price: sourceData.price || 0
      },
      nextTarget: {
        courseId: nextData.courseId || "",
        courseKey: nextData.courseKey || "",
        productId: nextData.productId || "",
        title: nextData.title || "",
        price: nextData.price || 0,
        aliases: nextData.aliases || [],
        legacyProductIds: nextData.legacyProductIds || [],
        productIds: nextData.productIds || []
      }
    });

    if (args.apply) {
      await targetRef.set(nextData, { merge: true });
      await sourceRef.delete();
      report.deletedSourceDocIds.push(merge.sourceDocId);
    }
  }

  const summary = {
    mode: report.mode,
    merges: report.merges.length,
    deletedSourceDocIds: report.deletedSourceDocIds.length
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({
    sample: report.merges
  }, null, 2));

  if (args.out) {
    fs.writeFileSync(args.out, JSON.stringify(report, null, 2));
    console.log(`report written: ${args.out}`);
  }
}

main().catch((err) => {
  console.error("[ERROR]", err && err.stack ? err.stack : err);
  process.exit(1);
});
