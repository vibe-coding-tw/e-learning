const admin = require("firebase-admin");
const crypto = require("crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { normalizeText, isAdminEmail, lookupAuthUserEmailByUid } = require("vibe-functions-core/access-utils-core");
const { normalizeAmount } = require("./pricing-utils");
const { getUserDistributorScope } = require("vibe-functions-core/distributor-utils-core");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const APP_BASE_URL = (process.env.APP_BASE_URL || "https://vibe-coding.tw").replace(/\/+$/, "");
const PROJECT_ID = (() => {
    try {
        return JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId || process.env.GCLOUD_PROJECT || "e-learning-942f7";
    } catch (_) {
        return process.env.GCLOUD_PROJECT || "e-learning-942f7";
    }
})();

const MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || "";
const HASH_KEY = process.env.ECPAY_HASH_KEY || "";
const HASH_IV = process.env.ECPAY_HASH_IV || "";
const ECPAY_CHECK_MAC_ALGO = (process.env.ECPAY_CHECK_MAC_ALGO || "sha256").trim().toLowerCase() === "md5" ? "md5" : "sha256";
const ECPAY_API_URL = process.env.ECPAY_API_URL || "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5";
const ECPAY_LOGISTICS_MAP_URL = process.env.ECPAY_LOGISTICS_MAP_URL || "https://logistics.ecpay.com.tw/Express/map";
const SERVE_TOKEN_SECRET = process.env.SERVE_COURSE_TOKEN_SECRET || HASH_KEY || HASH_IV || PROJECT_ID;
const cloudFunctionUrl = (functionName) => `https://asia-east1-${PROJECT_ID}.cloudfunctions.net/${functionName}`;

function normalizeUpper(value = "") {
    return normalizeText(value).toUpperCase();
}

function nowTaipeiDateTime() {
    const now = new Date();
    const offset = 8;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const date = new Date(utc + (3600000 * offset));
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function getRole(uid, fallbackEmail = "") {
    return db.collection("users").doc(uid).get().then((userDoc) => {
        if (userDoc.exists) {
            const userData = userDoc.data() || {};
            if (isAdminEmail(userData.email || fallbackEmail)) return "admin";
            const role = userData.role;
            return role === "admin" ? "admin" : "user";
        }
        return lookupAuthUserEmailByUid(uid).then((authEmail) => {
            if (isAdminEmail(fallbackEmail || authEmail)) return "admin";
            return "user";
        });
    }).catch((err) => {
        console.error("[payment] Error in getRole:", err);
        return "user";
    });
}

function assertDistributorScope(userData = {}, requestedDistributorId = "", message = "僅限該經銷商執行此操作") {
    if (isAdminEmail(userData?.email) || (userData || {}).role === "admin") return;
    const ownDistributorId = getUserDistributorScope(userData);
    if (ownDistributorId && requestedDistributorId && ownDistributorId === requestedDistributorId) return;
    throw new HttpsError("permission-denied", message);
}

function assertAdminRole(requesterRole, message = "僅限管理員執行此操作") {
    if (requesterRole !== "admin") {
        throw new HttpsError("permission-denied", message);
    }
}

function encodeSpecialChars(str) {
    return encodeURIComponent(str)
        .toLowerCase()
        .replace(/%20/g, "+")
        .replace(/%2d/g, "-")
        .replace(/%5f/g, "_")
        .replace(/%2e/g, ".")
        .replace(/%21/g, "!")
        .replace(/%2a/g, "*")
        .replace(/%28/g, "(")
        .replace(/%29/g, ")");
}

function buildCheckMacSourceString(params = {}, hashKey = "", hashIV = "") {
    const normalized = {};
    Object.keys(params || {}).forEach((key) => {
        const value = params[key];
        // 僅排除 CheckMacValue 和 undefined/null；空字串必須保留（綠界會計算空值參數的 hash）
        if (key === "CheckMacValue" || value === undefined || value === null) return;
        normalized[key] = value;
    });

    // 綠界要求不區分大小寫排序（自然排序）
    const sortedKeys = Object.keys(normalized).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return `HashKey=${hashKey}&${sortedKeys.map((key) => `${key}=${String(normalized[key])}`).join("&")}&HashIV=${hashIV}`;
}

function generateCheckMacValue(params, hashKey, hashIV, encType = "md5") {
    const rawString = buildCheckMacSourceString(params, hashKey, hashIV);
    const encoded = encodeSpecialChars(rawString);
    return crypto.createHash(encType).update(encoded).digest("hex").toUpperCase();
}

function buildServeToken(payload = {}) {
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = crypto.createHmac("sha256", SERVE_TOKEN_SECRET).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyServeToken(token = "") {
    const raw = String(token || "").trim();
    if (!raw) return null;
    const [body, sig] = raw.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", SERVE_TOKEN_SECRET).update(body).digest("base64url");
    if (expected !== sig) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        if (payload?.exp && Number(payload.exp) < Date.now()) {
            return null;
        }
        return payload;
    } catch (_) {
        return null;
    }
}

function buildEcpayPaymentParams({
    orderId,
    amount,
    currency,
    itemNames = [],
    returnUrl = "",
    clientBackUrl = "",
    logistics = {},
    locale = "zh-TW",
    userId = ""
} = {}) {
    const params = {
        MerchantID: MERCHANT_ID,
        MerchantTradeNo: orderId,
        MerchantTradeDate: nowTaipeiDateTime(),
        PaymentType: "aio",
        TotalAmount: String(Math.max(0, Math.round(Number(amount || 0)))),
        TradeDesc: locale.startsWith("en") ? "Vibe Coding Course Payment" : "Vibe Coding 課程付款",
        ItemName: itemNames.length > 0 ? itemNames.join("#") : (locale.startsWith("en") ? "Vibe Coding Course" : "Vibe Coding 課程"),
        ReturnURL: returnUrl,
        ChoosePayment: "ALL",
        OrderResultURL: clientBackUrl,
        ClientBackURL: clientBackUrl,
        EncryptType: ECPAY_CHECK_MAC_ALGO === "sha256" ? "1" : "0",
        CustomField1: userId,
        CustomField2: normalizeText(currency || "TWD"),
        CustomField3: normalizeText(logistics?.storeId || logistics?.carrier || ""),
        CustomField4: normalizeText(logistics?.isInternational ? "INTERNATIONAL" : "DOMESTIC"),
    };

    params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV, ECPAY_CHECK_MAC_ALGO);
    return params;
}

function buildLogisticsMapParams({
    logisticsSubType = "FAMI",
    isCollection = "N",
    userId = "",
    orderId = ""
} = {}) {
    const params = {
        MerchantID: MERCHANT_ID,
        MerchantTradeNo: orderId || `MAP${Date.now()}`,
        MerchantTradeDate: nowTaipeiDateTime(),
        LogisticsType: "CVS",
        LogisticsSubType: normalizeText(logisticsSubType) || "FAMI",
        IsCollection: normalizeText(isCollection) || "N",
        ServerReplyURL: `https://asia-east1-${PROJECT_ID}.cloudfunctions.net/mapReply`,
        ExtraData: JSON.stringify({
            userId,
            createdAt: new Date().toISOString()
        })
    };
    params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV, "md5");
    return params;
}

