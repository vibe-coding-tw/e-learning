
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'e-learning-942f7'
    });
}

const db = admin.firestore();

function normalizeGitHubUrl(url = '') {
    if (!url) return '';
    try {
        let clean = url.trim().toLowerCase();
        // Extract URL if it's inside text
        const match = clean.match(/https:\/\/classroom\.github\.com\/a\/[a-zA-Z0-9_-]+/);
        if (match) clean = match[0];
        
        clean = clean.replace(/\/+$/, '');
        return clean;
    } catch (e) {
        return url.trim().toLowerCase();
    }
}

async function fixUnboundAssignments() {
    console.log("Starting Deep Fix: Loading referral_links index...");
    const linksSnap = await db.collection('referral_links').get();
    const urlMap = new Map();
    
    linksSnap.forEach(doc => {
        const data = doc.data();
        if (data.url && data.tutorEmail) {
            const norm = normalizeGitHubUrl(data.url);
            urlMap.set(norm, data.tutorEmail);
        }
    });
    
    console.log(`Loaded ${urlMap.size} unique normalized URLs.`);

    console.log("Fetching assignments...");
    const assignmentsSnap = await db.collection('assignments').get();
    
    let fixCount = 0;
    let skippedCount = 0;
    const batch = db.batch();

    for (const doc of assignmentsSnap.docs) {
        const data = doc.data();
        
        // Find ANY field that contains the classroom URL
        let foundUrl = "";
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string' && value.includes('classroom.github.com')) {
                foundUrl = value;
                break;
            }
        }

        const assignedTeacher = data.assignedTeacherEmail || data.assignedTutorEmail;
        const needsFix = !assignedTeacher || assignedTeacher === 'info@vibe-coding.tw' || assignedTeacher === null;

        if (foundUrl && needsFix) {
            const normalizedUrl = normalizeGitHubUrl(foundUrl);
            const tutorEmail = urlMap.get(normalizedUrl);

            if (tutorEmail) {
                console.log(`MATCH FOUND: ${doc.id} | Tutor: ${tutorEmail}`);
                
                batch.update(doc.ref, {
                    assignedTeacherEmail: tutorEmail,
                    assignedTutorEmail: tutorEmail,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Update student's unitAssignments
                const userEmail = data.userEmail || data.studentEmail;
                const uidFromId = doc.id.split('_')[0]; // Handle k36RVpPwZoftnLwMtG4S4d4yLmj2_...

                if (userEmail) {
                    const userSnap = await db.collection('users').where('email', '==', userEmail).limit(1).get();
                    if (!userSnap.empty) {
                        const userRef = userSnap.docs[0].ref;
                        batch.update(userRef, { [`unitAssignments.${data.unitId}`]: tutorEmail });
                    }
                } else if (uidFromId && uidFromId.length > 20) {
                    const userRef = db.collection('users').doc(uidFromId);
                    batch.update(userRef, { [`unitAssignments.${data.unitId}`]: tutorEmail });
                }

                fixCount++;
            } else {
                skippedCount++;
            }
        }
    }

    if (fixCount > 0) {
        await batch.commit();
        console.log(`Committed ${fixCount} deep fixes.`);
    }
    
    console.log(`\nSummary:`);
    console.log(`Fixed: ${fixCount}`);
    console.log(`Skipped (No tutor match): ${skippedCount}`);
}

fixUnboundAssignments().catch(console.error);
