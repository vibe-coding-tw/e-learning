const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

// ==========================================
// 綠界 (ECPay) CheckMacValue 產生邏輯
// ==========================================
function generateCheckMacValue(params, hashKey, hashIV) {
    // 1. 將參數依照 Key 的字母順序排序 (A-Z)
    const sortedKeys = Object.keys(params).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    // 2. 組合成 Query String
    let rawString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    
    // 3. 前後加上 HashKey 與 HashIV
    rawString = `HashKey=${hashKey}&${rawString}&HashIV=${hashIV}`;
    
    // 4. 進行 URL Encode 並轉換特殊字元 (綠界要求的特殊規則)
    let encodedString = encodeURIComponent(rawString).toLowerCase();
    
    // 綠界特規：將某些被 encode 的符號轉回原本的符號或綠界指定的符號
    encodedString = encodedString
        .replace(/%2d/g, '-')
        .replace(/%5f/g, '_')
        .replace(/%2e/g, '.')
        .replace(/%21/g, '!')
        .replace(/%2a/g, '*')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')')
        .replace(/%20/g, '+'); // 空白轉成 +

    // 5. SHA256 加密並轉大寫
    return crypto.createHash('sha256').update(encodedString).digest('hex').toUpperCase();
}

// 獲取當前時間格式 yyyy/MM/dd HH:mm:ss
function getCurrentTime() {
    const now = new Date();
    // 調整為台灣時間 (UTC+8)
    const offset = 8; 
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const date = new Date(utc + (3600000 * offset));

    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);
    
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// ==========================================
// Firebase Cloud Function
// ==========================================

exports.initiatePayment = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '請先登入會員。');
    }

    const { amount, cartDetails, returnUrl } = request.data;
    
    // 讀取環境變數
    const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
    const HASH_KEY = process.env.ECPAY_HASH_KEY;
    const HASH_IV = process.env.ECPAY_HASH_IV;
    const API_URL = process.env.ECPAY_API_URL;

    if (!MERCHANT_ID || !HASH_KEY) {
        throw new HttpsError('failed-precondition', '伺服器設定缺失。');
    }

    const orderNumber = `VIBE${Date.now()}`; // 產生不重複訂單號
    const tradeDate = getCurrentTime();

    try {
        // 1. 準備綠界需要的參數 (不包含 CheckMacValue)
        const ecpayParams = {
            MerchantID: MERCHANT_ID,
            MerchantTradeNo: orderNumber,
            MerchantTradeDate: tradeDate,
            PaymentType: 'aio',
            TotalAmount: amount.toString(),
            TradeDesc: 'VibeCodingCourse', // 交易描述
            ItemName: 'Vibe Coding 線上課程', // 商品名稱 (多筆可用 # 分隔)
            ReturnURL: returnUrl, // 付款完成通知網址 (Server-to-Server)
            ClientBackURL: returnUrl, // 付款完成後導回前端的網址 (Client redirect)
            ChoosePayment: 'ALL', // 所有付款方式
            EncryptType: '1', // 固定為 1 (SHA256)
        };

        // 2. 計算 CheckMacValue
        const checkMacValue = generateCheckMacValue(ecpayParams, HASH_KEY, HASH_IV);

        // 3. 將 CheckMacValue 加入參數
        ecpayParams.CheckMacValue = checkMacValue;

        // 4. (選用) 寫入資料庫
        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: request.auth.uid,
            amount: amount,
            status: "PENDING",
            gateway: "ECPAY",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 5. 回傳給前端
        return {
            paymentParams: ecpayParams,
            apiUrl: API_URL
        };

    } catch (error) {
        console.error("綠界參數產生錯誤:", error);
        throw new HttpsError('internal', error.message);
    }
});