#!/usr/bin/env node
/**
 * Customer Support Audit & Diagnostics Tool.
 *
 * Usage:
 *   node functions/scripts/audit_support_tool.js
 *   node functions/scripts/audit_support_tool.js --user=student@example.com
 *   node functions/scripts/audit_support_tool.js --order=VIBE1779071873467
 *   node functions/scripts/audit_support_tool.js --tutor=tutor@example.com
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helpers
const cleanId = (id) => String(id || "").trim().replace(/\.html$/, "").toLowerCase();
const normalizeLookupValue = (value = "") => String(value || "").split("/").pop().split("?")[0].replace(/\.html$/i, "").toLowerCase();

function getLessonLookupKeys(lesson = {}) {
  const keys = new Set();
  const add = (value) => {
    if (!value) return;
    const raw = String(value).trim();
    if (!raw) return;
    keys.add(raw);
    keys.add(raw.replace(/\.html$/i, ""));
    keys.add(normalizeLookupValue(raw));
    keys.add(cleanId(raw));
  };

  add(lesson.id);
  add(lesson.docId);
  add(lesson.courseId);
  add(lesson.courseKey);
  add(lesson.entryUnitId);
  add(lesson.classroomUrl);
  add(lesson.sku);
  if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
  if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);
  return keys;
}

function resolveLessonForOrderItem(itemKey = "", lessons = []) {
  const candidates = new Set([
    itemKey,
    String(itemKey).replace(/\.html$/i, ""),
    normalizeLookupValue(itemKey),
    cleanId(itemKey)
  ]);
  return lessons.find((lesson) => {
    const keys = getLessonLookupKeys(lesson);
    for (const candidate of candidates) {
      if (keys.has(candidate)) return true;
    }
    return false;
  }) || null;
}

function parseArgs(argv) {
  const out = {};
  for (const token of argv.slice(2)) {
    if (token.startsWith("--user=")) {
      out.user = token.split("=")[1].trim();
    } else if (token.startsWith("--order=")) {
      out.order = token.split("=")[1].trim();
    } else if (token.startsWith("--tutor=")) {
      out.tutor = token.split("=")[1].trim();
    }
  }
  return out;
}

async function auditOrder(orderId) {
  console.log(`\n=== AUDITING ORDER: ${orderId} ===`);
  const snap = await db.collection("orders").doc(orderId).get();
  if (!snap.exists) {
    console.error(`❌ Order not found: ${orderId}`);
    return;
  }

  const data = snap.data();
  console.log(`- Status: ${data.status}`);
  console.log(`- Amount: NT$ ${data.amount}`);
  console.log(`- User Email: ${data.userEmail}`);
  console.log(`- User UID: ${data.uid || data.userId || "N/A"}`);
  console.log(`- Created At: ${data.createdAt ? data.createdAt.toDate().toISOString() : "N/A"}`);
  console.log(`- Activation Validated: ${data.activationValidated === true ? "✅ YES" : "❌ NO"}`);
  console.log(`- Activation Status: ${data.activationValidationStatus || "N/A"}`);
  console.log(`- Activation Failed: ${data.activationValidationFailed === true ? "🚨 YES" : "✅ NO"}`);
  if (data.activationAlerts) {
    console.log(`- Activation Alerts:`, JSON.stringify(data.activationAlerts, null, 2));
  }
  if (data.activationCheckedItems) {
    console.log(`- Activation Checked Items:`, JSON.stringify(data.activationCheckedItems, null, 2));
  }
  console.log(`- Items:`, JSON.stringify(data.items || {}, null, 2));

  // Trace items
  console.log(`\n- Item Resolution Trace:`);
  const lessonsSnap = await db.collection("metadata_lessons").get();
  const lessons = lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  for (const itemKey of Object.keys(data.items || {})) {
    const matchedLesson = resolveLessonForOrderItem(itemKey, lessons);
    if (matchedLesson) {
      console.log(`  ✅ Item "${itemKey}" resolves to Course: "${matchedLesson.docId || matchedLesson.courseId || matchedLesson.id}"`);
      console.log(`     Course Key: ${matchedLesson.courseKey || "N/A"}`);
      console.log(`     Physical: ${matchedLesson.isPhysical === true ? "YES" : "NO"}`);
      console.log(`     Course Units:`, JSON.stringify(matchedLesson.courseUnits || [], null, 2));
    } else {
      console.log(`  ❌ Item "${itemKey}" DOES NOT resolve to any canonical course in metadata_lessons!`);
    }
  }
}

async function auditUser(userInput) {
  console.log(`\n=== AUDITING USER: ${userInput} ===`);
  let userSnap = null;
  if (userInput.includes("@")) {
    const snap = await db.collection("users").where("email", "==", userInput).get();
    if (snap.empty) {
      console.error(`❌ User not found with email: ${userInput}`);
      return;
    }
    userSnap = snap.docs[0];
  } else {
    userSnap = await db.collection("users").doc(userInput).get();
    if (!userSnap.exists) {
      console.error(`❌ User not found with UID: ${userInput}`);
      return;
    }
  }

  const uid = userSnap.id;
  const data = userSnap.data();
  console.log(`- UID: ${uid}`);
  console.log(`- Email: ${data.email}`);
  console.log(`- Role: ${data.role || "user"}`);
  
  // Paid Course Activations
  console.log(`- Paid Course Activations:`, JSON.stringify(data.courseActivations || {}, null, 2));

  // Unit Assignments
  console.log(`\n- Unit Assignments & Tutor Allocation:`);
  const unitAssignments = data.unitAssignments || {};
  const lessonsSnap = await db.collection("metadata_lessons").get();
  const lessons = lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const now = Date.now();
  let missingTutors = 0;

  for (const [unitId, assignInfo] of Object.entries(unitAssignments)) {
    if (!assignInfo) continue;
    const expiry = assignInfo.expiryDate ? assignInfo.expiryDate.toDate().getTime() : 0;
    const isExpired = expiry > 0 && expiry <= now;
    const statusText = isExpired ? "🔴 EXPIRED" : "🟢 ACTIVE";
    const assignedTutor = assignInfo.assignedTutor || null;

    // Check if unit is part of a course
    const parentCourse = lessons.find(l => Array.isArray(l.courseUnits) && l.courseUnits.map(cleanId).includes(cleanId(unitId)));
    const isPhysical = parentCourse ? parentCourse.isPhysical === true : false;

    console.log(`  * Unit: ${unitId}`);
    console.log(`    Status: ${statusText} (Expires: ${assignInfo.expiryDate ? assignInfo.expiryDate.toDate().toISOString() : "Never"})`);
    console.log(`    Assigned Tutor: ${assignedTutor ? `👤 ${assignedTutor}` : "🚨 NONE"}`);
    console.log(`    Referred By: ${assignInfo.referredByTutor || "Direct/None"}`);

    if (!assignedTutor && !isPhysical && !isExpired) {
      missingTutors++;
    }
  }

  if (missingTutors > 0) {
    console.log(`\n🚨 ALERT: User has ${missingTutors} active software units lacking an assigned tutor!`);
  } else {
    console.log(`\n✅ Tutor allocation check passed (all active software units have assigned tutors).`);
  }

  // Order history
  console.log(`\n- Order History:`);
  const ordersSnap = await db.collection("orders").where("uid", "==", uid).get();
  if (ordersSnap.empty) {
    console.log("  No orders found for this user.");
  } else {
    ordersSnap.docs.forEach(doc => {
      const o = doc.data();
      console.log(`  * Order: ${doc.id} | Status: ${o.status} | Activation: ${o.activationValidationStatus || "N/A"} | Amount: NT$ ${o.amount} | Items: ${Object.keys(o.items || {}).join(", ")}`);
    });
  }
}

async function auditTutor(tutorEmail) {
  const cleanEmail = tutorEmail.trim().toLowerCase();
  console.log(`\n=== AUDITING TUTOR: ${cleanEmail} ===`);

  // Find user doc
  const userSnap = await db.collection("users").where("email", "==", cleanEmail).get();
  if (userSnap.empty) {
    console.error(`❌ User/Tutor record not found in users collection for email: ${cleanEmail}`);
    return;
  }

  const userDoc = userSnap.docs[0];
  const uid = userDoc.id;
  const userData = userDoc.data();

  console.log(`- UID: ${uid}`);
  console.log(`- Global Role: ${userData.role || "user"}`);
  console.log(`- Tutor Configs (Authorized Units):`);
  const tutorConfigs = userData.tutorConfigs || {};
  let authorizedUnitsCount = 0;
  for (const [unitId, config] of Object.entries(tutorConfigs)) {
    if (config.authorized === true) {
      authorizedUnitsCount++;
      console.log(`  * Unit: ${unitId} (Authorized)`);
    }
  }
  console.log(`  Total Authorized Units: ${authorizedUnitsCount}`);

  // Payout Config
  console.log(`\n- Payout Configurations:`);
  if (userData.payoutAccount) {
    console.log(`  ✅ Payout account configured:`, JSON.stringify(userData.payoutAccount, null, 2));
  } else {
    console.log(`  🚨 Payout account MISSING!`);
  }

  // Payout policies check
  const policySnap = await db.collection("revenue_share_policies").where("recipientEmail", "==", cleanEmail).get();
  if (policySnap.empty) {
    console.log(`  🚨 Revenue share policy: NONE (will fall back to default policy)`);
  } else {
    policySnap.docs.forEach(doc => {
      const p = doc.data();
      console.log(`  ✅ Custom Policy: ${doc.id} | Unit: ${p.unitId || "Global"} | Share: ${p.ratePercent}%`);
    });
  }

  // Active Referral links
  console.log(`\n- Referral Links:`);
  const referralSnap = await db.collection("referral_links").where("tutorEmail", "==", cleanEmail).get();
  if (referralSnap.empty) {
    console.log("  No referral links found.");
  } else {
    referralSnap.docs.forEach(doc => {
      const r = doc.data();
      console.log(`  * Link ID: ${doc.id} | Unit: ${r.unitId} | Status: ${r.status || "active"} | URL: ${r.originalClassroomUrl || "N/A"}`);
    });
  }

  // Assigned students count
  console.log(`\n- Assigned Students:`);
  const studentsSnap = await db.collection("users").get();
  let assignedStudentsCount = 0;
  studentsSnap.docs.forEach(doc => {
    const s = doc.data();
    const sAssignments = s.unitAssignments || {};
    Object.entries(sAssignments).forEach(([unitId, info]) => {
      if (!info) return;
      if (info.assignedTutor && info.assignedTutor.trim().toLowerCase() === cleanEmail) {
        assignedStudentsCount++;
        console.log(`  * Student: ${s.email} (${doc.id}) | Unit: ${unitId} | Referred: ${info.referredByTutor === cleanEmail ? "Yes" : "No"}`);
      }
    });
  });
  console.log(`  Total active tutoring relations: ${assignedStudentsCount}`);
}

async function generalAuditScan() {
  console.log(`\n=== RUNNING GENERAL DIAGNOSTIC SCAN ===`);

  // 1. Broken or unvalidated orders
  console.log(`- Scanning for problematic payments...`);
  const ordersSnap = await db.collection("orders").where("status", "==", "SUCCESS").get();
  let validationIssues = 0;
  for (const doc of ordersSnap.docs) {
    const o = doc.data();
    if (o.activationValidated === false || o.activationValidationFailed === true) {
      validationIssues++;
      console.log(`  🚨 Order ${doc.id} for ${o.userEmail} failed activation check:`, JSON.stringify(o.activationAlerts || "No alerts info", null, 2));
    }
  }
  console.log(`  Checked ${ordersSnap.size} successful orders. Issues found: ${validationIssues}`);

  // 2. Active software units lacking tutors
  console.log(`\n- Scanning for active students with missing tutors...`);
  const usersSnap = await db.collection("users").get();
  const lessonsSnap = await db.collection("metadata_lessons").get();
  const lessons = lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const now = Date.now();
  let totalMissingTutors = 0;

  usersSnap.docs.forEach(doc => {
    const u = doc.data();
    const sAssignments = u.unitAssignments || {};
    Object.entries(sAssignments).forEach(([unitId, info]) => {
      if (!info) return;
      const expiry = info.expiryDate ? info.expiryDate.toDate().getTime() : 0;
      const isExpired = expiry > 0 && expiry <= now;
      const parentCourse = lessons.find(l => Array.isArray(l.courseUnits) && l.courseUnits.map(cleanId).includes(cleanId(unitId)));
      const isPhysical = parentCourse ? parentCourse.isPhysical === true : false;

      if (!info.assignedTutor && !isExpired && !isPhysical) {
        totalMissingTutors++;
        console.log(`  🚨 Student: ${u.email} (${doc.id}) | Active Unit: ${unitId} has NO assigned tutor!`);
      }
    });
  });
  console.log(`  Tutorless active software units found: ${totalMissingTutors}`);

  // 3. Referral links pointing to non-canonical/legacy IDs
  console.log(`\n- Scanning referral links consistency...`);
  const referralSnap = await db.collection("referral_links").get();
  let badReferrals = 0;
  referralSnap.docs.forEach(doc => {
    const r = doc.data();
    const unitId = r.unitId;
    const matchedLesson = lessons.find(l => cleanId(l.id) === cleanId(unitId) || (Array.isArray(l.courseUnits) && l.courseUnits.map(cleanId).includes(cleanId(unitId))));
    if (!matchedLesson) {
      badReferrals++;
      console.log(`  🚨 Referral Link ${doc.id} (Tutor: ${r.tutorEmail}) maps to invalid/non-canonical ID: "${unitId}"`);
    }
  });
  console.log(`  Checked ${referralSnap.size} referral links. Bad mappings found: ${badReferrals}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.order) {
    await auditOrder(args.order);
  } else if (args.user) {
    await auditUser(args.user);
  } else if (args.tutor) {
    await auditTutor(args.tutor);
  } else {
    await generalAuditScan();
  }
}

main().catch((err) => {
  console.error("Support audit tool execution failed:", err);
  process.exit(1);
});
