const admin = require("firebase-admin");
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "e-learning-942f7"
  });
}
const db = admin.firestore();
const email = "rover.k.chen@gmail.com";
const unitId = "01-unit-developer-identity.html";

async function run() {
  console.log(`Checking assignments for ${email} ...`);
  const snapshot = await db.collection("assignments")
    .where("userEmail", "==", email)
    .get();
  
  console.log(`Found ${snapshot.size} assignments total for this email.`);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- ID: ${doc.id}`);
    console.log(`  UnitId: ${data.unitId}`);
    console.log(`  AssignmentId: ${data.assignmentId}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  CourseId: ${data.courseId}`);
  });
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
