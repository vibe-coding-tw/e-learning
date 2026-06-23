const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeEmail(value = "") {
    return normalizeText(value).toLowerCase();
}

const CONTROL_ACCESS_EMAILS = new Set(["rover.k.chen@gmail.com"]);

function isControlAccessEmail(email = "") {
    return CONTROL_ACCESS_EMAILS.has(normalizeEmail(email));
}

function isAdminRoleValue(role = "", email = "") {
    return normalizeText(role) === "admin" || isControlAccessEmail(email);
}

function isAdminUserData(userData = {}) {
    return isAdminRoleValue(userData?.role || "", userData?.email || "");
}

function assertAuthenticated(auth, message = "請先登入") {
    if (!auth) throw new HttpsError("unauthenticated", message);
}

function assertRequiredValue(value, message = "缺少必要參數") {
    if (value === undefined || value === null || value === "") {
        throw new HttpsError("invalid-argument", message);
    }
}

function nowIsoTimestamp() {
    return new Date().toISOString();
}

async function loadLessons(dbRef = null) {
    const db = dbRef || admin.firestore();
    const snap = await db.collection("metadata_lessons").orderBy("orderWeight", "asc").get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function isStarterCourseCategory(value = "") {
    const normalized = normalizeText(value).toLowerCase();
    return normalized === "start" ||
        normalized === "started" ||
        normalized === "starter" ||
        normalized === "car-starter";
}

function isStarterCourseReference(value = "") {
    const normalized = normalizeText(value).toLowerCase();
    return /^start-\d{2}-unit-/.test(normalized) ||
        /^car-starter-/.test(normalized) ||
        /^tw-car-starter-/.test(normalized) ||
        /^en-car-starter-/.test(normalized);
}

function resolveRegistrationTimestampMs(userData = {}, uid = "") {
    const candidates = [userData.createdAt, userData.joinedAt];
    let latestTs = 0;
    for (const value of candidates) {
        const ts = value?.toMillis
            ? value.toMillis()
            : (value?.seconds ? value.seconds * 1000 : (value ? new Date(value).getTime() : 0));
        if (Number.isFinite(ts) && ts > latestTs) {
            latestTs = ts;
        }
    }
    if (latestTs > 0) return latestTs;
    if (!uid) return 0;
    return 0;
}

module.exports = {
    assertAuthenticated,
    assertRequiredValue,
    loadLessons,
    isStarterCourseCategory,
    isStarterCourseReference,
    isAdminRoleValue,
    isAdminUserData,
    isControlAccessEmail,
    normalizeEmail,
    normalizeText,
    nowIsoTimestamp,
    resolveRegistrationTimestampMs
};
