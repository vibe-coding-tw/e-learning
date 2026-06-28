const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { normalizeEmail, isAdminEmail, lookupAuthUserEmailByUid, assertRequiredValue } = require("vibe-functions-core/access-utils-core");
const { normalizeText, normalizeCourseFile, normalizeLookupValue, cleanUnitId, getCanonicalLessonIdentity, getLessonLookupKeys, resolveCanonicalUnitId, findCourseByUnitId, findCourseByPageOrUnit, findLessonByCourseRef, findParentCourseIdByUnit } = require("../dashboard-utils");
const { withAssignmentUrlAliases } = require("vibe-functions-core/dashboard-utils-core");
const { buildReferralLinkDocId, normalizeGitHubUrl, hasActiveOrderForCourse, getPhysicalUnitIdSet, isPhysicalMetadataLesson, isPhysicalOrderItem, itemContainsUnit, collectPurchasedUnitIds, buildOrderRecordSummary, buildStudentOrderRecord, buildPendingShipmentReminderEntry } = require("vibe-functions-core/order-utils");
const { resolveNameFromUserData, getEffectiveTutorConfig, getUserTutorConfig, hasQualifiedTutorStatus, hasAnyQualifiedTutorStatus, queryTutorApplications, upsertTutorConfigForUser, buildTutorConfigEntry, resolveAssignmentUrlMaps, getPreferredAssignmentUrl, ensureTutorPromotionCode, indexAuthorizedTutorConfigForDashboard, buildTutorApplicationRecord, upsertTutorApplicationLegacyEntry, fallbackNameFromEmail } = require("vibe-functions-core/tutor-utils");
const { sendStudentLinkedToTutorEmail, sendTutorLinkedToStudentEmail, sendStudentPendingTutorAssignmentReminder, sendAdminShipmentReminder } = require("vibe-functions-core/email-service");
const { normalizeAmount, normalizeCurrency } = require("vibe-functions-core/pricing-utils");
const { runPendingAssignmentReminder, runPendingShipmentReminder } = require("./shared-reminders");
const { formatTaipeiDateTime } = require("./date-utils");
const { getUserDistributorScope, countAuthorizedTutorUnits, loadDistributorScopedUsers } = require("./distributor-utils");
const { findLessonByDocumentId, resolvePriceBookAmount, resolveLessonPrice, listDistributorPriceBooks, normalizeMoney, normalizePriceBookDoc, normalizeRegionCode, resolveDistributorForCheckout } = require("./distributor-pricing");
const { normalizeRoutingRegionCode, distributorMatchesRegion, collectDistributorRegions } = require("./routing-utils");
const { toMillis, previousYmPeriod } = require("./date-utils");
const { round2Amount } = require("vibe-functions-core/ledger-engine");
const { isAssignmentAuthorized } = require("./assignment-flow");
const { buildTutorList, buildDashboardReferenceEntry, addDashboardUserEntry, buildDashboardSummary, finalizeHardwareOrders, canonicalizeLessonForDashboard, ensureStudentStatsEntry, ensureCourseProgressBucket, appendCourseProgressActivity, buildStudentAssignmentTutorRows, getTutorAssignmentUrlFromConfig } = require("../dashboard-utils");
const { isStarterCourseReference, resolveRegistrationTimestampMs, nowIsoTimestamp } = require("vibe-functions-core/access-utils-core");

function getDb() {
    return admin.firestore();
}

function resolveLessonForOrderItemRuntime(itemKey = "", lessons = []) {
    if (!itemKey) return null;
    const candidates = new Set([
        String(itemKey).trim(),
        String(itemKey).trim().replace(/\.html$/i, ""),
        normalizeLookupValue(itemKey),
        cleanUnitId(itemKey),
        normalizeCourseFile(itemKey)
    ].filter(Boolean));
    return lessons.find((lesson) => {
        const keys = getLessonLookupKeys(lesson);
        for (const candidate of candidates) {
            if (keys.has(candidate)) return true;
        }
        return false;
    }) || findLessonByCourseRef(itemKey, lessons);
}

function orderExpiryToMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") {
        const date = value.toDate();
        return date instanceof Date ? date.getTime() : 0;
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function isActivePaidOrder(orderData = {}) {
    if (String(orderData.status || "").toUpperCase() !== "SUCCESS") return false;
    const expiryMs = orderExpiryToMillis(orderData.expiryDate);
    return !expiryMs || expiryMs > Date.now();
}

