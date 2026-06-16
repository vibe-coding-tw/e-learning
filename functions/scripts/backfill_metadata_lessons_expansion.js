#!/usr/bin/env node
/**
 * Backfill metadata_lessons expansion fields from migration template CSV.
 *
 * Usage:
 *   node functions/scripts/backfill_metadata_lessons_expansion.js --dry-run
 *   node functions/scripts/backfill_metadata_lessons_expansion.js --apply
 *   node functions/scripts/backfill_metadata_lessons_expansion.js --apply --input=docs/examples/metadata-lessons-migration-template.csv
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const DELETE = admin.firestore.FieldValue.delete();

function parseArgs(argv) {
  const args = {
    input: "docs/examples/metadata-lessons-migration-template.csv",
    dryRun: true,
    apply: false,
  };

  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (token === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
    } else if (token.startsWith("--input=")) {
      args.input = token.split("=")[1] || args.input;
    }
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [header, ...dataRows] = rows.filter((r) => r.some((c) => String(c || "").trim() !== ""));
  return dataRows.map((r) => {
    const obj = {};
    header.forEach((key, idx) => {
      obj[key] = r[idx] || "";
    });
    return obj;
  });
}

function normalizeValue(value) {
  const raw = String(value || "").trim();
  return raw || null;
}

function normalizeCategoryKey(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "common") return "common";
  if (/^(?:tw|en)-common$/i.test(raw)) return "common";
  if (/^(?:tw|en)-car-(starter|basic|advanced)$/i.test(raw)) return raw.replace(/^(?:tw|en)-/i, "");
  if (/^car-(starter|basic|advanced)$/i.test(raw)) return raw;
  return null;
}

function inferCategoryKey(track = "", level = "", category = "") {
  const normalizedCategory = normalizeCategoryKey(category);
  if (normalizedCategory) return normalizedCategory;
  const normalizedTrack = String(track || "").trim().toLowerCase();
  const normalizedLevel = String(level || "").trim().toLowerCase();
  if (!normalizedLevel || normalizedLevel === "common" || normalizedTrack === "common" || normalizedTrack === "prepare") return "common";
  if (normalizedTrack === "car") return `car-${normalizedLevel}`;
  if (/^(starter|basic|advanced)$/i.test(normalizedTrack)) return `car-${normalizedTrack}`;
  return `car-${normalizedLevel}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(process.cwd(), args.input);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input CSV not found: ${inputPath}`);
  }

  const rows = parseCsv(fs.readFileSync(inputPath, "utf8"));
  console.log(`[metadata_lessons_expansion] mode=${args.apply ? "apply" : "dry-run"} rows=${rows.length}`);

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const row of rows) {
    const legacyCourseId = normalizeValue(row.legacy_course_id);
    if (!legacyCourseId) {
      skipped += 1;
      continue;
    }

    const snap = await db
      .collection("metadata_lessons")
      .where("courseId", "==", legacyCourseId)
      .limit(1)
      .get();

    if (snap.empty) {
      console.log(`[MISSING] courseId=${legacyCourseId}`);
      missing += 1;
      continue;
    }

    const doc = snap.docs[0];
    const current = doc.data() || {};
    const category = inferCategoryKey(row.track, row.level, row.category);
    const next = {
      track: DELETE,
      courseKey: DELETE,
      level: normalizeValue(row.level),
      category,
      orderWeight: Number(row.order_weight || current.orderWeight || 0) || current.orderWeight || 0,
      entryUnitId: normalizeValue(row.entry_unit_id),
      contentRef: normalizeValue(row.entry_content_ref),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const changedKeys = Object.keys(next).filter((key) => {
      if (key === "updatedAt") return false;
      return JSON.stringify(current[key] ?? null) !== JSON.stringify(next[key] ?? null);
    });

    console.log(`\n[COURSE] ${legacyCourseId}`);
    console.log(`docId=${doc.id}`);
    console.log(`changedKeys=${changedKeys.join(",") || "(none)"}`);
    if (changedKeys.length === 0) {
      console.log("[NOOP] already up to date");
      skipped += 1;
      continue;
    }

    if (args.apply) {
      await doc.ref.set(next, { merge: true });
      console.log("[UPDATED]");
    } else {
      console.log("[DRY-RUN] would update", next);
    }
    updated += 1;
  }

  console.log(`\n[SUMMARY] updated=${updated} skipped=${skipped} missing=${missing}`);
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
