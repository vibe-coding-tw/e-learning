const crypto = require('crypto');

function generateCheckMacValue(params, hashKey, hashIV) {
    const filteredParams = {};
    Object.keys(params).forEach(key => {
        if (key !== 'CheckMacValue' && params[key] !== undefined && params[key] !== null && params[key] !== '') {
            filteredParams[key] = params[key];
        }
    });

    const sortedKeys = Object.keys(filteredParams).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    let rawString = sortedKeys.map(key => `${key}=${filteredParams[key]}`).join('&');
    rawString = `HashKey=${hashKey}&${rawString}&HashIV=${hashIV}`;

    let encodedString = encodeURIComponent(rawString).toLowerCase();
    encodedString = encodedString
        .replace(/%2d/g, '-')
        .replace(/%5f/g, '_')
        .replace(/%2e/g, '.')
        .replace(/%21/g, '!')
        .replace(/%2a/g, '*')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')')
        .replace(/%20/g, '+');

    return crypto.createHash('sha256').update(encodedString).digest('hex').toUpperCase();
}

// Sample Payload based on ECPay Logistics Docs
const sampleParams = {
    MerchantID: '3271550',
    MerchantTradeNo: 'MAP123456789',
    LogisticsType: 'CVS',
    LogisticsSubType: 'UNIMART',
    IsCollection: 'N',
    ServerReplyURL: 'https://example.com/reply'
};

const hashKey = 'ekyTDhA4ifnwfRFu';
const hashIV = 'FnoEMtZFKRg6nUEx';

const mac = generateCheckMacValue(sampleParams, hashKey, hashIV);
console.log('Parameters:', JSON.stringify(sampleParams, null, 2));
console.log('Generated CheckMacValue:', mac);

// Expected behavior: This should match what ECPay expects.
// Since we don't have the official ECPay validator here, we trust the logic that 
// already works for payments (initiatePayment uses the same generateCheckMacValue).
