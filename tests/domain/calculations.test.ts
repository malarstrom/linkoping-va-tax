import { describe, expect, it } from 'vitest';
import { applyManualAdjustment, createCalculationCase } from '../../src/domain/calculations';
import { createEmptyProfile, updateProfile } from '../../src/domain/profile';
import { seedTaxVersions } from '../../src/domain/tax-versions';

describe('calculations', () => {
  it('requires a reason for manual adjustments and records audit history', () => {
    const profile = updateProfile(createEmptyProfile(), { tomtyta: '50' });
    const taxVersion = seedTaxVersions[0];
    const calculation = createCalculationCase(profile, taxVersion);
    const lineId = calculation.revisions[0].resultSnapshot.lines[0]?.id;

    expect(lineId).toBeTruthy();
    expect(() => applyManualAdjustment(calculation, String(lineId), '', 100)).toThrow(/Motivering krävs/);

    const adjusted = applyManualAdjustment(calculation, String(lineId), 'QA justering', 100);
    const latest = adjusted.revisions.at(-1);

    expect(latest?.manualAdjustments).toHaveLength(1);
    expect(latest?.manualAdjustments[0].reason).toBe('QA justering');
    expect(latest?.resultSnapshot.ruleTrace.at(-1)).toContain('MANUAL:');
    expect(latest?.resultSnapshot.calculatedTotal).toBe(calculation.revisions[0].resultSnapshot.calculatedTotal);
    expect(latest?.resultSnapshot.total).toBeCloseTo(calculation.revisions[0].resultSnapshot.total + 100, 2);
  });
});
