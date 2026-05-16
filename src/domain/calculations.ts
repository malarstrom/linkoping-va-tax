import { createId } from './ids';
import { calculateAnlaggningsavgift } from './anlaggningsavgift';
import { calculateBrukningsavgift } from './brukningsavgift';
import { createResult } from './rule-engine';
import type {
  AnlaggningsavgiftScenario,
  BrukningsavgiftScenario,
  CalculationCase,
  CalculationMode,
  CalculationRevision,
  CalculationResult,
  ManualAdjustment,
  PropertyProfile,
  TaxVersion,
} from './types';

const defaultAnlaggningsScenario: AnlaggningsavgiftScenario = {
  sharedConnectionCount: 1,
  samfollighet: false,
  addedServisledningar: 0,
  addedTomtyta: '',
  addedBostadsenheter: 0,
  dfWithoutConnection: false,
};

const defaultBrukningsScenario: BrukningsavgiftScenario = {
  billingInterval: 'quarterly',
  estimatedConsumptionM3: '',
  useEstimatedConsumption: false,
  meterType: 'DN20 smallhus',
  propertyTransferRequested: false,
  annualMeterReadingCompleted: true,
  latePaymentDays: 0,
  afterHours: false,
  specialActions: [],
};

function nowIso(): string {
  return new Date().toISOString();
}

function combineResults(left: CalculationResult, right: CalculationResult): CalculationResult {
  return createResult([...left.lines, ...right.lines], [...left.ruleTrace, ...right.ruleTrace]);
}

export function calculateCaseResult(
  profile: PropertyProfile,
  taxVersion: TaxVersion,
  anlaggningsScenario: AnlaggningsavgiftScenario = defaultAnlaggningsScenario,
  brukningsScenario: BrukningsavgiftScenario = defaultBrukningsScenario,
): CalculationResult {
  return combineResults(
    calculateAnlaggningsavgift(profile, taxVersion, anlaggningsScenario),
    calculateBrukningsavgift(profile, taxVersion, brukningsScenario),
  );
}

function createCalculationRevision(
  calculationCaseId: string,
  revisionNo: number,
  profile: PropertyProfile,
  taxVersion: TaxVersion,
  mode: CalculationMode,
  anlaggningsScenario: AnlaggningsavgiftScenario,
  brukningsScenario: BrukningsavgiftScenario,
): CalculationRevision {
  const createdAt = nowIso();
  return {
    id: createId('calculation-revision'),
    calculationCaseId,
    revisionNo,
    inputSnapshot: {
      profileId: profile.id,
      profileRevisionId: profile.currentRevisionId,
      taxVersionId: taxVersion.id,
      mode,
      anlaggningsavgiftScenario: anlaggningsScenario,
      brukningsavgiftScenario: brukningsScenario,
    },
    resultSnapshot: calculateCaseResult(profile, taxVersion, anlaggningsScenario, brukningsScenario),
    manualAdjustments: [],
    createdAt,
  };
}

export function createCalculationCase(
  profile: PropertyProfile,
  taxVersion: TaxVersion,
  mode: CalculationMode = 'final',
  anlaggningsScenario: AnlaggningsavgiftScenario = defaultAnlaggningsScenario,
  brukningsScenario: BrukningsavgiftScenario = defaultBrukningsScenario,
): CalculationCase {
  const createdAt = nowIso();
  const id = createId('calculation');
  const revision = createCalculationRevision(id, 1, profile, taxVersion, mode, anlaggningsScenario, brukningsScenario);

  return {
    id,
    profileId: profile.id,
    taxVersionId: taxVersion.id,
    mode,
    status: 'calculated',
    currentRevisionId: revision.id,
    createdAt,
    updatedAt: createdAt,
    revisions: [revision],
  };
}

export function rerunCalculationCase(
  calculationCase: CalculationCase,
  profile: PropertyProfile,
  taxVersion: TaxVersion,
  mode: CalculationMode = calculationCase.mode,
): CalculationCase {
  const lastInput = calculationCase.revisions[calculationCase.revisions.length - 1]?.inputSnapshot;
  return createCalculationCase(
    profile,
    taxVersion,
    mode,
    lastInput?.anlaggningsavgiftScenario ?? defaultAnlaggningsScenario,
    lastInput?.brukningsavgiftScenario ?? defaultBrukningsScenario,
  );
}

