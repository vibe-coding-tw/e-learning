const { onCall, HttpsError } = require("firebase-functions/v2/https");

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

registerIndexExports({
    target: exports,
    proxyAutogradeCallable,
    proxyAutogradeRequest,
    proxyPaymentCallable,
    proxyAdminCallable,
    proxyAdminRequest,
    onCall,
    HttpsError,
    createOnUserCreatedTrigger,
    createMapReplyHandler
});

Object.assign(exports, require("functions-admin"));
