#!/usr/bin/env node
/**
 * Backfill canonical metadata_lessons schema.
 *
 * Goals:
 * - Normalize multi-locale content into `i18n`
 * - Normalize external unit filenames into `course_units`
 * - Keep camelCase aliases for current runtime compatibility unless explicitly removed
 * - Do not backfill entryUnitId; entry should be derived from course_units[0]
 *
 * Usage:
 *   node functions/scripts/backfill_metadata_lessons_canonical_schema.js --dry-run
 *   node functions/scripts/backfill_metadata_lessons_canonical_schema.js --apply
 *   node functions/scripts/backfill_metadata_lessons_canonical_schema.js --apply --delete=title,summary,description,titleEn,summaryEn,descriptionEn,coreContentEn
 *   node functions/scripts/backfill_metadata_lessons_canonical_schema.js --apply --delete=courseKey,contentRef,entryUnitId,courseUnits,courseUnitTitles
 *
 * Notes:
 * - This script is intentionally conservative by default.
 * - Removing `courseKey`, `contentRef`, `entryUnitId`, or `courseUnits` may break consumers
 *   that still read those compat fields, so keep deletes explicit and narrow.
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
    limit: 0,
    deleteFields: [],
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (token === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
    } else if (token.startsWith("--limit=")) {
      const raw = Number(token.split("=")[1] || "0");
      args.limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    } else if (token.startsWith("--delete=")) {
      const raw = token.split("=")[1] || "";
      args.deleteFields = raw.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }

  return args;
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeList(value = "") {
  return String(value || "")
    .split(/\r?\n|,/g)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeLocaleKey(locale = "") {
  return String(locale || "").trim().replace(/_/g, "-");
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

function cloneLocaleContent(value = {}) {
  return {
    title: normalizeText(value.title || ""),
    summary: normalizeText(value.summary || ""),
    description: normalizeText(value.description || ""),
    lessonLabel: normalizeText(value.lessonLabel || value.tagText || ""),
    coreContent: Array.isArray(value.coreContent)
      ? value.coreContent.map((item) => normalizeText(item)).filter(Boolean)
      : normalizeList(value.coreContentText || value.coreContent || "")
  };
}

function buildCanonicalI18n(data = {}) {
  const next = {};
  const sourceI18n = data.i18n && typeof data.i18n === "object" && !Array.isArray(data.i18n) ? data.i18n : {};

  for (const [locale, localeData] of Object.entries(sourceI18n)) {
    const key = normalizeLocaleKey(locale);
    if (!key) continue;
    next[key] = cloneLocaleContent(localeData || {});
  }

  const legacyZh = cloneLocaleContent({
    title: data.title || "",
    summary: data.summary || data.tagText || "",
    description: data.description || "",
    lessonLabel: data.lessonLabel || data.tagText || "",
    coreContent: data.coreContent || []
  });

  const legacyEn = cloneLocaleContent({
    title: data.titleEn || "",
    summary: data.summaryEn || data.tagText || "",
    description: data.descriptionEn || "",
    lessonLabel: data.lessonLabelEn || "",
    coreContent: data.coreContentEn || []
  });

  const hasLegacyEn =
    legacyEn.title ||
    legacyEn.summary ||
    legacyEn.description ||
    (Array.isArray(legacyEn.coreContent) && legacyEn.coreContent.length > 0);
  if (hasLegacyEn) {
    if (!next.en) next.en = legacyEn;
    else {
      next.en = {
        title: next.en.title || legacyEn.title,
        summary: next.en.summary || legacyEn.summary,
        description: next.en.description || legacyEn.description,
        coreContent: Array.isArray(next.en.coreContent) && next.en.coreContent.length
          ? next.en.coreContent
          : legacyEn.coreContent
      };
    }
  }

  const hasLegacyZh =
    legacyZh.title ||
    legacyZh.summary ||
    legacyZh.description ||
    (Array.isArray(legacyZh.coreContent) && legacyZh.coreContent.length > 0);
  if (hasLegacyZh) {
    if (!next["zh-TW"]) next["zh-TW"] = legacyZh;
    else {
      next["zh-TW"] = {
        title: next["zh-TW"].title || legacyZh.title,
        summary: next["zh-TW"].summary || legacyZh.summary,
        description: next["zh-TW"].description || legacyZh.description,
        coreContent: Array.isArray(next["zh-TW"].coreContent) && next["zh-TW"].coreContent.length
          ? next["zh-TW"].coreContent
          : legacyZh.coreContent
      };
    }
  }

  return next;
}

function buildCanonicalUnits(data = {}) {
  const rawUnits = Array.isArray(data.course_units)
    ? data.course_units
    : (Array.isArray(data.courseUnits) ? data.courseUnits : []);
  const rawTitles = Array.isArray(data.course_unit_titles)
    ? data.course_unit_titles
    : (Array.isArray(data.courseUnitTitles) ? data.courseUnitTitles : []);

  const course_units = rawUnits.map((unit) => normalizeText(unit)).filter(Boolean);
  const course_unit_titles = course_units.map((unitId, index) => normalizeText(rawTitles[index] || unitId));

  return { course_units, course_unit_titles };
}

function buildPatch(data, { deleteFields = [] } = {}) {
  const patch = {};
  const i18n = buildCanonicalI18n(data);
  const { course_units, course_unit_titles } = buildCanonicalUnits(data);
  const category = normalizeCategoryKey(data.category) || inferCategoryKey(data.track, data.level);

  patch.i18n = i18n;
  patch.course_units = course_units;
  patch.courseUnits = course_units;
  patch.course_unit_titles = course_unit_titles;
  patch.courseUnitTitles = course_unit_titles;
  patch.category = category;
  patch.track = DELETE;
  patch.courseKey = DELETE;
  patch.level = normalizeText(data.level || "");
  if (i18n["zh-TW"]?.lessonLabel) patch.lessonLabel = i18n["zh-TW"].lessonLabel;
  if (i18n.en?.lessonLabel) patch.lessonLabelEn = i18n.en.lessonLabel;

  const deleteSet = new Set(deleteFields.map((field) => normalizeText(field)).filter(Boolean));
  for (const field of deleteSet) {
    patch[field] = DELETE;
  }

  if (deleteSet.has("courseUnits")) {
    patch.course_units = course_units;
  }
  if (deleteSet.has("courseUnitTitles")) {
    patch.course_unit_titles = course_unit_titles;
  }

  return patch;
}

function diffSummary(current, next, deleteFields = []) {
  const changed = [];
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(next || {})]);
  for (const key of keys) {
    if (key === "updatedAt") continue;
    const currentValue = current?.[key];
    const nextValue = next?.[key];
    if (deleteFields.includes(key)) {
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
  const deleteHint = args.deleteFields.length ? ` delete=${args.deleteFields.join(",")}` : "";
  console.log(`[backfill_metadata_lessons_canonical_schema] mode=${mode}${deleteHint}`);

  const snap = await db.collection("metadata_lessons").get();
  const docs = snap.docs.slice(0, args.limit > 0 ? args.limit : undefined);
  console.log(`[backfill_metadata_lessons_canonical_schema] docs=${docs.length}`);

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const doc of docs) {
    const data = doc.data() || {};
    const patch = buildPatch(data, { deleteFields: args.deleteFields });
    const changedKeys = diffSummary(data, patch, args.deleteFields);

    if (changedKeys.length === 0) {
      skipped += 1;
      continue;
    }

    console.log(`\n[DOC] ${doc.id}`);
    console.log(`changedKeys=${changedKeys.join(",")}`);

    if (args.apply) {
      await doc.ref.set({
        ...patch,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      updated += 1;
      console.log("[UPDATED]");
    } else {
      console.log("[DRY-RUN] would update");
    }
  }

  console.log(`\n[SUMMARY] updated=${updated} skipped=${skipped} missing=${missing}`);
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
