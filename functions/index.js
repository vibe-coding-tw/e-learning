const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const functionsV1 = require("firebase-functions/v1");

// Load .env explicitly if not in production/deploy environment or as backup
if (process.env.NODE_ENV !== 'production' || !process.env.ECPAY_MERCHANT_ID) {
    require('dotenv').config();
}

const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
    sendWelcomeEmail, sendPaymentSuccessEmail, sendTrialExpiringEmail, sendCourseExpiringEmail,
    sendAssignmentNotification, sendTeacherAuthorizationEmail, sendGradingNotification,
    sendStudentLinkedToTeacherEmail, sendTeacherLinkedToStudentEmail, sendAdminAssignmentReminder,
    sendAdminNewApplicationEmail, sendApplicationResultEmail
} = require('./emailService');

admin.initializeApp({
    projectId: "e-learning-942f7"
});
const db = admin.firestore();

// ==========================================
// Firebase Functions V2 全域設定
// ==========================================
setGlobalOptions({
    region: "asia-east1",
    maxInstances: 10,
    concurrency: 80 // V2 feature: multiple requests per instance
});


// ==========================================
// 從 .env 讀取環境變數
// ==========================================
// 這些變數會自動從 functions/.env 檔案中讀取
const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID;
const HASH_KEY = process.env.ECPAY_HASH_KEY;
const HASH_IV = process.env.ECPAY_HASH_IV;
const ECPAY_API_URL = process.env.ECPAY_API_URL;
const ECPAY_LOGISTICS_MAP_URL = process.env.ECPAY_LOGISTICS_MAP_URL;

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
function generateCheckMacValue(params, hashKey, hashIV, encType = 'sha256') {
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

    return crypto.createHash(encType).update(encodedString).digest('hex').toUpperCase();
}

function getCurrentTime() {
    const now = new Date();
    const offset = 8; // UTC+8
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const date = new Date(utc + (3600000 * offset));
    return `${date.getFullYear()}/${('0' + (date.getMonth() + 1)).slice(-2)}/${('0' + date.getDate()).slice(-2)} ${('0' + date.getHours()).slice(-2)}:${('0' + date.getMinutes()).slice(-2)}:${('0' + date.getSeconds()).slice(-2)}`;
}

function extractHiddenSectionContent(html, sectionId) {
    if (!html || !sectionId) return "";

    const openTagRegex = new RegExp(`<section\\b[^>]*\\bid=["']${sectionId}["'][^>]*>`, 'i');
    const openMatch = openTagRegex.exec(html);
    if (!openMatch) return "";

    const sectionStart = openMatch.index;
    let cursor = sectionStart;
    let depth = 0;
    const sectionTagRegex = /<\/?section\b[^>]*>/gi;
    let match;

    while ((match = sectionTagRegex.exec(html.slice(cursor))) !== null) {
        const tag = match[0];
        const absoluteIndex = cursor + match.index;
        const isClosingTag = /^<\//.test(tag);

        if (!isClosingTag) {
            depth += 1;
            if (depth === 1) {
                cursor = absoluteIndex + tag.length;
            }
        } else {
            depth -= 1;
            if (depth === 0) {
                return html.slice(cursor, absoluteIndex).trim();
            }
            if (depth < 0) break;
        }
    }

    return "";
}

// ==========================================
// 1. 建立訂單 (initiatePayment)
// ==========================================
exports.initiatePayment = onRequest(async (req, res) => {
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
        const { amount, returnUrl, cartDetails, logistics, promoCode, referralMentor } = requestData;

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

        // 建立訂單內容記錄 (Firestore)
        // [NEW] Store referral info, always defaulting to info@vibe-coding.tw if missing
        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: uid,
            amount: finalAmount,
            status: "PENDING",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            items: cartDetails || {},
            logistics: logistics || null,
            promoCode: (promoCode && promoCode.trim()) ? promoCode.trim().toUpperCase() : null,
            referralMentor: (referralMentor && referralMentor.trim()) ? referralMentor.trim() : 'info@vibe-coding.tw',
            orderNumber: orderNumber
        });

        // ServerUrl (Webhook)
        const serverUrl = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentNotify`;
        // ClientUrl (前端)
        const clientUrl = returnUrl || "https://vibe-coding.tw";

        console.log(`建立訂單: ${orderNumber} (Promo: ${promoCode || 'None'})`);

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
            gateway: "ECPAY",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        res.status(200).json({ result: { paymentParams: ecpayParams, apiUrl: ECPAY_API_URL } });

    } catch (error) {
        console.error("嚴重錯誤:", error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// ==========================================
// 1.5. 取得物流地圖參數 (getLogisticsMapParams)
// ==========================================
exports.getLogisticsMapParams = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        console.log("收到 getLogisticsMapParams 請求");

        const requestData = req.body.data || req.body || {};
        const { logisticsSubType, isCollection } = requestData;

        if (!logisticsSubType) {
            return res.status(400).json({ error: { message: "缺少 logisticsSubType" } });
        }

        const params = {
            MerchantID: MERCHANT_ID,
            LogisticsType: 'CVS',
            LogisticsSubType: logisticsSubType,
            IsCollection: isCollection || 'N',
            ServerReplyURL: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/mapReply`
        };

        params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV, 'md5');

        console.log(`產生地圖參數 for ${logisticsSubType}:`, params);

        res.status(200).json({ result: { params, apiUrl: ECPAY_LOGISTICS_MAP_URL || 'https://logistics.ecpay.com.tw/Express/map' } });

    } catch (error) {
        console.error("產生地圖參數失敗:", error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// ==========================================
// 2. 接收通知 (paymentNotify)
// ==========================================
exports.paymentNotify = onRequest(async (req, res) => {
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

            // [NEW] Send Payment Success Email + auto teacher assignment from promo code
            try {
                // Fetch order details to get email and items
                const db = admin.firestore();
                const orderDoc = await db.collection("orders").doc(orderId).get();
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

                    if (orderData.uid && orderData.uid !== 'GUEST' && orderData.promoCode) {
                        const lessons = await getLessons();
                        const promoDoc = await db.collection('promo_codes').doc(orderData.promoCode).get();

                        if (promoDoc.exists && promoDoc.data()?.isActive !== false) {
                            const promoData = promoDoc.data();
                            const targetUnitId = resolveCanonicalUnitId(promoData.courseId, lessons);
                            const purchasedUnits = collectPurchasedUnitIds(orderData.items || {}, lessons);

                            if (targetUnitId && purchasedUnits.includes(targetUnitId) && promoData.mentorEmail) {
                                await upsertStudentUnitAssignment(
                                    db,
                                    orderData.uid,
                                    targetUnitId,
                                    promoData.mentorEmail,
                                    'paymentNotify',
                                    true
                                );
                                console.log(`[paymentNotify] Auto-assigned ${orderData.uid} -> ${promoData.mentorEmail} for ${targetUnitId}`);
                            } else {
                                console.warn(`[paymentNotify] Promo ${orderData.promoCode} did not match purchased units for order ${orderId}`);
                            }
                        }
                    }
                }
            } catch (emailErr) {
                console.error("Failed to process payment follow-up:", emailErr);
            }
        }

        return res.status(200).send('1|OK');

    } catch (error) {
        console.error("通知處理失敗:", error);
        return res.status(200).send('1|OK');
    }
});

// ==========================================
// 3. 權限與課程資訊 (Lessons & Auth)
// ==========================================

// Cache for lessons data
let cachedLessons = null;
let lastFetchTime = 0;

async function getLessons() {
    const now = Date.now();
    // Cache for 5 minutes (DISABLED FOR DEBUG)
    /*
    if (cachedLessons && (now - lastFetchTime < 300000)) {
        return cachedLessons;
    }
    */
    console.log("[getLessons] Cache disabled, fetching fresh data...");

    try {
        if (typeof db === 'undefined') {
            console.error("Critical: Global 'db' is undefined inside getLessons!");
            return [];
        }

        // 1. Fetch from Firestore 'metadata_lessons'
        console.log("Fetching lessons from Firestore 'metadata_lessons' (sorted by orderWeight)...");
        const lessonsSnap = await db.collection('metadata_lessons').orderBy("orderWeight", "asc").get();
        console.log(`Firestore snapshot size: ${lessonsSnap.size}`);

        if (!lessonsSnap.empty) {
            cachedLessons = lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Sort manually while we still have orderWeight
            cachedLessons.sort((a,b) => (a.orderWeight || 0) - (b.orderWeight || 0));

            // Clean up internal fields AFTER sort
            cachedLessons = cachedLessons.map(d => {
                delete d.updatedAt;
                delete d.orderWeight;
                return d;
            });
            
            lastFetchTime = Date.now();
            console.log(`[getLessons] Successfully loaded ${cachedLessons.length} lessons.`);
            return cachedLessons;
        } else {
            console.warn("[getLessons] Firestore 'metadata_lessons' collection is EMPTY!");
        }
    } catch (err) {
        console.error("[getLessons] Critical error:", err);
    }

    return cachedLessons || [];
}

function resolveCanonicalUnitId(unitId, lessons = []) {
    if (!unitId) return unitId;

    for (const lesson of lessons) {
        const courseUnits = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        if (courseUnits.includes(unitId)) return unitId;

        const matchedUnit = courseUnits.find(courseUnit => {
            const shortUnit = courseUnit.replace(/^start-/, '');
            return shortUnit === unitId;
        });

        if (matchedUnit) return matchedUnit;
    }

    return unitId;
}

function findParentCourseIdByUnit(unitId, lessons = []) {
    if (!unitId) return null;

    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    const lesson = lessons.find(l => Array.isArray(l.courseUnits) && l.courseUnits.includes(canonicalUnitId));
    return lesson?.courseId || null;
}

function findCourseByPageOrUnit(pageId, fileName, lessons = []) {
    return lessons.find(l =>
        l.courseId === pageId ||
        (fileName && Array.isArray(l.courseUnits) && l.courseUnits.includes(fileName)) ||
        (fileName && l.classroomUrl && l.classroomUrl.endsWith(fileName))
    ) || null;
}

function collectPurchasedUnitIds(items = {}, lessons = []) {
    const purchasedUnits = new Set();

    Object.keys(items || {}).forEach(itemKey => {
        const lesson = lessons.find(l => l.courseId === itemKey);
        if (lesson) {
            (lesson.courseUnits || []).forEach(unitId => purchasedUnits.add(resolveCanonicalUnitId(unitId, lessons)));
            return;
        }

        const canonicalUnitId = resolveCanonicalUnitId(itemKey, lessons);
        if (canonicalUnitId) purchasedUnits.add(canonicalUnitId);
    });

    return Array.from(purchasedUnits);
}

