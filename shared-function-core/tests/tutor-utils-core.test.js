import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  assertTutorApplicationState,
  buildTutorApplicationLegacyEntry,
  buildTutorApplicationRecord,
  buildTutorConfigEntry,
  buildTutorConfigEntry: buildTutorConfigEntryAlias,
  fallbackNameFromEmail,
  generatePromotionCode,
  getEffectiveTutorConfig,
  getPreferredAssignmentUrl,
  getUserTutorConfig,
  hasAnyQualifiedTutorStatus,
  hasQualifiedTutorStatus,
  normalizeEmail,
  normalizeText,
  resolveAssignmentUrlMaps,
  resolveNameFromUserData,
  upsertTutorApplicationLegacyEntry,
} = require('../tutor-utils.js');

describe('name and email helpers', () => {
  it('builds a fallback name from email', () => {
    expect(fallbackNameFromEmail('john.doe@example.com')).toBe('John Doe');
    expect(resolveNameFromUserData({ displayName: 'Alice' }, 'alice@example.com')).toBe('Alice');
    expect(normalizeEmail('  Tutor@Example.com  ')).toBe('tutor@example.com');
    expect(normalizeText('  Tutor  ')).toBe('Tutor');
  });
});

describe('promotion code', () => {
  it('generates uppercase codes with the expected minimum length', () => {
    const code = generatePromotionCode(6);
    expect(code).toMatch(/^[A-Z2-9]+$/);
    expect(code.length).toBe(6);
  });
});

describe('application helpers', () => {
  it('builds application records and legacy entries', () => {
    const record = buildTutorApplicationRecord({ userId: 'u1', unitId: 'unit-1', source: 'form' });
    expect(record.userId).toBe('u1');
    expect(record.source).toBe('form');

    const legacy = buildTutorApplicationLegacyEntry('app-1', { userId: 'u1', source: 'form' });
    expect(legacy.applicationId).toBe('app-1');
    expect(legacy.source).toBe('form');
  });

  it('upserts legacy applications by id', () => {
    const result = upsertTutorApplicationLegacyEntry([{ applicationId: 'app-1', status: 'pending' }], 'app-1', { userId: 'u1' }, { status: 'approved' });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('approved');
  });

  it('asserts tutor application state', () => {
    expect(() => assertTutorApplicationState({ source: 'native', status: 'pending' }, { source: 'native', status: 'pending' })).not.toThrow();
    expect(() => assertTutorApplicationState({ source: 'native' }, { source: 'legacy' })).toThrow();
  });
});

describe('tutor config helpers', () => {
  it('builds tutor config entries and resolves assignment url maps', () => {
    const config = buildTutorConfigEntry({ email: 'Tutor@Example.com', name: 'Tutor One', assignmentUrl: 'https://example.com/a' });
    expect(config.email).toBe('tutor@example.com');
    expect(config.name).toBe('Tutor One');
    expect(getPreferredAssignmentUrl(config)).toBe('https://example.com/a');
    expect(resolveAssignmentUrlMaps({ assignmentUrlMap: { a: 1 } })).toEqual({ a: 1 });
    expect(resolveAssignmentUrlMaps({ githubClassroomUrls: { b: 2 } })).toEqual({ b: 2 });
    expect(buildTutorConfigEntryAlias({ email: 'x@example.com' }).email).toBe('x@example.com');
  });

  it('reads effective tutor config from direct and normalized keys', () => {
    const tutorConfigs = {
      'unit-1.html': { authorized: true, assignmentUrl: 'https://example.com/direct' },
      'unit-2': { authorized: false, html: { authorized: true, assignmentUrl: 'https://example.com/html' } },
    };
    expect(getEffectiveTutorConfig('unit-1.html', tutorConfigs)?.assignmentUrl).toBe('https://example.com/direct');
    expect(getUserTutorConfig({ tutorConfigs }, 'unit-1.html')?.assignmentUrl).toBe('https://example.com/direct');
    expect(hasQualifiedTutorStatus({ tutorConfigs }, 'unit-1.html')).toBe(true);
    expect(hasAnyQualifiedTutorStatus({ tutorConfigs })).toBe(true);
  });
});
