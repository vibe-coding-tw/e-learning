const { normalizeLegacyId, unitIdsMatch } = require('./lib/id-utils');

function normalizeText(value = '') {
    return String(value || '').trim();
}

function normalizeEmail(value = '') {
    return normalizeText(value).toLowerCase();
}

function fallbackNameFromEmail(email, defaultName = '使用者') {
    const normalized = normalizeEmail(email);
    if (!normalized || !normalized.includes('@')) return defaultName;
    return normalized.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveNameFromUserData(userData = {}, email = '', authDisplayName = '') {
    return normalizeText(userData.name || userData.displayName || authDisplayName || fallbackNameFromEmail(email) || email || '使用者');
}

function normalizeCourseFile(value = '') {
    if (!value) return value;
    const filePart = String(value).split('/').pop().split('?')[0];
    return filePart;
}

function normalizeLocale(locale = '') {
    const raw = normalizeText(locale || '');
    if (!raw) return '';
    if (/^zh[-_]tw$/i.test(raw)) return 'zh-TW';
    if (/^zh/i.test(raw)) return 'zh-TW';
    if (/^en/i.test(raw)) return 'en';
    return raw;
}

function normalizeCourseVariantKey(value = '') {
    const filePart = normalizeCourseFile(value);
    if (!filePart) return '';
    const bare = String(filePart)
        .replace(/\.html$/i, '')
        .replace(/^(?:tw|en)-/i, '')
        .toLowerCase();

    if (/^start-\d{2}-unit-/i.test(bare)) return bare.replace(/^start-\d{2}-unit-/i, 'car-starter-');
    if (/^basic-\d{2}-unit-/i.test(bare)) return bare.replace(/^basic-\d{2}-unit-/i, 'car-basic-');
    if (/^(?:adv|advanced)-\d{2}-unit-/i.test(bare)) return bare.replace(/^(?:adv|advanced)-\d{2}-unit-/i, 'car-advanced-');
    if (/^\d{2}-unit-/i.test(bare)) return bare.replace(/^\d{2}-unit-/i, 'common-');
    if (/^prepare-\d+-(.+)$/i.test(bare)) return bare.replace(/^prepare-\d+-/, 'common-');
    return bare;
}

function cleanUnitId(unitId) {
    if (!unitId) return '';
    return normalizeText(unitId)
        .toLowerCase()
        .replace(/\.html$/, '')
        .replace(/^(?:tw-(?:common|car-(?:starter|basic|advanced))-|start-|basic-|adv-|advanced-|prepare-)?(?:\d{2}-)?(?:unit-|lesson-|master-)?/i, '');
}

function normalizeLookupValue(value = '') {
    return String(value || '').split('/').pop().split('?')[0].replace(/\.html$/i, '').toLowerCase();
}

function normalizeCanonicalCourseKey(value = '') {
    return normalizeCourseFile(value)
        .replace(/\.html$/i, '')
        .replace(/^(?:tw|en)-/i, '');
}

function isPhysicalMetadataLesson(lesson = {}) {
    const metadataType = String(lesson.metadataType || '').toLowerCase();
    return metadataType === 'product' || metadataType === 'legacy_product';
}

function getCanonicalLessonIdentity(lesson = {}) {
    if (!lesson || typeof lesson !== 'object') return '';
    if (isPhysicalMetadataLesson(lesson)) {
        return String(
            lesson.docId ||
            lesson.courseKey ||
            lesson.courseId ||
            lesson.id ||
            ''
        ).trim();
    }
    return String(
        normalizeCanonicalCourseKey(lesson.courseKey) ||
        normalizeCanonicalCourseKey(lesson.contentRef) ||
        normalizeCanonicalCourseKey(lesson.courseId) ||
        normalizeCanonicalCourseKey(lesson.entryUnitId) ||
        normalizeCanonicalCourseKey(lesson.id) ||
        lesson.docId ||
        ''
    ).trim();
}

function resolveCanonicalUnitId(unitId, lessons = []) {
    if (!unitId) return unitId;
    let mappedUnitId = unitId;
    const cleanId = cleanUnitId(mappedUnitId);

    let resolved = mappedUnitId;
    for (const lesson of lessons) {
        const courseUnits = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        if (courseUnits.includes(mappedUnitId)) {
            resolved = mappedUnitId;
            break;
        }

        const matchedUnit = courseUnits.find(courseUnit => cleanUnitId(courseUnit) === cleanId);
        if (matchedUnit) {
            resolved = matchedUnit;
            break;
        }
    }

    let canonical = resolved;
    if (/^(?:tw|en)-/i.test(canonical)) {
        canonical = canonical.replace(/^(?:tw|en)-/i, '');
    }
    if (/^start-\d{2}-unit-/i.test(canonical)) {
        canonical = canonical.replace(/^start-\d{2}-unit-/i, 'car-starter-');
    } else if (/^start-/i.test(canonical)) {
        canonical = canonical.replace(/^start-/i, 'car-starter-');
    }

    return canonical;
}

function canonicalizeLessonForDashboard(lesson = {}, lessons = []) {
    if (!lesson || typeof lesson !== 'object') return lesson;
    const courseUnits = Array.isArray(lesson.courseUnits)
        ? lesson.courseUnits.map((unitId) => resolveCanonicalUnitId(unitId, lessons) || unitId)
        : lesson.courseUnits;

    return {
        ...lesson,
        ...(Array.isArray(courseUnits) ? { courseUnits } : {}),
        ...(lesson.entryUnitId ? {
            entryUnitId: resolveCanonicalUnitId(lesson.entryUnitId, lessons) || lesson.entryUnitId
        } : {})
    };
}

function findParentCourseIdByUnit(unitId, lessons = []) {
    if (!unitId) return null;
    const lesson = findCourseByUnitId(unitId, lessons);
    return lesson ? (getCanonicalLessonIdentity(lesson) || null) : null;
}

function findCourseByUnitId(unitId, lessons = []) {
    if (!unitId) return null;
    const canonicalUnitId = resolveCanonicalUnitId(unitId, lessons);
    return lessons.find((lesson) => {
        const units = Array.isArray(lesson.courseUnits) ? lesson.courseUnits : [];
        return units.some((candidateUnitId) =>
            unitIdsMatch(candidateUnitId, canonicalUnitId) ||
            normalizeLookupValue(candidateUnitId) === normalizeLookupValue(canonicalUnitId)
        );
    }) || null;
}

function findCourseByPageOrUnit(pageId, fileName, lessons = []) {
    const normalizedPageId = normalizeCourseFile(pageId);
    const normalizedFileName = normalizeCourseFile(fileName);
    const normalizedPageIdNoHtml = normalizedPageId.replace(/\.html$/i, '');
    const normalizedFileNameNoHtml = normalizedFileName.replace(/\.html$/i, '');

    return lessons.find(l => {
        const lessonCourseId = String(l.courseId || '');
        const lessonCourseIdNoHtml = lessonCourseId.replace(/\.html$/i, '');
        const units = Array.isArray(l.courseUnits) ? l.courseUnits : [];
        const unitMatch = units.some(unit => {
            const normalizedUnit = normalizeCourseFile(String(unit || ''));
            return unitIdsMatch(normalizedUnit, normalizedFileName) ||
                unitIdsMatch(normalizedUnit, normalizedFileNameNoHtml) ||
                unitIdsMatch(normalizedUnit, normalizedPageId) ||
                unitIdsMatch(normalizedUnit, normalizedPageIdNoHtml);
        });

        const legacyLessonUrl = l.classroomUrl;
        const assignmentUnitMatch = !!(legacyLessonUrl && (
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedFileName) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedFileNameNoHtml) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedPageId) ||
            unitIdsMatch(normalizeCourseFile(legacyLessonUrl), normalizedPageIdNoHtml)
        ));

        return unitIdsMatch(lessonCourseId, pageId) ||
            unitIdsMatch(lessonCourseId, normalizedPageId) ||
            unitIdsMatch(lessonCourseIdNoHtml, normalizedPageIdNoHtml) ||
            unitMatch ||
            assignmentUnitMatch;
    }) || null;
}

