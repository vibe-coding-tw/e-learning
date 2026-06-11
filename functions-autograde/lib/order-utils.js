function normalizeText(value = "") {
    return String(value || "").trim();
}

function normalizeGitHubUrl(url = '') {
    const normalized = normalizeText(url);
    if (!normalized) return '';
    try {
        let clean = normalized.toLowerCase();
        clean = clean.replace(/\/+$/, '');
        return clean;
    } catch (e) {
        return normalized.toLowerCase();
    }
}

function normalizeLookupValue(value = '') {
    return String(value || '')
        .split('/')
        .pop()
        .split('?')[0]
        .replace(/\.html$/i, '')
        .toLowerCase();
}

function normalizeLegacyId(value = '') {
    return String(value || '').replace(/\.html$/i, '').toLowerCase();
}

function getPhysicalUnitIdSet(lessons = []) {
    return new Set(
        (Array.isArray(lessons) ? lessons : [])
            .filter((lesson) => lesson && lesson.isPhysical === true)
            .map((lesson) => lesson.id)
            .filter(Boolean)
    );
}

function isPhysicalOrderItem(itemId, itemData = {}, physicalUnitIds = new Set()) {
    if (itemData.isPhysical === true) return true;
    const canonicalId = normalizeLegacyId(itemId);
    return physicalUnitIds.has(canonicalId) || physicalUnitIds.has(itemId);
}

function normalizeLogisticsData(logisticsData = {}) {
    const receiverName = normalizeText(logisticsData.receiverName || logisticsData.ReceiverName || '');
    const receiverPhone = normalizeText(logisticsData.receiverPhone || logisticsData.ReceiverCellPhone || logisticsData.ReceiverPhone || '');
    const shippingAddress = normalizeText(logisticsData.storeAddress || logisticsData.CVSAddress || logisticsData.ReceiverAddress || '');
    const storeId = normalizeText(logisticsData.storeId || logisticsData.CVSStoreID || '');
    const hasIntlAddress = logisticsData.isInternational === true && (
        logisticsData.address &&
        logisticsData.address.country &&
        logisticsData.address.city &&
        logisticsData.address.line1
    );

    return {
        receiverName,
        receiverPhone,
        shippingAddress,
        storeId,
        hasIntlAddress,
        hasReceiverName: !!receiverName,
        hasReceiverPhone: !!receiverPhone,
        hasShippingAddress: !!shippingAddress,
        hasStoreId: !!storeId,
        isComplete: !!receiverName && !!receiverPhone && (!!shippingAddress || !!storeId || hasIntlAddress)
    };
}

function buildShippingContact(logistics = {}) {
    return {
        name: logistics.receiverName || logistics.ReceiverName || '',
        phone: logistics.receiverPhone || logistics.ReceiverCellPhone || logistics.ReceiverPhone || ''
    };
}

function buildShippingAddress(logistics = {}) {
    return logistics.storeAddress || logistics.CVSAddress || logistics.ReceiverAddress || '';
}

function toIsoTimestamp(value, fallback = null) {
    if (!value) return fallback;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return fallback;
}

function buildOrderRecordSummary({ docId, uid, student = {}, data = {}, logistics = {}, items = {}, physicalItems = [], lessons = [], canonicalCourseId }) {
    return {
        id: docId,
        uid,
        email: student.email || '未提供',
        name: student.name || '未提供',
        amount: data.amount || 0,
        paidAt: toIsoTimestamp(data.paidAt, toIsoTimestamp(data.createdAt, null)),
        status: data.status,
        fulfillmentStatus: data.fulfillmentStatus || 'PENDING',
        logistics,
        shippingContact: buildShippingContact(logistics),
        shippingAddress: buildShippingAddress(logistics),
        items: physicalItems.map((id) => {
            const canonicalId = canonicalCourseId(id);
            return lessons.find(l => l.id === canonicalId)?.title || items[id]?.name || id;
        })
    };
}

function buildStudentOrderRecord(order = {}, docId = '') {
    const logistics = order.logistics || {};
    return {
        id: docId,
        createdAt: order.createdAt || null,
        paidAt: order.paidAt || null,
        paymentDate: order.paymentDate || null,
        expiryDate: order.expiryDate || null,
        fulfillmentStatus: order.fulfillmentStatus || 'PENDING',
        logistics,
        shippingContact: buildShippingContact(logistics),
        shippingAddress: buildShippingAddress(logistics),
        items: order.items || {}
    };
}

