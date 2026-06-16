#!/usr/bin/env node
/**
 * Fix metadata_settings/learning_paths category labels so top-nav and learning-path
 * can read localized labels from Firestore without inheriting Chinese fallback text.
 *
 * This script only patches the requested category labels and preserves all other
 * existing fields on the document.
 *
 * Usage:
 *   node functions/scripts/fix_learning_paths_metadata.js --dry-run
 *   node functions/scripts/fix_learning_paths_metadata.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

const TARGET_CATEGORY_LABELS = {
  common: {
    "zh-TW": "課前準備",
    en: "Preparation",
  },
  "car-starter": {
    "zh-TW": "入門課程",
    en: "Starter Course",
  },
  "car-basic": {
    "zh-TW": "基礎課程",
    en: "Basic Course",
  },
  "car-advanced": {
    "zh-TW": "進階課程",
    en: "Advanced Course",
  },
};

function parseArgs(argv) {
  const args = { apply: false, dryRun: true };
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
  }
  return args;
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeCategoryLabelEntry(value = {}) {
  if (typeof value === "string") {
    const text = normalizeText(value);
    return text ? { "zh-TW": text, en: text } : {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const zh = normalizeText(
    value["zh-TW"] ||
    value.zhTW ||
    value.zh ||
    value.tw ||
    value.labelZh ||
    value.twLabel ||
    value.label ||
    value.title ||
    ""
  );
  const en = normalizeText(
    value.en ||
    value["en-US"] ||
    value.labelEn ||
    value.enLabel ||
    value.titleEn ||
    value.label ||
    value.title ||
    ""
  );

  if (!zh && !en) return {};
  return {
    "zh-TW": zh || en,
    en: en || zh,
  };
}

function normalizeCategoryLabelsMap(sourceMap = {}) {
  const normalized = {};
  if (!sourceMap || typeof sourceMap !== "object" || Array.isArray(sourceMap)) return normalized;

  for (const [key, value] of Object.entries(sourceMap)) {
    const entry = normalizeCategoryLabelEntry(value);
    if (entry["zh-TW"] || entry.en) {
      normalized[key] = entry;
    }
  }

  return normalized;
}

function mergeCategoryLabels(existingMap = {}, targetMap = {}) {
  const normalized = normalizeCategoryLabelsMap(existingMap);
  for (const [key, value] of Object.entries(targetMap)) {
    const entry = normalizeCategoryLabelEntry(value);
    if (!entry["zh-TW"] && !entry.en) continue;
    normalized[key] = entry;
  }
  return normalized;
}

function summarizeChange(before = {}, after = {}) {
  return {
    before: before.categoryLabels || null,
    after: after.categoryLabels || null,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const docRef = db.collection("metadata_settings").doc("learning_paths");
  const snap = await docRef.get();
  const data = snap.exists ? (snap.data() || {}) : {};
  const existingCategoryLabels = normalizeCategoryLabelsMap(data.categoryLabels || {});
  const categoryLabels = mergeCategoryLabels(existingCategoryLabels, TARGET_CATEGORY_LABELS);

  const patch = {
    schemaVersion: Number(data.schemaVersion || 1),
    categoryLabels,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: "codex-fix-learning-paths-metadata",
  };

  const beforeSummary = {
    schemaVersion: data.schemaVersion || null,
    categoryLabels: existingCategoryLabels,
  };
  const afterSummary = {
    schemaVersion: patch.schemaVersion,
    categoryLabels,
  };

  console.log(`[fix_learning_paths_metadata] mode=${args.apply ? "apply" : "dry-run"} doc=${docRef.path}`);
  console.log(JSON.stringify(summarizeChange(beforeSummary, afterSummary), null, 2));

  if (!args.apply) return;

  await docRef.set(patch, { merge: true });
  console.log("[fix_learning_paths_metadata] update complete");
}

main().catch((err) => {
  console.error("[fix_learning_paths_metadata] failed:", err);
  process.exit(1);
});