function getLessonLookupKeys(lesson = {}) {
    const keys = new Set();
    const add = (value) => {
        if (!value) return;
        const raw = normalizeText(value);
        if (!raw) return;
        keys.add(raw);
        keys.add(raw.replace(/\.html$/i, ''));
        keys.add(normalizeLookupValue(raw));
    };

    add(lesson.id);
    add(lesson.courseId);
    add(lesson.courseKey);
    add(normalizeCanonicalCourseKey(lesson.courseKey));
    add(normalizeCanonicalCourseKey(lesson.contentRef));
    add(lesson.entryUnitId);
    add(lesson.classroomUrl);
    add(lesson.docId);
    add(lesson.sku);

    if (Array.isArray(lesson.aliases)) lesson.aliases.forEach(add);
    if (Array.isArray(lesson.courseUnits)) lesson.courseUnits.forEach(add);

    return keys;
}

function findLessonByCourseRef(courseRef = '', lessons = []) {
    if (!courseRef) return null;
    const candidates = new Set([
        normalizeText(courseRef || ''),
        normalizeText(courseRef || '').replace(/\.html$/i, ''),
        normalizeLookupValue(courseRef),
        cleanUnitId(courseRef)
    ].filter(Boolean));

    return lessons.find((lesson) => {
        const keys = getLessonLookupKeys(lesson);
        for (const candidate of candidates) {
            if (keys.has(candidate)) return true;
        }
        return false;
    }) || null;
}

