// index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// 確保在運行環境中初始化 Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function: checkPaymentAuthorization
 * 透過 HTTPS Callable 調用，用於安全地驗證用戶的課程付費權限。
 * * @param {Object} data - 前端傳入的參數 { courseId: 'C1', targetUrl: '...' }
 * @param {Object} context - 包含用戶驗證資訊 (context.auth.uid)
 * @returns {Object} - 包含 status 和 redirectUrl 的結果物件
 */
exports.checkPaymentAuthorization = functions.https.onCall(async (data, context) => {
    
    // --- 1. 安全性檢查：驗證用戶是否已登入 ---
    if (!context.auth) {
        // 如果沒有登入 context，拒絕存取，並導向購物車
        functions.logger.warn('未驗證用戶嘗試存取', { data: data });
        throw new functions.https.HttpsError(
            'unauthenticated', 
            '您必須先登入才能驗證課程權限。',
            { redirectUrl: 'cart.html?error=login_required' } // 確保這裡使用 'cart.html'
        );
    }

    const userId = context.auth.uid;      // 取得當前登入的 Firebase UID
    const courseId = data.courseId || null; // 取得前端傳來的課程 ID
    const targetUrl = data.targetUrl || null; // 取得前端傳來的目標 URL (已編碼)
    
    // 檢查必要的參數
    if (!courseId || !targetUrl) {
        functions.logger.error('缺少必要的參數', { userId: userId, data: data });
        throw new functions.https.HttpsError(
            'invalid-argument', 
            '缺少課程 ID 或目標 URL 參數。',
            { redirectUrl: 'cart.html?error=invalid_link' } // 確保這裡使用 'cart.html'
        );
    }
    
    const UNAUTHORIZED_REDIRECT = 'cart.html?status=unpaid'; // ❗ 統一使用 'cart.html'

    try {
        // --- 2. 後端安全查詢：檢查 Firestore 資料庫 ---
        
        // 查詢 Firestore 中的付費名單集合
        const userDocRef = db.collection('paid_users').doc(userId);
        const doc = await userDocRef.get();

        // 判斷該用戶是否已付費且擁有該課程權限
        if (doc.exists && doc.data().is_paid === true && doc.data().course_id === courseId) {
            
            // 3. 驗證成功：回傳成功狀態和目標 URL
            functions.logger.info(`驗證通過，用戶: ${userId}, 課程: ${courseId}`);
            return {
                status: 'AUTHORIZED',
                redirectUrl: decodeURIComponent(targetUrl) // 回傳解碼後的目標課程 URL
            };

        } else {
            // 4. 驗證失敗：用戶未付費或權限不匹配
            functions.logger.info(`驗證失敗，用戶: ${userId}, 課程: ${courseId}`);
            return {
                status: 'UNAUTHORIZED',
                redirectUrl: UNAUTHORIZED_REDIRECT // 導向 cart.html
            };
        }

    } catch (error) {
        // 處理數據庫或內部錯誤
        functions.logger.error("伺服器端驗證發生錯誤:", error);
        throw new functions.https.HttpsError(
            'internal', 
            '伺服器端驗證失敗，請稍後再試。',
            { redirectUrl: 'cart.html?error=system_error' } // 確保這裡使用 'cart.html'
        );
    }
});

// 假設您在 Firebase 服務中重新引入了 Functions SDK
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
// ... 初始化 app 和 functions ...
const functions = getFunctions(app, 'asia-east1'); 
const initLinePay = httpsCallable(functions, 'initiateLinePayPayment'); // 🚨 新增的 Cloud Function 名稱

/**
 * 處理與後端的 Line Pay 結帳流程
 */
async function handleLinePayCheckout(user, total, cartItems) {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = '📞 正在建立 Line Pay 交易...';
    
    try {
        const response = await initLinePay({
            amount: total,
            userId: user.uid,
            cartDetails: cartItems, // 傳遞詳細購物車內容給後端
            // 讓後端知道付款成功後，要將用戶導回哪個頁面
            confirmUrl: window.location.origin + '/payment-confirm.html' 
        });

        // 成功建立交易
        if (response.data && response.data.webPaymentUrl) {
            console.log("Line Pay 交易建立成功，正在導向...");
            // 導向 Line Pay 官方付款頁面
            window.location.href = response.data.webPaymentUrl;
        } else {
            throw new Error(response.data.message || 'Line Pay 建立失敗。');
        }

    } catch (error) {
        console.error("Line Pay 結帳失敗:", error);
        alert(`結帳失敗：${error.message}，請稍後再試。`);
        checkoutBtn.disabled = false;
        checkoutBtn.textContent = '💳 前往付款';
    }
}
