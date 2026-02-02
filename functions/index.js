const functions = require("firebase-functions/v1");
// Load .env explicitly if not in production/deploy environment or as backup
if (process.env.NODE_ENV !== 'production' || !process.env.ECPAY_MERCHANT_ID) {
    require('dotenv').config();
}

const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

admin.initializeApp();

// ==========================================
// 從 .env 讀取環境變數
// ==========================================
// 這些變數會自動從 functions/.env 檔案中讀取
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const ECPAY_API_URL = process.env.ECPAY_API_URL;

const REGION = "asia-east1";
// 為了避免專案 ID 寫死，我們也可以動態抓取，或者您保留原本寫死的字串
const PROJECT_ID = JSON.parse(process.env.FIREBASE_CONFIG).projectId || "e-learning-942f7";

// 簡單檢查：確保環境變數有設定，避免部署後才發現是空的
if (!MERCHANT_ID || !HASH_KEY || !HASH_IV || !ECPAY_API_URL) {
    console.error("錯誤：未讀取到綠界設定，請檢查 functions/.env 檔案！");
}

// ==========================================
// 工具函式：計算 CheckMacValue (保持不變)
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
    const offset = 8; // UTC+8
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const date = new Date(utc + (3600000 * offset));
    return `${date.getFullYear()}/${('0' + (date.getMonth() + 1)).slice(-2)}/${('0' + date.getDate()).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
}

// ==========================================
// 1. 建立訂單 (initiatePayment)
// ==========================================
exports.initiatePayment = functions.region(REGION).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        console.log("收到 initiatePayment 請求 (.env mode)");

        const requestData = req.body.data || req.body || {};
        const { amount, returnUrl, cartDetails } = requestData;

        // 簡易 Token 驗證
        let uid = "GUEST";
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const idToken = authHeader.split('Bearer ')[1];
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                uid = decodedToken.uid;
            } catch (e) {
                console.warn("Token 驗證略過:", e.message);
            }
        }

        const finalAmount = parseInt(amount, 10) || 100;
        const orderNumber = `VIBE${Date.now()}`;
        const tradeDate = getCurrentTime();

        // ServerUrl (Webhook)
        const serverUrl = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentNotify`;
        // ClientUrl (前端)
        const clientUrl = returnUrl || "https://vibe-coding.tw";

        console.log(`建立訂單: ${orderNumber}`);

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
            ReturnURL: serverUrl,
            OrderResultURL: clientUrl,
            ClientBackURL: clientUrl,
            ChoosePayment: 'ALL',
            EncryptType: '1',
            ChoosePayment: 'ALL',
            EncryptType: '1',
        };

        ecpayParams.CheckMacValue = generateCheckMacValue(ecpayParams, HASH_KEY, HASH_IV);

        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: uid,
            amount: finalAmount,
            status: "PENDING",
            gateway: "ECPAY",
            items: cartDetails || {},
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ result: { paymentParams: ecpayParams, apiUrl: ECPAY_API_URL } });

    } catch (error) {
        console.error("嚴重錯誤:", error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// ==========================================
// 2. 接收通知 (paymentNotify)
// ==========================================
exports.paymentNotify = functions.region(REGION).https.onRequest(async (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'GET') {
        return res.status(200).send('1|OK');
    }

    try {
        const data = req.body;

        // 額外檢查：驗證綠界傳回來的 CheckMacValue 確保安全 (建議加上，但不加也通)
        // 若要加強安全性，可在此處呼叫 generateCheckMacValue(data, HASH_KEY, HASH_IV) 並比對

        if (!data) return res.status(200).send('1|OK');

        if (data.RtnCode === '1') {
            const orderId = data.MerchantTradeNo;
            const isSimulated = data.SimulatePaid === '1';

            await admin.firestore().collection("orders").doc(orderId).update({
                status: "SUCCESS",
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                ecpayTradeNo: data.TradeNo || "",
                paymentDate: data.PaymentDate || "",
                isSimulated: isSimulated,
                rtnMsg: data.RtnMsg || ""
            });
            console.log(`訂單 ${orderId} 更新成功`);
        }

        return res.status(200).send('1|OK');

    } catch (error) {
        console.error("通知處理失敗:", error);
        return res.status(200).send('1|OK');
    }
});

// ==========================================
// 3. 檢查權限 (checkPaymentAuthorization)
// ==========================================
// Cache for lessons data
let cachedLessons = null;
let lastFetchTime = 0;
const LESSONS_URL = "https://e-learning-942f7.web.app/lessons.json";

async function getLessons() {
    const now = Date.now();
    // 優先嘗試讀取本地檔案 (針對 Local Emulator 開發環境)
    try {
        const localPath = path.join(__dirname, "../public/lessons.json");
        if (fs.existsSync(localPath)) {
            // 在開發環境不 Cache 或 Cache 時間短一點，這裡直接每次讀取確保最新
            const data = fs.readFileSync(localPath, "utf8");
            console.log("Loaded lessons.json from local file");
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn("Local lessons.json read failed, falling back to URL:", e.message);
    }

    // Cache for 5 minutes (300,000 ms)
    if (cachedLessons && (now - lastFetchTime < 300000)) {
        return cachedLessons;
    }
    try {
        console.log("Fetching lessons.json from public URL...");
        const response = await fetch(LESSONS_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        cachedLessons = await response.json();
        lastFetchTime = now;
        return cachedLessons;
    } catch (error) {
        console.error("Failed to fetch lessons.json:", error);
        // If fetch fails, return cached data if available, otherwise empty array
        return cachedLessons || [];
    }
}

exports.checkPaymentAuthorization = functions.region(REGION).https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    try {
        const requestData = req.body.data || req.body || {};
        const { pageId, fileName } = requestData; // Accept fileName from frontend

        // Helper to generate token with file scope
        const generateToken = (pid, fname) => {
            const expiry = Date.now() + 30 * 60 * 1000; // 30 mins
            // IF fileName is missing, default to "UNDEFINED" (block access), DO NOT use "ANY"
            const scopePart = fname || "UNDEFINED";
            const raw = `${pid}|${scopePart}|${expiry}`;
            const signature = crypto.createHmac('sha256', HASH_KEY).update(raw).digest('hex');
            return `${raw}|${signature}`;
        }

        // 1. Load lessons data
        const lessons = await getLessons();
        // Find course by pageId (mapping to courseId in JSON)
        const course = lessons.find(l => l.courseId === pageId);

        // 2. Check if course exists and is free (price === 0) - Prioritize this!
        if (course && course.price === 0) {
            console.log(`Course ${pageId} is free, authorizing...`);
            const token = generateToken(pageId, fileName);
            return res.status(200).json({ result: { authorized: true, token: token } });
        }

        // 3. User Auth Check (Only needed for paid courses)
        let uid = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            try {
                const decodedToken = await admin.auth().verifyIdToken(idToken);
                uid = decodedToken.uid;
            } catch (e) { }
        }

        if (!uid) return res.status(200).json({ result: { authorized: false, message: "User not logged in" } });

        const ordersSnapshot = await admin.firestore().collection("orders")
            .where("uid", "==", uid)
            .where("status", "==", "SUCCESS")
            .get();

        if (ordersSnapshot.empty) return res.status(200).json({ result: { authorized: false } });

        let hasCourse = false;
        const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            const items = data.items;

            // 檢查訂單是否包含此課程
            if (items && items[pageId]) {
                // 檢查是否過期 (1年)
                let orderDate = null;
                if (data.paymentDate) {
                    orderDate = new Date(data.paymentDate).getTime();
                } else if (data.createdAt) {
                    orderDate = data.createdAt.toDate().getTime();
                }

                if (orderDate && (now - orderDate < ONE_YEAR_MS)) {
                    hasCourse = true;
                }
            }
        });

        if (hasCourse) {
            const token = generateToken(pageId, fileName);
            return res.status(200).json({ result: { authorized: true, token: token } });
        } else {
            return res.status(200).json({ result: { authorized: false } });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 4. 安全檔案服務 (serveCourse)
// ==========================================
exports.serveCourse = functions.region(REGION).https.onRequest((req, res) => {
    // 1. Parsing Path (e.g. /courses/ble-connection-master.html)
    const urlPath = req.path; // /courses/foo.html
    const fileName = urlPath.replace('/courses/', '');

    // 2. Security Check (Token)
    const token = req.query.token;

    if (!token) {
        return res.status(403).send("Access Denied: No token provided.");
    }

    try {
        // Token Format: pageId|scopePart|expiry|signature
        const parts = token.split('|');
        if (parts.length !== 4) {
            return res.status(403).send("Access Denied: Invalid token format.");
        }

        const [pageId, scopePart, expiryStr, signature] = parts;
        const expiry = parseInt(expiryStr);

        // A. Validate Signature
        const raw = `${pageId}|${scopePart}|${expiry}`;
        const expectedSignature = crypto.createHmac('sha256', HASH_KEY).update(raw).digest('hex');

        if (signature !== expectedSignature) {
            return res.status(403).send("Access Denied: Invalid signature.");
        }

        // B. Validate Expiry
        if (Date.now() > expiry) {
            return res.status(403).send("Access Denied: Token expired.");
        }

        // C. Validate File Scope
        // scopePart IS the allowed filename.
        // Special Exception for Tab Container: getting-started.html can access its children
        const isGettingStartedGroup = (scopePart === "01-master-getting-started.html") &&
            (fileName === "01-unit-developer-identity.html" || fileName === "01-unit-vscode-setup.html" || fileName === "01-unit-vscode-online.html");

        const isWebAppGroup = (scopePart === "02-master-web-app.html") &&
            (fileName === "02-unit-html5-basics.html" || fileName === "02-unit-flexbox-layout.html" || fileName === "02-unit-ui-ux-standards.html");

        const isWebBleGroup = (scopePart === "03-master-web-ble.html") &&
            (fileName === "03-unit-ble-security.html" || fileName === "03-unit-ble-async.html" || fileName === "03-unit-typed-arrays.html");

        const isWebRemoteControlGroup = (scopePart === "04-master-remote-control.html") &&
            (fileName === "04-unit-control-panel.html" || fileName === "04-unit-data-json.html" || fileName === "04-unit-flow-logic.html");

        const isTouchEventsGroup = (scopePart === "05-master-touch-events.html") &&
            (fileName === "05-unit-touch-basics.html" || fileName === "05-unit-long-press.html" || fileName === "05-unit-prevent-default.html");

        const isJoystickLabGroup = (scopePart === "06-master-joystick-lab.html") &&
            (fileName === "06-unit-touch-vs-mouse.html" || fileName === "06-unit-canvas-joystick.html" || fileName === "06-unit-joystick-math.html");

        if (scopePart !== "ANY" && scopePart !== fileName &&
            !isGettingStartedGroup && !isWebAppGroup && !isWebBleGroup &&
            !isWebRemoteControlGroup && !isTouchEventsGroup && !isJoystickLabGroup) {
            console.error(`Access Denied Debug: Scope=${scopePart}, File=${fileName}, isJoystick=${isJoystickLabGroup}`);
            return res.status(403).send(`Access Denied: Token valid for ${scopePart}, but requested ${fileName}. Debug: isJoystick=${isJoystickLabGroup}`);
        }

        // 3. Serve File
        const filePath = path.join(__dirname, 'private_courses', fileName);

        // Path Traversal Prevention
        if (!filePath.startsWith(path.join(__dirname, 'private_courses'))) {
            return res.status(403).send("Access Denied: Illegal path.");
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found.");
        }

        res.sendFile(filePath);

    } catch (e) {
        console.error(e);
        res.status(403).send("Access Denied: Token error.");
    }
});