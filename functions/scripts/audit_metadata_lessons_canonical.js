#!/usr/bin/env node
/**
 * Audit metadata_lessons for legacy/non-canonical courseId values.
 *
 * Usage:
 *   node functions/scripts/audit_metadata_lessons_canonical.js
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function isCanonicalCourseId(value) {
  if (!value) return false;
  const courseId = String(value).trim();
  return /^(?:\d{2}|start-\d{2}|basic-\d{2}|adv-\d{2})-master-[a-z0-9-]+\.html$/i.test(courseId);
}

function summarize(doc) {
  const data = doc.data() || {};
  return {
    docId: doc.id,
    courseId: data.courseId || "",
    courseKey: data.courseKey || "",
    title: data.title || data.courseName || "",
    entryUnitId: data.entryUnitId || "",
    contentRef: data.contentRef || "",
  };
}

async function main() {
  const snap = await db.collection("metadata_lessons").get();
  const rows = snap.docs.map(summarize);
  const nonCanonical = rows.filter((row) => !isCanonicalCourseId(row.courseId));

  console.log(`[metadata_lessons] total=${rows.length}`);
  console.log(`[metadata_lessons] nonCanonical=${nonCanonical.length}`);

  if (nonCanonical.length === 0) {
    console.log("[OK] all courseId values look canonical");
    return;
  }

  for (const row of nonCanonical) {
    console.log(JSON.stringify(row));
  }
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
