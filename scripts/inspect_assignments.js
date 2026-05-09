
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

async function inspectFields() {
    console.log("Inspecting field names in 'assignments' collection...");
    const snap = await db.collection('assignments').limit(10).get();
    
    snap.forEach(doc => {
        console.log(`\nDocument ID: ${doc.id}`);
        const data = doc.data();
        console.log("Fields:", Object.keys(data));
        
        // Let's print fields that look like URLs or Emails
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                if (value.includes('http')) console.log(`  [URL-like] ${key}: ${value}`);
                if (value.includes('@')) console.log(`  [Email-like] ${key}: ${value}`);
            }
        }
    });
}

inspectFields().catch(console.error);