function normalizeAssignmentTutorValue(value = '') {
    if (!value) return '';
    if (typeof value === 'string') return value.trim().toLowerCase();
    if (typeof value === 'object') {
        return String(
            value.email ||
            value.tutorEmail ||
            value.referredTutorEmail ||
            value.referralTutor ||
            value.tutor ||
            value.value ||
            ''
        ).trim().toLowerCase();
    }
    return String(value).trim().toLowerCase();
}

function resolveStudentEmailLabel(usersMap = {}, uid, fallbackPrefix = 'Unknown Student', record = {}) {
    const studentInfo = usersMap[uid] || {};
    return studentInfo.email || record.userEmail || record.studentEmail || (uid ? `${fallbackPrefix}: ${String(uid).slice(0, 8)}` : fallbackPrefix);
}

function ensureStudentStatsEntry(studentStats, sid, userData = {}, options = {}) {
    const {
        accountStatus = 'free',
        includeOrderRecords = false
    } = options;

    if (!studentStats[sid]) {
        studentStats[sid] = {
            uid: sid,
            email: userData.email || 'Unknown',
            name: userData.name || '',
            role: userData.role || 'user',
            totalTime: 0,
            videoTime: 0,
            docTime: 0,
            pageTime: 0,
            lastActive: null,
            courseProgress: {},
            unitAssignments: userData.unitAssignments || {},
            orders: []
        };

        if (accountStatus !== null) {
            studentStats[sid].accountStatus = accountStatus;
        }
        if (includeOrderRecords) {
            studentStats[sid].orderRecords = [];
        }
    } else {
        if (!studentStats[sid].unitAssignments) {
            studentStats[sid].unitAssignments = userData.unitAssignments || {};
        }
        if (accountStatus !== null) {
            studentStats[sid].accountStatus = accountStatus;
        }
        if (includeOrderRecords && !studentStats[sid].orderRecords) {
            studentStats[sid].orderRecords = [];
        }
    }

    return studentStats[sid];
}

function ensureCourseProgressBucket(studentStatsEntry, cid, options = {}) {
    if (!studentStatsEntry.courseProgress) studentStatsEntry.courseProgress = {};
    if (!studentStatsEntry.courseProgress[cid]) {
        studentStatsEntry.courseProgress[cid] = {
            total: 0,
            video: 0,
            doc: 0,
            page: 0,
            logs: []
        };
    }
    if (options.isLicenseOnly) {
        studentStatsEntry.courseProgress[cid].isLicenseOnly = true;
    }
    return studentStatsEntry.courseProgress[cid];
}

function appendCourseProgressActivity(studentStatsEntry, cid, log = {}) {
    const cp = ensureCourseProgressBucket(studentStatsEntry, cid);
    const duration = log.duration || 0;

    cp.total += duration;
    if (log.action === 'VIDEO') cp.video += duration;
    if (log.action === 'DOC') cp.doc += duration;
    if (log.action === 'PAGE_VIEW') cp.page += duration;

    cp.logs.push({
        action: log.action,
        duration,
        timestamp: log.timestamp,
        metadata: log.metadata
    });

    return cp;
}

