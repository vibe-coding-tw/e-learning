const { execSync } = require('child_process');

const PROJECT_ID = 'e-learning-942f7';
const DATABASE_ROOT = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function getAccessToken() {
    return execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
}

async function api(path = '', options = {}) {
    const token = getAccessToken();
    const url = `${DATABASE_ROOT}${path}`;
    const response = await fetch(url, {
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
    if (Array.isArray(value)) {
        return { arrayValue: { values: value.map(encodeValue) } };
    }
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
    const fields = {};
    for (const [key, value] of Object.entries(obj)) {
        fields[key] = encodeValue(value);
    }
    return fields;
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

function getLegacyToCanonicalMap(lessons) {
    const map = new Map();
    const suffixToCanonical = new Map();

    for (const lesson of lessons) {
        const courseUnits = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        for (const canonicalUnitId of courseUnits) {
            const match = canonicalUnitId.match(/^start-(0[1-5]-unit-.+)$/);
            if (match) {
                map.set(match[1], canonicalUnitId);

                const suffixMatch = canonicalUnitId.match(/^start-\d+-unit-(.+)$/);
                if (suffixMatch) {
                    suffixToCanonical.set(suffixMatch[1], canonicalUnitId);
                }
            }
        }
    }

    return { directMap: map, suffixToCanonical };
}

function resolveCanonicalUnitId(legacyId, mapping) {
    if (!legacyId) return null;
    if (mapping.directMap.has(legacyId)) return mapping.directMap.get(legacyId);

    const suffixMatch = legacyId.match(/^\d+-unit-(.+)$/);
    if (suffixMatch && mapping.suffixToCanonical.has(suffixMatch[1])) {
        return mapping.suffixToCanonical.get(suffixMatch[1]);
    }

    return null;
}

function mergeTeacherDetails(existingDetails = {}, incomingDetails = {}) {
    return { ...existingDetails, ...incomingDetails };
}

function mergeGithubClassroomUnitConfig(existingValue, incomingValue) {
    if (typeof existingValue === 'object' && existingValue !== null &&
        typeof incomingValue === 'object' && incomingValue !== null) {
        return { ...existingValue, ...incomingValue };
    }

    return incomingValue !== undefined ? incomingValue : existingValue;
}

async function patchDocument(collectionId, docId, data, fieldPaths) {
    const params = fieldPaths.map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
    return api(`/${collectionId}/${encodeURIComponent(docId)}?${params}`, {
        method: 'PATCH',
        body: JSON.stringify({
            fields: encodeFields(data)
        })
    });
}

async function deleteDocument(collectionId, docId) {
    return api(`/${collectionId}/${encodeURIComponent(docId)}`, {
        method: 'DELETE'
    });
}

async function main() {
    const dryRun = !process.argv.includes('--apply');
    console.log(dryRun ? 'DRY RUN: no writes will be made.' : 'APPLY MODE: writing changes.');

    const lessonsDocs = await listCollection('metadata_lessons');
    const lessons = lessonsDocs.map(doc => decodeFields(doc.fields || {}));
    const legacyMapping = getLegacyToCanonicalMap(lessons);

    console.log(`Loaded ${lessons.length} lessons.`);
    console.log(`Found ${legacyMapping.directMap.size} direct legacy->canonical unit mappings.`);

    const courseConfigDocs = await listCollection('course_configs');
    const docsById = new Map(courseConfigDocs.map(doc => {
        const docId = doc.name.split('/').pop();
        return [docId, decodeFields(doc.fields || {})];
    }));

    const planned = {
        mergeUnitDocs: [],
        rewriteCourseConfigKeys: [],
        rewriteUserUnitAssignments: [],
        rewriteAssignments: [],
        rewritePromoCodes: [],
        unmatchedLegacyLikeKeys: []
    };

    for (const [legacyId, canonicalId] of legacyMapping.directMap.entries()) {
        if (docsById.has(legacyId)) {
            planned.mergeUnitDocs.push({ legacyId, canonicalId });
        }
    }

    for (const [docId, data] of docsById.entries()) {
        const githubClassroomUrls = data.githubClassroomUrls || {};
        const rewrites = [];

        for (const [legacyId, canonicalId] of legacyMapping.directMap.entries()) {
            if (Object.prototype.hasOwnProperty.call(githubClassroomUrls, legacyId)) {
                rewrites.push({ legacyId, canonicalId });
            }
        }

        if (rewrites.length > 0) {
            planned.rewriteCourseConfigKeys.push({ docId, rewrites });
        }
    }

    const userDocs = await listCollection('users');
    for (const doc of userDocs) {
        const docId = doc.name.split('/').pop();
        const data = decodeFields(doc.fields || {});
        const unitAssignments = data.unitAssignments || {};
        const rewrites = [];

        for (const legacyId of Object.keys(unitAssignments)) {
            const canonicalId = resolveCanonicalUnitId(legacyId, legacyMapping);
            if (canonicalId && canonicalId !== legacyId) {
                rewrites.push({ legacyId, canonicalId });
            } else if (/^0[1-5]-unit-/.test(legacyId)) {
                planned.unmatchedLegacyLikeKeys.push(`users/${docId}: ${legacyId}`);
            }
        }

        if (rewrites.length > 0) {
            planned.rewriteUserUnitAssignments.push({ docId, unitAssignments, rewrites });
        }
    }

    const assignmentDocs = await listCollection('assignments');
    for (const doc of assignmentDocs) {
        const docId = doc.name.split('/').pop();
        const data = decodeFields(doc.fields || {});
        const legacyId = data.unitId;
        const canonicalId = resolveCanonicalUnitId(legacyId, legacyMapping);
        if (canonicalId && canonicalId !== legacyId) {
            planned.rewriteAssignments.push({ docId, legacyId, canonicalId });
        } else if (legacyId && /^0[1-5]-unit-/.test(legacyId)) {
            planned.unmatchedLegacyLikeKeys.push(`assignments/${docId}: ${legacyId}`);
        }
    }

    const promoCodeDocs = await listCollection('promo_codes');
    for (const doc of promoCodeDocs) {
        const docId = doc.name.split('/').pop();
        const data = decodeFields(doc.fields || {});
        const legacyId = data.courseId;
        const canonicalId = resolveCanonicalUnitId(legacyId, legacyMapping);
        if (canonicalId && canonicalId !== legacyId) {
            planned.rewritePromoCodes.push({ docId, legacyId, canonicalId });
        } else if (legacyId && /^0[1-5]-unit-/.test(legacyId)) {
            planned.unmatchedLegacyLikeKeys.push(`promo_codes/${docId}: ${legacyId}`);
        }
    }

    console.log(`Will merge ${planned.mergeUnitDocs.length} legacy unit docs.`);
    planned.mergeUnitDocs.forEach(item => console.log(`  doc ${item.legacyId} -> ${item.canonicalId}`));

    console.log(`Will rewrite ${planned.rewriteCourseConfigKeys.length} course_config docs with legacy githubClassroomUrls keys.`);
    planned.rewriteCourseConfigKeys.forEach(item => {
        console.log(`  doc ${item.docId}: ${item.rewrites.map(r => `${r.legacyId} -> ${r.canonicalId}`).join(', ')}`);
    });

    console.log(`Will rewrite ${planned.rewriteUserUnitAssignments.length} users docs with legacy unitAssignments keys.`);
    planned.rewriteUserUnitAssignments.forEach(item => {
        console.log(`  user ${item.docId}: ${item.rewrites.map(r => `${r.legacyId} -> ${r.canonicalId}`).join(', ')}`);
    });

    console.log(`Will rewrite ${planned.rewriteAssignments.length} assignments docs with legacy unitId.`);
    planned.rewriteAssignments.forEach(item => {
        console.log(`  assignment ${item.docId}: ${item.legacyId} -> ${item.canonicalId}`);
    });

    console.log(`Will rewrite ${planned.rewritePromoCodes.length} promo_codes docs with legacy courseId.`);
    planned.rewritePromoCodes.forEach(item => {
        console.log(`  promo ${item.docId}: ${item.legacyId} -> ${item.canonicalId}`);
    });

    if (planned.unmatchedLegacyLikeKeys.length > 0) {
        console.log(`Found ${planned.unmatchedLegacyLikeKeys.length} legacy-like keys without a canonical mapping:`);
        planned.unmatchedLegacyLikeKeys.forEach(item => console.log(`  ${item}`));
    }

    if (dryRun) {
        console.log('Dry run complete.');
        return;
    }

    for (const { legacyId, canonicalId } of planned.mergeUnitDocs) {
        const legacyData = docsById.get(legacyId) || {};
        const canonicalData = docsById.get(canonicalId) || {};

        const mergedAuthorizedTeachers = Array.from(new Set([
            ...(canonicalData.authorizedTeachers || []),
            ...(legacyData.authorizedTeachers || [])
        ]));

        const mergedTeacherDetails = mergeTeacherDetails(
            canonicalData.teacherDetails || {},
            legacyData.teacherDetails || {}
        );

        await patchDocument('course_configs', canonicalId, {
            authorizedTeachers: mergedAuthorizedTeachers,
            teacherDetails: mergedTeacherDetails,
            migratedFromLegacyKey: legacyId
        }, ['authorizedTeachers', 'teacherDetails', 'migratedFromLegacyKey']);

        await deleteDocument('course_configs', legacyId);
        console.log(`Merged unit doc ${legacyId} -> ${canonicalId}`);
    }

    for (const { docId, rewrites } of planned.rewriteCourseConfigKeys) {
        const data = docsById.get(docId) || {};
        const githubClassroomUrls = { ...(data.githubClassroomUrls || {}) };

        for (const { legacyId, canonicalId } of rewrites) {
            const legacyValue = githubClassroomUrls[legacyId];
            const canonicalValue = githubClassroomUrls[canonicalId];
            githubClassroomUrls[canonicalId] = mergeGithubClassroomUnitConfig(canonicalValue, legacyValue);
            delete githubClassroomUrls[legacyId];
        }

        await patchDocument('course_configs', docId, {
            githubClassroomUrls
        }, ['githubClassroomUrls']);

        console.log(`Rewrote legacy githubClassroomUrls keys in ${docId}`);
    }

    for (const { docId, unitAssignments, rewrites } of planned.rewriteUserUnitAssignments) {
        const mergedAssignments = { ...unitAssignments };

        for (const { legacyId, canonicalId } of rewrites) {
            if (!(canonicalId in mergedAssignments) || mergedAssignments[canonicalId] == null) {
                mergedAssignments[canonicalId] = mergedAssignments[legacyId];
            }
            delete mergedAssignments[legacyId];
        }

        await patchDocument('users', docId, {
            unitAssignments: mergedAssignments
        }, ['unitAssignments']);

        console.log(`Rewrote legacy unitAssignments keys in users/${docId}`);
    }

    for (const { docId, canonicalId } of planned.rewriteAssignments) {
        await patchDocument('assignments', docId, {
            unitId: canonicalId
        }, ['unitId']);

        console.log(`Rewrote legacy unitId in assignments/${docId}`);
    }

    for (const { docId, canonicalId } of planned.rewritePromoCodes) {
        await patchDocument('promo_codes', docId, {
            courseId: canonicalId
        }, ['courseId']);

        console.log(`Rewrote legacy courseId in promo_codes/${docId}`);
    }

    console.log('Migration complete.');
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
