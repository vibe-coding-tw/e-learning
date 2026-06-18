#!/usr/bin/env node
/**
 * Import lesson-level metadata_lessons seed files into Firestore.
 *
 * Usage:
 *   node functions/scripts/import_lesson_level_metadata_lessons.js --dry-run
 *   node functions/scripts/import_lesson_level_metadata_lessons.js --apply
 *   node functions/scripts/import_lesson_level_metadata_lessons.js --apply --files=docs/courses/lesson-level-metadata-lessons-starter-seed.json
 *   node functions/scripts/import_lesson_level_metadata_lessons.js --apply --catalog-visible
 *
 * The script intentionally keeps canonical identity on Firestore document ID
 * and only writes compat aliases that are still used by current runtime.
 */

const fs = require("fs/promises");
const path = require("path");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    files: [],
    collection: "metadata_lessons",
    catalogVisible: false,
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (token === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
    } else if (token.startsWith("--files=")) {
      const raw = token.split("=")[1] || "";
      args.files = raw.split(",").map((item) => item.trim()).filter(Boolean);
    } else if (token.startsWith("--collection=")) {
      const raw = token.split("=")[1] || "";
      args.collection = raw.trim() || args.collection;
    } else if (token === "--catalog-visible" || token === "--public-catalog") {
      args.catalogVisible = true;
    }
  }

  return args;
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeLocaleKey(locale = "") {
  return String(locale || "").trim().replace(/_/g, "-");
}