function buildPendingShipmentReminderEntry({ orderId, email, items = [], paidAt = '' } = {}) {
    return {
        orderId,
        email: email || '未提供',
        items,
        paidAt
    };
}

function buildReferralLinkDocId(url = "") {
    const normalized = normalizeGitHubUrl(url);
    return Buffer.from(normalized || "").toString("base64").slice(0, 24);
}

function collectPurchasedUnitIds(items = {}, lessons = [], resolvers = {}) {
    const resolveLessonForOrderItem = resolvers.resolveLessonForOrderItem || (() => null);
    const resolveCanonicalUnitId = resolvers.resolveCanonicalUnitId || ((unitId) => unitId);

    const purchasedUnits = new Set();

    Object.keys(items || {}).forEach(itemKey => {
        const lesson = resolveLessonForOrderItem(itemKey, lessons);
        if (lesson) {
            (lesson.courseUnits || []).forEach(unitId => purchasedUnits.add(resolveCanonicalUnitId(unitId, lessons)));
            return;
        }

        const canonicalUnitId = resolveCanonicalUnitId(itemKey, lessons);
        if (canonicalUnitId) purchasedUnits.add(canonicalUnitId);
    });

    return Array.from(purchasedUnits);
}

function findMatchingOrderItemIdForReferral(items = {}, referralTargetId = '', lessons = [], resolvers = {}) {
    const resolveCanonicalUnitId = resolvers.resolveCanonicalUnitId || ((unitId) => unitId);
    const findParentCourseIdByUnit = resolvers.findParentCourseIdByUnit || (() => null);
    const findLessonByCourseRef = resolvers.findLessonByCourseRef || (() => null);

    if (!referralTargetId) return null;

    if (items[referralTargetId]) return referralTargetId;

    const canonicalReferralUnitId = resolveCanonicalUnitId(referralTargetId, lessons);
    if (items[canonicalReferralUnitId]) return canonicalReferralUnitId;

    const parentCourseId = findParentCourseIdByUnit(canonicalReferralUnitId, lessons);
    if (parentCourseId && items[parentCourseId]) return parentCourseId;

    return Object.keys(items || {}).find(itemKey => {
        if (itemKey === referralTargetId || itemKey === canonicalReferralUnitId) return true;
        const lesson = findLessonByCourseRef(itemKey, lessons);
        return !!(lesson && Array.isArray(lesson.courseUnits) && lesson.courseUnits.includes(canonicalReferralUnitId));
    }) || null;
}

function normalizeOrderItems(cartDetails = {}, referralLink = '', referredTutorEmail = '', lessons = [], resolvers = {}) {
    const normalizeTextFn = resolvers.normalizeText || normalizeText;
    const findMatchingOrderItemIdForReferralFn = resolvers.findMatchingOrderItemIdForReferral || findMatchingOrderItemIdForReferral;

    const items = JSON.parse(JSON.stringify(cartDetails || {}));
    const normalizedReferralLink = referralLink && referralLink.trim()
        ? normalizeTextFn(referralLink)
        : null;
    const normalizedReferredTutorEmail = referredTutorEmail && referredTutorEmail.trim()
        ? normalizeTextFn(referredTutorEmail)
        : 'info@vibe-coding.tw';

    Object.entries(items).forEach(([itemKey, itemValue]) => {
        if (!itemValue || typeof itemValue !== 'object') items[itemKey] = {};
        const itemReferralLink = itemValue?.referralLink || itemValue?.promoCode || null;
        const itemReferredTutorEmail = itemValue?.referredTutorEmail || itemValue?.referralTutor || 'info@vibe-coding.tw';
        const itemReferredTutorName = itemValue?.referredTutorName || itemValue?.referralTutorName || null;

        items[itemKey].referralLink = itemReferralLink ? normalizeTextFn(itemReferralLink) : null;
        items[itemKey].referredTutorEmail = itemReferredTutorEmail ? normalizeTextFn(itemReferredTutorEmail) : 'info@vibe-coding.tw';
        items[itemKey].referredTutorName = itemReferredTutorName ? normalizeTextFn(itemReferredTutorName) : null;
    });

    if (normalizedReferralLink) {
        const targetItemId = findMatchingOrderItemIdForReferralFn(items, normalizedReferralLink, lessons, resolvers);
        if (targetItemId && items[targetItemId]) {
            items[targetItemId].referralLink = normalizedReferralLink;
            items[targetItemId].referredTutorEmail = normalizedReferredTutorEmail;
        }
    }

    return items;
}

