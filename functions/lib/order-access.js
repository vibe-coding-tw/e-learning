const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const {
    buildRevenueShareBalanceRecord,
    buildRevenueShareCreditRecord,
    buildRevenueSharePolicySnapshot,
    buildRevenueSharePayoutRow,
    collectRevenueShareChainTargets,
    loadRevenueSharePolicy,
    resolveRevenueShareRoleEmails,
    round2Amount,
    DEFAULT_REVENUE_SHARE_POLICY
} = require("./revenue-sharing");
const {
    buildReferralLinkDocId,
    extractReferralAssignmentsFromOrder,
    getPhysicalUnitIdSet,
    hasActiveOrderForCourse,
    isPhysicalOrderItem,
    normalizeGitHubUrl,
    normalizeLogisticsData
} = require("./order-utils");
const {
    ensureTutorPromotionCode,
    getEffectiveTutorConfig,
    getUserTutorConfig,
    resolveNameFromUserData
} = require("./tutor-utils");

function createOrderAccessHelpers({
    normalizeText,
    normalizeEmail,
    normalizeLegacyId,
    getCanonicalLessonIdentity,
    resolveCanonicalUnitId,
    findCourseByPageOrUnit,
    findParentCourseIdByUnit,
    resolveLessonForOrderItem,
    getLessons,
    sendAutogradeFailureAlertEmail,
    sendPaymentSuccessEmail,
    sendStudentLinkedToTutorEmail,
    sendTutorLinkedToStudentEmail,
    recordLedgerEvent,
    recordInvestorFinanceEvent
} = {}) {
    const required = [
        ["normalizeText", normalizeText],
        ["normalizeEmail", normalizeEmail],
        ["normalizeLegacyId", normalizeLegacyId],
        ["getCanonicalLessonIdentity", getCanonicalLessonIdentity],
        ["resolveCanonicalUnitId", resolveCanonicalUnitId],
        ["findCourseByPageOrUnit", findCourseByPageOrUnit],
        ["findParentCourseIdByUnit", findParentCourseIdByUnit],
        ["resolveLessonForOrderItem", resolveLessonForOrderItem],
        ["getLessons", getLessons],
        ["sendAutogradeFailureAlertEmail", sendAutogradeFailureAlertEmail],
        ["sendPaymentSuccessEmail", sendPaymentSuccessEmail],
        ["sendStudentLinkedToTutorEmail", sendStudentLinkedToTutorEmail],
        ["sendTutorLinkedToStudentEmail", sendTutorLinkedToStudentEmail],
        ["recordLedgerEvent", recordLedgerEvent],
        ["recordInvestorFinanceEvent", recordInvestorFinanceEvent]
    ];
    for (const [name, fn] of required) {
        if (typeof fn !== "function") {
            throw new Error(`createOrderAccessHelpers requires ${name}`);
        }
    }

    function getPayoutAccountFromUser(userData = {}) {
        if (!userData || typeof userData !== "object") return "";
        if (typeof userData.payoutAccount === "string" && userData.payoutAccount.trim()) return userData.payoutAccount.trim();
        if (typeof userData.paymentAccount === "string" && userData.paymentAccount.trim()) return userData.paymentAccount.trim();
        const map = userData.payoutAccounts || {};
        const candidate = map.default || map.bank || "";
        return typeof candidate === "string" ? candidate.trim() : "";
    }

    function hasQualifiedTutorStatus(userData = {}, unitId = "") {
        const tutorConfigs = userData.tutorConfigs || {};
        if (unitId) {
            return !!(tutorConfigs[unitId] && tutorConfigs[unitId].authorized === true);
        }
        return Object.values(tutorConfigs).some((config) => config && config.authorized === true);
    }

    function isTutorFullyQualifiedForCourseLocal(userData = {}, courseId = "", lessons = []) {
        const tutorConfigs = userData.tutorConfigs || {};
        const lesson = findLessonByCourseRef(courseId, lessons);
        if (!lesson || !Array.isArray(lesson.courseUnits)) return false;

        return lesson.courseUnits.every((unitId) => {
            const canonical = resolveCanonicalUnitId(unitId, lessons);
            const config = getEffectiveTutorConfig(canonical, tutorConfigs);
            return !!(config && config.authorized === true);
        });
    }

    function findLessonByCourseRef(courseRef = "", lessons = []) {
        if (!courseRef) return null;
        const candidates = new Set([
            normalizeText(courseRef || ""),
            normalizeText(courseRef || "").replace(/\.html$/i, ""),
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

    function cleanUnitId(unitId) {
        if (!unitId) return "";
        return normalizeText(unitId)
            .toLowerCase()
            .replace(/\.html$/, '')
            .replace(/^(?:tw-(?:common|car-(?:starter|basic|advanced))-|start-|basic-|adv-|advanced-|prepare-)?(?:\d{2}-)?(?:unit-|lesson-|master-)?/i, '');
    }

    function normalizeLookupValue(value = '') {
        return normalizeText(value)
            .replace(/\.html$/i, '')
            .replace(/^(?:tw|en)-/i, '')
            .toLowerCase();
    }

    function getLessonLookupKeys(lesson = {}) {
        const keys = new Set();
        const add = (value) => {
            const normalized = normalizeLookupValue(value);
            if (normalized) keys.add(normalized);
        };

        add(lesson.id);
        add(lesson.docId);
        add(lesson.courseId);
        add(lesson.courseKey);
        add(lesson.entryUnitId);
        add(lesson.productId);
        add(lesson.sku);

        if (Array.isArray(lesson.productIds)) lesson.productIds.forEach(add);
        if (Array.isArray(lesson.legacyProductIds)) lesson.legacyProductIds.forEach(add);
        if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
        if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);

        return keys;
    }

    function resolveLessonForOrderItemLocal(itemKey = "", lessons = []) {
        if (!itemKey) return null;
        const cleanKey = String(itemKey).replace(/\.html$/i, '');
        return lessons.find((lesson) =>
            lesson.id === cleanKey ||
            lesson.docId === cleanKey ||
            lesson.productId === cleanKey ||
            lesson.courseId === cleanKey
        ) || findCourseByPageOrUnit(itemKey, itemKey, lessons);
    }

    async function syncUserPurchaseCacheFromOrder(db, orderId, orderData = {}, lessons = []) {
        const uid = orderData.uid;
        if (!uid || uid === "GUEST") return;

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};

        const items = orderData.items || {};
        let hasStarterAccess = !!userData.hasStarterAccess;

        for (const itemKey of Object.keys(items)) {
            const lesson = resolveLessonForOrderItemLocal(itemKey, lessons);
            if (lesson && lesson.isPhysical !== true && isStarterLesson(lesson)) {
                hasStarterAccess = true;
                break;
            }
        }

        const patch = {
            paid: true,
            lastPaidOrderId: orderId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (hasStarterAccess) {
            patch.hasStarterAccess = true;
        }

        await userRef.set(patch, { merge: true });
    }

    function isStarterLesson(lesson = {}) {
        const canonicalLessonId = getCanonicalLessonIdentity(lesson) || lesson.courseKey || lesson.courseId || lesson.id || "";
        const normalizedLessonId = normalizeText(canonicalLessonId).toLowerCase();
        const category = normalizeText(lesson.category || lesson.level || "").toLowerCase();
        return normalizedLessonId.startsWith("car-starter-") || category === "start" || category === "started";
    }

    function isStarterTrialLesson(lesson = {}) {
        const canonicalLessonId = getCanonicalLessonIdentity(lesson) || lesson.courseKey || lesson.courseId || lesson.id || "";
        const normalizedLessonId = normalizeText(canonicalLessonId).toLowerCase();
        const category = normalizeText(lesson.category || "").toLowerCase();
        const level = normalizeText(lesson.level || "").toLowerCase();
        return normalizedLessonId.startsWith("car-starter-") || category === "start" || category === "started" || level === "starter" || level === "start" || level === "started";
    }

    async function syncReferralLink(db, url, tutorEmail, tutorName, unitId) {
        if (!url) return;
        const normalized = normalizeGitHubUrl(url);
        if (!normalized) return;

        const linkId = buildReferralLinkDocId(normalized);
        await db.collection("referral_links").doc(linkId).set({
            url: normalized,
            tutorEmail,
            tutorName: tutorName || tutorEmail,
            unitId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[ReferralSync] ✅ Indexed ${normalized} -> ${tutorEmail}`);
    }

    async function upsertStudentUnitAssignment(db, studentUid, unitId, tutorEmail, assignedByUid = "system", notify = true) {
        const userRef = db.collection("users").doc(studentUid);
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

    async function resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons = [], tutorMode = false, urlPrice = null) {
        const normalizedCourseId = normalizeLegacyId(courseId || "");
        const normalizedUnitId = normalizeLegacyId(unitId || "");

        let canonicalUnitId = resolveCanonicalUnitId(normalizedUnitId, lessons);
        const course = findCourseByPageOrUnit(normalizedCourseId, canonicalUnitId, lessons) || findCourseByPageOrUnit(normalizedCourseId, normalizedUnitId, lessons);
        const lessonByCourseRef = findLessonByCourseRef(normalizedCourseId, lessons)
            || findLessonByCourseRef(normalizedUnitId, lessons)
            || findLessonByCourseRef(canonicalUnitId, lessons)
            || null;
        const effectiveCourseId = course
            ? (getCanonicalLessonIdentity(course) || course.courseId)
            : (getCanonicalLessonIdentity(lessonByCourseRef) || normalizedCourseId || findParentCourseIdByUnit(canonicalUnitId, lessons));
        if (!canonicalUnitId && course && Array.isArray(course.courseUnits) && course.courseUnits.length > 0) {
            canonicalUnitId = resolveCanonicalUnitId(course.courseUnits[0], lessons);
        }
        const isPhysicalProduct = !!(course && course.isPhysical === true);

        const userDoc = await db.collection("users").doc(uid).get();
        const userData = userDoc.exists ? (userDoc.data() || {}) : {};
        const isAdminRole = userData.role === "admin";
        const pricingLesson = course || lessonByCourseRef || findLessonByCourseRef(effectiveCourseId, lessons) || null;
        const dealerPrice = pricingLesson && pricingLesson.dealerPrice !== undefined && pricingLesson.dealerPrice !== null && pricingLesson.dealerPrice !== ""
            ? Number(pricingLesson.dealerPrice)
            : 0;
        const requestedPrice = urlPrice !== null && urlPrice !== undefined && urlPrice !== ""
            ? Number(urlPrice)
            : null;

        const lookupUnitId = canonicalUnitId || normalizedUnitId || "";
        const assignedTutorEmail = userData.unitAssignments?.[lookupUnitId] || null;
        const assignedPromotionCode = userData.unitAssignmentMeta?.[lookupUnitId]?.promotionCode || null;

        if (isPhysicalProduct) {
            console.log(`[resolveAccess] ENFORCING Purchase Flow for Physical Product: ${effectiveCourseId}`);
        } else {
            if (tutorMode && isAdminRole) {
                console.log(`[resolveAccess] SUCCESS: Admin Simulation Bypass for ${uid}`);
                return {
                    authorized: true,
                    simulated: true,
                    accessMode: "admin_simulated",
                    canonicalUnitId,
                    effectiveCourseId,
                    assignedTutorEmail,
                    assignedPromotionCode
                };
            }

            const shouldSkipTutorBypass = isAdminRole && !tutorMode;

            if (!shouldSkipTutorBypass) {
                if (effectiveCourseId && isTutorFullyQualifiedForCourseLocal(userData, effectiveCourseId, lessons)) {
                    console.log(`[resolveAccess] SUCCESS: Fully Qualified Tutor Bypass for ${uid} on ${effectiveCourseId}`);
                    return {
                        authorized: true,
                        accessMode: "fully_qualified_tutor",
                        canonicalUnitId,
                        effectiveCourseId,
                        assignedTutorEmail,
                        assignedPromotionCode,
                        course
                    };
                }

                const effectiveTutorCfg = getEffectiveTutorConfig(canonicalUnitId, userData.tutorConfigs || {});
                const isQualifiedTutorForThisUnit = !!(effectiveTutorCfg && effectiveTutorCfg.authorized === true);
                if (isQualifiedTutorForThisUnit) {
                    return { authorized: true, accessMode: "qualified_tutor", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course };
                }
            }

            const hasPriceBook = !!(pricingLesson && pricingLesson.dealerPriceBookId);
            const isFreeCourse = !!(hasPriceBook && dealerPrice === 0);
            if (isFreeCourse) {
                return {
                    authorized: true,
                    accessMode: "free_course",
                    canonicalUnitId,
                    effectiveCourseId,
                    assignedTutorEmail,
                    assignedPromotionCode,
                    course: pricingLesson,
                    priceSource: "dealer_price_books"
                };
            }

        const now = Date.now();
        const userRecord = await admin.auth().getUser(uid);
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const trialLesson = course || lessonByCourseRef || pricingLesson || null;
        const isTrialCourse = !!(trialLesson && isStarterTrialLesson(trialLesson) && ((now - new Date(userRecord.metadata.creationTime).getTime()) < THIRTY_DAYS_MS));
        if (isTrialCourse) {
            return { authorized: true, accessMode: "trial_course", canonicalUnitId, effectiveCourseId, assignedTutorEmail, assignedPromotionCode, course: trialLesson };
        }
    }

        if (!effectiveCourseId) {
            console.warn(`[resolveAccess] FAIL: Missing context for UID:${uid} Page:${courseId} Unit:${unitId}`);
            return { authorized: false, reason: "missing-context", canonicalUnitId, effectiveCourseId };
        }

        const ordersSnapshot = await db.collection("orders")
            .where("uid", "==", uid)
            .where("status", "==", "SUCCESS")
            .get();

        const hasPaidCourse = !ordersSnapshot.empty && hasActiveOrderForCourse(ordersSnapshot, effectiveCourseId, lessons, orderNormalizationResolvers);
        if (!hasPaidCourse) {
            return {
                authorized: false,
                reason: "payment-required",
                accessMode: "payment_required",
                canonicalUnitId,
                effectiveCourseId,
                assignedTutorEmail: null,
                course
            };
        }

        return {
            authorized: true,
            accessMode: "paid_student",
            canonicalUnitId,
            effectiveCourseId,
            assignedTutorEmail,
            assignedPromotionCode,
            requiresTutorAssignment: !isPhysicalProduct,
            course
        };
    }

    async function resolveSubmissionAccessOrThrow(db, uid, courseId, unitId, lessons = [], tutorMode = false) {
        const access = await resolveStudentAssignmentAccess(db, uid, courseId, unitId, lessons, tutorMode);
        if (!access.authorized) {
            throw new HttpsError("permission-denied", access.reason || "尚未完成此課程付款授權。");
        }
        if (access.requiresTutorAssignment && !access.assignedTutorEmail) {
            throw new HttpsError("failed-precondition", "此單元尚未完成老師指派，暫時無法建立作業紀錄。");
        }
        return access;
    }

    async function activateOrderPermissionsAndNotify(db, orderId) {
        console.log(`[activateOrderPermissionsAndNotify] 開始開通與通知流程, Order: ${orderId}`);
        const orderDoc = await db.collection("orders").doc(orderId).get();
        if (!orderDoc.exists) {
            console.error(`[activateOrderPermissionsAndNotify] 訂單 ${orderId} 不存在`);
            return;
        }
        const oData = orderDoc.data();
        const oItems = oData.items || {};

        try {
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

            let updatedItems = false;
            for (const [key, val] of Object.entries(oItems)) {
                const itemReferralLink = val.referralLink || val.promoCode || null;
                if (itemReferralLink && !val.referredTutorEmail) {
                    const linkId = buildReferralLinkDocId(itemReferralLink);
                    const lDoc = await db.collection("referral_links").doc(linkId).get();
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
                // guest order
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

            try {
                await syncUserPurchaseCacheFromOrder(db, orderId, orderData, lessons);
                console.log(`[activateOrderPermissionsAndNotify] ✅ User purchase cache synced for order ${orderId}`);
            } catch (cacheErr) {
                console.warn(`[activateOrderPermissionsAndNotify] User purchase cache sync skipped for order ${orderId}:`, cacheErr.message || cacheErr);
            }

            try {
                await recordLedgerEvent({
                    db,
                    payload: {
                        eventType: "order.paid",
                        sourceType: "order",
                        sourceId: orderId,
                        sourceLabel: `Order ${orderId}`,
                        entityType: "order",
                        entityId: orderId,
                        amount: Number(orderData.amount || 0),
                        currency: orderData.currency || "TWD",
                        occurredAtDate: orderData.paidAt?.toDate ? orderData.paidAt.toDate() : new Date(),
                        metadata: {
                            orderId,
                            studentUid: orderData.uid || "",
                            unitIds: Object.keys(orderItems || {}),
                            note: `Auto ledger entry from successful order ${orderId}`
                        }
                    },
                    createdByUid: "system",
                    autoGenerateReports: true
                });
                console.log(`[activateOrderPermissionsAndNotify] ✅ Ledger event created for order ${orderId}`);
            } catch (ledgerErr) {
                console.warn(`[activateOrderPermissionsAndNotify] Ledger event creation skipped for order ${orderId}:`, ledgerErr.message || ledgerErr);
            }

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

            if (orderData.uid && orderData.uid !== "GUEST") {
                const referralAssignments = extractReferralAssignmentsFromOrder(orderData.items || {}, lessons, orderNormalizationResolvers);
                for (const assignment of referralAssignments) {
                    const linkId = buildReferralLinkDocId(assignment.referralLink);
                    const referralDoc = await db.collection("referral_links").doc(linkId).get();
                    if (!referralDoc.exists) continue;

                    const referralData = referralDoc.data();
                    const targetUnitId = resolveCanonicalUnitId(referralData.unitId, lessons);

                    if (targetUnitId && assignment.purchasedUnits.includes(targetUnitId) && referralData.tutorEmail) {
                        for (const unitId of assignment.purchasedUnits) {
                            await upsertStudentUnitAssignment(db, orderData.uid, unitId, referralData.tutorEmail, "paymentWebhook", true);
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

    const orderNormalizationResolvers = {
        resolveLessonForOrderItem: resolveLessonForOrderItemLocal,
        resolveCanonicalUnitId,
        findLessonByCourseRef,
        findParentCourseIdByUnit,
        normalizeText,
        cleanUnitId,
        getLessonLookupKeys
    };

    return {
        activateOrderPermissionsAndNotify,
        resolveStudentAssignmentAccess,
        resolveSubmissionAccessOrThrow,
        syncReferralLink,
        upsertStudentUnitAssignment,
        ensureTutorPromotionCode,
        orderNormalizationResolvers,
        hasQualifiedTutorStatus
    };
}

module.exports = {
    createOrderAccessHelpers
};
