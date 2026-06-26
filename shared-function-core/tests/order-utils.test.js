import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  normalizeGitHubUrl,
  normalizeLookupValue,
  isPhysicalMetadataLesson,
  isPhysicalOrderItem,
  getPhysicalUnitIdSet,
  toMillis,
  toIsoTimestamp,
  normalizeLogisticsData,
  buildShippingContact,
  buildShippingAddress,
  buildReferralLinkDocId,
  hasActiveOrderForCourse,
  itemContainsUnit,
} from '../order-utils';

describe('normalizeText', () => {
  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});

describe('normalizeGitHubUrl', () => {
  it('lowercases and removes trailing slash', () => {
    expect(normalizeGitHubUrl('HTTPS://GITHUB.COM/Foo/')).toBe('https://github.com/foo');
  });

  it('returns empty for empty input', () => {
    expect(normalizeGitHubUrl('')).toBe('');
  });
});

describe('normalizeLookupValue', () => {
  it('extracts filename from path, strips .html, lowercases', () => {
    expect(normalizeLookupValue('/courses/Lesson.html')).toBe('lesson');
  });

  it('strips query string', () => {
    expect(normalizeLookupValue('Lesson.html?v=1')).toBe('lesson');
  });

  it('handles simple value', () => {
    expect(normalizeLookupValue('HelloWorld')).toBe('helloworld');
  });
});

describe('isPhysicalMetadataLesson', () => {
  it('returns true for product type', () => {
    expect(isPhysicalMetadataLesson({ metadataType: 'product' })).toBe(true);
  });

  it('returns true for legacy_product type', () => {
    expect(isPhysicalMetadataLesson({ metadataType: 'legacy_product' })).toBe(true);
  });

  it('returns false for course type', () => {
    expect(isPhysicalMetadataLesson({ metadataType: 'course' })).toBe(false);
  });

  it('returns false for missing metadataType', () => {
    expect(isPhysicalMetadataLesson({})).toBe(false);
  });
});

describe('getPhysicalUnitIdSet', () => {
  it('collects ids from physical lessons', () => {
    const lessons = [
      { id: 'prod-1', metadataType: 'product' },
      { id: 'prod-2', metadataType: 'legacy_product' },
      { id: 'course-1', metadataType: 'course' },
    ];
    const set = getPhysicalUnitIdSet(lessons);
    expect(set.has('prod-1')).toBe(true);
    expect(set.has('prod-2')).toBe(true);
    expect(set.has('course-1')).toBe(false);
  });

  it('handles non-array input', () => {
    expect(getPhysicalUnitIdSet(null)).toEqual(new Set());
  });
});

describe('isPhysicalOrderItem', () => {
  it('returns true when itemData.isPhysical is true', () => {
    expect(isPhysicalOrderItem('item-1', { isPhysical: true })).toBe(true);
  });

  it('returns true when itemId is in physicalUnitIds', () => {
    expect(isPhysicalOrderItem('prod-1', {}, new Set(['prod-1']))).toBe(true);
  });

  it('returns false for non-physical item', () => {
    expect(isPhysicalOrderItem('course-1')).toBe(false);
  });
});

describe('toMillis', () => {
  it('handles Firestore Timestamp-like objects', () => {
    expect(toMillis({ toMillis: () => 1000 })).toBe(1000);
  });

  it('handles Date-like objects', () => {
    expect(toMillis({ toDate: () => new Date('2024-01-01') })).toBe(1704067200000);
  });

  it('handles Date instances', () => {
    expect(toMillis(new Date('2024-01-01'))).toBe(1704067200000);
  });

  it('handles numbers', () => {
    expect(toMillis(1000)).toBe(1000);
  });

  it('handles date strings', () => {
    expect(toMillis('2024-01-01')).toBe(1704067200000);
  });

  it('returns null for invalid values', () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis('not-a-date')).toBeNull();
  });
});