function hasActiveOrderForCourse(ordersSnapshot, courseId) {
    let hasCourse = false;
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    ordersSnapshot.forEach(doc => {
        const data = doc.data();
        const items = data.items || {};
        if (!items[courseId]) return;

        if (data.expiryDate?.toDate) {
            const expiry = data.expiryDate.toDate().getTime();
            if (now < expiry) hasCourse = true;
            return;
        }

        let orderDate = null;
        if (data.paymentDate) {
            orderDate = new Date(data.paymentDate).getTime();
        } else if (data.createdAt?.toDate) {
            orderDate = data.createdAt.toDate().getTime();
        }

        if (orderDate && (now - orderDate < ONE_YEAR_MS)) {
            hasCourse = true;
        }
    });

    return hasCourse;
}

function resolveClassroomUrlForTeacher(urlConfig, teacherEmail) {
    if (!urlConfig) return null;
    if (typeof urlConfig === 'string') return urlConfig;
    if (typeof urlConfig !== 'object') return null;
    if (teacherEmail && typeof urlConfig[teacherEmail] === 'string') return urlConfig[teacherEmail];
    if (typeof urlConfig.default === 'string') return urlConfig.default;
    return Object.values(urlConfig).find(value => typeof value === 'string' && value.trim()) || null;
}

async function upsertStudentUnitAssignment(db, studentUid, unitId, teacherEmail, assignedByUid = 'system', notify = true) {
    const userRef = db.collection('users').doc(studentUid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const previousTeacher = userData.unitAssignments?.[unitId] || null;

    await userRef.set({
        unitAssignments: {
            [unitId]: teacherEmail || null
        },
        lastAssignmentUpdate: admin.firestore.FieldValue.serverTimestamp(),
        lastAssignedBy: assignedByUid
    }, { merge: true });

    if (notify && teacherEmail && previousTeacher !== teacherEmail) {
        const studentName = userData.displayName || userData.name || userData.email || "學生";
        const studentEmail = userData.email;

        if (studentEmail) {
            await sendStudentLinkedToTeacherEmail(studentEmail, studentName, unitId, teacherEmail);
        }
        await sendTeacherLinkedToStudentEmail(teacherEmail, studentName, unitId);
    }

    return { previousTeacher, changed: previousTeacher !== (teacherEmail || null) };
}

async function resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons = []) {
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    const course = findCourseByPageOrUnit(courseId, canonicalUnitId, lessons) || findCourseByPageOrUnit(courseId, unitId, lessons);
    const effectiveCourseId = course ? course.courseId : (courseId || findParentCourseIdByUnit(canonicalUnitId, lessons));

    if (!effectiveCourseId || !canonicalUnitId) {
        return { authorized: false, reason: 'missing-context', canonicalUnitId, effectiveCourseId };
    }

    const userRecord = await admin.auth().getUser(uid);
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const isFreeCourse = !!(course && course.price === 0);
    const isTrialCourse = !!(course && course.category === 'started' && ((now - new Date(userRecord.metadata.creationTime).getTime()) < THIRTY_DAYS_MS));

    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const assignedTeacherEmail = userData.unitAssignments?.[canonicalUnitId] || null;

    if (isFreeCourse || isTrialCourse) {
        return {
            authorized: true,
            canonicalUnitId,
            effectiveCourseId,
            assignedTeacherEmail,
            requiresTeacherAssignment: false,
            course
        };
    }

    const ordersSnapshot = await db.collection('orders')
        .where('uid', '==', uid)
        .where('status', '==', 'SUCCESS')
        .get();

    const hasPaidCourse = !ordersSnapshot.empty && hasActiveOrderForCourse(ordersSnapshot, effectiveCourseId);
    if (!hasPaidCourse) {
        return {
            authorized: false,
            reason: 'payment-required',
            canonicalUnitId,
            effectiveCourseId,
            assignedTeacherEmail: null,
            course
        };
    }

    return {
        authorized: true,
        canonicalUnitId,
        effectiveCourseId,
        assignedTeacherEmail,
        requiresTeacherAssignment: true,
        course
    };
}

// [NEW] API to expose lessons to frontend
exports.getLessonsMetadata = onCall(async (request) => {
    console.log("[getLessonsMetadata] Starting onCall request...");
    const lessons = await getLessons();
    console.log(`[getLessonsMetadata] Returning ${lessons.length} lessons to caller.`);
    return { lessons: lessons };
});


exports.checkPaymentAuthorization = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }

    try {
        const requestData = req.body.data || req.body || {};
        const { pageId, fileName, superMode } = requestData; // Accept fileName and superMode from frontend
        console.log(`[checkPaymentAuthorization] Request for PageId: ${pageId}, FileName: ${fileName}, SuperMode: ${superMode}, UID: ${req.headers.authorization ? 'PRESENT' : 'MISSING'}`);

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

        // [FIXED v11.3.9] Robust Course Identification
        // Match by courseId, current fileName (unit), or classroomUrl (master)
        const course = lessons.find(l =>
            l.courseId === pageId ||
            (fileName && l.courseUnits && l.courseUnits.includes(fileName)) ||
            (fileName && l.classroomUrl && l.classroomUrl.endsWith(fileName))
        );

        // Normalize pageId if we matched by file
        const effectiveCourseId = course ? course.courseId : pageId;

        // 2. Check if course exists and is free (price === 0) - Prioritize this!
        if (course && course.price === 0) {
            console.log(`Course ${effectiveCourseId} is free, authorizing...`);
            const token = generateToken(effectiveCourseId, fileName);
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

        // [NEW] Admin Super Mode Bypass
        if (superMode === true) {
            try {
                const userRole = await getRole(uid);
                if (userRole === 'admin') {
                    console.log(`[checkPaymentAuthorization] Super Mode Bypass granted for Admin: ${uid}`);
                    const token = generateToken(effectiveCourseId, fileName);
                    return res.status(200).json({ result: { authorized: true, token: token, superModeActive: true } });
                }
            } catch (roleErr) {
                console.error("[checkPaymentAuthorization] Super Mode role check failed:", roleErr);
            }
        }

        // ---------------------------------------------------------
        // [NEW v11.3.10] Robust Authorization Check (Unit-Driven)
        // Checks if user is in authorizedTeachers for course or ANY of its units.
        // This bypasses the global 'teacher' role requirement for specific unit teachers.
        // ---------------------------------------------------------
        try {
            const userRecord = await admin.auth().getUser(uid);
            const userEmail = userRecord.email;
            const userRole = await getRole(uid);

            console.log(`[checkPaymentAuthorization] Verifying ${userRole} ${userEmail} for course ${effectiveCourseId}`);

            // Collect all possible authorization sources
            const authSources = [];
            authSources.push(effectiveCourseId); // Source A: Course-level
            if (course && course.courseUnits) {
                authSources.push(...course.courseUnits); // Source B: Unit-level
            }

            // Parallel check all sources in Firestore
            const authSnapshots = await Promise.all(
                authSources.map(docId => admin.firestore().collection('course_configs').doc(docId).get())
            );

            const isExplicitlyAuthorized = authSnapshots.some(snap => {
                if (!snap.exists) return false;
                const data = snap.data();

                // [DEBUG v11.3.11] Trace for specific user
                if (userEmail === 'rover.k.chen@gmail.com') {
                    console.log(`[checkPaymentAuthorization] DEBUG for ${userEmail} on ${snap.id}: authorizedTeachers=${JSON.stringify(data.authorizedTeachers || [])}`);
                }

                if (data.authorizedTeachers && data.authorizedTeachers.includes(userEmail)) return true;
                const unitUrls = data.githubClassroomUrls || {};
                for (const linkMap of Object.values(unitUrls)) {
                    if (linkMap && typeof linkMap === 'object' && linkMap[userEmail]) return true;
                }
                return false;
            });

            if (isExplicitlyAuthorized) {
                console.log(`[checkPaymentAuthorization] ${userRole} ${userEmail} authorized for ${effectiveCourseId} via explicit check`);
                const token = generateToken(effectiveCourseId, effectiveCourseId);
                return res.status(200).json({ result: { authorized: true, token: token, role: userRole } });
            }
        } catch (authErr) {
            console.error("[checkPaymentAuthorization] Explicit authorization check failed:", authErr);
        }
        // ---------------------------------------------------------

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
                // [DEBUG v11.3.11] Trace for specific user
                if (uid && pageId === 'ydb63bg') {
                    console.log(`[checkPaymentAuthorization] DEBUG: Found SUCCESS order ${doc.id} for course ${pageId}`);
                }
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

// 4. 安全檔案服務 (serveCourse)
// ==========================================
exports.serveCourse = onRequest(async (req, res) => {
    // 1. Parsing Path (e.g. /courses/ble-connection-master.html)
    const urlPath = req.path; // /courses/foo.html
    // [FIXED v11.3.8] More robust fileName extraction (strips leading slashes)
    const fileName = urlPath.split('/').filter(Boolean).pop();

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

        // C. [NEW v11.3.16] Surgical Normalization
        // Only prepend 'start-' if the requested 0X-unit- file doesn't exist as-is.
        // This avoids breaking 'prepare' units which are naming 01-unit-... while allowing
        // 'started' units (start-01-unit-...) to be accessed via legacy short links.
        let normalizedFileName = fileName;
        if (fileName.match(/^0[1-5]-/) && !fileName.includes('-master-')) {
            const asIsPath = path.join(__dirname, 'private_courses', fileName);
            if (!fs.existsSync(asIsPath)) {
                normalizedFileName = 'start-' + fileName;
                console.log(`[serveCourse] Early Normalization (Conditional): ${fileName} -> ${normalizedFileName}`);
            }
        }

        // B. Validate Expiry
        if (Date.now() > expiry) {
            return res.status(403).send("Access Denied: Token expired.");
        }

        // C. Validate File Scope Dynamic Logic [REFACTORED v11.3.14]
        let isAuthorizedScope = (scopePart === fileName);
        let debugInfo = "None";
        let lessons = [];

        if (!isAuthorizedScope) {
            try {
                // Use the centralized getLessons helper [FIXED v11.3.14]
                lessons = await getLessons();

                // Find the course by pageId/courseId or scopePart
                const course = lessons.find(l =>
                    l.courseId === scopePart ||
                    (l.classroomUrl && l.classroomUrl.endsWith(scopePart))
                );

                if (course) {
                    const masterFile = (course.classroomUrl || "").split('/').pop();
                    const isMasterMatch = (normalizedFileName === masterFile);
                    let isUnitMatch = course.courseUnits && course.courseUnits.includes(normalizedFileName);
                    
                    // Hotfix for newly merged unit
                    if (scopePart === '03-master-wifi-motor.html' && normalizedFileName === '03-unit-vibe-classroom-intro.html') {
                        isUnitMatch = true;
                    }
                    debugInfo = `CourseFound: ${course.courseId}, isMasterMatch: ${isMasterMatch}, isUnitMatch: ${isUnitMatch}, masterFile: ${masterFile}`;

                    if (isMasterMatch || isUnitMatch) {
                        isAuthorizedScope = true;
                        console.log(`[serveCourse] ${normalizedFileName} authorized via dynamic course-scope: ${scopePart}`);
                    }
                } else {
                    debugInfo = `CourseNotFound for Scope: ${scopePart}. LessonsCount: ${lessons.length}`;
                }
            } catch (jsonErr) {
                console.error("[serveCourse] JSON Scope check failed:", jsonErr);
                debugInfo = `JSON Error: ${jsonErr.message}`;
            }
        }

        if (!isAuthorizedScope) {
            const manualFallback = lessons.find(l => l.courseUnits && l.courseUnits.includes(scopePart));
            console.error(`Access Denied Debug: Scope=${scopePart}, File=${normalizedFileName}, Debug=${debugInfo}`);
            
            // [MODIFIED v11.3.14] Fallback: If scopePart is a fileName and lesson contains it, allow.
            if (manualFallback) {
                const isMasterMatch = (manualFallback.classroomUrl && manualFallback.classroomUrl.endsWith(normalizedFileName));
                let isUnitMatch = (manualFallback.courseUnits && manualFallback.courseUnits.includes(normalizedFileName));
                
                // Hotfix for newly merged unit
                if (scopePart === '03-master-wifi-motor.html' && normalizedFileName === '03-unit-vibe-classroom-intro.html') {
                    isUnitMatch = true;
                }
                if (isMasterMatch || isUnitMatch) {
                    isAuthorizedScope = true;
                    console.log(`[serveCourse] ${normalizedFileName} authorized via manual fallback for scope ${scopePart}`);
                }
            }
        }

        if (!isAuthorizedScope) {
            return res.status(403).send(`Access Denied: Token valid for ${scopePart}, but requested ${normalizedFileName}.`);
        }

        // 3. Serve File
        const finalServeName = normalizedFileName; 
        let filePath = path.join(__dirname, 'private_courses', finalServeName);

        // [NEW v11.3.9] Legacy Name Fallback (01- to 00-)
        if (!fs.existsSync(filePath)) {
            let altFileName;
            if (fileName.startsWith('start-')) altFileName = fileName.replace('start-', '');
            else if (fileName.match(/^0[1-5]-/)) altFileName = 'start-' + fileName;

            if (altFileName) {
                const altPath = path.join(__dirname, 'private_courses', altFileName);
                if (fs.existsSync(altPath)) {
                    console.log(`[serveCourse] Legacy Fallback: ${fileName} -> ${altFileName}`);
                    filePath = altPath;
                }
            }
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found.");
        }

        // [NEW v11.3.15] Inject Firebase SDK & Bootstrapper for Auto-Tracking
        let content = fs.readFileSync(filePath, 'utf8');
        const firebaseConfig = {
            apiKey: "AIzaSyCO6Y6Pa7b7zbieJIErysaNF6-UqbT8KJw",
            authDomain: "e-learning-942f7.firebaseapp.com",
            projectId: "e-learning-942f7",
            storageBucket: "e-learning-942f7.firebasestorage.app",
            messagingSenderId: "878397058574",
            appId: "1:878397058574:web:28aaa07a291ee3baab165f"
        };

        const bootstrapper = `
        <!-- [Firebase Auto-Inject v1.0] -->
        <script type="module">
            import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
            import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-functions.js";
            
            const config = ${JSON.stringify(firebaseConfig)};
            const app = initializeApp(config);
            
            // Expose to window for course-shared.js compatibility
            window.vibeApp = app;
            window.getFunctions = getFunctions;
            window.httpsCallable = httpsCallable;
            console.log("[Firebase] SDK Injected & Initialized");
        </script>
        `;

        // Insert before </body> or at the end
        if (content.includes('</body>')) {
            content = content.replace('</body>', `${bootstrapper}</body>`);
        } else {
            content += bootstrapper;
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.send(content);

    } catch (e) {
        console.error(e);
        res.status(403).send("Access Denied: Token error.");
    }
});

const getRole = async (uid) => {
    try {
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        if (userDoc.exists) return userDoc.data().role;

        // [SELF-HEALING] Fallback for bootstrapping or if Firestore doc is missing
        const userRecord = await admin.auth().getUser(uid);
        const adminEmail = process.env.ADMIN_EMAIL || 'rover.k.chen@gmail.com';
        if (userRecord.email && userRecord.email.toLowerCase() === adminEmail.toLowerCase()) {
            console.log(`[Role] Self-healing: Granting admin to ${userRecord.email}`);
            return 'admin';
        }
    } catch (e) {
        console.error("[Role] Error in getRole:", e);
    }
    return 'student'; // Default to student
};

// ==========================================
// 5. 設定用戶角色 (setUserRole - Admin Only)
// ==========================================
exports.setUserRole = onCall(async (request) => {
    const { data, auth } = request;
    // 1. Check Authentication
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const adminUid = auth.uid;
    const adminRole = await getRole(adminUid);

    // 2. Check Authorization (Must be Admin)
    // NOTE: For bootstrapping, you might need to temporarily bypass this or set the first admin in Firestore Console.
    if (adminRole !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can set roles.');
    }

    const { email, role } = data;

    if (!['student', 'teacher', 'admin'].includes(role)) {
        throw new HttpsError('invalid-argument', 'Invalid role.');
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
        throw new HttpsError('not-found', `User with email ${email} not found.`);
    }
});

// ==========================================
// 6. 記錄學習活動 (logActivity)
// ==========================================
exports.logActivity = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        // Allow anonymous logging? Probably not for specific student tracking.
        // But for now, let's require auth.
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = auth.uid;
    const { courseId, action, duration, metadata } = data;

    if (!courseId || !action) {
        throw new HttpsError('invalid-argument', 'Missing courseId or action.');
    }

    // [NEW] Disable Page View Logging
    if (action === 'PAGE_VIEW') {
        return { success: true, message: "Page view logging disabled" };
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
        throw new HttpsError('internal', 'Failed to log activity.');
    }
});

