const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const functionsV1 = require("firebase-functions/v1");

// Load .env explicitly if not in production/deploy environment or as backup
if (process.env.NODE_ENV !== 'production' || !process.env.ECPAY_MERCHANT_ID) {
    require('dotenv').config();
}

const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const GitHubAPIHelper = require('./github-api-helper');
const {
    buildI18nFilenameCandidates,
    normalizeLegacyId,
    unitIdsMatch
} = require('./lib/id-utils');
const {
    getContentRuntimeConfig,
    getLegacyMasterMapping,
    peekLegacyMasterMapping
} = require('./lib/runtime-state');
const {
    ensureGithubOrgMembership,
    extractHiddenSectionContent,
    resolveAssignmentDocRefByUserAndUnit,
    upsertGithubActionsVariable
} = require('./lib/github-utils');
const {
    DEFAULT_REVENUE_SHARE_POLICY,
    buildRevenueShareBalanceRecord,
    buildRevenueShareCreditRecord,
    buildRevenueSharePolicySnapshot,
    buildRevenueSharePayoutRow,
    collectRevenueShareChainTargets,
    loadRevenueSharePolicy,
    resolveRevenueShareRoleEmails,
    round2Amount
} = require('./lib/revenue-sharing');
const {
    allocateByShareUnits,
    loadBalanceSheetSnapshots,
    loadActiveBalanceSheetSnapshot,
    issueInvestorEquity,
    loadInvestorConfig,
    loadInvestorProfiles,
    loadActiveValuationSnapshot,
    loadValuationSnapshots,
    recordInvestorFinanceEvent,
    upsertBalanceSheetSnapshot,
    upsertValuationSnapshot,
    settleAnnualInvestorDividends
} = require('./lib/investor-ledger');
const {
    addAssignmentHistoryEntry,
    backfillAutogradeGithubVariables,
    buildAssignmentSubmissionRecord,
    buildGithubAutogradePayload,
    buildNativeRepositoryAssignmentRecord,
    isAssignmentAuthorized,
    resolveAutogradeAssignmentDocId,
    sendAutogradeNotifications,
    syncAutoGradeInterventions,
    updateActiveAssignmentInterventions
} = require('./lib/assignment-flow');
const {
    sendWelcomeEmail, sendPaymentSuccessEmail, sendTrialExpiringEmail, sendCourseExpiringEmail,
    sendAssignmentNotification, sendTutorAuthorizationEmail, sendGradingNotification,
    sendStudentLinkedToTutorEmail, sendTutorLinkedToStudentEmail, sendAdminAssignmentReminder, sendStudentPendingTutorAssignmentReminder,
    sendAdminNewApplicationEmail, sendApplicationResultEmail,
    sendAutogradeResultToStudent, sendAutogradeResultToTutor, sendOrderShippedEmail,
    sendTutorRecommendationCandidateEmail, sendAutogradeFailureAlertEmail
} = require('./emailService');
const {
    buildTutorApplicationLegacyEntry,
    buildTutorApplicationRecord,
    buildTutorConfigEntry,
    fallbackNameFromEmail,
    generatePromotionCode,
    getEffectiveTutorConfig,
    getPreferredAssignmentUrl,
    getUserTutorConfig,
    indexAuthorizedTutorConfigForDashboard,
    queryTutorApplications,
    resolveNameFromUserData,
    resolveAssignmentUrlMaps,
    upsertTutorApplicationLegacyEntry,
    upsertTutorConfigForUser,
} = require('./lib/tutor-utils');
const {
    buildOrderRecordSummary,
    buildPendingShipmentReminderEntry,
    buildReferralLinkDocId,
    buildShippingAddress,
    buildShippingContact,
    buildStudentOrderRecord,
    collectPurchasedUnitIds,
    extractReferralAssignmentsFromOrder,
    hasActiveOrderForCourse,
    getPhysicalUnitIdSet,
    isPhysicalOrderItem,
    itemContainsUnit,
    normalizeGitHubUrl,
    normalizeLogisticsData,
    normalizeOrderItems
} = require('./lib/order-utils');
const {
    resolveCartPrice,
    resolveLessonPrice
} = require('./lib/pricing-utils');

admin.initializeApp({
    projectId: "e-learning-942f7"
});
const db = admin.firestore();

(async () => {
    try {
        await getLegacyMasterMapping(db);
        console.log("[Initialization] Legacy master mapping cache pre-loaded");
    } catch (err) {
        console.warn("[Initialization] Failed to pre-load legacy master mapping:", err.message);
    }
})();

