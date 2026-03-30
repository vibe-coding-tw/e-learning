const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function listPaidUsers() {
  try {
    const orderSnap = await db.collection('orders').where('status', '==', 'SUCCESS').get();
    const paidUids = new Set();
    const orderDetails = {};
    
    orderSnap.forEach(doc => {
      const data = doc.data();
      const uid = data.uid;
      if (uid && uid !== 'GUEST') {
        paidUids.add(uid);
        if (!orderDetails[uid]) orderDetails[uid] = [];
        const items = Object.keys(data.items || {}).join(', ');
        const dateStr = data.paymentDate || (data.createdAt ? data.createdAt.toDate().toLocaleDateString('zh-TW') : 'N/A');
        orderDetails[uid].push({ items, date: dateStr });
      }
    });

    if (paidUids.size === 0) {
      console.log('目前尚無付費學生記錄。');
      return;
    }

    const userSnaps = await Promise.all(Array.from(paidUids).map(id => db.collection('users').doc(id).get()));
    
    console.log(`--- 付費學生名單 (總共 ${paidUids.size} 位) ---`);
    userSnaps.forEach(snap => {
      const u = snap.data() || {};
      const uid = snap.id;
      const history = (orderDetails[uid] || []).map(h => `${h.items} [${h.date}]`).join(' | ');
      console.log(`[${u.name || '(無名)'}] ${u.email || '(無EMAIL)'} | 購買內容: ${history}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

listPaidUsers();
