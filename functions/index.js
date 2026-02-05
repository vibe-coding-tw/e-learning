const functions = require("firebase-functions/v1");
// Load .env explicitly if not in production/deploy environment or as backup
if (process.env.NODE_ENV !== 'production' || !process.env.ECPAY_MERCHANT_ID) {
    require('dotenv').config();
}

const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { sendWelcomeEmail, sendPaymentSuccessEmail, sendTrialExpiringEmail, sendCourseExpiringEmail, sendAssignmentNotification } = require('./emailService');

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
        const { amount, returnUrl, cartDetails, logistics } = requestData;

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
            logistics: logistics || null, // [NEW] Store logistics info
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

            // Calculate Expiry Date (1 Year from now)
            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            await admin.firestore().collection("orders").doc(orderId).update({
                status: "SUCCESS",
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                expiryDate: admin.firestore.Timestamp.fromDate(expiryDate), // [NEW] Store expiry date
                ecpayTradeNo: data.TradeNo || "",
                paymentDate: data.PaymentDate || "",
                isSimulated: isSimulated,
                rtnMsg: data.RtnMsg || ""
            });
            console.log(`訂單 ${orderId} 更新成功`);

            // [NEW] Send Payment Success Email
            try {
                // Fetch order details to get email and items
                const orderDoc = await admin.firestore().collection("orders").doc(orderId).get();
                if (orderDoc.exists) {
                    const orderData = orderDoc.data();
                    let userEmail = "";
                    if (orderData.uid === "GUEST") {
                        // Handling guest checkout if applicable, though typically we have UID
                        // If we stored email in orderData, use it. Otherwise, tough luck?
                        // Assuming we can get email from Auth if UID exists
                    } else {
                        const userRecord = await admin.auth().getUser(orderData.uid);
                        userEmail = userRecord.email;
                    }

                    // If we have an email, send it
                    if (userEmail) {
                        const items = orderData.items || {};
                        const itemDesc = Object.values(items).map(i => `${i.name} x${i.quantity || 1}`).join(', ');
                        await sendPaymentSuccessEmail(userEmail, orderId, orderData.amount, itemDesc);
                    }
                }
            } catch (emailErr) {
                console.error("Failed to send payment email:", emailErr);
            }
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
        console.log(`[checkPaymentAuthorization] Request for PageId: ${pageId}, FileName: ${fileName}, UID: ${req.headers.authorization ? 'PRESENT' : 'MISSING'}`);

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

        // ---------------------------------------------------------
        // [NEW] Trial Check: New users (< 30 days) get "started" courses for free
        // ---------------------------------------------------------
        if (course && course.category === 'started') {
            try {
                const userRecord = await admin.auth().getUser(uid);
                const creationTime = new Date(userRecord.metadata.creationTime).getTime();
                const now = Date.now();
                const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

                if ((now - creationTime) < THIRTY_DAYS_MS) {
                    console.log(`User ${uid} is within trial period (${Math.floor((now - creationTime) / (24 * 60 * 60 * 1000))} days). Authorizing started course...`);
                    const token = generateToken(pageId, fileName);
                    return res.status(200).json({ result: { authorized: true, token: token, isTrial: true } });
                }
            } catch (e) {
                console.error("Error checking user creation time:", e);
                // Fallthrough to regular paid check if this fails
            }
        }
        // ---------------------------------------------------------

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
                // Check explicit expiryDate first (preferred)
                if (data.expiryDate) {
                    const expiry = data.expiryDate.toDate().getTime();
                    if (now < expiry) {
                        hasCourse = true;
                    } else {
                        console.log(`Course ${pageId} expired on ${data.expiryDate.toDate()}`);
                    }
                } else {
                    // Fallback to legacy check (1 year from paymentDate)
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

    console.log(`[serveCourse] Path: ${urlPath}, FileName: ${fileName}, Token Provided: ${!!token}`);

    if (!token) {
        console.warn(`[serveCourse] Access Denied: No token. Query:`, req.query);
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

        const isWifiBleSetupGroup = (scopePart === "00-master-wifi-motor.html") &&
            (fileName === "00-unit-wifi-setup.html" || fileName === "00-unit-motor-ramping.html");

        const isBasicEnvGroup = (scopePart === "basic-01-master-environment.html") &&
            (fileName === "basic-01-unit-esp32-architecture.html" || fileName === "basic-01-unit-platformio-setup.html" || fileName === "basic-01-unit-drivers-ports.html");

        const isBasicOtaGroup = (scopePart === "basic-02-master-ota-architecture.html") &&
            (fileName === "basic-02-unit-partition-table.html" || fileName === "basic-02-unit-ota-principles.html" || fileName === "basic-02-unit-ota-security.html");

        const isBasicIOMappingGroup = (scopePart === "basic-03-master-io-mapping.html") &&
            (fileName === "basic-03-unit-pinout.html" || fileName === "basic-03-unit-pullup-debounce.html" || fileName === "basic-03-unit-adc-resolution.html");

        const isBasicPwmGroup = (scopePart === "basic-04-master-pwm-control.html") &&
            (fileName === "basic-04-unit-pwm-basics.html" || fileName === "basic-04-unit-h-bridge.html" || fileName === "basic-04-unit-ledc-syntax.html");

        const isBasicBleGattGroup = (scopePart === "basic-05-master-ble-gatt.html") &&
            (fileName === "basic-05-unit-gatt-structure.html" || fileName === "basic-05-unit-advertising-connection.html" || fileName === "basic-05-unit-ble-properties.html");

        const isBasicHttpGroup = (scopePart === "basic-06-master-http-web.html") &&
            (fileName === "basic-06-unit-fetch-api.html" || fileName === "basic-06-unit-http-request.html" || fileName === "basic-06-unit-cors-security.html");

        const isBasicWifiModesGroup = (scopePart === "basic-07-master-wifi-modes.html") &&
            (fileName === "basic-07-unit-wifi-ap-sta.html" || fileName === "basic-07-unit-http-lifecycle.html" || fileName === "basic-07-unit-async-webserver.html");

        const isBasicJoystickGroup = (scopePart === "basic-08-master-joystick-math.html") &&
            (fileName === "basic-08-unit-joystick-mapping.html" || fileName === "basic-08-unit-unicycle-model.html" || fileName === "basic-08-unit-response-curves.html");

        const isBasicMultitaskingGroup = (scopePart === "basic-09-master-multitasking.html") &&
            (fileName === "basic-09-unit-millis.html" || fileName === "basic-09-unit-hardware-timer.html" || fileName === "basic-09-unit-sampling-rate.html");

        const isBasicFsmGroup = (scopePart === "basic-10-master-fsm.html") &&
            (fileName === "basic-10-unit-fsm.html" || fileName === "basic-10-unit-ui-design.html" || fileName === "basic-10-unit-state-consistency.html");

        const isAdvS3CamGroup = (scopePart === "adv-01-master-s3-cam.html") &&
            (fileName === "adv-01-unit-s3-interfaces.html" || fileName === "adv-01-unit-mjpeg-stream.html" || fileName === "adv-01-unit-jpeg-quality.html");

        if (scopePart !== "ANY" && scopePart !== fileName &&
            !isGettingStartedGroup && !isWebAppGroup && !isWebBleGroup &&
            !isWebRemoteControlGroup && !isTouchEventsGroup && !isJoystickLabGroup &&
            !isWifiBleSetupGroup && !isBasicEnvGroup && !isBasicOtaGroup && !isBasicIOMappingGroup && !isBasicPwmGroup && !isBasicBleGattGroup && !isBasicHttpGroup && !isBasicWifiModesGroup && !isBasicJoystickGroup && !isBasicMultitaskingGroup && !isBasicFsmGroup && !isAdvS3CamGroup) {
            console.error(`Access Denied Debug: Scope=${scopePart}, File=${fileName}, isBasicEnv=${isBasicEnvGroup}, isBasicOta=${isBasicOtaGroup}, isBasicIOMapping=${isBasicIOMappingGroup}, isBasicBleGatt=${isBasicBleGattGroup}, isBasicHttp=${isBasicHttpGroup}, isBasicWifiModes=${isBasicWifiModesGroup}, isBasicJoystick=${isBasicJoystickGroup}, isBasicMultitasking=${isBasicMultitaskingGroup}, isBasicFsm=${isBasicFsmGroup}, isAdvS3CamGroup=${isAdvS3CamGroup}`);
            return res.status(403).send(`Access Denied: Token valid for ${scopePart}, but requested ${fileName}. Debug: isBasicEnv=${isBasicEnvGroup}, isBasicOta=${isBasicOtaGroup}, isBasicIOMapping=${isBasicIOMappingGroup}, isBasicBleGatt=${isBasicBleGattGroup}, isBasicHttp=${isBasicHttpGroup}, isBasicWifiModes=${isBasicWifiModesGroup}, isBasicJoystick=${isBasicJoystickGroup}, isBasicMultitasking=${isBasicMultitaskingGroup}, isBasicFsm=${isBasicFsmGroup}`);
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

const getRole = async (uid) => {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    return userDoc.exists ? userDoc.data().role : 'student'; // Default to student
};

// ==========================================
// 5. 設定用戶角色 (setUserRole - Admin Only)
// ==========================================
exports.setUserRole = functions.region(REGION).https.onCall(async (data, context) => {
    // 1. Check Authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const adminUid = context.auth.uid;
    const adminRole = await getRole(adminUid);

    // 2. Check Authorization (Must be Admin)
    // NOTE: For bootstrapping, you might need to temporarily bypass this or set the first admin in Firestore Console.
    if (adminRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can set roles.');
    }

    const { email, role } = data;

    if (!['student', 'teacher', 'admin'].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid role.');
    }

    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.firestore().collection('users').doc(userRecord.uid).set({
            email: email,
            role: role,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return { success: true, message: `User ${email} is now a ${role}.` };
    } catch (error) {
        throw new functions.https.HttpsError('not-found', `User with email ${email} not found.`);
    }
});

// ==========================================
// 6. 記錄學習活動 (logActivity)
// ==========================================
exports.logActivity = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) {
        // Allow anonymous logging? Probably not for specific student tracking.
        // But for now, let's require auth.
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = context.auth.uid;
    const { courseId, action, duration, metadata } = data;

    if (!courseId || !action) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing courseId or action.');
    }

    try {
        await admin.firestore().collection('activity_logs').add({
            uid: uid,
            courseId: courseId,
            action: action, // 'PAGE_VIEW', 'VIDEO', 'DOC'
            duration: duration || 0, // seconds
            metadata: metadata || {},
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Activity Log Error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to log activity.');
    }
});

// ==========================================
// 7. 獲取儀表板數據 (getDashboardData)
// ==========================================
exports.getDashboardData = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = context.auth.uid;
    const requesterRole = await getRole(uid);

    if (requesterRole === 'student') {
        // [MODIFIED] Students can now access dashboard to see THEIR OWN stats
        // throw new functions.https.HttpsError('permission-denied', 'Students cannot access dashboard.');
    }

    try {
        const db = admin.firestore();
        let result = {
            role: requesterRole,
            summary: {},
            students: [],
            assignments: []
        };

        // 1. Fetch Users (based on role)
        let usersMap = {};
        if (requesterRole === 'admin') {
            const usersSnapshot = await db.collection('users').get();
            usersSnapshot.forEach(doc => usersMap[doc.id] = doc.data());
        } else if (requesterRole === 'teacher') {
            // MVP: Teacher sees ALL students for now, or filter if 'teacherId' link exists
            const usersSnapshot = await db.collection('users').get();
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                if (userData.role === 'student') {
                    usersMap[doc.id] = userData;
                }
            });
        } else {
            // Student: only self
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) usersMap[uid] = userDoc.data();
        }

        const targetDgUids = Object.keys(usersMap);
        if (targetDgUids.length === 0 && requesterRole !== 'student') {
            return result; // No students found
        }

        // 2. Fetch Activity Logs
        let logsQuery = db.collection('activity_logs').orderBy('timestamp', 'desc').limit(2000);

        if (requesterRole === 'student') {
            logsQuery = logsQuery.where('uid', '==', uid);
        }

        const logsSnapshot = await logsQuery.get();
        const studentStats = {};

        // Initialize entries for known users
        targetDgUids.forEach(id => {
            studentStats[id] = {
                uid: id,
                email: usersMap[id]?.email || 'Unknown',
                role: usersMap[id]?.role || 'student',
                totalTime: 0,
                videoTime: 0,
                docTime: 0,
                pageTime: 0,
                lastActive: null,
                courseProgress: {} // { [courseId]: { total, video, doc, page } }
            };
        });

        logsSnapshot.forEach(doc => {
            const log = doc.data();
            const sid = log.uid;

            // Only process if user is in our allowed map
            if (usersMap[sid]) {
                if (!studentStats[sid]) {
                    // Should be initialized above, but just in case
                    studentStats[sid] = { uid: sid, email: usersMap[sid]?.email || 'Unknown', totalTime: 0, videoTime: 0, docTime: 0, pageTime: 0, lastActive: null, courseProgress: {} };
                }

                const duration = log.duration || 0;
                studentStats[sid].totalTime += duration;

                if (log.action === 'VIDEO') studentStats[sid].videoTime += duration;
                if (log.action === 'DOC') studentStats[sid].docTime += duration;
                if (log.action === 'PAGE_VIEW') studentStats[sid].pageTime += duration;

                if (!studentStats[sid].lastActive) {
                    studentStats[sid].lastActive = log.timestamp ? log.timestamp.toDate() : null;
                }

                // Granular Course/Unit Tracking
                const cid = log.courseId || 'unknown';
                if (!studentStats[sid].courseProgress[cid]) {
                    studentStats[sid].courseProgress[cid] = { total: 0, video: 0, doc: 0, page: 0, logs: [] };
                }
                studentStats[sid].courseProgress[cid].total += duration;
                if (log.action === 'VIDEO') studentStats[sid].courseProgress[cid].video += duration;
                if (log.action === 'DOC') studentStats[sid].courseProgress[cid].doc += duration;
                if (log.action === 'PAGE_VIEW') studentStats[sid].courseProgress[cid].page += duration;

                // [NEW] Attach Raw Log
                studentStats[sid].courseProgress[cid].logs.push({
                    action: log.action,
                    duration: duration,
                    timestamp: log.timestamp,
                    metadata: log.metadata
                });
            }
        });

        result.students = Object.values(studentStats);

        // 3. Fetch Assignments
        let assignQuery = db.collection('assignments');
        if (requesterRole === 'student') {
            assignQuery = assignQuery.where('userId', '==', uid);
        }
        const assignSnapshot = await assignQuery.get();
        assignSnapshot.forEach(doc => {
            const data = doc.data();
            const targetUid = data.userId || data.uid;

            // Filter for teachers (only their students)
            if (requesterRole === 'admin' || usersMap[targetUid] || requesterRole === 'student') {
                result.assignments.push({
                    id: doc.id,
                    ...data,
                    studentEmail: usersMap[targetUid]?.email || data.userEmail || 'Unknown'
                });
            }
        });

        // Summary
        result.summary = {
            totalStudents: result.students.length,
            totalHours: result.students.reduce((acc, curr) => acc + curr.totalTime, 0) / 3600
        };

        return result;

    } catch (error) {
        console.error("Dashboard Data Error:", error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch dashboard data.');
    }
});

