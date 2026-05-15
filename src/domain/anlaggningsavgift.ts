import { clampAmount, createResult, isRuleEnabled, pushTrace } from './rule-engine';
import type { CalculationLine, AnlaggningsavgiftScenario, PropertyProfile, TaxVersion } from './types';

const SERVICE_PARAGRAPH_BY_TYPE = {
  'bostadsfastighet': '§5.1 a',
  'annan fastighet': '§6.1 a',
  'obebyggd fastighet': '§7.1',
} as const;

const CONNECTION_PARAGRAPH_BY_TYPE = {
  'bostadsfastighet': '§5.1 b',
  'annan fastighet': '§6.1 b',
  'obebyggd fastighet': '§7.1',
} as const;

const AREA_PARAGRAPH_BY_TYPE = {
  'bostadsfastighet': '§5.1 c',
  'annan fastighet': '§6.1 c',
  'obebyggd fastighet': '§7.1',
} as const;

const UNIT_PARAGRAPH_BY_TYPE = {
  'bostadsfastighet': '§5.1 d',
  'annan fastighet': '§6.1 d',
  'obebyggd fastighet': '§7.1',
} as const;

const DFPARAGRAPH_BY_TYPE = {
  'bostadsfastighet': '§5.1 e',
  'annan fastighet': '§6.1 d',
  'obebyggd fastighet': '§7.1',
} as const;

const ADDITIONAL_SERVICE_PARAGRAPH = '§5.5';
const ADDITIONAL_AREA_PARAGRAPH = '§5.6';
const ADDITIONAL_UNIT_PARAGRAPH = '§5.7';
const ADDITIONAL_DF_PARAGRAPH = '§5.8';

function roundToPrecision(amount: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(amount * factor) / factor;
}

function parseArea(value: string): number {
  const normalized = value.replace(',', '.').trim();
  return Number(normalized) || 0;
}

function parseUnits(value: string): number {
  return Number.parseInt(value, 10) || 0;
}

function serviceFeeAmount(taxVersion: TaxVersion, serviceCount: number): number {
  if (serviceCount <= 1) return taxVersion.taxValues.servisavgift1;
  if (serviceCount === 2) return taxVersion.taxValues.servisavgift2;
  return taxVersion.taxValues.servisavgift3;
}

function pushLine(lines: CalculationLine[], ruleTrace: string[], line: CalculationLine): void {
  const billedAmount = roundToPrecision(line.billedAmount ?? line.calculatedAmount ?? line.amount, line.precision);
  const calculatedAmount = roundToPrecision(line.calculatedAmount ?? line.amount, line.precision);
  if (billedAmount <= 0 && calculatedAmount <= 0) return;
  lines.push({ ...line, amount: billedAmount, calculatedAmount, billedAmount });
  pushTrace(ruleTrace, line.paragraphRef);
}

function pushSkipped(ruleTrace: string[], paragraphRef: string): void {
  pushTrace(ruleTrace, paragraphRef, 'avstängd i taxeversionen');
}

function calcLimitedAreaAmount(area: number, rate: number, cap: number): number {
  if (area <= 0 || rate <= 0 || cap <= 0) return 0;
  return Math.min(area * rate, cap);
}

