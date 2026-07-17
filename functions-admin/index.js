"use strict";
const admin = require("firebase-admin");
if (!admin.apps.length) {
    admin.initializeApp({ projectId: "e-learning-942f7" });
}
const { setGlobalOptions } = require("firebase-functions/v2");
setGlobalOptions({ region: "asia-east1", minInstances: 0, memory: 128 });

Object.assign(exports, require("./lib/dashboard-data"));
Object.assign(exports, require("./lib/tutor-handlers"));
Object.assign(exports, require("./lib/distributor-handlers"));
Object.assign(exports, require("./lib/pricing-handlers"));
Object.assign(exports, require("./lib/routing-handlers"));
Object.assign(exports, require("./lib/assignment-handlers"));
Object.assign(exports, require("./lib/admin-handlers"));
