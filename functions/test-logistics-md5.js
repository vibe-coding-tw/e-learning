const crypto = require('crypto');

function generateCheckMacValue(params, hashKey, hashIV, encType = 'sha256') {
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

    return crypto.createHash(encType).update(encodedString).digest('hex').toUpperCase();
}

// Sample Payload based on ECPay Logistics Docs
const sampleParams = {
    MerchantID: '3271550',
    LogisticsType: 'CVS',
    LogisticsSubType: 'UNIMARTC2C',
    IsCollection: 'N',
    ServerReplyURL: 'https://example.com/reply'
};

const hashKey = 'ekyTDhA4ifnwfRFu';
const hashIV = 'FnoEMtZFKRg6nUEx';

console.log('--- Testing MD5 (Logistics Map) ---');
const macMd5 = generateCheckMacValue(sampleParams, hashKey, hashIV, 'md5');
console.log('Parameters:', JSON.stringify(sampleParams, null, 2));
console.log('Generated MD5 MAC:', macMd5);

console.log('\n--- Testing SHA256 (Payments) ---');
const macSha256 = generateCheckMacValue(sampleParams, hashKey, hashIV, 'sha256');
console.log('Generated SHA256 MAC:', macSha256);
