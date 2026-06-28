// ⚠️ dotenv 必須在所有讀取 process.env 的模組之前載入
if (process.env.NODE_ENV !== "production" || !process.env.ECPAY_MERCHANT_ID) {
    require("dotenv").config();
}

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
global.__vibeFirebaseAdmin = admin;
const crypto = require("crypto");

const {
    normalizeCurrency
} = require("./lib/pricing-utils");
const {
    resolveCartPrice
} = require("./lib/pricing-utils");
const {
    APP_BASE_URL,
    PROJECT_ID,
    HASH_KEY,
    HASH_IV,
    ECPAY_CHECK_MAC_ALGO,
    ECPAY_API_URL,
    ECPAY_LOGISTICS_MAP_URL,
    normalizeText,
    normalizeUpper,
    nowTaipeiDateTime,
    getRole,
    assertDistributorScope,
    assertAdminRole,
    buildCheckMacSourceString,
    generateCheckMacValue,
    buildServeToken,
    verifyServeToken,
    buildEcpayPaymentParams,
    buildLogisticsMapParams,
    cloudFunctionUrl
} = require("./lib/payment-core");
const {
    normalizeLogisticsData,
} = require("vibe-functions-core/order-utils");
const {
    sendPaymentSuccessEmail,
    sendOrderShippedEmail
} = require("vibe-functions-core/email-service");
const contentRuntime = require("./lib/content-runtime");
const {
    getCanonicalLessonIdentity,
    findLessonByCourseRef,
    findCourseByPageOrUnit,
    getLessons,
    normalizeCourseFile
} = contentRuntime;
const paymentOrderFlow = require("./lib/order-flow");
const {
    hasPhysicalOrderItem,
    buildOrderItemsDescription
} = require("./lib/order-display");

if (!admin.apps.length) {
    admin.initializeApp();
}
setGlobalOptions({
    region: "asia-east1",
    maxInstances: 10,
    minInstances: 0,
    memory: 128,
    concurrency: 80
});

const db = admin.firestore();
const financeCallables = require("./lib/finance-callables");
const CONTENT_REPO_TOKEN = defineSecret("CONTENT_REPO_TOKEN");

