#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const contentPublicRoot = path.resolve(repoRoot, '../content-repo/public');
const publicRoot = path.join(repoRoot, 'public');

const localeMappings = [
  { source: 'en', target: 'en' },
  { source: 'zh-TW', target: 'tw' },
];

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function syncLocale({ source, target }) {
  const sourceDir = path.join(contentPublicRoot, source);
  const targetDir = path.join(publicRoot, target);

  if (!fs.existsSync(sourceDir)) {
    return {
      source,
      target,
      sourceExists: false,
      copied: 0,
      removed: 0,
    };
  }

  ensureDir(targetDir);

  const sourceFiles = new Set();
  const copiedFiles = [];

  for (const sourceFile of walkFiles(sourceDir)) {
    const rel = path.relative(sourceDir, sourceFile);
    const targetFile = path.join(targetDir, rel);
    ensureDir(path.dirname(targetFile));
    fs.copyFileSync(sourceFile, targetFile);
    sourceFiles.add(path.normalize(targetFile));
    copiedFiles.push(path.relative(repoRoot, targetFile));
  }

  let removed = 0;
  for (const targetFile of walkFiles(targetDir)) {
    if (sourceFiles.has(path.normalize(targetFile))) continue;
    fs.unlinkSync(targetFile);
    removed += 1;
  }

  return {
    source,
    target,
    sourceExists: true,
    copied: copiedFiles.length,
    removed,
    copiedFiles,
  };
}

function syncLocalizedPublicPages({ verbose = true } = {}) {
  const results = localeMappings.map(syncLocale);

  if (verbose) {
    console.log(`[localized-public-sync] contentPublicRoot=${contentPublicRoot}`);
    for (const result of results) {
      if (!result.sourceExists) {
        console.log(`[localized-public-sync] skip ${result.source} -> ${result.target} (source missing)`);
        continue;
      }
      console.log(
        `[localized-public-sync] ${result.source} -> ${result.target} copied=${result.copied} removed=${result.removed}`
      );
    }
  }

  return results;
}

if (require.main === module) {
  syncLocalizedPublicPages({ verbose: true });
}

module.exports = {
  syncLocalizedPublicPages,
};
