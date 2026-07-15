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

// 2026-07-15: 移除了原本包住這段的 `if (process.env.FUNCTIONS_EMULATOR)`。真正的
// `firebase deploy` 不會設定 FUNCTIONS_EMULATOR 這個環境變數（那是 emulator 專用），
// 代表這段 registerIndexExports() 呼叫（掛上 autograde/payment/admin 的 proxy
// functions、onUserCreated trigger、mapReply webhook）在正式環境下從來不會執行——
// 這個 codebase 部署到 production 時，只有上面的 getContentRuntimeConfig 是活的，
// 其餘全部消失。這個 guard 是 2026-06-25 commit 976999d6（"emulator guard"）加的，
// 找不到說明為什麼要限制在 emulator 環境；同一個 commit 也順帶引入了已在稍早
// fix-dangling-import-and-i18n.md 那次修復移除的 dangling registerAdminExports
// import，兩者疑似是同一次誤改。全系統審查（2026-07-15）判斷這是意外/誤解，不是
// 刻意設計，改回無條件呼叫。
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
