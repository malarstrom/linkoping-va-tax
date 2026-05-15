import { calculateAnlaggningsavgift } from './anlaggningsavgift';
import { calculateBrukningsavgift } from './brukningsavgift';
import { createResult } from './rule-engine';
import type { AnlaggningsavgiftScenario, BrukningsavgiftScenario, CalculationResult, PropertyProfile, TaxVersion } from './types';

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

export function calculatePreview(profile: PropertyProfile, taxVersion: TaxVersion): CalculationResult {
  const a = calculateAnlaggningsavgift(profile, taxVersion, defaultAnlaggningsScenario);
  const b = calculateBrukningsavgift(profile, taxVersion, defaultBrukningsScenario);
  return createResult([...a.lines, ...b.lines], [...a.ruleTrace, ...b.ruleTrace]);
}
