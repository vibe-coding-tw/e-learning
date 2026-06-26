import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  normalizeAmount,
  normalizeCurrency,
  normalizeLocale,
  readPriceEntry,
  resolveCartPrice,
  resolveLessonPrice,
} from '../pricing-utils';

describe('normalizeLocale', () => {
  it('defaults to en for empty input', () => {
    expect(normalizeLocale()).toBe('en');
    expect(normalizeLocale('')).toBe('en');
  });

  it('returns zh-TW for zh prefix', () => {
    expect(normalizeLocale('zh-TW')).toBe('zh-TW');
    expect(normalizeLocale('zh-CN')).toBe('zh-TW');
    expect(normalizeLocale('zh')).toBe('zh-TW');
  });

  it('returns zh-TW for tw variants', () => {
    expect(normalizeLocale('tw')).toBe('zh-TW');
    expect(normalizeLocale('TW')).toBe('zh-TW');
  });

  it('returns en for non-zh locales', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('ja-JP')).toBe('en');
  });
});

describe('normalizeCurrency', () => {
  it('normalizes known currencies', () => {
    expect(normalizeCurrency('NTD')).toBe('TWD');
    expect(normalizeCurrency('twd')).toBe('TWD');
    expect(normalizeCurrency('usd')).toBe('USD');
    expect(normalizeCurrency('hkd')).toBe('HKD');
    expect(normalizeCurrency('jpy')).toBe('JPY');
    expect(normalizeCurrency('cny')).toBe('CNY');
  });

  it('returns uppercase for unknown currencies', () => {
    expect(normalizeCurrency('eur')).toBe('EUR');
    expect(normalizeCurrency('gbp')).toBe('GBP');
  });

  it('uses fallback when raw is empty', () => {
    expect(normalizeCurrency('', 'TWD')).toBe('TWD');
    expect(normalizeCurrency('', '')).toBe('');
  });

  it('returns empty string when both are empty', () => {
    expect(normalizeCurrency()).toBe('');
  });
});

describe('normalizeAmount', () => {
  it('returns number as-is', () => {
    expect(normalizeAmount(100)).toBe(100);
    expect(normalizeAmount(0)).toBe(0);
    expect(normalizeAmount(99.99)).toBe(99.99);
  });

  it('parses string numbers', () => {
    expect(normalizeAmount('100')).toBe(100);
    expect(normalizeAmount('99.99')).toBe(99.99);
  });

  it('returns 0 for invalid values', () => {
    expect(normalizeAmount('abc')).toBe(0);
    expect(normalizeAmount(null)).toBe(0);
    expect(normalizeAmount(undefined)).toBe(0);
    expect(normalizeAmount(NaN)).toBe(0);
  });
});

describe('readPriceEntry', () => {
  it('returns null for null/undefined', () => {
    expect(readPriceEntry(null)).toBeNull();
    expect(readPriceEntry(undefined)).toBeNull();
  });

  it('wraps primitive number', () => {
    const result = readPriceEntry(100, 'USD');
    expect(result.amount).toBe(100);
    expect(result.currency).toBe('USD');
  });

  it('wraps string number', () => {
    const result = readPriceEntry('99.99', 'TWD');
    expect(result.amount).toBe(99.99);
    expect(result.currency).toBe('TWD');
  });

  it('reads from object with amount field', () => {
    const result = readPriceEntry({ amount: 200, currency: 'USD' });
    expect(result.amount).toBe(200);
    expect(result.currency).toBe('USD');
  });

  it('reads from object with price field', () => {
    const result = readPriceEntry({ price: 150, isoCurrency: 'TWD' });
    expect(result.amount).toBe(150);
    expect(result.currency).toBe('TWD');
  });

  it('prefers amount over price', () => {
    const result = readPriceEntry({ amount: 100, price: 200 });
    expect(result.amount).toBe(100);
  });

  it('uses fallback currency', () => {
    const result = readPriceEntry({ amount: 50 }, 'JPY');
    expect(result.currency).toBe('JPY');
  });

  it('returns null for non-object, non-number', () => {
    expect(readPriceEntry(true)).toBeNull();
    expect(readPriceEntry([])).toBeNull();
  });
});

describe('resolveLessonPrice', () => {
  it('returns dealer price when present', () => {
    const result = resolveLessonPrice({ dealerPrice: 500, dealerCurrency: 'TWD' });
    expect(result.amount).toBe(500);
    expect(result.currency).toBe('TWD');
    expect(result.hasPriceData).toBe(true);
    expect(result.source).toBe('dealer_price');
  });

  it('uses currency hint when dealerCurrency missing', () => {
    const result = resolveLessonPrice({ dealerPrice: 300 }, 'USD');
    expect(result.amount).toBe(300);
    expect(result.currency).toBe('USD');
  });

  it('returns no price data when dealerPrice absent', () => {
    const result = resolveLessonPrice({ title: 'Free Lesson' });
    expect(result.amount).toBe(null);
    expect(result.hasPriceData).toBe(false);
  });

  it('handles empty string dealerPrice', () => {
    const result = resolveLessonPrice({ dealerPrice: '' });
    expect(result.hasPriceData).toBe(false);
  });
});

describe('resolveCartPrice', () => {
  it('uses explicit price and currency', () => {
    const result = resolveCartPrice({ price: 250, price_currency: 'TWD' });
    expect(result.amount).toBe(250);
    expect(result.currency).toBe('TWD');
    expect(result.source).toBe('cart:snapshot');
  });

  it('falls back to legacy source', () => {
    const result = resolveCartPrice({ price: 100 });
    expect(result.amount).toBe(100);
    expect(result.source).toBe('cart:legacy');
  });
});

describe('formatPrice', () => {
  it('returns Free for zero amount in English', () => {
    expect(formatPrice({ amount: 0 }, 'en-US')).toBe('Free');
  });

  it('returns 免費 for zero amount in Chinese', () => {
    expect(formatPrice({ amount: 0 }, 'zh-TW')).toBe('免費');
  });

  it('formats TWD without decimals', () => {
    const result = formatPrice({ amount: 1500, currency: 'TWD' }, 'zh-TW');
    expect(result).toMatch(/1,500/);
  });

  it('formats USD with decimals', () => {
    const result = formatPrice({ amount: 29.99, currency: 'USD' }, 'en-US');
    expect(result).toMatch(/\$/);
  });

  it('handles plain number input', () => {
    expect(formatPrice(0)).toBe('免費');
  });
});
