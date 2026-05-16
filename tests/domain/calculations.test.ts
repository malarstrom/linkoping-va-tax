import { describe, expect, it } from 'vitest';
import { calculatePreview } from '../../src/domain/calculate';
import { applyManualAdjustment, createCalculationCase, deleteManualAdjustment } from '../../src/domain/calculations';
import { createEmptyProfile, updateProfile } from '../../src/domain/profile';
import { seedTaxVersions } from '../../src/domain/tax-versions';

describe('calculations', () => {
  it('uses the same scenario-aware calculation for live preview and saved calculation', () => {
    const profile = updateProfile(createEmptyProfile(), { tomtyta: '250' });
    const taxVersion = seedTaxVersions[0];
    const anlaggningsScenario = {
      sharedConnectionCount: 2,
      samfollighet: true,
      addedServisledningar: 1,
      addedTomtyta: '25',
      addedBostadsenheter: 1,
      dfWithoutConnection: true,
    };
    const brukningsScenario = {
      billingInterval: 'monthly' as const,
      estimatedConsumptionM3: '120',
      useEstimatedConsumption: true,
      meterType: 'DN25' as const,
      propertyTransferRequested: true,
      annualMeterReadingCompleted: true,
      latePaymentDays: 14,
      afterHours: true,
      specialActions: ['meter-installation' as const],
    };

    const live = calculatePreview(profile, taxVersion, anlaggningsScenario, brukningsScenario);
    const saved = createCalculationCase(profile, taxVersion, 'final', anlaggningsScenario, brukningsScenario);

    expect(live).toEqual(saved.revisions[0].resultSnapshot);
  });

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

  it('can delete a manual adjustment with a new audit revision', () => {
    const profile = updateProfile(createEmptyProfile(), { tomtyta: '50' });
    const taxVersion = seedTaxVersions[0];
    const calculation = createCalculationCase(profile, taxVersion);
    const lineId = calculation.revisions[0].resultSnapshot.lines[0]?.id;
    const adjusted = applyManualAdjustment(calculation, String(lineId), 'QA justering', 100);
    const adjustmentId = adjusted.revisions.at(-1)?.manualAdjustments[0]?.id;

    const deleted = deleteManualAdjustment(adjusted, String(adjustmentId));
    const latest = deleted.revisions.at(-1);

    expect(latest?.manualAdjustments).toHaveLength(0);
    expect(latest?.resultSnapshot.ruleTrace.at(-1)).toContain('MANUAL_DELETE:');
    expect(latest?.resultSnapshot.total).toBeCloseTo(calculation.revisions[0].resultSnapshot.total, 2);
    expect(deleted.revisions).toHaveLength(3);
  });
});
