const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function main() {
  const version = "78edf84cbbc574d3aef87df61479c2e018b4f920";
  console.log("Updating contentVersion to:", version);
  await db.collection("metadata_settings").doc("content_runtime").set({
    contentVersion: version,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: "antigravity-agent"
  }, { merge: true });
  console.log("Successfully updated contentVersion in Firestore!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
