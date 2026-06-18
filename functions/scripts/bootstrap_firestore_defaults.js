#!/usr/bin/env node
/**
 * Bootstrap canonical Firestore defaults.
 *
 * This wrapper runs the canonical Firestore initialization scripts in order:
 * 1. metadata_settings runtime defaults
 * 2. revenue share policies
 * 3. default distributors + price books
 *
 * Usage:
 *   node scripts/bootstrap_firestore_defaults.js --dry-run
 *   node scripts/bootstrap_firestore_defaults.js --apply
 *   node scripts/bootstrap_firestore_defaults.js --apply --overwrite
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
    dryRun: argv.includes("--dry-run") || !argv.includes("--apply"),
    overwrite: argv.includes("--overwrite"),
  };
}

function runScript(scriptPath, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const code = typeof result.status === "number" ? result.status : 1;
    throw new Error(`script failed: ${path.basename(scriptPath)} (exit ${code})`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const scriptsDir = __dirname;
  const sharedArgs = args.apply ? ["--apply"] : ["--dry-run"];

  console.log(`[bootstrap_firestore_defaults] mode=${args.apply ? "APPLY" : "DRY_RUN"} overwrite=${args.overwrite ? "yes" : "no"}`);

  runScript(path.join(scriptsDir, "seed_metadata_settings.js"), sharedArgs);
  runScript(path.join(scriptsDir, "seed_revenue_share_policies.js"), sharedArgs);

  const pricebookArgs = [...sharedArgs];
  if (args.overwrite) {
    pricebookArgs.push("--overwrite");
  }
  runScript(path.join(scriptsDir, "seed_default_distributors_and_pricebooks.js"), pricebookArgs);

  console.log("[bootstrap_firestore_defaults] done");
}

try {
  main();
} catch (err) {
  console.error("[bootstrap_firestore_defaults] failed:", err);
  process.exit(1);
}
