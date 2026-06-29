"use strict";
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");

const initializeFunctionsRuntime = () => {
    if (process.env.NODE_ENV !== 'production' || !process.env.ECPAY_MERCHANT_ID) {
        require('dotenv').config();
    }

    setGlobalOptions({
        region: "asia-east1",
        maxInstances: 10,
        minInstances: 0,
        memory: 128,
        concurrency: 80
    });

    const requiredEnv = [
        "ECPAY_MERCHANT_ID",
        "ECPAY_HASH_KEY",
        "ECPAY_HASH_IV",
        "ECPAY_API_URL"
    ];

    const missingEnv = requiredEnv.filter((name) => !process.env[name]);
    if (missingEnv.length > 0) {
        logger.error("錯誤：未讀取到綠界設定，請檢查 functions/.env 檔案！");
    }
};

module.exports = {
    initializeFunctionsRuntime
};
