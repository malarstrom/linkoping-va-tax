import { describe, expect, it } from 'vitest';
import { calculateBrukningsavgift } from '../../src/domain/brukningsavgift';
import { createEmptyProfile } from '../../src/domain/profile';
import { seedTaxVersions } from '../../src/domain/tax-versions';
import type { TaxVersion } from '../../src/domain/types';

function makeTaxVersion(overrides: Partial<TaxVersion['taxValues']> = {}, enabledRules: string[] = ['§2', '§13', '§15', '§17', '§18', '§19']) {
  return {
    ...seedTaxVersions[0],
    enabledRules,
    taxValues: {
      ...seedTaxVersions[0].taxValues,
      ...overrides,
    },
  } satisfies TaxVersion;
}

describe('brukningsavgift', () => {
  it('caps special actions and exposes billed vs calculated amounts', () => {
    const profile = createEmptyProfile();
    profile.tomtyta = '100';
    const taxVersion = makeTaxVersion({ specialServiceFee: 1000, specialServiceFeeCap: 600, specialServiceAfterHoursCap: 900, vatRate: 0.25 });

    const result = calculateBrukningsavgift(profile, taxVersion, {
      billingInterval: 'monthly',
      estimatedConsumptionM3: '120',
      useEstimatedConsumption: true,
      meterType: 'DN25',
      propertyTransferRequested: true,
      annualMeterReadingCompleted: true,
      latePaymentDays: 10,
      afterHours: true,
      specialActions: ['meter-installation', 'inspection'],
    });

    const special = result.lines.filter((line) => line.paragraphRef === '§17');
    expect(special.length).toBeGreaterThan(0);
    expect(special.some((line) => (line.billedAmount ?? line.amount) < (line.calculatedAmount ?? line.amount))).toBe(true);
    expect(result.lines.find((line) => line.id === 'line-moms')).toBeTruthy();
    expect(result.lines.find((line) => line.id === 'line-drojmalsranta')).toBeTruthy();
    expect(result.ruleTrace).toContain('§17');
    expect(result.ruleTrace).toContain('§18');
  });

  it('skips special actions when the version disables the rule', () => {
    const profile = createEmptyProfile();
    const taxVersion = makeTaxVersion({}, ['§2', '§13', '§15', '§18', '§19']);

    const result = calculateBrukningsavgift(profile, taxVersion, {
      billingInterval: 'quarterly',
      estimatedConsumptionM3: '50',
      useEstimatedConsumption: true,
      meterType: 'DN20 smallhus',
      propertyTransferRequested: false,
      annualMeterReadingCompleted: false,
      latePaymentDays: 0,
      afterHours: true,
      specialActions: ['wasted-visit'],
    });

    expect(result.lines.some((line) => line.paragraphRef === '§17')).toBe(false);
    expect(result.ruleTrace.join(' ')).toContain('§17 (avstängd i taxeversionen)');
  });
});
