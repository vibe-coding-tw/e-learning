const admin = require('firebase-admin');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from functions/.env (not yet active in this script)
// But I can't easily. I'll just use service-account or similar if available.
// Wait! I don't need to. I'll just deploy a function that returns it.

admin.initializeApp();
const db = admin.firestore();
const uid = 'k36RVpPwZoftnLwMtG4S4d4yLmj2';
db.collection('users').doc(uid).get().then(s => {
  console.log('USER_DATA:' + JSON.stringify(s.exists ? s.data() : {exists: false}));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
