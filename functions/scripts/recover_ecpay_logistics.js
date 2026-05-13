#!/usr/bin/env node
/**
 * Batch recover logistics info from ECPay and write back to Firestore orders.
 *
 * Usage examples:
 *   node functions/scripts/recover_ecpay_logistics.js --dry-run --limit=50
 *   node functions/scripts/recover_ecpay_logistics.js --apply --limit=50
 *   node functions/scripts/recover_ecpay_logistics.js --apply --order-ids=VIBE123,VIBE456
 *
 * Required env vars:
 *   ECPAY_MERCHANT_ID
 *   ECPAY_HASH_KEY
 *   ECPAY_HASH_IV
 *
 * Optional env vars:
 *   ECPAY_LOGISTICS_QUERY_URL (default: https://logistics.ecpay.com.tw/Helper/QueryLogisticsTradeInfo/V5)
 *   GOOGLE_APPLICATION_CREDENTIALS (for Firestore access)
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const ECPAY_MERCHANT_ID = process.env.ECPAY_MERCHANT_ID || "";
const ECPAY_HASH_KEY = process.env.ECPAY_HASH_KEY || "";
const ECPAY_HASH_IV = process.env.ECPAY_HASH_IV || "";
const ECPAY_LOGISTICS_QUERY_URL =
  process.env.ECPAY_LOGISTICS_QUERY_URL ||
  "https://logistics.ecpay.com.tw/Helper/QueryLogisticsTradeInfo/V5";

function parseArgs(argv) {
  const args = {
    dryRun: true,
    apply: false,
    limit: 100,
    orderIds: [],
    output: "",
  };

  for (const token of argv.slice(2)) {
    if (token === "--dry-run") args.dryRun = true;
    else if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (token.startsWith("--limit=")) {
      const v = Number(token.split("=")[1]);
      if (Number.isFinite(v) && v > 0) args.limit = Math.floor(v);
    } else if (token.startsWith("--order-ids=")) {
      const raw = token.split("=")[1] || "";
      args.orderIds = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (token.startsWith("--output=")) {
      args.output = token.split("=")[1] || "";
    }
  }
  return args;
}

function encodeSpecialChars(str) {
  return encodeURIComponent(str)
    .toLowerCase()
    .replace(/%20/g, "+")
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
}

function generateCheckMacValue(params, hashKey, hashIV) {
  const sortedParams = [];
  Object.keys(params)
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      const val = params[key];
      if (key !== "CheckMacValue" && val !== undefined && val !== null && val !== "") {
        sortedParams.push(`${key}=${val}`);
      }
    });

  const raw = `HashKey=${hashKey}&${sortedParams.join("&")}&HashIV=${hashIV}`;
  const encoded = encodeSpecialChars(raw);
  return crypto.createHash("md5").update(encoded).digest("hex").toUpperCase();
}

function parseUrlEncodedResponse(text) {
  const obj = {};
  const params = new URLSearchParams(text);
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

async function queryEcpayByMerchantTradeNo(orderId) {
  const now = Math.floor(Date.now() / 1000).toString();
  const payload = {
    MerchantID: ECPAY_MERCHANT_ID,
    MerchantTradeNo: orderId,
    TimeStamp: now,
  };
  payload.CheckMacValue = generateCheckMacValue(payload, ECPAY_HASH_KEY, ECPAY_HASH_IV);

  const body = new URLSearchParams(payload).toString();
  const res = await fetch(ECPAY_LOGISTICS_QUERY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    parsed = parseUrlEncodedResponse(text);
  }

  return {
    ok: res.ok,
    status: res.status,
    rawText: text,
    data: parsed,
  };
}

function extractLogisticsFromEcpay(data = {}) {
  // Common fields observed in ECPay logistics responses.
  const logistics = {
    receiverName: data.ReceiverName || "",
    receiverPhone: data.ReceiverCellPhone || data.ReceiverPhone || "",
    storeId: data.CVSStoreID || "",
    storeName: data.CVSStoreName || "",
    storeAddress: data.CVSAddress || "",
    ReceiverAddress: data.ReceiverAddress || "",
  };

  const cleaned = {};
  for (const [k, v] of Object.entries(logistics)) {
    const s = String(v || "").trim();
    if (s) cleaned[k] = s;
  }
  return cleaned;
}

function hasEnoughLogistics(logistics = {}) {
  const receiverName = String(logistics.receiverName || logistics.ReceiverName || "").trim();
  const receiverPhone = String(
    logistics.receiverPhone || logistics.ReceiverCellPhone || logistics.ReceiverPhone || ""
  ).trim();
  const addr = String(logistics.storeAddress || logistics.CVSAddress || logistics.ReceiverAddress || "").trim();
  const storeId = String(logistics.storeId || logistics.CVSStoreID || "").trim();
  return !!(receiverName && receiverPhone && (addr || storeId));
}

async function loadTargetOrders({ orderIds, limit }) {
  if (orderIds.length > 0) {
    const results = [];
    for (const id of orderIds) {
      const doc = await db.collection("orders").doc(id).get();
      if (doc.exists) results.push(doc);
    }
    return results;
  }

  const snap = await db
    .collection("orders")
    .where("status", "==", "SUCCESS")
    .where("logisticsMissing", "==", true)
    .limit(limit)
    .get();
  return snap.docs;
}

function buildReportPath(customOutput) {
  if (customOutput) return customOutput;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), `ecpay_logistics_recovery_report_${ts}.json`);
}

async function main() {
  const args = parseArgs(process.argv);

  if (!ECPAY_MERCHANT_ID || !ECPAY_HASH_KEY || !ECPAY_HASH_IV) {
    throw new Error("Missing ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV env vars.");
  }

  const orderDocs = await loadTargetOrders(args);
  console.log(`[recover] target orders: ${orderDocs.length}`);
  console.log(`[recover] mode: ${args.dryRun ? "dry-run" : "apply"}`);
  console.log(`[recover] query url: ${ECPAY_LOGISTICS_QUERY_URL}`);

  const report = {
    startedAt: new Date().toISOString(),
    mode: args.dryRun ? "dry-run" : "apply",
    queryUrl: ECPAY_LOGISTICS_QUERY_URL,
    total: orderDocs.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  for (const doc of orderDocs) {
    const orderId = doc.id;
    const orderData = doc.data() || {};

    try {
      const queryRes = await queryEcpayByMerchantTradeNo(orderId);
      const recovered = extractLogisticsFromEcpay(queryRes.data || {});
      const merged = { ...(orderData.logistics || {}), ...recovered };
      const enough = hasEnoughLogistics(merged);

      const result = {
        orderId,
        queryOk: queryRes.ok,
        httpStatus: queryRes.status,
        ecpayData: queryRes.data || {},
        recoveredLogistics: recovered,
        enoughAfterMerge: enough,
      };

      if (!queryRes.ok) {
        report.failed += 1;
        result.action = "query_failed";
      } else if (!Object.keys(recovered).length) {
        report.skipped += 1;
        result.action = "no_recoverable_fields";
      } else if (args.apply) {
        await db.collection("orders").doc(orderId).set(
          {
            logistics: merged,
            logisticsMissing: !enough,
            logisticsRecoveredAt: admin.firestore.FieldValue.serverTimestamp(),
            logisticsRecoveredSource: "ecpay_batch_tool",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        report.updated += 1;
        result.action = "updated";
      } else {
        report.updated += 1;
        result.action = "would_update";
      }

      report.results.push(result);
      console.log(`[recover] ${orderId}: ${result.action}`);
    } catch (err) {
      report.failed += 1;
      report.results.push({
        orderId,
        action: "exception",
        error: err.message,
      });
      console.error(`[recover] ${orderId}: exception - ${err.message}`);
    }
  }

  report.endedAt = new Date().toISOString();
  const outputPath = buildReportPath(args.output);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[recover] report saved: ${outputPath}`);
  console.log(
    `[recover] done. total=${report.total}, updated=${report.updated}, skipped=${report.skipped}, failed=${report.failed}`
  );
}

main().catch((err) => {
  console.error(`[recover] fatal: ${err.message}`);
  process.exit(1);
});

