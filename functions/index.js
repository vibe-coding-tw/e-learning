const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("crypto"); // Node.js 內建加密模組

admin.initializeApp();

// ==========================================
// 藍新金流加密核心邏輯
// ==========================================

// 1. AES 加密 (將交易資料加密)
function encryptAES(data, key, iv) {
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
}

// 2. SHA256 雜湊 (產生檢查碼)
function encryptSHA256(data) {
    return crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
}

// 3. 將物件轉換為 URL Query String (例如: Item=A&Amt=100...)
function genDataChain(order) {
    return Object.keys(order)
        .filter((key) => order[key] !== undefined && order[key] !== "") // 過濾空值
        .map((key) => `${key}=${encodeURIComponent(order[key])}`) // 進行 URL 編碼
        .join("&");
}

// ==========================================
// Firebase Cloud Function: initiatePayment
// ==========================================

exports.initiatePayment = onCall(async (request) => {
    // 1. 驗證使用者是否登入
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '請先登入會員。');
    }

    // 2. 獲取前端傳來的資料
    const { amount, email, cartDetails, returnUrl, notifyUrl } = request.data;
    
    // 3. 從環境變數 (.env) 讀取金鑰
    const MERCHANT_ID = process.env.NEWEBPAY_MERCHANT_ID;
    const HASH_KEY = process.env.NEWEBPAY_HASH_KEY;
    const HASH_IV = process.env.NEWEBPAY_HASH_IV;
    const API_URL = process.env.NEWEBPAY_API_URL;
    const VERSION = process.env.NEWEBPAY_VERSION;

    if (!MERCHANT_ID || !HASH_KEY || !HASH_IV) {
        throw new HttpsError('failed-precondition', '伺服器金流設定缺失，請聯絡管理員。');
    }

    // 4. 產生訂單編號 (格式: VIBE + 時間戳記 + 隨機數)
    // 藍新要求訂單編號不能重複且長度有限制
    const timeStamp = Date.now();
    const orderNumber = `VIBE${timeStamp}`;

    try {
        // 5. 準備要加密的交易參數 (TradeInfo)
        // 這裡僅列出必要欄位，更多欄位請參考藍新文件
        const orderParams = {
            MerchantID: MERCHANT_ID,
            RespondType: "JSON",
            TimeStamp: Math.floor(timeStamp / 1000), // Unix timestamp (秒)
            Version: VERSION,
            MerchantOrderNo: orderNumber,
            Amt: amount,
            ItemDesc: "Vibe Coding 課程商品", // 商品描述，不能太長
            Email: email || "",
            LoginType: 0, // 0: 不需登入藍新會員
            ReturnURL: returnUrl, // 支付完成返回網址
            NotifyURL: notifyUrl, // 背景支付通知網址
            CREDIT: 1, // 開啟信用卡
            WEBATM: 1, // 開啟 WebATM
            VACC: 1    // 開啟 ATM 轉帳
        };

        // 6. 執行加密流程
        // 步驟 A: 將參數轉為 Query String
        const dataChain = genDataChain(orderParams);
        
        // 步驟 B: AES 加密 -> 得到 TradeInfo
        const tradeInfo = encryptAES(dataChain, HASH_KEY, HASH_IV);
        
        // 步驟 C: 產生檢查碼 -> 得到 TradeSha
        // 格式: HashKey=xxx&TradeInfo=xxx&HashIV=xxx
        const shaString = `HashKey=${HASH_KEY}&${tradeInfo}&HashIV=${HASH_IV}`;
        const tradeSha = encryptSHA256(shaString);

        // 7. (選用) 將訂單先存入 Firebase Firestore 以便後續對帳
        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: request.auth.uid,
            amount: amount,
            status: "PENDING", // 待付款
            items: cartDetails,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            gateway: "NEWEBPAY"
        });

        // 8. 回傳給前端
        return {
            MerchantID: MERCHANT_ID,
            TradeInfo: tradeInfo,
            TradeSha: tradeSha,
            Version: VERSION,
            apiUrl: API_URL, // 告訴前端要送去哪裡
            orderNumber: orderNumber
        };

    } catch (error) {
        console.error("加密過程發生錯誤:", error);
        throw new HttpsError('internal', '建立交易失敗: ' + error.message);
    }
});