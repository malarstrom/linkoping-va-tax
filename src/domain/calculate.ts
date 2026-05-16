import { calculateCaseResult } from './calculations';
import type { AnlaggningsavgiftScenario, BrukningsavgiftScenario, CalculationResult, PropertyProfile, TaxVersion } from './types';

export function calculatePreview(
  profile: PropertyProfile,
  taxVersion: TaxVersion,
  anlaggningsScenario?: AnlaggningsavgiftScenario,
  brukningsScenario?: BrukningsavgiftScenario,
): CalculationResult {
  return calculateCaseResult(profile, taxVersion, anlaggningsScenario, brukningsScenario);
}