function createManualAdjustmentRevision(
  calculationCase: CalculationCase,
  previousRevision: CalculationRevision,
  resultSnapshot: CalculationResult,
  manualAdjustments: ManualAdjustment[],
): CalculationCase {
  const revision: CalculationRevision = {
    id: createId('calculation-revision'),
    calculationCaseId: calculationCase.id,
    revisionNo: previousRevision.revisionNo + 1,
    inputSnapshot: previousRevision.inputSnapshot,
    resultSnapshot,
    manualAdjustments,
    createdAt: nowIso(),
  };

  return {
    ...calculationCase,
    status: 'calculated',
    currentRevisionId: revision.id,
    updatedAt: revision.createdAt,
    revisions: [...calculationCase.revisions, revision],
  };
}

export function applyManualAdjustment(
  calculationCase: CalculationCase,
  targetLineId: string,
  reason: string,
  delta: number,
): CalculationCase {
  const lastRevision = calculationCase.revisions[calculationCase.revisions.length - 1];
  if (!lastRevision) return calculationCase;

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error('Motivering krävs för manuell justering');
  }
  if (!targetLineId) {
    throw new Error('Målraden måste anges');
  }
  if (!Number.isFinite(delta) || delta === 0) {
    throw new Error('Justering måste vara skild från noll');
  }

  const targetLine = lastRevision.resultSnapshot.lines.find((line) => line.id === targetLineId);
  if (!targetLine) {
    throw new Error('Målraden finns inte i beräkningen');
  }

  const adjustedLines = lastRevision.resultSnapshot.lines.map((line) => {
    if (line.id !== targetLineId) return line;
    const calculatedAmount = line.calculatedAmount ?? line.amount;
    const billedAmount = (line.billedAmount ?? line.amount) + delta;
    return {
      ...line,
      calculatedAmount,
      billedAmount,
      amount: billedAmount,
    };
  });

  const adjustedResult = {
    calculatedTotal: lastRevision.resultSnapshot.calculatedTotal,
    total: Math.round((lastRevision.resultSnapshot.total + delta) * 100) / 100,
    lines: adjustedLines,
    ruleTrace: [...lastRevision.resultSnapshot.ruleTrace, `MANUAL:${targetLineId} (${trimmedReason})`],
  };

  const adjustment: ManualAdjustment = {
    id: createId('manual-adjustment'),
    targetLineId,
    reason: trimmedReason,
    delta,
    createdAt: nowIso(),
  };

  return createManualAdjustmentRevision(
    calculationCase,
    lastRevision,
    adjustedResult,
    [...lastRevision.manualAdjustments, adjustment],
  );
}

export function deleteManualAdjustment(calculationCase: CalculationCase, adjustmentId: string): CalculationCase {
  const lastRevision = calculationCase.revisions[calculationCase.revisions.length - 1];
  if (!lastRevision) return calculationCase;

  const adjustment = lastRevision.manualAdjustments.find((item) => item.id === adjustmentId);
  if (!adjustment) {
    throw new Error('Justeringen finns inte i beräkningen');
  }

  const targetLine = lastRevision.resultSnapshot.lines.find((line) => line.id === adjustment.targetLineId);
  if (!targetLine) {
    throw new Error('Målraden finns inte i beräkningen');
  }

  const adjustedLines = lastRevision.resultSnapshot.lines.map((line) => {
    if (line.id !== adjustment.targetLineId) return line;
    const billedAmount = (line.billedAmount ?? line.amount) - adjustment.delta;
    return {
      ...line,
      billedAmount,
      amount: billedAmount,
    };
  });

  const adjustedResult = {
    calculatedTotal: lastRevision.resultSnapshot.calculatedTotal,
    total: Math.round((lastRevision.resultSnapshot.total - adjustment.delta) * 100) / 100,
    lines: adjustedLines,
    ruleTrace: [...lastRevision.resultSnapshot.ruleTrace, `MANUAL_DELETE:${adjustment.targetLineId} (${adjustment.reason})`],
  };

  return createManualAdjustmentRevision(
    calculationCase,
    lastRevision,
    adjustedResult,
    lastRevision.manualAdjustments.filter((item) => item.id !== adjustmentId),
  );
}