// ==========================================
// Firebase Functions V2 全域設定
// ==========================================
setGlobalOptions({
    region: "asia-east1",
    maxInstances: 10,
    minInstances: 0,
    memory: 128,
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
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const GITHUB_CLASSROOM_ORG = process.env.GITHUB_CLASSROOM_ORG || "vibe-coding-classroom";
const GITHUB_ORG_ADMIN_TOKEN = process.env.GITHUB_ORG_ADMIN_TOKEN || "";
const CONTENT_REPO_TOKEN = defineSecret("CONTENT_REPO_TOKEN");
const GITHUB_API_TOKEN = defineSecret("GITHUB_API_TOKEN");

// 用於快取外部課程內容的記憶體 Cache (鍵值格式: repoOwner/repoName@ref|locale|localeCandidate)
const CONTENT_FILE_CACHE = new Map();

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

function normalizeClientIp(ip = '') {
    let clean = String(ip || '').trim();
    if (!clean) return '';
    if (clean.startsWith('[') && clean.endsWith(']')) {
        clean = clean.slice(1, -1);
    }
    if (clean.startsWith('::ffff:')) {
        clean = clean.substring(7);
    }
    return clean;
}

function collectClientIpCandidates(reqLike = {}) {
    const headers = reqLike?.headers || reqLike?.rawRequest?.headers || {};
    const req = reqLike?.rawRequest || reqLike;
    const candidates = [];
    const push = (value) => {
        const normalized = normalizeClientIp(value);
        if (!normalized || candidates.includes(normalized)) return;
        candidates.push(normalized);
    };

    const xForwardedFor = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
    if (xForwardedFor) {
        String(xForwardedFor)
            .split(',')
            .map((ip) => ip.trim())
            .forEach(push);
    }

    [
        headers['cf-connecting-ip'],
        headers['x-real-ip'],
        headers['x-appengine-user-ip'],
        headers['fastly-client-ip'],
        headers['true-client-ip'],
        headers['x-client-ip'],
        req?.ip,
        req?.connection?.remoteAddress,
        req?.socket?.remoteAddress,
    ].forEach(push);

    if (candidates.length === 0) {
        candidates.push('127.0.0.1');
    }

    return candidates;
}

function ensureStudentStatsEntry(studentStats, sid, userData = {}, options = {}) {
    const {
        accountStatus = 'free',
        includeOrderRecords = false
    } = options;

    if (!studentStats[sid]) {
        studentStats[sid] = {
            uid: sid,
            email: userData.email || 'Unknown',
            name: userData.name || '',
            role: userData.role || 'user',
            totalTime: 0,
            videoTime: 0,
            docTime: 0,
            pageTime: 0,
            lastActive: null,
            courseProgress: {},
            unitAssignments: userData.unitAssignments || {},
            orders: []
        };

        if (accountStatus !== null) {
            studentStats[sid].accountStatus = accountStatus;
        }
        if (includeOrderRecords) {
            studentStats[sid].orderRecords = [];
        }
    } else {
        if (!studentStats[sid].unitAssignments) {
            studentStats[sid].unitAssignments = userData.unitAssignments || {};
        }
        if (accountStatus !== null) {
            studentStats[sid].accountStatus = accountStatus;
        }
        if (includeOrderRecords && !studentStats[sid].orderRecords) {
            studentStats[sid].orderRecords = [];
        }
    }

    return studentStats[sid];
}

function ensureCourseProgressBucket(studentStatsEntry, cid, options = {}) {
    if (!studentStatsEntry.courseProgress) studentStatsEntry.courseProgress = {};
    if (!studentStatsEntry.courseProgress[cid]) {
        studentStatsEntry.courseProgress[cid] = {
            total: 0,
            video: 0,
            doc: 0,
            page: 0,
            logs: []
        };
    }
    if (options.isLicenseOnly) {
        studentStatsEntry.courseProgress[cid].isLicenseOnly = true;
    }
    return studentStatsEntry.courseProgress[cid];
}

function resolveStudentEmailLabel(usersMap = {}, uid, fallbackPrefix = 'Unknown Student', record = {}) {
    const studentInfo = usersMap[uid] || {};
    return studentInfo.email || record.userEmail || record.studentEmail || (uid ? `${fallbackPrefix}: ${String(uid).slice(0, 8)}` : fallbackPrefix);
}

function appendCourseProgressActivity(studentStatsEntry, cid, log = {}) {
    const cp = ensureCourseProgressBucket(studentStatsEntry, cid);
    const duration = log.duration || 0;

    cp.total += duration;
    if (log.action === 'VIDEO') cp.video += duration;
    if (log.action === 'DOC') cp.doc += duration;
    if (log.action === 'PAGE_VIEW') cp.page += duration;

    cp.logs.push({
        action: log.action,
        duration,
        timestamp: log.timestamp,
        metadata: log.metadata
    });

    return cp;
}

function buildDashboardReferenceEntry(usersMap = {}, uid, baseData = {}, fallbackPrefix = 'Unknown Student') {
    return {
        ...baseData,
        studentEmail: resolveStudentEmailLabel(usersMap, uid, fallbackPrefix, baseData)
    };
}

function shouldIncludeDashboardUser(role = '', requesterRole = 'user') {
    const normalizedRole = role || 'user';
    return requesterRole === 'admin' || normalizedRole === 'user' || !normalizedRole;
}

function addDashboardUserEntry(usersMap, docId, userData = {}, requesterRole = 'user') {
    const role = userData.role || 'user';
    if (!shouldIncludeDashboardUser(role, requesterRole)) return false;
    usersMap[docId] = { ...userData, role, _id: docId };
    return true;
}

function buildTutorList(usersMap = {}) {
    return Object.entries(usersMap).reduce((list, [uid, data]) => {
        const role = data.role || 'user';
        if (role === 'admin' || hasQualifiedTutorStatus(data)) {
            list.push({
                uid,
                email: data.email || 'No Email',
                name: data.name || 'Anonymous',
                role,
                tutorConfigs: data.tutorConfigs || {}
            });
        }
        return list;
    }, []);
}

function buildDashboardSummary(students = []) {
    const registeredUserStats = students;
    const paidStudentStats = students.filter(s => s.accountStatus === 'paid' && (s.role === 'user' || !s.role));
    return {
        totalStudents: registeredUserStats.length,
        totalPaidStudents: paidStudentStats.length,
        totalHours: paidStudentStats.reduce((acc, curr) => acc + curr.totalTime, 0) / 3600
    };
}

function finalizeHardwareOrders(hardwareOrders = []) {
    const sorted = [...hardwareOrders].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
    const pendingShipments = sorted.filter(order => order.fulfillmentStatus !== 'SHIPPED');
    return {
        hardwareOrders: sorted,
        pendingShipments,
        pendingShipmentsCount: pendingShipments.length
    };
}

function assertAuthenticated(auth, message = '請先登入') {
    if (!auth) throw new HttpsError('unauthenticated', message);
}

function assertAdminRole(requesterRole, message = '僅限管理員執行此操作') {
    if (requesterRole !== 'admin') throw new HttpsError('permission-denied', message);
}

function assertRequiredValue(value, message = '缺少必要參數') {
    if (!value) throw new HttpsError('invalid-argument', message);
}

function assertAdminOrAssignedTutor(isRequesterAdmin, isAssignedTutor, message = '您並非指派給此學生的導師，無法提交指導紀錄。') {
    if (!isRequesterAdmin && !isAssignedTutor) {
        throw new HttpsError('permission-denied', message);
    }
}

async function resolveSubmissionAccessOrThrow(db, uid, courseId, unitId, lessons = [], tutorMode = false) {
    const access = await resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons, tutorMode);
    if (!access.authorized) {
        throw new HttpsError('permission-denied', access.reason || '尚未完成此課程付款授權。');
    }
    if (access.requiresTutorAssignment && !access.assignedTutorEmail) {
        throw new HttpsError('failed-precondition', '此單元尚未完成老師指派，暫時無法建立作業紀錄。');
    }
    return access;
}

async function assertTutorRecommendationPermission(db, auth, canonicalUnitId, assignment, requesterRole) {
    if (requesterRole === 'admin') return;

    const requesterDoc = await db.collection('users').doc(auth.uid).get();
    const requesterData = requesterDoc.exists ? requesterDoc.data() : {};
    const requesterTutorConfigs = requesterData.tutorConfigs || {};
    const isAuthorizedForThisUnit = !!(getEffectiveTutorConfig(canonicalUnitId, requesterTutorConfigs)?.authorized);

    if (!isAuthorizedForThisUnit) {
        throw new HttpsError('permission-denied', 'Only the qualified tutor for this unit can recommend students.');
    }
    if (assignment.assignedTutorEmail !== auth.token.email) {
        throw new HttpsError('permission-denied', 'Only the assigned tutor can recommend this student.');
    }
}

function assertTutorApplicationState(appData = {}, { source = null, status = null } = {}) {
    if (source && appData.source !== source) {
        throw new HttpsError('failed-precondition', 'This action is only valid for the expected application type.');
    }
    if (status && appData.status !== status) {
        throw new HttpsError('failed-precondition', 'This application is not in the expected state.');
    }
}

function normalizeEmail(value = "") {
    return normalizeText(value).toLowerCase();
}

function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeAssignmentLinkUrl(value = "") {
    return normalizeText(value);
}

function isValidAssignmentLinkUrl(value = "") {
    const normalized = normalizeText(value);
    if (!normalized) return false;
    try {
        const parsed = new URL(normalized);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function getTutorAssignmentUrlFromConfig(cfg = {}, course = null, canonicalUnitId = '', tutorEmail = '', lessons = []) {
    const directUrl = normalizeText(cfg.assignmentUrl || cfg.legacyAssignmentUrl || cfg.githubClassroomUrl || '');
    if (directUrl) return directUrl;

    const courseAssignmentMap = course?.assignmentUrlMap?.[canonicalUnitId] || course?.assignmentUrls?.[canonicalUnitId];
    if (courseAssignmentMap) {
        return resolveAssignmentUrlForTutor(courseAssignmentMap, tutorEmail) || '';
    }

    return '';
}

async function findUserDocByEmail(db, email = "") {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    const snap = await db.collection('users').where('email', '==', normalized).limit(1).get();
    return snap.empty ? null : snap.docs[0];
}

function toIsoTimestamp(value, fallback = null) {
    if (!value) return fallback;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return fallback;
}

function formatTaipeiDateTime(value, fallback = '未知') {
    if (!value) return fallback;
    const date = typeof value.toDate === 'function'
        ? value.toDate()
        : value instanceof Date
            ? value
            : new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

function nowIsoTimestamp() {
    return new Date().toISOString();
}

function applyCorsHeaders(res, {
    origin = '*',
    methods = 'GET, POST, OPTIONS',
    headers = 'Content-Type, Authorization',
    contentType = null
} = {}) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', methods);
    res.set('Access-Control-Allow-Headers', headers);
    if (contentType) {
        res.set('Content-Type', contentType);
    }
}

// ==========================================
// 1. 建立訂單 (initiatePayment)
// ==========================================
exports.initiatePayment = onRequest(async (req, res) => {
    applyCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        console.log("收到 initiatePayment 請求 (.env mode)");

        const requestData = req.body.data || req.body || {};
        const {
            returnUrl,
            cartDetails,
            logistics,
            referralLink = '',
            referredTutorEmail = '',
            promoCode = '',
            referralTutor = '',
            gateway,
            locale
        } = requestData;

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

        const orderNumber = `VIBE${Date.now()}`;
        const tradeDate = getCurrentTime();

        const lessons = await getLessons();
        const normalizedItems = normalizeOrderItems(
            cartDetails || {},
            referralLink || promoCode,
            referredTutorEmail || referralTutor,
            lessons,
            orderNormalizationResolvers
        );

        // [NEW] Prevent duplicate course purchase if original course has not expired
        if (uid !== "GUEST") {
            const db = admin.firestore();
            const ordersSnapshot = await db.collection('orders')
                .where('uid', '==', uid)
                .where('status', '==', 'SUCCESS')
                .get();

            if (!ordersSnapshot.empty) {
                for (const itemKey of Object.keys(normalizedItems)) {
                    const lesson = resolveLessonForOrderItem(itemKey, lessons);
                    if (lesson && lesson.isPhysical !== true) {
                        const hasPaid = hasActiveOrderForCourse(ordersSnapshot, lesson.courseId, lessons);
                        if (hasPaid) {
                            return res.status(400).json({
                                error: {
                                    message: `您已擁有「${lesson.title || '本課程'}」且尚在授權期內，無需重複購買。`
                                }
                            });
                        }
                    }
                }
            }
        }

        // Guardrail: physical-product orders must include complete logistics info.
        const physicalUnitIds = getPhysicalUnitIdSet(lessons);
        const hasPhysicalItem = Object.keys(normalizedItems || {}).some((id) =>
            isPhysicalOrderItem(id, normalizedItems[id] || {}, physicalUnitIds)
        );

        let logisticsPayload = (logistics && typeof logistics === 'object') ? logistics : {};
        if (hasPhysicalItem) {
            const logisticsInfo = normalizeLogisticsData(logisticsPayload);

            if (!logisticsInfo.isComplete) {
                return res.status(400).json({
                    error: {
                        message: "實體商品訂單缺少完整物流資訊（收件人、電話、門市/地址/國家）。"
                    }
                });
            }
        }

        const isStripe = (gateway === 'STRIPE' || locale === 'en');
        const settlementLocale = isStripe ? 'en' : 'zh-TW';
        const expectedCurrency = isStripe ? 'USD' : 'TWD';
        const pricingAwareItems = {};
        let settlementAmount = 0;
        let hasPhysical = false;

        for (const itemKey of Object.keys(normalizedItems)) {
            const lesson = resolveLessonForOrderItem(itemKey, lessons);
            const qty = Number(normalizedItems[itemKey].quantity || 1);
            const sourcePrice = lesson
                ? resolveLessonPrice(lesson, settlementLocale)
                : resolveCartPrice(normalizedItems[itemKey], settlementLocale);
            const itemAmount = Number(sourcePrice.amount || 0);
            const itemCurrency = String(sourcePrice.currency || '').toUpperCase();

            if (!itemCurrency || itemCurrency !== expectedCurrency) {
                throw new Error(`商品「${normalizedItems[itemKey].name || itemKey}」的幣別設定不正確，請先在 Firestore 補齊 ${expectedCurrency} 價格。`);
            }

            const isPhysicalItem = lesson ? lesson.isPhysical === true : normalizedItems[itemKey].isPhysical === true;
            if (isPhysicalItem) hasPhysical = true;

            const normalizedItem = {
                ...normalizedItems[itemKey],
                price: itemAmount,
                currency: itemCurrency,
                price_currency: itemCurrency
            };
            if (itemCurrency === 'USD') normalizedItem.price_usd = itemAmount;
            if (itemCurrency === 'TWD') normalizedItem.price_twd = itemAmount;
            pricingAwareItems[itemKey] = normalizedItem;
            settlementAmount += itemAmount * qty;
        }
        const shippingFeeAmount = hasPhysical ? (isStripe ? 15 : 450) : 0;

        if (isStripe) {
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                return res.status(500).json({
                    error: {
                        message: "Stripe configuration is missing (STRIPE_SECRET_KEY)."
                    }
                });
            }
            const stripe = require('stripe')(stripeKey);
            let shippingFeeUsd = shippingFeeAmount;
            if (shippingFeeUsd > 0) {
                if (!logisticsPayload) {
                    logisticsPayload = {};
                }
                logisticsPayload.shippingFee = shippingFeeUsd;
                logisticsPayload.isInternational = true;
            }

            const finalAmountUsd = settlementAmount + shippingFeeUsd;

            // 建立訂單內容記錄 (Firestore)
            await admin.firestore().collection("orders").doc(orderNumber).set({
                uid: uid,
                amount: finalAmountUsd, // USD amount
                status: "PENDING",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                items: pricingAwareItems,
                logistics: logisticsPayload || null,
                orderNumber: orderNumber,
                gateway: "STRIPE",
                currency: "USD",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const lineItems = [];
            for (const itemKey of Object.keys(pricingAwareItems)) {
                const item = pricingAwareItems[itemKey];
                lineItems.push({
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: item.name || 'Vibe Coding Course',
                        },
                        unit_amount: Math.round(Number(item.price || 0) * 100), // cents
                    },
                    quantity: item.quantity || 1,
                });
            }

            if (shippingFeeUsd > 0) {
                lineItems.push({
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'International Shipping Fee',
                        },
                        unit_amount: Math.round(shippingFeeUsd * 100), // cents
                    },
                    quantity: 1,
                });
            }

            const clientUrl = returnUrl || "https://vibe-coding.tw";

            // Create Stripe Checkout Session
            const stripeSession = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: 'payment',
                success_url: `${clientUrl}?RtnCode=1&RtnMsg=Succeeded&orderNumber=${orderNumber}`,
                cancel_url: `${clientUrl}?RtnCode=10000078&RtnMsg=Cancelled&orderNumber=${orderNumber}`,
                metadata: {
                    orderNumber: orderNumber,
                    uid: uid
                },
                ...(hasPhysical ? {
                    shipping_address_collection: {
                        allowed_countries: ['US', 'CA', 'JP', 'SG', 'HK', 'MY']
                    }
                } : {})
            });

            await admin.firestore().collection("orders").doc(orderNumber).update({
                stripeSessionId: stripeSession.id,
                stripePaymentIntentId: stripeSession.payment_intent || null
            });

            console.log(`建立 Stripe 訂單: ${orderNumber}, Session ID: ${stripeSession.id}`);
            return res.status(200).json({
                result: {
                    gateway: "STRIPE",
                    sessionUrl: stripeSession.url
                }
            });
        }

        // ECPay 邏輯
        // 建立訂單內容記錄 (Firestore)
        await admin.firestore().collection("orders").doc(orderNumber).set({
            uid: uid,
            amount: settlementAmount + shippingFeeAmount,
            status: "PENDING",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            items: pricingAwareItems,
            logistics: logisticsPayload || null,
            orderNumber: orderNumber
        });

        // ServerUrl (Webhook)
        const serverUrl = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentNotify`;
        // ClientUrl (前端)
        const clientUrl = returnUrl || "https://vibe-coding.tw";

        const appliedReferralLinks = Object.values(normalizedItems).map(item => item?.referralLink).filter(Boolean);
        console.log(`建立訂單: ${orderNumber} (Referral Links: ${appliedReferralLinks.join(', ') || 'None'})`);

        let itemNameStr = 'Vibe Coding 線上課程';
        if (normalizedItems && Object.keys(normalizedItems).length > 0) {
            const names = [];
            Object.values(normalizedItems).forEach(item => {
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
            TotalAmount: settlementAmount + shippingFeeAmount,
            TradeDesc: 'VibeCodingCourse',
            ItemName: itemNameStr,
            ReturnURL: serverUrl,
            OrderResultURL: clientUrl,
            ClientBackURL: clientUrl,
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
    applyCorsHeaders(res);

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
// 2. 接收通知與權限開通核心 (Order Activation & Webhook Services)
// ==========================================

/**
 * 核心權限開通與 Email 通知流程 (由 ECPay 及 Stripe 成功付款後共用)
 * @param {string} orderId 訂單編號
 */
async function activateOrderPermissionsAndNotify(orderId) {
    console.log(`[activateOrderPermissionsAndNotify] 開始開通與通知流程, Order: ${orderId}`);
    const db = admin.firestore();
    const orderDoc = await db.collection("orders").doc(orderId).get();
    if (!orderDoc.exists) {
        console.error(`[activateOrderPermissionsAndNotify] 訂單 ${orderId} 不存在`);
        return;
    }
    const oData = orderDoc.data();
    const oItems = oData.items || {};

    try {
        // 1. 課程開通與授權驗證
        const validationAlerts = [];
        const activationCheckedItems = [];
        try {
            const lessons = await getLessons();
            for (const itemKey of Object.keys(oItems)) {
                const lesson = resolveLessonForOrderItem(itemKey, lessons);
                if (!lesson) {
                    validationAlerts.push(`Item '${itemKey}' does not map to any canonical course.`);
                    activationCheckedItems.push({ itemKey, status: "missing-course" });
                    continue;
                }

                activationCheckedItems.push({
                    itemKey,
                    courseId: getCanonicalLessonIdentity(lesson) || null,
                    courseKey: lesson.courseKey || null,
                    isPhysical: lesson.isPhysical === true,
                    status: "mapped"
                });

                if (lesson.isPhysical === true) {
                    activationCheckedItems[activationCheckedItems.length - 1].status = "physical-skipped";
                    continue;
                }

                if (!Array.isArray(lesson.courseUnits) || lesson.courseUnits.length === 0) {
                    validationAlerts.push(`Course '${getCanonicalLessonIdentity(lesson) || lesson.courseId}' has no units defined.`);
                    activationCheckedItems[activationCheckedItems.length - 1].status = "missing-units";
                    continue;
                }

                const firstUnitId = lesson.courseUnits[0];
                const access = await resolveStudentAssignmentAccess(db, oData.uid, getCanonicalLessonIdentity(lesson), firstUnitId, lessons, false);
                if (!access.authorized) {
                    validationAlerts.push(`Student authorization check failed for course '${getCanonicalLessonIdentity(lesson) || lesson.courseId}' / unit '${firstUnitId}': ${access.reason || 'unknown'}`);
                    activationCheckedItems[activationCheckedItems.length - 1].status = "authorization-failed";
                    activationCheckedItems[activationCheckedItems.length - 1].reason = access.reason || "unknown";
                } else {
                    activationCheckedItems[activationCheckedItems.length - 1].status = "authorized";
                    activationCheckedItems[activationCheckedItems.length - 1].accessMode = access.accessMode || null;
                }
            }

            if (validationAlerts.length > 0) {
                console.error(`[activateOrderPermissionsAndNotify] Order activation validation failed for order ${orderId}: ${validationAlerts.join('; ')}`);
                await db.collection("orders").doc(orderId).update({
                    activationAlerts: validationAlerts,
                    activationValidated: true,
                    activationValidationFailed: true,
                    activationValidationStatus: "failed",
                    activationCheckedItems,
                    activationValidatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
                if (adminEmail) {
                    await sendAutogradeFailureAlertEmail(
                        adminEmail,
                        `Order Activation Failure: ${orderId}`,
                        { orderId, uid: oData.uid, alerts: validationAlerts }
                    );
                }
            } else {
                await db.collection("orders").doc(orderId).update({
                    activationValidated: true,
                    activationValidationFailed: false,
                    activationValidationStatus: "passed",
                    activationCheckedItems,
                    activationValidatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (valErr) {
            console.error("[activateOrderPermissionsAndNotify] Order activation validation errored:", valErr);
            await db.collection("orders").doc(orderId).update({
                activationValidated: false,
                activationValidationFailed: true,
                activationValidationStatus: "error",
                activationValidationError: valErr.message || String(valErr),
                activationValidatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // 2. 老師作業推薦碼/連結反向綁定資訊補回
        let updatedItems = false;
        for (const [key, val] of Object.entries(oItems)) {
            const itemReferralLink = val.referralLink || val.promoCode || null;
            if (itemReferralLink && !val.referredTutorEmail) {
                const linkId = buildReferralLinkDocId(itemReferralLink);
                const lDoc = await db.collection('referral_links').doc(linkId).get();
                if (lDoc.exists) {
                    oItems[key].referredTutorEmail = lDoc.data().tutorEmail;
                    oItems[key].referredTutorName = lDoc.data().tutorName || lDoc.data().tutorEmail;
                    updatedItems = true;
                }
            }
        }
        if (updatedItems) {
            await db.collection("orders").doc(orderId).update({ items: oItems });
            console.log(`[activateOrderPermissionsAndNotify] ✅ Backfilled referred tutor for order ${orderId}`);
        }
    } catch (backfillErr) {
        console.error("[activateOrderPermissionsAndNotify] Backfill failed:", backfillErr);
    }

    // 3. 物流欄位缺漏檢查與寄送 Email 通知
    try {
        const lessons = await getLessons();
        const physicalUnitIds = getPhysicalUnitIdSet(lessons);
        const orderDocFresh = await db.collection("orders").doc(orderId).get();
        const orderData = orderDocFresh.data();
        const orderItems = orderData.items || {};
        const hasPhysicalItem = Object.keys(orderItems).some((id) =>
            isPhysicalOrderItem(id, orderItems[id] || {}, physicalUnitIds)
        );
        const logisticsInfo = normalizeLogisticsData(orderData.logistics || {});
        const logisticsMissing = hasPhysicalItem && !logisticsInfo.isComplete;

        if (hasPhysicalItem) {
            await db.collection("orders").doc(orderId).update({ logisticsMissing });
        }

        let userEmail = "";
        if (orderData.uid === "GUEST") {
            // 訪客訂單處理
        } else {
            const userRecord = await admin.auth().getUser(orderData.uid);
            userEmail = userRecord.email;
        }

        if (userEmail) {
            const items = orderItems;
            const itemDesc = Object.values(items).map(i => `${i.name} x${i.quantity || 1}`).join(', ');
            const hasPhysical = hasPhysicalItem;
            
            await sendPaymentSuccessEmail(userEmail, orderId, orderData.amount, itemDesc, hasPhysical);
        }

        // 3.5. Investor income credit creation (order revenue entry)
        try {
            const investorProfileCache = new Map();
            const investorEventResult = await recordInvestorFinanceEvent({
                db,
                profileCache: investorProfileCache,
                payload: {
                    eventType: "income",
                    sourceType: "order",
                    sourceId: orderId,
                    sourceLabel: `Order ${orderId}`,
                    amount: Number(orderData.amount || 0),
                    note: `Auto credit from successful order ${orderId}`,
                    occurredAtDate: orderData.paidAt?.toDate ? orderData.paidAt.toDate() : new Date()
                },
                createdByUid: "system"
            });
            console.log(`[activateOrderPermissionsAndNotify] ✅ Investor credit created for order ${orderId}: ${investorEventResult.eventId}`);
        } catch (investorErr) {
            console.warn(`[activateOrderPermissionsAndNotify] Investor credit creation skipped for order ${orderId}:`, investorErr.message || investorErr);
        }

        // 4. 自動指派導師與分潤綁定
        if (orderData.uid && orderData.uid !== 'GUEST') {
            const referralAssignments = extractReferralAssignmentsFromOrder(orderData.items || {}, lessons, orderNormalizationResolvers);

            for (const assignment of referralAssignments) {
                const linkId = buildReferralLinkDocId(assignment.referralLink);
                const referralDoc = await db.collection('referral_links').doc(linkId).get();
                if (!referralDoc.exists) continue;

                const referralData = referralDoc.data();
                const targetUnitId = resolveCanonicalUnitId(referralData.unitId, lessons);

                if (targetUnitId && assignment.purchasedUnits.includes(targetUnitId) && referralData.tutorEmail) {
                    for (const unitId of assignment.purchasedUnits) {
                        await upsertStudentUnitAssignment(
                            db,
                            orderData.uid,
                            unitId,
                            referralData.tutorEmail,
                            'paymentWebhook',
                            true
                        );
                    }
                    console.log(`[activateOrderPermissionsAndNotify] Cascade-assigned ${orderData.uid} -> ${referralData.tutorEmail} for ${assignment.purchasedUnits.length} units (triggered by ${targetUnitId})`);
                } else {
                    console.warn(`[activateOrderPermissionsAndNotify] Referral link ${assignment.referralLink} did not match purchased units for order ${orderId}`);
                }
            }
        }
    } catch (emailErr) {
        console.error("[activateOrderPermissionsAndNotify] Failed to process payment follow-up:", emailErr);
    }
}

/**
 * 綠界金流付款通知端點 (ECPay Webhook)
 */
exports.paymentNotify = onRequest(async (req, res) => {
    applyCorsHeaders(res, { methods: 'GET, POST, OPTIONS', headers: 'Content-Type, Authorization', contentType: 'text/plain' });

    if (req.method === 'GET') {
        return res.status(200).send('1|OK');
    }

    try {
        const data = req.body;

        if (!data) return res.status(200).send('1|OK');

        if (data.RtnCode === '1') {
            const orderId = data.MerchantTradeNo;
            const isSimulated = data.SimulatePaid === '1';

            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            await admin.firestore().collection("orders").doc(orderId).update({
                status: "SUCCESS",
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
                ecpayTradeNo: data.TradeNo || "",
                paymentDate: data.PaymentDate || "",
                isSimulated: isSimulated,
                rtnMsg: data.RtnMsg || "",
                gateway: "ECPAY"
            });
            console.log(`訂單 ${orderId} 更新成功 (ECPay)`);

            // 呼叫開通授權與通知
            await activateOrderPermissionsAndNotify(orderId);
        }

        return res.status(200).send('1|OK');

    } catch (error) {
        console.error("通知處理失敗:", error);
        return res.status(200).send('1|OK');
    }
});

/**
 * Stripe 金流付款通知端點 (Stripe Webhook)
 */
exports.stripeWebhook = onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!sig || !stripeWebhookSecret || !stripeKey) {
        console.error("Stripe Webhook error: Missing signature, webhook secret, or stripe key.");
        return res.status(400).send("Webhook configuration error");
    }

    const stripe = require('stripe')(stripeKey);
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret);
    } catch (err) {
        console.error(`Stripe Webhook Signature verification failed:`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderNumber = session.metadata?.orderNumber;

        if (!orderNumber) {
            console.error("Stripe Webhook: No orderNumber found in session metadata.");
            return res.status(200).send("No orderNumber metadata");
        }

        console.log(`Stripe Webhook: Processing completed checkout session for order ${orderNumber}`);
        const db = admin.firestore();

        try {
            const orderDoc = await db.collection("orders").doc(orderNumber).get();
            if (!orderDoc.exists) {
                console.error(`Stripe Webhook: Order ${orderNumber} not found in Firestore.`);
                return res.status(200).send("Order not found");
            }

            const orderData = orderDoc.data();
            if (orderData.status === "SUCCESS") {
                console.log(`Stripe Webhook: Order ${orderNumber} is already SUCCESS.`);
                return res.status(200).send("Order already processed");
            }

            const expiryDate = new Date();
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);

            const updateData = {
                status: "SUCCESS",
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
                stripePaymentIntentId: session.payment_intent || null,
                stripeSessionId: session.id,
                paymentDate: getCurrentTime(),
                gateway: "STRIPE"
            };

            if (session.shipping_details) {
                const sd = session.shipping_details;
                const existingLogistics = orderData.logistics || {};

                updateData.logistics = {
                    ...existingLogistics,
                    receiverName: sd.name || existingLogistics.receiverName || "",
                    receiverPhone: sd.phone || existingLogistics.receiverPhone || "",
                    isInternational: true,
                    address: {
                        country: sd.address?.country || "",
                        state: sd.address?.state || "",
                        city: sd.address?.city || "",
                        postalCode: sd.address?.postal_code || "",
                        line1: sd.address?.line1 || "",
                        line2: sd.address?.line2 || ""
                    }
                };
            }

            await db.collection("orders").doc(orderNumber).update(updateData);
            console.log(`Stripe Webhook: Order ${orderNumber} status updated to SUCCESS.`);

            // 呼叫開通授權與通知
            await activateOrderPermissionsAndNotify(orderNumber);

        } catch (err) {
            console.error(`Stripe Webhook error processing order ${orderNumber}:`, err);
            return res.status(500).send(`Internal Error: ${err.message}`);
        }
    }

    res.status(200).json({ received: true });
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
                return withAssignmentUrlAliases(d);
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

function withAssignmentUrlAliases(lesson = {}) {
    const currentUrlMap = lesson && typeof lesson.assignmentUrlMap === 'object' && lesson.assignmentUrlMap !== null
        ? lesson.assignmentUrlMap
        : null;
    const currentUrls = lesson && typeof lesson.assignmentUrls === 'object' && lesson.assignmentUrls !== null
        ? lesson.assignmentUrls
        : null;

    const assignmentUrlMap = currentUrlMap || null;
    const assignmentUrls = currentUrls || currentUrlMap || null;

    return {
        ...lesson,
        ...(assignmentUrlMap ? { assignmentUrlMap } : {}),
        ...(assignmentUrls ? { assignmentUrls } : {})
    };
}

function cleanUnitId(unitId) {
    if (!unitId) return "";
    return normalizeText(unitId)
        .toLowerCase()
        .replace(/\.html$/, '')
        .replace(/^(?:tw-(?:common|car-(?:starter|basic|advanced))-|start-|basic-|adv-|advanced-|prepare-)?(?:\d{2}-)?(?:unit-|lesson-|master-)?/i, '');
}

const LEGACY_TUTOR_UNIT_TO_CANONICAL = {
    '01-master-getting-started.html': 'common-developer-identity.html',
    '02-master-ai-agents.html': 'common-agent-mode.html',
    '03-master-wifi-motor.html': 'common-github-classroom.html',
    '01-unit-vscode-online.html': 'common-vscode-online.html',
    '01-unit-vscode-setup.html': 'common-vscode-setup.html',
    '02-unit-agent-mode.html': 'common-agent-mode.html',
    '02-unit-vibe-coding.html': 'common-vibe-coding.html',
    '02-unit-web-agents.html': 'common-web-agents.html',
    '03-unit-github-classroom.html': 'common-github-classroom.html',
    '03-unit-motor-ramping.html': 'common-motor-ramping.html',
    '03-unit-wifi-setup.html': 'common-wifi-setup.html',
    
    // Start, Basic, and Advanced legacy master mappings
    "adv-01-master-s3-cam.html": "adv-01-unit-jpeg-quality.html",
    "adv-02-master-video.html": "adv-02-unit-bandwidth-fps.html",
    "adv-03-master-ble-advanced.html": "adv-03-unit-ble-mtu.html",
    "adv-04-master-sensors.html": "adv-04-unit-filter-algorithms.html",
    "adv-05-master-cv.html": "adv-05-unit-centroid-error.html",
    "adv-06-master-cv-advanced.html": "adv-06-unit-centroid-algorithm.html",
    "adv-07-master-ui-framework.html": "adv-07-unit-chart-canvas.html",
    "adv-08-master-image-processing.html": "adv-08-unit-color-spaces.html",
    "adv-09-master-ai-recognition.html": "adv-09-unit-cnn-audio.html",
    "adv-10-master-diff-drive.html": "adv-10-unit-api-design.html",
    "adv-11-master-photoelectric.html": "adv-11-unit-hardware-interrupts.html",
    "adv-12-master-pid.html": "adv-12-unit-code-logic.html",
    "adv-13-master-robustness.html": "adv-13-unit-robustness.html",
    "adv-14-master-debugging-art.html": "adv-14-unit-debugging-art.html",
    "adv-15-master-architecture.html": "adv-15-unit-ble-async.html",
    "basic-01-master-environment.html": "basic-01-unit-drivers-ports.html",
    "basic-02-master-ota-architecture.html": "basic-02-unit-ota-principles.html",
    "basic-03-master-io-mapping.html": "basic-03-unit-adc-resolution.html",
    "basic-04-master-pwm-control.html": "basic-04-unit-h-bridge.html",
    "basic-05-master-ble-gatt.html": "basic-05-unit-advertising-connection.html",
    "basic-06-master-http-web.html": "basic-06-unit-cors-security.html",
    "basic-07-master-wifi-modes.html": "basic-07-unit-async-webserver.html",
    "basic-08-master-joystick-math.html": "basic-08-unit-joystick-mapping.html",
    "basic-09-master-multitasking.html": "basic-09-unit-hardware-timer.html",
    "basic-10-master-fsm.html": "basic-10-unit-fsm.html",
    "start-01-master-web-app.html": "start-01-unit-flexbox-layout.html",
    "start-02-master-web-ble.html": "start-02-unit-ble-async.html",
    "start-03-master-remote-control.html": "start-03-unit-control-panel.html",
    "start-04-master-touch-events.html": "start-04-unit-long-press.html",
    "start-05-master-joystick-lab.html": "start-05-unit-canvas-joystick.html"
};

const CANONICAL_TUTOR_UNIT_TO_LEGACY = Object.entries(LEGACY_TUTOR_UNIT_TO_CANONICAL).reduce((acc, [legacy, canonical]) => {
    if (!acc[canonical]) acc[canonical] = [];
    acc[canonical].push(legacy);
    return acc;
}, {});

function normalizeTutorAdminUnitId(unitId = '') {
    const raw = normalizeText(unitId);
    if (!raw) return '';
    const withHtml = raw.endsWith('.html') ? raw : `${raw}.html`;
    if (LEGACY_TUTOR_UNIT_TO_CANONICAL[withHtml]) return LEGACY_TUTOR_UNIT_TO_CANONICAL[withHtml];
    if (LEGACY_TUTOR_UNIT_TO_CANONICAL[raw]) return LEGACY_TUTOR_UNIT_TO_CANONICAL[raw];
    if (/^(?:tw|en)-/i.test(raw)) return raw.replace(/^(?:tw|en)-/i, '');
    if (raw === '02-unit-classroom-workflow.html') return 'common-github-classroom.html';
    if (raw.startsWith('04-')) return raw.replace(/^04-/, '02-');
    return raw;
}

function getTutorAdminUnitAliasCandidates(unitId = '') {
    const canonical = normalizeTutorAdminUnitId(unitId);
    const raw = normalizeText(unitId);
    const withHtml = canonical.endsWith('.html') ? canonical : `${canonical}.html`;
    const noHtml = withHtml.replace(/\.html$/i, '');
    const legacyAliases = [
        ...(CANONICAL_TUTOR_UNIT_TO_LEGACY[withHtml] || []),
        ...(CANONICAL_TUTOR_UNIT_TO_LEGACY[noHtml] || [])
    ];
    const candidates = new Set([
        canonical,
        withHtml,
        noHtml,
        raw,
        raw.replace(/\.html$/i, '')
    ]);
    legacyAliases.forEach(alias => {
        candidates.add(alias);
        candidates.add(alias.replace(/\.html$/i, ''));
    });
    return Array.from(candidates).filter(Boolean);
}

function mapLegacyMasterToCanonical(value = '') {
    // Use cached mapping if available; fallback to value if not
    const mapping = peekLegacyMasterMapping();
    return mapping[value] || value;
}

function isLegacyMasterPage(value = '') {
    const normalized = normalizeText(value || '').split('/').pop().split('?')[0];
    if (!normalized.includes('-master-')) return false;
    const mapping = peekLegacyMasterMapping();
    return Object.prototype.hasOwnProperty.call(mapping, normalized);
}

function resolveCanonicalUnitId(unitId, lessons = [], options = {}) {
    if (!unitId) return unitId;
    const { allowLegacyMaster = false } = options;

    // Only explicit compatibility paths should translate retired master ids.
    const mappedUnitId = allowLegacyMaster ? mapLegacyMasterToCanonical(unitId) : unitId;
    const cleanId = cleanUnitId(mappedUnitId);

    let resolved = mappedUnitId;
    for (const lesson of lessons) {
        const courseUnits = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        if (courseUnits.includes(mappedUnitId)) {
            resolved = mappedUnitId;
            break;
        }
        
        const matchedUnit = courseUnits.find(courseUnit => {
            return cleanUnitId(courseUnit) === cleanId;
        });

        if (matchedUnit) {
            resolved = matchedUnit;
            break;
        }
    }

    // [CANONICAL CLEANUP] Normalize resolved keys to strip tw-/en- prefixes and convert start- to car-starter-
    let canonical = resolved;
    if (/^(?:tw|en)-/i.test(canonical)) {
        canonical = canonical.replace(/^(?:tw|en)-/i, '');
    }
    if (/^start-\d{2}-unit-/i.test(canonical)) {
        canonical = canonical.replace(/^start-\d{2}-unit-/i, 'car-starter-');
    } else if (/^start-/i.test(canonical)) {
        canonical = canonical.replace(/^start-/i, 'car-starter-');
    }

    return canonical;
}

function canonicalizeLessonForDashboard(lesson = {}, lessons = []) {
    if (!lesson || typeof lesson !== 'object') return lesson;
    const courseUnits = Array.isArray(lesson.courseUnits)
        ? lesson.courseUnits.map((unitId) => resolveCanonicalUnitId(unitId, lessons, { allowLegacyMaster: true }) || unitId)
        : lesson.courseUnits;

    return {
        ...lesson,
        ...(Array.isArray(courseUnits) ? { courseUnits } : {}),
        ...(lesson.entryUnitId ? {
            entryUnitId: resolveCanonicalUnitId(lesson.entryUnitId, lessons, { allowLegacyMaster: true }) || lesson.entryUnitId
        } : {})
    };
}

/**
 * Normalizes a unitId for Firestore storage keys (strips .html, keep start- etc).
 */
function normalizeForFirestore(unitId) {
    if (!unitId) return unitId;
    return unitId.replace(/\.html$/, '');
}

function normalizeCanonicalCourseKey(value = "") {
    return normalizeCourseFile(value)
        .replace(/\.html$/i, "")
        .replace(/^(?:tw|en)-/i, "");
}

function getCanonicalLessonIdentity(lesson = {}) {
    if (!lesson || typeof lesson !== 'object') return '';
    const metadataType = String(lesson.metadataType || '').toLowerCase();
    if (lesson.isPhysical === true || metadataType === 'product' || metadataType === 'legacy_product') {
        return String(
            lesson.productId ||
            lesson.courseKey ||
            lesson.courseId ||
            lesson.id ||
            ''
        ).trim();
    }
    return String(
        normalizeCanonicalCourseKey(lesson.courseKey) ||
        normalizeCanonicalCourseKey(lesson.contentRef) ||
        normalizeCanonicalCourseKey(lesson.courseId) ||
        normalizeCanonicalCourseKey(lesson.entryUnitId) ||
        normalizeCanonicalCourseKey(lesson.id) ||
        lesson.productId ||
        ''
    ).trim();
}

function findParentCourseIdByUnit(unitId, lessons = []) {
    if (!unitId) return null;

    const lesson = findCourseByUnitId(unitId, lessons);
    return lesson ? (getCanonicalLessonIdentity(lesson) || null) : null;
}

function findCourseByPageOrUnit(pageId, fileName, lessons = []) {
    const normalizedPageId = normalizeCourseFile(pageId);
    const normalizedFileName = normalizeCourseFile(fileName);
    const normalizedPageIdNoHtml = normalizedPageId.replace(/\.html$/i, '');
    const normalizedFileNameNoHtml = normalizedFileName.replace(/\.html$/i, '');

    return lessons.find(l => {
        const lessonCourseId = String(l.courseId || '');
        const lessonCourseIdNoHtml = lessonCourseId.replace(/\.html$/i, '');
        const units = Array.isArray(l.courseUnits) ? l.courseUnits : [];
        const unitMatch = units.some(unit => {
            const normalizedUnit = normalizeCourseFile(String(unit || ''));
            return unitIdsMatch(normalizedUnit, normalizedFileName) ||
                unitIdsMatch(normalizedUnit, normalizedFileNameNoHtml) ||
                unitIdsMatch(normalizedUnit, normalizedPageId) ||
                unitIdsMatch(normalizedUnit, normalizedPageIdNoHtml);
        });

        const legacyLessonUrl = l.classroomUrl;
        const assignmentUnitMatch = !!(legacyLessonUrl && (
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedFileName) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedFileNameNoHtml) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedPageId) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedPageIdNoHtml)
        ));

        return unitIdsMatch(lessonCourseId, pageId) ||
            unitIdsMatch(lessonCourseId, normalizedPageId) ||
            unitIdsMatch(lessonCourseIdNoHtml, normalizedPageIdNoHtml) ||
            unitMatch ||
            assignmentUnitMatch;
    }) || null;
}

function findCourseByUnitId(unitId, lessons = []) {
    if (!unitId) return null;
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    return lessons.find((lesson) => {
        const units = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        return units.some((candidateUnitId) =>
            unitIdsMatch(candidateUnitId, canonicalUnitId) ||
            normalizeLookupValue(candidateUnitId) === normalizeLookupValue(canonicalUnitId)
        );
    }) || null;
}

function normalizeLookupValue(value = '') {
    return String(value || '').split('/').pop().split('?')[0].replace(/\.html$/i, '').toLowerCase();
}

function getLessonLookupKeys(lesson = {}) {
    const keys = new Set();
    const add = (value) => {
        if (!value) return;
        const raw = normalizeText(value);
        if (!raw) return;
        keys.add(raw);
        keys.add(raw.replace(/\.html$/i, ''));
        keys.add(normalizeLookupValue(raw));
    };

    add(lesson.id);
    add(lesson.courseId);
    add(lesson.courseKey);
    add(normalizeCanonicalCourseKey(lesson.courseKey));
    add(normalizeCanonicalCourseKey(lesson.contentRef));
    add(lesson.entryUnitId);
    const legacyLessonUrl = lesson.classroomUrl;
    add(legacyLessonUrl);
    add(lesson.productId);
    add(lesson.sku);

    if (Array.isArray(lesson.productIds)) lesson.productIds.forEach(add);
    if (Array.isArray(lesson.legacyProductIds)) lesson.legacyProductIds.forEach(add);
    if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
    if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);

    return keys;
}

function findLessonByCourseRef(courseRef = '', lessons = []) {
    if (!courseRef) return null;
    const candidates = new Set([
        normalizeText(courseRef || ''),
        normalizeText(courseRef || '').replace(/\.html$/i, ''),
        normalizeLookupValue(courseRef),
        cleanUnitId(courseRef)
    ].filter(Boolean));

    return lessons.find((lesson) => {
        const keys = getLessonLookupKeys(lesson);
        for (const candidate of candidates) {
            if (keys.has(candidate)) return true;
        }
        return false;
    }) || null;
}

function resolveLessonForOrderItem(itemKey = '', lessons = []) {
    if (!itemKey) return null;
    const candidates = new Set([
        itemKey,
        String(itemKey).replace(/\.html$/i, ''),
        normalizeLookupValue(itemKey),
        cleanUnitId(itemKey)
    ]);

    return lessons.find((lesson) => {
        const keys = getLessonLookupKeys(lesson);
        for (const candidate of candidates) {
            if (keys.has(candidate)) return true;
        }
        return false;
    }) || findCourseByPageOrUnit(itemKey, itemKey, lessons);
}

const orderNormalizationResolvers = {
    resolveLessonForOrderItem,
    resolveCanonicalUnitId,
    findLessonByCourseRef,
    findParentCourseIdByUnit,
    normalizeText,
    cleanUnitId,
    getLessonLookupKeys
};

async function backfillTutorReferralForPaidOrders(db, {
    uid,
    unitId,
    tutorEmail,
    promotionCode = '',
    assignmentUrl = '',
    lessons = [],
    source = 'unitBinding'
}) {
    if (!uid || !unitId || !tutorEmail) return { updatedOrders: 0, updatedItems: 0 };

    const ordersSnap = await db.collection('orders')
        .where('uid', '==', uid)
        .where('status', '==', 'SUCCESS')
        .get();

    if (ordersSnap.empty) return { updatedOrders: 0, updatedItems: 0 };

    let updatedOrders = 0;
    let updatedItems = 0;
    const normalizedTutorEmail = normalizeText(tutorEmail);
    const normalizedPromotionCode = normalizeText(promotionCode || '').toUpperCase();
    const normalizedAssignmentUrl = normalizeText(assignmentUrl || '');

    for (const orderDoc of ordersSnap.docs) {
        const orderData = orderDoc.data() || {};
        const items = JSON.parse(JSON.stringify(orderData.items || {}));
        let hasOrderChange = false;

        for (const [itemKey, itemValue] of Object.entries(items)) {
            if (!itemContainsUnit(itemKey, lessons, unitId, orderNormalizationResolvers)) continue;
            if (!itemValue || typeof itemValue !== 'object') continue;

            itemValue.referredTutorEmail = normalizedTutorEmail;
            itemValue.referralTutor = normalizedTutorEmail;
            if (normalizedAssignmentUrl) {
                itemValue.referralLink = normalizedAssignmentUrl;
                itemValue.promoCode = normalizedAssignmentUrl;
            }
            if (normalizedPromotionCode) {
                itemValue.promotionCode = normalizedPromotionCode;
            }
            hasOrderChange = true;
            updatedItems++;
        }

        if (hasOrderChange) {
            await db.collection('orders').doc(orderDoc.id).set({
                items,
                lastTutorBindingBackfillAt: admin.firestore.FieldValue.serverTimestamp(),
                lastTutorBindingBackfillSource: source
            }, { merge: true });
            updatedOrders++;
        }
    }

    return { updatedOrders, updatedItems };
}

function resolveAssignmentUrlForTutor(urlConfig, tutorEmail) {
    if (!urlConfig) return null;
    if (typeof urlConfig === 'string') return urlConfig;
    if (typeof urlConfig !== 'object') return null;
    if (tutorEmail && typeof urlConfig[tutorEmail] === 'string') return urlConfig[tutorEmail];
    if (typeof urlConfig.default === 'string') return urlConfig.default;
    return Object.values(urlConfig).find(value => typeof value === 'string' && value.trim()) || null;
}

function hasQualifiedTutorStatus(userData = {}, unitId = '') {
    const tutorConfigs = userData.tutorConfigs || {};
    if (unitId) {
        return !!(tutorConfigs[unitId] && tutorConfigs[unitId].authorized === true);
    }
    return Object.values(tutorConfigs).some(config => config && config.authorized === true);
}

/**
 * Checks if a tutor is fully certified for all units in a specific course.
 * @param {object} userData - User document data
 * @param {string} courseId - The course to check
 * @param {Array} lessons - Lessons metadata
 * @returns {boolean}
 */
function isTutorFullyQualifiedForCourse(userData = {}, courseId = '', lessons = []) {
    const tutorConfigs = userData.tutorConfigs || {};
    const lesson = findLessonByCourseRef(courseId, lessons);
    if (!lesson || !Array.isArray(lesson.courseUnits)) return false;

    // A tutor is fully qualified for a course ONLY if EVERY unit in that course is authorized in their config
    return lesson.courseUnits.every(unitId => {
        const canonical = resolveCanonicalUnitId(unitId, lessons);
        const config = getEffectiveTutorConfig(canonical, tutorConfigs);
        return !!(config && config.authorized === true);
    });
}

async function ensureTutorPromotionCode(db, userRef, userData = {}, uid = '', email = '') {
    const existing = normalizeText(userData.promotionCode || '').toUpperCase();
    if (existing) return existing;

    let finalCode = '';
    let tries = 0;

    while (tries < 20) {
        finalCode = generatePromotionCode(6);
        const dup = await db.collection('users')
            .where('promotionCode', '==', finalCode)
            .limit(1)
            .get();
        if (dup.empty || (dup.docs[0] && dup.docs[0].id === uid)) break;
        tries += 1;
    }

    if (!finalCode) {
        throw new Error('Failed to generate promotion code');
    }

    await userRef.set({
        promotionCode: finalCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return finalCode;
}

async function resolveUserDisplayName(db, uid, email = "", authDisplayName = "") {
    try {
        if (!uid) return resolveNameFromUserData({}, email, authDisplayName);
        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};
        return resolveNameFromUserData(userData, email, authDisplayName);
    } catch (e) {
        console.warn(`[NameResolver] Failed to resolve user name for uid=${uid}:`, e.message);
        return resolveNameFromUserData({}, email, authDisplayName);
    }
}

/**
 * [V15.9] SYNC HELPER: Maintains the referral_links index for O(1) lookups during checkout.
 */
async function syncReferralLink(db, url, tutorEmail, tutorName, unitId) {
    if (!url) return;
    const normalized = normalizeGitHubUrl(url);
    if (!normalized) return;
    
    // Key: Base64 of normalized URL to avoid issues with slashes in document IDs
    const linkId = buildReferralLinkDocId(normalized);
    await db.collection('referral_links').doc(linkId).set({
        url: normalized,
        tutorEmail,
        tutorName: tutorName || tutorEmail,
        unitId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[ReferralSync] ✅ Indexed ${normalized} -> ${tutorEmail}`);
}

