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
  it('reduces anläggningsavgift rows by the 2026-09-01 service shares and adds VAT', () => {
    const profile = createEmptyProfile();
    profile.services = [
      { code: 'V', enabled: true },
      { code: 'S', enabled: false },
      { code: 'Df', enabled: false },
      { code: 'Dg', enabled: false },
    ];
    profile.tomtyta = '10';
    profile.bostadsenheter = '1';
    const taxVersion = makeTaxVersion({ vatRate: 0.25 }, ['§2', '§5.1 a', '§5.1 b', '§5.1 c', '§5.1 d']);

    const result = calculateAnlaggningsavgift(profile, taxVersion, {
      sharedConnectionCount: 1,
      samfollighet: false,
      addedServisledningar: 0,
      addedTomtyta: '',
      addedBostadsenheter: 0,
      dfWithoutConnection: false,
    });

    expect(result.lines.find((line) => line.id === 'line-servisavgift')?.billedAmount).toBe(43750);
    expect(result.lines.find((line) => line.id === 'line-forbindelsepunkt')?.billedAmount).toBe(16583);
    expect(result.lines.find((line) => line.id === 'line-tomtyta')?.billedAmount).toBe(163.5);
    expect(result.lines.find((line) => line.id === 'line-bostadsenheter')?.billedAmount).toBe(10509);
    expect(result.lines.find((line) => line.id === 'line-anlaggning-moms')?.billedAmount).toBeCloseTo(17751.38, 2);
  });

  it('uses §5.1 e for Df without connection and removes the Df share from servis/connection rows', () => {
    const profile = createEmptyProfile();
    profile.services = [
      { code: 'V', enabled: true },
      { code: 'S', enabled: false },
      { code: 'Df', enabled: true },
      { code: 'Dg', enabled: false },
    ];
    const taxVersion = makeTaxVersion({}, ['§5.1 a', '§5.1 b', '§5.1 e', '§5.8']);

    const result = calculateAnlaggningsavgift(profile, taxVersion, {
      sharedConnectionCount: 1,
      samfollighet: false,
      addedServisledningar: 0,
      addedTomtyta: '',
      addedBostadsenheter: 0,
      dfWithoutConnection: true,
    });

    expect(result.lines.find((line) => line.id === 'line-servisavgift')?.billedAmount).toBe(43750);
    expect(result.lines.find((line) => line.id === 'line-forbindelsepunkt')?.billedAmount).toBe(16583);
    expect(result.lines.find((line) => line.id === 'line-df-utan-forbindelsepunkt')?.billedAmount).toBe(35909);
  });

  it('caps tomtyteavgift and keeps calculated vs billed amounts separate', () => {
    const profile = createEmptyProfile();
    profile.tomtyta = '1';
    profile.services = profile.services.map((service) => ({ ...service, enabled: true }));
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
