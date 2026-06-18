const {
    countAuthorizedTutorUnits,
    getUserDistributorScope
} = require("vibe-functions-core/distributor-utils-core");

async function loadDistributorScopedUsers(dbRef, distributorId = "") {
    const normalizedDistributorId = String(distributorId || "").trim();
    if (!normalizedDistributorId) return [];

    const queries = [
        dbRef.collection("users").where("distributorId", "==", normalizedDistributorId),
        dbRef.collection("users").where("commercial.distributorId", "==", normalizedDistributorId),
        dbRef.collection("users").where("tutorDistributorId", "==", normalizedDistributorId),
        dbRef.collection("users").where("partnerDistributorId", "==", normalizedDistributorId)
    ];

    const snapshots = await Promise.all(queries.map(async (query) => {
        try {
            return await query.get();
        } catch (e) {
            console.warn("[DistributorPortal] scoped user query failed:", e.message || e);
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

module.exports = {
    getUserDistributorScope,
    countAuthorizedTutorUnits,
    loadDistributorScopedUsers
};
