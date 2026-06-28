import { describe, it, expect } from 'vitest';
import { buildI18nFilenameCandidates, normalizeLegacyId, unitIdsMatch } from '../id-utils';

describe('buildI18nFilenameCandidates', () => {
  it('returns empty array for empty input', () => {
    expect(buildI18nFilenameCandidates('')).toEqual([]);
    expect(buildI18nFilenameCandidates(null)).toEqual([]);
    expect(buildI18nFilenameCandidates(undefined)).toEqual([]);
    expect(buildI18nFilenameCandidates('   ')).toEqual([]);
  });

  it('returns just the filename for non-.html files', () => {
    expect(buildI18nFilenameCandidates('lesson.pdf')).toEqual(['lesson.pdf']);
    expect(buildI18nFilenameCandidates('script.js')).toEqual(['script.js']);
  });

  it('returns just the filename when no locale', () => {
    expect(buildI18nFilenameCandidates('lesson.html')).toEqual(['lesson.html']);
  });

  it('adds tw- prefix for zh locale', () => {
    const result = buildI18nFilenameCandidates('lesson.html', 'zh-TW');
    expect(result).toContain('lesson.html');
    expect(result).toContain('tw-lesson.html');
  });

  it('adds en- prefix for en locale', () => {
    const result = buildI18nFilenameCandidates('lesson.html', 'en-US');
    expect(result).toContain('lesson.html');
    expect(result).toContain('en-lesson.html');
  });

  it('handles legacy tw- prefix (removes it, keeps original)', () => {
    const result = buildI18nFilenameCandidates('tw-lesson.html', 'zh-TW');
    expect(result).toContain('tw-lesson.html');
    expect(result).toContain('lesson.html');
  });

  it('handles legacy en- prefix', () => {
    const result = buildI18nFilenameCandidates('en-lesson.html', 'en-US');
    expect(result).toContain('en-lesson.html');
    expect(result).toContain('lesson.html');
  });

  it('maps start-N-unit-name to tw-car-starter-name for zh', () => {
    const result = buildI18nFilenameCandidates('start-1-unit-hello.html', 'zh-TW');
    expect(result).toContain('start-1-unit-hello.html');
    expect(result).toContain('tw-car-starter-hello.html');
  });

  it('maps start-N-unit-name to en-car-starter-name for en', () => {
    const result = buildI18nFilenameCandidates('start-1-unit-hello.html', 'en-US');
    expect(result).toContain('start-1-unit-hello.html');
    expect(result).toContain('en-car-starter-hello.html');
  });

  it('maps basic-N-unit-name to car-basic', () => {
    const result = buildI18nFilenameCandidates('basic-2-unit-world.html', 'zh-TW');
    expect(result).toContain('tw-car-basic-world.html');
  });

  it('maps adv-N-unit-name to car-advanced', () => {
    const result = buildI18nFilenameCandidates('adv-3-unit-foo.html', 'zh-TW');
    expect(result).toContain('tw-car-advanced-foo.html');
  });

  it('maps advanced-N-unit-name to car-advanced', () => {
    const result = buildI18nFilenameCandidates('advanced-1-unit-bar.html', 'zh-TW');
    expect(result).toContain('tw-car-advanced-bar.html');
  });

  it('maps N-unit-name to common', () => {
    const result = buildI18nFilenameCandidates('1-unit-lesson.html', 'zh-TW');
    expect(result).toContain('tw-common-lesson.html');
  });

  it('maps prepare-N-name to common', () => {
    const result = buildI18nFilenameCandidates('prepare-1-setup.html', 'zh-TW');
    expect(result).toContain('tw-common-setup.html');
  });

  it('maps tw-common-name to tw-common-name', () => {
    const result = buildI18nFilenameCandidates('tw-common-lesson.html', 'zh-TW');
    expect(result).toContain('tw-common-lesson.html');
  });

  it('maps en-car-starter-name appropriately', () => {
    const result = buildI18nFilenameCandidates('en-car-starter-hello.html', 'en-US');
    expect(result).toContain('en-car-starter-hello.html');
    expect(result).toContain('car-starter-hello.html');
  });

  it('overwrites locale prefix mismatch', () => {
    const result = buildI18nFilenameCandidates('en-common-lesson.html', 'zh-TW');
    expect(result).toContain('en-common-lesson.html');
    expect(result).toContain('tw-common-lesson.html');
  });
});

describe('unitIdsMatch', () => {
  it('returns true for identical ids', () => {
    expect(unitIdsMatch('hello', 'hello')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(unitIdsMatch('Hello', 'hello')).toBe(true);
  });

  it('strips .html extension', () => {
    expect(unitIdsMatch('lesson.html', 'lesson')).toBe(true);
    expect(unitIdsMatch('lesson', 'lesson.html')).toBe(true);
  });

  it('handles uppercase .HTML extension', () => {
    expect(unitIdsMatch('lesson.HTML', 'lesson')).toBe(true);
    expect(unitIdsMatch('lesson', 'lesson.HTML')).toBe(true);
  });

  it('returns false for null/undefined inputs', () => {
    expect(unitIdsMatch(null, 'hello')).toBe(false);
    expect(unitIdsMatch('hello', undefined)).toBe(false);
    expect(unitIdsMatch('', 'hello')).toBe(false);
  });

  it('returns false for different ids', () => {
    expect(unitIdsMatch('hello', 'world')).toBe(false);
  });
});

describe('normalizeLegacyId', () => {
  it('lowercases and strips .html', () => {
    expect(normalizeLegacyId('HelloWorld.html')).toBe('helloworld');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeLegacyId()).toBe('');
    expect(normalizeLegacyId(null)).toBe('');
  });

  it('lowercases without .html', () => {
    expect(normalizeLegacyId('HelloWorld')).toBe('helloworld');
  });
});
