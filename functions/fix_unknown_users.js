const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'e-learning-942f7'
});
const db = admin.firestore();

const usersToFix = [
  {uid:'Cj8Xb2jHPzNRAOv4FCsvstOI2FN2', name:'蔡逸颺', email:'spps109422@spps.tp.edu.tw', createdAt: 1771208655457},
  {uid:'a16Qty77LiQmC6o0PBjFnzX8AOG2', name:'Henry Hsu', email:'tzuheng.h@gmail.com', createdAt: 1768810048165},
  {uid:'eocqN6Dmbwh5PVe1DVA1pd2NQLl2', name:'leo lee', email:'leolee0621@gmail.com', createdAt: 1770340750763},
  {uid:'k36RVpPwZoftnLwMtG4S4d4yLmj2', name:'Rover Chen', email:'rover.k.chen@gmail.com', createdAt: 1765873595493},
  {uid:'kUUp1Pe8V9OoSZLL4vwBTnrLcbT2', name:'陳育亮', email:'chen.yuiliang@gmail.com', createdAt: 1770432917964},
  {uid:'lmg7jPw34ffuxRrSWLohzL9uey23', name:'華岡羅浮群', email:'hkboyscout@gmail.com', createdAt: 1769267447489},
  {uid:'mPYudHif5LPeEeNKzTWW22nwdbG2', name:'Lee Leon', email:'tech@furzzle-pet.com', createdAt: 1774598905687},
  {uid:'p1dtkMwd3GhjVAwzwfWcnWWjDQf2', name:'蔡逸颺', email:'koala540886@gmail.com', createdAt: 1771497405886},
  {uid:'s1VCXo1mEDd9RVoVKIbxF6aZvk72', name:'陳子展', email:'ms0683735@gmail.com', createdAt: 1774251155821}
];

async function doFix() {
  const batch = db.batch();
  for (const u of usersToFix) {
    const ref = db.collection('users').doc(u.uid);
    batch.set(ref, {
      name: u.name,
      email: u.email,
      role: (u.email === 'rover.k.chen@gmail.com') ? 'admin' : 'student',
      createdAt: admin.firestore.Timestamp.fromMillis(u.createdAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  await batch.commit();
  console.log('Successfully fixed 9 users in Firestore.');
  process.exit(0);
}

doFix().catch(e => { console.error(e); process.exit(1); });