function hasActiveOrderForCourseSnapshot(ordersSnapshot = null, targetUnitId = "", lessons = [], resolvers = {}) {
    const docs = Array.isArray(ordersSnapshot?.docs) ? ordersSnapshot.docs : [];
    return docs.some((doc) => {
        const orderData = typeof doc?.data === "function" ? (doc.data() || {}) : {};
        if (!isActivePaidOrder(orderData)) return false;
        const items = orderData.items || {};
        return Object.keys(items).some((itemKey) => itemContainsUnit(itemKey, lessons, targetUnitId, resolvers));
    });
}

async function getRole(uid, fallbackEmail = "") {
    try {
        const userDoc = await getDb().collection("users").doc(uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data() || {};
            if (typeof isAdminEmail === "function" && isAdminEmail(userData.email || fallbackEmail)) return "admin";
            const role = userData.role;
            return role === "admin" ? "admin" : "user";
        }
        const authEmail = fallbackEmail || await lookupAuthUserEmailByUid(uid);
        if (typeof isAdminEmail === "function" && isAdminEmail(authEmail)) return "admin";
    } catch (e) {
        logger.error("[Role] Error in getRole:", e);
    }
    return "user";
}

function assertAdminRole(requesterRole, message = "僅限管理員執行此操作") {
    if (requesterRole !== "admin") {
        throw new HttpsError("permission-denied", message);
    }
}

function resolveAdminRole(userData = {}, fallbackEmail = "") {
    if (typeof isAdminEmail === "function" && isAdminEmail(userData.email || fallbackEmail)) return "admin";
    return userData.role === "admin" ? "admin" : "user";
}

