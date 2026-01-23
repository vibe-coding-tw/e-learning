const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// ==========================================
// 共用設定
// ==========================================
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || "3271550";
const HASH_KEY = process.env.ECPAY_HASH_KEY || "ekyTDhA4ifnwfRFu";
const HASH_IV = process.env.ECPAY_HASH_IV || "FnoEMtZFKRg6nUEx";
// 您的專案 ID (用於組裝 NotifyURL)
const PROJECT_ID = "e-learning-942f7"; 
const REGION = "asia-east1";

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

        // 這裡設定綠界付款完成後，要背景呼叫的網址 (Webhook)
        // 格式: https://{地區}-{專案ID}.cloudfunctions.net/paymentNotify
        const notifyUrl = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentNotify`;

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
            ReturnURL: returnUrl,  // 使用者瀏覽器跳轉回來的網址
            NotifyURL: notifyUrl,  // ★★★ 綠界伺服器背景通知的網址 ★★★
            ClientBackURL: returnUrl || "", 
            ChoosePayment: 'ALL', 
            EncryptType: '1', 
        };

        ecpayParams.CheckMacValue = generateCheckMacValue(ecpayParams, HASH_KEY, HASH_IV);

        // 建立訂單，狀態為 PENDING (待付款)
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
            // 如果您在 .env 有設定 ECPAY_API_URL 就用它，沒有就用預設的正式網址
            apiUrl: process.env.ECPAY_API_URL || "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5" 
        };

    } catch (error) {
        console.error("建立訂單錯誤:", error);
        throw new HttpsError('internal', `後端錯誤: ${error.message}`);
    }
});

// ==========================================
// 2. 接收綠界付款通知 (paymentNotify) ★★★ 新增 ★★★
// ==========================================
// 這是一個 HTTP Function (onRequest)，因為綠界是用傳統 POST Form 傳送資料
exports.paymentNotify = onRequest({ region: REGION }, async (req, res) => {
    // 綠界傳送的 Content-Type 是 application/x-www-form-urlencoded
    const data = req.body; 

    console.log("收到綠界付款通知:", JSON.stringify(data));

    try {
        // 1. 基本檢查：是否有回傳 RtnCode
        if (!data || !data.RtnCode) {
            console.error("無效的通知資料");
            return res.status(400).send("0|Error");
        }

        // 2. 檢查交易狀態 (RtnCode === '1' 代表成功)
        if (data.RtnCode === '1') {
            const orderId = data.MerchantTradeNo; // 我們的訂單編號
            
            // 3. 更新資料庫狀態為 SUCCESS
            console.log(`訂單 ${orderId} 付款成功，正在更新資料庫...`);
            
            await admin.firestore().collection("orders").doc(orderId).update({
                status: "SUCCESS",
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                ecpayTradeNo: data.TradeNo || "", // 綠界的交易序號
                paymentDate: data.PaymentDate || ""
            });

            // 4. 回應綠界我們收到了 (必須回傳 1|OK)
            return res.status(200).send("1|OK");
        } else {
            console.warn(`訂單 ${data.MerchantTradeNo} 付款失敗或模擬付款 (RtnCode: ${data.RtnCode})`);
            // 即使失敗也要回應 1|OK 避免綠界一直重試，或者您可以選擇更新訂單為 FAILED
            return res.status(200).send("1|OK");
        }

    } catch (error) {
        console.error("處理付款通知失敗:", error);
        // 如果是伺服器錯誤，回傳錯誤代碼，讓綠界稍後重試
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
        // ★★★ 修正點：只抓取狀態為 "SUCCESS" (付款成功) 的訂單 ★★★
        // 我們移除了 "PENDING"，所以只有真正付款成功 (透過 paymentNotify 更新) 的訂單才有效
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
            // 檢查 items 是否包含此課程
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