async function upsertStudentUnitAssignment(db, studentUid, unitId, tutorEmail, assignedByUid = 'system', notify = true) {
    const userRef = db.collection('users').doc(studentUid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const previousTutor = userData.unitAssignments?.[unitId] || null;

    await userRef.set({
        unitAssignments: {
            [unitId]: tutorEmail || null
        },
        lastAssignmentUpdate: admin.firestore.FieldValue.serverTimestamp(),
        lastAssignedBy: assignedByUid
    }, { merge: true });

    if (notify && tutorEmail && previousTutor !== tutorEmail) {
        const studentName = resolveNameFromUserData(userData, userData.email, "");
        const studentEmail = userData.email;

        if (studentEmail) {
            await sendStudentLinkedToTutorEmail(studentEmail, studentName, unitId, tutorEmail);
        }
        await sendTutorLinkedToStudentEmail(tutorEmail, studentName, unitId);
    }

    return { previousTutor, changed: previousTutor !== (tutorEmail || null) };
}

async function resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons = [], tutorMode = false) {
    const normalizedCourseId = normalizeLegacyId(courseId || '');
    const normalizedUnitId = normalizeLegacyId(unitId || '');

    // 1. Resolve Canonical Context
    let canonicalUnitId = resolveCanonicalUnitId(normalizedUnitId, lessons);
    const course = findCourseByPageOrUnit(normalizedCourseId, canonicalUnitId, lessons) || findCourseByPageOrUnit(normalizedCourseId, normalizedUnitId, lessons);
    const lessonByCourseRef = findLessonByCourseRef(normalizedCourseId, lessons)
        || findLessonByCourseRef(normalizedUnitId, lessons)
        || findLessonByCourseRef(canonicalUnitId, lessons)
        || null;
    const effectiveCourseId = course
        ? (getCanonicalLessonIdentity(course) || course.courseId)
        : (getCanonicalLessonIdentity(lessonByCourseRef) || normalizedCourseId || findParentCourseIdByUnit(canonicalUnitId, lessons));
    // Course-level checks (e.g. started/basic/advanced cards) may only pass courseId.
    // In that case, infer a representative unit from metadata so access is not falsely denied.
    if (!canonicalUnitId && course && Array.isArray(course.courseUnits) && course.courseUnits.length > 0) {
        canonicalUnitId = resolveCanonicalUnitId(course.courseUnits[0], lessons);
    }
    const isPhysicalProduct = !!(course && course.isPhysical === true);

    // 2. Fetch User Data and Security Role
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const isAdminRole = userData.role === 'admin';

    const lookupUnitId = canonicalUnitId || normalizedUnitId || '';
    const assignedTutorEmail = userData.unitAssignments?.[lookupUnitId] || null;
    const assignedPromotionCode = userData.unitAssignmentMeta?.[lookupUnitId]?.promotionCode || null;

    // [V13.6] Special Physical Product Enforcement
    // Rule: Hardware sales ALWAYS prioritize purchase flow. No bypasses for ANYONE.
    if (isPhysicalProduct) {
        console.log(`[resolveAccess] ENFORCING Purchase Flow for Physical Product: ${effectiveCourseId}`);
        // Skip all bypasses and jump directly to Order Check (below)
    } else {
        // [V13.0.22] Master Bypass (Tutor Mode Simulation)
        // If an authorized admin toggles simulation ON, grant immediate access to DIGITAL units.
        if (tutorMode && isAdminRole) {
            console.log(`[resolveAccess] SUCCESS: Admin Simulation Bypass for ${uid}`);
            return { 
                authorized: true, 
                simulated: true, 
                accessMode: 'admin_simulated',
                canonicalUnitId: canonicalUnitId,
                effectiveCourseId: effectiveCourseId,
                assignedTutorEmail: assignedTutorEmail,
                assignedPromotionCode: assignedPromotionCode
            };
        }

        // [V15.7] Enforce simulation: If Admin Simulation is OFF, skip teacher/tutor-related privileges.
        // This ensures Admins can test the student paywall experience accurately.
        const shouldSkipTutorBypass = isAdminRole && !tutorMode;

        if (!shouldSkipTutorBypass) {
            // Status-based Authorization: Fully Qualified Tutors for the Course
            if (effectiveCourseId && isTutorFullyQualifiedForCourse(userData, effectiveCourseId, lessons)) {
                console.log(`[resolveAccess] SUCCESS: Fully Qualified Tutor Bypass for ${uid} on ${effectiveCourseId}`);
                return { 
                    authorized: true, 
                    accessMode: 'fully_qualified_tutor', 
                    canonicalUnitId, 
                    effectiveCourseId, 
                    assignedTutorEmail, 
                    assignedPromotionCode,
                    course 
                };
            }

            // Status-based Authorization: Qualified Tutors for their units (Digital Only)
            const effectiveTutorCfg = getEffectiveTutorConfig(canonicalUnitId, userData.tutorConfigs || {});
            const isQualifiedTutorForThisUnit = !!(effectiveTutorCfg && effectiveTutorCfg.authorized === true);
            if (isQualifiedTutorForThisUnit) {
                return { authorized: true, accessMode: 'qualified_tutor', canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course };
            }
        }

        // FREE COURSE (NT$ 0) (Digital Only)
        const freeCourseContext = course || lessonByCourseRef;
        const lessonPrice = freeCourseContext
            ? Math.max(
                Number(resolveLessonPrice(freeCourseContext, "zh-TW").amount || 0),
                Number(resolveLessonPrice(freeCourseContext, "en").amount || 0)
              )
            : Math.max(
                Number(resolveLessonPrice(findLessonByCourseRef(effectiveCourseId, lessons) || {}, "zh-TW").amount || 0),
                Number(resolveLessonPrice(findLessonByCourseRef(effectiveCourseId, lessons) || {}, "en").amount || 0)
              ) || 9999;
        const isFreeCourse = !!(freeCourseContext && parseInt(lessonPrice, 10) === 0);
        if (isFreeCourse) {
            return { authorized: true, accessMode: 'free_course', canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course: freeCourseContext };
        }

        // Trial Course (Started category, within 30 days) (Digital Only)
        const now = Date.now();
        const userRecord = await admin.auth().getUser(uid);
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const isTrialCourse = !!(course && (course.category === 'start' || course.category === 'started') && ((now - new Date(userRecord.metadata.creationTime).getTime()) < THIRTY_DAYS_MS));
        if (isTrialCourse) {
            return { authorized: true, accessMode: 'trial_course', canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course };
        }
    }

    if (!effectiveCourseId) {
        console.warn(`[resolveAccess] FAIL: Missing context for UID:${uid} Page:${courseId} Unit:${unitId}`);
        return { authorized: false, reason: 'missing-context', canonicalUnitId, effectiveCourseId };
    }

    const ordersSnapshot = await db.collection('orders')
        .where('uid', '==', uid)
        .where('status', '==', 'SUCCESS')
        .get();

    const hasPaidCourse = !ordersSnapshot.empty && hasActiveOrderForCourse(ordersSnapshot, effectiveCourseId, lessons);
    if (!hasPaidCourse) {
        return {
            authorized: false,
            reason: 'payment-required',
            accessMode: 'payment_required',
            canonicalUnitId,
            effectiveCourseId,
            assignedTutorEmail: null,
            course
        };
    }

    return {
        authorized: true,
        accessMode: 'paid_student',
        canonicalUnitId,
        effectiveCourseId,
        assignedTutorEmail,
        assignedPromotionCode,
        requiresTutorAssignment: !isPhysicalProduct,
        course
    };
}

// [NEW] API to expose lessons to frontend
exports.getLessonsMetadata = onCall(async (request) => {
    console.log("[getLessonsMetadata] Starting onCall request...");
    const lessons = await getLessons();
    let categoryLabels = {};
    try {
        const settingsSnap = await admin.firestore().collection('metadata_settings').doc('learning_paths').get();
        if (settingsSnap.exists) {
            categoryLabels = settingsSnap.data().categoryLabels || {};
        }
    } catch (e) {
        console.error("[getLessonsMetadata] Failed to fetch learning_paths settings:", e);
    }
    console.log(`[getLessonsMetadata] Returning ${lessons.length} lessons and categoryLabels to caller.`);
    return { lessons: lessons, categoryLabels: categoryLabels };
});

/**
 * [i18n Admin] 更新課程英文多語系欄位（僅限 admin 角色）
 * 接受 { courseId, titleEn, summaryEn, descriptionEn, coreContentEn, lessonLabelEn }
 * 寫入對應 metadata_lessons 文件的 *En 欄位
 */
exports.updateLessonI18n = onCall(async (request) => {
    const { auth, data } = request;

    // 驗證登入與 admin 角色
    assertAuthenticated(auth);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(userData.role);

    const { courseId, titleEn, summaryEn, descriptionEn, coreContentEn, lessonLabelEn } = data || {};
    assertRequiredValue(courseId, 'missing-course-id');

    // 查找對應的 metadata_lessons 文件（以 courseId 為主鍵）
    const lessonsSnap = await db.collection('metadata_lessons')
        .where('courseId', '==', courseId)
        .limit(1)
        .get();

    if (lessonsSnap.empty) {
        throw new HttpsError('not-found', `lesson-not-found: ${courseId}`);
    }

    const lessonDocRef = lessonsSnap.docs[0].ref;

    // 只寫入有值的欄位（undefined 不覆蓋）
    const updatePayload = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        i18nUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        i18nUpdatedBy: auth.uid,
    };
    if (typeof titleEn === 'string') updatePayload.titleEn = normalizeText(titleEn);
    if (typeof summaryEn === 'string') updatePayload.summaryEn = normalizeText(summaryEn);
    if (typeof descriptionEn === 'string') updatePayload.descriptionEn = normalizeText(descriptionEn);
    if (Array.isArray(coreContentEn)) updatePayload.coreContentEn = coreContentEn.map(s => normalizeText(s)).filter(Boolean);
    if (typeof lessonLabelEn === 'string') updatePayload.lessonLabelEn = normalizeText(lessonLabelEn);

    await lessonDocRef.set(updatePayload, { merge: true });
    console.log(`[updateLessonI18n] ✅ Updated i18n fields for courseId=${courseId} by uid=${auth.uid}`);

    return { success: true, courseId };
});

/**
 * [System Settings Admin] 更新系統全域參數設定（僅限 admin 角色）
 * 接受 { contentVersion }
 */
