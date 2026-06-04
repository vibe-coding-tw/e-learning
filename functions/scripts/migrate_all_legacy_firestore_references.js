#!/usr/bin/env node
/**
 * Migrate Firestore references (metadata_lessons, users, orders, referral_links, assignments) from legacy/prefixed unit IDs to canonical IDs.
 *
 * Usage:
 *   node functions/scripts/migrate_all_legacy_firestore_references.js --dry-run
 *   node functions/scripts/migrate_all_legacy_firestore_references.js --apply
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

const LEGACY_TO_CANONICAL = {
  "01-master-getting-started.html": "common-developer-identity.html",
  "02-master-ai-agents.html": "common-agent-mode.html",
  "03-master-wifi-motor.html": "common-github-classroom.html",
  "01-unit-vscode-online.html": "common-vscode-online.html",
  "01-unit-vscode-setup.html": "common-vscode-setup.html",
  "02-unit-agent-mode.html": "common-agent-mode.html",
  "02-unit-classroom-workflow.html": "common-github-classroom.html",
  "02-unit-github-classroom.html": "common-github-classroom.html",
  "03-unit-motor-ramping.html": "common-motor-ramping.html",
  "03-unit-wifi-setup.html": "common-wifi-setup.html",

  "adv-01-master-s3-cam.html": "adv-01-unit-jpeg-quality.html",
  "adv-02-master-video.html": "adv-02-unit-bandwidth-fps.html",
  "adv-03-master-ble-advanced.html": "adv-03-unit-ble-mtu.html",
  "adv-04-master-sensors.html": "adv-04-unit-filter-algorithms.html",
  "adv-05-master-cv.html": "adv-05-unit-centroid-error.html",
  "adv-06-master-cv-advanced.html": "adv-06-unit-centroid-algorithm.html",
  "adv-07-master-ui-framework.html": "adv-07-unit-chart-canvas.html",
  "adv-08-master-image-processing.html": "adv-08-unit-color-spaces.html",
  "adv-09-master-ai-recognition.html": "adv-09-unit-cnn-audio.html",
  "adv-10-master-diff-drive.html": "adv-10-unit-api-design.html",
  "adv-11-master-photoelectric.html": "adv-11-unit-hardware-interrupts.html",
  "adv-12-master-pid.html": "adv-12-unit-code-logic.html",
  "adv-13-master-robustness.html": "adv-13-unit-robustness.html",
  "adv-14-master-debugging-art.html": "adv-14-unit-debugging-art.html",
  "adv-15-master-architecture.html": "adv-15-unit-ble-async.html",

  "basic-01-master-environment.html": "basic-01-unit-drivers-ports.html",
  "basic-02-master-ota-architecture.html": "basic-02-unit-ota-principles.html",
  "basic-03-master-io-mapping.html": "basic-03-unit-adc-resolution.html",
  "basic-04-master-pwm-control.html": "basic-04-unit-h-bridge.html",
  "basic-05-master-ble-gatt.html": "basic-05-unit-advertising-connection.html",
  "basic-06-master-http-web.html": "basic-06-unit-cors-security.html",
  "basic-07-master-wifi-modes.html": "basic-07-unit-async-webserver.html",
  "basic-08-master-joystick-math.html": "basic-08-unit-joystick-mapping.html",
  "basic-09-master-multitasking.html": "basic-09-unit-hardware-timer.html",
  "basic-10-master-fsm.html": "basic-10-unit-fsm.html",

  "start-01-master-web-app.html": "start-01-unit-flexbox-layout.html",
  "start-02-master-web-ble.html": "start-02-unit-ble-async.html",
  "start-03-master-remote-control.html": "start-03-unit-control-panel.html",
  "start-04-master-touch-events.html": "start-04-unit-long-press.html",
  "start-05-master-joystick-lab.html": "start-05-unit-canvas-joystick.html"
};

function checkLegacyValue(str) {
  if (typeof str !== "string") return null;
  const s = str.trim();
  const lower = s.toLowerCase();
  
  // 1. Direct match or matches with prefix stripped
  for (const legacy of Object.keys(LEGACY_TO_CANONICAL)) {
    if (lower === legacy.toLowerCase()) {
      return { legacy, canonical: LEGACY_TO_CANONICAL[legacy] };
    }
    const noExt = legacy.replace(/\.html$/i, "");
    if (lower === noExt.toLowerCase()) {
      return { legacy, canonical: LEGACY_TO_CANONICAL[legacy].replace(/\.html$/i, "") };
    }
  }

  // 2. Language prefixes (tw- / en-) on canonical keys
  if (/^(?:tw|en)-/i.test(s)) {
    const stripped = s.replace(/^(?:tw|en)-/i, "");
    if (stripped.startsWith("common-") || stripped.startsWith("start-") || stripped.startsWith("basic-") || stripped.startsWith("adv-")) {
      return { legacy: s, canonical: stripped };
    }
  }

  return null;
}

async function migrateMetadataLessons(args) {
  console.log("\n>>> Migrating metadata_lessons collection...");
  const snap = await db.collection("metadata_lessons").get();
  
  for (const doc of snap.docs) {
    const docId = doc.id;
    const data = doc.data();
    
    // Check if doc ID needs migration
    const idMatch = checkLegacyValue(docId);
    
    let docUpdated = false;
    let entryUnitId = data.entryUnitId || "";
    let courseId = data.courseId || "";
    
    const entryMatch = checkLegacyValue(entryUnitId);
    if (entryMatch) {
      entryUnitId = entryMatch.canonical;
      docUpdated = true;
      console.log(`  [metadata_lessons] docId=${docId}: entryUnitId "${data.entryUnitId}" -> "${entryUnitId}"`);
    }

    const courseMatch = checkLegacyValue(courseId);
    if (courseMatch) {
      courseId = courseMatch.canonical;
      docUpdated = true;
      console.log(`  [metadata_lessons] docId=${docId}: courseId "${data.courseId}" -> "${courseId}"`);
    }

    let courseUnits = data.courseUnits || [];
    let courseUnitsUpdated = false;
    const newCourseUnits = courseUnits.map(unit => {
      const match = checkLegacyValue(unit);
      if (match) {
        courseUnitsUpdated = true;
        docUpdated = true;
        console.log(`  [metadata_lessons] docId=${docId}: courseUnits item "${unit}" -> "${match.canonical}"`);
        return match.canonical;
      }
      return unit;
    });

    if (idMatch) {
      const newDocId = idMatch.canonical;
      console.log(`  [metadata_lessons] docId=${docId} is legacy! Creating new doc ${newDocId} and deleting old one.`);
      
      const newData = {
        ...data,
        courseId: courseId || newDocId,
        entryUnitId: entryUnitId || newDocId,
        courseUnits: newCourseUnits,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (args.apply) {
        await db.collection("metadata_lessons").doc(newDocId).set(newData);
        await db.collection("metadata_lessons").doc(docId).delete();
        console.log(`    [SUCCESS] Migrated metadata doc ${docId} -> ${newDocId}`);
      } else {
        console.log(`    [DRY-RUN] Would create new doc ${newDocId} and delete old ${docId}`);
      }
    } else if (docUpdated) {
      if (args.apply) {
        await db.collection("metadata_lessons").doc(docId).set({
          entryUnitId,
          courseId,
          courseUnits: newCourseUnits,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`    [SUCCESS] Updated metadata doc ${docId} fields`);
      } else {
        console.log(`    [DRY-RUN] Would update metadata doc ${docId} fields`);
      }
    }
  }
}

async function migrateUsers(args) {
  console.log("\n>>> Migrating users collection...");
  const snap = await db.collection("users").get();
  
  for (const doc of snap.docs) {
    const data = doc.data();
    let docUpdated = false;

    // 1. tutorConfigs
    const tutorConfigs = data.tutorConfigs || {};
    const newTutorConfigs = {};
    for (const [k, v] of Object.entries(tutorConfigs)) {
      const match = checkLegacyValue(k);
      if (match) {
        newTutorConfigs[match.canonical] = v;
        docUpdated = true;
        console.log(`  [users] docId=${doc.id}: tutorConfigs key "${k}" -> "${match.canonical}"`);
      } else {
        newTutorConfigs[k] = v;
      }
    }

    // 2. unitAssignments
    const unitAssignments = data.unitAssignments || {};
    const newUnitAssignments = {};
    for (const [k, v] of Object.entries(unitAssignments)) {
      const match = checkLegacyValue(k);
      if (match) {
        newUnitAssignments[match.canonical] = v;
        docUpdated = true;
        console.log(`  [users] docId=${doc.id}: unitAssignments key "${k}" -> "${match.canonical}"`);
      } else {
        newUnitAssignments[k] = v;
      }
    }

    if (docUpdated) {
      if (args.apply) {
        await db.collection("users").doc(doc.id).update({
          tutorConfigs: newTutorConfigs,
          unitAssignments: newUnitAssignments,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`    [SUCCESS] Migrated user doc ${doc.id} (overwrote maps)`);
      } else {
        console.log(`    [DRY-RUN] Would update user doc ${doc.id}`);
      }
    }
  }
}

async function migrateOrders(args) {
  console.log("\n>>> Migrating orders collection...");
  const snap = await db.collection("orders").get();
  
  for (const doc of snap.docs) {
    const data = doc.data();
    const items = data.items || {};
    let docUpdated = false;

    for (const [k, item] of Object.entries(items)) {
      if (item && item.sourceUnitId) {
        const match = checkLegacyValue(item.sourceUnitId);
        if (match) {
          item.sourceUnitId = match.canonical;
          docUpdated = true;
          console.log(`  [orders] docId=${doc.id}: items.${k}.sourceUnitId "${item.sourceUnitId}" -> "${match.canonical}"`);
        }
      }
    }

    if (docUpdated) {
      if (args.apply) {
        await db.collection("orders").doc(doc.id).set({
          items,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`    [SUCCESS] Migrated order doc ${doc.id}`);
      } else {
        console.log(`    [DRY-RUN] Would update order doc ${doc.id}`);
      }
    }
  }
}

async function migrateReferralLinks(args) {
  console.log("\n>>> Migrating referral_links collection...");
  const snap = await db.collection("referral_links").get();
  
  for (const doc of snap.docs) {
    const data = doc.data();
    let docUpdated = false;
    let unitId = data.unitId || "";

    const match = checkLegacyValue(unitId);
    if (match) {
      unitId = match.canonical;
      docUpdated = true;
      console.log(`  [referral_links] docId=${doc.id}: unitId "${data.unitId}" -> "${unitId}"`);
    }

    if (docUpdated) {
      if (args.apply) {
        await db.collection("referral_links").doc(doc.id).set({
          unitId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`    [SUCCESS] Migrated referral link doc ${doc.id}`);
      } else {
        console.log(`    [DRY-RUN] Would update referral link doc ${doc.id}`);
      }
    }
  }
}

async function migrateAssignments(args) {
  console.log("\n>>> Migrating assignments collection...");
  const snap = await db.collection("assignments").get();
  
  for (const doc of snap.docs) {
    const data = doc.data();
    let docUpdated = false;
    let courseId = data.courseId || "";
    let unitId = data.unitId || "";
    let assignmentId = data.assignmentId || "";

    const courseMatch = checkLegacyValue(courseId);
    if (courseMatch) {
      courseId = courseMatch.canonical;
      docUpdated = true;
      console.log(`  [assignments] docId=${doc.id}: courseId "${data.courseId}" -> "${courseId}"`);
    }

    const unitMatch = checkLegacyValue(unitId);
    if (unitMatch) {
      unitId = unitMatch.canonical;
      docUpdated = true;
      console.log(`  [assignments] docId=${doc.id}: unitId "${data.unitId}" -> "${unitId}"`);
    }

    const assignMatch = checkLegacyValue(assignmentId);
    if (assignMatch) {
      assignmentId = assignMatch.canonical;
      docUpdated = true;
      console.log(`  [assignments] docId=${doc.id}: assignmentId "${data.assignmentId}" -> "${assignmentId}"`);
    }

    if (docUpdated) {
      if (args.apply) {
        await db.collection("assignments").doc(doc.id).update({
          courseId,
          unitId,
          assignmentId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`    [SUCCESS] Migrated assignment doc ${doc.id}`);
      } else {
        console.log(`    [DRY-RUN] Would update assignment doc ${doc.id}`);
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const mode = args.apply ? "apply" : "dry-run";
  console.log(`Starting Firestore legacy references migration in ${mode} mode...`);

  await migrateMetadataLessons(args);
  await migrateUsers(args);
  await migrateOrders(args);
  await migrateReferralLinks(args);
  await migrateAssignments(args);

  console.log("\nMigration completed.");
}

main().catch(console.error);
