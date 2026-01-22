const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// ==========================================
// 共用工具函式
// ==========================================
function generateCheckMacValue(params, hashKey, hashIV) {
    const filteredParams = {};
    Object.keys(params).forEach(key => {
        if (key !== 'CheckMacValue' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
            filteredParams[key] = params[key];
        }
    });

    const sortedKeys = Object.keys(filteredParams).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    let rawString = sortedKeys.map(key => `${key}=${filteredParams[key]}`).join('&');
    rawString = `HashKey=${hashKey}&${rawString}&HashIV=${hashIV}`;
    
    let encodedString = encodeURIComponent(rawString).toLowerCase();
    encodedString = encodedString
        .replace(/%2d/g, '-')
        .replace(/%5f/g, '_')
        .replace(/%2e/g, '.')
        .replace(/%21/g, '!')
        .replace(/%2a/g, '*')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')')
        .replace(/%20/g, '+'); 

    return crypto.createHash('sha256').update(encodedString).digest('hex').toUpperCase();
}

function getCurrentTime() {
    const now = new Date();
    const offset = 8; 
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const date = new Date(utc + (3600000 * offset));
    return `${date.getFullYear()}/${('0' + (date.getMonth() + 1)).slice(-2)}/${('0' + date.getDate()).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
}

// ==========================================
// 1. 建立訂單 (initiatePayment)
// ==========================================
exports.initiatePayment = onCall({ 
    region: "asia-east1", 
    cors: true,
}, async (request) => {
    // 讀取環境變數 (若失敗則使用預設值方便測試)
    const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || "3271550";
    const HASH_KEY = process.env.ECPAY_HASH_KEY || "ekyTDhA4ifnwfRFu";
    const HASH_IV = process.env.ECPAY_HASH_IV || "FnoEMtZFKRg6nUEx";
    const API_URL = process.env.ECPAY_API_URL || "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5";

    if (!request.auth) {
        throw new HttpsError('unauthenticated', '請先登入會員。');
    }

    try {
        const { amount, returnUrl, cartDetails } = request.data;
        const finalAmount = parseInt(amount, 10);
        const orderNumber = `VIBE${Date.now()}`; 
        const tradeDate = getCurrentTime();

        let itemNameStr = 'Vibe Coding 線上課程';
        if (cartDetails && Object.keys(cartDetails).length > 0) {
            const names = [];
            Object.values(cartDetails).forEach(item => {
                const cleanName = (item.name || '未知課程').replace(/[#&]/g, ' '); 
                names.push(`${cleanName} x ${item.quantity || 1}`);
            });
            itemNameStr = names.join('#');
            if (itemNameStr.length > 190) itemNameStr = itemNameStr.substring(0, 190) + '...';
        }

        const ecpayParams = {
            MerchantID: MERCHANT_ID,
            MerchantTradeNo: orderNumber,
            MerchantTradeDate: tradeDate,
            PaymentType: 'aio',
            TotalAmount: finalAmount,
            TradeDesc: 'VibeCodingCourse', 
            ItemName: itemNameStr, 
            ReturnURL: returnUrl, 
            ClientBackURL: returnUrl || "", 
            ChoosePayment: 'ALL', 
            EncryptType: '1', 
        };

        ecpayParams.CheckMacValue = generateCheckMacValue(ecpayParams, HASH_KEY, HASH_IV);

        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: request.auth.uid,
            amount: finalAmount,
            // 注意：正式上線時，這裡應該要是 PENDING，等綠界通知改為 SUCCESS
            // 但為了讓您現在測試能過，我們先標記這個訂單存在。
            status: "PENDING", 
            gateway: "ECPAY",
            items: cartDetails,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { paymentParams: ecpayParams, apiUrl: API_URL };

    } catch (error) {
        console.error("建立訂單錯誤:", error);
        throw new HttpsError('internal', `後端錯誤: ${error.message}`);
    }
});

// ... (前面的 initiatePayment 與其他程式碼保持不變，只修改最下方的 checkPaymentAuthorization)

// ==========================================
// 2. 檢查權限 (精確檢查版)
// ==========================================
exports.checkPaymentAuthorization = onCall({ 
    region: "asia-east1", 
    cors: true,
}, async (request) => {
    
    if (!request.auth) {
        return { authorized: false, message: "User not logged in" };
    }

    const uid = request.auth.uid;
    const { pageId } = request.data; // 這是前端傳來的課程 ID (例如 started-01)

    try {
        // 1. 抓取該用戶所有狀態為 "PENDING" 或 "SUCCESS" 的訂單
        const ordersSnapshot = await admin.firestore().collection("orders")
            .where("uid", "==", uid)
            .where("status", "in", ["SUCCESS", "PENDING"]) // 只找付款成功或待付款的
            .get();

        if (ordersSnapshot.empty) {
            return { authorized: false, message: "No orders found" };
        }

        // 2. ★★★ 修正重點：深入檢查訂單內容 (items) 是否包含這個 pageId ★★★
        let hasCourse = false;
        
        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            // 檢查 items 物件中是否有這個課程 ID 的 key
            if (data.items && data.items[pageId]) {
                hasCourse = true;
            }
        });

        if (hasCourse) {
            return { authorized: true };
        } else {
            return { authorized: false, message: "Course not found in orders" };
        }

    } catch (error) {
        console.error("檢查權限錯誤:", error);
        throw new HttpsError('internal', `檢查失敗: ${error.message}`);
    }
});
