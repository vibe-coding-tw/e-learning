// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require('firebase-admin');

// 初始化 Admin SDK
admin.initializeApp();
const db = admin.firestore();

// --- 1. 檢查課程權限函式 ---
exports.checkPaymentAuthorization = onCall({ region: "asia-east1" }, async (request) => {
    // 檢查用戶是否已登入
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '您必須先登入才能驗證課程權限。');
    }

    const userId = request.auth.uid;
    const courseId = request.data.courseId || null;
    const targetUrl = request.data.targetUrl || null;

    if (!courseId || !targetUrl) {
        throw new HttpsError('invalid-argument', '缺少課程 ID 或目標 URL 參數。');
    }

    try {
        // 在 Firestore 查詢該用戶是否已購買
        const userDocRef = db.collection('paid_users').doc(userId);
        const doc = await userDocRef.get();

        // 這裡建議檢查 courses Map 或對應的邏輯
        const userData = doc.data();
        const isAuthorized = doc.exists && userData.is_paid === true && userData.course_id === courseId;

        if (isAuthorized) {
            return {
                status: 'AUTHORIZED',
                redirectUrl: decodeURIComponent(targetUrl)
            };
        } else {
            return {
                status: 'UNAUTHORIZED',
                redirectUrl: 'cart.html?status=unpaid'
            };
        }
    } catch (error) {
        logger.error("驗證發生錯誤:", error);
        throw new HttpsError('internal', '伺服器端驗證失敗。');
    }
});

// --- 2. Line Pay 結帳函式 ---
exports.initiateLinePayPayment = onCall({ region: "asia-east1" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "您必須先登入才能付款。");
    }

    const { amount, cartDetails } = request.data;
    const uid = request.auth.uid;

    logger.info(`用戶 ${uid} 嘗試發起金額為 ${amount} 的交易`);

    try {
        // TODO: 串接 Line Pay API
        return {
            webPaymentUrl: "https://sandbox-api-pay.line.me/測試網址",
            message: "交易初始化成功"
        };
    } catch (error) {
        logger.error("Line Pay 請求失敗", error);
        throw new HttpsError("internal", "建立 Line Pay 交易時發生錯誤。");
    }
});