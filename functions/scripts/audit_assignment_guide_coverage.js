#!/usr/bin/env node
/**
 * Audit assignment-guide coverage across live metadata_lessons and content-repo course files.
 *
 * Usage:
 *   node functions/scripts/audit_assignment_guide_coverage.js
 *   node functions/scripts/audit_assignment_guide_coverage.js --out=report.json
 *   node functions/scripts/audit_assignment_guide_coverage.js --content-root=/path/to/content-repo/courses
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "e-learning-942f7"
  });
}

const db = admin.firestore();
const DEFAULT_CONTENT_ROOT = "/Users/roverchen/Documents/Apps/content-repo/courses";

function parseArgs(argv) {
  const out = {
    contentRoot: DEFAULT_CONTENT_ROOT,
    reportPath: ""
  };
  for (const token of argv.slice(2)) {
    if (token.startsWith("--content-root=")) {
      out.contentRoot = token.slice("--content-root=".length).trim() || DEFAULT_CONTENT_ROOT;
    } else if (token.startsWith("--out=")) {
      out.reportPath = token.slice("--out=".length).trim();
    }
  }
  return out;
}

function normalizeFile(value = "") {
  return String(value || "").split("/").pop().split("?")[0].trim();
}

function normalizeLookup(value = "") {
  return normalizeFile(value).replace(/\.html$/i, "").toLowerCase();
}

function cleanId(value = "") {
  return String(value || "").trim().replace(/\.html$/i, "").toLowerCase();
}

function walkHtmlFiles(rootDir, out = []) {
  if (!fs.existsSync(rootDir)) return out;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkHtmlFiles(fullPath, out);
    } else if (entry.isFile() && fullPath.endsWith(".html")) {
      out.push(fullPath);
    }
  }
  return out;
}

function extractSectionExists(html, sectionId) {
  return new RegExp(`<section\\b[^>]*\\bid=["']${sectionId}["'][^>]*>`, "i").test(html);
}

function getLessonLookupKeys(lesson = {}) {
  const keys = new Set();
  const add = (value) => {
    if (!value) return;
    const raw = String(value).trim();
    if (!raw) return;
    keys.add(raw);
    keys.add(raw.replace(/\.html$/i, ""));
    keys.add(normalizeLookup(raw));
    keys.add(cleanId(raw));
  };
  const addContentRefVariants = (value) => {
    if (!value) return;
    const raw = normalizeFile(value);
    if (!raw) return;
    add(raw);
    add(raw.replace(/^tw-/, ""));
    add(raw.replace(/^en-/, ""));
  };

  add(lesson.id);
  add(lesson.courseId);
  add(lesson.courseKey);
  add(lesson.contentRef);
  addContentRefVariants(lesson.contentRef);
  add(lesson.entryUnitId);
  add(lesson.classroomUrl);
  add(lesson.productId);
  add(lesson.sku);
  if (Array.isArray(lesson.productIds)) lesson.productIds.forEach(add);
  if (Array.isArray(lesson.legacyProductIds)) lesson.legacyProductIds.forEach(add);
  if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
  if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);
  return keys;
}

function resolveLessonByFile(fileName, lessons = []) {
  if (!fileName) return null;
  const candidates = new Set([
    fileName,
    fileName.replace(/\.html$/i, ""),
    normalizeLookup(fileName),
    cleanId(fileName)
  ]);
  return lessons.find((lesson) => {
    const keys = getLessonLookupKeys(lesson);
    for (const candidate of candidates) {
      if (keys.has(candidate)) return true;
    }
    return false;
  }) || null;
}

function getActiveLessonIdentity(lesson = {}) {
  return String(
    lesson.courseKey ||
    lesson.courseId ||
    lesson.productId ||
    lesson.id ||
    ""
  ).trim();
}

function getLessonContentPaths(lesson = {}) {
  const paths = new Set();
  const add = (value) => {
    if (!value) return;
    const raw = normalizeFile(value);
    if (!raw) return;
    paths.add(raw);
    paths.add(raw.replace(/^tw-/, ""));
    paths.add(raw.replace(/^en-/, ""));
  };
  add(lesson.courseId);
  add(lesson.entryUnitId);
  add(lesson.courseKey);
  add(lesson.contentRef);
  add(normalizeFile(lesson.contentRef));
  add(normalizeFile(lesson.contentRef).replace(/^tw-/, ""));
  add(normalizeFile(lesson.contentRef).replace(/^en-/, ""));
  add(lesson.id);
  if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);
  return Array.from(paths);
}

async function main() {
  const args = parseArgs(process.argv);
  const lessonsSnap = await db.collection("metadata_lessons").get();
  const lessons = lessonsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  const htmlFiles = walkHtmlFiles(args.contentRoot);

  const lessonByIdentity = new Map();
  lessons.forEach((lesson) => {
    const id = getActiveLessonIdentity(lesson);
    if (id) lessonByIdentity.set(id, lesson);
  });

  const fileMatches = [];
  const unmatchedFiles = [];
  const matchedLessonIds = new Set();

  for (const filePath of htmlFiles) {
    const rel = path.relative(args.contentRoot, filePath).replace(/\\/g, "/");
    const fileName = normalizeFile(rel);
    const lesson = resolveLessonByFile(fileName, lessons);
    const html = fs.readFileSync(filePath, "utf8");
    const hasAssignmentGuide = extractSectionExists(html, "assignment-guide");

    if (lesson) {
      const lessonIdentity = getActiveLessonIdentity(lesson);
      if (lessonIdentity) matchedLessonIds.add(lessonIdentity);
      fileMatches.push({
        file: rel,
        lessonId: lesson.id,
        courseId: lesson.courseId || "",
        courseKey: lesson.courseKey || "",
        title: lesson.title || "",
        hasAssignmentGuide
      });
    } else {
      unmatchedFiles.push({
        file: rel,
        hasAssignmentGuide
      });
    }
  }

  const activeLessonsMissingContent = lessons
    .filter((lesson) => {
      const identity = getActiveLessonIdentity(lesson);
      return identity && !matchedLessonIds.has(identity);
    })
    .map((lesson) => ({
      lessonId: lesson.id,
      courseId: lesson.courseId || "",
      courseKey: lesson.courseKey || "",
      title: lesson.title || "",
      expectedPaths: getLessonContentPaths(lesson)
    }));

  const matchedWithMissingGuide = fileMatches.filter((row) => !row.hasAssignmentGuide);

  const report = {
    generatedAt: new Date().toISOString(),
    contentRoot: args.contentRoot,
    metadataLessonsCount: lessons.length,
    htmlFilesCount: htmlFiles.length,
    matchedFilesCount: fileMatches.length,
    unmatchedFilesCount: unmatchedFiles.length,
    matchedButMissingAssignmentGuideCount: matchedWithMissingGuide.length,
    activeLessonsMissingContentCount: activeLessonsMissingContent.length,
    matchedButMissingAssignmentGuide: matchedWithMissingGuide,
    unmatchedFiles,
    activeLessonsMissingContent
  };

  console.log(JSON.stringify({
    contentRoot: report.contentRoot,
    metadataLessonsCount: report.metadataLessonsCount,
    htmlFilesCount: report.htmlFilesCount,
    matchedFilesCount: report.matchedFilesCount,
    unmatchedFilesCount: report.unmatchedFilesCount,
    matchedButMissingAssignmentGuideCount: report.matchedButMissingAssignmentGuideCount,
    activeLessonsMissingContentCount: report.activeLessonsMissingContentCount
  }, null, 2));

  if (args.reportPath) {
    fs.writeFileSync(args.reportPath, JSON.stringify(report, null, 2));
    console.log(`report written: ${args.reportPath}`);
  }
}

main().catch((err) => {
  console.error("[ERROR]", err.message || err);
  process.exit(1);
});