function buildDashboardReferenceEntry(usersMap = {}, uid, baseData = {}, fallbackPrefix = 'Unknown Student') {
    const studentInfo = usersMap[uid] || {};
    return {
        ...baseData,
        studentEmail: resolveStudentEmailLabel(usersMap, uid, fallbackPrefix, baseData),
        studentName: studentInfo.name || baseData.studentName || '',
        studentUid: uid || baseData.studentUid || ''
    };
}

function shouldIncludeDashboardUser(role = '', requesterRole = 'user') {
    const normalizedRole = role || 'user';
    return requesterRole === 'admin' || normalizedRole === 'user' || !normalizedRole;
}

function addDashboardUserEntry(usersMap, docId, userData = {}, requesterRole = 'user') {
    const role = userData.role || 'user';
    if (!shouldIncludeDashboardUser(role, requesterRole)) return false;
    usersMap[docId] = { ...userData, role, _id: docId };
    return true;
}

function buildTutorList(usersMap = {}) {
    return Object.entries(usersMap).reduce((list, [uid, data]) => {
        const role = data.role || 'user';
        if (role === 'admin' || hasQualifiedTutorStatus(data)) {
            list.push({
                uid,
                email: data.email || 'No Email',
                name: data.name || 'Anonymous',
                role,
                tutorConfigs: data.tutorConfigs || {}
            });
        }
        return list;
    }, []);
}

function buildStudentAssignmentTutorRows(usersMap = {}, lessons = []) {
    const tutorIndexByEmail = new Map();
    Object.entries(usersMap).forEach(([uid, data]) => {
        const email = normalizeEmail(data?.email || '');
        if (email) {
            tutorIndexByEmail.set(email, {
                uid,
                email,
                name: data?.name || '',
                role: data?.role || 'user'
            });
        }
    });

    const rows = [];
    Object.entries(usersMap).forEach(([studentUid, studentData]) => {
        const role = studentData?.role || 'user';
        if (role === 'admin' || hasQualifiedTutorStatus(studentData)) return;

        const unitAssignments = studentData?.unitAssignments || {};
        Object.entries(unitAssignments).forEach(([rawUnitId, rawTutorEmail]) => {
            const tutorEmail = normalizeAssignmentTutorValue(rawTutorEmail);
            if (!rawUnitId || !tutorEmail) return;

            const canonicalUnitId = resolveCanonicalUnitId(rawUnitId, lessons) || rawUnitId;
            const unitMeta = findLessonByCourseRef(canonicalUnitId, lessons)
                || findCourseByUnitId(canonicalUnitId, lessons)
                || null;
            const parentCourseId = findParentCourseIdByUnit(canonicalUnitId, lessons) || unitMeta?.courseId || '';
            const parentCourse = parentCourseId ? findLessonByCourseRef(parentCourseId, lessons) : null;
            const tutor = tutorIndexByEmail.get(tutorEmail) || null;

            rows.push({
                studentUid,
                studentEmail: studentData?.email || '',
                studentName: studentData?.name || '',
                studentRole: role,
                unitId: canonicalUnitId,
                unitTitle: unitMeta?.title || unitMeta?.courseName || unitMeta?.name || canonicalUnitId,
                courseId: parentCourseId,
                courseTitle: parentCourse?.title || parentCourse?.courseName || parentCourse?.name || parentCourseId,
                tutorEmail,
                tutorName: tutor?.name || '',
                tutorRole: tutor?.role || '',
                tutorUid: tutor?.uid || '',
                tutorFound: !!tutor
            });
        });
    });

    rows.sort((a, b) => {
        const studentCmp = String(a.studentEmail || a.studentUid || '').localeCompare(String(b.studentEmail || b.studentUid || ''));
        if (studentCmp !== 0) return studentCmp;
        const courseCmp = String(a.courseTitle || a.courseId || '').localeCompare(String(b.courseTitle || b.courseId || ''));
        if (courseCmp !== 0) return courseCmp;
        return String(a.unitTitle || a.unitId || '').localeCompare(String(b.unitTitle || b.unitId || ''));
    });

    return rows;
}

