#!/usr/bin/env node
/**
 * Report each user's region distributor mapping.
 *
 * Usage:
 *   node functions/scripts/report_user_region_distributors.js
 *   node functions/scripts/report_user_region_distributors.js --json
 *   node functions/scripts/report_user_region_distributors.js --csv
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "e-learning-942f7",
  });
}

const db = admin.firestore();

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
    csv: argv.includes("--csv"),
  };
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeRegionCode(value = "") {
  const raw = normalizeText(value).toUpperCase();
  if (!raw) return "";
  if (raw === "ZH-TW" || raw === "TW" || raw === "TWD") return "TW";
  if (raw === "EN" || raw === "EN-US" || raw === "US" || raw === "USD") return "US";
  return raw;
}

function getUserDistributorScope(userData = {}) {
  return normalizeText(
    userData.distributorId ||
      userData.commercial?.distributorId ||
      userData.tutorDistributorId ||
      userData.partnerDistributorId ||
      ""
  );
}

function distributorMatchesRegion(distributor = {}, regionCode = "") {
  const normalizedRegion = normalizeRegionCode(regionCode);
  if (!normalizedRegion) return true;
  const regions = Array.isArray(distributor.regions) ? distributor.regions : [];
  return regions.some((region) => normalizeRegionCode(region) === normalizedRegion);
}

function chooseRecommendedDistributor(distributors = [], {
  regionCode = "",
  preferredDistributorId = "",
  ruleDefaultDistributorId = "",
  ruleBackupDistributorIds = [],
} = {}) {
  const active = (Array.isArray(distributors) ? distributors : []).filter(
    (item) => item && item.id && item.status === "ACTIVE"
  );
  const regionMatched = active.filter((item) => distributorMatchesRegion(item, regionCode));

  const pickById = (distributorId = "") => {
    const normalizedId = normalizeText(distributorId);
    if (!normalizedId) return null;
    return regionMatched.find((item) => item.id === normalizedId) ||
      active.find((item) => item.id === normalizedId) ||
      null;
  };

  const preferred = pickById(preferredDistributorId);
  if (preferred) return { distributor: preferred, reason: "preferred-distributor" };

  const defaultDistributor = pickById(ruleDefaultDistributorId);
  if (defaultDistributor) return { distributor: defaultDistributor, reason: "region-default" };

  for (const candidateId of Array.isArray(ruleBackupDistributorIds) ? ruleBackupDistributorIds : []) {
    const candidate = pickById(candidateId);
    if (candidate) return { distributor: candidate, reason: "region-backup" };
  }

  if (regionMatched.length === 1) {
    return { distributor: regionMatched[0], reason: "single-region-match" };
  }

  const fallback = regionMatched[0] || active[0] || null;
  return fallback
    ? { distributor: fallback, reason: regionMatched.length > 1 ? "first-region-match" : "first-active-distributor" }
    : { distributor: null, reason: "no-active-distributor" };
}

async function main() {
  const args = parseArgs(process.argv);
  const [usersSnap, distributorsSnap, rulesSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("distributors").get(),
    db.collection("region_distributor_rules").get(),
  ]);

  const distributors = distributorsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const distributorMap = new Map(distributors.map((item) => [item.id, item]));

  const ruleMap = new Map();
  rulesSnap.forEach((doc) => {
    const data = doc.data() || {};
    const region = normalizeRegionCode(data.region || doc.id);
    if (!region) return;
    ruleMap.set(region, {
      region,
      defaultDistributorId: normalizeText(data.defaultDistributorId || ""),
      backupDistributorIds: Array.isArray(data.backupDistributorIds)
        ? data.backupDistributorIds.map(normalizeText).filter(Boolean)
        : [],
      active: data.active !== false,
    });
  });

  const rows = usersSnap.docs.map((doc) => {
    const userData = doc.data() || {};
    const region = normalizeRegionCode(userData.preferredRegion || userData.region || "");
    const scopeDistributorId = getUserDistributorScope(userData);
    const preferredDistributorId = normalizeText(userData.preferredDistributorId || "");
    const rule = ruleMap.get(region) || null;
    const recommendation = chooseRecommendedDistributor(distributors, {
      regionCode: region,
      preferredDistributorId: preferredDistributorId || scopeDistributorId,
      ruleDefaultDistributorId: rule?.defaultDistributorId || "",
      ruleBackupDistributorIds: rule?.backupDistributorIds || [],
    });
    const selected = recommendation.distributor || null;

    return {
      uid: doc.id,
      email: normalizeText(userData.email || ""),
      name: normalizeText(userData.displayName || userData.name || ""),
      role: normalizeText(userData.role || ""),
      region: normalizeText(userData.region || ""),
      preferredRegion: normalizeText(userData.preferredRegion || ""),
      preferredDistributorId,
      distributorId: normalizeText(userData.distributorId || ""),
      commercialDistributorId: normalizeText(userData.commercial?.distributorId || ""),
      tutorDistributorId: normalizeText(userData.tutorDistributorId || ""),
      partnerDistributorId: normalizeText(userData.partnerDistributorId || ""),
      resolvedRegion: region,
      resolvedDistributorId: selected ? selected.id : "",
      resolvedDistributorName: selected ? normalizeText(selected.name || selected.id) : "",
      resolvedDistributorRegions: selected && Array.isArray(selected.regions) ? selected.regions.join("|") : "",
      resolvedDistributorStatus: selected ? normalizeText(selected.status || "ACTIVE") : "MISSING",
      resolutionReason: recommendation.reason,
      bindingSource: normalizeText(userData.bindingSource || ""),
      bindingConfidence: userData.bindingConfidence ?? "",
      distributorScopeId: scopeDistributorId,
      ruleDefaultDistributorId: rule?.defaultDistributorId || "",
      ruleBackupDistributorIds: (rule?.backupDistributorIds || []).join("|"),
      hasPriceData: Boolean(selected),
    };
  }).sort((a, b) => (a.email || a.uid).localeCompare(b.email || b.uid));

  if (args.json) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), users: rows.length, rows }, null, 2));
    return;
  }

  if (args.csv) {
    const headers = [
      "uid",
      "email",
      "name",
      "role",
      "region",
      "preferredRegion",
      "preferredDistributorId",
      "distributorId",
      "commercialDistributorId",
      "tutorDistributorId",
      "partnerDistributorId",
      "resolvedRegion",
      "resolvedDistributorId",
      "resolvedDistributorName",
      "resolvedDistributorRegions",
      "resolvedDistributorStatus",
      "resolutionReason",
      "bindingSource",
      "bindingConfidence",
      "distributorScopeId",
      "ruleDefaultDistributorId",
      "ruleBackupDistributorIds",
    ];
    console.log(headers.join(","));
    for (const row of rows) {
      console.log(headers.map((key) => JSON.stringify(row[key] ?? "")).join(","));
    }
    console.log(`# users=${rows.length}`);
    return;
  }

  console.log(`[report_user_region_distributors] users=${rows.length}`);
  for (const row of rows) {
    console.log(
      [
        `${row.email || row.uid}`,
        `region=${row.resolvedRegion || "-"}`,
        `distributor=${row.resolvedDistributorId || "-"}`,
        `name=${row.resolvedDistributorName || "-"}`,
        `reason=${row.resolutionReason}`,
      ].join(" | ")
    );
  }
}

main().catch((err) => {
  console.error("[report_user_region_distributors] failed:", err);
  process.exit(1);
});