// ==========================================
// 8. 作業系統 (Assignment System)
// ==========================================

// 8.1 繳交作業 (Student)
exports.submitAssignment = functions.region(REGION).https.onCall(async (data, context) => {
    // 1. Verify Auth
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }

    const { courseId, unitId, assignmentId, url, note, title } = data;
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email || "Unknown";
    const userName = context.auth.token.name || userEmail.split('@')[0];

    // Simple validation
    if (!url) {
        throw new functions.https.HttpsError('invalid-argument', '請提供作業連結 (GitHub / Demo)');
    }

    const db = admin.firestore();
    // Unique ID for the submission
    const docId = `${userId}_${assignmentId}`;
    const docRef = db.collection('assignments').doc(docId);

    try {
        const doc = await docRef.get();
        const now = admin.firestore.Timestamp.now();
        const submittedAtISO = new Date().toISOString();

        const historyEntry = {
            timestamp: submittedAtISO,
            url: url,
            note: note || '',
            action: 'SUBMIT'
        };

        const assignmentData = {
            id: docId,
            userId: userId,
            userEmail: userEmail,
            userName: userName,
            courseId: courseId || "unknown_course",
            unitId: unitId || "unknown_unit",
            assignmentId: assignmentId,
            assignmentTitle: title || assignmentId,
            submissionUrl: url,
            studentNote: note || "",
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "submitted",
            grade: null,
            teacherFeedback: null,
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        };

        await docRef.set(assignmentData, { merge: true });

        // Notify Teacher
        const teacherEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
        if (teacherEmail) {
            await sendAssignmentNotification(teacherEmail, userName, assignmentData.assignmentTitle);
        }

        return { success: true, message: "作業繳交成功！" };

    } catch (e) {
        console.error("Submit Assignment Error:", e);
        throw new functions.https.HttpsError('internal', '繳交失敗，請稍後再試');
    }
});

