import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  chooseRecommendedDistributor,
  collectDistributorRegions,
  distributorMatchesRegion,
  normalizeRoutingRegionCode,
} = require('../routing-utils-core.js');

describe('normalizeRoutingRegionCode', () => {
  it('normalizes locale and currency aliases', () => {
    expect(normalizeRoutingRegionCode('zh-TW')).toBe('TW');
    expect(normalizeRoutingRegionCode('usd')).toBe('US');
    expect(normalizeRoutingRegionCode('jp')).toBe('JP');
  });
});

describe('distributorMatchesRegion', () => {
  it('matches a distributor by normalized region', () => {
    expect(distributorMatchesRegion({ regions: ['tw', 'us'] }, 'zh-TW')).toBe(true);
    expect(distributorMatchesRegion({ regions: ['us'] }, 'TW')).toBe(false);
  });
});

describe('collectDistributorRegions', () => {
  it('collects unique normalized regions', () => {
    const result = collectDistributorRegions([
      { regions: ['tw', 'us'] },
      { regions: ['zh-TW', 'jp'] },
    ]);
    expect(result).toEqual(['JP', 'TW', 'US']);
  });
});

describe('chooseRecommendedDistributor', () => {
  const distributors = [
    { id: 'dist-tw', status: 'ACTIVE', regions: ['TW'] },
    { id: 'dist-us', status: 'ACTIVE', regions: ['US'] },
    { id: 'dist-inactive', status: 'INACTIVE', regions: ['TW'] },
  ];

  it('prefers explicit distributor when active', () => {
    const result = chooseRecommendedDistributor(distributors, { preferredDistributorId: 'dist-us', regionCode: 'TW' });
    expect(result.distributor.id).toBe('dist-us');
    expect(result.reason).toBe('preferred-distributor');
  });

  it('chooses region default before backups', () => {
    const result = chooseRecommendedDistributor(distributors, { regionCode: 'TW', ruleDefaultDistributorId: 'dist-tw' });
    expect(result.distributor.id).toBe('dist-tw');
    expect(result.reason).toBe('region-default');
  });

  it('falls back to first active distributor when no region match exists', () => {
    const result = chooseRecommendedDistributor(distributors, { regionCode: 'CA' });
    expect(result.distributor.id).toBe('dist-tw');
    expect(result.reason).toBe('first-active-distributor');
  });
});
