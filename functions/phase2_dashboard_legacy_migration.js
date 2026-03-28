#!/usr/bin/env node

const { execSync } = require('node:child_process');

const PROJECT_ID = 'e-learning-942f7';
const DATABASE_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const APPLY = process.argv.includes('--apply');

function getAccessToken() {
  return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function api(path = '', options = {}) {
  const token = getAccessToken();
  const response = await fetch(`${DATABASE_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return undefined;
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

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value) } };
  }
  return { stringValue: String(value) };
}

function encodeFields(obj = {}) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, encodeValue(v)]));
}

async function getDocument(collectionId, docId) {
  try {
    const doc = await api(`/${collectionId}/${encodeURIComponent(docId)}`);
    return decodeFields(doc.fields || {});
  } catch (error) {
    if (String(error.message).startsWith('404')) return null;
    throw error;
  }
}

async function patchDocument(collectionId, docId, data, fieldPaths) {
  const params = fieldPaths.map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
  return api(`/${collectionId}/${encodeURIComponent(docId)}?${params}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encodeFields(data) })
  });
}

async function deleteDocument(collectionId, docId) {
  return api(`/${collectionId}/${encodeURIComponent(docId)}`, { method: 'DELETE' });
}

function uniqueEmails(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function summarizeAction(action) {
  console.log(`- ${action.type}: ${action.description}`);
}

async function main() {
  const actions = [];

  const emptyLegacyDocs = [
    '00-unit-agent-mode.html',
    '00-unit-wifi-setup.html'
  ];

  for (const docId of emptyLegacyDocs) {
    const data = await getDocument('course_configs', docId);
    if (!data) continue;
    actions.push({
      type: 'delete_doc',
      description: `Delete legacy doc course_configs/${docId}`,
      run: async () => deleteDocument('course_configs', docId)
    });
  }

  const legacyHtml5 = await getDocument('course_configs', '02-unit-html5-basics.html');
  const canonicalHtml5Id = 'start-01-unit-html5-basics.html';
  const canonicalHtml5 = await getDocument('course_configs', canonicalHtml5Id);

  if (legacyHtml5) {
    const mergedAuthorizedTeachers = uniqueEmails([
      ...((canonicalHtml5 && canonicalHtml5.authorizedTeachers) || []),
      ...((legacyHtml5.authorizedTeachers) || [])
    ]);
    const mergedTeacherDetails = {
      ...((canonicalHtml5 && canonicalHtml5.teacherDetails) || {}),
      ...((legacyHtml5.teacherDetails) || {})
    };

    actions.push({
      type: canonicalHtml5 ? 'merge_doc' : 'create_doc',
      description: `${canonicalHtml5 ? 'Merge' : 'Create'} course_configs/${canonicalHtml5Id} from legacy 02-unit-html5-basics.html`,
      run: async () => patchDocument('course_configs', canonicalHtml5Id, {
        authorizedTeachers: mergedAuthorizedTeachers,
        teacherDetails: mergedTeacherDetails,
        githubClassroomUrls: (canonicalHtml5 && canonicalHtml5.githubClassroomUrls) || {},
        updatedAt: new Date().toISOString()
      }, ['authorizedTeachers', 'teacherDetails', 'githubClassroomUrls', 'updatedAt'])
    });

    actions.push({
      type: 'delete_doc',
      description: 'Delete legacy doc course_configs/02-unit-html5-basics.html',
      run: async () => deleteDocument('course_configs', '02-unit-html5-basics.html')
    });
  }

  const orphanTeacherPrunes = [
    '01-unit-vscode-online.html',
    '04-unit-agent-mode.html'
  ];

  for (const docId of orphanTeacherPrunes) {
    const data = await getDocument('course_configs', docId);
    if (!data) continue;
    const allowed = new Set((data.authorizedTeachers || []).filter(Boolean));
    const teacherDetails = data.teacherDetails || {};
    const prunedDetails = Object.fromEntries(
      Object.entries(teacherDetails).filter(([, value]) => allowed.has(value?.email))
    );
    const hadChange = JSON.stringify(prunedDetails) !== JSON.stringify(teacherDetails);
    if (!hadChange) continue;

    actions.push({
      type: 'prune_orphan_teacher_details',
      description: `Prune teacherDetails not present in authorizedTeachers for course_configs/${docId}`,
      run: async () => patchDocument('course_configs', docId, {
        teacherDetails: prunedDetails,
        updatedAt: new Date().toISOString()
      }, ['teacherDetails', 'updatedAt'])
    });
  }

  console.log(APPLY ? 'APPLY MODE' : 'DRY RUN');
  console.log(`Planned actions: ${actions.length}`);
  actions.forEach(summarizeAction);

  if (!APPLY) return;

  for (const action of actions) {
    await action.run();
    console.log(`Applied: ${action.description}`);
  }
}

main().catch(err => {
  console.error('Phase 2 migration failed:', err);
  process.exit(1);
});
