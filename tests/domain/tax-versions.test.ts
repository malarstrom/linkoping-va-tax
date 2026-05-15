import { describe, expect, it } from 'vitest';
import { assertDisjointTaxVersions, findTaxVersion, getDefaultTaxVersionId, seedTaxVersions } from '../../src/domain/tax-versions';
import type { TaxVersion } from '../../src/domain/types';

describe('tax versions', () => {
  it('accepts the seeded disjoint validity intervals', () => {
    expect(() => assertDisjointTaxVersions(seedTaxVersions)).not.toThrow();
  });

  it('throws when validity intervals overlap', () => {
    const overlapping: TaxVersion[] = [
      {
        ...seedTaxVersions[0],
        validFrom: '2026-01-01',
        validTo: '2026-06-30',
      },
      {
        ...seedTaxVersions[1],
        validFrom: '2026-06-15',
        validTo: '2026-08-31',
      },
    ];

    expect(() => assertDisjointTaxVersions(overlapping)).toThrow(/överlappar/);
  });

  it('returns the default and explicit version ids', () => {
    expect(getDefaultTaxVersionId(seedTaxVersions)).toBe(seedTaxVersions[0].id);
    expect(findTaxVersion(seedTaxVersions, seedTaxVersions[1].id)?.label).toBe(seedTaxVersions[1].label);
    expect(findTaxVersion(seedTaxVersions, 'missing')).toBeNull();
  });
});
