#!/usr/bin/env node
/**
 * Canonicalize course slugs in the sibling content-repo.
 *
 * Strategy:
 * - Keep legacy tw-/en- files in place as aliases.
 * - Create new canonical copies without the language prefix under each locale folder.
 * - Start with --common-only for a safe trial.
 *
 * Usage:
 *   node scripts/canonicalize_course_slugs.js --dry-run
 *   node scripts/canonicalize_course_slugs.js --apply --common-only
 *   node scripts/canonicalize_course_slugs.js --apply --all
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const contentRepoRoot = path.resolve(repoRoot, "../content-repo");
const coursesRoot = path.join(contentRepoRoot, "courses");

function parseArgs(argv) {
  const args = {
    apply: false,
    commonOnly: true,
  };
  for (const token of argv.slice(2)) {
    if (token === "--apply") args.apply = true;
    if (token === "--dry-run") args.apply = false;
    if (token === "--all") args.commonOnly = false;
    if (token === "--common-only") args.commonOnly = true;
  }
  return args;
}

function listCourseFiles() {
  const out = [];
  for (const langDir of ["en", "zh-TW"]) {
    const dir = path.join(coursesRoot, langDir);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".html")) continue;
      out.push({
        langDir,
        name,
        absPath: path.join(dir, name),
      });
    }
  }
  return out;
}

function canonicalizeSlug(fileName) {
  return String(fileName || "")
    .replace(/\.html$/i, "")
    .replace(/^(?:tw|en)-/i, "");
}

function isLegacyPrefixed(fileName) {
  return /^(?:tw|en)-/i.test(String(fileName || ""));
}

function shouldProcess(fileName, commonOnly) {
  if (!isLegacyPrefixed(fileName)) return false;
  const canonical = canonicalizeSlug(fileName);
  if (!canonical) return false;
  if (!commonOnly) return true;
  return /^common-/i.test(canonical);
}

function main() {
  const { apply, commonOnly } = parseArgs(process.argv);
  const files = listCourseFiles();
  const plan = [];

  for (const file of files) {
    if (!shouldProcess(file.name, commonOnly)) continue;

    const canonicalName = `${canonicalizeSlug(file.name)}.html`;
    const targetPath = path.join(path.dirname(file.absPath), canonicalName);
    if (path.resolve(targetPath) === path.resolve(file.absPath)) continue;

    plan.push({
      langDir: file.langDir,
      legacy: file.name,
      canonical: canonicalName,
      from: file.absPath,
      to: targetPath,
      exists: fs.existsSync(targetPath),
    });
  }

  console.log(`[canonicalize_course_slugs] mode=${apply ? "APPLY" : "DRY-RUN"} scope=${commonOnly ? "common-only" : "all"}`);
  console.log(`[canonicalize_course_slugs] contentRepo=${contentRepoRoot}`);
  console.log(`[canonicalize_course_slugs] candidates=${plan.length}`);

  for (const item of plan) {
    console.log(`- ${item.langDir}/${item.legacy} -> ${item.langDir}/${item.canonical}${item.exists ? " (exists)" : ""}`);
  }

  if (!apply) return;

  let copied = 0;
  let skipped = 0;
  for (const item of plan) {
    if (item.exists) {
      skipped += 1;
      continue;
    }
    fs.copyFileSync(item.from, item.to);
    copied += 1;
  }

  console.log(`[canonicalize_course_slugs] copied=${copied} skipped=${skipped}`);
}

main();
