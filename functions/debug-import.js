const functions = require("firebase-functions");
console.log("functions:", typeof functions);
console.log("functions.region:", typeof functions.region);
console.log("Keys:", Object.keys(functions));

try {
    const v1 = require("firebase-functions/v1");
    console.log("v1.region:", typeof v1.region);
} catch (e) {
    console.log("Cannot require v1:", e.message);
}
