const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin using default credentials (works if logged in via CLI)
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();
const jsonPath = path.join(__dirname, 'reconstructed_lessons.json');

async function sync() {
    try {
        console.log("Checking if reconstructed_lessons.json exists...");
        if (!fs.existsSync(jsonPath)) {
            console.error("Error: reconstructed_lessons.json not found in functions/ directory.");
            return;
        }

        const lessons = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log(`Read ${lessons.length} courses from JSON.`);

        const collectionRef = db.collection('metadata_lessons');

        console.log("Starting Firestore sync...");
        for (const lesson of lessons) {
            process.stdout.write(`Syncing course: ${lesson.courseId}... `);
            await collectionRef.doc(lesson.courseId).set(lesson);
            console.log("Done.");
        }

        console.log("\nSUCCESS: All courses synchronized to Firestore 'metadata_lessons' collection.");
    } catch (err) {
        console.error("\nFAILED to sync:", err.message);
        console.log("\nTIP: If you get a 'Could not load the default credentials' error, please run 'gcloud auth application-default login' in your terminal.");
    }
}

sync();
