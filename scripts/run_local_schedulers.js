#!/usr/bin/env node

const PROJECT_ID = process.env.FIREBASE_EMULATOR_PROJECT
    || process.env.FIREBASE_STAGING_PROJECT
    || "e-learning-942f7";
const DEFAULT_TIME_ZONE = "Asia/Taipei";
const CHECK_INTERVAL_MS = 15 * 1000;

process.env.LOCAL_SCHEDULER_EXPORTS = process.env.LOCAL_SCHEDULER_EXPORTS || "1";
process.env.FIREBASE_EMULATOR_PROJECT = process.env.FIREBASE_EMULATOR_PROJECT || PROJECT_ID;
process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG || JSON.stringify({ projectId: PROJECT_ID });

const adminModule = require("../functions-admin/index.js");
const { runCronGrading } = require("../functions/lib/cron-grading");

const localTasks = adminModule.__localSchedulerTasks || {};

function pad(value) {
    return String(value).padStart(2, "0");
}

function getLocalParts(date, timeZone) {
    if (!timeZone) {
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes(),
            weekday: date.getDay()
        };
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short"
    });

    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        weekday: weekdayMap[parts.weekday] ?? date.getDay()
    };
}

function minuteKey(now, timeZone) {
    const parts = getLocalParts(now, timeZone);
    return [
        parts.year,
        pad(parts.month),
        pad(parts.day),
        pad(parts.hour),
        pad(parts.minute)
    ].join("-");
}

const jobs = [
    {
        name: "autoGradingCron",
        timeZone: DEFAULT_TIME_ZONE,
        matches(now) {
            const parts = getLocalParts(now, this.timeZone);
            return parts.minute === 0 && parts.hour === 23 && parts.weekday === 5;
        },
        run: async () => runCronGrading()
    },
    {
        name: "calculateMonthlySharing",
        timeZone: null,
        matches(now) {
            const parts = getLocalParts(now, this.timeZone);
            return parts.minute === 0 && parts.hour === 0 && parts.day === 1;
        },
        run: async () => {
            if (typeof localTasks.calculateMonthlySharing !== "function") {
                throw new Error("Local scheduler task calculateMonthlySharing is unavailable.");
            }
            await localTasks.calculateMonthlySharing();
        }
    },
    {
        name: "calculateAnnualInvestorDividends",
        timeZone: DEFAULT_TIME_ZONE,
        matches(now) {
            const parts = getLocalParts(now, this.timeZone);
            return parts.minute === 0 && parts.hour === 0 && parts.day === 1 && parts.month === 1;
        },
        run: async () => {
            if (typeof localTasks.calculateAnnualInvestorDividends !== "function") {
                throw new Error("Local scheduler task calculateAnnualInvestorDividends is unavailable.");
            }
            await localTasks.calculateAnnualInvestorDividends();
        }
    },
    {
        name: "remindAdminPendingAssignments",
        timeZone: DEFAULT_TIME_ZONE,
        matches(now) {
            const parts = getLocalParts(now, this.timeZone);
            return parts.minute === 0 && parts.hour === 9;
        },
        run: async () => {
            if (typeof localTasks.runPendingAssignmentReminderTask !== "function") {
                throw new Error("Local scheduler task runPendingAssignmentReminderTask is unavailable.");
            }
            await localTasks.runPendingAssignmentReminderTask();
        }
    },
    {
        name: "remindAdminPendingShipments",
        timeZone: DEFAULT_TIME_ZONE,
        matches(now) {
            const parts = getLocalParts(now, this.timeZone);
            return parts.minute === 30 && parts.hour === 9;
        },
        run: async () => {
            if (typeof localTasks.runPendingShipmentReminderTask !== "function") {
                throw new Error("Local scheduler task runPendingShipmentReminderTask is unavailable.");
            }
            await localTasks.runPendingShipmentReminderTask();
        }
    }
];

const lastRunByJob = new Map();
let running = false;

async function tick() {
    if (running) return;
    running = true;
    try {
        const now = new Date();
        for (const job of jobs) {
            if (!job.matches(now)) continue;
            const key = `${job.name}:${minuteKey(now, job.timeZone)}`;
            if (lastRunByJob.get(job.name) === key) continue;
            console.log(`[local-schedulers] running ${job.name} at ${now.toISOString()}`);
            lastRunByJob.set(job.name, key);
            try {
                await job.run();
                console.log(`[local-schedulers] completed ${job.name}`);
            } catch (error) {
                console.error(`[local-schedulers] failed ${job.name}:`, error && error.message ? error.message : error);
            }
        }
    } finally {
        running = false;
    }
}

async function main() {
    console.log(`[local-schedulers] enabled for project ${PROJECT_ID}`);
    await tick();
    setInterval(() => {
        tick().catch((error) => {
            console.error("[local-schedulers] tick failed:", error && error.message ? error.message : error);
        });
    }, CHECK_INTERVAL_MS);
}

main().catch((error) => {
    console.error("[local-schedulers] fatal error:", error);
    process.exitCode = 1;
});
