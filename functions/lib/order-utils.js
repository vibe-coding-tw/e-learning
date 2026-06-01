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

module.exports = {
    buildOrderRecordSummary,
    buildPendingShipmentReminderEntry,
    buildReferralLinkDocId,
    buildShippingAddress,
    buildShippingContact,
    buildStudentOrderRecord,
    getPhysicalUnitIdSet,
    isPhysicalOrderItem,
    normalizeLogisticsData,
    normalizeGitHubUrl,
};
