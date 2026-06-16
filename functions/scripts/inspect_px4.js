process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'e-learning-942f7' });
}
const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('metadata_lessons').get();
  console.log(`Found ${snapshot.size} documents in metadata_lessons:`);
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`- ${doc.id}: ${data.title} (${data.isPhysical ? 'physical' : 'digital'})`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