// ==========================================
// 7. 課程設定管理 (saveCourseConfigs / getCourseConfigs)
// ==========================================
exports.saveCourseConfigs = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }
    const uid = auth.uid;
    const email = auth.token.email;
    const role = await getRole(uid);
    if (role !== 'admin' && role !== 'teacher') {
        throw new HttpsError('permission-denied', 'Only teachers and admins can save configs.');
    }

    const { courseId, configs } = data;
    if (!courseId || !configs) {
        throw new HttpsError('invalid-argument', 'Missing courseId or configs.');
    }

    try {
        const docRef = admin.firestore().collection('course_configs').doc(courseId);
        const doc = await docRef.get();
        const existingConfigs = doc.exists ? doc.data() : {};

        // Security Check: Caller must be admin OR an authorized teacher for this course
        const isAuthorized = role === 'admin' || (existingConfigs.authorizedTeachers && existingConfigs.authorizedTeachers.includes(email));

        if (!isAuthorized) {
            throw new HttpsError('permission-denied', 'Only authorized teachers can save configs.');
        }

        // [NEW] If admin is saving, automatically add them to the authorized teachers list for recorded tracking
        if (role === 'admin') {
            const currentTeachers = existingConfigs.authorizedTeachers || [];
            if (!currentTeachers.includes(email)) {
                const teacherData = {
                    email: email,
                    name: 'Admin', // Default name for auto-auth
                    qualifiedAt: new Date().toISOString()
                };
                configs.authorizedTeachers = admin.firestore.FieldValue.arrayUnion(email);
                configs.teacherDetails = {
                    ...(existingConfigs.teacherDetails || {}),
                    [email]: teacherData
                };
            }
        }

        await docRef.set({
            ...configs,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        }, { merge: true });
        return { success: true, message: 'Configuration saved successfully.' };
    } catch (e) {
        console.error("Save Config Error:", e);
        throw new HttpsError('internal', e.message);
    }
});

