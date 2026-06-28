import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  addDashboardUserEntry,
  buildDashboardReferenceEntry,
  buildDashboardSummary,
  buildStudentAssignmentTutorRows,
  buildTutorList,
  canonicalizeLessonForDashboard,
  ensureCourseProgressBucket,
  ensureStudentStatsEntry,
  extractHiddenSectionContent,
  finalizeHardwareOrders,
  findCourseByPageOrUnit,
  findCourseByUnitId,
  findLessonByCourseRef,
  getLessonLookupKeys,
  getTutorAssignmentUrlFromConfig,
  hasAnyQualifiedTutorStatus,
  hasQualifiedTutorStatus,
  normalizeAssignmentTutorValue,
  normalizeCourseVariantKey,
  resolveCanonicalUnitId,
  resolveNameFromUserData,
  resolveStudentEmailLabel,
  shouldIncludeDashboardUser,
} = require('../dashboard-utils-core.js');

describe('normalizeCourseVariantKey', () => {
  it('normalizes starter course filenames', () => {
    expect(normalizeCourseVariantKey('start-01-unit-html5-basics.html')).toBe('car-starter-html5-basics');
  });

  it('normalizes advanced and common course filenames', () => {
    expect(normalizeCourseVariantKey('advanced-03-unit-ui-architecture.html')).toBe('car-advanced-ui-architecture');
    expect(normalizeCourseVariantKey('01-unit-welcome.html')).toBe('common-welcome');
  });
});

describe('resolveCanonicalUnitId', () => {
  it('maps locale-prefixed starter units to canonical ids from lessons', () => {
    const lessons = [
      { courseUnits: ['car-starter-basics.html'] },
    ];
    expect(resolveCanonicalUnitId('tw-start-01-unit-basics.html', lessons)).toBe('car-starter-basics.html');
  });
});

describe('find helpers', () => {
  const lessons = [
    {
      id: 'course-1',
      title: 'Course One',
      courseId: 'course-1.html',
      courseUnits: ['unit-a.html', 'unit-b.html'],
      aliases: ['course-one'],
    },
  ];

  it('finds a lesson by course ref', () => {
    expect(findLessonByCourseRef('course-one', lessons)?.id).toBe('course-1');
  });

  it('finds a course by unit id', () => {
    expect(findCourseByUnitId('unit-a.html', lessons)?.id).toBe('course-1');
  });

  it('finds a course by page or unit', () => {
    expect(findCourseByPageOrUnit('unit-a.html', 'unit-a.html', lessons)?.id).toBe('course-1');
  });
});

describe('student stats helpers', () => {
  it('creates a new student stats entry with optional order records', () => {
    const stats = {};
    const entry = ensureStudentStatsEntry(stats, 'uid-1', { email: 'a@example.com', name: 'Alice' }, { includeOrderRecords: true });
    expect(entry.email).toBe('a@example.com');
    expect(entry.orderRecords).toEqual([]);
    expect(stats['uid-1']).toBe(entry);
  });

  it('creates a course progress bucket and marks license-only', () => {
    const entry = ensureStudentStatsEntry({}, 'uid-1');
    const bucket = ensureCourseProgressBucket(entry, 'course-1', { isLicenseOnly: true });
    expect(bucket.isLicenseOnly).toBe(true);
  });
});

describe('assignment and tutor helpers', () => {
  const lessons = [
    { id: 'course-1', title: 'Course One', courseUnits: ['unit-a.html'] },
  ];
  const usersMap = {
    tutor1: { uid: 'tutor1', email: 'tutor@example.com', name: 'Tutor One', role: 'user', tutorConfigs: { 'unit-a.html': { authorized: true } } },
    student1: { email: 'student@example.com', name: 'Student One', role: 'user', unitAssignments: { 'unit-a.html': 'Tutor@Example.com' } },
  };

  it('normalizes assignment tutor values', () => {
    expect(normalizeAssignmentTutorValue(' Tutor@Example.com ')).toBe('tutor@example.com');
  });

  it('detects qualified tutor status', () => {
    expect(hasQualifiedTutorStatus(usersMap.tutor1, 'unit-a.html')).toBe(true);
    expect(hasAnyQualifiedTutorStatus(usersMap.tutor1)).toBe(true);
  });

  it('builds tutor list and student assignment tutor rows', () => {
    expect(buildTutorList(usersMap)).toHaveLength(1);
    const rows = buildStudentAssignmentTutorRows(usersMap, lessons);
    expect(rows).toHaveLength(1);
    expect(rows[0].tutorFound).toBe(true);
    expect(rows[0].unitId).toBe('unit-a.html');
  });
});

describe('dashboard summary and records', () => {
  it('builds dashboard summary from paid students only', () => {
    const summary = buildDashboardSummary([
      { accountStatus: 'paid', role: 'user', totalTime: 3600 },
      { accountStatus: 'free', role: 'user', totalTime: 7200 },
    ]);
    expect(summary.totalStudents).toBe(2);
    expect(summary.totalPaidStudents).toBe(1);
    expect(summary.totalHours).toBe(1);
  });

  it('sorts hardware orders newest first and counts pending shipments', () => {
    const result = finalizeHardwareOrders([
      { paidAt: '2024-01-01T00:00:00Z', fulfillmentStatus: 'PENDING' },
      { paidAt: '2024-02-01T00:00:00Z', fulfillmentStatus: 'SHIPPED' },
    ]);
    expect(result.hardwareOrders[0].paidAt).toBe('2024-02-01T00:00:00Z');
    expect(result.pendingShipmentsCount).toBe(1);
  });
});

describe('misc helpers', () => {
  it('extracts hidden section content', () => {
    const html = '<section id="secret"><p>hidden</p></section><section id="public"></section>';
    expect(extractHiddenSectionContent(html, 'secret')).toBe('<p>hidden</p>');
  });

  it('returns assignment url aliases and reference entry labels', () => {
    expect(getTutorAssignmentUrlFromConfig({ assignmentUrl: 'https://example.com/a' })).toBe('https://example.com/a');
    expect(resolveStudentEmailLabel({ uid1: { email: 'student@example.com' } }, 'uid1')).toBe('student@example.com');
    expect(resolveNameFromUserData({ displayName: 'Alice' }, 'alice@example.com')).toBe('Alice');
    expect(buildDashboardReferenceEntry({ uid1: { name: 'Alice', email: 'a@example.com' } }, 'uid1', { studentUid: 'uid1' }).studentName).toBe('Alice');
    expect(shouldIncludeDashboardUser('user', 'user')).toBe(true);
    expect(addDashboardUserEntry({}, 'uid1', { role: 'user' }, 'user')).toBe(true);
  });

  it('returns canonical lesson lookup keys', () => {
    const keys = getLessonLookupKeys({ id: 'course-1', courseId: 'course-1.html', courseUnits: ['unit-a.html'] });
    expect(keys.has('course-1')).toBe(true);
    expect(keys.has('unit-a')).toBe(true);
  });

  it('canonicalizes lessons without losing course units', () => {
    const lesson = canonicalizeLessonForDashboard({ entryUnitId: 'tw-start-01-unit-basics.html', courseUnits: ['tw-start-01-unit-basics.html'] }, [
      { courseUnits: ['car-starter-basics.html'] },
    ]);
    expect(lesson.entryUnitId).toBe('car-starter-basics.html');
  });
});
