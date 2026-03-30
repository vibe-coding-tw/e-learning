const admin = require('firebase-admin');

// Ensure firebase-admin uses default credentials
admin.initializeApp({
  projectId: 'e-learning-942f7'
});

const db = admin.firestore();

async function run() {
    const snapshot = await db.collection('metadata_lessons').get();
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.classroomUrl && data.classroomUrl.includes('03-master-wifi-motor.html')) {
            console.log(`Found matching master course: ${doc.id}`);
            let units = data.courseUnits || [];
            if (!units.includes('03-unit-vibe-classroom-intro.html')) {
                units.push('03-unit-vibe-classroom-intro.html');
                
                // Add the new title for UI rendering
                let unitTitles = data.unitTitles || {};
                unitTitles['03-unit-vibe-classroom-intro.html'] = 'Vibe Classroom 實務';
                
                // For legacy handling just in case, some older units might be there
                db.collection('metadata_lessons').doc(doc.id).update({
                    courseUnits: units,
                    unitTitles: unitTitles
                }).then(() => {
                    console.log('Successfully updated courseUnits for', doc.id);
                }).catch(e => {
                    console.error('Update failed:', e);
                });
            } else {
                console.log('Already contains 03-unit-vibe-classroom-intro.html');
            }
        }
    });
}

run().catch(console.error);
