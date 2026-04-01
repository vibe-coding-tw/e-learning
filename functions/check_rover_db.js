const admin = require('firebase-admin');
admin.initializeApp({ projectId: "e-learning-942f7" });
const db = admin.firestore();
const email = 'rover.k.chen@gmail.com';
db.collection('users').where('email', '==', email).get().then(s => {
  if (s.empty) { console.log('USER_NOT_FOUND_BY_EMAIL'); process.exit(0); }
  s.forEach(d => {
    console.log('USER_UID:' + d.id);
    console.log('USER_DATA:' + JSON.stringify(d.data()));
  });
  process.exit(0);
}).catch(err => { console.error(err); process.exit(1); });
