const { registerAdminExports } = require('./index-export-admin');
const { registerAutogradeExports } = require('./index-export-autograde');
const { registerPaymentExports } = require('./index-export-payment');
const { registerTriggersExports } = require('./index-export-triggers');

const registerIndexExports = ({
    target,
    proxyAutogradeCallable,
    proxyAutogradeRequest,
    proxyPaymentCallable,
    proxyAdminCallable,
    proxyAdminRequest,
    onCall,
    HttpsError,
    createOnUserCreatedTrigger,
    createMapReplyHandler
}) => {
    registerAdminExports(target, proxyAdminCallable, proxyAdminRequest);
    registerPaymentExports(target, proxyPaymentCallable);
    registerAutogradeExports({
        target,
        proxyAutogradeCallable,
        proxyAutogradeRequest,
        onCall,
        HttpsError
    });
    registerTriggersExports(target, createOnUserCreatedTrigger, createMapReplyHandler);
};

module.exports = {
    registerIndexExports
};
