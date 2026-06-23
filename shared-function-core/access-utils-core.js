const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeEmail(value = "") {
    return normalizeText(value).toLowerCase();
}

const ADMIN_ROLE_EMAILS = new Set([
    "rover.k.chen@gmail.com",
]);

function isAdminEmail(value = "") {
    return ADMIN_ROLE_EMAILS.has(normalizeEmail(value));
}

async function lookupAuthUserEmailByUid(uid = "") {
    const cleanUid = normalizeText(uid);
    if (!cleanUid) return "";

    const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.AUTH_EMULATOR_HOST || "";
    if (!host) return "";

    try {
        const response = await fetch(`http://${host}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=fake-api-key`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ localId: [cleanUid] }),
        });
        if (!response.ok) return "";
        const json = await response.json();
        return normalizeEmail(json?.users?.[0]?.email || "");
    } catch (_) {
        return "";
    }
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
    isAdminEmail,
    lookupAuthUserEmailByUid,
    normalizeEmail,
    normalizeText,
    nowIsoTimestamp,
    resolveRegistrationTimestampMs
};