// 8.2 評改作業 (Teacher/Admin)
exports.gradeAssignment = functions.region(REGION).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');

    // Check Role
    const role = await getRole(context.auth.uid);
    if (role !== 'admin' && role !== 'teacher') {
        throw new functions.https.HttpsError('permission-denied', 'Only teachers can grade.');
    }

    const { assignmentId, grade, feedback } = data;
    // assignmentId should include uid, e.g., "UID_COURSE_UNIT"

    const db = admin.firestore();
    const docRef = db.collection('assignments').doc(assignmentId);

    try {
        const historyEntry = {
            timestamp: admin.firestore.Timestamp.now(),
            content: `Grade: ${grade}, Feedback: ${feedback}`,
            action: 'GRADE',
            grader: context.auth.uid
        };

        await docRef.update({
            grade: Number(grade),
            teacherFeedback: feedback,
            currentStatus: 'graded',
            updatedAt: admin.firestore.Timestamp.now(),
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });

        return { success: true };
    } catch (e) {
        console.error("Grade Error:", e);
        throw new functions.https.HttpsError('internal', 'Grading failed.');
    }
});

// ==========================================
// 8. 新用戶歡迎信 (onUserCreated)
// ==========================================
exports.onUserCreated = functions.region(REGION).auth.user().onCreate(async (user) => {
    const email = user.email;
    const displayName = user.displayName;

    if (email) {
        await sendWelcomeEmail(email, displayName);
    }
});

