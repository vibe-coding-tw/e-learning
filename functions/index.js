"use strict";
const { onCall } = require("firebase-functions/v2/https");

const {
    proxyAutogradeCallable,
    proxyAutogradeRequest,
    proxyPaymentCallable,
    proxyAdminCallable,
    proxyAdminRequest
} = require('./lib/proxy-utils');
const {
    createOnUserCreatedTrigger
} = require('./lib/user-triggers');
const {
    createMapReplyHandler
} = require('./lib/ecpay-webhooks');
const {
    registerIndexExports
} = require('./lib/index-export-registry');
const {
    initializeFunctionsRuntime
} = require('./lib/functions-bootstrap');
const admin = require("firebase-admin");
const { getContentRuntimeConfig } = require("vibe-functions-core/runtime-state");

initializeFunctionsRuntime();

exports.getContentRuntimeConfig = onCall(async () => {
    const db = admin.firestore();
    const config = await getContentRuntimeConfig(db);
    return {
        success: true,
        ...config
    };
});

// Emulator-only: proxy functions duplicate names in admin/payment codebases.
// In production, each codebase deploys independently — having the same function
// name in multiple codebases causes `firebase deploy` to reject with
// "More than one codebase claims following functions". The real implementations
// live in functions-admin / functions-payment; the proxies here are only needed
// so the emulator can route calls between codebases via HTTP.
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true" || !!process.env.FIREBASE_EMULATOR_HUB;
if (isEmulator) {
    registerIndexExports({
        target: exports,
        proxyAutogradeCallable,
        proxyAutogradeRequest,
        proxyPaymentCallable,
        proxyAdminCallable,
        proxyAdminRequest,
        onCall,
        createOnUserCreatedTrigger,
        createMapReplyHandler
    });
}
