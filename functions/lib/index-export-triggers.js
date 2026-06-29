"use strict";
const { onSchedule } = require("firebase-functions/v2/scheduler");

const registerTriggersExports = (target, createOnUserCreatedTrigger, createMapReplyHandler) => {
    target.onUserCreated = createOnUserCreatedTrigger();
    target.mapReply = createMapReplyHandler();

    // 定時評分排程：每週五晚上11點 (23:00) 執行
    target.autoGradingCron = onSchedule({
        schedule: "0 23 * * 5",
        timeZone: "Asia/Taipei",
        timeoutSeconds: 1200,
        memory: "512Mi"
    }, async (event) => {
        const { runCronGrading } = require("./cron-grading");
        await runCronGrading();
    });
};

module.exports = {
    registerTriggersExports
};
