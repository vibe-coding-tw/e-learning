const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json'); // I'll check if it exists

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const uid = 'k36RVpPwZoftnLwMtG4S4d4yLmj2';
db.collection('users').doc(uid).set({ role: 'admin' }, { merge: true })
  .then(() => { console.log('Successfully updated role to admin'); process.exit(0); })
  .catch((err) => { console.error('Error updating role:', err); process.exit(1); });
