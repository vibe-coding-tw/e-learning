const { registerProxyExports } = require('./index-export-utils');

const registerPaymentExports = (target, proxyPaymentCallable) => {
    registerProxyExports(target, [
        ["updateOrderFulfillmentStatus", "paymentUpdateOrderFulfillmentStatus"],
        ["markOrderShipped", "paymentMarkOrderShipped"]
    ], proxyPaymentCallable);

    registerProxyExports(target, [
        ["getRevenueSharePolicies", "getRevenueSharePolicies"],
        ["upsertRevenueSharePolicy", "upsertRevenueSharePolicy"],
        ["getInvestorProfiles", "getInvestorProfiles"],
        ["upsertInvestorProfile", "upsertInvestorProfile"],
        ["upsertValuationSnapshot", "upsertValuationSnapshot"],
        ["upsertBalanceSheetSnapshot", "upsertBalanceSheetSnapshot"],
        ["issueInvestorEquity", "issueInvestorEquity"],
        ["recordInvestorFinanceEvent", "recordInvestorFinanceEvent"],
        ["recordLedgerEvent", "recordLedgerEvent"],
        ["generateLedgerReport", "generateLedgerReport"],
        ["exportLedgerReport", "exportLedgerReport"],
        ["recordOrderRefundEvent", "recordOrderRefundEvent"],
        ["settleAnnualInvestorDividends", "settleAnnualInvestorDividends"]
    ], proxyPaymentCallable);
};

module.exports = {
    registerPaymentExports
};
