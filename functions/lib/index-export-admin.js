"use strict";
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
        ["upsertLessonMetadata", "upsertLessonMetadata"],
        ["getLessonsMetadata", "getLessonsMetadata"],
        ["updateLessonI18n", "updateLessonI18n"],
        ["updateSystemConfig", "updateSystemConfig"],
        ["getSystemConfig", "getSystemConfig"],
        ["updateUserRelationships", "updateUserRelationships"],
        ["getUserRelationships", "getUserRelationships"],
        ["upsertLessonPricing", "upsertLessonPricing"],
        ["getLessonPriceBooks", "getLessonPriceBooks"],
        ["getDistributorPriceBooks", "getDistributorPriceBooks"],
        ["upsertDistributorPriceBook", "upsertDistributorPriceBook"],
        ["seedDistributorPriceBooksFromLessons", "seedDistributorPriceBooksFromLessons"],
        ["updateUserRoutingPreference", "updateUserRoutingPreference"],
        ["getDistributorPortalData", "getDistributorPortalData"]
    ], proxyAdminCallable);

    registerProxyExports(target, [
        ["setUserRole", "setUserRole"],
        ["logActivity", "logActivity"],
        ["saveTutorConfigs", "saveTutorConfigs"],
        ["getTutorConfigs", "getTutorConfigs"],
        ["resolveAssignmentAccess", "resolveAssignmentAccess"],
        ["authorizeTutorForCourse", "authorizeTutorForCourse"],
        ["applyForTutorRole", "applyForTutorRole"],
        ["recommendTutorForUnit", "recommendTutorForUnit"],
        ["submitTutorRecommendationInviteLink", "submitTutorRecommendationInviteLink"],
        ["decideTutorApplication", "decideTutorApplication"],
        ["getDashboardData", "getDashboardData"],
        ["getStudentAssignmentTutorReport", "getStudentAssignmentTutorReport"],
        ["assignStudentToTutor", "assignStudentToTutor"],
        ["verifyReferralLink", "verifyReferralLink"],
        ["findClassroomInviteBinding", "findClassroomInviteBinding"],
        ["precheckGithubClassroomAccess", "precheckGithubClassroomAccess"],
        ["bindTutorToUnit", "bindTutorToUnit"],
        ["bindTutorByPromotionCode", "bindTutorByPromotionCode"]
    ], proxyAdminCallable);

    registerProxyExports(target, [
        ["debugTutorAuth", "debugTutorAuth"],
        ["findClassroomInviteBindingHttp", "findClassroomInviteBindingHttp"]
    ], proxyAdminRequest);
};

module.exports = {
    registerAdminExports
};
