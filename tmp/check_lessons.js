const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkLessons() {
    const snapshot = await db.collection('metadata_lessons').get();
    snapshot.forEach(doc => {
        console.log(`ID: ${doc.id}, data:`, doc.data());
    });
}

checkLessons();
