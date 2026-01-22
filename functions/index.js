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
// Firebase Cloud Function (支援動態商品名稱版)
// ==========================================

exports.initiatePayment = onCall({ 
    region: "asia-east1", 
    cors: true,
}, async (request) => {

    const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
    const HASH_KEY = process.env.ECPAY_HASH_KEY;
    const HASH_IV = process.env.ECPAY_HASH_IV;
    const API_URL = process.env.ECPAY_API_URL;

    if (!MERCHANT_ID || !HASH_KEY) {
        console.error("嚴重錯誤：讀取不到 .env 環境變數");
        throw new HttpsError('internal', '伺服器配置錯誤');
    }

    if (!request.auth) {
        throw new HttpsError('unauthenticated', '請先登入會員。');
    }

    try {
        // ★★★ 1. 這裡多接收一個 cartDetails 參數 ★★★
        const { amount, returnUrl, cartDetails } = request.data;
        const finalAmount = parseInt(amount, 10);
        const orderNumber = `VIBE${Date.now()}`; 
        const tradeDate = getCurrentTime();

        // ★★★ 2. 動態產生商品名稱字串 ★★★
        let itemNameStr = 'Vibe Coding 線上課程'; // 預設值
        
        if (cartDetails && Object.keys(cartDetails).length > 0) {
            const names = [];
            // 遍歷購物車物件
            Object.values(cartDetails).forEach(item => {
                // 組合格式：課程名稱 x 數量 (例如: Python入門 x 1)
                // 移除可能破壞格式的特殊符號
                const cleanName = (item.name || '未知課程').replace(/[#&]/g, ' '); 
                names.push(`${cleanName} x ${item.quantity || 1}`);
            });
            // 用 # 串接所有商品 (綠界規定)
            itemNameStr = names.join('#');
            
            // 綠界限制 ItemName 最長 200 字，超過截斷
            if (itemNameStr.length > 190) {
                itemNameStr = itemNameStr.substring(0, 190) + '...';
            }
        }

        console.log(`建立訂單: ${orderNumber}, 商品: ${itemNameStr}`);

        const ecpayParams = {
            MerchantID: MERCHANT_ID,
            MerchantTradeNo: orderNumber,
            MerchantTradeDate: tradeDate,
            PaymentType: 'aio',
            TotalAmount: finalAmount,
            TradeDesc: 'VibeCodingCourse', 
            ItemName: itemNameStr, // ★★★ 3. 使用動態產生的名稱 ★★★
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
            items: cartDetails, // 這裡也存一份完整的 JSON 到資料庫方便查詢
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