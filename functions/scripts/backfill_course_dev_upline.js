#!/usr/bin/env node
/**
 * Backfill users.courseDevEmail for courseDev upline chain.
 *
 * Default strategy:
 * - if courseDevEmail missing and tutorEmail exists -> copy tutorEmail
 *
 * Usage:
 *   node functions/scripts/backfill_course_dev_upline.js --dry-run
 *   node functions/scripts/backfill_course_dev_upline.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const args = {
  apply: process.argv.includes("--apply"),
};

function isMissing(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

async function main() {
  const mode = args.apply ? "apply" : "dry-run";
  const snap = await db.collection("users").get();
  let touched = 0;
  let updated = 0;
  let skipped = 0;

  console.log(`[backfill_course_dev_upline] mode=${mode} users=${snap.size}`);

  for (const doc of snap.docs) {
    touched += 1;
    const data = doc.data() || {};
    const currentCourseDev = String(data.courseDevEmail || "").trim().toLowerCase();
    const tutorEmail = String(data.tutorEmail || "").trim().toLowerCase();

    if (!isMissing(currentCourseDev) || isMissing(tutorEmail)) {
      skipped += 1;
      continue;
    }

    if (args.apply) {
      await doc.ref.set(
        {
          courseDevEmail: tutorEmail,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`[users] UPDATED docId=${doc.id} courseDevEmail=${tutorEmail}`);
    } else {
      console.log(`[users] DRY-RUN docId=${doc.id} patch=${JSON.stringify({ courseDevEmail: tutorEmail })}`);
    }
    updated += 1;
  }

  console.log(`[summary] touched=${touched} updated=${updated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error("[backfill_course_dev_upline] failed:", err);
  process.exit(1);
});
