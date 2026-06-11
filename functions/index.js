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

initializeFunctionsRuntime();

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
