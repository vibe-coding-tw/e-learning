const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// ... (保留最上面的引用與 admin.initializeApp)

// ==========================================
// ★★★ 修改重點：切換為綠界官方測試帳號 (必過) ★★★
// ==========================================
// 測試環境專用商店代號
const MERCHANT_ID = "2000132"; 
// 測試環境專用 HashKey
const HASH_KEY = "5294y06JbISpM5x9"; 
// 測試環境專用 HashIV
const HASH_IV = "v77hoKGq4kWxNNIS"; 

// ★★★ 注意：這裡必須改用 Stage (測試) 網址 ★★★
const ECPAY_API_URL = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";

const REGION = "asia-east1";

// ... (中間工具函式 generateCheckMacValue 與 getCurrentTime 保持不變) ...

/*
// ==========================================
// 共用設定
// ==========================================
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || "3271550";
const HASH_KEY = process.env.ECPAY_HASH_KEY || "ekyTDhA4ifnwfRFu";
const HASH_IV = process.env.ECPAY_HASH_IV || "FnoEMtZFKRg6nUEx";
const REGION = "asia-east1";
*/
// ==========================================
// 工具函式
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
    region: REGION, 
    cors: true,
}, async (request) => {
    
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '請先登入會員。');
    }

    try {
        const { amount, returnUrl, cartDetails } = request.data;
        const finalAmount = parseInt(amount, 10);
        const orderNumber = `VIBE${Date.now()}`; 
        const tradeDate = getCurrentTime();

        // ★★★ 請確認這裡是用您剛剛測試成功 (有顯示 1|OK) 的那個網址 ★★★
        // (帶有亂碼的通常最穩，例如 b3b7ucfdka-de.a.run.app)
        //const notifyUrl = `https://paymentnotify-b3b7ucfdka-de.a.run.app`;
        // ✅ 請改成您之前測試成功 (顯示 1|OK) 的那個網址
        const notifyUrl = "https://asia-east1-e-learning-942f7.cloudfunctions.net/paymentNotify";

        console.log(`[測試模式] 建立訂單: ${orderNumber}, NotifyURL: ${notifyUrl}`);

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
            NotifyURL: notifyUrl,
            ClientBackURL: returnUrl || "", 
            ChoosePayment: 'ALL', 
            EncryptType: '1', 
        };

        ecpayParams.CheckMacValue = generateCheckMacValue(ecpayParams, HASH_KEY, HASH_IV);

        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: request.auth.uid,
            amount: finalAmount,
            status: "PENDING", 
            gateway: "ECPAY",
            items: cartDetails,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { 
            paymentParams: ecpayParams, 
            // ★★★ 回傳測試環境的 API 網址 ★★★
            apiUrl: ECPAY_API_URL 
        };

    } catch (error) {
        console.error("建立訂單錯誤:", error);
        throw new HttpsError('internal', `後端錯誤: ${error.message}`);
    }
});

// ... (後面的 paymentNotify 和 checkPaymentAuthorization 保持不變) ...
/*
// ==========================================
// 1. 建立訂單 (initiatePayment)
// ==========================================
exports.initiatePayment = onCall({ 
    region: REGION, 
    cors: true,
}, async (request) => {
    
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '請先登入會員。');
    }

    try {
        const { amount, returnUrl, cartDetails } = request.data;
        const finalAmount = parseInt(amount, 10);
        const orderNumber = `VIBE${Date.now()}`; 
        const tradeDate = getCurrentTime();

        // ★★★ 修正處：使用您正確的 Cloud Run 網址 ★★★
        const notifyUrl = `https://paymentnotify-878397058574.asia-east1.run.app`;

        console.log(`建立訂單: ${orderNumber}, NotifyURL: ${notifyUrl}`);

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
            NotifyURL: notifyUrl, // 這邊就會用到上方正確的網址
            ClientBackURL: returnUrl || "", 
            ChoosePayment: 'ALL', 
            EncryptType: '1', 
        };

        ecpayParams.CheckMacValue = generateCheckMacValue(ecpayParams, HASH_KEY, HASH_IV);

        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: request.auth.uid,
            amount: finalAmount,
            status: "PENDING", 
            gateway: "ECPAY",
            items: cartDetails,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { 
            paymentParams: ecpayParams, 
            apiUrl: process.env.ECPAY_API_URL || "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5" 
        };

    } catch (error) {
        console.error("建立訂單錯誤:", error);
        throw new HttpsError('internal', `後端錯誤: ${error.message}`);
    }
});
*/
// ==========================================
// 2. 接收綠界付款通知 (paymentNotify)
// ==========================================
exports.paymentNotify = onRequest({ region: REGION }, async (req, res) => {
    const data = req.body; 

    console.log("收到綠界請求:", JSON.stringify(data));

    try {
        // 握手測試與空資料處理：回傳 200 OK
        if (!data || !data.RtnCode) {
            console.log("偵測到空資料或握手測試，回傳 1|OK 以通過驗證");
            return res.status(200).send("1|OK");
        }

        if (data.RtnCode === '1') {
            const orderId = data.MerchantTradeNo; 
            console.log(`訂單 ${orderId} 付款成功，更新資料庫...`);
            
            await admin.firestore().collection("orders").doc(orderId).update({
                status: "SUCCESS",
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                ecpayTradeNo: data.TradeNo || "",
                paymentDate: data.PaymentDate || ""
            });

            return res.status(200).send("1|OK");
        } else {
            console.warn(`訂單 ${data.MerchantTradeNo} 交易失敗 (RtnCode: ${data.RtnCode})`);
            return res.status(200).send("1|OK");
        }

    } catch (error) {
        console.error("處理付款通知失敗:", error);
        return res.status(500).send("0|Internal Error");
    }
});

// ==========================================
// 3. 檢查權限 (checkPaymentAuthorization)
// ==========================================
exports.checkPaymentAuthorization = onCall({ 
    region: REGION, 
    cors: true,
}, async (request) => {
    
    if (!request.auth) {
        return { authorized: false, message: "User not logged in" };
    }

    const uid = request.auth.uid;
    const { pageId } = request.data; 

    try {
        const ordersSnapshot = await admin.firestore().collection("orders")
            .where("uid", "==", uid)
            .where("status", "==", "SUCCESS") 
            .get();

        if (ordersSnapshot.empty) {
            return { authorized: false, message: "No paid orders found" };
        }

        let hasCourse = false;
        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.items && data.items[pageId]) {
                hasCourse = true;
            }
        });

        if (hasCourse) {
            return { authorized: true };
        } else {
            return { authorized: false, message: "Course not paid" };
        }

    } catch (error) {
        console.error("檢查權限錯誤:", error);
        throw new HttpsError('internal', `檢查失敗: ${error.message}`);
    }
});