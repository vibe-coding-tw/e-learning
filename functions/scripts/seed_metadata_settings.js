#!/usr/bin/env node
/**
 * Seed metadata_settings defaults required by local and production runtime.
 *
 * Usage:
 *   node functions/scripts/seed_metadata_settings.js --dry-run
 *   node functions/scripts/seed_metadata_settings.js --apply
 *   node functions/scripts/seed_metadata_settings.js --apply --overwrite
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    dryRun: argv.includes("--dry-run") || !argv.includes("--apply"),
    overwrite: argv.includes("--overwrite"),
  };
}

function buildContentRuntimePayload(existing = {}) {
  const base = {
    enabled: true,
    repoOwner: "vibe-coding-tw",
    repoName: "content-repo",
    contentVersion: "main",
    defaultLocale: "en",
    defaultRegion: "US",
    defaultDistributorId: "default-usd",
    fallbackEnabled: true,
    cacheTtlSec: 300
  };

  return {
    ...base,
    enabled: existing.enabled === false ? false : base.enabled,
    repoOwner: String(existing.repoOwner || base.repoOwner).trim() || base.repoOwner,
    repoName: String(existing.repoName || base.repoName).trim() || base.repoName,
    contentVersion: String(existing.contentVersion || base.contentVersion).trim() || base.contentVersion,
    defaultLocale: String(existing.defaultLocale || base.defaultLocale).trim() || base.defaultLocale,
    defaultRegion: String(existing.defaultRegion || base.defaultRegion).trim() || base.defaultRegion,
    defaultDistributorId: String(existing.defaultDistributorId || base.defaultDistributorId).trim() || base.defaultDistributorId,
    fallbackEnabled: existing.fallbackEnabled === false ? false : base.fallbackEnabled,
    cacheTtlSec: Math.max(30, Number(existing.cacheTtlSec || base.cacheTtlSec) || base.cacheTtlSec)
  };
}

function buildLearningPathsPayload(existing = {}) {
  const baseLabels = {
    common: { "zh-TW": "課前準備", en: "Preparation" },
    "car-starter": { "zh-TW": "入門課程", en: "Starter Unit" },
    "car-basic": { "zh-TW": "基礎課程", en: "Basic Unit" },
    "car-advanced": { "zh-TW": "進階課程", en: "Advanced Unit" }
  };
  const labels = existing.categoryLabels && typeof existing.categoryLabels === "object"
    ? existing.categoryLabels
    : {};

  const categoryLabels = {};
  for (const [key, value] of Object.entries({ ...baseLabels, ...labels })) {
    categoryLabels[key] = {
      "zh-TW": String(value?.["zh-TW"] || baseLabels[key]?.["zh-TW"] || "").trim(),
      en: String(value?.en || baseLabels[key]?.en || "").trim()
    };
  }

  return {
    schemaVersion: Number(existing.schemaVersion || 1) || 1,
    categoryLabels
  };
}

async function upsertDoc(ref, payload, args) {
  if (!args.apply) {
    console.log(`[dry-run] ${ref.path}`, payload);
    return;
  }
  const writePayload = {
    ...payload,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(writePayload, { merge: !args.overwrite });
  console.log(`[apply] upserted ${ref.path}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const settingsCol = db.collection("metadata_settings");
  const runtimeRef = settingsCol.doc("content_runtime");
  const learningPathsRef = settingsCol.doc("learning_paths");

  const [runtimeSnap, learningPathsSnap] = await Promise.all([
    runtimeRef.get(),
    learningPathsRef.get(),
  ]);

  const runtimeExisting = runtimeSnap.exists ? (runtimeSnap.data() || {}) : {};
  const learningPathsExisting = learningPathsSnap.exists ? (learningPathsSnap.data() || {}) : {};

  console.log(`[seed_metadata_settings] mode=${args.apply ? "APPLY" : "DRY_RUN"} overwrite=${args.overwrite ? "yes" : "no"}`);

  const runtimePayload = buildContentRuntimePayload(runtimeExisting);
  const learningPathsPayload = buildLearningPathsPayload(learningPathsExisting);

  if (!args.apply) {
    console.log("[dry-run] metadata_settings/content_runtime", runtimePayload);
    console.log("[dry-run] metadata_settings/learning_paths", learningPathsPayload);
  } else {
    await upsertDoc(runtimeRef, runtimePayload, args);
    await upsertDoc(learningPathsRef, learningPathsPayload, args);
  }

  console.log("[seed_metadata_settings] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed_metadata_settings] failed:", err);
    process.exit(1);
  });
