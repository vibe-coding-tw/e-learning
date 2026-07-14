#!/usr/bin/env node
"use strict";

const { evaluateDeleteDistributorBlockers } = require("../lib/delete-distributor-checks");

function mockSnap(docs = []) {
    const list = Array.isArray(docs) ? docs : [];
    return {
        size: list.length,
        empty: list.length === 0,
        forEach(callback) {
            list.forEach((doc) => {
                callback({
                    id: doc.id,
                    data: () => doc.data || {}
                });
            });
        }
    };
}

function runScenario(label, input) {
    const blockers = evaluateDeleteDistributorBlockers(input);
    console.log(`\n[${label}] blocked=${blockers.blocked}`);
    console.log(JSON.stringify(blockers, null, 2));
}

const distributorId = String(process.argv[2] || "esp32c3-3844be443dc4").trim();

console.log(`[repro-delete-distributor] distributorId=${distributorId}`);
console.log("[repro-delete-distributor] This script simulates the delete gate locally without Firestore emulators.");

runScenario("clean", {
    priceBooksSnap: mockSnap([]),
    ordersByDistributorSnap: mockSnap([]),
    ordersByOwnerSnap: mockSnap([]),
    ordersByPartnerSnap: mockSnap([]),
    scopedUsers: [],
    defaultRuleSnap: mockSnap([]),
    backupRuleSnap: mockSnap([])
});

runScenario("production-like-blocked", {
    priceBooksSnap: mockSnap([{ id: `${distributorId}_pricebook`, data: { distributorId } }]),
    ordersByDistributorSnap: mockSnap([{ id: `${distributorId}_order`, data: { distributorId } }]),
    ordersByOwnerSnap: mockSnap([{ id: `${distributorId}_owner_order`, data: { fulfillmentOwnerId: distributorId } }]),
    ordersByPartnerSnap: mockSnap([{ id: `${distributorId}_partner_order`, data: { fulfillmentPartnerId: distributorId } }]),
    scopedUsers: [{ id: "u1", distributorId }],
    defaultRuleSnap: mockSnap([{ id: "TW", data: { defaultDistributorId: distributorId } }]),
    backupRuleSnap: mockSnap([{ id: "US", data: { backupDistributorIds: [distributorId] } }])
});
