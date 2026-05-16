#!/usr/bin/env node
/**
 * Fix metadata_lessons courseUnits for migrated unit ids.
 *
 * Usage:
 *   node functions/scripts/fix_metadata_lessons_units.js --dry-run
 *   node functions/scripts/fix_metadata_lessons_units.js --apply
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function parseArgs(argv) {
  const args = {
    dryRun: true,
    apply: false,
  };
  for (const token of argv.slice(2)) {
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
    }
  }
  return args;
}

const TARGETS = [
  {
    courseId: "ai-agents-vibe",
    nextUnits: [
      "02-unit-agent-mode.html",
      "02-unit-web-agents.html",
      "02-unit-vibe-coding.html",
    ],
  },
  {
    courseId: "github-classroom",
    nextUnits: [
      "03-unit-github-classroom.html",
    ],
  },
];

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";
  console.log(`[fix_metadata_lessons_units] mode=${mode}`);

  let updated = 0;
  let skipped = 0;

  for (const target of TARGETS) {
    const snap = await db
      .collection("metadata_lessons")
      .where("courseId", "==", target.courseId)
      .limit(1)
      .get();

    if (snap.empty) {
      console.log(`[SKIP] courseId=${target.courseId} not found`);
      skipped += 1;
      continue;
    }

    const doc = snap.docs[0];
    const data = doc.data() || {};
    const currentUnits = Array.isArray(data.courseUnits) ? data.courseUnits : [];
    const nextUnits = target.nextUnits;
    const same =
      currentUnits.length === nextUnits.length &&
      currentUnits.every((u, i) => u === nextUnits[i]);

    console.log(`\n[COURSE] ${target.courseId}`);
    console.log(`docId=${doc.id}`);
    console.log(`currentUnits=${JSON.stringify(currentUnits)}`);
    console.log(`nextUnits=${JSON.stringify(nextUnits)}`);

    if (same) {
      console.log("[NOOP] already up to date");
      skipped += 1;
      continue;
    }

    if (args.apply) {
      await doc.ref.set(
        {
          courseUnits: nextUnits,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log("[UPDATED]");
    } else {
      console.log("[DRY-RUN] would update");
    }
    updated += 1;
  }

  console.log(`\n[SUMMARY] updated=${updated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});