// ==========================================
// 9. 試用期到期提醒 (checkTrialExpiration)
// ==========================================
// Run every day at 12:00 PM Asia/Taipei
exports.checkTrialExpiration = functions.region(REGION).pubsub.schedule('0 12 * * *')
    .timeZone('Asia/Taipei')
    .onRun(async (context) => {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

        // Target: Users created between 27 and 28 days ago (3 days left)
        const now = Date.now();
        const startWindow = now - (THIRTY_DAYS_MS - THREE_DAYS_MS); // ~27 days ago
        const endWindow = startWindow - (24 * 60 * 60 * 1000); // 1 day window

        // Valid approach: iterate all users or use a dedicated Firestore collection "users" to query by createdAt.
        // Since listing all Auth users is heavy, we should rely on Firestore 'users' collection if possible.
        // However, 'users' collection might not have all users.
        // Let's use Firestore 'users' as the source for mailing list management to be safe and scalable.

        // Note: We need to ensure when a user is created, they are added to Firestore 'users'.
        // Currently 'setUserRole' adds to 'users', but basic signup might not?
        // Let's add that to 'onUserCreated' as well to be sure.

        // For MVP, we will try to list users from Auth (limit 1000) - acceptable for small scale.
        try {
            const listUsersResult = await admin.auth().listUsers(1000);
            const users = listUsersResult.users;

            for (const user of users) {
                const creationTime = new Date(user.metadata.creationTime).getTime();
                const diff = now - creationTime;

                // If diff is between 27 days and 28 days
                // 30 days = 720 hours
                // 3 days left = 27 days passed = 648 hours
                const daysPassed = diff / (24 * 60 * 60 * 1000);

                if (daysPassed >= 27 && daysPassed < 28) {
                    // Check if we already sent warning? 
                    // Ideally check a flag in Firestore.
                    const userRef = admin.firestore().collection('users').doc(user.uid);
                    const doc = await userRef.get();
                    if (!doc.exists || !doc.data().trialWarningSent) {
                        console.log(`Sending trial warning to ${user.email}`);
                        if (user.email) {
                            await sendTrialExpiringEmail(user.email, user.displayName, 3);
                            // Mark as sent
                            await userRef.set({ trialWarningSent: true }, { merge: true });
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error in checkTrialExpiration:", error);
        }
    });

// ==========================================
// 10. 電子地圖回傳 (mapReply)
// ==========================================
exports.mapReply = functions.region(REGION).https.onRequest((req, res) => {
    // EcPay sends data via POST
    if (req.method !== 'POST') {
        // Default to redirecting home if accessed via GET
        return res.redirect('https://vibe-coding.tw/cart.html');
    }

    try {
        const { CVSStoreID, CVSStoreName, CVSAddress, ExtraData } = req.body;
        console.log("Map Reply Received:", CVSStoreID, CVSStoreName);

        // Redirect user back to cart with store info
        // Note: In production, consider using a frontend route that handles this cleaner, 
        // but query params work for a simple implementation.
        const baseUrl = "https://vibe-coding.tw/cart.html";
        const params = new URLSearchParams({
            storeId: CVSStoreID || '',
            storeName: CVSStoreName || '',
            address: CVSAddress || '',
            action: 'storeSelected'
        });

        res.redirect(`${baseUrl}?${params.toString()}`);

    } catch (error) {
        console.error("Map Reply Error:", error);
        res.status(500).send("Error processing map reply");
    }
});