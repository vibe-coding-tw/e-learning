#!/usr/bin/env node
/**
 * Backfill metadata_settings/learning_paths.categoryLabels to canonical schema.
 *
 * Canonical shape:
 * {
 *   schemaVersion: 1,
 *   categoryLabels: {
 *     common: { "zh-TW": "...", en: "..." },
 *     "car-starter": { "zh-TW": "...", en: "..." }
 *   }
 * }
 *
 * Usage:
 *   node functions/scripts/backfill_learning_paths_category_labels.js --dry-run
 *   node functions/scripts/backfill_learning_paths_category_labels.js --apply
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

function normalizeCanonicalLearningPathKey(value = "") {
  const v = String(value || "").trim().toLowerCase().split("/").pop().split("?")[0].split("#")[0].replace(/\.html$/i, "");
  if (!v) return "";
  if (v === "common" || v === "car-starter" || v === "car-basic" || v === "car-advanced") return v;
  if (/^(?:tw|en)-common$/i.test(v)) return "common";
  if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(v)) return v.replace(/^(?:tw|en)-/i, "");
  if (/^start-\d{2}-unit-/i.test(v)) return "car-starter";
  if (/^basic-\d{2}-unit-/i.test(v)) return "car-basic";
  if (/^(?:adv|advanced)-\d{2}-unit-/i.test(v)) return "car-advanced";
  if (/^\d{2}-unit-/i.test(v)) return "common";
  if (/^prepare-\d+/i.test(v)) return "common";
  return v;
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

function isLocaleBucketKey(key = "") {
  const normalized = normalizeText(key);
  return normalized === "zh-TW" || normalized === "zhTW" || normalized === "zh" || normalized === "tw" || normalized === "en" || normalized === "en-US";
}

function extractSourceCategoryLabels(data = {}) {
  const source = {};
  if (data.categoryLabels && typeof data.categoryLabels === "object" && !Array.isArray(data.categoryLabels)) {
    Object.assign(source, data.categoryLabels);
  }

  for (const key of ["zh-TW", "zhTW", "zh", "tw", "en", "en-US"]) {
    const value = data[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      source[key] = value;
    }
  }

  return source;
}

function mergeEntry(target, rawValue, localeHint = "") {
  const incoming = normalizeCategoryLabelEntry(rawValue);
  if (!target["zh-TW"]) target["zh-TW"] = incoming["zh-TW"] || incoming.en || "";
  if (!target.en) target.en = incoming.en || incoming["zh-TW"] || "";

  if (localeHint === "zh-TW") {
    const text = normalizeText(rawValue);
    if (text && !target["zh-TW"]) target["zh-TW"] = text;
    if (text && !target.en) target.en = text;
  } else if (localeHint === "en") {
    const text = normalizeText(rawValue);
    if (text && !target.en) target.en = text;
    if (text && !target["zh-TW"]) target["zh-TW"] = text;
  }
}

function normalizeCategoryLabels(sourceMap = {}) {
  const result = {};
  if (!sourceMap || typeof sourceMap !== "object" || Array.isArray(sourceMap)) return result;

  const ensure = (canonicalKey) => {
    if (!result[canonicalKey]) result[canonicalKey] = {};
    return result[canonicalKey];
  };

  const keys = Object.keys(sourceMap);
  for (const key of keys) {
    const value = sourceMap[key];
    if (isLocaleBucketKey(key) && value && typeof value === "object" && !Array.isArray(value)) {
      const localeHint = key.toLowerCase().startsWith("en") ? "en" : "zh-TW";
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const canonical = normalizeCanonicalLearningPathKey(nestedKey);
        if (!canonical) continue;
        const entry = ensure(canonical);
        mergeEntry(entry, nestedValue, localeHint);
      }
      continue;
    }

    const canonical = normalizeCanonicalLearningPathKey(key);
    if (!canonical) continue;
    const entry = ensure(canonical);
    mergeEntry(entry, value, "");
  }

  const preferredOrder = ["common", "car-starter", "car-basic", "car-advanced"];
  const sortedKeys = [
    ...preferredOrder.filter((key) => result[key]),
    ...Object.keys(result).filter((key) => !preferredOrder.includes(key)).sort((a, b) => a.localeCompare(b)),
  ];

  const normalized = {};
  for (const key of sortedKeys) {
    const entry = result[key] || {};
    const zh = normalizeText(entry["zh-TW"] || entry.en || "");
    const en = normalizeText(entry.en || entry["zh-TW"] || "");
    if (!zh && !en) continue;
    normalized[key] = {
      "zh-TW": zh || en,
      en: en || zh,
    };
  }

  return normalized;
}

function diffKeys(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changed = [];
  for (const key of keys) {
    if (JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null)) {
      changed.push(key);
    }
  }
  return changed.sort();
}

async function main() {
  const args = parseArgs(process.argv);
  const docRef = db.collection("metadata_settings").doc("learning_paths");
  const snap = await docRef.get();
  const data = snap.exists ? (snap.data() || {}) : {};
  const source = extractSourceCategoryLabels(data);
  const categoryLabels = normalizeCategoryLabels(source);
  const patch = {
    schemaVersion: 1,
    categoryLabels,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const legacyRootLocaleKeys = ["zh-TW", "zhTW", "zh", "tw", "en", "en-US"].filter((key) => key in data);
  for (const key of legacyRootLocaleKeys) {
    patch[key] = DELETE;
  }

  const beforeSummary = {
    schemaVersion: data.schemaVersion || null,
    categoryLabels: data.categoryLabels || null,
    legacyRootLocaleKeys,
  };
  const afterSummary = {
    schemaVersion: 1,
    categoryLabels,
    legacyRootLocaleKeys: [],
  };

  const changes = diffKeys(beforeSummary, afterSummary);
  console.log(`[backfill_learning_paths_category_labels] mode=${args.apply ? "apply" : "dry-run"} doc=${docRef.path}`);
  console.log(`[backfill_learning_paths_category_labels] changed=${changes.length ? changes.join(",") : "none"}`);

  if (!args.apply) {
    console.log(JSON.stringify(afterSummary, null, 2));
    return;
  }

  if (!Object.keys(categoryLabels).length && !legacyRootLocaleKeys.length && (data.schemaVersion === 1)) {
    console.log("[backfill_learning_paths_category_labels] nothing to update");
    return;
  }

  await docRef.set(patch, { merge: true });
  console.log("[backfill_learning_paths_category_labels] update complete");
}

main().catch((err) => {
  console.error("[backfill_learning_paths_category_labels] failed:", err);
  process.exit(1);
});
