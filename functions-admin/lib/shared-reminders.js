function formatTaipeiDateTime(value, fallback = "未知") {
    if (!value) return fallback;
    const date = typeof value.toDate === "function"
        ? value.toDate()
        : value instanceof Date
            ? value
            : new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
}

async function runPendingAssignmentReminder({
    db,
    admin,
    getLessons,
    resolveLessonPrice,
    collectPurchasedUnitIds,
    orderNormalizationResolvers,
    fallbackNameFromEmail,
    sendStudentPendingTutorAssignmentReminder,
    logger = console
}) {
    const lessons = await getLessons();
    const unitToCourse = new Map();

    lessons.forEach((course) => {
        const units = Array.isArray(course.courseUnits) ? course.courseUnits : [];
        units.forEach((unitId) => unitToCourse.set(String(unitId), course));
    });

    const unitRequiresTutorAssignment = (unitId) => {
        if (!unitId) return false;
        const course = unitToCourse.get(String(unitId));
        if (!course) return false;
        const price = Math.max(
            Number(resolveLessonPrice(course, "TWD").amount || 0),
            Number(resolveLessonPrice(course, "USD").amount || 0)
        );
        return price > 0 && course.isPhysical !== true;
    };

    const ordersSnapshot = await db.collection("orders").where("status", "==", "SUCCESS").get();
    const pendingMap = new Map();

    ordersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid && data.items) {
            const purchasedUnits = collectPurchasedUnitIds(data.items, lessons, orderNormalizationResolvers);
            purchasedUnits.forEach((unitId) => {
                if (!unitRequiresTutorAssignment(unitId)) return;
                if (!pendingMap.has(data.uid)) pendingMap.set(data.uid, new Set());
                pendingMap.get(data.uid).add(unitId);
            });
        }
    });

    const uids = Array.from(pendingMap.keys());
    const pendingAssignments = [];

    for (let i = 0; i < uids.length; i += 10) {
        const chunk = uids.slice(i, i + 10);
        const usersSnapshot = await db.collection("users")
            .where(admin.firestore.FieldPath.documentId(), "in", chunk)
            .get();

        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            const uid = doc.id;
            const requiredUnits = pendingMap.get(uid);
            const assignedUnits = userData.unitAssignments || {};
            const unassigned = Array.from(requiredUnits).filter((unitId) => !assignedUnits[unitId]);

            if (unassigned.length > 0) {
                pendingAssignments.push({
                    email: userData.email || "未提供電子郵件",
                    units: unassigned
                });
            }
        });
    }

    if (pendingAssignments.length > 0) {
        logger.log?.(`Found ${pendingAssignments.length} users with pending assignments. Notifying students.`);
        for (const item of pendingAssignments) {
            if (!item?.email) continue;
            const studentName = fallbackNameFromEmail(item.email, "同學");
            await sendStudentPendingTutorAssignmentReminder(item.email, studentName, item.units || []);
        }
    } else {
        logger.log?.("No pending tutor assignments found.");
    }

    return { pendingAssignments: pendingAssignments.length };
}

async function runPendingShipmentReminder({
    db,
    admin,
    adminEmail,
    getLessons,
    getPhysicalUnitIdSet,
    isPhysicalOrderItem,
    buildPendingShipmentReminderEntry,
    formatTaipeiDateTimeFn = formatTaipeiDateTime,
    sendAdminShipmentReminder,
    logger = console
}) {
    if (!adminEmail) {
        logger.log?.("No admin email configured for shipment reminders.");
        return { pendingShipments: 0, skipped: true };
    }

    const lessons = await getLessons();
    const physicalUnitIds = getPhysicalUnitIdSet(lessons);
    const ordersSnapshot = await db.collection("orders").where("status", "==", "SUCCESS").get();
    const pendingShipments = [];

    for (const doc of ordersSnapshot.docs) {
        const data = doc.data();
        if (data.fulfillmentStatus === "SHIPPED") continue;

        const items = data.items || {};
        const physicalItems = Object.keys(items).filter((id) => isPhysicalOrderItem(id, items[id] || {}, physicalUnitIds));
        if (physicalItems.length > 0) {
            const userDoc = await db.collection("users").doc(data.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};

            pendingShipments.push(buildPendingShipmentReminderEntry({
                orderId: doc.id,
                email: userData.email || "未提供",
                items: physicalItems.map((id) => lessons.find((l) => l.id === id)?.title || items[id]?.name || id),
                paidAt: formatTaipeiDateTimeFn(data.paidAt)
            }));
        }
    }

    if (pendingShipments.length > 0) {
        logger.log?.(`Found ${pendingShipments.length} pending shipments. Notifying admin.`);
        await sendAdminShipmentReminder(adminEmail, pendingShipments);
    } else {
        logger.log?.("No pending shipments found.");
    }

    return { pendingShipments: pendingShipments.length };
}

module.exports = {
    formatTaipeiDateTime,
    runPendingAssignmentReminder,
    runPendingShipmentReminder
};
