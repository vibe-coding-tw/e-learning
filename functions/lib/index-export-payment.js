const { registerProxyExports } = require('./index-export-utils');

const registerPaymentExports = (target, proxyPaymentCallable) => {
    registerProxyExports(target, [
        ["updateOrderFulfillmentStatus", "paymentUpdateOrderFulfillmentStatus"],
        ["markOrderShipped", "paymentMarkOrderShipped"]
    ], proxyPaymentCallable);
};

module.exports = {
    registerPaymentExports
};
