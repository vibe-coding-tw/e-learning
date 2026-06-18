const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");

function getProxyFunctionBaseUrl(functionName) {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "e-learning-942f7";
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true" || !!process.env.FIREBASE_EMULATOR_HUB;
    if (isEmulator) {
        const emulatorHost = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:15001";
        return `http://${emulatorHost}/${projectId}/asia-east1/${functionName}`;
    }
    return `https://asia-east1-${projectId}.cloudfunctions.net/${functionName}`;
}

function normalizeHttpsErrorCode(code = "") {
    const normalized = String(code || "").trim().toLowerCase().replace(/_/g, "-");
    const allowedCodes = new Set([
        "cancelled",
        "unknown",
        "invalid-argument",
        "deadline-exceeded",
        "not-found",
        "already-exists",
        "permission-denied",
        "resource-exhausted",
        "failed-precondition",
        "aborted",
        "out-of-range",
        "unimplemented",
        "internal",
        "unavailable",
        "data-loss",
        "unauthenticated"
    ]);
    return allowedCodes.has(normalized) ? normalized : "internal";
}

function extractCallableError(payload) {
    const err = payload?.error;
    if (!err || typeof err !== "object") return null;

    const message = String(err.message || err.status || "").trim() || "Callable request failed.";
    const code = normalizeHttpsErrorCode(err.status || err.code || "internal");
    return { code, message };
}

function callThroughProxy(functionName, request, failurePrefix) {
    return fetch(getProxyFunctionBaseUrl(functionName), {
        method: "POST",
        headers: {
            "Authorization": request?.rawRequest?.headers?.authorization || request?.rawRequest?.headers?.Authorization || "",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ data: request.data || {} })
    }).then(async (response) => {
        const payload = await response.json().catch(() => null);
        const callableError = extractCallableError(payload);
        if (!response.ok || callableError) {
            const message = callableError?.message || payload?.message || failurePrefix;
            throw new HttpsError(callableError?.code || "internal", message);
        }
        if (payload && typeof payload === "object") {
            if (Object.prototype.hasOwnProperty.call(payload, "result")) return payload.result;
            if (Object.prototype.hasOwnProperty.call(payload, "data")) return payload.data;
        }
        return payload;
    });
}

function proxyAutogradeCallable(functionName) {
    return onCall(async (request) => callThroughProxy(functionName, request, "Failed to forward autograde request."));
}

function proxyAutogradeRequest(functionName) {
    return onRequest(async (req, res) => {
        const signature = req.get("x-hub-signature-256") || "";
        const headers = {
            "Content-Type": req.get("content-type") || "application/json"
        };
        if (signature) headers["x-hub-signature-256"] = signature;
        const response = await fetch(getProxyFunctionBaseUrl(functionName), {
            method: req.method || "POST",
            headers,
            body: req.rawBody || Buffer.from(JSON.stringify(req.body || {}))
        });
        const contentType = response.headers.get("content-type") || "application/json";
        res.status(response.status).set("content-type", contentType);
        const text = await response.text();
        return res.send(text);
    });
}

function proxyPaymentCallable(functionName) {
    return onCall(async (request) => callThroughProxy(functionName, request, "Failed to forward payment request."));
}

function proxyAdminCallable(functionName) {
    return onCall(async (request) => callThroughProxy(functionName, request, "Failed to forward admin request."));
}

function proxyAdminRequest(functionName) {
    return onRequest(async (req, res) => {
        const headers = {
            "Content-Type": req.get("content-type") || "application/json",
            "Authorization": req.get("authorization") || req.get("Authorization") || ""
        };
        const queryString = new URLSearchParams();
        Object.entries(req.query || {}).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach((item) => {
                    if (item !== undefined && item !== null) queryString.append(key, String(item));
                });
            } else if (value !== undefined && value !== null) {
                queryString.append(key, String(value));
            }
        });
        const url = `${getProxyFunctionBaseUrl(functionName)}${queryString.toString() ? `?${queryString.toString()}` : ""}`;
        const response = await fetch(url, {
            method: req.method || "GET",
            headers,
            body: (req.method || "GET").toUpperCase() === "GET" || (req.method || "GET").toUpperCase() === "HEAD"
                ? undefined
                : (req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
        });
        const contentType = response.headers.get("content-type") || "application/json";
        res.status(response.status).set("content-type", contentType);
        const text = await response.text();
        return res.send(text);
    });
}

module.exports = {
    proxyAutogradeCallable,
    proxyAutogradeRequest,
    proxyPaymentCallable,
    proxyAdminCallable,
    proxyAdminRequest
};