function toTitleCase(value = "") {
  return String(value || "")
    .split(/\s+/g)
    .map((word) => {
      if (!word) return "";
      if (/^[A-Z0-9]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .trim();
}

function humanizeUnitTitle(unitId = "") {
  const stem = normalizeText(unitId).replace(/\.html$/i, "");
  if (!stem) return "";
  const stripped = stem
    .replace(/^(?:car-starter|car-basic|car-advanced|common|tw|en)-/i, "")
    .replace(/^(?:start|basic|adv|advanced)-\d{2}-unit-/i, "")
    .replace(/^(?:start|basic|adv|advanced)-\d{2}-master-/i, "")
    .replace(/^(?:\d{2}-unit-)/i, "");
  return toTitleCase(stripped.replace(/-/g, " "));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.map((item) => normalizeText(item)).filter(Boolean) : [];
}

function normalizeCategoryKey(value = "") {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return "";
  if (raw === "common") return "common";
  if (/^(?:tw|en)-common$/i.test(raw)) return "common";
  if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(raw)) return raw.replace(/^(?:tw|en)-/i, "");
  if (/^car-(starter|basic|advanced)$/i.test(raw)) return raw;
  return "";
}

function inferCategoryKey(track = "", level = "") {
  const normalizedTrack = normalizeText(track).toLowerCase();
  const normalizedLevel = normalizeText(level).toLowerCase();
  if (!normalizedLevel || normalizedLevel === "common" || normalizedTrack === "common" || normalizedTrack === "prepare") return "common";
  if (normalizedTrack === "car") return `car-${normalizedLevel}`;
  if (/^(starter|basic|advanced)$/i.test(normalizedTrack)) return `car-${normalizedTrack}`;
  return `car-${normalizedLevel}`;
}

function buildLocaleContent(rawLocale = {}, fallbackTitle = "") {
  const title = normalizeText(rawLocale.title || fallbackTitle);
  const summary = normalizeText(rawLocale.summary || "");
  const description = normalizeText(rawLocale.description || "");
  const lessonLabel = normalizeText(rawLocale.lessonLabel || title);
  return {
    title,
    summary,
    description,
    lessonLabel,
    coreContent: normalizeArray(rawLocale.coreContent),
  };
}

function buildNormalizedDocument(rawDoc = {}, options = {}) {
  const docId = normalizeText(rawDoc.docId || rawDoc.id);
  if (!docId) return null;

  const rawI18n = rawDoc.i18n && typeof rawDoc.i18n === "object" && !Array.isArray(rawDoc.i18n)
    ? rawDoc.i18n
    : {};
  const zh = buildLocaleContent(rawI18n["zh-TW"] || rawI18n.zh || rawI18n["zh-Hant"] || {}, rawDoc.title || "");
  const en = buildLocaleContent(rawI18n.en || rawI18n["en-US"] || rawI18n["en-GB"] || {}, rawDoc.titleEn || zh.title);
  const category = normalizeCategoryKey(rawDoc.category) || inferCategoryKey(rawDoc.track, rawDoc.level);

  const courseUnits = normalizeArray(rawDoc.course_units || rawDoc.courseUnits);
  const courseUnitTitles = Array.isArray(rawDoc.course_unit_titles)
    ? normalizeArray(rawDoc.course_unit_titles)
    : Array.isArray(rawDoc.courseUnitTitles)
      ? normalizeArray(rawDoc.courseUnitTitles)
      : courseUnits.map((unitId) => humanizeUnitTitle(unitId));

  while (courseUnitTitles.length < courseUnits.length) {
    courseUnitTitles.push(humanizeUnitTitle(courseUnits[courseUnitTitles.length]));
  }

  return {
    id: docId,
    docId,
    metadataType: normalizeText(rawDoc.metadataType || "course"),
    level: normalizeText(rawDoc.level),
    category,
    hiddenFromCatalog: options.catalogVisible ? false : rawDoc.hiddenFromCatalog === true,
    isDeprecated: rawDoc.isDeprecated === true,
    pilotOnly: rawDoc.pilotOnly === true,
    lessonIndex: Number(rawDoc.lessonIndex || 0) || 0,
    lessonKey: normalizeText(rawDoc.lessonKey),
    orderWeight: Number(rawDoc.orderWeight || rawDoc.lessonIndex || 0) || 0,
    title: zh.title,
    summary: zh.summary,
    description: zh.description,
    lessonLabel: zh.lessonLabel,
    titleEn: en.title,
    summaryEn: en.summary,
    descriptionEn: en.description,
    lessonLabelEn: en.lessonLabel,
    coreContent: zh.coreContent,
    coreContentEn: en.coreContent,
    i18n: {
      "zh-TW": zh,
      en,
    },
    course_units: courseUnits,
    courseUnits,
    course_unit_titles: courseUnitTitles,
    courseUnitTitles,
  };
}

async function loadSeedFile(filePath) {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(__dirname, "../../", filePath);
  const text = await fs.readFile(absolutePath, "utf8");
  const parsed = JSON.parse(text);
  const documents = Array.isArray(parsed?.documents) ? parsed.documents : [];
  return { absolutePath, documents };
}

async function main() {
  const args = parseArgs(process.argv);
  const defaultFiles = [
    path.resolve(__dirname, "../../docs/courses/lesson-level-metadata-lessons-starter-seed.json"),
    path.resolve(__dirname, "../../docs/courses/lesson-level-metadata-lessons-basic-seed.json"),
    path.resolve(__dirname, "../../docs/courses/lesson-level-metadata-lessons-advanced-seed.json"),
  ];
  const files = args.files.length ? args.files : defaultFiles;

  console.log(`[lesson-level-import] mode=${args.apply ? "APPLY" : "DRY_RUN"} collection=${args.collection}`);
  if (args.catalogVisible) {
    console.log("[lesson-level-import] catalog-visible override enabled for emulator preview");
  }

  let total = 0;
  const writes = [];

  for (const filePath of files) {
    const { absolutePath, documents } = await loadSeedFile(filePath);
    console.log(`\n[seed] ${absolutePath}`);
    for (const rawDoc of documents) {
      const normalized = buildNormalizedDocument(rawDoc, args);
      if (!normalized) {
        console.log("  - skip: missing docId/id");
        continue;
      }
      total += 1;
      writes.push({ id: normalized.id, normalized });
      console.log(`  - ${normalized.id} (${normalized.category}, level=${normalized.level}) units=${normalized.course_units.length}`);
    }
  }

  if (!args.apply) {
    console.log(`\n[lesson-level-import] dry-run complete. documents=${total}`);
    return;
  }

  const batchLimit = 400;
  let batch = db.batch();
  let batchCount = 0;
  let committed = 0;

  for (const item of writes) {
    const ref = db.collection(args.collection).doc(item.id);
    batch.set(ref, item.normalized, { merge: false });
    batchCount += 1;
    if (batchCount >= batchLimit) {
      await batch.commit();
      committed += batchCount;
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    committed += batchCount;
  }

  console.log(`\n[lesson-level-import] applied documents=${committed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[lesson-level-import] failed:", err);
    process.exit(1);
  });
