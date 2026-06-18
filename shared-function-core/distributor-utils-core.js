function getUserDistributorScope(userData = {}) {
    return String(
        userData.distributorId ||
        userData.commercial?.distributorId ||
        userData.tutorDistributorId ||
        userData.partnerDistributorId ||
        userData.preferredDistributorId ||
        ""
    ).trim();
}

function countAuthorizedTutorUnits(userData = {}) {
    const tutorConfigs = userData.tutorConfigs || {};
    return Object.values(tutorConfigs).filter((cfg) => cfg && cfg.authorized === true).length;
}

function getPayoutAccountFromUser(userData = {}) {
    if (!userData || typeof userData !== "object") return "";
    if (typeof userData.payoutAccount === "string" && userData.payoutAccount.trim()) return userData.payoutAccount.trim();
    if (typeof userData.paymentAccount === "string" && userData.paymentAccount.trim()) return userData.paymentAccount.trim();
    const map = userData.payoutAccounts || {};
    const candidate = map.default || map.bank || "";
    return typeof candidate === "string" ? candidate.trim() : "";
}

module.exports = {
    countAuthorizedTutorUnits,
    getPayoutAccountFromUser,
    getUserDistributorScope
};
