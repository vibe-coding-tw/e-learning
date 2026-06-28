import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: () => ({
      orderBy: () => ({
        get: async () => ({ docs: [] }),
      }),
    }),
  }),
}), { virtual: true });

const accessUtils = await import('../access-utils-core.js');

const {
  assertAuthenticated,
  assertRequiredValue,
  isAdminEmail,
  isStarterCourseCategory,
  isStarterCourseReference,
  nowIsoTimestamp,
  normalizeEmail,
  normalizeText,
  resolveRegistrationTimestampMs,
} = accessUtils;

describe('normalize helpers', () => {
  it('trims and lowercases email values', () => {
    expect(normalizeEmail('  Foo@Example.com  ')).toBe('foo@example.com');
    expect(normalizeText('  hello  ')).toBe('hello');
  });
});

describe('auth assertions', () => {
  it('throws unauthenticated when auth is missing', () => {
    expect(() => assertAuthenticated(null)).toThrowError(/請先登入/);
  });

  it('throws invalid-argument for missing required values', () => {
    expect(() => assertRequiredValue('')).toThrowError(/缺少必要參數/);
  });
});

describe('role and course helpers', () => {
  it('recognizes admin email', () => {
    expect(isAdminEmail('rover.k.chen@gmail.com')).toBe(true);
    expect(isAdminEmail('user@example.com')).toBe(false);
  });

  it('recognizes starter course categories and references', () => {
    expect(isStarterCourseCategory('starter')).toBe(true);
    expect(isStarterCourseCategory('car-starter')).toBe(true);
    expect(isStarterCourseReference('tw-car-starter-lesson.html')).toBe(true);
    expect(isStarterCourseReference('car-basic-lesson.html')).toBe(false);
  });
});

describe('timestamps', () => {
  it('returns an ISO timestamp string', () => {
    expect(nowIsoTimestamp()).toMatch(/T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('resolves the latest registration timestamp from multiple fields', () => {
    const ts = resolveRegistrationTimestampMs({
      createdAt: { toMillis: () => 1000 },
      joinedAt: { seconds: 3 },
    });
    expect(ts).toBe(3000);
  });

  it('returns 0 when no timestamp is available', () => {
    expect(resolveRegistrationTimestampMs({}, '')).toBe(0);
  });
});