async function loadUserProfile(uid = "", email = "") {
    if (!uid && !email) return null;

    const byUid = uid ? await db.collection("users").doc(uid).get() : null;
    if (byUid?.exists) return { uid: byUid.id, ...(byUid.data() || {}) };

    if (email) {
        const snap = await db.collection("users").where("email", "==", normalizeText(email)).limit(1).get();
        if (!snap.empty) {
            const doc = snap.docs[0];
            return { uid: doc.id, ...(doc.data() || {}) };
        }
    }

    return null;
}

function isQualifiedTutorUser(userData = {}) {
    return isAdminEmail(userData.email) || userData.role === "admin"
        || userData.isQualifiedTutor === true
        || userData.qualifiedTutor === true
        || Object.keys(userData.tutorConfigs || {}).length > 0;
}

module.exports = {
    APP_BASE_URL,
    PROJECT_ID,
    MERCHANT_ID,
    HASH_KEY,
    HASH_IV,
    ECPAY_CHECK_MAC_ALGO,
    ECPAY_API_URL,
    ECPAY_LOGISTICS_MAP_URL,
    SERVE_TOKEN_SECRET,
    normalizeText,
    normalizeUpper,
    normalizeAmount,
    nowTaipeiDateTime,
    getRole,
    assertDistributorScope,
    assertAdminRole,
    encodeSpecialChars,
    buildCheckMacSourceString,
    generateCheckMacValue,
    buildServeToken,
    verifyServeToken,
    buildEcpayPaymentParams,
    buildLogisticsMapParams,
    loadUserProfile,
    isQualifiedTutorUser,
    cloudFunctionUrl
};
