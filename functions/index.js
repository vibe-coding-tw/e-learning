const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// ==========================================
// 綠界 (ECPay) CheckMacValue 產生邏輯
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
// Firebase Cloud Function (正規 .env 版)
// ==========================================

exports.initiatePayment = onCall({ 
    region: "asia-east1", 
    cors: true,
}, async (request) => {

    // ★★★ 修正重點：從 process.env 讀取變數 ★★★
    // 這裡定義變數，確保下方主程式能抓到
    const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
    const HASH_KEY = process.env.ECPAY_HASH_KEY;
    const HASH_IV = process.env.ECPAY_HASH_IV;
    const API_URL = process.env.ECPAY_API_URL;

    console.log("開始執行 initiatePayment (使用 .env 配置)..."); 

    // 防呆機制：如果 .env 沒讀到，在 Log 印出警告
    if (!MERCHANT_ID || !HASH_KEY) {
        console.error("嚴重錯誤：讀取不到 .env 環境變數，請檢查部署設定。");
        throw new HttpsError('internal', '伺服器配置錯誤 (Missing Env Vars)');
    }

    if (!request.auth) {
        throw new HttpsError('unauthenticated', '請先登入會員。');
    }

    try {
        const { amount, returnUrl } = request.data;
        const finalAmount = parseInt(amount, 10);
        const orderNumber = `VIBE${Date.now()}`; 
        const tradeDate = getCurrentTime();

        console.log(`準備建立訂單: ${orderNumber}, 金額: ${finalAmount}`);

        const ecpayParams = {
            MerchantID: MERCHANT_ID,
            MerchantTradeNo: orderNumber,
            MerchantTradeDate: tradeDate,
            PaymentType: 'aio',
            TotalAmount: finalAmount,
            TradeDesc: 'VibeCodingCourse', 
            ItemName: 'Vibe Coding 線上課程', 
            ReturnURL: returnUrl, 
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
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            paymentParams: ecpayParams,
            apiUrl: API_URL
        };

    } catch (error) {
        console.error("後端發生錯誤:", error);
        throw new HttpsError('internal', `後端處理失敗: ${error.message}`);
    }
});