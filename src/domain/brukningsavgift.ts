import { clampAmount, createResult, isRuleEnabled, pushTrace } from './rule-engine';
import { selectedServiceCodes, serviceShare, serviceShareBasis } from './service-shares';
import { pushVatLine } from './vat';
import type { BrukningsavgiftScenario, CalculationLine, PropertyProfile, TaxVersion } from './types';

const BILLING_DIVISOR = {
  monthly: 12,
  quarterly: 4,
  tertial: 3,
  semiannual: 2,
} as const;

const METER_FEE_BY_TYPE = {
  'DN20 smallhus': 'brukningsmeterDn20Smallhus',
  'DN20': 'brukningsmeterDn20',
  'DN25': 'brukningsmeterDn25',
  'DN40': 'brukningsmeterDn40',
} as const;

const SPECIAL_ACTION_LABELS: Record<string, string> = {
  'meter-removal': 'Nedtagning av vattenmätare',
  'meter-installation': 'Uppsättning av vattenmätare',
  shutoff: 'Avstängning av vattentillförsel',
  restart: 'Påsläpp av vattentillförsel',
  inspection: 'Undersökning av vattenmätare',
  'tank-cleaning': 'Tömning av vattenmätarbrunn',
  'wasted-visit': 'Förgävesbesök',
};

function roundToPrecision(amount: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(amount * factor) / factor;
}

function parseNumber(value: string): number {
  const normalized = value.replace(',', '.').trim();
  return Number(normalized) || 0;
}

function pushLine(lines: CalculationLine[], ruleTrace: string[], line: CalculationLine): void {
  const billedAmount = roundToPrecision(line.billedAmount ?? line.calculatedAmount ?? line.amount, line.precision);
  const calculatedAmount = roundToPrecision(line.calculatedAmount ?? line.amount, line.precision);
  lines.push({ ...line, amount: billedAmount, calculatedAmount, billedAmount });
  pushTrace(ruleTrace, line.paragraphRef);
}

function intervalDivisor(interval: BrukningsavgiftScenario['billingInterval']): number {
  return BILLING_DIVISOR[interval] ?? 12;
}

function annualWaterAmount(taxVersion: TaxVersion, scenario: BrukningsavgiftScenario): number {
  if (!scenario.useEstimatedConsumption) return 0;
  const m3 = parseNumber(scenario.estimatedConsumptionM3);
  const divisor = intervalDivisor(scenario.billingInterval);
  const rate = taxVersion.taxValues.brukningsm3Rate ?? 0;
  if (m3 <= 0 || rate <= 0) return 0;
  return (m3 * rate) / divisor;
}

function annualGrundavgift(taxVersion: TaxVersion, scenario: BrukningsavgiftScenario): number {
  const divisor = intervalDivisor(scenario.billingInterval);
  const annual = taxVersion.taxValues.brukningsgrundavgiftAnnual ?? 0;
  return annual / divisor;
}

function annualDagvatten(taxVersion: TaxVersion, profile: PropertyProfile, scenario: BrukningsavgiftScenario): number {
  const divisor = intervalDivisor(scenario.billingInterval);
  const area = parseNumber(profile.tomtyta);
  const rate = taxVersion.taxValues.brukningsdagvattenRate ?? 0;
  if (area <= 0 || rate <= 0) return 0;
  return (area * rate) / divisor;
}

function meterFee(taxVersion: TaxVersion, scenario: BrukningsavgiftScenario): number {
  const divisor = intervalDivisor(scenario.billingInterval);
  const key = METER_FEE_BY_TYPE[scenario.meterType] ?? METER_FEE_BY_TYPE['DN20 smallhus'];
  const annual = taxVersion.taxValues[key] ?? 0;
  return annual / divisor;
}