async function syncReferralLink(dbRef, url, tutorEmail, tutorName, unitId) {
    if (!url) return;
    const normalized = normalizeGitHubUrl(url);
    if (!normalized) return;
    const linkId = buildReferralLinkDocId(normalized);
    await dbRef.collection("referral_links").doc(linkId).set({
        url: normalized,
        tutorEmail,
        tutorName: tutorName || tutorEmail,
        unitId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function upsertStudentUnitAssignment(studentUid, unitId, tutorEmail, assignedByUid = "system", notify = true) {
    const dbRef = getDb();
    const userRef = dbRef.collection("users").doc(studentUid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const previousTutor = userData.unitAssignments?.[unitId] || null;
    await userRef.set({
        unitAssignments: { [unitId]: tutorEmail || null },
        lastAssignmentUpdate: admin.firestore.FieldValue.serverTimestamp(),
        lastAssignedBy: assignedByUid
    }, { merge: true });
    if (notify && tutorEmail && previousTutor !== tutorEmail) {
        const studentName = resolveNameFromUserData(userData, userData.email, "");
        const studentEmail = userData.email || "";
        if (studentEmail) {
            await sendStudentLinkedToTutorEmail(studentEmail, studentName, unitId, tutorEmail);
        }
        await sendTutorLinkedToStudentEmail(tutorEmail, studentName, unitId);
    }
    return { previousTutor, changed: previousTutor !== (tutorEmail || null) };
}

async function resolveSubmissionAccessOrThrowAdmin(dbRef, uid, courseId, unitId, lessons = []) {
    const access = await resolveStudentAssignmentAccessAdmin(dbRef, uid, courseId, unitId, lessons, false);
    if (!access.authorized) {
        throw new HttpsError("permission-denied", access.reason || "尚未完成此課程付款授權。");
    }
    return access;
}

async function backfillTutorReferralForPaidOrders(dbRef, { uid, unitId, tutorEmail, promotionCode = "", assignmentUrl = "", lessons = [], source = "unitBinding" }) {
    if (!uid || !unitId || !tutorEmail) return { updatedOrders: 0, updatedItems: 0 };
    const ordersSnap = await dbRef.collection("orders").where("uid", "==", uid).where("status", "==", "SUCCESS").get();
    if (ordersSnap.empty) return { updatedOrders: 0, updatedItems: 0 };
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons) || unitId;
    const normalizedTutorEmail = normalizeText(tutorEmail);
    const normalizedPromotionCode = normalizeText(promotionCode || "").toUpperCase();
    const normalizedAssignmentUrl = normalizeText(assignmentUrl || "");
    const matchesUnit = (itemKey = "") => {
        if (!itemKey) return false;
        const canonicalItemId = resolveCanonicalUnitId(itemKey, lessons);
        if (itemKey === unitId || itemKey === canonicalUnitId || canonicalItemId === canonicalUnitId) return true;
        const lesson = findLessonByCourseRef(itemKey, lessons);
        return !!(lesson && Array.isArray(lesson.courseUnits) && lesson.courseUnits.some((courseUnit) => {
            const canonicalCourseUnit = resolveCanonicalUnitId(courseUnit, lessons);
            return canonicalCourseUnit === canonicalUnitId;
        }));
    };
    let updatedOrders = 0;
    let updatedItems = 0;
    for (const orderDoc of ordersSnap.docs) {
        const orderData = orderDoc.data() || {};
        const items = JSON.parse(JSON.stringify(orderData.items || {}));
        let hasOrderChange = false;
        for (const [itemKey, itemValue] of Object.entries(items)) {
            if (!matchesUnit(itemKey)) continue;
            if (!itemValue || typeof itemValue !== "object") continue;
            itemValue.referredTutorEmail = normalizedTutorEmail;
            itemValue.referralTutor = normalizedTutorEmail;
            if (normalizedAssignmentUrl) {
                itemValue.referralLink = normalizedAssignmentUrl;
                itemValue.promoCode = normalizedAssignmentUrl;
            }
            if (normalizedPromotionCode) itemValue.promotionCode = normalizedPromotionCode;
            hasOrderChange = true;
            updatedItems++;
        }
        if (hasOrderChange) {
            await dbRef.collection("orders").doc(orderDoc.id).set({ items, lastTutorBindingBackfillAt: admin.firestore.FieldValue.serverTimestamp(), lastTutorBindingBackfillSource: source }, { merge: true });
            updatedOrders++;
        }
    }
    return { updatedOrders, updatedItems };
}

async function loadLessonsWithOptionalDistributorOverride(distributorId = "") {
    const dbRef = getDb();
    const lessonsSnap = await dbRef.collection("metadata_lessons").orderBy("orderWeight", "asc").get();
    if (lessonsSnap.empty) return [];
    let rawLessons = lessonsSnap.docs.map((doc) => ({ ...doc.data(), id: doc.id, docId: doc.id }));
    rawLessons.sort((a, b) => (a.orderWeight || 0) - (b.orderWeight || 0));
    let lessons = rawLessons.map((lesson) => {
        const cloned = { ...lesson };
        delete cloned.updatedAt;
        delete cloned.orderWeight;
        return withAssignmentUrlAliases(cloned);
    });
    const normalizedDistributorId = normalizeText(distributorId);
    if (normalizedDistributorId) {
        const priceBooksSnap = await dbRef.collection("dealer_price_books").where("distributorId", "==", normalizedDistributorId).get();
        const priceBooks = [];
        priceBooksSnap.forEach((doc) => { priceBooks.push({ id: doc.id, ...doc.data() }); });
        if (priceBooks.length > 0) {
            lessons = lessons.map((lesson) => {
                const matchingBooks = priceBooks.filter((book) => findLessonByDocumentId([lesson], book.docId || book.sourceDocId));
                const activeBooks = matchingBooks.filter((book) => {
                    if (book.isActive === false) return false;
                    const effectiveFromMs = book.effectiveFrom?.toMillis ? book.effectiveFrom.toMillis() : (book.effectiveFrom?.seconds ? book.effectiveFrom.seconds * 1000 : 0);
                    const effectiveToMs = book.effectiveTo?.toMillis ? book.effectiveTo.toMillis() : (book.effectiveTo?.seconds ? book.effectiveTo.seconds * 1000 : 0);
                    const nowMs = Date.now();
                    if (effectiveFromMs && effectiveFromMs > nowMs) return false;
                    if (effectiveToMs && effectiveToMs < nowMs) return false;
                    return true;
                });
                if (activeBooks.length === 0) return lesson;
                activeBooks.sort((a, b) => {
                    const aFrom = a.effectiveFrom?.toMillis ? a.effectiveFrom.toMillis() : (a.effectiveFrom?.seconds ? a.effectiveFrom.seconds * 1000 : 0);
                    const bFrom = b.effectiveFrom?.toMillis ? b.effectiveFrom.toMillis() : (b.effectiveFrom?.seconds ? b.effectiveFrom.seconds * 1000 : 0);
                    return bFrom - aFrom;
                });
                const chosenBook = activeBooks[0];
                const resolvedAmount = resolvePriceBookAmount(chosenBook);
                const cloned = { ...lesson };
                cloned.currency = resolvedAmount.currency;
                cloned.dealerPrice = resolvedAmount.amount;
                cloned.dealerCurrency = resolvedAmount.currency;
                cloned.dealerPriceBookId = chosenBook.id || null;
                cloned.dealerPriceBookDocId = chosenBook.docId || chosenBook.sourceDocId || null;
                cloned.priceBookSource = `dealer_price_books:${chosenBook.id}`;
                cloned.isPromoActive = resolvedAmount.isPromoActive;
                return cloned;
            });
        }
    }
    return lessons;
}

function assertTutorApplicationState(appData = {}, { source = null, status = null } = {}) {
    if (source && appData.source !== source) throw new HttpsError("failed-precondition", `Application source mismatch (expected ${source})`);
    if (status && appData.status !== status) throw new HttpsError("failed-precondition", `Application status mismatch (expected ${status})`);
}

async function findUserDocByEmail(dbRef, email = "") {
    const normalized = normalizeEmail(String(email || "").trim());
    if (!normalized) return null;
    const userSnapshot = await dbRef.collection("users").where("email", "==", normalized).limit(1).get();
    return userSnapshot.empty ? null : userSnapshot.docs[0];
}

async function assertTutorRecommendationPermission(dbRef, auth, canonicalUnitId, assignment, requesterRole) {
    assertAdminRole(requesterRole, "Only admins can recommend tutors.");
    const assignmentUnitId = assignment.unitId ? normalizeText(assignment.unitId) : null;
    if (!assignmentUnitId) throw new HttpsError("failed-precondition", "Assignment has no unitId.");
    if (canonicalUnitId && normalizeText(canonicalUnitId) !== assignmentUnitId) {
        throw new HttpsError("failed-precondition", "Provided unitId does not match the assignment's unit.");
    }
}

function isTutorFullyQualifiedForCourseAdmin(userData = {}, courseId = "", lessons = []) {
    if (!userData || !courseId || !Array.isArray(lessons)) return false;
    const course = lessons.find((l) => l.courseId === courseId || l.id === courseId || l.docId === courseId);
    if (!course) return false;
    const courseUnits = course.courseUnits;
    if (!Array.isArray(courseUnits) || courseUnits.length === 0) return false;
    return courseUnits.every((unitId) => {
        const config = getUserTutorConfig(userData, unitId || "");
        return config && config.authorized === true;
    });
}

function assertDistributorScope(userData = {}, requestedDistributorId = "", message = "僅限該經銷商執行此操作", fallbackEmail = "") {
    if (typeof isAdminEmail === "function" && isAdminEmail(userData.email || fallbackEmail)) return;
    const userScope = getUserDistributorScope(userData);
    if (!requestedDistributorId || !userScope) return;
    if (userScope !== requestedDistributorId) throw new HttpsError("permission-denied", message);
}

function getSeedableDistributorProducts(lessons = [], distributorCurrency = "TWD") {
    return lessons.filter((l) => {
        if (l.hiddenFromCatalog) return false;
        const price = resolveLessonPrice(l, distributorCurrency);
        return Number(price.amount || 0) > 0;
    });
}

async function getLessonsForAdmin(distributorId = "") {
    return loadLessonsWithOptionalDistributorOverride(distributorId);
}

function normalizeLessonMetadataPatch(payload = {}) {
    const docId = normalizeText(payload.docId || payload.id || "");
    assertRequiredValue(docId, "missing-doc-id");
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);
    const patch = { id: docId, docId, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: payload.updatedBy || payload.updatedByUid || payload.updatedByEmail || payload.updatedByName || null };
    if (hasOwn("courseKey")) patch.courseKey = normalizeText(payload.courseKey || docId);
    if (hasOwn("title")) patch.title = normalizeText(payload.title || "");
    if (hasOwn("summary")) patch.summary = normalizeText(payload.summary || "");
    if (hasOwn("description")) patch.description = normalizeText(payload.description || "");
    if (hasOwn("coreContent")) patch.coreContent = Array.isArray(payload.coreContent) ? payload.coreContent.map((item) => normalizeText(item)).filter(Boolean) : [];
    if (hasOwn("titleEn")) patch.titleEn = normalizeText(payload.titleEn || "");
    if (hasOwn("summaryEn")) patch.summaryEn = normalizeText(payload.summaryEn || "");
    if (hasOwn("descriptionEn")) patch.descriptionEn = normalizeText(payload.descriptionEn || "");
    if (hasOwn("lessonLabel")) patch.lessonLabel = normalizeText(payload.lessonLabel || "");
    if (hasOwn("lessonLabelEn")) patch.lessonLabelEn = normalizeText(payload.lessonLabelEn || "");
    if (hasOwn("coreContentEn")) patch.coreContentEn = Array.isArray(payload.coreContentEn) ? payload.coreContentEn.map((item) => normalizeText(item)).filter(Boolean) : [];
    if (hasOwn("track")) patch.track = normalizeText(payload.track || "");
    if (hasOwn("level")) patch.level = normalizeText(payload.level || "");
    if (hasOwn("category")) patch.category = normalizeText(payload.category || "");
    if (hasOwn("metadataType")) patch.metadataType = normalizeText(payload.metadataType || "course") || "course";
    if (hasOwn("orderWeight")) patch.orderWeight = Number(payload.orderWeight || 0) || 0;
    if (hasOwn("isPhysical")) patch.isPhysical = payload.isPhysical === true;
    if (hasOwn("hiddenFromCatalog")) patch.hiddenFromCatalog = payload.hiddenFromCatalog === true;
    if (hasOwn("isDeprecated")) patch.isDeprecated = payload.isDeprecated === true;
    if (hasOwn("cardImageUrl")) patch.cardImageUrl = normalizeText(payload.cardImageUrl || "");
    if (hasOwn("imageUrl")) patch.imageUrl = normalizeText(payload.imageUrl || "");
    if (hasOwn("thumbnailUrl")) patch.thumbnailUrl = normalizeText(payload.thumbnailUrl || "");
    if (hasOwn("bannerUrl")) patch.bannerUrl = normalizeText(payload.bannerUrl || "");
    if (hasOwn("thumbnail")) patch.thumbnail = normalizeText(payload.thumbnail || "");
    if (hasOwn("cardIcon")) patch.cardIcon = normalizeText(payload.cardIcon || "");
    if (hasOwn("icon")) patch.icon = normalizeText(payload.icon || "");
    if (payload.i18n && typeof payload.i18n === "object" && !Array.isArray(payload.i18n)) {
        const i18n = {};
        for (const [locale, localeData] of Object.entries(payload.i18n)) {
            const key = normalizeText(locale).replace("_", "-");
            if (!key || !localeData || typeof localeData !== "object" || Array.isArray(localeData)) continue;
            i18n[key] = { title: normalizeText(localeData.title || ""), summary: normalizeText(localeData.summary || ""), description: normalizeText(localeData.description || ""), lessonLabel: normalizeText(localeData.lessonLabel || ""), coreContent: Array.isArray(localeData.coreContent) ? localeData.coreContent.map((item) => normalizeText(item)).filter(Boolean) : [] };
        }
        if (Object.keys(i18n).length > 0) patch.i18n = i18n;
    }
    const rawCourseUnits = hasOwn("course_units") ? payload.course_units : payload.courseUnits;
    if (hasOwn("course_units") || hasOwn("courseUnits")) {
        if (Array.isArray(rawCourseUnits)) { patch.course_units = rawCourseUnits.map((unit) => normalizeText(unit)).filter(Boolean); patch.courseUnits = patch.course_units; }
        else { patch.course_units = []; patch.courseUnits = []; }
    }
    const rawCourseUnitTitles = hasOwn("course_unit_titles") ? payload.course_unit_titles : payload.courseUnitTitles;
    if (hasOwn("course_unit_titles") || hasOwn("courseUnitTitles")) {
        if (Array.isArray(rawCourseUnitTitles)) { const normalizedTitles = rawCourseUnitTitles.map((title) => normalizeText(title)).filter(Boolean); patch.course_unit_titles = normalizedTitles; patch.courseUnitTitles = normalizedTitles; }
        else { patch.course_unit_titles = []; patch.courseUnitTitles = []; }
    }
    return patch;
}

async function loadDistributorPortalOrders(dbRef, distributorId = "", lessons = []) {
    const ordersSnap = await dbRef.collection("orders").where("status", "==", "SUCCESS").get();
    const distributorUsers = await loadDistributorScopedUsers(dbRef, distributorId);
    const distributorUids = new Set(distributorUsers.map((u) => u.id));
    const orders = [];
    ordersSnap.forEach((doc) => {
        const orderData = doc.data() || {};
        if (!distributorUids.has(orderData.uid)) return;
        const physicalItems = Object.keys(orderData.items || {}).filter((id) => isPhysicalOrderItem(id, orderData.items[id] || {}, getPhysicalUnitIdSet(lessons)));
        orders.push({
            id: doc.id, ...orderData, physicalItems, physicalCount: physicalItems.length,
            lessonName: (lessons.find((l) => (orderData.items || {})[l.courseId || l.id || l.docId]) || {}).title || ""
        });
    });
    return orders;
}

async function loadDistributorPortalTutors(dbRef, distributorId = "") {
    const distributorUsers = await loadDistributorScopedUsers(dbRef, distributorId);
    const tutors = [];
    for (const userDoc of distributorUsers) {
        const userData = userDoc.data() || {};
        const tutorConfigs = userData.tutorConfigs || {};
        const authorizedUnitIds = Object.entries(tutorConfigs).filter(([, cfg]) => cfg.authorized === true).map(([unitId]) => unitId);
        if (authorizedUnitIds.length === 0) continue;
        tutors.push({ uid: userDoc.id, email: userData.email || "", name: userData.name || userData.displayName || userData.email || "", authorizedUnitIds, tutorConfigs });
    }
    return tutors;
}

async function loadDistributorPortalSettlement(dbRef, distributorId = "", tutors = []) {
    const tutorEmails = new Set(tutors.map((t) => normalizeEmail(t.email)).filter(Boolean));
    const ledgerSnap = await dbRef.collection("profit_ledger").get();
    const entries = [];
    ledgerSnap.forEach((doc) => {
        const data = doc.data() || {};
        if (!tutorEmails.has(normalizeEmail(data.tutorEmail || ""))) return;
        entries.push({ id: doc.id, ...data, month: data.month || data.period || "-" });
    });
    const summary = { totalCollected: 0, totalPayout: 0, totalPending: 0 };
    const byMonth = {};
    entries.forEach((entry) => {
        const month = entry.month || "-";
        if (!byMonth[month]) byMonth[month] = { month, collected: 0, payout: 0, pending: 0, entryCount: 0 };
        const collected = Number(entry.collectedAmount || entry.coursePrice || 0);
        const payout = Number(entry.payoutAmount || entry.tutorShare || 0);
        byMonth[month].collected += collected;
        byMonth[month].payout += payout;
        byMonth[month].pending += (collected - payout);
        byMonth[month].entryCount++;
        summary.totalCollected += collected;
        summary.totalPayout += payout;
        summary.totalPending += (collected - payout);
    });
    return { entries, summary, byMonth: Object.values(byMonth).sort((a, b) => String(b.month || "").localeCompare(String(a.month || ""))) };
}

async function runPendingAssignmentReminderTask() {
    return runPendingAssignmentReminder({ db: getDb(), admin, getLessons: () => getLessonsForAdmin(""), resolveLessonPrice, collectPurchasedUnitIds, orderNormalizationResolvers, fallbackNameFromEmail, sendStudentPendingTutorAssignmentReminder, logger: console });
}

async function runPendingShipmentReminderTask() {
    return runPendingShipmentReminder({ db: getDb(), admin, adminEmail: process.env.ADMIN_EMAIL || process.env.MAIL_USER, getLessons: () => getLessonsForAdmin(""), getPhysicalUnitIdSet, isPhysicalOrderItem, buildPendingShipmentReminderEntry, formatTaipeiDateTimeFn: formatTaipeiDateTime, sendAdminShipmentReminder, logger: console });
}

async function lookupClassroomInviteBindingAdmin(inputRaw) {
    const normalizeClassroomInvite = (value = "") => {
        const s = String(value || "").trim();
        if (!s) return "";
        try {
            const url = new URL(s);
            if (url.hostname !== "classroom.github.com") return s;
            return `${url.origin}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
        } catch (_) {
            const token = s.replace(/^https?:\/\/classroom\.github\.com\/a\//i, "").replace(/\/+$/, "");
            return token ? `https://classroom.github.com/a/${token}`.toLowerCase() : "";
        }
    };
    const normalizedInvite = normalizeClassroomInvite(inputRaw);
    if (!normalizedInvite.includes("classroom.github.com/a/")) throw new HttpsError("invalid-argument", "請輸入 GitHub Classroom 邀請連結或 invite code。");
    const lessons = await getLessonsForAdmin("");
    const matches = [];
    for (const lesson of lessons) {
        const urlMap = lesson?.githubClassroomUrls || {};
        for (const [unitKey, cfg] of Object.entries(urlMap)) {
            const candidates = !cfg ? [] : (typeof cfg === "string" ? [normalizeClassroomInvite(cfg)].filter(Boolean) : (typeof cfg === "object" ? Object.values(cfg).filter((v) => typeof v === "string" && v.trim()).map((v) => normalizeClassroomInvite(v)).filter(Boolean) : []));
            if (!candidates.includes(normalizedInvite)) continue;
            matches.push({ lessonDocId: lesson.id || null, courseId: lesson.courseId || lesson.id || null, title: lesson.title || null, unitKey, courseUnits: Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [] });
        }
    }
    return { success: true, normalizedInvite, totalMatches: matches.length, matches };
}

function buildStudentsRelevantToTutor({ usersMap = {}, lessons = [], email = "", targetUnitId = null, targetCourseId = null, isTutorModeAdmin = false }) {
    const normalizedEmail = normalizeEmail(email);
    const relevant = [];
    Object.entries(usersMap).forEach(([sid, studentData]) => {
        const unitAssignments = studentData?.unitAssignments || {};
        let isRelevant = false;
        if (targetUnitId) {
            const assignedTutor = normalizeEmail(unitAssignments?.[targetUnitId]);
            if (assignedTutor === normalizedEmail || isTutorModeAdmin) isRelevant = true;
        } else if (targetCourseId) {
            const hasCourseOrder = (studentData.orders || []).includes(targetCourseId);
            const assignedToAnyInCourse = Object.keys(unitAssignments).some((unitId) => {
                const parent = findParentCourseIdByUnit(unitId, lessons);
                return parent === targetCourseId && (normalizeEmail(unitAssignments[unitId]) === normalizedEmail || isTutorModeAdmin);
            });
            if (hasCourseOrder || assignedToAnyInCourse) isRelevant = true;
        } else {
            const hasAnyAssignmentToMe = Object.values(unitAssignments).some((value) => normalizeEmail(value) === normalizedEmail);
            if (hasAnyAssignmentToMe || isTutorModeAdmin) isRelevant = true;
        }
        if (isRelevant) relevant.push([sid, studentData]);
    });
    return relevant;
}

async function resolveStudentAssignmentAccessAdmin(dbRef, uid, courseId, unitId, lessons = [], tutorMode = false) {
    const { normalizeLegacyId } = require("vibe-functions-core/id-utils");
    const normalizedCourseId = normalizeLegacyId(courseId || "");
    const normalizedUnitId = normalizeLegacyId(unitId || "");
    let canonicalUnitId = resolveCanonicalUnitId(normalizedUnitId, lessons);
    const course = findCourseByPageOrUnit(normalizedCourseId, canonicalUnitId, lessons) || findCourseByPageOrUnit(normalizedCourseId, normalizedUnitId, lessons);
    const lessonByCourseRef = findLessonByCourseRef(normalizedCourseId, lessons) || findLessonByCourseRef(normalizedUnitId, lessons) || null;
    const effectiveCourseId = course ? (getCanonicalLessonIdentity(course) || course.courseId) : (getCanonicalLessonIdentity(lessonByCourseRef) || normalizedCourseId || findParentCourseIdByUnit(canonicalUnitId, lessons));
    if (!canonicalUnitId && course && Array.isArray(course.courseUnits) && course.courseUnits.length > 0) {
        canonicalUnitId = resolveCanonicalUnitId(course.courseUnits[0], lessons);
    }
    const isPhysicalProduct = !!(course && isPhysicalMetadataLesson(course));
    const userDoc = await dbRef.collection("users").doc(uid).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const isAdminRole = resolveAdminRole(userData) === "admin";
    const lookupUnitId = canonicalUnitId || normalizedUnitId || "";
    const assignedTutorEmail = userData.unitAssignments?.[lookupUnitId] || null;
    const assignedPromotionCode = userData.unitAssignmentMeta?.[lookupUnitId]?.promotionCode || null;
    if (isPhysicalProduct) {
        logger.info(`[resolveAccess] ENFORCING Purchase Flow for Physical Product: ${effectiveCourseId}`);
    } else {
        if (tutorMode && isAdminRole) {
            return { authorized: true, simulated: true, accessMode: "admin_simulated", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode };
        }
        const shouldSkipTutorBypass = isAdminRole && !tutorMode;
        if (!shouldSkipTutorBypass) {
            if (effectiveCourseId && isTutorFullyQualifiedForCourseAdmin(userData, effectiveCourseId, lessons)) {
                return { authorized: true, accessMode: "fully_qualified_tutor", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course };
            }
            if (effectiveCourseId && getUserTutorConfig(userData, canonicalUnitId)?.authorized) {
                return { authorized: true, accessMode: "qualified_tutor", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course };
            }
        }
        const freeCourseContext = course || lessonByCourseRef;
        const lessonPrice = freeCourseContext ? Math.max(Number(resolveLessonPrice(freeCourseContext, "TWD").amount || 0), Number(resolveLessonPrice(freeCourseContext, "USD").amount || 0)) : Math.max(Number(resolveLessonPrice(findLessonByCourseRef(effectiveCourseId, lessons) || {}, "TWD").amount || 0), Number(resolveLessonPrice(findLessonByCourseRef(effectiveCourseId, lessons) || {}, "USD").amount || 0)) || 9999;
        const isFreeCourse = !!(freeCourseContext && parseInt(lessonPrice, 10) === 0);
        if (isFreeCourse) return { authorized: true, accessMode: "free_course", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course: freeCourseContext };
        const starterReference = isStarterCourseReference(courseId) || isStarterCourseReference(unitId);
        const now = Date.now();
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const trialLesson = course || lessonByCourseRef || freeCourseContext || (starterReference ? { id: courseId || unitId, docId: courseId || unitId, courseId: courseId || unitId, courseKey: courseId || unitId, category: "car-starter", level: "starter" } : null);
        let registeredAtMs = resolveRegistrationTimestampMs(userData, uid);
        if (!registeredAtMs) {
            const userRecord = await admin.auth().getUser(uid);
            registeredAtMs = userRecord.metadata.creationTime ? new Date(userRecord.metadata.creationTime).getTime() : 0;
        }
        const starterCategory = String(trialLesson.category || trialLesson.level || "").toLowerCase();
        const isTrialCourse = !!(trialLesson && (trialLesson.category === "car-starter" || trialLesson.category === "start" || trialLesson.category === "started" || trialLesson.level === "starter" || starterCategory === "car-starter" || starterCategory === "start" || starterCategory === "started") && registeredAtMs && ((now - registeredAtMs) < THIRTY_DAYS_MS));
        if (isTrialCourse) return { authorized: true, accessMode: "trial_course", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course: trialLesson };
    }
    if (!effectiveCourseId) return { authorized: false, reason: "missing-context", canonicalUnitId, effectiveCourseId };
    const ordersSnapshot = await dbRef.collection("orders").where("uid", "==", uid).where("status", "==", "SUCCESS").get();
    const hasPaidCourse = !ordersSnapshot.empty && hasActiveOrderForCourseSnapshot(ordersSnapshot, canonicalUnitId || effectiveCourseId, lessons, orderNormalizationResolvers);
    if (!hasPaidCourse) return { authorized: false, reason: "payment-required", accessMode: "payment_required", canonicalUnitId, effectiveCourseId, assignedTutorEmail: null, course };
    return { authorized: true, accessMode: "paid_student", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, requiresTutorAssignment: !isPhysicalProduct, course };
}

const orderNormalizationResolvers = {
    resolveLessonForOrderItem: resolveLessonForOrderItemRuntime,
    resolveCanonicalUnitId: (value, lessons = []) => resolveCanonicalUnitId(value, lessons),
    cleanUnitId,
    normalizeLookupValue
};

module.exports = {
    getDb,
    resolveLessonForOrderItemRuntime,
    orderExpiryToMillis,
    isActivePaidOrder,
    hasActiveOrderForCourseSnapshot,
    getRole,
    assertAdminRole,
    resolveAdminRole,
    syncReferralLink,
    upsertStudentUnitAssignment,
    resolveSubmissionAccessOrThrowAdmin,
    backfillTutorReferralForPaidOrders,
    loadLessonsWithOptionalDistributorOverride,
    assertTutorApplicationState,
    findUserDocByEmail,
    assertTutorRecommendationPermission,
    isTutorFullyQualifiedForCourseAdmin,
    assertDistributorScope,
    getSeedableDistributorProducts,
    getLessonsForAdmin,
    normalizeLessonMetadataPatch,
    loadDistributorPortalOrders,
    loadDistributorPortalTutors,
    loadDistributorPortalSettlement,
    runPendingAssignmentReminderTask,
    runPendingShipmentReminderTask,
    lookupClassroomInviteBindingAdmin,
    buildStudentsRelevantToTutor,
    resolveStudentAssignmentAccessAdmin,
    orderNormalizationResolvers
};
