const admin = require('firebase-admin');

// Initialize with project ID
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: "e-learning-942f7"
    });
}

const db = admin.firestore();
const uid = 'lmg7jPw34ffuxRrSWLohzL9uey23';
const unitId = 'start-01-unit-html5-basics.html';
const classroomUrl = 'https://classroom.github.com/a/TFjFeGBg';

async function updateTutorConfig() {
    try {
        console.log(`[Script] Attempting to update Firestore for ${uid}...`);
        const userRef = db.collection('users').doc(uid);
        
        await userRef.set({
            tutorConfigs: {
                [unitId]: {
                    githubClassroomUrl: classroomUrl,
                    authorized: true
                }
            }
        }, { merge: true });
        
        console.log(`✅ Success: Updated ${unitId} Classroom URL.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error updating Firestore:", error);
        process.exit(1);
    }
}

updateTutorConfig();