export function calculateAnlaggningsavgift(
  profile: PropertyProfile,
  taxVersion: TaxVersion,
  scenario: AnlaggningsavgiftScenario,
) {
  const lines: CalculationLine[] = [];
  const ruleTrace: string[] = [];
  const enabledServices = profile.services.filter((service) => service.enabled).map((service) => service.code);
  const serviceCount = enabledServices.filter((code) => code !== 'Df' || !scenario.dfWithoutConnection).length;
  const serviceAmount = serviceCount > 0 ? serviceFeeAmount(taxVersion, serviceCount) : 0;
  const sharedFactor = Math.max(1, scenario.sharedConnectionCount || 1);
  const sharedServiceAmount = serviceAmount / sharedFactor;
  const tomtyteCap = taxVersion.taxValues.tomtyteavgiftCap ?? serviceAmount;

  if (isRuleEnabled(taxVersion, SERVICE_PARAGRAPH_BY_TYPE[profile.propertyType])) {
    pushLine(lines, ruleTrace, {
      id: 'line-servisavgift',
      component: 'anläggningsavgift',
      paragraphRef: SERVICE_PARAGRAPH_BY_TYPE[profile.propertyType],
      description: scenario.sharedConnectionCount > 1 ? 'Servisavgift, delad förbindelsepunkt' : 'Servisavgift',
      basis: `${serviceCount} tjänster`,
      amount: sharedServiceAmount,
      calculatedAmount: sharedServiceAmount,
      billedAmount: sharedServiceAmount,
      precision: 2,
      ruleIds: [SERVICE_PARAGRAPH_BY_TYPE[profile.propertyType]],
    });
  } else {
    pushSkipped(ruleTrace, SERVICE_PARAGRAPH_BY_TYPE[profile.propertyType]);
  }

  if (isRuleEnabled(taxVersion, CONNECTION_PARAGRAPH_BY_TYPE[profile.propertyType])) {
    const connectionBase = taxVersion.taxValues.forbindelsepunkt;
    const connectionAmount = scenario.samfollighet ? connectionBase * 0.8 : connectionBase;
    pushLine(lines, ruleTrace, {
      id: 'line-forbindelsepunkt',
      component: 'anläggningsavgift',
      paragraphRef: CONNECTION_PARAGRAPH_BY_TYPE[profile.propertyType],
      description: scenario.samfollighet ? 'Förbindelsepunktsavgift, samfällighetsreduktion' : 'Förbindelsepunktsavgift',
      basis: scenario.samfollighet ? '80 % av full avgift' : 'full avgift',
      amount: connectionAmount,
      calculatedAmount: connectionAmount,
      billedAmount: connectionAmount,
      precision: 2,
      ruleIds: [CONNECTION_PARAGRAPH_BY_TYPE[profile.propertyType]],
    });
  } else {
    pushSkipped(ruleTrace, CONNECTION_PARAGRAPH_BY_TYPE[profile.propertyType]);
  }

  const units = parseUnits(profile.bostadsenheter);
  const baseArea = parseArea(profile.tomtyta);
  const existingAreaCharge = isRuleEnabled(taxVersion, AREA_PARAGRAPH_BY_TYPE[profile.propertyType])
    ? calcLimitedAreaAmount(baseArea, taxVersion.taxValues.tomtyteavgift, tomtyteCap)
    : 0;
  if (isRuleEnabled(taxVersion, AREA_PARAGRAPH_BY_TYPE[profile.propertyType])) {
    pushLine(lines, ruleTrace, {
      id: 'line-tomtyta',
      component: 'anläggningsavgift',
      paragraphRef: AREA_PARAGRAPH_BY_TYPE[profile.propertyType],
      description: 'Tomtyteavgift',
      basis: `${baseArea} m²`,
      amount: existingAreaCharge,
      calculatedAmount: baseArea * taxVersion.taxValues.tomtyteavgift,
      billedAmount: existingAreaCharge,
      precision: 2,
      ruleIds: [AREA_PARAGRAPH_BY_TYPE[profile.propertyType]],
    });
    if (baseArea > 0 && existingAreaCharge < baseArea * taxVersion.taxValues.tomtyteavgift) {
      pushTrace(ruleTrace, AREA_PARAGRAPH_BY_TYPE[profile.propertyType], 'begränsad av tomtytebegränsningsregeln');
    }
  } else {
    pushSkipped(ruleTrace, AREA_PARAGRAPH_BY_TYPE[profile.propertyType]);
  }

  if (isRuleEnabled(taxVersion, UNIT_PARAGRAPH_BY_TYPE[profile.propertyType])) {
    pushLine(lines, ruleTrace, {
      id: 'line-bostadsenheter',
      component: 'anläggningsavgift',
      paragraphRef: UNIT_PARAGRAPH_BY_TYPE[profile.propertyType],
      description: 'Bostadsenhetsavgift',
      basis: `${units} bostadsenheter`,
      amount: units * taxVersion.taxValues.bostadsenhetsavgift,
      calculatedAmount: units * taxVersion.taxValues.bostadsenhetsavgift,
      billedAmount: units * taxVersion.taxValues.bostadsenhetsavgift,
      precision: 2,
      ruleIds: [UNIT_PARAGRAPH_BY_TYPE[profile.propertyType]],
    });
  } else {
    pushSkipped(ruleTrace, UNIT_PARAGRAPH_BY_TYPE[profile.propertyType]);
  }

  if (scenario.addedServisledningar > 0 && isRuleEnabled(taxVersion, ADDITIONAL_SERVICE_PARAGRAPH)) {
    const amount = scenario.addedServisledningar * serviceFeeAmount(taxVersion, 1);
    pushLine(lines, ruleTrace, {
      id: 'line-tillkommande-servis',
      component: 'anläggningsavgift',
      paragraphRef: ADDITIONAL_SERVICE_PARAGRAPH,
      description: 'Tillkommande servisledningar',
      basis: `${scenario.addedServisledningar} ledningar`,
      amount,
      calculatedAmount: amount,
      billedAmount: amount,
      precision: 2,
      ruleIds: [ADDITIONAL_SERVICE_PARAGRAPH],
    });
  } else if (scenario.addedServisledningar > 0) {
    pushSkipped(ruleTrace, ADDITIONAL_SERVICE_PARAGRAPH);
  }

  if (scenario.addedTomtyta.trim() && isRuleEnabled(taxVersion, ADDITIONAL_AREA_PARAGRAPH)) {
    const addedArea = parseArea(scenario.addedTomtyta);
    const alreadyBilledArea = lines.find((line) => line.id === 'line-tomtyta')?.billedAmount ?? 0;
    const remainingCap = Math.max(0, tomtyteCap - alreadyBilledArea);
    const billedAmount = calcLimitedAreaAmount(addedArea, taxVersion.taxValues.tomtyteavgift, remainingCap);
    pushLine(lines, ruleTrace, {
      id: 'line-tillkommande-tomtyta',
      component: 'anläggningsavgift',
      paragraphRef: ADDITIONAL_AREA_PARAGRAPH,
      description: 'Tillkommande tomtyteavgift',
      basis: `${addedArea} m²`,
      amount: billedAmount,
      calculatedAmount: addedArea * taxVersion.taxValues.tomtyteavgift,
      billedAmount,
      precision: 2,
      ruleIds: [ADDITIONAL_AREA_PARAGRAPH],
    });
    if (addedArea > 0 && billedAmount < addedArea * taxVersion.taxValues.tomtyteavgift) {
      pushTrace(ruleTrace, ADDITIONAL_AREA_PARAGRAPH, 'begränsad av tomtytebegränsningsregeln');
    }
  } else if (scenario.addedTomtyta.trim()) {
    pushSkipped(ruleTrace, ADDITIONAL_AREA_PARAGRAPH);
  }

  if (scenario.addedBostadsenheter > 0 && isRuleEnabled(taxVersion, ADDITIONAL_UNIT_PARAGRAPH)) {
    const amount = scenario.addedBostadsenheter * taxVersion.taxValues.bostadsenhetsavgift;
    pushLine(lines, ruleTrace, {
      id: 'line-tillkommande-bostadsenheter',
      component: 'anläggningsavgift',
      paragraphRef: ADDITIONAL_UNIT_PARAGRAPH,
      description: 'Tillkommande bostadsenhetsavgift',
      basis: `${scenario.addedBostadsenheter} bostadsenheter`,
      amount,
      calculatedAmount: amount,
      billedAmount: amount,
      precision: 2,
      ruleIds: [ADDITIONAL_UNIT_PARAGRAPH],
    });
  } else if (scenario.addedBostadsenheter > 0) {
    pushSkipped(ruleTrace, ADDITIONAL_UNIT_PARAGRAPH);
  }

  if (scenario.dfWithoutConnection && isRuleEnabled(taxVersion, ADDITIONAL_DF_PARAGRAPH)) {
    const amount = taxVersion.taxValues.dagvattenutanforbindelsepunkt;
    pushLine(lines, ruleTrace, {
      id: 'line-df-utan-forbindelsepunkt',
      component: 'anläggningsavgift',
      paragraphRef: DFPARAGRAPH_BY_TYPE[profile.propertyType],
      description: 'Dagvatten utan förbindelsepunkt',
      basis: 'Df utan etablerad förbindelsepunkt',
      amount,
      calculatedAmount: amount,
      billedAmount: amount,
      precision: 2,
      ruleIds: [ADDITIONAL_DF_PARAGRAPH],
    });
  } else if (scenario.dfWithoutConnection) {
    pushSkipped(ruleTrace, ADDITIONAL_DF_PARAGRAPH);
  }

  return createResult(lines, ruleTrace);
}