function extractReferralAssignmentsFromOrder(orderItems = {}, lessons = [], resolvers = {}) {
    const normalizeTextFn = resolvers.normalizeText || normalizeText;
    const resolveCanonicalUnitId = resolvers.resolveCanonicalUnitId || ((unitId) => unitId);
    const findLessonByCourseRef = resolvers.findLessonByCourseRef || (() => null);

    const assignments = [];

    Object.entries(orderItems || {}).forEach(([itemKey, itemValue]) => {
        const itemReferralLink = itemValue?.referralLink || itemValue?.promoCode || null;
        const itemTutor = itemValue?.referredTutorEmail || itemValue?.referralTutor || null;
        if (!itemReferralLink) return;

        const lesson = findLessonByCourseRef(itemKey, lessons);
        const purchasedUnits = lesson
            ? (lesson.courseUnits || []).map(unitId => resolveCanonicalUnitId(unitId, lessons))
            : [resolveCanonicalUnitId(itemKey, lessons)];

        assignments.push({
            itemKey,
            referralLink: normalizeTextFn(itemReferralLink),
            referredTutorEmail: itemTutor ? normalizeTextFn(itemTutor) : null,
            purchasedUnits
        });
    });

    return assignments;
}

function itemContainsUnit(itemKey = '', lessons = [], targetUnitId = '', resolvers = {}) {
    const resolveCanonicalUnitId = resolvers.resolveCanonicalUnitId || ((unitId) => unitId);
    const resolveLessonForOrderItem = resolvers.resolveLessonForOrderItem || (() => null);

    if (!itemKey || !targetUnitId) return false;
    const canonicalTargetUnitId = resolveCanonicalUnitId(targetUnitId, lessons);
    const lesson = resolveLessonForOrderItem(itemKey, lessons);
    if (lesson && Array.isArray(lesson.courseUnits)) {
        return lesson.courseUnits
            .map(unitId => resolveCanonicalUnitId(unitId, lessons))
            .includes(canonicalTargetUnitId);
    }
    const canonicalItemKey = resolveCanonicalUnitId(itemKey, lessons);
    return canonicalItemKey === canonicalTargetUnitId;
}

function hasActiveOrderForCourse(ordersSnapshot, courseId, lessons = [], resolvers = {}) {
    let hasCourse = false;
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const targetLesson = (resolvers.findLessonByCourseRef || (() => null))(courseId, lessons);
    const targetKeys = new Set();
    const addTargetKey = (value) => {
        if (!value) return;
        const raw = String(value || '').trim();
        if (!raw) return;
        targetKeys.add(raw);
        targetKeys.add(raw.replace(/\.html$/i, ''));
        targetKeys.add(normalizeLookupValue(raw));
    };

    addTargetKey(courseId);
    if (targetLesson) {
        const getLessonLookupKeysFn = resolvers.getLessonLookupKeys || (() => []);
        for (const key of getLessonLookupKeysFn(targetLesson)) {
            addTargetKey(key);
        }
    }

    ordersSnapshot.forEach(doc => {
        const data = doc.data();
        const items = data.items || {};

        let matched = Object.keys(items).some((itemKey) => targetKeys.has(itemKey) || targetKeys.has(String(itemKey || '').replace(/\.html$/i, '')) || targetKeys.has(normalizeLookupValue(itemKey)));

        if (!matched && lessons.length > 0) {
            for (const itemKey of Object.keys(items)) {
                if (itemContainsUnit(itemKey, lessons, courseId, resolvers)) {
                    matched = true;
                    break;
                }
            }
        }

        if (!matched) return;

        if (data.expiryDate?.toMillis) {
            if (data.expiryDate.toMillis() > Date.now()) {
                hasCourse = true;
            }
            return;
        }

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

module.exports = {
    buildOrderRecordSummary,
    buildPendingShipmentReminderEntry,
    buildReferralLinkDocId,
    buildShippingAddress,
    buildShippingContact,
    buildStudentOrderRecord,
    collectPurchasedUnitIds,
    extractReferralAssignmentsFromOrder,
    getPhysicalUnitIdSet,
    isPhysicalOrderItem,
    itemContainsUnit,
    hasActiveOrderForCourse,
    normalizeLogisticsData,
    normalizeGitHubUrl,
    normalizeOrderItems,
    findMatchingOrderItemIdForReferral
};
