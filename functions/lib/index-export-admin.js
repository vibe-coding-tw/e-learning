const { onCall } = require("firebase-functions/v2/https");
const { registerProxyExports } = require('./index-export-utils');
const {
    loadDistributorRoutingOptions,
    loadDistributorCheckoutQuote
} = require('./admin-local-callables');

const registerAdminExports = (target, proxyAdminCallable, proxyAdminRequest) => {
    target.resolveDistributorCheckoutQuote = onCall(async (request) => loadDistributorCheckoutQuote(request));
    target.getDistributorRoutingOptions = onCall(async (request) => loadDistributorRoutingOptions(request));

    registerProxyExports(target, [
        ["upsertLessonMetadata", "adminUpsertLessonMetadata"],
        ["updateLessonI18n", "adminUpdateLessonI18n"],
        ["updateSystemConfig", "adminUpdateSystemConfig"],
        ["getSystemConfig", "adminGetSystemConfig"],
        ["purgeContentCache", "adminPurgeContentCache"],
        ["updateUserRelationships", "adminUpdateUserRelationships"],
        ["getUserRelationships", "adminGetUserRelationships"],
        ["upsertLessonPricing", "adminUpsertLessonPricing"],
        ["getLessonPriceBooks", "adminGetLessonPriceBooks"],
        ["getDistributorPriceBooks", "adminGetDistributorPriceBooks"],
        ["upsertDistributorPriceBook", "adminUpsertDistributorPriceBook"],
        ["seedDistributorPriceBooksFromLessons", "adminSeedDistributorPriceBooksFromLessons"],
        ["updateUserRoutingPreference", "adminUpdateUserRoutingPreference"],
        ["getDistributorPortalData", "adminGetDistributorPortalData"]
    ], proxyAdminCallable);

    registerProxyExports(target, [
        ["setUserRole", "adminSetUserRole"],
        ["getRevenueSharePolicies", "adminGetRevenueSharePolicies"],
        ["upsertRevenueSharePolicy", "adminUpsertRevenueSharePolicy"],
        ["getInvestorProfiles", "adminGetInvestorProfiles"],
        ["upsertInvestorProfile", "adminUpsertInvestorProfile"],
        ["upsertValuationSnapshot", "adminUpsertValuationSnapshot"],
        ["upsertBalanceSheetSnapshot", "adminUpsertBalanceSheetSnapshot"],
        ["issueInvestorEquity", "adminIssueInvestorEquity"],
        ["recordInvestorFinanceEvent", "adminRecordInvestorFinanceEvent"],
        ["recordLedgerEvent", "adminRecordLedgerEvent"],
        ["generateLedgerReport", "adminGenerateLedgerReport"],
        ["exportLedgerReport", "adminExportLedgerReport"],
        ["recordOrderRefundEvent", "adminRecordOrderRefundEvent"],
        ["settleAnnualInvestorDividends", "adminSettleAnnualInvestorDividends"],
        ["logActivity", "adminLogActivity"],
        ["saveTutorConfigs", "adminSaveTutorConfigs"],
        ["getTutorConfigs", "adminGetTutorConfigs"],
        ["resolveAssignmentAccess", "adminResolveAssignmentAccess"],
        ["authorizeTutorForCourse", "adminAuthorizeTutorForCourse"],
        ["applyForTutorRole", "adminApplyForTutorRole"],
        ["recommendTutorForUnit", "adminRecommendTutorForUnit"],
        ["submitTutorRecommendationInviteLink", "adminSubmitTutorRecommendationInviteLink"],
        ["decideTutorApplication", "adminDecideTutorApplication"],
        ["getDashboardData", "adminGetDashboardData"],
        ["getStudentAssignmentTutorReport", "adminGetStudentAssignmentTutorReport"],
        ["assignStudentToTutor", "adminAssignStudentToTutor"],
        ["verifyReferralLink", "adminVerifyReferralLink"],
        ["verifyPromoCode", "adminVerifyReferralLink"],
        ["findClassroomInviteBinding", "adminFindClassroomInviteBinding"],
        ["precheckGithubClassroomAccess", "adminPrecheckGithubClassroomAccess"],
        ["bindTutorToUnit", "adminBindTutorToUnit"],
        ["bindTutorByPromotionCode", "adminBindTutorByPromotionCode"]
    ], proxyAdminCallable);

    registerProxyExports(target, [
        ["debugTutorAuth", "adminDebugTutorAuth"],
        ["findClassroomInviteBindingHttp", "adminFindClassroomInviteBindingHttp"]
    ], proxyAdminRequest);
};

module.exports = {
    registerAdminExports
};