function buildDashboardSummary(students = []) {
    const registeredUserStats = students;
    const paidStudentStats = students.filter(s => s.accountStatus === 'paid' && (s.role === 'user' || !s.role));
    return {
        totalStudents: registeredUserStats.length,
        totalPaidStudents: paidStudentStats.length,
        totalHours: paidStudentStats.reduce((acc, curr) => acc + curr.totalTime, 0) / 3600
    };
}

function finalizeHardwareOrders(hardwareOrders = []) {
    const sorted = [...hardwareOrders].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
    const pendingShipments = sorted.filter(order => order.fulfillmentStatus !== 'SHIPPED');
    return {
        hardwareOrders: sorted,
        pendingShipments,
        pendingShipmentsCount: pendingShipments.length
    };
}

function extractHiddenSectionContent(html, sectionId) {
    if (!html || !sectionId) return '';

    const openTagRegex = new RegExp(`<section\\b[^>]*\\bid=["']${sectionId}["'][^>]*>`, 'i');
    const openMatch = openTagRegex.exec(html);
    if (!openMatch) return '';

    const sectionStart = openMatch.index;
    const tagContentStart = sectionStart + openMatch[0].length;

    let depth = 1;
    const sectionTagRegex = /<\/?section\b[^>]*>/gi;
    sectionTagRegex.lastIndex = tagContentStart;

    let match;
    while ((match = sectionTagRegex.exec(html)) !== null) {
        const tag = match[0];
        if (!tag.startsWith('</')) {
            depth++;
        } else {
            depth--;
            if (depth === 0) {
                return html.slice(tagContentStart, match.index).trim();
            }
        }
    }

    return '';
}

function normalizeAssignmentTutorValue(value = '') {
    return normalizeText(value).toLowerCase();
}

function hasQualifiedTutorStatus(userData = {}, unitId = '') {
    const tutorConfigs = userData.tutorConfigs || {};
    if (unitId) {
        return !!(tutorConfigs[unitId] && tutorConfigs[unitId].authorized === true);
    }
    return Object.values(tutorConfigs).some(config => config && config.authorized === true);
}

function getTutorAssignmentUrlFromConfig(cfg = {}, course = null, canonicalUnitId = '', tutorEmail = '', lessons = []) {
    cfg = cfg || {};
    const directUrl = normalizeText(cfg.assignmentUrl || cfg.legacyAssignmentUrl || cfg.githubClassroomUrl || '');
    if (directUrl) return directUrl;

    const courseAssignmentMap = course?.assignmentUrlMap?.[canonicalUnitId];
    if (courseAssignmentMap) {
        if (typeof courseAssignmentMap === 'string') return courseAssignmentMap;
        const normalizedTutorEmail = normalizeEmail(tutorEmail);
        if (normalizedTutorEmail && typeof courseAssignmentMap === 'object') {
            return courseAssignmentMap[normalizedTutorEmail] || courseAssignmentMap[tutorEmail] || '';
        }
    }

    return '';
}

module.exports = {
    normalizeText,
    normalizeEmail,
    fallbackNameFromEmail,
    resolveNameFromUserData,
    normalizeCourseFile,
    normalizeLocale,
    normalizeCourseVariantKey,
    cleanUnitId,
    normalizeLookupValue,
    normalizeCanonicalCourseKey,
    getCanonicalLessonIdentity,
    resolveCanonicalUnitId,
    canonicalizeLessonForDashboard,
    findParentCourseIdByUnit,
    findCourseByUnitId,
    findCourseByPageOrUnit,
    findLessonByCourseRef,
    resolveStudentEmailLabel,
    ensureStudentStatsEntry,
    ensureCourseProgressBucket,
    appendCourseProgressActivity,
    buildDashboardReferenceEntry,
    shouldIncludeDashboardUser,
    addDashboardUserEntry,
    buildTutorList,
    buildStudentAssignmentTutorRows,
    buildDashboardSummary,
    finalizeHardwareOrders,
    extractHiddenSectionContent,
    normalizeAssignmentTutorValue,
    hasQualifiedTutorStatus,
    getTutorAssignmentUrlFromConfig
};