exports.updateSystemConfig = onCall(async (request) => {
    const { auth, data } = request;

    // 驗證登入與 admin 角色
    assertAuthenticated(auth);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(userData.role);

    const { contentVersion } = data || {};
    if (contentVersion !== undefined) {
        if (typeof contentVersion !== 'string' || contentVersion.trim().length < 7) {
            throw new HttpsError('invalid-argument', 'invalid-content-version-hash');
        }
        
        // 寫入 metadata_settings/content_runtime
        await db.collection('metadata_settings').doc('content_runtime').set({
            contentVersion: contentVersion.trim(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.uid
        }, { merge: true });
        
        console.log(`[updateSystemConfig] ✅ Updated contentVersion to ${contentVersion} by uid=${auth.uid}`);
        
        // 自動清除快取
        await purgeContentCacheHelper(db);
    }

    return { success: true };
});

/**
 * [System Settings Admin] 一鍵清除內容 HTML 快取（僅限 admin 角色）
 */
exports.purgeContentCache = onCall(async (request) => {
    const { auth } = request;

    // 驗證登入與 admin 角色
    assertAuthenticated(auth);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(userData.role);

    await purgeContentCacheHelper(db);
    return { success: true };
});

/**
 * [User Relations Admin] 更新使用者業務關係設定（僅限 admin 角色）
 * 接受 { targetUid, agentEmail, tutorEmail, courseDevEmail }
 */
exports.updateUserRelationships = onCall(async (request) => {
    const { auth, data } = request;

    // 驗證登入與 admin 角色
    assertAuthenticated(auth);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(userData.role);

    const { targetUid, agentEmail, tutorEmail, courseDevEmail } = data || {};
    assertRequiredValue(targetUid, 'missing-target-uid');

    const updatePayload = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (agentEmail !== undefined) updatePayload.agentEmail = agentEmail ? normalizeEmail(agentEmail) : "";
    if (tutorEmail !== undefined) updatePayload.tutorEmail = tutorEmail ? normalizeEmail(tutorEmail) : "";
    if (courseDevEmail !== undefined) updatePayload.courseDevEmail = courseDevEmail ? normalizeEmail(courseDevEmail) : "";

    await db.collection('users').doc(targetUid).set(updatePayload, { merge: true });
    console.log(`[updateUserRelationships] ✅ Updated user relationships for targetUid=${targetUid} by admin=${auth.uid}`);

    return { success: true };
});

/**
 * [User Relations Admin] 查詢使用者設定與業務關係（僅限 admin 角色）
 * 接受 { searchKey } (可以是 email 或 uid)
 */
exports.getUserRelationships = onCall(async (request) => {
    const { auth, data } = request;

    // 驗證登入與 admin 角色
    assertAuthenticated(auth);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(userData.role);

    const { searchKey } = data || {};
    if (!searchKey) {
        throw new HttpsError('invalid-argument', 'missing-search-key');
    }

    const cleanKey = String(searchKey).trim();

    // 1. Try search by UID
    let targetDoc = await db.collection('users').doc(cleanKey).get();
    
    // 2. If not found by UID, try search by email
    if (!targetDoc.exists) {
        const emailSnap = await db.collection('users')
            .where('email', '==', cleanKey.toLowerCase())
            .limit(1)
            .get();
        if (!emailSnap.empty) {
            targetDoc = emailSnap.docs[0];
        }
    }

    if (!targetDoc.exists) {
        throw new HttpsError('not-found', 'user-not-found');
    }

    const targetData = targetDoc.data() || {};
    return {
        uid: targetDoc.id,
        email: targetData.email || "",
        name: targetData.name || targetData.displayName || "",
        role: targetData.role || "user",
        agentEmail: targetData.agentEmail || "",
        tutorEmail: targetData.tutorEmail || "",
        courseDevEmail: targetData.courseDevEmail || ""
    };
});

async function purgeContentCacheHelper(db) {
    console.log(`[purgeContentCacheHelper] Starting cache purge...`);
    const cacheSnap = await db.collection('content_cache').get();
    if (cacheSnap.empty) {
        console.log(`[purgeContentCacheHelper] No cache records found.`);
        return;
    }

    const batchSize = 100;
    let batch = db.batch();
    let count = 0;

    for (const doc of cacheSnap.docs) {
        batch.delete(doc.ref);
        count++;
        if (count % batchSize === 0) {
            await batch.commit();
            batch = db.batch();
        }
    }

    if (count % batchSize !== 0) {
        await batch.commit();
    }
    
    // 同時清除本機記憶體快取
    if (typeof CONTENT_FILE_CACHE !== 'undefined' && CONTENT_FILE_CACHE.clear) {
        CONTENT_FILE_CACHE.clear();
    }

    console.log(`[purgeContentCacheHelper] ✅ Purged ${count} cache files from content_cache.`);
}

/**
 * [Pricing Admin] 更新課程多地區價格欄位（僅限 admin 角色）
 * 接受 { courseId, pricing }
 * pricing 支援 { tw: { amount, currency }, en: { amount, currency } }
 */
exports.upsertLessonPricing = onCall(async (request) => {
    const { auth, data } = request;

    assertAuthenticated(auth);
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    assertAdminRole(userData.role);

    const { courseId, pricing } = data || {};
    assertRequiredValue(courseId, 'missing-course-id');
    assertRequiredValue(pricing && typeof pricing === 'object', 'missing-pricing');

    const normalizePriceEntry = (entry, fallbackCurrency) => {
        const rawAmount = Number(entry?.amount ?? entry?.price ?? entry?.value ?? 0);
        const amount = Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;
        const rawCurrency = normalizeText(entry?.currency || entry?.currencyCode || fallbackCurrency || '');
        const currency = rawCurrency ? rawCurrency.toUpperCase() : fallbackCurrency;
        return { amount, currency };
    };

    const tw = normalizePriceEntry(pricing.tw, 'TWD');
    const en = normalizePriceEntry(pricing.en, 'USD');
    const pricePayload = {
        pricing: {
            tw,
            en
        },
        priceByLocale: {
            'zh-TW': tw,
            en
        },
        priceByRegion: {
            tw,
            en
        },
        priceMap: {
            tw,
            en
        },
        prices: {
            tw: tw.amount,
            en: en.amount
        },
        price_twd: tw.amount,
        price_usd: en.amount,
        currency: tw.currency || 'TWD',
        pricingVersion: 'v2',
        pricingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        pricingUpdatedBy: auth.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const lessonsSnap = await db.collection('metadata_lessons')
        .where('courseId', '==', courseId)
        .limit(1)
        .get();

    let lessonDocRef = null;
    if (!lessonsSnap.empty) {
        lessonDocRef = lessonsSnap.docs[0].ref;
    } else {
        const docSnap = await db.collection('metadata_lessons').doc(courseId).get();
        if (docSnap.exists) {
            lessonDocRef = docSnap.ref;
        }
    }

    if (!lessonDocRef) {
        throw new HttpsError('not-found', `lesson-not-found: ${courseId}`);
    }

    await lessonDocRef.set(pricePayload, { merge: true });
    console.log(`[upsertLessonPricing] ✅ Updated pricing for courseId=${courseId} by uid=${auth.uid}`);

    return {
        success: true,
        courseId,
        pricing: pricePayload.pricing
    };
});


// [V12.4.7] ONCALL WRAPPER: For frontend's httpsCallable('checkPaymentAuthorization')
exports.checkPaymentAuthorization = onCall(async (request) => {
    const { data, auth } = request;
    if (!auth) return { authorized: false };

    try {
        const { pageId, fileName, tutorMode } = data;
        const lessons = await getLessons();
        const db = admin.firestore();

        // [V12.4.9] Robust Authorization Check using central logic
        const access = await resolveStudentAssignmentAccess(
            db, 
            auth.uid, 
            pageId, 
            fileName, 
            lessons, 
            tutorMode === true
        );

        if (access.authorized) {
            // [V13.0.8] Generate token for serveCourse (Bound to client IP and student UID)
            const expiry = Date.now() + 30 * 60 * 1000; // 30 mins
            const normalizedPageId = normalizeCourseVariantKey(pageId || fileName || "UNDEFINED") || "UNDEFINED";
            const normalizedScopePart = normalizeCourseVariantKey(fileName || pageId || "UNDEFINED") || normalizedPageId;
            
            const clientIp = collectClientIpCandidates(request)[0];
            
            const raw = `${normalizedPageId}|${normalizedScopePart}|${expiry}|${auth.uid}|${clientIp}`;
            const signature = crypto.createHmac('sha256', HASH_KEY).update(raw).digest('hex');
            const token = `${raw}|${signature}`;

            return { 
                authorized: true,
                token: token
            };
        }

        return { 
            authorized: false,
            reason: access.reason || null
        };
    } catch (e) {
        console.error("Auth check failed:", e);
        return { authorized: false, error: e.message };
    }
});



const normalizeLocale = (locale = "") => {
    const raw = normalizeText(locale || "");
    if (!raw) return "";
    if (/^zh[-_]tw$/i.test(raw)) return "zh-TW";
    if (/^zh/i.test(raw)) return "zh-TW";
    if (/^en/i.test(raw)) return "en";
    return raw;
};

const normalizeCourseFile = (value = '') => {
    if (!value) return value;
    const filePart = String(value).split('/').pop().split('?')[0];
    return filePart;
};

const normalizeCourseVariantKey = (value = '') => {
    const filePart = normalizeCourseFile(value);
    if (!filePart) return '';
    const bare = String(filePart)
        .replace(/\.html$/i, '')
        .replace(/^(?:tw|en)-/i, '')
        .toLowerCase();

    if (/^start-\d{2}-unit-/i.test(bare)) return bare.replace(/^start-\d{2}-unit-/i, 'car-starter-');
    if (/^basic-\d{2}-unit-/i.test(bare)) return bare.replace(/^basic-\d{2}-unit-/i, 'car-basic-');
    if (/^(?:adv|advanced)-\d{2}-unit-/i.test(bare)) return bare.replace(/^(?:adv|advanced)-\d{2}-unit-/i, 'car-advanced-');
    if (/^\d{2}-unit-/i.test(bare)) return bare.replace(/^\d{2}-unit-/i, 'common-');
    if (/^prepare-\d+-(.+)$/i.test(bare)) return bare.replace(/^prepare-\d+-/, 'common-');
    return bare;
};

async function fetchExternalCourseContentHelper(candidateFileName, runtimeConfig, locales) {
    if (!runtimeConfig?.enabled) return null;
    const contentRepoToken = CONTENT_REPO_TOKEN.value();
    const hasContentToken = Boolean(contentRepoToken);
    if (!hasContentToken) {
        console.warn("[content-runtime] CONTENT_REPO_TOKEN missing, skip external fetch.");
        return null;
    }
    const repoOwner = runtimeConfig.repoOwner;
    const repoName = runtimeConfig.repoName;
    const ref = runtimeConfig.contentVersion || "main";
    for (const locale of locales) {
        const localeCandidates = buildI18nFilenameCandidates(candidateFileName, locale);
        for (const localeCandidate of localeCandidates) {
            const key = `${repoOwner}/${repoName}@${ref}|${locale}|${localeCandidate}`;
            const cacheDocId = crypto.createHash('md5').update(key).digest('hex');

            // 1. 嘗試讀取本地記憶體快取
            const cached = CONTENT_FILE_CACHE.get(key);
            if (cached && cached.expiresAt > Date.now()) {
                return { content: cached.content, source: "external-cache", locale, file: localeCandidate };
            }

            // 2. 嘗試讀取 Firestore 共享快取
            try {
                const cacheDoc = await db.collection('course_cache').doc(cacheDocId).get();
                if (cacheDoc.exists) {
                    const cacheData = cacheDoc.data();
                    if (cacheData && cacheData.expiresAt > Date.now()) {
                        // 寫回本地記憶體快取
                        CONTENT_FILE_CACHE.set(key, {
                            content: cacheData.content,
                            expiresAt: cacheData.expiresAt
                        });
                        console.log(`[content-runtime] source=external-cache-shared file=${localeCandidate} locale=${locale}`);
                        return { content: cacheData.content, source: "external-cache-shared", locale, file: localeCandidate };
                    }
                }
            } catch (err) {
                console.warn(`[content-runtime] Firestore cache read error:`, err.message || err);
            }

            // 3. 快取均未命中，向 GitHub API 請求
            const contentPath = `courses/${locale}/${localeCandidate}`;
            const apiUrl = `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/contents/${contentPath}?ref=${encodeURIComponent(ref)}`;
            try {
                const startedAt = Date.now();
                const headers = {
                    "Authorization": `Bearer ${contentRepoToken}`,
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "vibe-coding-runtime"
                };
                const resp = await fetch(apiUrl, {
                    method: "GET",
                    headers
                });
                if (!resp.ok) {
                    if (resp.status !== 404) {
                        console.warn(`[content-runtime] external fetch non-404: ${resp.status} ${contentPath}`);
                    }
                    continue;
                }
                const payload = await resp.json();
                const encoded = String(payload?.content || "").replace(/\n/g, "");
                if (!encoded) continue;
                const content = Buffer.from(encoded, "base64").toString("utf8");
                const expiresAt = Date.now() + (Math.max(30, Number(runtimeConfig.cacheTtlSec || 300)) * 1000);

                // 寫入本地記憶體快取
                CONTENT_FILE_CACHE.set(key, {
                    content,
                    expiresAt
                });

                // 寫入 Firestore 共享快取 (非同步，不阻塞請求)
                db.collection('course_cache').doc(cacheDocId).set({
                    content,
                    expiresAt,
                    key,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(err => {
                    console.warn(`[content-runtime] Firestore cache write error:`, err.message || err);
                });

                console.log(`[content-runtime] source=external file=${localeCandidate} locale=${locale} ms=${Date.now() - startedAt}`);
                return { content, source: "external", locale, file: localeCandidate };
            } catch (err) {
                console.warn(`[content-runtime] external fetch failed for ${contentPath}:`, err.message || err);
            }
        }
    }
    return null;
}

// 4. 安全檔案服務 (serveCourse)
// ==========================================
// trigger cache clear and container recycle
exports.serveCourse = onRequest({ secrets: [CONTENT_REPO_TOKEN] }, async (req, res) => {
    const resolvePreferredLocales = (runtimeConfig = null) => {
        const queryLocale = normalizeLocale(req.query.lang || req.query.locale || "");
        const header = String(req.headers["accept-language"] || "");
        const headerPrimary = normalizeLocale(header.split(",")[0] || "");
        const chain = [];
        if (queryLocale) chain.push(queryLocale);
        if (headerPrimary && !chain.includes(headerPrimary)) chain.push(headerPrimary);
        const defaultLocale = normalizeLocale(runtimeConfig?.defaultLocale || "zh-TW") || "zh-TW";
        if (!chain.includes(defaultLocale)) chain.push(defaultLocale);
        return chain;
    };

    const fetchExternalCourseContent = async (candidateFileName, runtimeConfig) => {
        const locales = resolvePreferredLocales(runtimeConfig);
        return fetchExternalCourseContentHelper(candidateFileName, runtimeConfig, locales);
    };

    const normalizeLooseKey = (value = "") => normalizeCourseVariantKey(value);
    const buildAuthorizedFileCandidates = (course = {}) => {
        const candidates = new Set();
        const addCandidate = (value = "") => {
            const normalized = normalizeCourseFile(value);
            if (normalized) candidates.add(normalizeLooseKey(normalized));
        };

        // 為了確保不論使用者當前的語系（Locale）為何，都能在有授權時存取該單元的所有語系版本，
        // 授權的候選檔案名稱列表（authorizedCandidates）必須同時包含 zh-TW 與 en 的翻譯候選檔案。
        const locales = Array.from(new Set([...resolvePreferredLocales(), "zh-TW", "en"]));
        const addLegacyAndI18n = (value = "") => {
            const normalized = normalizeCourseFile(value);
            if (!normalized) return;
            addCandidate(normalized);
            for (const locale of locales) {
                for (const alt of buildI18nFilenameCandidates(normalized, locale)) {
                    addCandidate(alt);
                }
            }
        };

        addLegacyAndI18n(course.entryUnitId || "");
        const legacyLessonUrl = course.classroomUrl || "";
        addLegacyAndI18n(legacyLessonUrl);
        addLegacyAndI18n(course.contentRef || "");

        (Array.isArray(course.courseUnits) ? course.courseUnits : []).forEach(unitId => addLegacyAndI18n(unitId));

        return candidates;
    };
    const findCourseForScope = (lessons = [], scopeValue = "", pageValue = "") => {
        const normalizedScope = normalizeLooseKey(scopeValue);
        const normalizedPage = normalizeLooseKey(pageValue);
        return lessons.find((lesson) => {
            const lessonKeys = new Set([
                ...Array.from(getLessonLookupKeys(lesson)).map((value) => normalizeLooseKey(value)),
                normalizeLooseKey(lesson.contentRef || "")
            ].filter(Boolean));

            if (lessonKeys.has(normalizedScope) || lessonKeys.has(normalizedPage)) {
                return true;
            }

            const units = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
            return units.some(unitId =>
                unitIdsMatch(unitId, normalizedScope) ||
                unitIdsMatch(unitId, normalizedPage) ||
                normalizeLooseKey(unitId) === normalizedScope ||
                normalizeLooseKey(unitId) === normalizedPage
            );
        });
    };

    // 1. Parsing Path (e.g. /courses/ble-connection-master.html)
    const urlPath = req.path; // /courses/foo.html
    // [FIXED v11.3.8] More robust fileName extraction (strips leading slashes)
    const fileName = urlPath.split('/').filter(Boolean).pop();

    // [NEW] Redirection for Retired Master Pages to corresponding entryUnitId
    const canonicalRedirectTarget = mapLegacyMasterToCanonical(fileName);
    if (canonicalRedirectTarget && canonicalRedirectTarget !== fileName) {
        const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
        console.log(`[serveCourse] Redirecting legacy master ${fileName} to canonical unit ${canonicalRedirectTarget}`);
        return res.redirect(301, `/courses/${canonicalRedirectTarget}${queryStr}`);
    }

    // 2. Security Check (Token)
    const token = req.query.token;

    console.log(`[serveCourse] Path: ${urlPath}, FileName: ${fileName}, Token Provided: ${!!token}`);

    if (!token) {
        console.warn(`[serveCourse] Access Denied: No token. Query:`, req.query);
        return res.status(403).send("Access Denied: No token provided.");
    }

    try {
        const parts = token.split('|');
        let pageId, scopePart, expiryStr, uid, tokenIp, signature;
        let expectedSignature;
        let expiry;

        if (parts.length === 6) {
            [pageId, scopePart, expiryStr, uid, tokenIp, signature] = parts;
            expiry = parseInt(expiryStr);
            const raw = `${pageId}|${scopePart}|${expiry}|${uid}|${tokenIp}`;
            expectedSignature = crypto.createHmac('sha256', HASH_KEY).update(raw).digest('hex');

            if (signature !== expectedSignature) {
                return res.status(403).send("Access Denied: Invalid signature.");
            }

            // Verify IP Address
            const cleanTokenIp = normalizeClientIp(tokenIp);
            const currentClientIps = collectClientIpCandidates(req);
            const matchedClientIp = currentClientIps.find((ip) => normalizeClientIp(ip) === cleanTokenIp);

            if (!matchedClientIp && cleanTokenIp !== '127.0.0.1' && !currentClientIps.includes('127.0.0.1')) {
                console.warn(`[serveCourse] IP Mismatch: token=${cleanTokenIp}, currentCandidates=${currentClientIps.join(',')}`);
                return res.status(403).send("Access Denied: Invalid client context.");
            }
        } else if (parts.length === 4) {
            [pageId, scopePart, expiryStr, signature] = parts;
            expiry = parseInt(expiryStr);
            const raw = `${pageId}|${scopePart}|${expiry}`;
            expectedSignature = crypto.createHmac('sha256', HASH_KEY).update(raw).digest('hex');

            if (signature !== expectedSignature) {
                return res.status(403).send("Access Denied: Invalid signature.");
            }
        } else {
            return res.status(403).send("Access Denied: Invalid token format.");
        }

        // C. Normalize target filename
        let normalizedFileName = normalizeCourseFile(fileName);
        const runtimeConfig = await getContentRuntimeConfig(db);

        if (fileName.match(/^0[1-5]-/) && !fileName.includes('-master-')) {
            normalizedFileName = 'start-' + fileName;
            console.log(`[serveCourse] Early Normalization (Conditional): ${fileName} -> ${normalizedFileName}`);
        }

        const normalizedFileVariantKey = normalizeCourseVariantKey(normalizedFileName);
        const normalizedScopePart = normalizeCourseFile(scopePart);
        const normalizedScopeVariantKey = normalizeCourseVariantKey(normalizedScopePart);
        const normalizedPageVariantKey = normalizeCourseVariantKey(pageId || '');

        // B. Validate Expiry
        if (Date.now() > expiry) {
            return res.status(403).send("Access Denied: Token expired.");
        }

        // C. Validate File Scope Dynamic Logic
        let isAuthorizedScope = (
            scopePart === fileName ||
            normalizedScopePart === normalizedFileName ||
            normalizeCourseFile(scopePart) === normalizeCourseFile(fileName) ||
            normalizedScopeVariantKey === normalizedFileVariantKey ||
            normalizedPageVariantKey === normalizedFileVariantKey
        );
        let debugInfo = "None";
        let lessons = [];

        if (!isAuthorizedScope) {
            try {
                // Use the centralized getLessons helper [FIXED v11.3.14]
                lessons = await getLessons();

                // [MODIFIED] Map legacy scopePart/pageId values to canonical unit counterparts
                // so they find and validate scoped candidates correctly against migrated canonical records.
                const normalizedPageId = normalizeCourseFile(pageId || '');
                const shouldApplyLegacyScopeCompatibility =
                    isLegacyMasterPage(fileName) ||
                    isLegacyMasterPage(normalizedScopePart) ||
                    isLegacyMasterPage(normalizedPageId);
                const mappedScopePart = shouldApplyLegacyScopeCompatibility
                    ? mapLegacyMasterToCanonical(normalizedScopePart)
                    : normalizedScopePart;
                const mappedPageId = shouldApplyLegacyScopeCompatibility
                    ? mapLegacyMasterToCanonical(normalizedPageId)
                    : normalizedPageId;

                // Find the course by pageId/courseId/courseKey/entryUnitId or scopePart
                const course = findCourseForScope(lessons, mappedScopePart, mappedPageId);

                if (course) {
                    const authorizedCandidates = buildAuthorizedFileCandidates(course);
                    const requestedFileKey = normalizeLooseKey(normalizedFileName);
                    const isCourseScopedMatch = authorizedCandidates.has(requestedFileKey);

                    debugInfo = `CourseFound: ${course.courseId || course.courseKey || "unknown"}, requested=${requestedFileKey}, entryUnitId=${normalizeCourseFile(course.entryUnitId || "")}, candidates=${authorizedCandidates.size}`;

                    if (isCourseScopedMatch) {
                        isAuthorizedScope = true;
                        console.log(`[serveCourse] ${normalizedFileName} authorized via dynamic course-scope: ${scopePart}`);
                    }
                } else {
                    debugInfo = `CourseNotFound for Scope: ${scopePart} (mapped=${mappedScopePart}). LessonsCount: ${lessons.length}`;
                }
            } catch (jsonErr) {
                console.error("[serveCourse] JSON Scope check failed:", jsonErr);
                debugInfo = `JSON Error: ${jsonErr.message}`;
            }
        }

        if (!isAuthorizedScope) {
            console.error(`Access Denied Debug: Scope=${scopePart} (normalized=${normalizedScopePart}), File=${normalizedFileName}, Debug=${debugInfo}`);
            return res.status(403).send(`Access Denied: Token valid for ${scopePart}, but requested ${normalizedFileName}.`);
        }

        // 3. Serve File
        const finalServeName = normalizedFileName; 
        let resolvedSource = "none";
        let content = "";
        
        const externalHit = await fetchExternalCourseContent(finalServeName, runtimeConfig);
        if (externalHit && externalHit.content) {
            content = externalHit.content;
            resolvedSource = externalHit.source;
        } else {
            // [NEW v11.3.9] Legacy Name Fallback (01- to start-01- / start-01- to 01-) via external content repo
            let altFileName;
            if (fileName.startsWith('start-')) altFileName = fileName.replace('start-', '');
            else if (fileName.match(/^0[1-5]-/)) altFileName = 'start-' + fileName;

            if (altFileName) {
                const altExternalHit = await fetchExternalCourseContent(altFileName, runtimeConfig);
                if (altExternalHit && altExternalHit.content) {
                    console.log(`[serveCourse] Legacy Fallback via external: ${fileName} -> ${altFileName}`);
                    content = altExternalHit.content;
                    resolvedSource = altExternalHit.source;
                }
            }
        }

        if (!content) {
            return res.status(404).send("File not found.");
        }

        // [NEW] Normalize legacy hashed core script links to stable runtime assets.
        content = content
            .replace(/\/js\/course-shared\.[0-9a-f]{12}\.js\b/gi, '/js/course-shared.js')
            .replace(/\/js\/nav-component\.[0-9a-f]{12}\.js\b/gi, '/js/nav-component.js');

        // Ensure core course scripts are always present even when content-repo omits them.
        const hasStableCourseSharedScript = /\/js\/course-shared\.js/i.test(content);
        const hasStableNavComponentScript = /\/js\/nav-component\.js/i.test(content);
        const runtimeScripts = [];
        if (!hasStableCourseSharedScript) {
            runtimeScripts.push('<script src="/js/course-shared.js"></script>');
        }
        if (!hasStableNavComponentScript) {
            runtimeScripts.push('<script type="module" src="/js/nav-component.js"></script>');
        }
        console.log(`[serveCourse] content_source=${resolvedSource} file=${finalServeName}`);
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
            window.resizeIframe = (obj) => { if(obj && obj.contentWindow) obj.style.height = obj.contentWindow.document.documentElement.scrollHeight + 'px'; };
            console.log("[Firebase] SDK Injected & Initialized");
        </script>
        `;

        const runtimeScriptBlock = runtimeScripts.length
            ? `\n<!-- [Runtime Script Fallback] -->\n${runtimeScripts.join("\n")}\n`
            : "";

        // Insert before </body> or at the end
        if (content.includes('</body>')) {
            content = content.replace('</body>', `${runtimeScriptBlock}${bootstrapper}</body>`);
        } else {
            content += runtimeScriptBlock + bootstrapper;
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
        if (userDoc.exists) {
            const role = userDoc.data().role;
            return role === 'admin' ? 'admin' : 'user';
        }
    } catch (e) {
        console.error("[Role] Error in getRole:", e);
    }
    return 'user'; // Default to user
};

// ==========================================
// 5. 設定用戶角色 (setUserRole - Admin Only)
// ==========================================
exports.setUserRole = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, 'User must be logged in.');

    const adminUid = auth.uid;
    const adminRole = await getRole(adminUid);

    // NOTE: For bootstrapping, you might need to temporarily bypass this or set the first admin in Firestore Console.
    assertAdminRole(adminRole, 'Only admins can set roles.');

    const { email, role } = data;

    assertRequiredValue(['user', 'admin'].includes(role), 'Invalid role.');

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

exports.getRevenueSharePolicies = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can read revenue policies.');

    const defaultPolicyRef = db.collection('revenue_share_policies').doc(DEFAULT_REVENUE_SHARE_POLICY.policyId);
    const snap = await defaultPolicyRef.get();
    const raw = snap.exists ? (snap.data() || {}) : {};
    const policies = [{
        id: DEFAULT_REVENUE_SHARE_POLICY.policyId,
        policyId: DEFAULT_REVENUE_SHARE_POLICY.policyId,
        policyName: raw.policyName || DEFAULT_REVENUE_SHARE_POLICY.policyName,
        tutorRate: Number(raw.tutorRate ?? DEFAULT_REVENUE_SHARE_POLICY.tutorRate),
        tutorUplineRate: Number(raw.tutorUplineRate ?? DEFAULT_REVENUE_SHARE_POLICY.tutorUplineRate),
        agentRate: Number(raw.agentRate ?? DEFAULT_REVENUE_SHARE_POLICY.agentRate),
        agentUplineRate: Number(raw.agentUplineRate ?? DEFAULT_REVENUE_SHARE_POLICY.agentUplineRate),
        courseDevRate: Number(raw.courseDevRate ?? DEFAULT_REVENUE_SHARE_POLICY.courseDevRate),
        courseDevUplineRate: Number(raw.courseDevUplineRate ?? DEFAULT_REVENUE_SHARE_POLICY.courseDevUplineRate),
        enabled: raw.enabled !== false
    }];
    return { policies };
});

exports.upsertRevenueSharePolicy = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can write revenue policies.');

    const payload = request.data || {};
    const policyId = normalizeText(payload.policyId || '');
    assertRequiredValue(policyId, 'policyId is required');
    if (policyId !== DEFAULT_REVENUE_SHARE_POLICY.policyId) {
        throw new HttpsError('failed-precondition', 'Only the default revenue sharing policy is supported.');
    }

    const asRate = (v, fallback = 0) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return fallback;
        if (n < 0) return 0;
        if (n > 1) return 1;
        return n;
    };

    const docRef = db.collection('revenue_share_policies').doc(policyId);
    await docRef.set({
        policyId,
        policyName: normalizeText(payload.policyName || payload.name || policyId) || policyId,
        tutorRate: asRate(payload.tutorRate, DEFAULT_REVENUE_SHARE_POLICY.tutorRate),
        tutorUplineRate: asRate(payload.tutorUplineRate, DEFAULT_REVENUE_SHARE_POLICY.tutorUplineRate),
        agentRate: asRate(payload.agentRate, DEFAULT_REVENUE_SHARE_POLICY.agentRate),
        agentUplineRate: asRate(payload.agentUplineRate, DEFAULT_REVENUE_SHARE_POLICY.agentUplineRate),
        courseDevRate: asRate(payload.courseDevRate, DEFAULT_REVENUE_SHARE_POLICY.courseDevRate),
        courseDevUplineRate: asRate(payload.courseDevUplineRate, DEFAULT_REVENUE_SHARE_POLICY.courseDevUplineRate),
        enabled: payload.enabled !== false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, policyId };
});

exports.getInvestorProfiles = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can read investor profiles.');

    const profileCache = new Map();
    const configCache = new Map();
    const snapshotCache = new Map();
    const [profiles, config] = await Promise.all([
        loadInvestorProfiles({ db, profileCache }),
        loadInvestorConfig({ db, configCache })
    ]);
    const [valuationSnapshots, activeValuationSnapshot, balanceSheetSnapshots, activeBalanceSheetSnapshot] = await Promise.all([
        loadValuationSnapshots({ db, snapshotCache }),
        loadActiveValuationSnapshot({ db, snapshotCache }),
        loadBalanceSheetSnapshots({ db, snapshotCache }),
        loadActiveBalanceSheetSnapshot({ db, snapshotCache })
    ]);

    const balancesSnap = await db.collection('investor_balances').get();
    const balancesByInvestor = new Map(
        balancesSnap.docs.map((doc) => [String((doc.data() || {}).investorId || doc.id), { id: doc.id, ...(doc.data() || {}) }])
    );
    const positionsSnap = await db.collection('investor_equity_positions').get();
    const positionsByInvestor = new Map(
        positionsSnap.docs.map((doc) => [String((doc.data() || {}).investorId || doc.id), { id: doc.id, ...(doc.data() || {}) }])
    );
    const issuancesSnap = await db.collection('equity_issuances').orderBy('createdAt', 'desc').limit(25).get();
    const recentIssuances = issuancesSnap.docs.map((doc) => ({ issuanceId: doc.id, ...(doc.data() || {}) }));

    return {
        config,
        valuationSnapshots,
        activeValuationSnapshot,
        balanceSheetSnapshots,
        activeBalanceSheetSnapshot,
        profiles: profiles.map((profile) => {
            const balance = balancesByInvestor.get(profile.investorId) || {};
            const position = positionsByInvestor.get(profile.investorId) || {};
            return {
                ...profile,
                currentBalance: Number(balance.currentBalance || 0),
                lastSettlementYear: balance.lastSettlementYear || null,
                lastCreditEventId: balance.lastCreditEventId || null,
                equityShares: Number(position.totalIssuedShares || profile.equityShares || profile.shareUnits || 0),
                ownershipPct: Number(position.ownershipPct || profile.ownershipPct || 0),
                valuationId: position.valuationId || profile.valuationId || "",
                participantType: position.participantType || profile.participantType || "investor",
                latestIssuanceId: position.latestIssuanceId || null
            };
        }),
        equityPositions: Array.from(positionsByInvestor.values()),
        recentIssuances
    };
});

exports.upsertInvestorProfile = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can write investor profiles.');

    const payload = request.data || {};
    const investorId = normalizeText(payload.investorId || payload.id || '');
    assertRequiredValue(investorId, 'investorId is required');

    const shareUnits = Number(payload.shareUnits || payload.share || 0);
    if (!Number.isFinite(shareUnits) || shareUnits < 0) {
        throw new HttpsError('invalid-argument', 'shareUnits must be a non-negative number.');
    }

    const docRef = db.collection('investor_profiles').doc(investorId);
    await docRef.set({
        investorId,
        investorName: normalizeText(payload.investorName || payload.name || investorId) || investorId,
        investorEmail: normalizeText(payload.investorEmail || payload.email || '').toLowerCase(),
        participantType: normalizeText(payload.participantType || 'investor'),
        shareUnits: Math.max(0, shareUnits),
        payoutAccount: normalizeText(payload.payoutAccount || payload.paymentAccount || ''),
        notes: normalizeText(payload.notes || ''),
        enabled: payload.enabled !== false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await db.collection('investor_balances').doc(investorId).set({
        investorId,
        investorName: normalizeText(payload.investorName || payload.name || investorId) || investorId,
        investorEmail: normalizeText(payload.investorEmail || payload.email || '').toLowerCase(),
        participantType: normalizeText(payload.participantType || 'investor'),
        shareUnits: Math.max(0, shareUnits),
        currentBalance: Number.isFinite(Number(payload.currentBalance)) ? Number(payload.currentBalance) : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, investorId };
});

exports.upsertValuationSnapshot = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can write valuation snapshots.');

    const payload = request.data || {};
    const snapshotCache = new Map();
    const result = await upsertValuationSnapshot({
        db,
        payload,
        createdByUid: uid,
        snapshotCache
    });

    return { success: true, valuationId: result.valuationId, snapshot: result };
});

exports.upsertBalanceSheetSnapshot = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can write balance sheet snapshots.');

    const payload = request.data || {};
    const snapshotCache = new Map();
    const result = await upsertBalanceSheetSnapshot({
        db,
        payload,
        createdByUid: uid,
        snapshotCache
    });

    return { success: true, snapshotId: result.snapshotId, snapshot: result };
});

exports.issueInvestorEquity = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can issue investor equity.');

    const payload = request.data || {};
    const profileCache = new Map();
    const snapshotCache = new Map();
    const result = await issueInvestorEquity({
        db,
        payload,
        createdByUid: uid,
        profileCache,
        snapshotCache
    });

    return { success: true, ...result };
});

exports.recordInvestorFinanceEvent = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can record investor events.');

    const payload = request.data || {};
    const profileCache = new Map();
    const result = await recordInvestorFinanceEvent({
        db,
        profileCache,
        payload,
        createdByUid: uid
    });

    return { success: true, ...result };
});

exports.settleAnnualInvestorDividends = onCall(async (request) => {
    const db = admin.firestore();
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    const userDoc = await db.collection('users').doc(uid).get();
    assertAdminRole((userDoc.data() || {}).role, 'Only admins can settle investor dividends.');

    const payload = request.data || {};
    const targetYear = Number(payload.year || new Date().getFullYear() - 1);
    if (!Number.isFinite(targetYear)) {
        throw new HttpsError('invalid-argument', 'year must be a number.');
    }

    const profileCache = new Map();
    const configCache = new Map();
    const result = await settleAnnualInvestorDividends({
        db,
        year: targetYear,
        profileCache,
        configCache,
        createdByUid: uid
    });

    return { success: true, ...result };
});

// ==========================================
// 6. 記錄學習活動 (logActivity)
// ==========================================
exports.logActivity = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, 'User must be logged in.');

    const uid = auth.uid;
    const { courseId, action, duration, metadata } = data;

    assertRequiredValue(courseId, 'Missing courseId or action.');
    assertRequiredValue(action, 'Missing courseId or action.');

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
// 7. 導師設定管理 (saveTutorConfigs / getTutorConfigs)
// ==========================================
const saveTutorConfigsHandler = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, 'User must be logged in.');
    const uid = auth.uid;
    const email = auth.token.email;
    const role = await getRole(uid);
    const { courseId, configs } = data;
    assertRequiredValue(courseId, 'Missing courseId or configs.');
    assertRequiredValue(configs, 'Missing courseId or configs.');

    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const effectiveAssignmentUrlMaps = resolveAssignmentUrlMaps(configs) || {};
    const unitIds = Object.keys(effectiveAssignmentUrlMaps || {});
    const canManageAllUnits = role === 'admin';
    const canManageRequestedUnits = unitIds.every(unitId => hasQualifiedTutorStatus(userData, unitId));

    if (!canManageAllUnits && !canManageRequestedUnits) {
        throw new HttpsError('permission-denied', 'Only admins or qualified tutors for these units can save configs.');
    }

        // [V12.0.9] ULTIMATE MIGRATION: Stop writing to the deprecated course_configs collection.
        // We now only save configurations (authorized tutors, metadata, URLs) to individual user documents.
        // The dashboard synthesizes this data on read.

        // [NEW v12.0.9] If caller is admin, ensure they have their own tutorConfigs entry for the target units
        if (role === 'admin') {
            console.log(`[saveTutorConfigs] Admin ${email} saving configs to users collection...`);
        }

        try {
            const db = admin.firestore();
            
            // --- PHASE 1: Propagate assignmentUrl maps and Authorizations to User Documents ---
            if (unitIds.length > 0) {
                console.log(`[saveTutorConfigs] Syncing assignment URLs to user documents for ${courseId}...`);
                
                for (const [unitId, tutorsMap] of Object.entries(effectiveAssignmentUrlMaps)) {
                    for (const [tEmail, url] of Object.entries(tutorsMap)) {
                        try {
                            const userRecord = await admin.auth().getUserByEmail(tEmail);
                            const tutorUid = userRecord.uid;

                            await upsertTutorConfigForUser(db, tutorUid, unitId, buildTutorConfigEntry({
                                email: tEmail,
                                assignmentUrl: url
                            }), {
                                syncReferralUrl: url,
                                syncReferralLinkFn: syncReferralLink
                            });

                            console.log(`[saveTutorConfigs] ✅ Synced ${unitId} for ${tEmail}`);
                        } catch (err) {
                            console.warn(`[saveTutorConfigs] Failed to sync ${tEmail} for ${unitId}: ${err.message}`);
                        }
                    }
                }
            }

            // --- PHASE 1.5: Support saving custom tutor configs (githubOrg, templateRepo, githubToken) ---
            if (configs.tutorConfigs) {
                console.log(`[saveTutorConfigs] Syncing custom tutorConfigs to user documents...`);
                for (const [unitId, configObj] of Object.entries(configs.tutorConfigs)) {
                    const tEmail = configObj.email || email;
                    try {
                        const userRecord = await admin.auth().getUserByEmail(tEmail.toLowerCase());
                        const tutorUid = userRecord.uid;
                        const preferredAssignmentUrl = getPreferredAssignmentUrl(configObj);

                        await upsertTutorConfigForUser(db, tutorUid, unitId, buildTutorConfigEntry({
                            email: tEmail.toLowerCase(),
                            assignmentUrl: preferredAssignmentUrl,
                            githubOrg: configObj.githubOrg,
                            templateRepo: configObj.templateRepo,
                            githubToken: configObj.githubToken
                        }), {
                            syncReferralUrl: preferredAssignmentUrl || null,
                            syncReferralLinkFn: syncReferralLink
                        });
                        
                        console.log(`[saveTutorConfigs] ✅ Saved custom config for ${unitId} and tutor ${tEmail}`);
                    } catch (err) {
                        console.warn(`[saveTutorConfigs] Failed to save custom config for ${tEmail} on ${unitId}: ${err.message}`);
                    }
                }
            }

        return { success: true, message: 'Configs saved and synced to user documents.' };
    } catch (e) {
        console.error("Save Config Error:", e);
        throw new HttpsError('internal', e.message);
    }
});

const getTutorConfigsHandler = onCall(async (request) => {
    const { data } = request;
    const { courseId } = data;
    try {
        const db = admin.firestore();
        
        // [V12.0.6] Ultimate Reliability: Fetch all users and filter in memory to avoid dot-ambiguity issues in Firestore queries.
        if (courseId) {
            const tutorsSnap = await db.collection('users').get();
            
            const authorizedTutors = [];
            const tutorDetails = {};
            const assignmentUrlMap = { [courseId]: {} };
            const assignmentUrls = { [courseId]: {} };

            tutorsSnap.forEach(tDoc => {
                const tData = tDoc.data();
                const tutorConfigs = tData.tutorConfigs || {};
                
                // Directly match the key string (immune to dots)
                const config = tutorConfigs[courseId];
                if (config && config.authorized === true) {
                    authorizedTutors.push(config.email);
                    tutorDetails[config.email] = config;
                    const assignmentUrl = getPreferredAssignmentUrl(config);
                    if (assignmentUrl) {
                        assignmentUrlMap[courseId][config.email] = assignmentUrl;
                        assignmentUrls[courseId][config.email] = assignmentUrl;
                    }
                }
            });

            return { 
                [courseId]: {
                    authorizedTutors,
                    tutorDetails,
                    assignmentUrlMap,
                    assignmentUrls
                } 
            };
        } else {
            // Bulk fetch for all units (Heavy, but matches legacy behavior)
            const allConfigs = {};
            const usersSnap = await db.collection('users').get();
            
            usersSnap.forEach(uDoc => {
                const uData = uDoc.data();
                const tutorConfigs = uData.tutorConfigs || {};
                for (const [uId, config] of Object.entries(tutorConfigs)) {
                    if (!config.authorized) continue;
                    if (!allConfigs[uId]) {
                        allConfigs[uId] = {
                            authorizedTutors: [],
                            tutorDetails: {},
                            assignmentUrlMap: { [uId]: {} },
                            assignmentUrls: { [uId]: {} }
                        };
                    }
                    allConfigs[uId].authorizedTutors.push(config.email);
                    allConfigs[uId].tutorDetails[config.email] = config;
                    const assignmentUrl = getPreferredAssignmentUrl(config);
                    if (assignmentUrl) {
                        allConfigs[uId].assignmentUrlMap[uId][config.email] = assignmentUrl;
                        allConfigs[uId].assignmentUrls[uId][config.email] = assignmentUrl;
                    }
                }
            });
            return allConfigs;
        }
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

exports.saveTutorConfigs = saveTutorConfigsHandler;
exports.getTutorConfigs = getTutorConfigsHandler;

exports.resolveAssignmentAccess = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const { unitId, courseId, tutorMode, assignmentId } = data || {};
    assertRequiredValue(unitId, '缺少單元 ID');

    const db = admin.firestore();
    const lessons = await getLessons();
    const access = await resolveStudentAssignmentAccess(db, auth.uid, courseId, unitId, lessons, tutorMode === true);
    if (!access.authorized) return { authorized: false, reason: access.reason || 'forbidden', accessMode: access.accessMode || null };

    const { canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, requiresTutorAssignment, accessMode } = access;

    if (requiresTutorAssignment && !assignedTutorEmail) {
        return {
            authorized: true,
            accessMode,
            classroomUrl: null,
            assignedTutorEmail: null,
            canonicalUnitId,
            courseId: effectiveCourseId,
            requiresTutorAssignment: true
        };
    }

    // [V12.0.4] Fetch Tutor-specific assignment URL from the Tutor's User document
    let assignmentUrl = null;
    let createdVia = 'classroom';
    let repositoryUrl = null;
    let feedbackPullRequestUrl = null;

    if (assignedTutorEmail) {
        try {
            const tutorRecord = await admin.auth().getUserByEmail(assignedTutorEmail);
            const tutorDoc = await db.collection('users').doc(tutorRecord.uid).get();
            const tutorData = tutorDoc.exists ? tutorDoc.data() : {};
            const unitConfig = (tutorData.tutorConfigs || {})[canonicalUnitId] || {};
            assignmentUrl = getTutorAssignmentUrlFromConfig(unitConfig, null, canonicalUnitId, assignedTutorEmail) || null;
            if (unitConfig.githubOrg) {
                createdVia = 'native-api';
            }
            
            // Fallback to course-level if not unit-level (optional, depending on structure)
            if (!assignmentUrl && effectiveCourseId) {
                const courseConfig = (tutorData.tutorConfigs || {})[effectiveCourseId] || {};
                assignmentUrl = getTutorAssignmentUrlFromConfig(courseConfig, null, canonicalUnitId, assignedTutorEmail) || null;
                if (courseConfig.githubOrg) {
                    createdVia = 'native-api';
                }
            }
        } catch (tutorErr) {
            console.warn(`[resolveAssignmentAccess] Failed to fetch tutor ${assignedTutorEmail} config:`, tutorErr.message);
        }
    }

    // Secondary Fallback: Check metadata_lessons (lessons) for default URLs
    if (!assignmentUrl) {
        const course = findLessonByCourseRef(effectiveCourseId, lessons);
        assignmentUrl = getTutorAssignmentUrlFromConfig({}, course, canonicalUnitId, assignedTutorEmail, lessons) || null;
    }

    // [V17.0.1] Personalized Repository Check: If student already started, prioritize their personal repo
    let personalRepoUrl = null;
    let assignmentDetails = null;
    try {
        let assignmentDoc = null;
        if (assignmentId) {
            assignmentDoc = await db.collection('assignments').doc(`${auth.uid}_${assignmentId}`).get();
        }

        if (!assignmentDoc || !assignmentDoc.exists) {
            const fallbackUnitId = String(canonicalUnitId || unitId || '').replace(/\.html$/i, '');
            if (fallbackUnitId) {
                assignmentDoc = await db.collection('assignments').doc(`${auth.uid}_${fallbackUnitId}`).get();
            }
        }

        if (assignmentDoc && assignmentDoc.exists) {
            const aData = assignmentDoc.data();
            if (aData.createdVia === 'native-api') {
                createdVia = 'native-api';
                repositoryUrl = aData.repositoryUrl || null;
                feedbackPullRequestUrl = aData.feedbackPullRequestUrl || null;
                personalRepoUrl = aData.repositoryUrl || null;
            } else {
                const existingUrl = aData.assignmentUrl || aData.url;
                // Only prioritize if it's a real GitHub repo (not a classroom invitation link with /a/)
        if (existingUrl && existingUrl.includes('github.com/') && !existingUrl.includes('classroom.github.com/a/')) {
            personalRepoUrl = existingUrl;
            console.log(`[resolveAssignmentAccess] Found personal repo for student: ${personalRepoUrl}`);
        }
            }
            assignmentDetails = {
                learningState: aData.learningState || 'in_progress',
                latestBlocker: aData.latestBlocker || null,
                hintLevelUsed: aData.hintLevelUsed !== undefined ? aData.hintLevelUsed : null,
                nextAction: aData.nextAction || null,
                attemptSummary: aData.attemptSummary || null,
                grade: aData.grade !== undefined ? aData.grade : null,
                tutorFeedback: aData.tutorFeedback || null
            };
        }
    } catch (e) {
        console.warn("[resolveAssignmentAccess] Failed to lookup personal repo:", e.message);
    }

    // Fetch student's own githubUsername
    let githubUsername = null;
    try {
        const studentDoc = await db.collection('users').doc(auth.uid).get();
        if (studentDoc.exists) {
            githubUsername = studentDoc.data().githubUsername || null;
        }
    } catch (studentErr) {
        console.warn(`[resolveAssignmentAccess] Failed to fetch student ${auth.uid} githubUsername:`, studentErr.message);
    }

    const resolvedAssignmentUrl = personalRepoUrl || assignmentUrl || null;

    return {
        authorized: true,
        accessMode,
        classroomUrl: resolvedAssignmentUrl,
        assignedTutorEmail: assignedTutorEmail || null,
        assignedPromotionCode: assignedPromotionCode || null,
        canonicalUnitId,
        courseId: effectiveCourseId,
        requiresTutorAssignment,
        assignmentDetails,
        githubUsername,
        createdVia,
        repositoryUrl: repositoryUrl || personalRepoUrl || null,
        feedbackPullRequestUrl
    };
});

// 7.3 授權課程老師 (Admin Only)
exports.authorizeTutorForCourse = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    assertAdminRole(requesterRole, '僅限管理員');

    const { courseId, tutorEmail, action, parentCourseId } = data; // action: 'add' or 'remove'
    assertRequiredValue(courseId, '缺少必要參數');
    assertRequiredValue(tutorEmail, '缺少必要參數');

    try {
        const db = admin.firestore();
        const lessons = await getLessons();
        const canonicalCourseId = normalizeTutorAdminUnitId(resolveCanonicalUnitId(courseId, lessons) || courseId);
        const aliasCandidates = getTutorAdminUnitAliasCandidates(canonicalCourseId);
        // [V13.0.22] All authorization data is now strictly user-centric. 
        // No longer using centralized course_configs collection.

        if (action === 'add') {
            // ... [ADD Logic remains same focus on unit-level] ...
            let tutorName = fallbackNameFromEmail(tutorEmail);
            try {
                const userRecord = await admin.auth().getUserByEmail(tutorEmail);
                const userDoc = await db.collection('users').doc(userRecord.uid).get();
                tutorName = resolveNameFromUserData(userDoc.exists ? (userDoc.data() || {}) : {}, tutorEmail, userRecord.displayName || "");
            } catch (err) {
                console.log(`[Role] Metadata skip: ${err.message}`);
            }

            const tutorData = buildTutorConfigEntry({ email: tutorEmail, name: tutorName, qualifiedAt: nowIsoTimestamp() });

            // [V12.0.2] Removed legacy writes. All logic now syncs to User Document (below).

            // [NEW v12.0.0] Synchronize with User Document
            try {
                const userRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = userRecord.uid;
                await upsertTutorConfigForUser(db, tutorUid, canonicalCourseId, buildTutorConfigEntry({
                    email: tutorEmail,
                    name: tutorName,
                    qualifiedAt: nowIsoTimestamp()
                }));
                console.log(`[Role] Successfully synched auth for ${tutorEmail} into user doc.`);
            } catch (authSyncErr) {
                console.warn(`[Role] Failed to sync user doc for ${tutorEmail}: ${authSyncErr.message}`);
            }

            // [V12.0.2] Removed writes to legacy course_configs.
            // parentDocRef logic is now handled during propagate-on-save in user documents.

            // [V15.2] Unit-Specific Assignment Link & Email Notification
            try {
                const unitMetadata = findLessonByCourseRef(canonicalCourseId, lessons) || lessons.find(l => l.courseUnits && l.courseUnits.includes(canonicalCourseId));
                const unitName = unitMetadata ? (unitMetadata.title || unitMetadata.courseName || canonicalCourseId) : canonicalCourseId;

                // Fetch the recently updated assignmentUrl from tutor's config
                const tutorUserRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = tutorUserRecord.uid;
                const tutorDoc = await db.collection('users').doc(tutorUid).get();
                const tutorData = tutorDoc.exists ? tutorDoc.data() : {};
                const assignmentUrl = getUserTutorConfig(tutorData, canonicalCourseId)?.assignmentUrl || null;

                await sendTutorAuthorizationEmail(tutorEmail, unitName, canonicalCourseId, assignmentUrl);
                console.log(`[Auth] Authorization link ${assignmentUrl || 'None'} sent to ${tutorEmail} for ${canonicalCourseId}`);
            } catch (authExtraErr) {
                console.error("[Auth] Failed to generate promo code or send email:", authExtraErr);
            }

            // [MODIFIED] Do NOT set role: 'tutor' in users collection.
            // Authorization is strictly handled at the course_configs unit level.

        } else if (action === 'remove') {
            // [V12.0.2] Removed legacy writes. All logic now syncs to User Document (below).

            // [NEW v12.0.0] Synchronize with User Document (Remove Authorization)
            try {
                const userRecord = await admin.auth().getUserByEmail(tutorEmail);
                const tutorUid = userRecord.uid;
                const updatePatch = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                for (const alias of aliasCandidates) {
                    updatePatch[`tutorConfigs.${alias}`] = admin.firestore.FieldValue.delete();
                }
                await db.collection('users').doc(tutorUid).set(updatePatch, { merge: true });
                console.log(`[Role] Successfully removed auth for ${tutorEmail} from user doc.`);
            } catch (authSyncErr) {
                console.warn(`[Role] Failed to sync user doc removal for ${tutorEmail}: ${authSyncErr.message}`);
            }

            return { success: true };
        }
        return { success: true };
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

// 7.4 一次性遷移：此功能已於 2026-03-27 執行完畢並移除。

// ==========================================
// 7.1. 申請合格教師 (applyForTutorRole)
exports.applyForTutorRole = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, 'User must be logged in.');

    const { unitId } = data;
    assertRequiredValue(unitId, 'Missing unitId');

    const uid = auth.uid;
    const email = auth.token.email;
    const db = admin.firestore();
    const lessons = await getLessons();
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);

    // 1. Update User Document (Internal Applications & Auto-Checking)
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // Check if user is already authorized
    const tutorConfigs = userData.tutorConfigs || {};
    if (tutorConfigs[canonicalUnitId] && tutorConfigs[canonicalUnitId].authorized) {
        throw new HttpsError('already-exists', 'You are already a qualified tutor for this unit.');
    }

    // Check for existing pending application in the canonical collection
    const existingPending = await queryTutorApplications(db, {
        userId: uid,
        unitId: canonicalUnitId,
        statuses: ['pending'],
        limit: 1
    });
    if (!existingPending.empty) {
        throw new HttpsError('already-exists', 'You have a pending application for this unit.');
    }

    // Create application object
    const application = buildTutorApplicationRecord({
        userId: uid,
        userEmail: email,
        unitId: canonicalUnitId,
        status: 'pending',
        source: 'self_application'
    });

    // [Single Source of Truth] write to tutor_applications
    const newAppRef = await db.collection('tutor_applications').add({
        ...application,
        appliedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update User Document
    await userRef.set({
        tutorApplications: admin.firestore.FieldValue.arrayUnion(
            buildTutorApplicationLegacyEntry(newAppRef.id, application)
        ),
        hasPendingApplication: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Notify Admin via Email
    const adminEmail = process.env.ADMIN_EMAIL || 'rover.k.chen@gmail.com';
    await sendAdminNewApplicationEmail(adminEmail, email, canonicalUnitId);

    return { success: true, applicationId: newAppRef.id };
});

// [DEBUG TOOL] 偵錯專用：查看目前教師屬性結構
exports.debugTutorAuth = onRequest(async (req, res) => {
    const email = req.query.email || 'rover.k.chen@gmail.com';
    const db = admin.firestore();
    try {
        const usersSnap = await db.collection('users').where('email', '==', email).get();
        if (usersSnap.empty) return res.status(404).send("User document not found.");
        const data = usersSnap.docs[0].data();
        return res.status(200).json({ 
            email: email,
            tutorConfigs: data.tutorConfigs || {},
            fullDoc: data
        });
    } catch (err) {
        return res.status(500).send(err.message);
    }
});

exports.recommendTutorForUnit = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, 'User must be logged in.');

    const requesterRole = await getRole(auth.uid);

    const { assignmentId } = data;
    assertRequiredValue(assignmentId, 'Missing assignmentId');

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
    const autoGradeScore = Number(assignment.autoGrade?.score);
    const recommendationThreshold = 100;
    if (!Number.isFinite(autoGradeScore)) {
        throw new HttpsError('failed-precondition', 'Assignment must have a valid auto-grade score before recommendation.');
    }
    if (autoGradeScore < recommendationThreshold) {
        throw new HttpsError('failed-precondition', `Auto-grade score must be >= ${recommendationThreshold} before recommendation.`);
    }

    await assertTutorRecommendationPermission(db, auth, canonicalUnitId, assignment, requesterRole);

    // Check if candidate is already qualified
    const candidateDoc = await db.collection('users').doc(candidateUid).get();
    const candidateData = candidateDoc.exists ? candidateDoc.data() : {};
    if (getUserTutorConfig(candidateData, canonicalUnitId)?.authorized) {
        throw new HttpsError('already-exists', 'Student is already a qualified tutor for this unit.');
    }

    const existingPending = await queryTutorApplications(db, {
        userId: candidateUid,
        unitId: canonicalUnitId,
        statuses: ['pending', 'awaiting_candidate_link'],
        limit: 1
    });

        if (!existingPending.empty) {
        const existingStatus = (existingPending.docs[0].data() || {}).status;
        if (existingStatus === 'awaiting_candidate_link') {
            throw new HttpsError('already-exists', 'Student already has a pending recommendation waiting for the student to submit the assignment link.');
        }
        throw new HttpsError('already-exists', 'Student already has a pending application for this unit.');
    }

    const application = buildTutorApplicationRecord({
        userId: candidateUid,
        userEmail: candidateEmail,
        unitId: canonicalUnitId,
        status: 'awaiting_candidate_link',
        source: 'tutor_recommendation',
        recommendedByUid: auth.uid,
        recommendedByEmail: auth.token.email || '',
        recommendedFromAssignmentId: assignmentId,
        recommendedAt: admin.firestore.FieldValue.serverTimestamp(),
        candidateAssignmentLink: '',
        candidateClassroomInviteUrl: '',
        candidateLinkSubmittedAt: null,
        appliedAt: null
    });

    const newAppRef = await db.collection('tutor_applications').add(application);
    await sendTutorRecommendationCandidateEmail(candidateEmail, canonicalUnitId, auth.token.email || '', newAppRef.id);

    return { success: true, applicationId: newAppRef.id, status: 'awaiting_candidate_link' };
});

exports.submitTutorRecommendationInviteLink = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, 'User must be logged in.');

    const { applicationId, assignmentLink, classroomInviteUrl: legacyInviteUrl } = data;
    const candidateAssignmentLink = assignmentLink || legacyInviteUrl || '';
    assertRequiredValue(applicationId, 'Missing applicationId or assignmentLink');
    assertRequiredValue(candidateAssignmentLink, 'Missing applicationId or assignmentLink');

    const normalizedAssignmentLink = normalizeAssignmentLinkUrl(candidateAssignmentLink);
    if (!isValidAssignmentLinkUrl(normalizedAssignmentLink)) {
        throw new HttpsError('invalid-argument', '作業連結格式不正確，請提供有效的 http/https 連結。');
    }

    const db = admin.firestore();
    const appRef = db.collection('tutor_applications').doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError('not-found', 'Application not found.');

    const appData = appSnap.data() || {};
    if (appData.userId !== auth.uid) {
        throw new HttpsError('permission-denied', 'You can only submit your own application link.');
    }
    assertTutorApplicationState(appData, { source: 'tutor_recommendation', status: 'awaiting_candidate_link' });

    await appRef.update({
        candidateAssignmentLink: normalizedAssignmentLink,
        candidateClassroomInviteUrl: normalizedAssignmentLink,
        candidateLinkSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const adminEmail = process.env.ADMIN_EMAIL || 'rover.k.chen@gmail.com';
    await sendAdminNewApplicationEmail(adminEmail, appData.userEmail || auth.token.email || '', appData.unitId || '');

    return { success: true, status: 'pending' };
});

// 7.2. 決策合格教師申請 (decideTutorApplication)
exports.decideTutorApplication = onCall(async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    assertAuthenticated(auth, 'User must be logged in.');

    const requesterRole = await getRole(auth.uid);
    assertAdminRole(requesterRole, 'Only admins can resolve applications.');

    const { applicationId, status, adminMessage } = data; // status: 'approved' or 'rejected'
    assertRequiredValue(applicationId, 'Invalid parameters');
    if (!['approved', 'rejected'].includes(status)) throw new HttpsError('invalid-argument', 'Invalid parameters');

    const db = admin.firestore();
    const appRef = db.collection('tutor_applications').doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError('not-found', 'Pending application not found.');

    const appData = appSnap.data() || {};
    assertTutorApplicationState(appData, { status: 'pending' });
    const { userEmail, unitId, userId } = appData;
    const targetUserRef = db.collection('users').doc(userId);
    const targetUserDoc = await targetUserRef.get();
    const userData = targetUserDoc.exists ? (targetUserDoc.data() || {}) : {};

    const lessons = await getLessons();
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    const parentCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons);

    const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };

    if (status === 'approved') {
        const tutorName = resolveNameFromUserData(userData, userEmail, "");

        const tutorData = buildTutorConfigEntry({
            email: userEmail,
            name: tutorName,
            qualifiedAt: nowIsoTimestamp()
        });

        updateData[new admin.firestore.FieldPath('tutorConfigs', canonicalUnitId)] = tutorData;

        // No code generation: the tutor's assignment link is now the only referral medium.
    }

    await appRef.update({
        status,
        adminMessage: adminMessage || "",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolvedByUid: auth.uid
    });

    // Keep user snapshot in sync for legacy UI compatibility
    const userApplications = upsertTutorApplicationLegacyEntry(
        userData.tutorApplications,
        applicationId,
        {
            userId,
            userEmail,
            unitId: canonicalUnitId,
            source: appData.source || 'unknown',
            appliedAt: appData.appliedAt || nowIsoTimestamp()
        },
        {
            status,
            adminMessage: adminMessage || "",
            resolvedAt: nowIsoTimestamp()
        }
    );

    const stillHasPendingSnap = await db.collection('tutor_applications')
        .where('userId', '==', userId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    await targetUserRef.set({
        ...updateData,
        tutorApplications: userApplications,
        hasPendingApplication: !stillHasPendingSnap.empty
    }, { merge: true });

    // Notify User via Email
    await sendApplicationResultEmail(userEmail, canonicalUnitId, status, adminMessage);

    return { success: true };
});

// 8. 獲取儀表板數據 (getDashboardData)
// ==========================================
exports.getDashboardData = onCall({ secrets: [CONTENT_REPO_TOKEN] }, async (request) => {
    const data = request.data || {};
    const auth = request.auth;
    console.log(`[getDashboardData] Start - UID: ${auth?.uid}, data: ${JSON.stringify(data)}`);
    
    assertAuthenticated(auth, 'User must be logged in.');

    const uid = auth.uid;
    const email = auth.token.email;
    const requesterRole = await getRole(uid);
    console.log(`[getDashboardData] Requester UID: ${uid}, Email: ${email}, Role: ${requesterRole}`);
    const db = admin.firestore();
    const lessons = await getLessons();
    const physicalUnitIds = getPhysicalUnitIdSet(lessons);
    
    // [V12.1.2] SECURITY RULE: Global dashboard (no unitId) is ADMIN ONLY.
    if (!data.unitId && !data.courseId && requesterRole !== 'admin') {
        console.warn(`[getDashboardData] BLOCKED: Non-admin user ${email} attempted global view.`);
        throw new HttpsError('permission-denied', 'You must specify a unitId or courseId to view your dashboard.');
    }
    
    const canonicalCourseId = (value) => String(value || '');

    try {
        // 0. Fetch Course Authorization Data
        const authorizedCourseIds = [];
        const courseGuideIndex = {};
        const unitTutorConfigs = {};
        const unitToDocId = {}; // [LEGACY] Map unit filename -> Firestore docId
        // [Single Source] Fetch Tutor Application Status for THIS user from tutor_applications
        const myApplicationsMapping = {};
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        try {
            const myAppsSnapshot = await queryTutorApplications(db, {
                userId: uid,
                limit: 100
            });
            myAppsSnapshot.forEach(doc => {
                const app = doc.data() || {};
                if (!app.unitId) return;
                if (!myApplicationsMapping[app.unitId]) {
                    myApplicationsMapping[app.unitId] = {
                        status: app.status,
                        appliedAt: app.appliedAt,
                        applicationId: doc.id
                    };
                }
            });
        } catch (appErr) {
            console.warn("[getDashboardData] Failed to fetch user applications from tutor_applications:", appErr.message);
        }

        // [NEW v12.0.1] Tutor Authorization Summary for Frontend
        // We can just return the tutorConfigs directly if needed, or map it.
        const myTutorConfigs = userData.tutorConfigs || {};

        // [NEW] Fetch Global Tutor Terms
        let tutorTerms = "";
        try {
            const termsDoc = await db.collection('metadata_settings').doc('tutor_terms').get();
            tutorTerms = termsDoc.exists ? (termsDoc.data().content || "") : "尚未設定合格教師權利義務細則。";
        } catch (e) {
            console.warn("[getDashboardData] Failed to fetch tutor terms:", e);
        }

        // (Admin Only) Fetch all PENDING applications from tutor_applications
        let allPendingApplications = [];
        if (requesterRole === 'admin' && data.tutorMode !== false) {
            const pendingAppsSnapshot = await queryTutorApplications(db, {
                statuses: ['pending'],
                limit: 1000
            });

            pendingAppsSnapshot.forEach(doc => {
                const app = doc.data() || {};
                allPendingApplications.push({
                    id: doc.id,
                    applicationId: doc.id,
                    ...app
                });
            });

            // Sort in-memory
            allPendingApplications.sort((a, b) => {
                const timeA = a.appliedAt?.toMillis ? a.appliedAt.toMillis() : (new Date(a.appliedAt || 0).getTime() || 0);
                const timeB = b.appliedAt?.toMillis ? b.appliedAt.toMillis() : (new Date(b.appliedAt || 0).getTime() || 0);
                return timeB - timeA;
            });
        }

        // Build a guide index from all users' tutorConfigs. This is not the deprecated course_configs collection.
        const usersSnapshot = await db.collection('users').get();
        const synthesizedConfigs = {};

        usersSnapshot.forEach(doc => {
            const uData = doc.data();
            const email = uData.email;
            const tutorConfigs = uData.tutorConfigs || {};

            for (let [unitId, config] of Object.entries(tutorConfigs)) {
                indexAuthorizedTutorConfigForDashboard({
                    uData,
                    email,
                    unitId,
                    config,
                    lessons,
                    synthesizedConfigs,
                    unitTutorConfigs,
                    unitToDocId,
                    authorizedCourseIds,
                    findCourseByUnitIdFn: findCourseByUnitId,
                    findCourseByPageOrUnitFn: findCourseByPageOrUnit
                });
            }
        });

        Object.keys(synthesizedConfigs).forEach(docId => {
            try {
                const cfg = synthesizedConfigs[docId];
                const isTutorModeAdmin = requesterRole === 'admin' && data.tutorMode !== false;
                const isAuthorized = isTutorModeAdmin || (Array.isArray(cfg.authorizedTutors) && cfg.authorizedTutors.includes(email));
                const mappedId = docId;

                const cfgAssignmentUrlMaps = cfg.assignmentUrlMap || cfg.assignmentUrls || null;
                if (cfgAssignmentUrlMaps) {
                    Object.keys(cfgAssignmentUrlMaps).forEach(unitId => {
                        const equivalentUnits = new Set([unitId, resolveCanonicalUnitId(unitId, lessons)]);
                        const parentCourse = findCourseByUnitId(unitId, lessons);
                        (Array.isArray(parentCourse?.courseUnits) ? parentCourse.courseUnits : []).forEach((candidateUnit) => {
                            if (unitIdsMatch(candidateUnit, unitId)) equivalentUnits.add(candidateUnit);
                        });

                        equivalentUnits.forEach((candidateUnit) => {
                            if (!candidateUnit) return;
                            const existingDocId = unitToDocId[candidateUnit];
                            if (!existingDocId || !existingDocId.includes('.html')) {
                                unitToDocId[candidateUnit] = docId;
                            }
                        });
                    });
                }

                if (docId.includes('.html')) {
                    unitToDocId[docId] = docId;
                    const parentCourse = findCourseByUnitId(docId, lessons);
                    (Array.isArray(parentCourse?.courseUnits) ? parentCourse.courseUnits : []).forEach((candidateUnit) => {
                        if (unitIdsMatch(candidateUnit, docId)) {
                            unitToDocId[candidateUnit] = docId;
                        }
                    });
                }

                if (isAuthorized) {
                    if (docId.includes('.html')) {
                        // [FIX] Normalize ID to handle start- prefix mismatch
                        const parentCourse = findCourseByUnitId(mappedId, lessons);
                        if (parentCourse && !authorizedCourseIds.includes(parentCourse.courseId)) {
                            authorizedCourseIds.push(parentCourse.courseId);
                        }
                    } else {
                        if (!authorizedCourseIds.includes(mappedId)) {
                            authorizedCourseIds.push(mappedId);
                        }
                    }
                    courseGuideIndex[mappedId] = cfg;
                    if (mappedId !== docId) {
                        courseGuideIndex[docId] = cfg;
                    }
                }
            } catch (err) {
                console.error(`Error processing config for course ${docId}:`, err);
            }
        });

        // [NEW] Extract Instructor Guides for all authorized courses dynamically
        // Refactored to aggregate from all related unit files by prefix
        const privateCoursesDir = path.join(__dirname, 'private_courses');
        const requestedGuideCourseIds = [];
        const requestedUnitId = data.unitId ? resolveCanonicalUnitId(data.unitId, lessons) : null;
        const requestedCourseId = data.courseId || (requestedUnitId ? findParentCourseIdByUnit(requestedUnitId, lessons) : null);
        if (requestedCourseId) requestedGuideCourseIds.push(requestedCourseId);

        const allFiles = requestedGuideCourseIds.length && fs.existsSync(privateCoursesDir) ? fs.readdirSync(privateCoursesDir) : [];
        if (requestedGuideCourseIds.length) {
            console.log(`[getDashboardData] privateCoursesDir: ${privateCoursesDir}`);
            console.log(`[getDashboardData] Target guide courses: ${JSON.stringify(requestedGuideCourseIds)}`);
            console.log(`[getDashboardData] Total files found: ${allFiles.length}. First 5: ${JSON.stringify(allFiles.slice(0, 5))}`);
        }

        const runtimeConfig = requestedGuideCourseIds.length ? await getContentRuntimeConfig(db) : { enabled: false };
        const preferredLocales = [];
        if (data.locale) preferredLocales.push(data.locale);
        if (userData.locale && !preferredLocales.includes(userData.locale)) preferredLocales.push(userData.locale);
        if (!preferredLocales.includes("zh-TW")) preferredLocales.push("zh-TW");
        if (!preferredLocales.includes("en")) preferredLocales.push("en");

        // If admin is in Tutor Mode, ensure all courses are considered for guide aggregation.
        if (requesterRole === 'admin' && data.tutorMode !== false) {
            lessons.forEach(l => {
                if (!authorizedCourseIds.includes(l.courseId)) {
                    authorizedCourseIds.push(l.courseId);
                }
            });
        }


        const guideCourseIds = requestedGuideCourseIds.length ? requestedGuideCourseIds : [];

        for (const cid of guideCourseIds) {
            const course = findLessonByCourseRef(cid, lessons);
            if (course) {
                try {
                    const entryUnitId = normalizeCourseFile(course.entryUnitId || '');
                    const legacyLessonUrl = course.classroomUrl || '';
                    const assignmentFile = normalizeCourseFile(legacyLessonUrl);
                    const units = Array.isArray(course.courseUnits) ? [...course.courseUnits] : [];

                    const relatedFiles = Array.from(new Set([
                        entryUnitId,
                        ...units,
                        (assignmentFile && assignmentFile.endsWith('.html')) ? assignmentFile : ''
                    ].filter(Boolean)));
                    let aggregatedGuides = {};

                    if (relatedFiles.length > 0) {
                        relatedFiles.sort((a, b) => {
                            if (a === entryUnitId) return -1;
                            if (b === entryUnitId) return 1;
                            return a.localeCompare(b);
                        });

                        console.log(`[getDashboardData] cid: ${cid}, relatedFiles: ${relatedFiles.join(', ')}`);
                        for (const file of relatedFiles) {
                            let html = "";
                            let source = "none";

                            // 1. Try external fetch if enabled
                            if (runtimeConfig.enabled) {
                                const externalHit = await fetchExternalCourseContentHelper(file, runtimeConfig, preferredLocales);
                                if (externalHit && externalHit.content) {
                                    html = externalHit.content;
                                    source = externalHit.source;
                                }
                            }

                            // 2. Fallback to local file if external failed/disabled
                            if (!html) {
                                let localFile = null;
                                if (allFiles.includes(file)) {
                                    localFile = file;
                                } else {
                                    for (const locale of preferredLocales) {
                                        const candidates = buildI18nFilenameCandidates(file, locale);
                                        const matched = candidates.find(c => allFiles.includes(c));
                                        if (matched) {
                                            localFile = matched;
                                            break;
                                        }
                                    }
                                }

                                if (localFile) {
                                    const filePath = path.join(privateCoursesDir, localFile);
                                    if (fs.existsSync(filePath)) {
                                        html = fs.readFileSync(filePath, 'utf8');
                                        source = "local";
                                    }
                                }
                            }

                            if (!html) {
                                console.log(`[getDashboardData] ❌ No HTML source found for ${file} in ${cid}`);
                                continue;
                            }

                            const guideContent = extractHiddenSectionContent(html, 'tutor-guide');
                            const attachContent = extractHiddenSectionContent(html, 'attachment-guide');
                            const assignmentContent = extractHiddenSectionContent(html, 'assignment-guide');

                            if (attachContent) {
                                if (!aggregatedGuides.attachment) aggregatedGuides.attachment = {};
                                aggregatedGuides.attachment[file] = attachContent;
                            }

                            if (guideContent) {
                                if (!aggregatedGuides.tutor) aggregatedGuides.tutor = {};
                                aggregatedGuides.tutor[file] = guideContent;
                                console.log(`[getDashboardData] ✅ Found Tutor Guide for ${file} in ${cid} (source: ${source})`);
                            } else {
                                console.log(`[getDashboardData] ❌ No Tutor Guide match for ${file} in ${cid} (source: ${source})`);
                            }

                            if (assignmentContent) {
                                if (!aggregatedGuides.assignment) aggregatedGuides.assignment = {};
                                aggregatedGuides.assignment[file] = assignmentContent;
                                console.log(`[getDashboardData] ✅ Found Assignment Guide for ${file} in ${cid} (source: ${source})`);
                            } else {
                                console.log(`[getDashboardData] ❌ No Assignment Guide match for ${file} in ${cid} (source: ${source})`);
                            }

                        }

                        if (Object.keys(aggregatedGuides).length > 0) {
                            if (!courseGuideIndex[cid]) courseGuideIndex[cid] = {};
                            // [MERGE] Use Object.assign to preserve existing properties from Firestore
                            if (aggregatedGuides.tutor) {
                                courseGuideIndex[cid].tutorGuide = Object.assign({}, courseGuideIndex[cid].tutorGuide || {}, aggregatedGuides.tutor);
                            }
                            if (aggregatedGuides.attachment) {
                                courseGuideIndex[cid].attachmentGuide = Object.assign({}, courseGuideIndex[cid].attachmentGuide || {}, aggregatedGuides.attachment);
                            }
                            if (aggregatedGuides.assignment) {
                                courseGuideIndex[cid].assignmentGuide = Object.assign({}, courseGuideIndex[cid].assignmentGuide || {}, aggregatedGuides.assignment);
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Failed to extract aggregated instructor guide for ${cid}:`, e);
                }
            }
        }


        // Determine if this user has any management access (Global Admin/Tutor or Course-Specific Tutor)
        // [V13.6] Rule Enforcement: isManagementView for Admin is IMMUNE to Tutor Mode.
        // This ensures the Overview (Global stats) always shows the full database count.
        const isAdminGlobal = (requesterRole === 'admin');
        const isManagementView = isAdminGlobal || authorizedCourseIds.length > 0;

        let result = {
            role: requesterRole,
            summary: {},
            students: [],
            assignments: [],
            courseGuideIndex: courseGuideIndex,
            unitTutorConfigs: unitTutorConfigs,
            myTutorConfigs: myTutorConfigs,
            unitToDocId: unitToDocId, 
            myReferralLink: null,
            myPromotionCode: null,
            earnings: [],
            // [NEW] Application Workflow support
            myApplications: myApplicationsMapping,
            tutorTerms: tutorTerms,
            pendingApplications: allPendingApplications,
            hardwareOrders: [] // [NEW] Complete hardware order history for admin
        };

        // Fetch profit sharing data and the current unit referral link for tutors.
        if (isManagementView) {
            try {
                if (hasQualifiedTutorStatus(userData)) {
                    const userRef = db.collection('users').doc(uid);
                    result.myPromotionCode = await ensureTutorPromotionCode(db, userRef, userData, uid, email);
                }

                // If a unitId is provided from the frontend, fetch the assignmentUrl for that unit
                const filterUnitId = data.unitId || null;
                if (filterUnitId) {
                    const canonicalId = resolveCanonicalUnitId(filterUnitId, lessons);
                    // [V15.5] Robust field lookup via getEffectiveTutorConfig (Handles nested dots)
                    const unitConfig = getEffectiveTutorConfig(canonicalId, myTutorConfigs);
                    if (unitConfig && unitConfig.authorized) {
                        const unitCourse = findLessonByCourseRef(canonicalId, lessons);
                        result.myReferralLink = getTutorAssignmentUrlFromConfig(unitConfig, unitCourse, canonicalId, email, lessons) || null;
                    }
                }

                const ledgerSnap = await db.collection('profit_ledger')
                    .where('tutorEmail', '==', email)
                    .limit(500)
                    .get();
                
                result.earnings = ledgerSnap.docs
                    .map(doc => {
                        const row = { id: doc.id, ...doc.data() };
                        row.month = row.month || row.period || '-';
                        return row;
                    })
                    .sort((a, b) => String(b.month || '').localeCompare(String(a.month || '')));
            } catch (err) {
                console.error("Error fetching profit data for dashboard:", err);
            }
        }

        // 1. Fetch Users (Filtering based on access level)
        let usersMap = {};
        if (isManagementView) {
            // Admins see all users. Tutors/Course-Tutors see students.
            let usersSnapshot = await db.collection('users').get();
            
            // [V13.0.15] Maintenance Sync: For admins, ensure EVERY Auth user has a Firestore document.
            // Rule Enforcement: Overview & Data Sync should NOT be affected by Tutor Mode for Admins.
            if (requesterRole === 'admin' && !data.unitId && !data.courseId) {
                try {
                    const listUsersResult = await admin.auth().listUsers(1000);
                    const authUsers = listUsersResult.users;
                    const existingUids = usersSnapshot.docs.map(doc => doc.id);
                    const batch = db.batch();
                    let syncCount = 0;
                    
                    for (const au of authUsers) {
                        const userRef = db.collection('users').doc(au.uid);
                        // Find existing role from snapshot if exists
                        const existingDoc = usersSnapshot.docs.find(d => d.id === au.uid);
                        const role = existingDoc?.data()?.role || 'user';

                        batch.set(userRef, {
                            email: au.email || "",
                            name: au.displayName || fallbackNameFromEmail(au.email || "", "New User"),
                            role: role,
                            createdAt: au.metadata.creationTime ? new Date(au.metadata.creationTime) : admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        syncCount++;
                    }
                    if (syncCount > 0) {
                        console.log(`[getDashboardData] Admin Global Sync: ${syncCount} users processed.`);
                        await batch.commit();
                        usersSnapshot = await db.collection('users').get();
                    }
                } catch (syncErr) {
                    console.error("[getDashboardData] Internal User Sync failed:", syncErr);
                }
            }

            usersSnapshot.forEach(doc => {
                const uData = doc.data();
                addDashboardUserEntry(usersMap, doc.id, uData, requesterRole);
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
            const cid = canonicalCourseId(log.courseId || 'unknown');

            // Authorization Filter for each log:
            // - It's my own log
            // - I'm a global admin/tutor
            // - I'm an authorized tutor for this specific course
            const isAuthorizedForLog = (sid === uid) || (requesterRole === 'admin') || authorizedCourseIds.includes(cid);

            if (isAuthorizedForLog && usersMap[sid]) {
                if (!studentStats[sid]) {
                    ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: null });
                }

                const duration = log.duration || 0;
                studentStats[sid].totalTime += duration;
                if (log.action === 'VIDEO') studentStats[sid].videoTime += duration;
                if (log.action === 'DOC') studentStats[sid].docTime += duration;

                if (!studentStats[sid].lastActive) {
                    studentStats[sid].lastActive = log.timestamp ? log.timestamp.toDate() : null;
                }

                appendCourseProgressActivity(studentStats[sid], cid, log);
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
                    if (usersMap[sid] || studentStats[sid]) {
                        ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: 'paid' });
                    }

                    // Map order items to course progress placeholder if missing
                    // This ensures the student appears under the specific course/unit management listing
                    if (studentStats[sid] && order.items) {
                        if (!studentStats[sid].orderRecords) studentStats[sid].orderRecords = [];
                        studentStats[sid].orderRecords.push(buildStudentOrderRecord(order, doc.id));
                        Object.keys(order.items).forEach(originalCid => {
                            const cid = canonicalCourseId(originalCid);
                            if (!studentStats[sid].orders.includes(cid)) {
                                studentStats[sid].orders.push(cid);
                            }
                            ensureCourseProgressBucket(studentStats[sid], cid, { isLicenseOnly: true });
                        });
                    }
                });
            } catch (orderErr) {
                console.error("Error fetching orders for dashboard:", orderErr);
            }
        }

        // [NEW] Student view: include own successful order records (shipment status/details)
        if (!isManagementView) {
            try {
                const myOrdersSnapshot = await db.collection('orders')
                    .where('uid', '==', uid)
                    .where('status', '==', 'SUCCESS')
                    .get();

                if (!studentStats[uid] && usersMap[uid]) {
                    ensureStudentStatsEntry(studentStats, uid, usersMap[uid] || {}, { includeOrderRecords: true });
                }

                myOrdersSnapshot.forEach(doc => {
                    const order = doc.data() || {};
                    studentStats[uid].orderRecords.push(buildStudentOrderRecord(order, doc.id));

                    Object.keys(order.items || {}).forEach(originalCid => {
                        const cid = canonicalCourseId(originalCid);
                        if (!studentStats[uid].orders) studentStats[uid].orders = [];
                        if (!studentStats[uid].orders.includes(cid)) {
                            studentStats[uid].orders.push(cid);
                        }
                    });
                });
            } catch (myOrderErr) {
                console.error("Error fetching student's own orders for dashboard:", myOrderErr);
            }
        }

        // [NEW] Ensure the global admin overview includes every registered user, even with no activity.
        const shouldIncludeAllRegisteredUsers = isManagementView && requesterRole === 'admin' && !data.unitId && !data.courseId;

        // [NEW] Ensure all relevant users are included, along with registration time
        if (isManagementView) {
            Object.keys(usersMap).forEach(sid => {
                const userRole = usersMap[sid].role || 'user';
                const shouldIncludeUser = shouldIncludeAllRegisteredUsers || userRole === 'user' || !userRole;
                
                if (!studentStats[sid] && shouldIncludeUser) {
                    ensureStudentStatsEntry(studentStats, sid, usersMap[sid] || {}, { accountStatus: 'free', includeOrderRecords: true });
                    studentStats[sid].createdAt = usersMap[sid].createdAt || null;
                } else if (studentStats[sid]) {
                    // Always try to use the raw createdAt from usersMap if available
                    if (!studentStats[sid].createdAt) {
                        studentStats[sid].createdAt = usersMap[sid].createdAt || null;
                    }
                }
            });
        }

        // [V13.0.14] UNIFIED STUDENT FILTERING: Filter students based on authorization scope.
        // 1. Admin Global with Tutor Mode ON: All students.
        // 2. Unit Context: Only students in that unit (assigned to the tutor).
        // 3. Course Context: Only students in that course.
        // 4. Tutor Global (Tutor Mode): Only students assigned to THEM.
        
        const filteredStudentStats = [];
        const isAdmin = requesterRole === 'admin';
        const isTutorModeAdmin = isAdmin && data.tutorMode !== false;
        const targetUnitId = data.unitId ? resolveCanonicalUnitId(data.unitId, lessons) : null;
        const targetCourseId = data.courseId || null;

        Object.values(studentStats).forEach(s => {
            // [A] Master Bypass for Admin in Global View (Overview)
            // Rule: Overview should not be affected by Tutor Mode simulation.
            if (isAdmin && !targetUnitId && !targetCourseId) {
                filteredStudentStats.push(s);
                return;
            }

            // [B] Authorization Check for Simulated or Standard Tutor
            let isRelevant = false;
            
            // 1. Assignment Check: Is the student assigned to THIS tutor for THIS unit?
            if (targetUnitId) {
                const assignedTutor = s.unitAssignments?.[targetUnitId];
                if (assignedTutor === email || isTutorModeAdmin) {
                    isRelevant = true;
                }
            } else if (targetCourseId) {
                // Course Check: Does the student have orders or assignments for this course?
                const hasCourseOrder = (s.orders || []).includes(targetCourseId);
                const assignedToAnyInCourse = Object.keys(s.unitAssignments || {}).some(uid => {
                    const parent = findParentCourseIdByUnit(uid, lessons);
                    return parent === targetCourseId && (s.unitAssignments[uid] === email || isTutorModeAdmin);
                });
                if (hasCourseOrder || assignedToAnyInCourse) isRelevant = true;
            } else {
                // Global Tutor View (No Context): Only see students assigned to THEM at all
                const hasAnyAssignmentToMe = Object.values(s.unitAssignments || {}).some(t => t === email);
                if (hasAnyAssignmentToMe || isTutorModeAdmin) isRelevant = true;
            }

            if (isRelevant) filteredStudentStats.push(s);
        });

        result.students = filteredStudentStats;

        // 2.5 Fetch Tutors (Administrators and Authorized Tutors)
        result.tutors = buildTutorList(usersMap);

        // 3. Fetch Assignments
        let assignQuery = db.collection('assignments');
        if (!isManagementView) {
            assignQuery = assignQuery.where('userId', '==', uid);
        }
        const assignSnapshot = await assignQuery.get();
        assignSnapshot.forEach(doc => {
            const data = doc.data();
            // [REPAIR] If userId/uid is missing in fields, extract from Doc ID (UID_ASSIGNMENTID)
            let targetUid = data.userId || data.uid;
            if (!targetUid && doc.id.includes('_')) {
                targetUid = doc.id.split('_')[0];
            }
            
            const originalCid = data.courseId || 'unknown';
            const mappedCid = canonicalCourseId(originalCid);

            const assignmentTutor = data.assignedTutorEmail || null;
            const requesterEmail = auth.token.email || "";

            // Authorization Filter for each assignment
            // 1. My own assignment (Student/Any)
            // 2. Admin can see all
            // 3. Tutor can see if: assigned to them OR they have access to the (possibly legacy) courseId
            // [V14.10] DECOUPLED: Tutors authorized for any relevant course can see the assignment if unit matches.
            const requesterHasTutorAccess = hasQualifiedTutorStatus(userData);
            const isAuthorizedForAssign = isAssignmentAuthorized({
                targetUid,
                uid,
                requesterRole,
                requesterHasTutorAccess,
                assignmentTutor,
                requesterEmail,
                mappedCid,
                authorizedCourseIds,
                unitId: data.unitId
            });

            if (isAuthorizedForAssign) {
                // If admin, we allow it through even if student info is partially missing
                result.assignments.push(buildDashboardReferenceEntry(usersMap, targetUid, {
                    id: doc.id,
                    ...data,
                    userId: targetUid, // Ensure normalized UID is present
                    courseId: mappedCid,
                    unitId: resolveCanonicalUnitId(data.unitId, lessons, { allowLegacyMaster: true }) || data.unitId
                }));
            }
        });

        // 3.5 Fetch Active Interventions for Tutor / Admin Dashboard
        let interventions = [];
        const isTutorOrAdmin = requesterRole === 'admin' || hasQualifiedTutorStatus(userData);
        if (isTutorOrAdmin) {
            try {
                const intSnapshot = await db.collection('assignment_interventions')
                    .get();

                intSnapshot.forEach(doc => {
                    const intData = doc.data();
                    const studentUid = intData.studentUid;

                    // In-memory filter for tutor owned / unassigned
                    if (requesterRole !== 'admin' && intData.ownerTutorEmail && intData.ownerTutorEmail !== email) {
                        return; // Owned by another tutor
                    }

                    interventions.push(buildDashboardReferenceEntry(usersMap, studentUid, {
                        id: doc.id,
                        ...intData
                    }));
                });
            } catch (intErr) {
                console.warn("[getDashboardData] Failed to fetch assignment_interventions:", intErr.message);
            }
        }
        result.interventions = interventions;

        // Summary
        result.summary = buildDashboardSummary(result.students);

        // [NEW] 2.6 Aggregate Pending Shipments for Admin
        if (requesterRole === 'admin') {
            try {
                const shipmentsSnapshot = await db.collection('orders')
                    .where('status', '==', 'SUCCESS')
                    .get();

                shipmentsSnapshot.forEach(doc => {
                    const data = doc.data();
                    const items = data.items || {};
                    const physicalItems = Object.keys(items).filter((id) =>
                        isPhysicalOrderItem(id, items[id] || {}, physicalUnitIds)
                    );

                    if (physicalItems.length > 0) {
                        const student = usersMap[data.uid] || {};
                        const logistics = data.logistics || {};
                        const orderRecord = buildOrderRecordSummary({
                            docId: doc.id,
                            uid: data.uid,
                            student,
                            data,
                            logistics,
                            items,
                            physicalItems,
                            lessons,
                            canonicalCourseId
                        });
                        result.hardwareOrders.push(orderRecord);
                    }
                });
                const shipmentSummary = finalizeHardwareOrders(result.hardwareOrders);
                result.hardwareOrders = shipmentSummary.hardwareOrders;
                result.pendingShipments = shipmentSummary.pendingShipments;
                result.pendingShipmentsCount = shipmentSummary.pendingShipmentsCount;
            } catch (shipErr) {
                console.error("Error aggregating shipments:", shipErr);
            }
        }

        if (requesterRole === 'admin') {
            try {
                const configDoc = await db.collection('metadata_settings').doc('content_runtime').get();
                if (configDoc.exists) {
                    result.contentVersion = configDoc.data().contentVersion || "";
                }
            } catch (err) {
                console.warn("[getDashboardData] Failed to fetch content_runtime version:", err.message);
            }
        }

        result.lessons = lessons.map((lesson) => canonicalizeLessonForDashboard(lesson, lessons)); // [NEW] Backend fallback for frontend loadLessons() failures
        return result;

    } catch (error) {
        console.error("Dashboard Data Error:", error);
        throw new HttpsError('internal', 'Failed to fetch dashboard data.');
    }
});

