#!/usr/bin/env node

const { execSync } = require('node:child_process');

const PROJECT_ID = 'e-learning-942f7';
const DATABASE_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getAccessToken() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function api(path = '') {
  const token = getAccessToken();
  const response = await fetch(`${DATABASE_ROOT}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return response.json();
}

function decodeValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return undefined;
}

function decodeFields(fields = {}) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = decodeValue(value);
  }
  return result;
}

async function listCollection(collectionId) {
  let pageToken = '';
  const documents = [];

  while (true) {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const res = await api(`/${collectionId}?pageSize=1000${tokenParam}`);
    documents.push(...(res.documents || []));
    if (!res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }

  return documents;
}

function normalizeTeacherIdentifier(value) {
  return typeof value === 'string' ? value.replace(/_DOT_/g, '.') : value;
}

function isUnitLikeId(value) {
  return typeof value === 'string' && /unit-/.test(value);
}

function isCanonicalOrAlias(value, canonicalUnits) {
  if (!value || typeof value !== 'string') return false;
  if (canonicalUnits.has(value)) return true;
  if (canonicalUnits.has(`${value}.html`)) return true;
  if (value.startsWith('start-') && canonicalUnits.has(value.replace(/^start-/, ''))) return true;
  if (!value.startsWith('start-') && canonicalUnits.has(`start-${value}`)) return true;
  return false;
}

function summarize(title, items) {
  console.log(`\n${title}: ${items.length}`);
  items.slice(0, 50).forEach(item => console.log(`  - ${item}`));
  if (items.length > 50) console.log(`  ... and ${items.length - 50} more`);
}

async function main() {
  const lessonsDocs = await listCollection('metadata_lessons');
  const lessons = lessonsDocs.map(doc => decodeFields(doc.fields || {}));
  const canonicalUnits = new Set(
    lessons.flatMap(lesson => Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [])
  );
  const canonicalCourses = new Set(lessons.map(lesson => lesson.courseId));

  const courseConfigDocs = await listCollection('course_configs');
  const userDocs = await listCollection('users');
  const assignmentDocs = await listCollection('assignments');
  const promoCodeDocs = await listCollection('promo_codes');

  const findings = {
    malformedCourseConfigKeys: [],
    sanitizedTeacherKeys: [],
    malformedTeacherDetailFields: [],
    teacherArrayDetailMismatches: [],
    nonCanonicalUserUnitAssignments: [],
    nonCanonicalAssignmentUnitIds: [],
    nonCanonicalPromoCourseIds: []
  };

  for (const doc of courseConfigDocs) {
    const docId = doc.name.split('/').pop();
    const data = decodeFields(doc.fields || {});

    for (const rawFieldName of Object.keys(doc.fields || {})) {
      if (rawFieldName.includes('teacherDetails.') || rawFieldName.includes('_DOT_')) {
        findings.malformedTeacherDetailFields.push(`course_configs/${docId}: ${rawFieldName}`);
      }
    }

    const teacherDetails = data.teacherDetails || {};
    for (const teacherKey of Object.keys(teacherDetails)) {
      if (teacherKey.includes('_DOT_')) {
        findings.sanitizedTeacherKeys.push(`course_configs/${docId}.teacherDetails.${teacherKey}`);
      }
    }

    const authorizedTeachers = Array.isArray(data.authorizedTeachers) ? data.authorizedTeachers.map(normalizeTeacherIdentifier) : [];
    const teacherDetailEmails = Object.values(teacherDetails)
      .map(entry => normalizeTeacherIdentifier(entry?.email))
      .filter(Boolean);
    const teacherSet = new Set(authorizedTeachers);
    const detailSet = new Set(teacherDetailEmails);
    const missingInDetails = authorizedTeachers.filter(email => !detailSet.has(email));
    const missingInArray = teacherDetailEmails.filter(email => !teacherSet.has(email));
    if (missingInDetails.length || missingInArray.length) {
      findings.teacherArrayDetailMismatches.push(
        `course_configs/${docId}: missingInDetails=[${missingInDetails.join(', ')}], missingInArray=[${missingInArray.join(', ')}]`
      );
    }

    const githubClassroomUrls = data.githubClassroomUrls || {};
    for (const [unitKey, teacherMap] of Object.entries(githubClassroomUrls)) {
      if (isUnitLikeId(unitKey) && !isCanonicalOrAlias(unitKey, canonicalUnits)) {
        findings.malformedCourseConfigKeys.push(`course_configs/${docId}.githubClassroomUrls.${unitKey}`);
      }

      if (teacherMap && typeof teacherMap === 'object' && !Array.isArray(teacherMap)) {
        for (const teacherKey of Object.keys(teacherMap)) {
          if (teacherKey.includes('_DOT_')) {
            findings.sanitizedTeacherKeys.push(`course_configs/${docId}.githubClassroomUrls.${unitKey}.${teacherKey}`);
          }
          if (teacherKey === 'html') {
            findings.malformedCourseConfigKeys.push(`course_configs/${docId}.githubClassroomUrls.${unitKey}.html`);
          }
        }
      }
    }

    if (isUnitLikeId(docId) && !isCanonicalOrAlias(docId, canonicalUnits)) {
      findings.malformedCourseConfigKeys.push(`course_configs/${docId} (docId)`);
    }
  }

  for (const doc of userDocs) {
    const docId = doc.name.split('/').pop();
    const data = decodeFields(doc.fields || {});
    const unitAssignments = data.unitAssignments || {};
    for (const unitKey of Object.keys(unitAssignments)) {
      if (isUnitLikeId(unitKey) && !isCanonicalOrAlias(unitKey, canonicalUnits)) {
        findings.nonCanonicalUserUnitAssignments.push(`users/${docId}.unitAssignments.${unitKey}`);
      }
    }
  }

  for (const doc of assignmentDocs) {
    const docId = doc.name.split('/').pop();
    const data = decodeFields(doc.fields || {});
    if (isUnitLikeId(data.unitId) && !isCanonicalOrAlias(data.unitId, canonicalUnits)) {
      findings.nonCanonicalAssignmentUnitIds.push(`assignments/${docId}: ${data.unitId}`);
    }
  }

  for (const doc of promoCodeDocs) {
    const docId = doc.name.split('/').pop();
    const data = decodeFields(doc.fields || {});
    const courseId = data.courseId;
    if (isUnitLikeId(courseId) && !isCanonicalOrAlias(courseId, canonicalUnits)) {
      findings.nonCanonicalPromoCourseIds.push(`promo_codes/${docId}: ${courseId}`);
    }
    if (typeof courseId === 'string' && !isUnitLikeId(courseId) && !canonicalCourses.has(courseId)) {
      findings.nonCanonicalPromoCourseIds.push(`promo_codes/${docId}: ${courseId}`);
    }
  }

  console.log(`Loaded ${lessons.length} lessons.`);
  console.log(`Canonical course ids: ${canonicalCourses.size}`);
  console.log(`Canonical unit ids: ${canonicalUnits.size}`);

  summarize('Malformed course_config unit keys', findings.malformedCourseConfigKeys);
  summarize('Sanitized teacher keys', findings.sanitizedTeacherKeys);
  summarize('Malformed top-level teacher detail fields', findings.malformedTeacherDetailFields);
  summarize('Teacher array/detail mismatches', findings.teacherArrayDetailMismatches);
  summarize('Non-canonical users.unitAssignments keys', findings.nonCanonicalUserUnitAssignments);
  summarize('Non-canonical assignments.unitId values', findings.nonCanonicalAssignmentUnitIds);
  summarize('Non-canonical promo_codes.courseId values', findings.nonCanonicalPromoCourseIds);
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
