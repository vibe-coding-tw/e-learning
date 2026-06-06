#!/usr/bin/env node
/**
 * Deprecated: legacy product docs were consolidated into the canonical
 * `esp32-c3` and `esp32-s3` metadata_lessons documents.
 *
 * This script is kept only as a historical pointer and now intentionally
 * performs no writes. The canonical product docs already contain the merged
 * metadata and aliases.
 *
 * Usage:
 *   node functions/scripts/normalize_legacy_product_metadata.js
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

const TARGETS = [];

async function main() {
  const { apply } = parseArgs(process.argv);
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`[normalize_legacy_product_metadata] mode=${mode}`);
  console.log("[NOOP] Legacy product docs have already been consolidated into esp32-c3 / esp32-s3.");
  console.log("[NOOP] This script is retained only for historical reference.");
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