exports.getCourseConfigs = onCall(async (request) => {
    const { data } = request;
    const { courseId } = data;
    try {
        const db = admin.firestore();
        if (courseId) {
            const doc = await db.collection('course_configs').doc(courseId).get();
            return { [courseId]: doc.exists ? doc.data() : null };
        } else {
            const snapshot = await db.collection('course_configs').get();
            const allConfigs = {};
            snapshot.forEach(doc => allConfigs[doc.id] = doc.data());
            return allConfigs;
        }
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

exports.resolveAssignmentAccess = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const { unitId, courseId } = data || {};
    if (!unitId) throw new HttpsError('invalid-argument', '缺少單元 ID');

    const db = admin.firestore();
    const lessons = await getLessons();
    const access = await resolveStudentAssignmentAccess(db, auth.uid, courseId, unitId, lessons);
    if (!access.authorized) return { authorized: false, reason: access.reason || 'forbidden' };

    const { canonicalUnitId, effectiveCourseId, assignedTeacherEmail, requiresTeacherAssignment } = access;

    if (requiresTeacherAssignment && !assignedTeacherEmail) {
        return {
            authorized: true,
            classroomUrl: null,
            assignedTeacherEmail: null,
            canonicalUnitId,
            courseId: effectiveCourseId,
            requiresTeacherAssignment: true
        };
    }

    const parentDoc = effectiveCourseId ? await db.collection('course_configs').doc(effectiveCourseId).get() : null;
    const unitDoc = canonicalUnitId ? await db.collection('course_configs').doc(canonicalUnitId).get() : null;
    const candidateConfigs = [parentDoc?.data() || {}, unitDoc?.data() || {}];

    let classroomUrl = null;
    for (const cfg of candidateConfigs) {
        if (cfg.githubClassroomUrls && cfg.githubClassroomUrls[canonicalUnitId]) {
            classroomUrl = resolveClassroomUrlForTeacher(cfg.githubClassroomUrls[canonicalUnitId], assignedTeacherEmail);
        }
        if (classroomUrl) break;
    }

    if (!classroomUrl) {
        const course = lessons.find(l => l.courseId === effectiveCourseId);
        if (course?.githubClassroomUrls?.[canonicalUnitId]) {
            classroomUrl = resolveClassroomUrlForTeacher(course.githubClassroomUrls[canonicalUnitId], assignedTeacherEmail);
        }
    }

    return {
        authorized: true,
        classroomUrl: classroomUrl || null,
        assignedTeacherEmail: assignedTeacherEmail || null,
        canonicalUnitId,
        courseId: effectiveCourseId,
        requiresTeacherAssignment
    };
});

// 7.3 授權課程老師 (Admin Only)
exports.authorizeTeacherForCourse = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    if (requesterRole !== 'admin') throw new HttpsError('permission-denied', '僅限管理員');

    const { courseId, teacherEmail, action, parentCourseId } = data; // action: 'add' or 'remove'
    if (!courseId || !teacherEmail) throw new HttpsError('invalid-argument', '缺少必要參數');

    try {
        const db = admin.firestore();
        const docRef = db.collection('course_configs').doc(courseId); // Unit-level
        const parentDocRef = parentCourseId ? db.collection('course_configs').doc(parentCourseId) : null;

        if (action === 'add') {
            // ... [ADD Logic remains same focus on unit-level] ...
            let teacherName = teacherEmail.split('@')[0];
            try {
                const userRecord = await admin.auth().getUserByEmail(teacherEmail);
                const userDoc = await db.collection('users').doc(userRecord.uid).get();
                if (userDoc.exists && userDoc.data().name) {
                    teacherName = userDoc.data().name;
                } else if (userRecord.displayName) {
                    teacherName = userRecord.displayName;
                }
            } catch (err) {
                console.log(`[Role] Metadata skip: ${err.message}`);
            }

            const teacherData = { email: teacherEmail, name: teacherName, qualifiedAt: new Date().toISOString() };

            const doc = await docRef.get();
            const existingUnitConfig = doc.exists ? doc.data() : {};
            const nextTeacherDetails = {
                ...(existingUnitConfig.teacherDetails || {}),
                [teacherEmail]: teacherData
            };
            if (!doc.exists) {
                await docRef.set({
                    authorizedTeachers: [teacherEmail],
                    teacherDetails: nextTeacherDetails,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await docRef.update({
                    authorizedTeachers: admin.firestore.FieldValue.arrayUnion(teacherEmail),
                    teacherDetails: nextTeacherDetails,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // [NEW] Also update parent legacy map if provided (use dot-notation to avoid overwrite)
            if (parentDocRef) {
                const parentDoc = await parentDocRef.get();
                const parentData = parentDoc.exists ? parentDoc.data() : {};
                const githubClassroomUrls = { ...(parentData.githubClassroomUrls || {}) };
                githubClassroomUrls[courseId] = {
                    ...(githubClassroomUrls[courseId] || {}),
                    [teacherEmail]: "authorized"
                };
                await parentDocRef.set({
                    githubClassroomUrls,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }

            // [NEW] Unit-Specific Promo Code & Email Notification
            try {
                const promoCode = await internalGetOrCreatePromoCode(db, teacherEmail, courseId, teacherName);
                
                // Fetch Unit Name for Email
                const lessons = await getLessons();
                const unitMetadata = lessons.find(l => l.courseId === courseId || (l.courseUnits && l.courseUnits.includes(courseId)));
                const unitName = unitMetadata ? (unitMetadata.title || unitMetadata.courseName || courseId) : courseId;

                await sendTeacherAuthorizationEmail(teacherEmail, unitName, courseId, promoCode);
                console.log(`[Auth] Promo code ${promoCode} generated and email sent to ${teacherEmail} for ${courseId}`);
            } catch (authExtraErr) {
                console.error("[Auth] Failed to generate promo code or send email:", authExtraErr);
            }

            // [MODIFIED] Do NOT set role: 'teacher' in users collection.
            // Authorization is strictly handled at the course_configs unit level.

        } else if (action === 'remove') {
            const doc = await docRef.get();
            const existingUnitConfig = doc.exists ? doc.data() : {};
            const nextTeacherDetails = { ...(existingUnitConfig.teacherDetails || {}) };
            delete nextTeacherDetails[teacherEmail];

            // 1. Clean up Unit-level Config
            await docRef.update({
                authorizedTeachers: admin.firestore.FieldValue.arrayRemove(teacherEmail),
                teacherDetails: nextTeacherDetails,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. [REFINED] Clean up Legacy Parent-level Config (githubClassroomUrls) in ALL docs
            const allConfigs = await db.collection('course_configs').get();
            const batch = db.batch();
            let parentFound = false;

            allConfigs.forEach(configDoc => {
                const data = configDoc.data();
                if (data.githubClassroomUrls && data.githubClassroomUrls[courseId]) {
                    const nextGithubClassroomUrls = { ...(data.githubClassroomUrls || {}) };
                    const unitConfig = { ...(nextGithubClassroomUrls[courseId] || {}) };
                    if (unitConfig[teacherEmail]) {
                        delete unitConfig[teacherEmail];
                        nextGithubClassroomUrls[courseId] = unitConfig;
                        batch.update(configDoc.ref, {
                            githubClassroomUrls: nextGithubClassroomUrls,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        parentFound = true;
                    }
                }
            });

            if (parentFound) {
                await batch.commit();
            }
        }
        return { success: true };
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

// 7.4 一次性遷移：此功能已於 2026-03-27 執行完畢並移除。

// ==========================================
// 7.1. 申請合格教師 (applyForTeacherRole)
exports.applyForTeacherRole = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const { unitId } = data;
    if (!unitId) throw new HttpsError('invalid-argument', 'Missing unitId');

    const uid = auth.uid;
    const email = auth.token.email;
    const db = admin.firestore();
    const lessons = await getLessons();
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);

    // Check if user is already authorized
    const docRef = db.collection('course_configs').doc(canonicalUnitId);
    const doc = await docRef.get();
    if (doc.exists) {
        const authTeachers = doc.data().authorizedTeachers || [];
        if (authTeachers.includes(email)) {
            throw new HttpsError('already-exists', 'You are already a qualified teacher for this unit.');
        }
    }

    // Check for existing pending application
    const appSnapshot = await db.collection('teacher_applications')
        .where('userId', '==', uid)
        .where('unitId', '==', canonicalUnitId)
        .where('status', '==', 'pending')
        .get();
    
    if (!appSnapshot.empty) {
        throw new HttpsError('already-exists', 'You have a pending application for this unit.');
    }

    // Create application
    const application = {
        userId: uid,
        userEmail: email,
        unitId: canonicalUnitId,
        status: 'pending',
        appliedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const newAppRef = await db.collection('teacher_applications').add(application);

    // Notify Admin via Email
    const adminEmail = process.env.ADMIN_EMAIL || 'rover.k.chen@gmail.com';
    await sendAdminNewApplicationEmail(adminEmail, email, canonicalUnitId);

    return { success: true, applicationId: newAppRef.id };
});

exports.recommendTeacherForUnit = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const requesterRole = await getRole(auth.uid);
    if (!['admin', 'teacher'].includes(requesterRole)) {
        throw new HttpsError('permission-denied', 'Only teachers can recommend candidates.');
    }

    const { assignmentId } = data;
    if (!assignmentId) throw new HttpsError('invalid-argument', 'Missing assignmentId');

    const db = admin.firestore();
    const lessons = await getLessons();
    const assignmentRef = db.collection('assignments').doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();
    if (!assignmentDoc.exists) throw new HttpsError('not-found', 'Assignment not found');

    const assignment = assignmentDoc.data();
    const candidateUid = assignment.userId;
    const candidateEmail = assignment.userEmail;
    const canonicalUnitId = resolveCanonicalUnitId(assignment.unitId, lessons);
    if (!candidateUid || !candidateEmail || !canonicalUnitId) {
        throw new HttpsError('failed-precondition', 'Assignment metadata is incomplete.');
    }
    if (assignment.grade === null || assignment.grade === undefined) {
        throw new HttpsError('failed-precondition', 'Assignment must be graded before recommendation.');
    }

    const unitDocRef = db.collection('course_configs').doc(canonicalUnitId);
    const unitDoc = await unitDocRef.get();
    const unitConfig = unitDoc.exists ? unitDoc.data() : {};
    const authorizedTeachers = Array.isArray(unitConfig.authorizedTeachers) ? unitConfig.authorizedTeachers : [];

    if (requesterRole !== 'admin' && !authorizedTeachers.includes(auth.token.email)) {
        throw new HttpsError('permission-denied', 'Only the qualified teacher for this unit can recommend students.');
    }
    if (requesterRole !== 'admin' && assignment.assignedTeacherEmail !== auth.token.email) {
        throw new HttpsError('permission-denied', 'Only the assigned teacher can recommend this student.');
    }

    if (authorizedTeachers.includes(candidateEmail)) {
        throw new HttpsError('already-exists', 'Student is already a qualified teacher for this unit.');
    }

    const existingPending = await db.collection('teacher_applications')
        .where('userId', '==', candidateUid)
        .where('unitId', '==', canonicalUnitId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    if (!existingPending.empty) {
        throw new HttpsError('already-exists', 'Student already has a pending application for this unit.');
    }

    const application = {
        userId: candidateUid,
        userEmail: candidateEmail,
        unitId: canonicalUnitId,
        status: 'pending',
        source: 'teacher_recommendation',
        recommendedByUid: auth.uid,
        recommendedByEmail: auth.token.email || '',
        recommendedFromAssignmentId: assignmentId,
        appliedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const newAppRef = await db.collection('teacher_applications').add(application);

    const adminEmail = process.env.ADMIN_EMAIL || 'rover.k.chen@gmail.com';
    await sendAdminNewApplicationEmail(adminEmail, candidateEmail, canonicalUnitId);

    return { success: true, applicationId: newAppRef.id };
});

// 7.2. 決策合格教師申請 (decideTeacherApplication)
exports.decideTeacherApplication = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');

    const requesterRole = await getRole(auth.uid);
    if (requesterRole !== 'admin') throw new HttpsError('permission-denied', 'Only admins can resolve applications.');

    const { applicationId, status, adminMessage } = data; // status: 'approved' or 'rejected'
    if (!applicationId || !['approved', 'rejected'].includes(status)) {
        throw new HttpsError('invalid-argument', 'Invalid parameters');
    }

    const db = admin.firestore();
    const appRef = db.collection('teacher_applications').doc(applicationId);
    const appDoc = await appRef.get();

    if (!appDoc.exists) throw new HttpsError('not-found', 'Application not found');
    const appData = appDoc.data();
    if (appData.status !== 'pending') throw new HttpsError('failed-precondition', 'Application already resolved');

    const lessons = await getLessons();
    const { userEmail, unitId } = appData;
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    const parentCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons);

    // Update application
    await appRef.update({
        status: status,
        adminMessage: adminMessage || "",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

        if (status === 'approved') {
        // reuse existing logic or call it
        // For simplicity, we directly implement the authorization here
        const docRef = db.collection('course_configs').doc(canonicalUnitId);
        let teacherName = userEmail.split('@')[0];
        try {
            const userRecord = await admin.auth().getUserByEmail(userEmail);
            const userDoc = await db.collection('users').doc(userRecord.uid).get();
            if (userDoc.exists && userDoc.data().name) {
                teacherName = userDoc.data().name;
            } else if (userRecord.displayName) {
                teacherName = userRecord.displayName;
            }
        } catch (err) {
            console.log(`[Approve] Metadata skip for ${userEmail}: ${err.message}`);
        }

        const teacherData = { email: userEmail, name: teacherName, qualifiedAt: new Date().toISOString() };

        const unitDoc = await docRef.get();
        const existingUnitConfig = unitDoc.exists ? unitDoc.data() : {};
        const nextTeacherDetails = {
            ...(existingUnitConfig.teacherDetails || {}),
            [userEmail]: teacherData
        };
        if (!unitDoc.exists) {
            await docRef.set({
                authorizedTeachers: [userEmail],
                teacherDetails: nextTeacherDetails,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await docRef.update({
                authorizedTeachers: admin.firestore.FieldValue.arrayUnion(userEmail),
                teacherDetails: nextTeacherDetails,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        if (parentCourseId) {
            const parentDocRef = db.collection('course_configs').doc(parentCourseId);
            const parentDoc = await parentDocRef.get();
            const parentData = parentDoc.exists ? parentDoc.data() : {};
            const githubClassroomUrls = { ...(parentData.githubClassroomUrls || {}) };
            githubClassroomUrls[canonicalUnitId] = {
                ...(githubClassroomUrls[canonicalUnitId] || {}),
                [userEmail]: "authorized"
            };
            await parentDocRef.set({
                githubClassroomUrls,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // Generate Promo Code
        try {
            const promoCode = await internalGetOrCreatePromoCode(db, userEmail, canonicalUnitId, teacherName);
            // send result email (Success) is handled below
        } catch (authExtraErr) {
            console.error("[Approve] Failed to generate promo code:", authExtraErr);
        }
    }

    // Notify User via Email
    await sendApplicationResultEmail(userEmail, canonicalUnitId, status, adminMessage);

    return { success: true };
});

// 8. 獲取儀表板數據 (getDashboardData)
// ==========================================
exports.getDashboardData = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    console.log(`[getDashboardData] Start - UID: ${auth?.uid}, data: ${JSON.stringify(data)}`);
    
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = auth.uid;
    const email = auth.token.email;
    const requesterRole = await getRole(uid);
    console.log(`[getDashboardData] Requester UID: ${uid}, Email: ${email}, Role: ${requesterRole}`);
    const db = admin.firestore();
    const lessons = await getLessons(); 
    
    // [MIGRATION HELP] Mapping of legacy IDs to new metadata IDs
    const legacyMap = {
        '01': 'ydb63bg',
        '02': 'a45cwlak',
        '03': 'a7smdfeq',
        '04': 'hkdq5j3m',
        '05': 'io5rxgxl',
        'ai-agents-vibe': 'ai-agents-vibe', // Explicit mapping for new course
        '04-unit-wifi-setup.html': '03-unit-wifi-setup.html',
        '04-unit-motor-ramping.html': '03-unit-motor-ramping.html'
    };

    try {
        // 0. Fetch Course Authorization Data
        const authorizedCourseIds = [];
        const courseConfigs = {};
        const unitToDocId = {}; // [NEW] Map unit filename -> Firestore docId
        // [NEW] Fetch Teacher Application Status for THIS user
        const myApplicationsMapping = {};
        const myAppsSnapshot = await db.collection('teacher_applications')
            .where('userId', '==', uid)
            .get();
        myAppsSnapshot.forEach(doc => {
            const d = doc.data();
            myApplicationsMapping[d.unitId] = { status: d.status, appliedAt: d.appliedAt };
        });

        // [NEW] Fetch Global Teacher Terms (Rights & Obligations)
        let teacherTerms = "";
        try {
            const termsDoc = await db.collection('metadata_settings').doc('teacher_terms').get();
            teacherTerms = termsDoc.exists ? (termsDoc.data().content || "") : "尚未設定合格教師權利義務細則。";
        } catch (e) {
            console.warn("[getDashboardData] Failed to fetch teacher terms:", e);
        }

        // [NEW] (Admin Only) Fetch all PENDING applications
        let allPendingApplications = [];
        if (requesterRole === 'admin') {
            const pendingSnapshot = await db.collection('teacher_applications')
                .where('status', '==', 'pending')
                .get();
            
            allPendingApplications = pendingSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort in-memory to avoid index requirement for now
            allPendingApplications.sort((a, b) => {
                const timeA = a.appliedAt?.toMillis ? a.appliedAt.toMillis() : 0;
                const timeB = b.appliedAt?.toMillis ? b.appliedAt.toMillis() : 0;
                return timeB - timeA;
            });
        }

        const configsSnapshot = await db.collection('course_configs').get();
        configsSnapshot.forEach(doc => {
            const docId = doc.id; // [FIX 11.3.18] Define docId early for scope availability
            try {
                const cfg = doc.data();
                const isAuthorized = requesterRole === 'admin' || (Array.isArray(cfg.authorizedTeachers) && cfg.authorizedTeachers.includes(email));

                if (cfg.githubClassroomUrls) {
                    Object.keys(cfg.githubClassroomUrls).forEach(unitId => {
                        const existingDocId = unitToDocId[unitId];
                        if (!existingDocId || !existingDocId.includes('.html')) {
                            unitToDocId[unitId] = docId;
                        }
                        // [FIX] Handle start- prefix mismatch between Firestore and Metadata
                        if (unitId.match(/^0[1-5]-unit-/)) {
                            const startKey = 'start-' + unitId;
                            const existingStartDocId = unitToDocId[startKey];
                            if (!existingStartDocId || !existingStartDocId.includes('.html')) {
                                unitToDocId[startKey] = docId;
                            }
                        }
                    });
                }

                if (docId.includes('.html')) {
                    unitToDocId[docId] = docId;
                    if (docId.match(/^0[1-5]-unit-/)) {
                        unitToDocId['start-' + docId] = docId;
                    }
                    if (docId.match(/^start-0[1-5]-unit-/)) {
                        unitToDocId[docId.replace(/^start-/, '')] = docId;
                    }
                }

                if (isAuthorized) {
                    const mappedId = legacyMap[docId] || docId;

                    if (docId.includes('.html')) {
                        // [FIX] Normalize ID to handle start- prefix mismatch
                        const normalizedId = mappedId.replace('start-', '');
                        // Find parent course for this unit
                        const parentCourse = lessons.find(l => 
                            l.courseUnits && (l.courseUnits.includes(mappedId) || l.courseUnits.some(cu => cu.replace('start-', '') === normalizedId))
                        );
                        if (parentCourse && !authorizedCourseIds.includes(parentCourse.courseId)) {
                            authorizedCourseIds.push(parentCourse.courseId);
                        }
                    } else {
                        if (!authorizedCourseIds.includes(mappedId)) {
                            authorizedCourseIds.push(mappedId);
                        }
                    }
                    courseConfigs[mappedId] = cfg;
                    if (mappedId !== docId) {
                        courseConfigs[docId] = cfg;
                    }
                }
            } catch (err) {
                console.error(`Error processing config for course ${doc.id}:`, err);
            }
        });

        // [NEW] Extract Instructor Guides for all authorized courses dynamically
        // Refactored to aggregate from all related unit files by prefix
        const privateCoursesDir = path.join(__dirname, 'private_courses');
        console.log(`[getDashboardData] privateCoursesDir: ${privateCoursesDir}`);
        const allFiles = fs.existsSync(privateCoursesDir) ? fs.readdirSync(privateCoursesDir) : [];
        console.log(`[getDashboardData] Total files found: ${allFiles.length}. First 5: ${JSON.stringify(allFiles.slice(0, 5))}`);

        // [MODIFIED] If admin or global teacher, ensure ALL courses from lessons.json are considered for guide aggregation
        if (requesterRole === 'admin' || requesterRole === 'teacher') {
            lessons.forEach(l => {
                if (!authorizedCourseIds.includes(l.courseId)) {
                    authorizedCourseIds.push(l.courseId);
                }
            });
        }


        for (const cid of authorizedCourseIds) {
            const course = lessons.find(l => l.courseId === cid);
            if (course && course.classroomUrl) {
                try {
                    const masterFile = (course.classroomUrl || "").split('/').pop().split('?')[0];
                    const units = Array.isArray(course.courseUnits) ? [...course.courseUnits] : [];
                    
                    // Hotfix for new vibe unit missing in DB
                    if (masterFile === '03-master-wifi-motor.html' && !units.includes('03-unit-vibe-classroom-intro.html')) {
                        units.push('03-unit-vibe-classroom-intro.html');
                    }

                    const relatedFiles = [masterFile, ...units].filter(f => f && allFiles.includes(f));
                    let aggregatedGuides = {};

                    if (relatedFiles.length > 0) {
                        // console.log(`[getDashboardData] Extracting logs for ${cid}. Files: ${relatedFiles.join(', ')}`);
                        relatedFiles.sort((a, b) => {
                            if (a === masterFile) return -1;
                            if (b === masterFile) return 1;
                            return a.localeCompare(b);
                        });

                        console.log(`[getDashboardData] cid: ${cid}, relatedFiles: ${relatedFiles.join(', ')}`);
                        for (const file of relatedFiles) {
                            const filePath = path.join(privateCoursesDir, file);
                            if (!fs.existsSync(filePath)) continue;

                            const html = fs.readFileSync(filePath, 'utf8');

                            const guideContent = extractHiddenSectionContent(html, 'instructor-guide');
                            const assignContent = extractHiddenSectionContent(html, 'assignment-guide');

                            if (guideContent) {
                                if (guideContent) {
                                    if (!aggregatedGuides.instructor) aggregatedGuides.instructor = {};
                                    aggregatedGuides.instructor[file] = guideContent;
                                    console.log(`[getDashboardData] ✅ Found Instructor Guide for ${file} in ${cid}`);
                                } else {
                                    console.log(`[getDashboardData] ⚠️ Instructor Guide for ${file} in ${cid} is EMPTY`);
                                }
                            } else {
                                console.log(`[getDashboardData] ❌ No Instructor Guide match for ${file} in ${cid}`);
                            }

                            if (assignContent) {
                                if (assignContent) {
                                    if (!aggregatedGuides.assignment) aggregatedGuides.assignment = {};
                                    aggregatedGuides.assignment[file] = assignContent;
                                    console.log(`[getDashboardData] ✅ Found Assignment Guide for ${file} in ${cid}`);
                                } else {
                                    console.log(`[getDashboardData] ⚠️ Assignment Guide for ${file} in ${cid} is EMPTY`);
                                }
                            } else {
                                console.log(`[getDashboardData] ❌ No Assignment Guide match for ${file} in ${cid}`);
                            }
                        }

                        if (Object.keys(aggregatedGuides).length > 0) {
                            if (!courseConfigs[cid]) courseConfigs[cid] = {};
                            // [MERGE] Use Object.assign to preserve existing properties from Firestore
                            if (aggregatedGuides.instructor) {
                                courseConfigs[cid].instructorGuide = Object.assign({}, courseConfigs[cid].instructorGuide || {}, aggregatedGuides.instructor);
                            }
                            if (aggregatedGuides.assignment) {
                                courseConfigs[cid].assignmentGuide = Object.assign({}, courseConfigs[cid].assignmentGuide || {}, aggregatedGuides.assignment);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Failed to extract aggregated instructor guide for ${cid}:`, e);
                }
            }
        }


        // Determine if this user has any management access (Global Admin/Teacher or Course-Specific Teacher)
        const isManagementView = requesterRole === 'admin' || requesterRole === 'teacher' || authorizedCourseIds.length > 0;

        let result = {
            role: requesterRole,
            summary: {},
            students: [],
            assignments: [],
            courseConfigs: courseConfigs,
            unitToDocId: unitToDocId, 
            myPromoCode: null,
            earnings: [],
            // [NEW] Application Workflow support
            myApplications: myApplicationsMapping,
            teacherTerms: teacherTerms,
            pendingApplications: allPendingApplications
        };

        // [NEW] Fetch Profit Sharing Data for Mentors (Unit-Specific Promo Codes)
        if (isManagementView) {
            try {
                // If a unitId is provided from the frontend, fetch the SPECIFIC code for that unit
                const filterUnitId = data.unitId || null;
                let promoQuery = db.collection('promo_codes').where('mentorEmail', '==', email);
                
                if (filterUnitId) {
                    promoQuery = promoQuery.where('courseId', '==', filterUnitId);
                }

                const promoSnap = await promoQuery.limit(filterUnitId ? 1 : 10).get();
                if (!promoSnap.empty) {
                    result.myPromoCode = promoSnap.docs[0].id; // Return the first matching one
                }

                const ledgerSnap = await db.collection('profit_ledger')
                    .where('mentorEmail', '==', email)
                    .limit(500)
                    .get();
                
                result.earnings = ledgerSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => (b.month || "").localeCompare(a.month || ""));
            } catch (err) {
                console.error("Error fetching profit data for dashboard:", err);
            }
        }

        // 1. Fetch Users (Filtering based on access level)
        let usersMap = {};
        if (isManagementView) {
            // Admins see all users. Teachers/Course-Teachers see students.
            let usersSnapshot = await db.collection('users').get();
            
            // [NEW] Maintenance Sync: For admins, ensure EVERY Auth user has a Firestore document.
            if (requesterRole === 'admin') {
                try {
                    const listUsersResult = await admin.auth().listUsers(1000);
                    const authUsers = listUsersResult.users;
                    
                    const existingUids = usersSnapshot.docs.map(doc => doc.id);
                    const batch = db.batch();
                    let syncCount = 0;
                    
                    for (const au of authUsers) {
                        if (!existingUids.includes(au.uid)) {
                            const userRef = db.collection('users').doc(au.uid);
                            batch.set(userRef, {
                                email: au.email || "",
                                name: au.displayName || (au.email ? au.email.split('@')[0] : "New User"),
                                role: (au.email === 'rover.k.chen@gmail.com') ? 'admin' : 'student',
                                createdAt: au.metadata.creationTime ? new Date(au.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            }, { merge: true });
                            syncCount++;
                        }
                    }
                    if (syncCount > 0) {
                        console.log(`[getDashboardData] Syncing ${syncCount} missing Auth users...`);
                        await batch.commit();
                        // Refresh snapshot
                        usersSnapshot = await db.collection('users').get();
                    }
                } catch (syncErr) {
                    console.error("[getDashboardData] Auto-sync failed:", syncErr);
                }
            }

            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const role = userData.role || 'student';
                if (requesterRole === 'admin' || role === 'student') {
                    usersMap[doc.id] = { ...userData, role: role, _id: doc.id };
                }
            });
        } else {
            // Student ONLY view
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) usersMap[uid] = userDoc.data();
        }

        const targetDgUids = Object.keys(usersMap);
        if (targetDgUids.length === 0) return result;

        // 2. Fetch Activity Logs
        let logsQuery = db.collection('activity_logs').limit(5000);

        // If it's a student-only view, restrict by UID immediately
        if (!isManagementView) {
            logsQuery = logsQuery.where('uid', '==', uid);
        }

        const logsSnapshot = await logsQuery.get();
        const studentStats = {};

        logsSnapshot.forEach(doc => {
            const log = doc.data();

            // [NEW] Filter out PAGE_VIEW
            if (log.action === 'PAGE_VIEW') return;

            const sid = log.uid;
            let cid = log.courseId || 'unknown';
            if (legacyMap[cid]) cid = legacyMap[cid];

            // Authorization Filter for each log:
            // - It's my own log
            // - I'm a global admin/teacher
            // - I'm an authorized teacher for this specific course
            const isAuthorizedForLog = (sid === uid) || (requesterRole === 'admin' || requesterRole === 'teacher') || authorizedCourseIds.includes(cid);

            if (isAuthorizedForLog && usersMap[sid]) {
                if (!studentStats[sid]) {
                    studentStats[sid] = {
                        uid: sid,
                        email: usersMap[sid]?.email || 'Unknown',
                        name: usersMap[sid]?.name || '', // [NEW] Include student name
                        role: usersMap[sid]?.role || 'student',
                        totalTime: 0, videoTime: 0, docTime: 0, pageTime: 0, lastActive: null,
                        courseProgress: {},
                        unitAssignments: usersMap[sid]?.unitAssignments || {},
                        orders: [] // Will be populated below
                    };
                }

                const duration = log.duration || 0;
                studentStats[sid].totalTime += duration;
                if (log.action === 'VIDEO') studentStats[sid].videoTime += duration;
                if (log.action === 'DOC') studentStats[sid].docTime += duration;

                if (!studentStats[sid].lastActive) {
                    studentStats[sid].lastActive = log.timestamp ? log.timestamp.toDate() : null;
                }

                if (!studentStats[sid].courseProgress[cid]) {
                    studentStats[sid].courseProgress[cid] = { total: 0, video: 0, doc: 0, page: 0, logs: [] };
                }
                const cp = studentStats[sid].courseProgress[cid];
                cp.total += duration;
                if (log.action === 'VIDEO') cp.video += duration;
                if (log.action === 'DOC') cp.doc += duration;
                if (log.action === 'PAGE_VIEW') cp.page += duration;

                cp.logs.push({
                    action: log.action,
                    duration: duration,
                    timestamp: log.timestamp,
                    metadata: log.metadata
                });
            }
        });

        // [NEW] 2.5 Fetch successful orders to identify paid students without logs
        if (isManagementView) {
            try {
                const ordersSnapshot = await db.collection('orders').where('status', '==', 'SUCCESS').get();
                ordersSnapshot.forEach(doc => {
                    const order = doc.data();
                    const sid = order.uid;
                    if (!sid || sid === 'GUEST') return;

                    // If student already has activity, their entry exists in studentStats.
                    // If not, we create a placeholder entry so they show up in the list.
                    if (!studentStats[sid] && usersMap[sid]) {
                        studentStats[sid] = {
                            uid: sid,
                            email: usersMap[sid].email || 'Unknown',
                            name: usersMap[sid].name || '', // [NEW] Include name
                            role: usersMap[sid].role || 'student',
                            totalTime: 0, videoTime: 0, docTime: 0, pageTime: 0, lastActive: null,
                            courseProgress: {},
                            accountStatus: 'paid',
                            unitAssignments: usersMap[sid].unitAssignments || {},
                            orders: []
                        };
                    } else if (studentStats[sid]) {
                        // Just ensure they have the unitAssignments field
                        studentStats[sid].unitAssignments = usersMap[sid].unitAssignments || {};
                        studentStats[sid].accountStatus = 'paid';
                        if (!studentStats[sid].orders) studentStats[sid].orders = [];
                    }

                    // Map order items to course progress placeholder if missing
                    // This ensures the student appears under the specific course/unit management listing
                    if (studentStats[sid] && order.items) {
                        if (!studentStats[sid].orderRecords) studentStats[sid].orderRecords = [];
                        studentStats[sid].orderRecords.push({
                            createdAt: order.createdAt || null,
                            items: order.items
                        });
                        Object.keys(order.items).forEach(originalCid => {
                            const cid = legacyMap[originalCid] || originalCid;
                            if (!studentStats[sid].orders.includes(cid)) {
                                studentStats[sid].orders.push(cid);
                            }
                            if (!studentStats[sid].courseProgress[cid]) {
                                studentStats[sid].courseProgress[cid] = {
                                    total: 0, video: 0, doc: 0, page: 0, logs: [],
                                    isLicenseOnly: true // Mark as having license but no activity
                                };
                            }
                        });
                    }
                });
            } catch (orderErr) {
                console.error("Error fetching orders for dashboard:", orderErr);
            }
        }

        // [NEW] Ensure ALL students are included, along with registration time
        if (isManagementView) {
            Object.keys(usersMap).forEach(sid => {
                if (!studentStats[sid] && usersMap[sid].role === 'student') {
                    studentStats[sid] = {
                        uid: sid,
                        email: usersMap[sid].email || 'Unknown',
                        name: usersMap[sid].name || '',
                        role: usersMap[sid].role || 'student',
                        createdAt: usersMap[sid].createdAt || null,
                        totalTime: 0, videoTime: 0, docTime: 0, pageTime: 0, lastActive: null,
                        courseProgress: {},
                        accountStatus: 'free',
                        unitAssignments: usersMap[sid].unitAssignments || {},
                        orders: [],
                        orderRecords: []
                    };
                } else if (studentStats[sid]) {
                    studentStats[sid].createdAt = usersMap[sid].createdAt || null;
                }
            });
        }

        result.students = Object.values(studentStats);

        // 3. Fetch Assignments
        let assignQuery = db.collection('assignments');
        if (!isManagementView) {
            assignQuery = assignQuery.where('userId', '==', uid);
        }
        const assignSnapshot = await assignQuery.get();
        assignSnapshot.forEach(doc => {
            const data = doc.data();
            const targetUid = data.userId || data.uid;
            const originalCid = data.courseId || 'unknown';
            const mappedCid = legacyMap[originalCid] || originalCid;

            const assignmentTeacher = data.assignedTeacherEmail || null;
            const requesterEmail = auth.token.email || "";

            // Authorization Filter for each assignment
            // 1. My own assignment (Student/Any)
            // 2. Admin can see all
            // 3. Teacher can see if assigned to them, OR if they are an authorized teacher for this specific course/unit
            const isAuthorizedForAssign = (targetUid === uid) || 
                                          (requesterRole === 'admin') || 
                                          (requesterRole === 'teacher' && (assignmentTeacher === requesterEmail || authorizedCourseIds.includes(mappedCid)));

            if (isAuthorizedForAssign && (requesterRole === 'admin' || requesterRole === 'teacher' || usersMap[targetUid])) {
                result.assignments.push({
                    id: doc.id,
                    ...data,
                    courseId: mappedCid, // Uniform ID
                    studentEmail: usersMap[targetUid]?.email || data.userEmail || 'Unknown'
                });
            }
        });

        // Summary (Only count students with successful orders)
        const paidStudentStats = result.students.filter(s => s.accountStatus === 'paid' && s.role === 'student');

        result.summary = {
            totalStudents: paidStudentStats.length,
            totalHours: paidStudentStats.reduce((acc, curr) => acc + curr.totalTime, 0) / 3600
        };

        result.lessons = lessons; // [NEW] Backend fallback for frontend loadLessons() failures
        return result;

    } catch (error) {
        console.error("Dashboard Data Error:", error);
        throw new HttpsError('internal', 'Failed to fetch dashboard data.');
    }
});

// [TEMP] ONE-OFF CLEANUP: Delete all PAGE_VIEW logs
exports.cleanupPageViews = onCall(async (request) => {
    const { auth } = request;
    if (!auth || (auth.token.role !== 'admin' && auth.token.email !== 'rover.k.chen@gmail.com')) {
        throw new HttpsError('permission-denied', 'Only admin can run cleanup.');
    }

    const db = admin.firestore();
    const batchSize = 400;
    let totalDeleted = 0;

    async function deleteBatch() {
        const snapshot = await db.collection('activity_logs')
            .where('action', '==', 'PAGE_VIEW')
            .limit(batchSize)
            .get();

        if (snapshot.empty) return 0;

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        console.log(`[Cleanup] Deleted ${snapshot.size} PAGE_VIEW logs.`);
        return snapshot.size;
    }

    try {
        let deletedCount;
        do {
            deletedCount = await deleteBatch();
            totalDeleted += deletedCount;
            // Add a small delay between batches to avoid overloading
            if (deletedCount > 0) await new Promise(r => setTimeout(r, 200));
        } while (deletedCount > 0);

        return { success: true, totalDeleted };
    } catch (err) {
        console.error("[Cleanup] Error:", err);
        throw new HttpsError('internal', err.message);
    }
});

// 8.0 指派學生給老師 (Admin/Teacher)
exports.assignStudentToTeacher = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    if (requesterRole !== 'admin') {
        throw new HttpsError('permission-denied', '僅限管理員執行此操作');
    }

    const { studentUid, unitId, teacherEmail } = data;
    if (!studentUid) throw new HttpsError('invalid-argument', '缺少學生 ID');
    if (!unitId) throw new HttpsError('invalid-argument', '缺少單元 ID');

    try {
        await upsertStudentUnitAssignment(admin.firestore(), studentUid, unitId, teacherEmail || null, uid, true);

        return { success: true };
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

// ==========================================
// 8. 作業系統 (Assignment System)
// ==========================================

// 8.1 繳交作業 (Student)
exports.submitAssignment = onCall(async (request) => {
    const { data, auth } = request;
    // 1. Verify Auth
    if (!auth) {
        throw new HttpsError('unauthenticated', '請先登入');
    }

    const { courseId, unitId, assignmentId, url, note, title, status, assignmentType } = data;
    const userId = auth.uid;
    const userEmail = auth.token.email || "Unknown";
    const userName = auth.token.name || userEmail.split('@')[0];

    // Simple validation (unless just starting)
    const currentStatus = status || "submitted";
    if (!url && currentStatus !== 'started') {
        throw new HttpsError('invalid-argument', '請提供作業連結 (GitHub / Demo)');
    }

    const db = admin.firestore();
    // Unique ID for the submission
    const docId = `${userId}_${assignmentId}`;
    const docRef = db.collection('assignments').doc(docId);

    try {
        const lessons = await getLessons();
        const access = await resolveStudentAssignmentAccess(db, userId, courseId, unitId, lessons);
        if (!access.authorized) {
            throw new HttpsError('permission-denied', '尚未完成此課程付款授權。');
        }

        const assignedTeacherEmail = access.assignedTeacherEmail || null;
        if (access.requiresTeacherAssignment && !assignedTeacherEmail) {
            throw new HttpsError('failed-precondition', '此單元尚未完成老師指派，暫時無法建立作業紀錄。');
        }

        // [NEW] Prevent status downgrade
        const existingDoc = await docRef.get();
        let finalStatus = currentStatus;
        if (existingDoc.exists) {
            const existingData = existingDoc.data();
            const existingStatus = existingData.currentStatus || existingData.status;
            if ((existingStatus === 'submitted' || existingStatus === 'graded') && currentStatus === 'started') {
                finalStatus = existingStatus; // Keep the higher status
                console.log(`[submitAssignment] Status downgrade prevented for ${docId}: ${existingStatus} (existing) vs ${currentStatus} (new)`);
            }
        }

        const now = admin.firestore.Timestamp.now();
        const submittedAtISO = new Date().toISOString();

        const historyEntry = {
            timestamp: submittedAtISO,
            url: url || "",
            note: note || '',
            action: currentStatus === 'started' ? 'START' : 'SUBMIT'
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
            submissionUrl: url || "",
            studentNote: note || "",
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: finalStatus,
            currentStatus: finalStatus, // Consistency with gradeAssignment
            assignmentType: assignmentType || "manual",
            assignedTeacherEmail: assignedTeacherEmail,
            grade: null,
            teacherFeedback: null,
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (existingDoc.exists && finalStatus !== currentStatus) {
            // If we prevented a downgrade, only update the history and updatedAt
            await docRef.update({
                submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await docRef.set(assignmentData, { merge: true });
        }

        // Notify Teacher ONLY on final submission and only when a teacher is assigned
        if (currentStatus === 'submitted' && assignedTeacherEmail) {
            const dashboardUrl = `https://vibe-coding.tw/dashboard.html?courseId=${encodeURIComponent(access.effectiveCourseId)}&unitId=${encodeURIComponent(access.canonicalUnitId)}&tab=assignments`;
            await sendAssignmentNotification(assignedTeacherEmail, userName, assignmentData.assignmentTitle, dashboardUrl);
        }

        return { success: true, message: currentStatus === 'started' ? "紀錄已更新" : "作業繳交成功！" };

    } catch (e) {
        console.error("Submit Assignment Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

// 8.2 評改作業 (Teacher/Admin)
exports.gradeAssignment = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) throw new HttpsError('unauthenticated', 'Must be logged in.');

    // Check Role
    const role = await getRole(auth.uid);
    if (role !== 'admin' && role !== 'teacher') {
        throw new HttpsError('permission-denied', 'Only teachers can grade.');
    }

    const { assignmentId, grade, feedback } = data;
    // assignmentId should include uid, e.g., "UID_COURSE_UNIT"

    const db = admin.firestore();
    const docRef = db.collection('assignments').doc(assignmentId);

    try {
        const assignDoc = await docRef.get();
        if (!assignDoc.exists) throw new HttpsError('not-found', 'Assignment not found.');

        const assignData = assignDoc.data();
        if (role !== 'admin' && assignData.assignedTeacherEmail !== auth.token.email) {
            throw new HttpsError('permission-denied', 'Only the assigned teacher can grade this assignment.');
        }

        const historyEntry = {
            timestamp: admin.firestore.Timestamp.now(),
            content: `Grade: ${grade}, Feedback: ${feedback}`,
            action: 'GRADE',
            grader: auth.uid
        };

        await docRef.update({
            grade: Number(grade),
            teacherFeedback: feedback,
            currentStatus: 'graded',
            updatedAt: admin.firestore.Timestamp.now(),
            submissionHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });

        // Notify Student
        const studentEmail = assignData.userEmail;
        const studentName = assignData.userName || studentEmail.split('@')[0];
        const title = assignData.assignmentTitle || "您的作業";

        if (studentEmail) {
            const dashboardUrl = `https://vibe-coding.tw/dashboard.html?courseId=${encodeURIComponent(assignData.courseId)}&unitId=${encodeURIComponent(assignData.unitId)}&tab=assignments`;
            await sendGradingNotification(studentEmail, studentName, title, Number(grade), feedback, dashboardUrl);
        }

        return { success: true };
    } catch (e) {
        console.error("Grade Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', 'Grading failed.');
    }
});

// ==========================================
// 8. 新用戶歡迎信 (onUserCreated)
// ==========================================
exports.onUserCreated = functionsV1.region(REGION).auth.user().onCreate(async (user) => {
    const email = user.email;
    const displayName = user.displayName;
    const uid = user.uid;

    const db = admin.firestore();

    // 1. Create a basic Firestore record so the user appears in the dashboard
    try {
        const userRef = db.collection('users').doc(uid);
        const doc = await userRef.get();
        if (!doc.exists) {
            await userRef.set({
                email: email || "",
                name: displayName || "",
                role: 'student',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`[onUserCreated] Initialized Firestore record for user ${uid} (${email})`);
        }
    } catch (e) {
        console.error(`[onUserCreated] Failed to initialize Firestore record for ${uid}:`, e);
    }

    // 2. Send Welcome Email
    if (email) {
        // Calculate expiry date (30 days from now)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        const expiryDateStr = expiryDate.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await sendWelcomeEmail(email, displayName, expiryDateStr);
    }
});

// ==========================================
// 9. 試用期到期提醒 (checkTrialExpiration)
// ==========================================
// Run every day at 12:00 PM Asia/Taipei
exports.checkTrialExpiration = onSchedule({
    schedule: '0 12 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
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
// 9.5 課程到期提醒 (checkCourseExpiration)
// ==========================================
// Run every day at 10:00 AM Asia/Taipei
exports.checkCourseExpiration = onSchedule({
    schedule: '0 10 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
    const db = admin.firestore();
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;
    const buffer = 2 * 24 * 60 * 60 * 1000; // Look for anything expiring in the next 9 days roughly

    try {
        // Query for successful orders that haven't expired yet but are near.
        // We limit to 500 orders per run for safety.
        const snapshot = await db.collection("orders")
            .where("status", "==", "SUCCESS")
            .limit(1000)
            .get();

        const results = [];
        for (const doc of snapshot.docs) {
            const orderData = doc.data();
            if (!orderData.expiryDate || !orderData.uid) continue;

            const expiryTime = orderData.expiryDate.toDate().getTime();
            const diff = expiryTime - now;

            let warningType = null;
            let daysLeft = 0;

            // Window check (around 7 days)
            if (diff > SEVEN_DAYS_MS - 43200000 && diff <= SEVEN_DAYS_MS + 43200000) { // +/- 12 hours
                if (!orderData.warning7Sent) {
                    warningType = "7DAY";
                    daysLeft = 7;
                }
            }
            // Window check (around 1 day)
            else if (diff > ONE_DAY_MS - 43200000 && diff <= ONE_DAY_MS + 43200000) {
                if (!orderData.warning1Sent) {
                    warningType = "1DAY";
                    daysLeft = 1;
                }
            }

            if (warningType) {
                try {
                    // Fetch user email and name
                    const userRecord = await admin.auth().getUser(orderData.uid);
                    const email = userRecord.email;
                    const displayName = userRecord.displayName || email.split('@')[0];

                    if (email) {
                        // Get Course Name from items
                        const itemNames = Object.values(orderData.items || {}).map(i => i.name).join(', ') || "Vibe Coding 課程";

                        console.log(`Sending ${warningType} course warning to ${email} for course: ${itemNames}`);
                        await sendCourseExpiringEmail(email, displayName, itemNames, daysLeft);

                        // Mark as sent in Firestore
                        const updateData = {};
                        if (warningType === "7DAY") updateData.warning7Sent = true;
                        if (warningType === "1DAY") updateData.warning1Sent = true;
                        await doc.ref.update(updateData);

                        results.push({ email, warningType });
                    }
                } catch (e) {
                    console.error(`Failed to process warning for order ${doc.id}:`, e);
                }
            }
        }
        console.log(`Course expiration check completed. Sent ${results.length} notifications.`);
    } catch (error) {
        console.error("Error in checkCourseExpiration:", error);
    }
});

// ==========================================
// 8.6 管理員指派提醒 (remindAdminPendingAssignments)
// ==========================================
// Run every day at 9:00 AM Asia/Taipei
exports.remindAdminPendingAssignments = onSchedule({
    schedule: '0 9 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
    const db = admin.firestore();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    if (!adminEmail) return;

    try {
        // 1. Get all successful orders
        const ordersSnapshot = await db.collection('orders').where('status', '==', 'SUCCESS').get();
        const pendingMap = new Map(); // uid -> Set of unitIds

        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid && data.items) {
                Object.keys(data.items).forEach(unitId => {
                    if (!pendingMap.has(data.uid)) pendingMap.set(data.uid, new Set());
                    pendingMap.get(data.uid).add(unitId);
                });
            }
        });

        // 2. Cross-reference with user assignments
        const uids = Array.from(pendingMap.keys());
        const pendingAssignments = [];

        // Chunking UID list due to Firestore 'in' limit
        for (let i = 0; i < uids.length; i += 10) {
            const chunk = uids.slice(i, i + 10);
            const usersSnapshot = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();

            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const uid = doc.id;
                const requiredUnits = pendingMap.get(uid);
                const assignedUnits = userData.unitAssignments || {};

                const unassigned = Array.from(requiredUnits).filter(unitId => !assignedUnits[unitId]);

                if (unassigned.length > 0) {
                    pendingAssignments.push({
                        email: userData.email || '未提供電子郵件',
                        units: unassigned
                    });
                }
            });
        }

        // 3. Send summary to admin if there are pending tasks
        if (pendingAssignments.length > 0) {
            console.log(`Found ${pendingAssignments.length} users with pending assignments. Notifying admin.`);
            await sendAdminAssignmentReminder(adminEmail, pendingAssignments);
        } else {
            console.log("No pending teacher assignments found.");
        }

    } catch (error) {
        console.error("Error in remindAdminPendingAssignments:", error);
    }
});

// ==========================================
// 10. 電子地圖回傳 (mapReply)
// ==========================================
exports.mapReply = onRequest((req, res) => {
    // EcPay sends data via POST
    if (req.method !== 'POST') {
        // Default to redirecting home if accessed via GET
        return res.redirect('https://vibe-coding.tw/cart.html');
    }

    try {
        const { CVSStoreID, CVSStoreName, CVSAddress, ExtraData } = req.body;
        console.log("Map Reply Received:", CVSStoreID, CVSStoreName);

        // Redirect user back to cart with store info
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

// ==========================================
// 11. 利潤分享架構 (Profit Sharing)
// ==========================================

// 11.1 驗證優惠代碼 (verifyPromoCode)
exports.verifyPromoCode = onCall(async (request) => {
    const { data } = request;
    const { promoCode } = data;
    if (!promoCode) throw new HttpsError('invalid-argument', '缺少代碼');

    try {
        const db = admin.firestore();
        const promoDoc = await db.collection('promo_codes').doc(promoCode.toUpperCase()).get();
        if (!promoDoc.exists) {
            return { success: false, message: '無效的代碼' };
        }

        const promoData = promoDoc.data();
        if (promoData.isActive === false) {
            return { success: false, message: '此代碼已停用' };
        }

        return { 
            success: true, 
            mentor: promoData.mentorEmail,
            mentorName: promoData.mentorName || promoData.mentorEmail
        };
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

// 11.1.5 生成個人推薦代碼 (generatePromoCode)
/**
 * Internal helper to get or create a unique 6-digit alphanumeric promo code for a mentor/unit.
 * @param {admin.firestore.Firestore} db - Firestore instance
 * @param {string} email - Mentor Email
 * @param {string} courseId - Course Unit ID (e.g., 01-unit-vscode.html)
 * @param {string} mentorName - Mentor Display Name
 * @returns {Promise<string>} - The unique promo code
 */
async function internalGetOrCreatePromoCode(db, email, courseId, mentorName) {
    if (!email || !courseId) throw new Error("Missing email or courseId for promo code generation");

    // 1. Check for existing code for this mentor-unit pair
    const existingSnap = await db.collection('promo_codes')
        .where('mentorEmail', '==', email)
        .where('courseId', '==', courseId)
        .limit(1)
        .get();

    if (!existingSnap.empty) {
        console.log(`[Promo] Found existing code ${existingSnap.docs[0].id} for ${email} / ${courseId}`);
        return existingSnap.docs[0].id;
    }

    // 2. Generate a Unique 6-character Alphanumeric Code
    const generateId = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    let newCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
        newCode = generateId();
        const checkDoc = await db.collection('promo_codes').doc(newCode).get();
        if (!checkDoc.exists) isUnique = true;
        attempts++;
    }

    if (!isUnique) throw new Error('無法生成唯一代碼，請稍後再試');

    // 3. Save to Firestore
    await db.collection('promo_codes').doc(newCode).set({
        mentorEmail: email,
        mentorName: mentorName || email,
        courseId: courseId,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'automated_auth'
    });

    console.log(`[Promo] Generated NEW code ${newCode} for ${email} / ${courseId}`);
    return newCode;
}

exports.generatePromoCode = onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    const db = admin.firestore();
    const uid = auth.uid;
    const email = auth.token.email;
    const { courseId } = data;

    if (!courseId) throw new HttpsError('invalid-argument', '缺少課程單元 ID (courseId)');

    try {
        const role = await getRole(uid);
        if (role !== 'admin' && role !== 'teacher') {
            throw new HttpsError('permission-denied', '只有老師可以生成推廣代碼');
        }

        const userDoc = await db.collection('users').doc(uid).get();
        const mentorName = userDoc.exists ? (userDoc.data().name || userDoc.data().displayName) : email;

        const promoCode = await internalGetOrCreatePromoCode(db, email, courseId, mentorName);
        return { success: true, promoCode };

    } catch (e) {
        console.error("[Promo] Error:", e);
        throw new HttpsError('internal', e.message);
    }
});

// 11.2 每月計算分潤 (Scheduled Job - 1st of each month)
exports.calculateMonthlySharing = onSchedule("0 0 1 * *", async (event) => {
    const db = admin.firestore();
    const now = new Date();
    // Calculate for the previous month
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    console.log(`Starting profit sharing calculation for: ${lastMonth.toISOString()} to ${endOfLastMonth.toISOString()}`);

    try {
        // 1. Find all successful orders in the last month that have referral info
        const ordersSnapshot = await db.collection('orders')
            .where('status', '==', 'SUCCESS')
            .where('paidAt', '>=', admin.firestore.Timestamp.fromDate(lastMonth))
            .where('paidAt', '<=', admin.firestore.Timestamp.fromDate(endOfLastMonth))
            .get();

        if (ordersSnapshot.empty) {
            console.log("No successful orders found for sharing this month.");
            return;
        }

        const auditTrail = [];

        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            // [MOD] Default to admin if no mentor is provided
            const initialMentor = (order.referralMentor && order.referralMentor.trim()) ? order.referralMentor.trim() : "info@vibe-coding.tw";

            const amount = order.amount;
            const orderId = orderDoc.id;
            const studentUid = order.uid;

            // Recursive Chain Calculation
            let currentMentorEmail = initialMentor;
            let currentShare = amount * 0.2; // First level: 20%
            let level = 1;

            while (currentMentorEmail && currentShare >= 0.01) {
                // Record Share
                const ledgerRef = db.collection('profit_ledger').doc();
                const shareRecord = {
                    mentorEmail: currentMentorEmail,
                    studentUid: studentUid,
                    orderId: orderId,
                    orderAmount: amount,
                    shareAmount: Math.round(currentShare * 100) / 100, // Round to 2 decimals
                    level: level,
                    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    period: `${lastMonth.getFullYear()}-${(lastMonth.getMonth() + 1).toString().padStart(2, '0')}`
                };
                await ledgerRef.set(shareRecord);
                auditTrail.push(shareRecord);

                // Stop if we hit the root admin
                if (currentMentorEmail === "info@vibe-coding.tw") break;

                // Move up the chain
                const mentorUserSnapshot = await db.collection('users').where('email', '==', currentMentorEmail).limit(1).get();
                if (!mentorUserSnapshot.empty) {
                    const mentorData = mentorUserSnapshot.docs[0].data();
                    currentMentorEmail = mentorData.mentorEmail || "info@vibe-coding.tw"; // Fallback to admin
                    currentShare = currentShare * 0.2; // Next level: 20% of previous share
                    level++;
                } else {
                    // Mentor not found in users collection, fallback to admin
                    currentMentorEmail = "info@vibe-coding.tw";
                    currentShare = currentShare * 0.2;
                    level++;
                }
            }
        }

        console.log(`Profit sharing completed. Recorded ${auditTrail.length} share entries.`);
    } catch (error) {
        console.error("Error in calculateMonthlySharing:", error);
    }
});
