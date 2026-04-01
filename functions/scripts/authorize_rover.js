const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const email = 'rover.k.chen@gmail.com';
const unitId = '01-unit-vscode-setup.html';

async function authorize() {
    console.log(`Starting authorization for ${email} on ${unitId}...`);

    // 1. Find UID
    const usersSnap = await db.collection('users').where('email', '==', email).get();
    if (usersSnap.empty) {
        console.error("User not found in 'users' collection.");
        return;
    }
    const uid = usersSnap.docs[0].id;
    const userData = usersSnap.docs[0].data();

    // 2. Update User-Centric Doc (New Architecture)
    const tutorData = {
        authorized: true,
        email: email,
        name: userData.name || userData.displayName || email.split('@')[0],
        qualifiedAt: new Date().toISOString(),
        githubClassroomUrl: "authorized"
    };

    await db.collection('users').doc(uid).set({
        tutorConfigs: {
            [unitId]: tutorData
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 3. Update course_configs (Legacy Fallback)
    await db.collection('course_configs').doc(unitId).set({
        authorizedTutors: admin.firestore.FieldValue.arrayUnion(email),
        tutorDetails: {
            [email]: tutorData
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log("✅ Successfully authorized!");
}

authorize().catch(console.error);