// 8.0 指派學生給老師 (Admin/Tutor)
exports.assignStudentToTutor = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const uid = auth.uid;
    const requesterRole = await getRole(uid);
    assertAdminRole(requesterRole);

    const { studentUid, unitId, tutorEmail } = data;
    assertRequiredValue(studentUid, '缺少學生 ID');
    assertRequiredValue(unitId, '缺少單元 ID');

    try {
        await upsertStudentUnitAssignment(admin.firestore(), studentUid, unitId, tutorEmail || null, uid, true);

        return { success: true };
    } catch (e) {
        throw new HttpsError('internal', e.message);
    }
});

// ==========================================
// 8. 作業系統 (Assignment System)
// ==========================================

// 8.1 作業紀錄寫入/正式提交 (Student)
exports.submitAssignment = onCall(async (request) => {
    const { data, auth } = request;
    // 1. Verify Auth
    assertAuthenticated(auth);

    const { courseId, unitId, assignmentId, url, note, title, status, assignmentType } = data;
    const userId = auth.uid;
    const userEmail = auth.token.email || "Unknown";
    const userName = await resolveUserDisplayName(admin.firestore(), userId, userEmail, auth.token.name || "");

    // Simple validation (unless just starting)
    const currentStatus = status || "submitted";
    if (!url && currentStatus !== 'started') {
        throw new HttpsError('invalid-argument', '請提供作業連結 (GitHub / Demo)');
    }

    const db = admin.firestore();

    try {
        const lessons = await getLessons();
        const access = await resolveSubmissionAccessOrThrow(db, userId, courseId, unitId, lessons);
        const assignedTutorEmail = access.assignedTutorEmail || null;

        // [CANONICAL MIGRATION] Always resolve and write under the canonical keys
        const canonicalUnitId = access.canonicalUnitId;
        const canonicalAssignmentId = canonicalUnitId.replace(/\.html$/i, "");
        const canonicalDocId = `${userId}_${canonicalAssignmentId}`;
        const docRef = db.collection('assignments').doc(canonicalDocId);

        const submissionUrl = normalizeText(url || "");
        const isAssignmentInvite = /classroom\.github\.com\/a\//i.test(submissionUrl);
        if (currentStatus === "submitted" && isAssignmentInvite && GITHUB_ORG_ADMIN_TOKEN) {
            const membership = await ensureGithubOrgMembership({
                admin,
                token: GITHUB_ORG_ADMIN_TOKEN,
                firebaseUid: userId,
                org: GITHUB_CLASSROOM_ORG
            });
            if (!membership.ok) {
                const base = '尚未完成 GitHub 組織授權。請先到 https://github.com/settings/organizations 接受邀請後重試。';
                const detail = membership.state === "missing_github_identity"
                    ? '（目前帳號尚未綁定 GitHub 登入）'
                    : membership.state === "invited"
                        ? '（系統已自動補發邀請）'
                        : '';
                throw new HttpsError('failed-precondition', `${base}${detail}`);
            }
        }

        // Prevent status downgrade
        const existingDoc = await docRef.get();
        let finalStatus = currentStatus;
        if (existingDoc.exists) {
            const existingData = existingDoc.data();
            const existingStatus = existingData.currentStatus || existingData.status;
            if ((existingStatus === 'submitted' || existingStatus === 'graded') && currentStatus === 'started') {
                finalStatus = existingStatus;
            }
        }

        const now = admin.firestore.Timestamp.now();
        const submittedAtISO = nowIsoTimestamp();

        const historyEntry = {
            timestamp: submittedAtISO,
            url: url || "",
            note: note || '',
            action: currentStatus === 'started' ? 'START' : 'SUBMIT'
        };

        const assignmentData = {
            ...buildAssignmentSubmissionRecord({
                docId: canonicalDocId,
                userId,
                userEmail,
                userName,
                courseId,
                unitId: canonicalUnitId,
                assignmentId: canonicalAssignmentId,
                title,
                url,
                note,
                finalStatus,
                assignmentType,
                assignedTutorEmail,
                existingLearningState: existingDoc.exists ? (existingDoc.data().learningState || 'in_progress') : 'in_progress'
            }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const submissionWrite = {
            ...assignmentData,
            submittedAt: admin.firestore.FieldValue.serverTimestamp(),
            grade: null,
            tutorFeedback: null
        };

        await addAssignmentHistoryEntry(docRef, submissionWrite, historyEntry, existingDoc.exists ? 'update' : 'set');

        if (currentStatus === 'submitted' && assignedTutorEmail) {
            const dashboardUrl = `https://vibe-coding.tw/dashboard.html?courseId=${encodeURIComponent(access.effectiveCourseId)}&unitId=${encodeURIComponent(access.canonicalUnitId)}&tab=assignments`;
            await sendAssignmentNotification(assignedTutorEmail, userName, assignmentData.assignmentTitle, dashboardUrl, canonicalUnitId);
        }

        return { success: true, message: currentStatus === 'started' ? "紀錄已更新" : "作業繳交成功！" };

    } catch (e) {
        console.error("Submit Assignment Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

exports.gradeAssignment = onCall(async (request) => {
    throw new HttpsError(
        'failed-precondition',
        'Manual grading has been removed. Please use GitHub autograde sync.'
    );
});

// 8.2 GitHub 自動評分寫回 (MVP)
exports.ingestGithubAutograde = onRequest(async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const signature = req.get("x-hub-signature-256") || "";
        if (GITHUB_WEBHOOK_SECRET) {
            if (!signature.startsWith("sha256=")) {
                return res.status(401).json({ success: false, error: "Missing signature" });
            }
            const expected = "sha256=" + crypto
                .createHmac("sha256", GITHUB_WEBHOOK_SECRET)
                .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
                .digest("hex");
            const sigBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expected);
            if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                return res.status(401).json({ success: false, error: "Invalid signature" });
            }
        }

        const payload = (req.body && typeof req.body === "object") ? req.body : {};
        const assignmentDocId = payload.assignmentDocId || payload.assignment?.docId || null;
        const userId = payload.userId || payload.assignment?.userId || null;
        const assignmentId = payload.assignmentId || payload.assignment?.assignmentId || null;
        const unitIdFromPayload = payload.unitId || payload.assignment?.unitId || null;
        const repositoryFullName = payload.repository?.full_name || payload.repo || "";
        const scoreRaw = payload.score ?? payload.grade ?? payload.autoGrade?.score;
        const maxScoreRaw = payload.maxScore ?? payload.autoGrade?.maxScore ?? null;
        const score = Number(scoreRaw);
        const maxScore = maxScoreRaw !== null && maxScoreRaw !== undefined ? Number(maxScoreRaw) : null;

        const { resolvedDocId, inferredUnitId, candidateCount, candidateIds } = await resolveAutogradeAssignmentDocId(db, {
            assignmentDocId,
            userId,
            assignmentId,
            unitIdFromPayload,
            repositoryFullName
        });

        if (!resolvedDocId && candidateCount > 1) {
            await sendAutogradeFailureAlertEmail(
                process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                `Ambiguous assignment mapping for unit ${inferredUnitId}`,
                {
                    repository: repositoryFullName,
                    inferredUnitId,
                    candidateCount,
                    candidateIds,
                    payload
                }
            );
            return res.status(409).json({
                success: false,
                error: "Ambiguous assignment mapping. Please provide userId + unitId.",
                inferredUnitId,
                candidateCount
            });
        }

        if (!resolvedDocId) {
            try {
                await sendAutogradeFailureAlertEmail(
                    process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                    'Missing assignment identifier',
                    payload
                );
            } catch (notifyErr) {
                console.error("[ingestGithubAutograde] Failed to send alert for missing identifier:", notifyErr);
            }
            return res.status(400).json({
                success: false,
                error: "Missing assignment identifier. Provide userId + unitId."
            });
        }
        if (!Number.isFinite(score)) {
            try {
                await sendAutogradeFailureAlertEmail(process.env.ADMIN_EMAIL || process.env.MAIL_USER, 'Invalid score value', payload);
            } catch (notifyErr) {
                console.error("[ingestGithubAutograde] Failed to send alert for invalid score:", notifyErr);
            }
            return res.status(400).json({ success: false, error: "Invalid score value." });
        }

        const assignmentRef = db.collection("assignments").doc(resolvedDocId);
        const assignmentDoc = await assignmentRef.get();
        if (!assignmentDoc.exists) {
            try {
                await sendAutogradeFailureAlertEmail(process.env.ADMIN_EMAIL || process.env.MAIL_USER, `Assignment not found: ${resolvedDocId}`, payload);
            } catch (notifyErr) {
                console.error("[ingestGithubAutograde] Failed to send alert for missing assignment doc:", notifyErr);
            }
            return res.status(404).json({ success: false, error: "Assignment not found." });
        }

        const now = admin.firestore.Timestamp.now();
        const assignmentData = assignmentDoc.data() || {};
        const studentUid = assignmentData.userId || userId || resolvedDocId.split('_')[0];
        const assignmentIdVal = assignmentData.assignmentId || effectiveUnitId;
        const ownerTutorEmail = assignmentData.assignedTutorEmail || "";

        // Verification: Ensure the webhook request comes from an authorized repository organization
        if (repositoryFullName) {
            const parts = repositoryFullName.split('/');
            const repoOwner = parts[0] || "";
            let isAllowedOrg = ['vibe-coding-classroom', 'vibe-coding-template'].includes(repoOwner);

            if (!isAllowedOrg && ownerTutorEmail) {
                const tutorSnap = await db.collection('users')
                    .where('email', '==', ownerTutorEmail.toLowerCase())
                    .limit(1)
                    .get();
                if (!tutorSnap.empty) {
                    const tutorData = tutorSnap.docs[0].data();
                    const config = getUserTutorConfig(tutorData, assignmentIdVal);
                    if (config && config.githubOrg && config.githubOrg === repoOwner) {
                        isAllowedOrg = true;
                    }
                }
            }

            if (!isAllowedOrg) {
                console.warn(`[ingestGithubAutograde] Rejecting webhook from unauthorized organization: ${repoOwner}`);
                return res.status(403).json({ success: false, error: "Unauthorized repository organization" });
            }
        }

        const learningStateUpdate = await syncAutoGradeInterventions(db, {
            assignmentId: assignmentIdVal,
            studentUid,
            ownerTutorEmail,
            score,
            now,
            assignmentLearningState: assignmentData.learningState || ''
        });

        const updatePayload = buildGithubAutogradePayload({
            score,
            maxScore,
            scoreRaw,
            maxScoreRaw,
            payload,
            now,
            learningStateUpdate
        });

        await addAssignmentHistoryEntry(assignmentRef, updatePayload, {
            timestamp: now,
            action: "AUTO_GRADE",
            content: `GitHub auto-grade: ${score}${Number.isFinite(maxScore) ? `/${maxScore}` : ""}`
        }, 'set');

        try {
            await backfillAutogradeGithubVariables({
                repositoryFullName: updatePayload.autoGrade.repository || repositoryFullName || "",
                assignmentData: assignmentDoc.data() || {},
                userId,
                unitIdFromPayload,
                assignmentId
            }, GITHUB_ORG_ADMIN_TOKEN);
        } catch (varErr) {
            console.warn("[ingestGithubAutograde] Variable backfill error:", varErr);
        }

        try {
            await sendAutogradeNotifications({
                assignmentData: assignmentDoc.data() || {},
                resolvedDocId,
                score,
                maxScore,
                updatePayload
            });
        } catch (notifyErr) {
            console.error("[ingestGithubAutograde] Notification send failed:", notifyErr);
        }

        return res.status(200).json({ success: true, assignmentId: resolvedDocId });
    } catch (error) {
        console.error("ingestGithubAutograde Error:", error);
        try {
            await sendAutogradeFailureAlertEmail(
                process.env.ADMIN_EMAIL || process.env.MAIL_USER,
                `Internal server error: ${error.message || 'unknown'}`,
                (req.body && typeof req.body === "object") ? req.body : {}
            );
        } catch (notifyErr) {
            console.error("[ingestGithubAutograde] Failed to send alert for internal error:", notifyErr);
        }
        return res.status(500).json({ success: false, error: "Internal server error" });
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
                role: 'user', // Admin roles must be set manually in Firestore or via Dashboard sync
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
                    const displayName = await resolveUserDisplayName(
                        admin.firestore(),
                        orderData.uid || "",
                        email || "",
                        userRecord.displayName || ""
                    );

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
// 8.6 學生指派提醒 (remindAdminPendingAssignments - kept name for compatibility)
// ==========================================
// Run every day at 9:00 AM Asia/Taipei
exports.remindAdminPendingAssignments = onSchedule({
    schedule: '0 9 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
    const db = admin.firestore();

    try {
        const lessons = await getLessons();
        const unitToCourse = new Map();
        lessons.forEach(course => {
            const units = Array.isArray(course.courseUnits) ? course.courseUnits : [];
            units.forEach(unitId => unitToCourse.set(String(unitId), course));
        });

        const unitRequiresTutorAssignment = (unitId) => {
            if (!unitId) return false;
            const course = unitToCourse.get(String(unitId));
            if (!course) return false;
            const price = Math.max(
                Number(resolveLessonPrice(course, "zh-TW").amount || 0),
                Number(resolveLessonPrice(course, "en").amount || 0)
            );
            return price > 0 && course.isPhysical !== true;
        };

        // 1. Get all successful orders
        const ordersSnapshot = await db.collection('orders').where('status', '==', 'SUCCESS').get();
        const pendingMap = new Map(); // uid -> Set of unitIds

        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid && data.items) {
                const purchasedUnits = collectPurchasedUnitIds(data.items, lessons, orderNormalizationResolvers);
                purchasedUnits.forEach(unitId => {
                    // Only keep paid, non-physical course units that need tutor assignment.
                    if (!unitRequiresTutorAssignment(unitId)) return;
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

        // 3. Notify students directly (do NOT notify admin).
        if (pendingAssignments.length > 0) {
            console.log(`Found ${pendingAssignments.length} users with pending assignments. Notifying students.`);
            for (const item of pendingAssignments) {
                if (!item?.email) continue;
                const studentName = fallbackNameFromEmail(item.email, '同學');
                await sendStudentPendingTutorAssignmentReminder(item.email, studentName, item.units || []);
            }
        } else {
            console.log("No pending tutor assignments found.");
        }

    } catch (error) {
        console.error("Error in remindAdminPendingAssignments:", error);
    }
});

// ==========================================
// 8.7 管理員出貨提醒 (remindAdminPendingShipments)
// ==========================================
// Run every day at 9:30 AM Asia/Taipei
exports.remindAdminPendingShipments = onSchedule({
    schedule: '30 9 * * *',
    timeZone: 'Asia/Taipei'
}, async (event) => {
    const db = admin.firestore();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER;
    if (!adminEmail) return;

    try {
        const lessons = await getLessons();
        const physicalUnitIds = getPhysicalUnitIdSet(lessons);

        // 1. Get all successful orders that contain physical items and aren't shipped
        const ordersSnapshot = await db.collection('orders')
            .where('status', '==', 'SUCCESS')
            .get();

        const pendingShipments = [];

        for (const doc of ordersSnapshot.docs) {
            const data = doc.data();
            if (data.fulfillmentStatus === 'SHIPPED') continue;

            const items = data.items || {};
            const physicalItems = Object.keys(items).filter((id) => isPhysicalOrderItem(id, items[id] || {}, physicalUnitIds));
            if (physicalItems.length > 0) {
                // Fetch user info for the email
                const userDoc = await db.collection('users').doc(data.uid).get();
                const userData = userDoc.exists ? userDoc.data() : {};

                pendingShipments.push(buildPendingShipmentReminderEntry({
                    orderId: doc.id,
                    email: userData.email || '未提供',
                    items: physicalItems.map(id => lessons.find(l => l.id === id)?.title || items[id]?.name || id),
                    paidAt: formatTaipeiDateTime(data.paidAt)
                }));
            }
        }

        if (pendingShipments.length > 0) {
            console.log(`Found ${pendingShipments.length} pending shipments. Notifying admin.`);
            const { sendAdminShipmentReminder } = require('./emailService');
            await sendAdminShipmentReminder(adminEmail, pendingShipments);
        } else {
            console.log("No pending shipments found.");
        }

    } catch (error) {
        console.error("Error in remindAdminPendingShipments:", error);
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

// 11.1 驗證老師作業連結 (verifyReferralLink)
const verifyReferralLinkHandler = onCall(async (request) => {
    const { data } = request;
    const referralLink = data?.referralLink || data?.promoCode;
    const { cartItems = [] } = data || {};
    if (!referralLink) throw new HttpsError('invalid-argument', '缺少老師作業連結');

    try {
        const db = admin.firestore();
        const inputStr = normalizeText(referralLink);

        const lowerInput = inputStr.toLowerCase();
        const isUrl = lowerInput.includes('github.com/classroom/') || lowerInput.includes('classroom.github.com/');

        if (isUrl) {
            console.log(`[Referral] Resolving GitHub Link via index: ${inputStr}`);
            const normalizedLink = normalizeGitHubUrl(inputStr);
            const linkId = buildReferralLinkDocId(normalizedLink);
            const linkDoc = await db.collection('referral_links').doc(linkId).get();

            if (!linkDoc.exists) {
                return { success: false, message: '查無此作業連結對應的導師 (若剛更新設定，請稍候 30 秒)' };
            }

            const lData = linkDoc.data();
            const tEmail = lData.tutorEmail;
            const tutorUserDoc = await findUserDocByEmail(db, tEmail);
            if (!tutorUserDoc) {
                return { success: false, message: '對應的導師帳號似乎已被移除' };
            }
            const tutorData = tutorUserDoc.data() || {};
            const lessons = await getLessons();

            if (cartItems && cartItems.length > 0) {
                const results = cartItems.map(item => {
                    const courseId = item.courseId || item.id;
                    return {
                        courseId,
                        qualified: isTutorFullyQualifiedForCourse(tutorData, courseId, lessons)
                    };
                });
                const allQualified = results.every(r => r.qualified);
                if (!allQualified) {
                    const failId = results.find(r => !r.qualified).courseId;
                    return { success: false, message: `此導師尚未取得「${failId}」的全單元認證，無法作為推薦人。` };
                }
            }

            return {
                success: true,
                referredTutorEmail: tEmail,
                referredTutorName: tutorData.name || tEmail,
                courseId: lData.unitId,
                isLink: true,
                message: '已成功辨識老師推薦連結'
            };
        }

        return { success: false, message: '目前僅支援以作業連結作為推薦識別，請輸入老師提供的連結。' };
    } catch (e) {
        console.error(`[Referral] Error: ${e.message}`);
        throw new HttpsError('internal', e.message);
    }
});
exports.verifyReferralLink = verifyReferralLinkHandler;
exports.verifyPromoCode = verifyReferralLinkHandler;

function normalizeClassroomInvite(value = '') {
    const s = String(value || '').trim();
    if (!s) return '';
    try {
        const url = new URL(s);
        if (url.hostname !== 'classroom.github.com') return s;
        return `${url.origin}${url.pathname}`.replace(/\/+$/, '').toLowerCase();
    } catch (_) {
        const token = s.replace(/^https?:\/\/classroom\.github\.com\/a\//i, '').replace(/\/+$/, '');
        return token ? `https://classroom.github.com/a/${token}`.toLowerCase() : '';
    }
}

function extractInviteCandidates(cfg) {
    if (!cfg) return [];
    if (typeof cfg === 'string') return [normalizeClassroomInvite(cfg)].filter(Boolean);
    if (typeof cfg === 'object') {
        return Object.values(cfg)
            .filter(v => typeof v === 'string' && v.trim())
            .map(v => normalizeClassroomInvite(v))
            .filter(Boolean);
    }
    return [];
}

async function lookupClassroomInviteBinding(inputRaw) {
    const normalizedInvite = normalizeClassroomInvite(inputRaw);
    if (!normalizedInvite.includes('classroom.github.com/a/')) {
        throw new HttpsError('invalid-argument', '請輸入 GitHub Classroom 邀請連結或 invite code。');
    }

    const lessons = await getLessons();
    const matches = [];
    for (const lesson of lessons) {
        const urlMap = lesson?.githubClassroomUrls || {};
        for (const [unitKey, cfg] of Object.entries(urlMap)) {
            const candidates = extractInviteCandidates(cfg);
            if (!candidates.includes(normalizedInvite)) continue;
            matches.push({
                lessonDocId: lesson.id || null,
                courseId: lesson.courseId || lesson.id || null,
                title: lesson.title || null,
                unitKey,
                courseUnits: Array.isArray(lesson.courseUnits) ? lesson.courseUnits : []
            });
        }
    }
    return { success: true, normalizedInvite, totalMatches: matches.length, matches };
}

exports.findClassroomInviteBinding = onCall(async (request) => {
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'User must be logged in.');
    const requesterRole = await getRole(auth.uid);
    if (requesterRole !== 'admin') throw new HttpsError('permission-denied', 'Only admins can query invite bindings.');

    const inputRaw = String(
        request.data?.inviteCodeOrUrl ||
        request.data?.inviteUrl ||
        request.data?.inviteCode ||
        ''
    ).trim();
    if (!inputRaw) throw new HttpsError('invalid-argument', '缺少 inviteCodeOrUrl');
    return lookupClassroomInviteBinding(inputRaw);
});

exports.findClassroomInviteBindingHttp = onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', 'https://vibe-coding.tw');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing bearer token' });
        const idToken = authHeader.substring(7);
        const decoded = await admin.auth().verifyIdToken(idToken);
        const requesterRole = await getRole(decoded.uid);
        if (requesterRole !== 'admin') return res.status(403).json({ error: 'Only admins can query invite bindings.' });

        const inputRaw = String(
            req.body?.inviteCodeOrUrl ||
            req.body?.inviteUrl ||
            req.body?.inviteCode ||
            req.body?.data?.inviteCodeOrUrl ||
            ''
        ).trim();
        if (!inputRaw) return res.status(400).json({ error: '缺少 inviteCodeOrUrl' });

        const result = await lookupClassroomInviteBinding(inputRaw);
        return res.json(result);
    } catch (error) {
        console.error('[findClassroomInviteBindingHttp] failed:', error);
        return res.status(500).json({ error: error.message || 'internal error' });
    }
});

exports.precheckGithubClassroomAccess = onCall(async (request) => {
    const { auth, data } = request;
    if (!auth) throw new HttpsError('unauthenticated', '請先登入');

    if (!GITHUB_ORG_ADMIN_TOKEN) {
        return {
            success: false,
            precheckEnabled: false,
            state: "disabled",
            message: "GitHub precheck is not configured."
        };
    }

    const classroomUrl = String(data?.classroomUrl || "").trim();
    const isClassroom = /classroom\.github\.com\/a\//i.test(classroomUrl);
    if (!isClassroom) {
        return {
            success: true,
            precheckEnabled: true,
            state: "skipped",
            message: "Not a GitHub Classroom invite URL."
        };
    }

    try {
        const result = await ensureGithubOrgMembership({ admin, token: GITHUB_ORG_ADMIN_TOKEN, firebaseUid: auth.uid, org: GITHUB_CLASSROOM_ORG });
        return {
            success: result.ok === true,
            precheckEnabled: true,
            state: result.state,
            org: result.org,
            githubLogin: result.githubLogin || null,
            inviteSent: result.inviteSent === true,
            inviteId: result.inviteId || null,
            settingsUrl: "https://github.com/settings/organizations"
        };
    } catch (error) {
        console.error("[precheckGithubClassroomAccess] failed:", error);
        return {
            success: false,
            precheckEnabled: true,
            state: "error",
            message: error.message || "precheck failed",
            settingsUrl: "https://github.com/settings/organizations"
        };
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

    const policyCache = new Map();
    const userByEmailCache = new Map();
    const balanceAgg = new Map();
    const ymFromDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const parseYm = (ym) => {
        const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
        if (!m) return null;
        return { y: Number(m[1]), m: Number(m[2]) };
    };
    const addMonthsYm = (ym, delta) => {
        const parsed = parseYm(ym);
        if (!parsed) return ym;
        const d = new Date(parsed.y, parsed.m - 1 + Number(delta || 0), 1);
        return ymFromDate(d);
    };
    const ymLTE = (a, b) => String(a || "") <= String(b || "");
    const countValidityMonths = (paidAtTs, expiryTs, fallbackMonths = 12) => {
        try {
            if (!paidAtTs?.toDate || !expiryTs?.toDate) return Math.max(1, Number(fallbackMonths || 12));
            const p = paidAtTs.toDate();
            const e = expiryTs.toDate();
            let months = (e.getFullYear() - p.getFullYear()) * 12 + (e.getMonth() - p.getMonth());
            if (e.getDate() >= p.getDate()) months += 1;
            return Math.max(1, months);
        } catch {
            return Math.max(1, Number(fallbackMonths || 12));
        }
    };
    const getPayoutAccountFromUser = (userData = {}) => {
        if (!userData || typeof userData !== "object") return "";
        if (typeof userData.payoutAccount === "string" && userData.payoutAccount.trim()) return userData.payoutAccount.trim();
        if (typeof userData.paymentAccount === "string" && userData.paymentAccount.trim()) return userData.paymentAccount.trim();
        const map = userData.payoutAccounts || {};
        const candidate = map.default || map.bank || "";
        return typeof candidate === "string" ? candidate.trim() : "";
    };
    const getUserByEmail = async (email = "") => {
        const normalized = normalizeEmail(email);
        if (!normalized) return null;
        if (userByEmailCache.has(normalized)) return userByEmailCache.get(normalized);
        const userDoc = await findUserDocByEmail(db, normalized);
        const userData = userDoc ? (userDoc.data() || null) : null;
        userByEmailCache.set(normalized, userData);
        return userData;
    };

    try {
        const revenueConfigDoc = await db.collection("metadata_settings").doc("revenue_share_config").get();
        const revenueConfig = revenueConfigDoc.exists ? (revenueConfigDoc.data() || {}) : {};
        const defaultValidityMonths = Math.max(1, Number(revenueConfig.defaultValidityMonths || 12));
        const fallbackPayoutEmail = normalizeEmail(revenueConfig.defaultPayoutEmail || "info@vibe-coding.tw") || "info@vibe-coding.tw";
        const targetPeriod = ymFromDate(lastMonth);

        // 1) For last month successful orders, generate/refresh share credits.
        const ordersSnapshot = await db.collection('orders')
            .where('status', '==', 'SUCCESS')
            .where('paidAt', '>=', admin.firestore.Timestamp.fromDate(lastMonth))
            .where('paidAt', '<=', admin.firestore.Timestamp.fromDate(endOfLastMonth))
            .get();

        const auditTrail = [];
        const creditTrail = [];
        const collectShareTargets = async ({ order, orderId, studentUid, itemKey, itemValue, lineAmount, policy }) => {
            const targets = [];
            const initialTutor = (itemValue?.referredTutorEmail && itemValue.referredTutorEmail.trim())
                ? normalizeEmail(itemValue.referredTutorEmail)
                : ((itemValue?.referralTutor && itemValue.referralTutor.trim()) ? normalizeEmail(itemValue.referralTutor) : fallbackPayoutEmail);

            await collectRevenueShareChainTargets({
                targets,
                role: "tutor",
                initialEmail: initialTutor,
                initialShare: lineAmount * Number(policy.tutorRate || DEFAULT_REVENUE_SHARE_POLICY.tutorRate),
                uplineRate: policy.tutorUplineRate || DEFAULT_REVENUE_SHARE_POLICY.tutorUplineRate,
                stopEmail: fallbackPayoutEmail,
                getNextEmail: async (currentEmail) => {
                    const tutorData = await getUserByEmail(currentEmail);
                    return normalizeEmail(tutorData?.tutorEmail || fallbackPayoutEmail);
                }
            });

            const { agentEmail, courseDevEmail, courseDevUplineEmail } = await resolveRevenueShareRoleEmails({
                itemValue,
                order,
                initialTutor,
                getUserByEmail
            });
            if (agentEmail && Number(policy.agentRate || 0) > 0) {
                await collectRevenueShareChainTargets({
                    targets,
                    role: "agent",
                    initialEmail: agentEmail,
                    initialShare: lineAmount * Number(policy.agentRate || 0),
                    uplineRate: policy.agentUplineRate || 0,
                    getNextEmail: async (currentEmail) => {
                        const agentData = await getUserByEmail(currentEmail);
                        return normalizeEmail(agentData?.agentEmail || "");
                    }
                });
            }

            if (courseDevEmail && Number(policy.courseDevRate || 0) > 0) {
                await collectRevenueShareChainTargets({
                    targets,
                    role: "courseDev",
                    initialEmail: courseDevEmail,
                    initialShare: lineAmount * Number(policy.courseDevRate || 0),
                    initialNextEmail: courseDevUplineEmail,
                    uplineRate: policy.courseDevUplineRate || 0,
                    getNextEmail: async (currentEmail) => {
                        const cdData = await getUserByEmail(currentEmail);
                        return normalizeEmail(cdData?.courseDevEmail || cdData?.tutorEmail || "");
                    }
                });
            }
            return targets;
        };

        for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            const orderId = orderDoc.id;
            const studentUid = order.uid;
            const items = order.items || {};

            for (const [itemKey, itemValue] of Object.entries(items)) {
                const quantity = parseInt(itemValue?.quantity || 1, 10) || 1;
                const itemPrice = parseFloat(itemValue?.price || 0) || 0;
                const lineAmount = itemPrice * quantity;
                const itemReferralLink = itemValue?.referralLink || itemValue?.promoCode || null;
                const effectivePolicyId = normalizeText(order.policyId || "") || DEFAULT_REVENUE_SHARE_POLICY.policyId;
                const policy = await loadRevenueSharePolicy({ db, policyCache, policyId: effectivePolicyId });

                if (lineAmount <= 0) continue;

                const policySnapshot = buildRevenueSharePolicySnapshot(policy);
                const shareTargets = await collectShareTargets({
                    order,
                    orderId,
                    studentUid,
                    itemKey,
                    itemValue,
                    lineAmount,
                    policy
                });
                const validityMonths = Math.max(
                    1,
                    Number(itemValue?.validityMonths || order?.validityMonths || countValidityMonths(order?.paidAt, order?.expiryDate, defaultValidityMonths))
                );
                const creditStartPeriod = order?.paidAt?.toDate ? ymFromDate(order.paidAt.toDate()) : targetPeriod;

                for (const target of shareTargets) {
                    const recipientEmail = normalizeEmail(target.recipientEmail || "") || fallbackPayoutEmail;
                    const totalCredit = round2Amount(target.shareAmount);
                    if (totalCredit < 0.01) continue;
                    const creditSeed = `${orderId}|${itemKey}|${target.role}|${target.level}|${recipientEmail}`;
                    const creditId = crypto.createHash("sha256").update(creditSeed).digest("hex").slice(0, 40);
                    const creditRef = db.collection("revenue_share_credits").doc(creditId);
                    const existingCredit = await creditRef.get();
                    if (!existingCredit.exists) {
                        const monthlyInstallment = round2Amount(totalCredit / validityMonths);
                        const creditDoc = buildRevenueShareCreditRecord({
                            creditId,
                            orderId,
                            orderItemId: itemKey,
                            studentUid,
                            role: target.role,
                            recipientEmail,
                            level: target.level,
                            referralLink: itemReferralLink,
                            policyId: policy.policyId,
                            policySnapshot,
                            orderAmount: lineAmount,
                            totalCredit,
                            validityMonths,
                            monthlyInstallment,
                            creditStartPeriod,
                            now: admin.firestore.FieldValue.serverTimestamp()
                        });
                        await creditRef.set(creditDoc, { merge: true });
                        creditTrail.push({ creditId, ...creditDoc });
                    }
                }
            }
        }

        // 2) Monthly settlement: pay due credits by installment.
        const creditsSnapshot = await db.collection("revenue_share_credits")
            .where("status", "in", ["active", "pending_account"])
            .get();

        for (const creditDoc of creditsSnapshot.docs) {
            const credit = creditDoc.data() || {};
            const recipientEmail = normalizeEmail(credit.recipientEmail || "");
            if (!recipientEmail) continue;
            const nextPayoutPeriod = String(credit.nextPayoutPeriod || credit.startPeriod || "");
            const remainingCredit = round2Amount(credit.remainingCredit || 0);
            if (!nextPayoutPeriod || remainingCredit < 0.01) continue;
            if (!ymLTE(nextPayoutPeriod, targetPeriod)) continue;

            const recipientUser = await getUserByEmail(recipientEmail);
            const payoutAccount = getPayoutAccountFromUser(recipientUser);
            const monthlyInstallment = round2Amount(credit.monthlyInstallment || 0);
            const plannedPay = Math.min(remainingCredit, monthlyInstallment > 0 ? monthlyInstallment : remainingCredit);
            const paidAmount = payoutAccount ? round2Amount(plannedPay) : 0;
            const blockedAmount = payoutAccount ? 0 : round2Amount(plannedPay);

            const idempotencySeed = `${targetPeriod}|${creditDoc.id}|payout`;
            const idempotencyKey = crypto.createHash("sha256").update(idempotencySeed).digest("hex").slice(0, 40);
            const payoutRef = db.collection("profit_ledger").doc(idempotencyKey);
            const payoutRow = buildRevenueSharePayoutRow({
                idempotencyKey,
                credit: { ...credit, creditId: creditDoc.id },
                recipientEmail,
                paidAmount,
                plannedPay,
                blockedAmount,
                payoutAccountPresent: Boolean(payoutAccount),
                targetPeriod
            });
            await payoutRef.set(payoutRow, { merge: true });
            auditTrail.push(payoutRow);

            const newPaid = round2Amount((credit.paidCredit || 0) + paidAmount);
            const newRemaining = round2Amount((credit.remainingCredit || 0) - paidAmount);
            const isCompleted = newRemaining < 0.01;
            const nextPeriod = payoutAccount && !isCompleted ? addMonthsYm(nextPayoutPeriod, 1) : nextPayoutPeriod;
            await creditDoc.ref.set({
                paidCredit: newPaid,
                remainingCredit: Math.max(0, newRemaining),
                nextPayoutPeriod: nextPeriod,
                status: isCompleted ? "completed" : (payoutAccount ? "active" : "pending_account"),
                lastSettledPeriod: targetPeriod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // 3) Rebuild balances snapshot per recipient.
        const allCredits = await db.collection("revenue_share_credits").get();
        for (const cDoc of allCredits.docs) {
            const c = cDoc.data() || {};
            const email = normalizeEmail(c.recipientEmail || "");
            if (!email) continue;
            const acc = balanceAgg.get(email) || buildRevenueShareBalanceRecord({ recipientEmail: email });
            acc.totalCredit = round2Amount(acc.totalCredit + Number(c.totalCredit || 0));
            acc.totalPaid = round2Amount(acc.totalPaid + Number(c.paidCredit || 0));
            acc.remainingBalance = round2Amount(acc.remainingBalance + Number(c.remainingCredit || 0));
            if (String(c.status || "") === "active") acc.activeCredits += 1;
            if (String(c.status || "") === "pending_account") acc.pendingAccountCredits += 1;
            balanceAgg.set(email, acc);
        }
        for (const [email, rec] of balanceAgg.entries()) {
            const user = await getUserByEmail(email);
            const payoutAccount = getPayoutAccountFromUser(user);
            const balanceId = crypto.createHash("sha256").update(email).digest("hex").slice(0, 40);
            await db.collection("revenue_share_balances").doc(balanceId).set({
                ...rec,
                payoutAccountPresent: Boolean(payoutAccount),
                lastCalculatedPeriod: targetPeriod,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        console.log(`Profit sharing completed. createdCredits=${creditTrail.length}, ledgerRows=${auditTrail.length}, balances=${balanceAgg.size}`);
    } catch (error) {
        console.error("Error in calculateMonthlySharing:", error);
    }
});

exports.calculateAnnualInvestorDividends = onSchedule({
    schedule: "0 0 1 1 *",
    timeZone: "Asia/Taipei"
}, async () => {
    const db = admin.firestore();
    const currentYear = new Date().getFullYear();
    const targetYear = currentYear - 1;
    try {
        const result = await settleAnnualInvestorDividends({
            db,
            year: targetYear,
            profileCache: new Map(),
            configCache: new Map(),
            createdByUid: "system"
        });
        console.log(`[calculateAnnualInvestorDividends] Completed for year=${targetYear} settlements=${result.settlementCount}`);
    } catch (error) {
        console.error("Error in calculateAnnualInvestorDividends:", error);
    }
});

/**
 * [NEW] Mark an order as shipped (markOrderShipped)
 */
exports.markOrderShipped = onCall(async (request) => {
    const { orderId } = request.data;
    const uid = request.auth?.uid;
    assertAuthenticated(request.auth, '請先登入');
    assertRequiredValue(orderId, '缺少訂單編號');

    const db = admin.firestore();
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        assertAdminRole(userDoc.data()?.role, '只有管理員可以標記出貨');

        await db.collection('orders').doc(orderId).update({
            fulfillmentStatus: 'SHIPPED',
            shippedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (orderDoc.exists) {
                const order = orderDoc.data() || {};
                const studentUid = order.uid;
                if (studentUid && studentUid !== 'GUEST') {
                    const userRecord = await admin.auth().getUser(studentUid);
                    const studentEmail = userRecord?.email || '';
                    const items = order.items || {};
                    const itemsDesc = Object.values(items).map(item => item?.name || '教材').join(', ');
                    await sendOrderShippedEmail(studentEmail, orderId, itemsDesc, order.logistics || {});
                }
            }
        } catch (notifyErr) {
            console.error(`[markOrderShipped] Failed to send shipped email for ${orderId}:`, notifyErr);
        }

        console.log(`Order ${orderId} marked as SHIPPED by ${uid}`);
        return { success: true };
    } catch (error) {
        console.error("Error in markOrderShipped:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

/**
 * [V16.1] Bind a tutor to a unit via a Classroom URL (Self-Binding)
 * Triggered when a student enters a tutor's link in the assignment modal.
 */
exports.bindTutorToUnit = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const { unitId, courseId, referralLink } = data;
    assertRequiredValue(unitId, '缺少必要參數');
    assertRequiredValue(referralLink, '缺少必要參數');

    const db = admin.firestore();
    const uid = auth.uid;

    try {
        // 1. Verify Payment
        const lessons = await getLessons();
        const access = await resolveSubmissionAccessOrThrow(db, uid, courseId, unitId, lessons);

        // 2. Verify Link
        const normalizedLink = normalizeGitHubUrl(referralLink);
        const linkId = buildReferralLinkDocId(normalizedLink);
        const linkDoc = await db.collection('referral_links').doc(linkId).get();

        if (!linkDoc.exists) throw new HttpsError('not-found', '查無此作業連結對應的導師。');

        const lData = linkDoc.data();
        const tutorEmail = lData.tutorEmail;

        // 3. Verify Tutor Qualification
        const tutorUserDoc = await findUserDocByEmail(db, tutorEmail);
        if (!tutorUserDoc) throw new HttpsError('not-found', '對應的導師帳號已被移除。');

        const tutorData = tutorUserDoc.data() || {};
        const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
        const effectiveCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || courseId;

        const config = getUserTutorConfig(tutorData, canonicalUnitId);
        if (!config || config.authorized !== true) {
             throw new HttpsError('permission-denied', '此導師尚未取得該單元的指導認證。');
        }

        // 4. Bind (Upsert)
        await upsertStudentUnitAssignment(db, uid, canonicalUnitId, tutorEmail, 'selfBinding', true);

        // 5. Cascade Assignment (If it's a course bundle)
        const course = findLessonByCourseRef(effectiveCourseId, lessons);
        if (course && Array.isArray(course.courseUnits) && course.courseUnits.includes(canonicalUnitId)) {
             // If teacher is fully qualified for the course, cascade to all units
             if (isTutorFullyQualifiedForCourse(tutorData, effectiveCourseId, lessons)) {
                 for (const uId of course.courseUnits) {
                     const cId = resolveCanonicalUnitId(uId, lessons);
                     await upsertStudentUnitAssignment(db, uid, cId, tutorEmail, 'selfBinding_cascade', true);
                 }
                 console.log(`[bindTutorToUnit] Cascade-assigned ${uid} -> ${tutorEmail} for ${course.courseUnits.length} units in ${effectiveCourseId}`);
             }
        }

        await backfillTutorReferralForPaidOrders(db, {
            uid,
            unitId: canonicalUnitId,
            tutorEmail,
            assignmentUrl: normalizedLink,
            lessons,
            source: 'bindTutorToUnit'
        });

        return { success: true, tutorEmail };
    } catch (error) {
        console.error("Self-binding failed:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

/**
 * Bind tutor by promotion code for a specific unit.
 * Source of truth: users.promotionCode + users.tutorConfigs.{unitId}
 */
exports.bindTutorByPromotionCode = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const unitIdRaw = normalizeText(data?.unitId || '');
    const courseIdRaw = normalizeText(data?.courseId || '');
    const promoCodeRaw = normalizeText(data?.promotionCode || '');
    assertRequiredValue(unitIdRaw, '缺少必要參數（unitId）');

    const db = admin.firestore();
    const uid = auth.uid;
    const requesterRole = await getRole(uid);

    try {
        const lessons = await getLessons();
        const canonicalUnitId = resolveCanonicalUnitId(unitIdRaw, lessons);
        const effectiveCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || courseIdRaw;

        // Admin tutor-mode debugging/support flow should not be blocked by student payment gate.
        if (requesterRole !== 'admin') {
            await resolveSubmissionAccessOrThrow(db, uid, effectiveCourseId, canonicalUnitId, lessons);
        }

        const DEFAULT_TUTOR_EMAIL = 'rover.k.chen@gmail.com';
        const normalizedInput = promoCodeRaw;
        const promotionCode = normalizedInput.toUpperCase();
        const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedInput);
        let tutorSnap;
        let tutorDoc = null;
        let resolvedPromotionCode = promotionCode;

        if (!normalizedInput) {
            tutorDoc = await findUserDocByEmail(db, DEFAULT_TUTOR_EMAIL);
        } else if (looksLikeEmail) {
            tutorDoc = await findUserDocByEmail(db, normalizedInput);
        } else if (promotionCode) {
            tutorSnap = await db.collection('users')
                .where('promotionCode', '==', promotionCode)
                .limit(1)
                .get();
        }
        if (!tutorDoc && (!tutorSnap || tutorSnap.empty)) {
            if (!normalizedInput) {
                throw new HttpsError('not-found', '系統預設導師不存在。');
            }
            throw new HttpsError('not-found', looksLikeEmail ? '查無此 Tutor email 對應的導師。' : '查無此 Promotion code 對應的導師。');
        }

        if (!tutorDoc) {
            tutorDoc = tutorSnap.docs[0];
        }
        const tutorData = tutorDoc.data() || {};
        const tutorEmail = normalizeText(tutorData.email || '');
        if (!tutorEmail) {
            throw new HttpsError('failed-precondition', '該導師資料不完整（缺少 email）。');
        }

        const cfg = getUserTutorConfig(tutorData, canonicalUnitId);
        if (!cfg || cfg.authorized !== true) {
            throw new HttpsError('permission-denied', '此導師尚未取得該單元授權。');
        }

        const course = findLessonByCourseRef(effectiveCourseId, lessons);
        const assignmentUrl = getTutorAssignmentUrlFromConfig(cfg, course, canonicalUnitId, tutorEmail, lessons);

        if (!assignmentUrl) {
            throw new HttpsError('failed-precondition', '此導師尚未設定該單元作業連結，請通知管理員設定。');
        }

        const tutorRef = db.collection('users').doc(tutorDoc.id);
        resolvedPromotionCode = await ensureTutorPromotionCode(db, tutorRef, tutorData, tutorDoc.id, tutorEmail);

        await upsertStudentUnitAssignment(db, uid, canonicalUnitId, tutorEmail, 'promotionCodeBinding', true);

        await db.collection('users').doc(uid).set({
            [`unitAssignmentMeta.${canonicalUnitId}`]: {
                tutorUid: tutorDoc.id,
                tutorEmail,
                promotionCode: resolvedPromotionCode,
                linkedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await backfillTutorReferralForPaidOrders(db, {
            uid,
            unitId: canonicalUnitId,
            tutorEmail,
            promotionCode: resolvedPromotionCode,
            assignmentUrl,
            lessons,
            source: 'bindTutorByPromotionCode'
        });

        return {
            success: true,
            tutorEmail,
            tutorName: tutorData.name || tutorEmail,
            promotionCode: resolvedPromotionCode,
            assignmentUrl
        };
    } catch (error) {
        console.error('bindTutorByPromotionCode failed:', error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

// === Tutor x Student Interaction MVP Functions ===

// 1. Submit Blocker (Student)
exports.submitStudentBlocker = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, '請先登入');

    const { assignmentId, blockerType, blockerNote } = data;
    assertRequiredValue(assignmentId, '缺少必要參數');
    assertRequiredValue(blockerType, '缺少必要參數');
    assertRequiredValue(blockerNote, '缺少必要參數');

    const userId = auth.uid;
    const db = admin.firestore();

    try {
        const docRef = await resolveAssignmentDocRefByUserAndUnit(db, userId, assignmentId);
        if (!docRef) {
            throw new HttpsError('not-found', '找不到作業紀錄');
        }
        const doc = await docRef.get();
        if (!doc.exists) throw new HttpsError('not-found', '找不到作業紀錄');

        const now = admin.firestore.Timestamp.now();
        const blockerEntry = {
            type: blockerType,
            note: blockerNote,
            createdAt: now
        };

        const historyEntry = {
            timestamp: nowIsoTimestamp(),
            action: 'BLOCKER_REPORTED',
            content: `Student reported blocker: [${blockerType}] ${blockerNote}`
        };

        await addAssignmentHistoryEntry(docRef, {
            learningState: 'blocked',
            latestBlocker: blockerEntry,
            updatedAt: now
        }, historyEntry);

        return { success: true, message: '已成功標記卡點' };
    } catch (e) {
        console.error("submitStudentBlocker Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

// 2. Submit Attempt Summary (Student)
exports.submitAttemptSummary = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, '請先登入');

    const { assignmentId, attemptSummary } = data;
    assertRequiredValue(assignmentId, '缺少必要參數');
    assertRequiredValue(attemptSummary, '缺少必要參數');

    const userId = auth.uid;
    const db = admin.firestore();

    try {
        const docRef = await resolveAssignmentDocRefByUserAndUnit(db, userId, assignmentId);
        if (!docRef) {
            throw new HttpsError('not-found', '找不到作業紀錄');
        }
        const doc = await docRef.get();
        if (!doc.exists) throw new HttpsError('not-found', '找不到作業紀錄');

        const now = admin.firestore.Timestamp.now();
        const historyEntry = {
            timestamp: nowIsoTimestamp(),
            action: 'ATTEMPT_LOGGED',
            content: `Student logged attempt: ${attemptSummary}`
        };

        await addAssignmentHistoryEntry(docRef, {
            attemptSummary: attemptSummary,
            updatedAt: now
        }, historyEntry);

        return { success: true, message: '嘗試紀錄提交成功！' };
    } catch (e) {
        console.error("submitAttemptSummary Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

// 3. Resolve Blocker (Student or Tutor)
exports.resolveStudentBlocker = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, '請先登入');

    const { assignmentId, studentUid } = data;
    assertRequiredValue(assignmentId, '缺少必要參數');

    const db = admin.firestore();
    const targetUid = studentUid || auth.uid;
    
    if (studentUid && studentUid !== auth.uid) {
        const requesterUid = auth.uid;
        const reqUserSnap = await db.collection('users').doc(requesterUid).get();
        const reqUserData = reqUserSnap.data() || {};
        const isRequesterAdmin = reqUserData.role === 'admin';
        
        let isTutor = false;
        if (reqUserData.role === 'tutor' || reqUserData.tutorConfigs) {
            isTutor = true;
        }
        
        if (!isRequesterAdmin && !isTutor) {
            throw new HttpsError('permission-denied', '您沒有權限解決此學生的卡點。');
        }
    }

    try {
        const docRef = await resolveAssignmentDocRefByUserAndUnit(db, targetUid, assignmentId);
        if (!docRef) {
            throw new HttpsError('not-found', '找不到作業紀錄');
        }
        const doc = await docRef.get();
        if (!doc.exists) throw new HttpsError('not-found', '找不到作業紀錄');

        const now = admin.firestore.Timestamp.now();
        const historyEntry = {
            timestamp: nowIsoTimestamp(),
            action: 'BLOCKER_RESOLVED',
            content: `Blocker marked as resolved by ${studentUid ? 'Tutor' : 'Student'}`
        };

        await addAssignmentHistoryEntry(docRef, {
            learningState: 'in_progress',
            latestBlocker: null,
            updatedAt: now
        }, historyEntry);

        return { success: true, message: '已成功解決卡點！' };
    } catch (e) {
        console.error("resolveStudentBlocker Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

// 4. Submit Tutor Coaching Log (Tutor/Admin)
exports.submitTutorCoachingLog = onCall(async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth, '請先登入');

    const { assignmentId, studentUid, hintLevel, blockerType, coachNote, nextAction } = data;
    assertRequiredValue(assignmentId, '缺少必要參數');
    assertRequiredValue(studentUid, '缺少必要參數');
    assertRequiredValue(hintLevel !== undefined, '缺少必要參數');
    assertRequiredValue(coachNote, '缺少必要參數');

    const tutorEmail = auth.token.email;
    const db = admin.firestore();
    const docId = `${studentUid}_${assignmentId.replace(/\.html$/, '')}`;
    const docRef = db.collection('assignments').doc(docId);

    try {
        const doc = await docRef.get();
        if (!doc.exists) {
            throw new HttpsError('not-found', '找不到該學生的作業紀錄');
        }

        const assignmentData = doc.data() || {};
        const reqUserSnap = await db.collection('users').doc(auth.uid).get();
        const reqUserData = reqUserSnap.data() || {};
        const isRequesterAdmin = reqUserData.role === 'admin';
        const isAssignedTutor = assignmentData.assignedTutorEmail === tutorEmail;

        assertAdminOrAssignedTutor(isRequesterAdmin, isAssignedTutor);

        const now = admin.firestore.Timestamp.now();

        // 1. Create a log in assignment_coaching_logs
        const coachingLogRef = db.collection('assignment_coaching_logs').doc();
        await coachingLogRef.set({
            assignmentId,
            studentUid,
            tutorEmail,
            hintLevel: Number(hintLevel),
            blockerType: blockerType || 'concept',
            coachNote: coachNote,
            createdAt: now
        });

        // 2. Update the assignment doc
        const historyEntry = {
            timestamp: nowIsoTimestamp(),
            action: 'TUTOR_COACHED',
            content: `Tutor logged coaching note (Hint Level: L${hintLevel}). Next action: ${nextAction || 'None'}`
        };

        await addAssignmentHistoryEntry(docRef, {
            learningState: 'coaching',
            hintLevelUsed: Number(hintLevel),
            nextAction: nextAction || '',
            updatedAt: now
        }, historyEntry);

        // 3. Update active interventions
        await updateActiveAssignmentInterventions(db, {
            assignmentId,
            studentUid,
            status: 'in_progress',
            updatedAt: now,
            ownerTutorEmail: tutorEmail
        });

        return { success: true, message: '指導紀錄已提交' };
    } catch (e) {
        console.error("submitTutorCoachingLog Error:", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', '操作失敗，請稍後再試');
    }
});

/**
 * Normalizes a unit ID to the canonical template repository naming convention.
 * e.g., start-01-unit-flexbox-layout -> car-starter-flexbox-layout
 *       basic-01-unit-drivers-ports -> car-basic-drivers-ports
 *       adv-01-unit-jpeg-quality -> car-advanced-jpeg-quality
 *       01-unit-vscode-setup -> common-vscode-setup
 */
function normalizeTemplateRepoName(id) {
    const v = normalizeText(id || '');
    if (/^(common|car-(starter|basic|advanced))-/i.test(v)) return v;
    if (/^tw-(common|car-(starter|basic|advanced))-/i.test(v)) return v.replace(/^tw-/i, '');
    if (/^start-\d{2}-unit-/i.test(v)) return v.replace(/^start-\d{2}-unit-/i, 'car-starter-');
    if (/^basic-\d{2}-unit-/i.test(v)) return v.replace(/^basic-\d{2}-unit-/i, 'car-basic-');
    if (/^(adv|advanced)-\d{2}-unit-/i.test(v)) return v.replace(/^(adv|advanced)-\d{2}-unit-/i, 'car-advanced-');
    if (/^\d{2}-unit-/i.test(v)) return v.replace(/^\d{2}-unit-/i, 'common-');
    return v;
}

function legacyTemplateRepoNameFromCanonical(id) {
    const v = normalizeTemplateRepoName(id);
    if (!v) return '';
    if (/^common-/i.test(v)) return `tw-${v}`;
    if (/^car-(starter|basic|advanced)-/i.test(v)) return `tw-${v}`;
    return v;
}

function templateRepoCandidates(id) {
    const canonical = normalizeTemplateRepoName(id);
    const legacy = legacyTemplateRepoNameFromCanonical(canonical);
    return [...new Set([canonical, legacy].filter(Boolean))];
}

/**
 * Create a native GitHub repository for a student assignment with a Feedback PR.
 */
exports.createStudentRepository = onCall({ secrets: [GITHUB_API_TOKEN] }, async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);

    const unitIdRaw = normalizeText(data?.unitId || '');
    const courseIdRaw = normalizeText(data?.courseId || '');
    const githubUsername = normalizeText(data?.githubUsername || ''); // Student's GitHub username

    assertRequiredValue(unitIdRaw, '缺少必要參數（unitId）');
    assertRequiredValue(githubUsername, '缺少必要參數（githubUsername）');

    const db = admin.firestore();
    const uid = auth.uid;

    try {
        // Save student's githubUsername to their user profile
        await db.collection('users').doc(uid).set({
            githubUsername: githubUsername
        }, { merge: true });

        const lessons = await getLessons();
        const canonicalUnitId = resolveCanonicalUnitId(unitIdRaw, lessons);
        const effectiveCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || courseIdRaw;

        const tutorMode = data?.tutorMode === true;
        // 1. 驗證學員課程權限
        const access = await resolveSubmissionAccessOrThrow(db, uid, effectiveCourseId, canonicalUnitId, lessons, tutorMode);

        // 2. 檢查是否已經建立過此作業的 Repo
        const normalizedUnitId = canonicalUnitId.replace('.html', '');
        const assignmentDocId = `${uid}_${normalizedUnitId}`;
        const assignmentDoc = await db.collection('assignments').doc(assignmentDocId).get();
        const assignmentData = assignmentDoc.exists ? assignmentDoc.data() : null;

        if (assignmentData && assignmentData.repositoryUrl) {
            return {
                repositoryUrl: assignmentData.repositoryUrl,
                feedbackPullRequestUrl: assignmentData.feedbackPullRequestUrl || null
            };
        }

        // 3. 取得導師配置的 Org 名稱與自訂 Token（若無，預設使用 vibe-coding-classroom 與系統 Token）
        let targetOrg = 'vibe-coding-classroom';
        let templateRepo = normalizeTemplateRepoName(normalizedUnitId); // canonical template repo name
        let customToken = null;

        const tutorEmail = access.assignedTutorEmail;
        if (tutorEmail) {
            const tutorSnap = await db.collection('users')
                .where('email', '==', tutorEmail.toLowerCase())
                .limit(1)
                .get();
        if (!tutorSnap.empty) {
            const tutorData = tutorSnap.docs[0].data();
            const config = getUserTutorConfig(tutorData, canonicalUnitId);
            if (config) {
                if (config.githubOrg) {
                    targetOrg = config.githubOrg;
                    }
                    if (config.templateRepo) {
                        templateRepo = config.templateRepo;
                    }
                    if (config.githubToken) {
                        customToken = config.githubToken;
                    }
                }
            }
        }

        // 4. 取得 GitHub PAT Token
        const token = customToken || GITHUB_API_TOKEN.value();
        if (!token) {
            throw new HttpsError('failed-precondition', '系統未配置 GITHUB_API_TOKEN');
        }

        // 5. 調用 API Helper 進行創庫、加人、開 PR 流程
        const ghHelper = new GitHubAPIHelper(token);
        const effectiveUnitName = normalizeTemplateRepoName(normalizedUnitId);
        const newRepoName = `${effectiveUnitName}-${uid.substring(0, 8)}`; // 例：common-vscode-setup-abc12345
        const templateRepoCandidatesList = templateRepoCandidates(templateRepo);

        let studentRepo = null;
        let lastCreateErr = null;
        for (const candidateTemplateRepo of templateRepoCandidatesList) {
            try {
                console.log(`[createStudentRepository] Creating repo ${newRepoName} from template ${candidateTemplateRepo} in org ${targetOrg}...`);
                studentRepo = await ghHelper.createRepoFromTemplate(targetOrg, candidateTemplateRepo, newRepoName, true);
                templateRepo = candidateTemplateRepo;
                break;
            } catch (err) {
                lastCreateErr = err;
                console.warn(`[createStudentRepository] Template repo not usable: ${candidateTemplateRepo}`, err?.message || err);
            }
        }
        if (!studentRepo) {
            throw lastCreateErr || new HttpsError('failed-precondition', '無法從樣板倉庫建立作業 repo');
        }

        console.log(`[createStudentRepository] Adding collaborator ${githubUsername} with push permission...`);
        await ghHelper.addCollaborator(targetOrg, newRepoName, githubUsername, 'push');

        console.log(`[createStudentRepository] Fetching main branch SHA (with retry)...`);
        let mainRef = null;
        let retries = 5;
        while (retries > 0) {
            try {
                mainRef = await ghHelper.getRef(targetOrg, newRepoName, 'heads/main');
                break;
            } catch (err) {
                retries--;
                if (retries === 0) throw err;
                console.log(`[createStudentRepository] Main branch not ready yet, retrying in 2 seconds... (${retries} retries left)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        const mainSha = mainRef.object.sha;
        let feedbackSha = mainSha;
        let needPlaceholder = false;

        try {
            console.log(`[createStudentRepository] Fetching commit details for ${mainSha} to determine branch base...`);
            const commitDetails = await ghHelper.getCommit(targetOrg, newRepoName, mainSha);
            if (commitDetails.parents && commitDetails.parents.length > 0) {
                feedbackSha = commitDetails.parents[0].sha;
                console.log(`[createStudentRepository] Found parent commit ${feedbackSha}. Using it as feedback branch base.`);
            } else {
                needPlaceholder = true;
                console.log(`[createStudentRepository] No parent commit found. Will write a placeholder file to force diff.`);
            }
        } catch (commitErr) {
            console.warn(`[createStudentRepository] Failed to get commit details, falling back to placeholder file:`, commitErr);
            needPlaceholder = true;
        }

        console.log(`[createStudentRepository] Creating feedback branch at ${feedbackSha}...`);
        await ghHelper.createRef(targetOrg, newRepoName, 'refs/heads/feedback', feedbackSha);

        if (needPlaceholder) {
            console.log(`[createStudentRepository] Creating placeholder file .github/classroom/feedback.md on main branch...`);
            const fileContent = `# Feedback\n\n這是您的作業回饋專區。請在此 PR 中進行討論與發問。`;
            await ghHelper.createFile(
                targetOrg,
                newRepoName,
                '.github/classroom/feedback.md',
                fileContent,
                'chore: initialize feedback PR [skip ci]',
                'main'
            );
        }

        console.log(`[createStudentRepository] Opening Feedback PR...`);
        const feedbackPR = await ghHelper.createPullRequest(
            targetOrg,
            newRepoName,
            'classroom-feedback',
            '這是您的作業回饋專區。您每次 push 程式碼後，自動評分結果與老師的評語都會顯示在這裡！\n\n⚠️ **請勿點擊 Merge 按鈕**，保持此 PR 開啟直到學期結束。',
            'main',
            'feedback'
        );

        // 6. 記錄與更新 Firestore
        const now = admin.firestore.FieldValue.serverTimestamp();
        const assignmentPayload = buildNativeRepositoryAssignmentRecord({
            uid,
            email: auth.token.email || '',
            courseId: effectiveCourseId,
            unitId: canonicalUnitId,
            assignmentTitle: data.assignmentTitle || canonicalUnitId,
            assignmentId: normalizedUnitId,
            repositoryUrl: studentRepo.html_url,
            repositoryName: newRepoName,
            feedbackPullRequestUrl: feedbackPR.html_url,
            assignedTutorEmail: tutorEmail || '',
            now
        });

        if (assignmentDoc.exists) {
            await db.collection('assignments').doc(assignmentDocId).update(assignmentPayload);
        } else {
            assignmentPayload.createdAt = now;
            await db.collection('assignments').doc(assignmentDocId).set(assignmentPayload);
        }

        return {
            repositoryUrl: studentRepo.html_url,
            feedbackPullRequestUrl: feedbackPR.html_url
        };

    } catch (error) {
        console.error("[createStudentRepository] Failed with error:", error);
        throw new HttpsError('internal', error.message || '作業倉庫建立失敗');
    }
});

/**
 * Diagnostic helper to validate GITHUB_API_TOKEN or custom tutor tokens
 */
exports.testGithubToken = onCall({ secrets: [GITHUB_API_TOKEN] }, async (request) => {
    const { data, auth } = request;
    assertAuthenticated(auth);
    
    // Verify user is admin
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(auth.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
        throw new HttpsError('permission-denied', '限管理員呼叫此功能');
    }

    const { tutorEmail, unitId } = data || {};
    let customToken = null;
    let customOrg = null;
    let customTemplate = null;

    if (tutorEmail && unitId) {
        const tutorSnap = await db.collection('users')
            .where('email', '==', String(tutorEmail).toLowerCase())
            .limit(1)
            .get();
        if (!tutorSnap.empty) {
            const tutorData = tutorSnap.docs[0].data();
            const config = getUserTutorConfig(tutorData, unitId);
            if (config) {
                customToken = config.githubToken || null;
                customOrg = config.githubOrg || null;
                customTemplate = config.templateRepo || null;
            }
        }
    }

    const globalToken = GITHUB_API_TOKEN.value();
    const activeToken = customToken || globalToken;

    const tokenPreview = (token) => {
        if (!token) return 'None';
        const len = token.length;
        if (len < 8) return `Short (length ${len})`;
        return `${token.substring(0, 4)}...${token.substring(len - 4)} (length ${len})`;
    };

    const results = {
        hasTutorEmail: !!tutorEmail,
        hasUnitId: !!unitId,
        customOrg,
        customTemplate,
        customTokenPreview: tokenPreview(customToken),
        globalTokenPreview: tokenPreview(globalToken),
        usingCustomToken: !!customToken,
        githubValidation: null
    };

    if (!activeToken) {
        results.githubValidation = {
            success: false,
            message: "No token resolved (both custom and global are empty)."
        };
        return results;
    }

    try {
        const { Octokit } = require("@octokit/rest");
        const octokit = new Octokit({ auth: activeToken });
        
        // Test call /user endpoint
        const userResponse = await octokit.users.getAuthenticated();
        
        // Also capture the scopes if returned in header
        const scopes = userResponse.headers['x-oauth-scopes'] || 'unknown';
        
        results.githubValidation = {
            success: true,
            login: userResponse.data.login,
            scopes: scopes,
            message: "Token is VALID! GitHub authenticated successfully."
        };
    } catch (err) {
        results.githubValidation = {
            success: false,
            statusCode: err.status || null,
            message: err.message || "Unknown GitHub API error."
        };
    }

    return results;
});
