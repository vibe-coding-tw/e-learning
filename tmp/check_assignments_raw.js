const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();
const userId = 'k36RVpPwZoftnLwMtG4S4d4yLmj2';

db.collection('assignments')
  .where('userId', '==', userId)
  .get()
  .then(snapshot => {
    const results = [];
    snapshot.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() });
    });
    console.log('---BEGIN_RESULTS---');
    console.log(JSON.stringify(results, null, 2));
    console.log('---END_RESULTS---');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error getting documents', err);
    process.exit(1);
  });
