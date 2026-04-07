const admin = require("firebase-admin");
process.env.OTEL_SDK_DISABLED = "true";
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "e-learning-942f7" });
}
const db = admin.firestore();
const email = "rover.k.chen@gmail.com";
const unitId = "01-unit-developer-identity.html";

async function run() {
  console.log(`Searching assignments for ${email} in unit ${unitId}`);
  
  // 1. Exact match on userEmail
  const snapshot = await db.collection("assignments")
    .where("userEmail", "==", email)
    .get();
  
  console.log(`Found ${snapshot.size} assignments total for this email.`);
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.unitId === unitId || doc.id.includes(unitId)) {
        console.log(`\nMATCH FOUND: ID=${doc.id}`);
        console.log(`Data: ${JSON.stringify(data, null, 2)}`);
    } else {
        console.log(`SKIPPING: ID=${doc.id} (Unit: ${data.unitId})`);
    }
  });

  // 2. Search for any IDs that might contain the unitId but different user email
  console.log("\nChecking for any assignments that might match the unitId as a substring in ID (any user)...");
  const unitSnapshot = await db.collection("assignments").where("unitId", "==", unitId).get();
  unitSnapshot.forEach(doc => {
    if (!snapshot.docs.some(d => d.id === doc.id)) {
        console.log(`UNIT MATCH (other user?): ${doc.id}`);
        console.log(`Data: ${JSON.stringify(doc.data(), null, 2)}`);
    }
  });

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
