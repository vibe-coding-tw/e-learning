const admin = require('firebase-admin');
// Use the projectId directly from the env or hardcode it
admin.initializeApp({
  projectId: 'e-learning-942f7'
});
const db = admin.firestore();

async function listPaidUsersLegacy() {
  try {
    const orderSnap = await db.collection('orders')
      .where('status', '==', 'SUCCESS')
      .get();
    
    const paidDetails = {};

    orderSnap.forEach(doc => {
      const data = doc.data();
      const uid = data.uid;
      if (uid && uid !== 'GUEST') {
        if (!paidDetails[uid]) paidDetails[uid] = [];
        const items = Object.keys(data.items || {}).join(', ');
        const dateStr = data.paymentDate || (data.createdAt ? data.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A');
        paidDetails[uid].push({ items, date: dateStr });
      }
    });

    const uids = Object.keys(paidDetails);
    if (uids.length === 0) {
      console.log('目前尚無付費紀錄。');
      process.exit(0);
    }

    const userPromises = uids.map(id => db.collection('users').doc(id).get());
    const userSnaps = await Promise.all(userPromises);

    console.log(`--- 付費學生清單 (共 ${uids.length} 名) ---`);
    userSnaps.forEach(snap => {
      const u = snap.data() || {};
      const uid = snap.id;
      const history = (paidDetails[uid] || []).map(h => `${h.items} (${h.date})`).join(' | ');
      console.log(`[${u.name || '(未知)'}] ${u.email || '(未知email)'} | 項目: ${history}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit(0);
  }
}

listPaidUsersLegacy();
