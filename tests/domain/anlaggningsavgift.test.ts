import { describe, expect, it } from 'vitest';
import { calculateAnlaggningsavgift } from '../../src/domain/anlaggningsavgift';
import { createEmptyProfile } from '../../src/domain/profile';
import { seedTaxVersions } from '../../src/domain/tax-versions';
import type { TaxVersion } from '../../src/domain/types';

function makeTaxVersion(overrides: Partial<TaxVersion['taxValues']> = {}, enabledRules: string[] = ['§5.1 a', '§5.1 b', '§5.1 c', '§5.1 d', '§5.1 e', '§5.5', '§5.6', '§5.7', '§5.8']) {
  return {
    ...seedTaxVersions[0],
    enabledRules,
    taxValues: {
      ...seedTaxVersions[0].taxValues,
      ...overrides,
    },
  } satisfies TaxVersion;
}

describe('anläggningsavgift', () => {
  it('caps tomtyteavgift and keeps calculated vs billed amounts separate', () => {
    const profile = createEmptyProfile();
    profile.tomtyta = '1';
    const taxVersion = makeTaxVersion({ tomtyteavgift: 100, tomtyteavgiftCap: 50 });
    const result = calculateAnlaggningsavgift(profile, taxVersion, {
      sharedConnectionCount: 1,
      samfollighet: false,
      addedServisledningar: 0,
      addedTomtyta: '',
      addedBostadsenheter: 0,
      dfWithoutConnection: false,
    });

    const line = result.lines.find((entry) => entry.id === 'line-tomtyta');
    expect(line).toBeTruthy();
    expect(line?.calculatedAmount).toBe(100);
    expect(line?.billedAmount).toBe(50);
    expect(result.total).toBeLessThan(result.calculatedTotal);
    expect(result.ruleTrace.join(' ')).toContain('§5.1 c');
  });

  it('skips disabled rules', () => {
    const profile = createEmptyProfile();
    const taxVersion = makeTaxVersion({}, ['§5.1 b', '§5.1 c', '§5.1 d', '§5.1 e']);
    const result = calculateAnlaggningsavgift(profile, taxVersion, {
      sharedConnectionCount: 1,
      samfollighet: false,
      addedServisledningar: 0,
      addedTomtyta: '',
      addedBostadsenheter: 0,
      dfWithoutConnection: false,
    });

    expect(result.lines.some((line) => line.id === 'line-servisavgift')).toBe(false);
    expect(result.ruleTrace.join(' ')).toContain('§5.1 a');
    expect(result.ruleTrace.join(' ')).toContain('avstängd i taxeversionen');
  });
});