describe('toIsoTimestamp', () => {
  it('converts Date to ISO string', () => {
    expect(toIsoTimestamp(new Date('2024-01-01'))).toBe('2024-01-01T00:00:00.000Z');
  });

  it('returns string as-is', () => {
    expect(toIsoTimestamp('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00Z');
  });

  it('returns fallback for null', () => {
    expect(toIsoTimestamp(null, 'fallback')).toBe('fallback');
  });
});

describe('normalizeLogisticsData', () => {
  it('parses standard logistics fields', () => {
    const result = normalizeLogisticsData({
      receiverName: 'John',
      receiverPhone: '0912345678',
      storeAddress: '123 Main St',
    });
    expect(result.receiverName).toBe('John');
    expect(result.receiverPhone).toBe('0912345678');
    expect(result.shippingAddress).toBe('123 Main St');
    expect(result.isComplete).toBe(true);
  });

  it('handles international address', () => {
    const result = normalizeLogisticsData({
      receiverName: 'Jane',
      receiverPhone: '1234567890',
      isInternational: true,
      address: { country: 'US', city: 'NYC', line1: '5th Ave' },
    });
    expect(result.hasIntlAddress).toBeTruthy();
    expect(result.isComplete).toBe(true);
  });

  it('detects incomplete data', () => {
    const result = normalizeLogisticsData({ receiverName: 'John' });
    expect(result.isComplete).toBe(false);
  });
});

describe('buildShippingContact', () => {
  it('extracts name and phone', () => {
    const result = buildShippingContact({ receiverName: 'John', receiverPhone: '123' });
    expect(result.name).toBe('John');
    expect(result.phone).toBe('123');
  });
});

describe('buildShippingAddress', () => {
  it('extracts shipping address', () => {
    expect(buildShippingAddress({ storeAddress: 'Store 1' })).toBe('Store 1');
    expect(buildShippingAddress({ CVSAddress: 'CVS 1' })).toBe('CVS 1');
    expect(buildShippingAddress({ ReceiverAddress: 'Home' })).toBe('Home');
  });
});

describe('buildReferralLinkDocId', () => {
  it('creates base64 hash from normalized URL', () => {
    const result = buildReferralLinkDocId('https://github.com/foo/bar');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result.length).toBeLessThanOrEqual(24);
  });

  it('returns empty string for empty URL', () => {
    const result = buildReferralLinkDocId('');
    expect(result).toBe('');
  });
});

describe('itemContainsUnit', () => {
  const lessons = [
    { id: 'course-1', courseUnits: ['unit-1', 'unit-2'] },
  ];

  it('matches unit in lesson courseUnits', () => {
    const resolvers = {
      resolveLessonForOrderItem: (itemKey) => lessons.find(l => l.id === itemKey),
    };
    expect(itemContainsUnit('course-1', lessons, 'unit-1', resolvers)).toBe(true);
  });

  it('returns false for non-matching target', () => {
    const resolvers = {
      resolveLessonForOrderItem: (itemKey) => lessons.find(l => l.id === itemKey),
    };
    expect(itemContainsUnit('course-1', lessons, 'unit-99', resolvers)).toBe(false);
  });
});

describe('hasActiveOrderForCourse', () => {
  const lessons = [
    { id: 'course-1', courseUnits: ['unit-1'] },
  ];

  it('returns true when any item contains the unit', () => {
    const resolvers = {
      resolveLessonForOrderItem: (itemKey) => lessons.find(l => l.id === itemKey),
    };
    expect(hasActiveOrderForCourse({ 'course-1': {} }, lessons, 'unit-1', resolvers)).toBe(true);
  });

  it('returns false when no item contains the unit', () => {
    const resolvers = {
      resolveLessonForOrderItem: () => null,
    };
    expect(hasActiveOrderForCourse({ 'other': {} }, lessons, 'unit-1', resolvers)).toBe(false);
  });
});
