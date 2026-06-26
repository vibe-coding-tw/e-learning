#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const srcDir = path.join(rootDir, 'src');
const privateCoursesDir = path.join(rootDir, 'functions', 'private_courses');

function walkFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function hashFile(absPath) {
  const buf = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

function isLocalAssetRef(ref) {
  return !/^(?:https?:)?\/\//i.test(ref) && !/^(?:data|mailto|tel):/i.test(ref);
}

function stripQueryAndHash(ref) {
  const q = ref.indexOf('?');
  const h = ref.indexOf('#');
  let end = ref.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return ref.slice(0, end);
}

function dehashAssetPath(assetPath) {
  return assetPath.replace(/\.([0-9a-f]{12})\.(js|css)$/i, '.$2');
}

function findSource(resolvedAbs) {
  if (fs.existsSync(resolvedAbs)) return resolvedAbs;
  if (resolvedAbs.startsWith(publicDir)) {
    const rel = path.relative(publicDir, resolvedAbs);
    const srcCandidate = path.join(srcDir, rel);
    if (fs.existsSync(srcCandidate)) return srcCandidate;
  }
  return null;
}

function makeFingerprintAsset(sourceAbs, outputDir) {
  const ext = path.extname(sourceAbs);
  const baseNoExt = path.basename(sourceAbs, ext);
  const hash = hashFile(sourceAbs);
  const fpName = `${baseNoExt}.${hash}${ext}`;
  const dir = outputDir || path.dirname(sourceAbs);
  const fpAbs = path.join(dir, fpName);
  fs.copyFileSync(sourceAbs, fpAbs);

  const oldPattern = new RegExp(`^${baseNoExt}\\.[0-9a-f]{12}\\${ext}$`, 'i');
  for (const name of fs.readdirSync(dir)) {
    if (!oldPattern.test(name)) continue;
    if (name === fpName) continue;
    fs.unlinkSync(path.join(dir, name));
  }
  return fpAbs;
}

function resolveAssetAbs(htmlAbs, assetPath) {
  if (assetPath.startsWith('/')) {
    return path.join(publicDir, assetPath.replace(/^\/+/, ''));
  }
  return path.resolve(path.dirname(htmlAbs), assetPath);
}

function buildNewRef(htmlAbs, fpAbs, originalRef) {
  if (originalRef.startsWith('/')) {
    return `/${toPosix(path.relative(publicDir, fpAbs))}`;
  }
  let rel = toPosix(path.relative(path.dirname(htmlAbs), fpAbs));
  if (!rel.startsWith('.') && !rel.startsWith('/')) rel = `./${rel}`;
  return rel;
}

function processHtmlFile(htmlAbs) {
  let content = fs.readFileSync(htmlAbs, 'utf8');
  let changed = false;

  const attrRegex = /(src|href)=("([^"]+)"|'([^']+)')/g;
  const replacements = [];
  let m;
  while ((m = attrRegex.exec(content)) !== null) {
    const fullMatch = m[0];
    const quoteWrapped = m[2];
    const rawRef = m[3] || m[4] || '';
    const attrName = m[1];
    const refNoQuery = stripQueryAndHash(rawRef);

    if (!isLocalAssetRef(rawRef)) continue;
    if (!/\.(js|css)$/i.test(refNoQuery)) continue;

    const sourcePath = dehashAssetPath(refNoQuery);
    const resolvedAbs = resolveAssetAbs(htmlAbs, sourcePath);
    if (!resolvedAbs.startsWith(publicDir)) continue;
    const sourceAbs = findSource(resolvedAbs);
    if (!sourceAbs) continue;

    const fpAbs = makeFingerprintAsset(sourceAbs, path.dirname(resolvedAbs));
    const newRef = buildNewRef(htmlAbs, fpAbs, rawRef);
    const newAttr = `${attrName}=${quoteWrapped[0]}${newRef}${quoteWrapped[0]}`;
    replacements.push({ from: fullMatch, to: newAttr });
  }

  for (const r of replacements) {
    if (r.from === r.to) continue;
    content = content.split(r.from).join(r.to);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(htmlAbs, content, 'utf8');
    console.log(`updated: ${toPosix(path.relative(rootDir, htmlAbs))}`);
  }
}

function main() {
  if (!fs.existsSync(publicDir)) {
    console.error(`public dir not found: ${publicDir}`);
    process.exit(1);
  }

  const htmlRoots = [publicDir];
  if (fs.existsSync(privateCoursesDir)) {
    htmlRoots.push(privateCoursesDir);
  }
  const htmlFiles = htmlRoots
    .flatMap((dir) => walkFiles(dir))
    .filter((f) => f.endsWith('.html'));
  htmlFiles.forEach(processHtmlFile);
  console.log('fingerprint complete');
}

main();