export function calculateBrukningsavgift(
  profile: PropertyProfile,
  taxVersion: TaxVersion,
  scenario: BrukningsavgiftScenario,
) {
  const lines: CalculationLine[] = [];
  const ruleTrace: string[] = [];
  const divisor = intervalDivisor(scenario.billingInterval);
  const enabledServices = selectedServiceCodes(profile.services);
  const grundShare = serviceShare(taxVersion, 'brukningGrundavgift', enabledServices);
  const waterShare = serviceShare(taxVersion, 'brukningForbrukning', enabledServices);
  const dagvattenShare = serviceShare(taxVersion, 'brukningDagvatten', enabledServices);
  const meterShare = serviceShare(taxVersion, 'brukningMatare', enabledServices);

  if (isRuleEnabled(taxVersion, '§13')) {
    pushLine(lines, ruleTrace, {
      id: 'line-brukning-grundavgift',
      component: 'brukningsavgift',
      paragraphRef: '§13.1 a',
      description: 'Grundavgift',
      basis: `Årsavgift / ${divisor} (${scenario.billingInterval}), ${serviceShareBasis(taxVersion, 'brukningGrundavgift', enabledServices)}`,
      amount: annualGrundavgift(taxVersion, scenario) * grundShare,
      calculatedAmount: annualGrundavgift(taxVersion, scenario) * grundShare,
      billedAmount: annualGrundavgift(taxVersion, scenario) * grundShare,
      baseAmount: annualGrundavgift(taxVersion, scenario),
      share: grundShare,
      reductionReason: grundShare < 1 ? 'Reducerad efter valda V/S-tjänster' : undefined,
      precision: 2,
      ruleIds: ['§13.1 a', '§18'],
    });

    pushLine(lines, ruleTrace, {
      id: 'line-brukning-vatten',
      component: 'brukningsavgift',
      paragraphRef: '§13.1 b',
      description: scenario.useEstimatedConsumption ? 'Vattenavgift, uppskattad förbrukning' : 'Vattenavgift',
      basis: scenario.useEstimatedConsumption ? `${parseNumber(scenario.estimatedConsumptionM3)} m³ / ${divisor}, ${serviceShareBasis(taxVersion, 'brukningForbrukning', enabledServices)}` : `0 m³ / ${divisor}`,
      amount: annualWaterAmount(taxVersion, scenario) * waterShare,
      calculatedAmount: annualWaterAmount(taxVersion, scenario) * waterShare,
      billedAmount: annualWaterAmount(taxVersion, scenario) * waterShare,
      baseAmount: annualWaterAmount(taxVersion, scenario),
      share: waterShare,
      reductionReason: waterShare < 1 ? 'Reducerad efter vald vattentjänst' : undefined,
      precision: 2,
      ruleIds: ['§13.1 b', '§13.3', '§18'],
    });

    pushLine(lines, ruleTrace, {
      id: 'line-brukning-dagvatten',
      component: 'brukningsavgift',
      paragraphRef: '§13.1 c',
      description: 'Dagvattenavgift',
      basis: `${parseNumber(profile.tomtyta)} m² / ${divisor}, ${serviceShareBasis(taxVersion, 'brukningDagvatten', enabledServices)}`,
      amount: annualDagvatten(taxVersion, profile, scenario) * dagvattenShare,
      calculatedAmount: annualDagvatten(taxVersion, profile, scenario) * dagvattenShare,
      billedAmount: annualDagvatten(taxVersion, profile, scenario) * dagvattenShare,
      baseAmount: annualDagvatten(taxVersion, profile, scenario),
      share: dagvattenShare,
      reductionReason: dagvattenShare < 1 ? 'Reducerad efter valda dagvattentjänster' : undefined,
      precision: 2,
      ruleIds: ['§13.1 c', '§15', '§18'],
    });

    pushLine(lines, ruleTrace, {
      id: 'line-mataravgift',
      component: 'brukningsavgift',
      paragraphRef: '§13.1 d-g',
      description: 'Mätaravgift',
      basis: `${scenario.meterType} / ${divisor}, ${serviceShareBasis(taxVersion, 'brukningMatare', enabledServices)}`,
      amount: meterFee(taxVersion, scenario) * meterShare,
      calculatedAmount: meterFee(taxVersion, scenario) * meterShare,
      billedAmount: meterFee(taxVersion, scenario) * meterShare,
      baseAmount: meterFee(taxVersion, scenario),
      share: meterShare,
      reductionReason: meterShare < 1 ? 'Reducerad efter vald vattentjänst' : undefined,
      precision: 2,
      ruleIds: ['§13.1 d-g', '§18'],
    });
  } else {
    pushTrace(ruleTrace, '§13', 'avstängd i taxeversionen');
  }

  if (scenario.annualMeterReadingCompleted && isRuleEnabled(taxVersion, '§19')) {
    pushLine(lines, ruleTrace, {
      id: 'line-arlig-matarlasning',
      component: 'brukningsavgift',
      paragraphRef: '§19',
      description: 'Årlig mätaravläsning och debitering',
      basis: 'Minst en gång per år',
      amount: 0,
      calculatedAmount: 0,
      billedAmount: 0,
      precision: 2,
      ruleIds: ['§19'],
    });
  } else if (scenario.annualMeterReadingCompleted) {
    pushTrace(ruleTrace, '§19', 'avstängd i taxeversionen');
  }

  if (scenario.propertyTransferRequested && isRuleEnabled(taxVersion, '§19')) {
    pushLine(lines, ruleTrace, {
      id: 'line-overlatelse-avlasning',
      component: 'brukningsavgift',
      paragraphRef: '§19',
      description: 'Avläsning och debitering vid fastighetsöverlåtelse',
      basis: 'På fastighetsägarens begäran',
      amount: 0,
      calculatedAmount: 0,
      billedAmount: 0,
      precision: 2,
      ruleIds: ['§19'],
    });
  } else if (scenario.propertyTransferRequested) {
    pushTrace(ruleTrace, '§19', 'avstängd i taxeversionen');
  }

  const specialServiceCount = scenario.specialActions.length;
  if (specialServiceCount > 0 && isRuleEnabled(taxVersion, '§17')) {
    scenario.specialActions.forEach((action, index) => {
      const fee = clampAmount(taxVersion.taxValues.specialServiceFee ?? 0, 0, taxVersion.taxValues.specialServiceFeeCap ?? undefined);
      pushLine(lines, ruleTrace, {
        id: `line-sarskild-${index}`,
        component: 'särskild åtgärd',
        paragraphRef: '§17',
        description: SPECIAL_ACTION_LABELS[action] ?? action,
        basis: 'Per påbörjad timme',
        amount: fee,
        calculatedAmount: taxVersion.taxValues.specialServiceFee ?? 0,
        billedAmount: fee,
        precision: 2,
        ruleIds: ['§17', '§18'],
      });
    });

    if (scenario.afterHours) {
      const fee = clampAmount(
        specialServiceCount * (taxVersion.taxValues.specialServiceFee ?? 0),
        0,
        taxVersion.taxValues.specialServiceAfterHoursCap ?? undefined,
      );
      pushLine(lines, ruleTrace, {
        id: 'line-sarskild-eftertid',
        component: 'särskild åtgärd',
        paragraphRef: '§17',
        description: 'Tillägg utanför ordinarie arbetstid',
        basis: '100 % av ovan angivna belopp',
        amount: fee,
        calculatedAmount: specialServiceCount * (taxVersion.taxValues.specialServiceFee ?? 0),
        billedAmount: fee,
        precision: 2,
        ruleIds: ['§17'],
      });
    }
  } else if (specialServiceCount > 0) {
    pushTrace(ruleTrace, '§17', 'avstängd i taxeversionen');
  }

  pushVatLine(lines, taxVersion, ruleTrace, '25 % på brukningsavgifter');

  const totalBeforeInterest = lines.reduce((sum, line) => sum + (line.billedAmount ?? line.amount), 0);
  const interestRate = taxVersion.taxValues.lateInterestRate ?? 0.08;
  const interest = scenario.latePaymentDays > 0 ? totalBeforeInterest * interestRate * (scenario.latePaymentDays / 365) : 0;
  if (interest > 0 && isRuleEnabled(taxVersion, '§18')) {
    pushLine(lines, ruleTrace, {
      id: 'line-drojmalsranta',
      component: 'särskild åtgärd',
      paragraphRef: '§18',
      description: 'Dröjsmålsränta',
      basis: `${scenario.latePaymentDays} dagar`,
      amount: interest,
      calculatedAmount: interest,
      billedAmount: interest,
      precision: 2,
      ruleIds: ['§18'],
    });
  } else if (interest > 0) {
    pushTrace(ruleTrace, '§18', 'avstängd i taxeversionen');
  }

  return createResult(lines, ruleTrace);
}
