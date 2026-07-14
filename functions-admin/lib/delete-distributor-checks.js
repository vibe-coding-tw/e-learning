"use strict";

function normalizeSize(snapshot = null) {
    if (!snapshot) return { size: 0, empty: true };
    if (typeof snapshot.size === "number" && typeof snapshot.empty === "boolean") {
        return { size: snapshot.size, empty: snapshot.empty };
    }
    if (Array.isArray(snapshot)) {
        return { size: snapshot.length, empty: snapshot.length === 0 };
    }
    return { size: 0, empty: true };
}

function collectDocIds(snapshot = null) {
    const ids = new Set();
    if (!snapshot || typeof snapshot.forEach !== "function") return ids;
    snapshot.forEach((doc) => {
        if (doc && typeof doc.id === "string" && doc.id.trim()) {
            ids.add(doc.id.trim());
        }
    });
    return ids;
}

function evaluateDeleteDistributorBlockers({
    priceBooksSnap = null,
    ordersByDistributorSnap = null,
    ordersByOwnerSnap = null,
    ordersByPartnerSnap = null,
    scopedUsers = [],
    defaultRuleSnap = null,
    backupRuleSnap = null
} = {}) {
    const priceBooks = normalizeSize(priceBooksSnap);
    const ordersByDistributor = normalizeSize(ordersByDistributorSnap);
    const ordersByOwner = normalizeSize(ordersByOwnerSnap);
    const ordersByPartner = normalizeSize(ordersByPartnerSnap);
    const defaultRules = collectDocIds(defaultRuleSnap);
    const backupRules = collectDocIds(backupRuleSnap);
    const blockingRules = new Set([...defaultRules, ...backupRules]);
    const userCount = Array.isArray(scopedUsers) ? scopedUsers.length : 0;
    const hasOrders = !ordersByDistributor.empty || !ordersByOwner.empty || !ordersByPartner.empty;

    return {
        hasPriceBooks: !priceBooks.empty,
        hasOrders,
        hasUsers: userCount > 0,
        hasRules: blockingRules.size > 0,
        blockingRuleIds: Array.from(blockingRules.values()),
        summary: {
            priceBooks: priceBooks.size > 0 ? "有" : "無",
            operators: userCount > 0 ? "有" : "無",
            orders: hasOrders ? "有" : "無",
            regionRules: blockingRules.size > 0 ? "有" : "無"
        },
        blocked: !priceBooks.empty || hasOrders || userCount > 0 || blockingRules.size > 0
    };
}

module.exports = {
    evaluateDeleteDistributorBlockers
};