exports.initiatePayment = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth?.uid) {
        throw new HttpsError("unauthenticated", "請先登入才能進行付款。");
    }

    const {
        amount = 0,
        cartDetails = {},
        logistics = null,
        gateway = "ECPAY",
        returnUrl = `${APP_BASE_URL}/payment-return.html`,
        locale = "zh-TW",
        currency = ""
    } = data || {};

    const normalizedItems = JSON.parse(JSON.stringify(cartDetails || {}));
    const itemNames = [];
    let calculatedAmount = 0;
    let detectedCurrency = normalizeUpper(currency || "");

    for (const [itemId, item] of Object.entries(normalizedItems)) {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const resolvedItemPrice = resolveCartPrice(item);
        const itemAmount = Number(resolvedItemPrice.amount || item.price || item.amount || 0);
        const itemCurrency = normalizeUpper(
            resolvedItemPrice.currency ||
            item.currency ||
            item.price_currency ||
            item.priceCurrency ||
            ""
        );

        if (!detectedCurrency && itemCurrency) {
            detectedCurrency = itemCurrency;
        }

        if (detectedCurrency && itemCurrency && detectedCurrency !== itemCurrency) {
            throw new HttpsError("invalid-argument", "單筆結帳不支援混合幣別。");
        }
        detectedCurrency = itemCurrency || detectedCurrency;

        calculatedAmount += itemAmount * quantity;
        itemNames.push(`${item.name || item.title || itemId}x${quantity}`);
    }

    const finalAmount = Math.max(0, Math.round(Number(amount || calculatedAmount) || calculatedAmount));
    detectedCurrency = normalizeUpper(detectedCurrency || currency || "TWD");
    const hasPhysical = hasPhysicalOrderItem(normalizedItems);
    const logisticsInfo = hasPhysical ? normalizeLogisticsData(logistics || {}) : null;

    if (hasPhysical && !logisticsInfo.isComplete) {
        throw new HttpsError("invalid-argument", "請完整填寫實體商品的收件資訊。");
    }

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
        throw new HttpsError("invalid-argument", "結帳金額無效，請重新整理購物車後再試一次。");
    }

    const orderId = `VC${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
    const orderData = {
        uid: auth.uid,
        email: auth.token?.email || "",
        amount: finalAmount,
        currency: detectedCurrency || "TWD",
        status: "PENDING",
        gateway: normalizeUpper(gateway) === "STRIPE" ? "STRIPE" : "ECPAY",
        locale,
        items: normalizedItems,
        logistics: logisticsInfo || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        returnUrl,
        tradeDesc: "Vibe Coding Order"
    };

    await db.collection("orders").doc(orderId).set(orderData, { merge: true });

    if (orderData.gateway === "STRIPE") {
        return {
            gateway: "STRIPE",
            orderId,
            sessionUrl: `${APP_BASE_URL}/payment-return.html?orderId=${encodeURIComponent(orderId)}&gateway=STRIPE`
        };
    }

    const paymentParams = buildEcpayPaymentParams({
        orderId,
        amount: finalAmount,
        currency: detectedCurrency,
        itemNames,
        returnUrl: cloudFunctionUrl("paymentNotify"),
        clientBackUrl: returnUrl,
        logistics: logisticsInfo || {},
        locale,
        userId: auth.uid
    });

    const paymentCheckMacSource = buildCheckMacSourceString(paymentParams, HASH_KEY, HASH_IV);
    logger.info("[initiatePayment] payment payload snapshot", JSON.stringify({
        orderId,
        amount: finalAmount,
        currency: detectedCurrency,
        gateway: orderData.gateway,
        ecpayEncryptType: ECPAY_CHECK_MAC_ALGO === "sha256" ? "1" : "0",
        paymentParams,
        paymentCheckMacSource
    }));

    await db.collection("orders").doc(orderId).set({
        paymentParamsSnapshot: paymentParams,
        paymentCheckMacSource,
        paymentApiUrl: ECPAY_API_URL,
        paymentGateway: "ECPAY"
    }, { merge: true });

    return {
        gateway: "ECPAY",
        orderId,
        paymentParams,
        apiUrl: ECPAY_API_URL
    };
});

exports.getLogisticsMapParams = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth?.uid) {
        throw new HttpsError("unauthenticated", "請先登入。");
    }

    const params = buildLogisticsMapParams({
        logisticsSubType: data?.logisticsSubType || "FAMI",
        isCollection: data?.isCollection || "N",
        userId: auth.uid,
        orderId: data?.orderId || ""
    });

    return {
        params,
        apiUrl: ECPAY_LOGISTICS_MAP_URL
    };
});

exports.checkPaymentAuthorization = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth?.uid) {
        throw new HttpsError("unauthenticated", "請先登入。");
    }

    const docId = normalizeText(data?.docId || "");
    const pageId = normalizeText(data?.pageId || docId);
    const fileName = normalizeText(data?.fileName || "");
    const price = Number(data?.price || 0);
    const currency = normalizeCurrency(data?.currency || "TWD", "TWD");
    const tutorMode = data?.tutorMode === true || data?.tutorMode === "true" || data?.tutorMode === 1 || data?.tutorMode === "1";

    const lessons = await getLessons(db, { currencyHint: currency });
    const lesson = findCourseByPageOrUnit(pageId, fileName, lessons)
        || findLessonByCourseRef(pageId, lessons)
        || findLessonByCourseRef(fileName, lessons);
    logger.info("[checkPaymentAuthorization] lookup", {
        uid: auth.uid,
        docId,
        pageId,
        fileName,
        lessonId: lesson?.id || lesson?.docId || lesson?.courseId || "",
        category: lesson?.category || "",
        level: lesson?.level || "",
        units: Array.isArray(lesson?.courseUnits) ? lesson.courseUnits.length : 0,
        courseUnits: JSON.stringify(Array.isArray(lesson?.courseUnits) ? lesson.courseUnits : [])
    });
    if (!lesson && !pageId && !fileName) {
        return { authorized: false, reason: "missing-context" };
    }

    const courseId = docId || pageId || getCanonicalLessonIdentity(lesson) || fileName;
    const access = await paymentOrderFlow.checkOrderAccessForUnit(
        db,
        auth.uid,
        courseId,
        fileName || pageId,
        lessons,
        tutorMode,
        auth.token?.email || ""
    );
    logger.info("[checkPaymentAuthorization] access", {
        uid: auth.uid,
        docId,
        courseId,
        fileName,
        authorized: access?.authorized === true,
        reason: access?.reason || "",
        accessMode: access?.accessMode || ""
    });
    if (access.authorized) {
        const token = buildServeToken({
            uid: auth.uid,
            pageId: courseId,
            fileName,
            currency,
            mode: access.accessMode === "tutor"
                ? "tutor"
                : (access.accessMode === "trial_course" || access.accessMode === "free" ? access.accessMode : "paid"),
            exp: Date.now() + 60 * 60 * 1000
        });
        return {
            authorized: true,
            token,
            reason: access.reason || "active-order",
            accessMode: access.accessMode || "paid"
        };
    }

    return {
        authorized: false,
        reason: "payment-required"
    };
});

exports.paymentNotify = onRequest(async (req, res) => {
    try {
        const payload = typeof req.body === "string" ? Object.fromEntries(new URLSearchParams(req.body)) : (req.body || {});
        const orderId = normalizeText(payload.MerchantTradeNo || payload.merchantTradeNo || payload.orderId || "");
        if (!orderId) {
            return res.status(400).send("0|Missing order id");
        }

        if (HASH_KEY && HASH_IV && payload.CheckMacValue) {
            const expectedAlgos = ECPAY_CHECK_MAC_ALGO === "sha256"
                ? ["sha256", "md5"]
                : ["md5", "sha256"];
            const expected = expectedAlgos.find((algo) => generateCheckMacValue(payload, HASH_KEY, HASH_IV, algo) === payload.CheckMacValue);
            if (!expected) {
                return res.status(400).send("0|Invalid CheckMacValue");
            }
        }

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            return res.status(404).send("0|Order not found");
        }

        const rtnCode = String(payload.RtnCode || payload.rtnCode || payload.TradeStatus || payload.tradeStatus || "");
        const success = rtnCode === "1" || rtnCode === "SUCCESS" || rtnCode === "Completed" || rtnCode === "COMPLETED";
        const patch = {
            paymentGateway: "ECPAY",
            paymentPayload: payload,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (success) {
            patch.status = "SUCCESS";
            patch.paidAt = admin.firestore.FieldValue.serverTimestamp();
            patch.paymentDate = admin.firestore.FieldValue.serverTimestamp();
            patch.ecpayTradeNo = payload.TradeNo || payload.tradeNo || "";
            patch.paymentStatus = "SUCCESS";
        } else {
            patch.status = "FAILED";
            patch.paymentStatus = "FAILED";
        }

        await orderRef.set(patch, { merge: true });

        if (success) {
            await paymentOrderFlow.activateOrderPermissionsAndNotify(db, orderId, {
                sendPaymentSuccessEmail
            });
        }

        return res.status(200).send("1|OK");
    } catch (error) {
        logger.error("[paymentNotify] failed:", error);
        return res.status(500).send("0|ERROR");
    }
});

exports.paymentUpdateOrderFulfillmentStatus = onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError("unauthenticated", "請先登入");

    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const payload = data || {};

    const orderId = String(payload.orderId || "").trim();
    const fulfillmentStatus = String(payload.fulfillmentStatus || "PENDING").trim().toUpperCase();
    const trackingNumber = String(payload.trackingNumber || "").trim();
    const carrier = String(payload.carrier || "").trim();

    if (!orderId) throw new HttpsError("invalid-argument", "missing-order-id");
    if (!fulfillmentStatus) throw new HttpsError("invalid-argument", "missing-fulfillment-status");

    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
        throw new HttpsError("not-found", "Order not found.");
    }
    const orderData = orderDoc.data() || {};
    const orderDistributorId = normalizeText(orderData.distributorId || orderData.commercial?.distributorId || "");
    assertDistributorScope(userData, orderDistributorId, "僅限該訂單的歸屬經銷商或管理員編輯履約狀態");

    const updateData = {
        fulfillmentStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (fulfillmentStatus === "SHIPPED") {
        updateData.shippedAt = admin.firestore.FieldValue.serverTimestamp();
    }
    const existingLogistics = orderData.logistics || {};
    updateData.logistics = {
        ...existingLogistics,
        ...(trackingNumber ? { trackingNumber } : {}),
        ...(carrier ? { carrier } : {})
    };

    await db.collection("orders").doc(orderId).update(updateData);
    return { success: true, orderId, fulfillmentStatus };
});

exports.paymentMarkOrderShipped = onCall(async (request) => {
    const { orderId } = request.data || {};
    const uid = request.auth?.uid;
    if (!request.auth) throw new HttpsError("unauthenticated", "請先登入");
    if (!orderId) throw new HttpsError("invalid-argument", "缺少訂單編號");

    try {
        const role = await getRole(uid, request.auth?.token?.email || "");
        assertAdminRole(role, "只有管理員可以標記出貨");

        await db.collection("orders").doc(orderId).update({
            fulfillmentStatus: "SHIPPED",
            shippedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        try {
            const orderDoc = await db.collection("orders").doc(orderId).get();
            if (orderDoc.exists) {
                const order = orderDoc.data() || {};
                const studentUid = order.uid;
                if (studentUid && studentUid !== "GUEST") {
                    const userRecord = await admin.auth().getUser(studentUid);
                    const studentEmail = userRecord?.email || "";
                    const items = order.items || {};
                    const itemsDesc = buildOrderItemsDescription(items);
                    await sendOrderShippedEmail(studentEmail, orderId, itemsDesc, order.logistics || {});
                }
            }
        } catch (notifyErr) {
            logger.error(`[paymentMarkOrderShipped] Failed to send shipped email for ${orderId}:`, notifyErr);
        }

        logger.info(`Order ${orderId} marked as SHIPPED by ${uid}`);
        return { success: true };
    } catch (error) {
        logger.error("Error in paymentMarkOrderShipped:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", error.message);
    }
});

exports.stripeWebhook = onRequest(async (req, res) => {
    try {
        const payload = req.body || {};
        const eventType = normalizeText(payload.type || payload.eventType || "");
        const object = payload.data?.object || payload.object || {};
        const orderId = normalizeText(object.metadata?.orderId || object.client_reference_id || payload.orderId || "");
        if (!orderId) {
            return res.status(200).json({ received: true, ignored: true });
        }

        if (eventType && !["checkout.session.completed", "payment_intent.succeeded"].includes(eventType)) {
            return res.status(200).json({ received: true, ignored: true });
        }

        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            return res.status(404).json({ received: false, error: "order_not_found" });
        }

        await orderRef.set({
            status: "SUCCESS",
            paymentGateway: "STRIPE",
            stripePaymentIntentId: object.payment_intent || object.id || "",
            paymentPayload: payload,
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentDate: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await paymentOrderFlow.activateOrderPermissionsAndNotify(db, orderId, {
            sendPaymentSuccessEmail
        });
        return res.status(200).json({ received: true });
    } catch (error) {
        logger.error("[stripeWebhook] failed:", error);
        return res.status(500).json({ received: false, error: error.message || String(error) });
    }
});

exports.serveCourse = onRequest({ secrets: [CONTENT_REPO_TOKEN] }, async (req, res) => {
    let tokenData = null;
    try {
        const requestPath = normalizeText(req.path || req.originalUrl || req.url || "");
        const fileName = normalizeCourseFile(requestPath);
        const isPublicGuide = fileName === "students.html" || fileName === "tutors.html";

        const token = normalizeText(req.query?.token || req.headers["x-course-token"] || "");
        if (isPublicGuide) {
            tokenData = { pageId: fileName, fileName: fileName, mode: "free" };
        } else {
            tokenData = verifyServeToken(token);
            if (!tokenData) {
                return res.status(403).json({ authorized: false, reason: "invalid-token" });
            }
        }

        const result = await contentRuntime.resolveCourseHtml({ dbRef: db, requestPath, tokenData, req });

        if (!result.ok || !result.html) {
            return res.status(404).json({
                authorized: true,
                reason: "content-not-found",
                pageId: tokenData.pageId || "",
                fileName: tokenData.fileName || "",
                mode: tokenData.mode || "paid",
                requestedPath: normalizeText(req.path || req.originalUrl || req.url || "")
            });
        }

        res.status(200);
        res.setHeader("Content-Type", result.contentType || "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        return res.send(contentRuntime.injectCourseRuntimeShell(result.html));
    } catch (error) {
        logger.error("[serveCourse] failed:", error);
        return res.status(500).json({
            authorized: true,
            reason: "content-fetch-failed",
            error: error.message || String(error),
            pageId: tokenData.pageId || "",
            fileName: tokenData.fileName || "",
            mode: tokenData.mode || "paid"
        });
    }
});

module.exports = {
    initiatePayment: exports.initiatePayment,
    getLogisticsMapParams: exports.getLogisticsMapParams,
    paymentNotify: exports.paymentNotify,
    stripeWebhook: exports.stripeWebhook,
    checkPaymentAuthorization: exports.checkPaymentAuthorization,
    serveCourse: exports.serveCourse,
    paymentUpdateOrderFulfillmentStatus: exports.paymentUpdateOrderFulfillmentStatus,
    paymentMarkOrderShipped: exports.paymentMarkOrderShipped,
    ...financeCallables
};
