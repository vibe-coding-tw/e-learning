const { listDistributorPriceBooks } = require("./distributor-pricing");
const {
    buildShippingAddress,
    buildShippingContact,
    getPhysicalUnitIdSet,
    isPhysicalOrderItem
} = require("./order-utils");

function createDistributorPortalHelpers({
    normalizeText,
    getUserDistributorScope
} = {}) {
    if (typeof normalizeText !== "function") {
        throw new Error("createDistributorPortalHelpers requires normalizeText");
    }
    if (typeof getUserDistributorScope !== "function") {
        throw new Error("createDistributorPortalHelpers requires getUserDistributorScope");
    }

    async function loadDistributorScopedUsers(db, distributorId = "") {
        const normalizedDistributorId = normalizeText(distributorId);
        if (!normalizedDistributorId) return [];

        const queries = [
            db.collection("users").where("distributorId", "==", normalizedDistributorId),
            db.collection("users").where("commercial.distributorId", "==", normalizedDistributorId),
            db.collection("users").where("tutorDistributorId", "==", normalizedDistributorId),
            db.collection("users").where("partnerDistributorId", "==", normalizedDistributorId)
        ];

        const snapshots = await Promise.all(queries.map(async (query) => {
            try {
                return await query.get();
            } catch (error) {
                console.warn("[DistributorPortal] scoped user query failed:", error.message || error);
                return null;
            }
        }));

        const users = new Map();
        snapshots.forEach((snap) => {
            if (!snap || snap.empty) return;
            snap.forEach((doc) => {
                const data = doc.data() || {};
                if (getUserDistributorScope(data) !== normalizedDistributorId) return;
                users.set(doc.id, { id: doc.id, ...data });
            });
        });

        return Array.from(users.values());
    }

    function buildDistributorPortalOrderRecord(order = {}, orderId = "") {
        const items = order.items || {};
        const itemEntries = Object.entries(items);
        const physicalItemCount = itemEntries.filter(([_, item]) => item && item.isPhysical === true).length;
        const itemNames = itemEntries
            .map(([itemKey, item]) => item?.name || item?.productName || itemKey)
            .filter(Boolean)
            .slice(0, 3);

        return {
            id: orderId,
            orderNumber: order.orderNumber || orderId,
            uid: order.uid || "",
            amount: Number(order.amount || 0),
            currency: order.currency || "TWD",
            status: order.status || "",
            fulfillmentStatus: order.fulfillmentStatus || "PENDING",
            distributorId: order.distributorId || order.commercial?.distributorId || "",
            priceBookId: order.priceBookId || "",
            pricingVersion: order.pricingVersion || "",
            itemCount: itemEntries.length,
            physicalItemCount,
            hasPhysical: physicalItemCount > 0,
            items: itemNames,
            logistics: order.logistics || null,
            shippingContact: buildShippingContact(order.logistics || {}),
            shippingAddress: buildShippingAddress(order.logistics || {}),
            createdAt: order.createdAt || null,
            paidAt: order.paidAt || order.createdAt || null,
            shippedAt: order.shippedAt || null
        };
    }

    async function loadDistributorPortalOrders(db, distributorId = "", lessons = []) {
        const normalizedDistributorId = normalizeText(distributorId);
        if (!normalizedDistributorId) {
            return { items: [], summary: { totalOrders: 0, pendingShipmentCount: 0, shippedCount: 0, grossAmount: 0 } };
        }

        const physicalUnitIds = getPhysicalUnitIdSet(lessons);
        const priceBooks = await listDistributorPriceBooks(db, normalizedDistributorId);
        const priceBookIds = new Set(priceBooks.map((book) => String(book.id || book.priceBookId || "").trim()).filter(Boolean));

        const snap = await db.collection("orders")
            .where("status", "==", "SUCCESS")
            .get();

        const items = [];
        snap.forEach((doc) => {
            const order = doc.data() || {};
            const orderDistributorId = normalizeText(order.distributorId || order.commercial?.distributorId || "");
            const orderPriceBookId = normalizeText(order.priceBookId || "");
            const isOwnOrder = orderDistributorId === normalizedDistributorId || (orderPriceBookId && priceBookIds.has(orderPriceBookId));
            if (!isOwnOrder) return;

            const record = buildDistributorPortalOrderRecord(order, doc.id);
            const physicalItems = Object.keys(order.items || {}).filter((itemId) => isPhysicalOrderItem(itemId, order.items?.[itemId] || {}, physicalUnitIds));
            record.physicalItemCount = physicalItems.length;
            record.hasPhysical = physicalItems.length > 0;
            record.needsShipment = physicalItems.length > 0 && String(record.fulfillmentStatus || "").toUpperCase() !== "SHIPPED";
            items.push(record);
        });

        items.sort((a, b) => toMillis(b.paidAt) - toMillis(a.paidAt));

        const summary = items.reduce((acc, item) => {
            acc.totalOrders += 1;
            acc.grossAmount += Number(item.amount || 0);
            if (item.needsShipment) acc.pendingShipmentCount += 1;
            if (String(item.fulfillmentStatus || "").toUpperCase() === "SHIPPED") acc.shippedCount += 1;
            return acc;
        }, { totalOrders: 0, pendingShipmentCount: 0, shippedCount: 0, grossAmount: 0 });

        return { items, summary };
    }

    async function loadDistributorPortalTutors(db, distributorId = "") {
        const normalizedDistributorId = normalizeText(distributorId);
        if (!normalizedDistributorId) {
            return { items: [], summary: { tutorCount: 0, authorizedUnitCount: 0 } };
        }

        const users = await loadDistributorScopedUsers(db, normalizedDistributorId);
        const tutorItems = users.filter((user) => {
            return countAuthorizedTutorUnits(user) > 0
                || Boolean(normalizeText(user.tutorEmail || ""))
                || Boolean(normalizeText(user.courseDevEmail || ""))
                || Boolean(normalizeText(user.agentEmail || ""))
                || Object.keys(user.tutorConfigs || {}).length > 0;
        }).map((user) => {
            const email = normalizeText(user.email || user.tutorEmail || user.userEmail || "");
            return {
                id: user.id,
                uid: user.id,
                name: user.name || user.displayName || email || user.id,
                email,
                role: user.role === "admin" ? "admin" : "user",
                isTutor: countAuthorizedTutorUnits(user) > 0 || Object.keys(user.tutorConfigs || {}).length > 0,
                distributorId: getUserDistributorScope(user) || normalizedDistributorId,
                authorizedUnitCount: countAuthorizedTutorUnits(user),
                tutorConfigCount: Object.keys(user.tutorConfigs || {}).length,
                payoutAccount: normalizeText(user.payoutAccount || user.paymentAccount || ""),
                promotionCode: normalizeText(user.promotionCode || ""),
                status: user.status || "ACTIVE"
            };
        }).sort((a, b) => String(a.name || a.email || a.id).localeCompare(String(b.name || b.email || b.id)));

        return {
            items: tutorItems,
            summary: {
                tutorCount: tutorItems.length,
                authorizedUnitCount: tutorItems.reduce((sum, tutor) => sum + Number(tutor.authorizedUnitCount || 0), 0)
            }
        };
    }

    return {
        loadDistributorScopedUsers,
        buildDistributorPortalOrderRecord,
        loadDistributorPortalOrders,
        loadDistributorPortalTutors
    };
}

function toMillis(value = null) {
    if (!value) return 0;
    try {
        if (typeof value.toMillis === "function") return value.toMillis();
        if (typeof value.toDate === "function") return value.toDate().getTime();
        if (value instanceof Date) return value.getTime();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    } catch (_) {
        return 0;
    }
}

function countAuthorizedTutorUnits(userData = {}) {
    const tutorConfigs = userData.tutorConfigs || {};
    return Object.values(tutorConfigs).filter((cfg) => cfg && cfg.authorized === true).length;
}

module.exports = {
    createDistributorPortalHelpers,
    toMillis
};
