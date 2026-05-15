import type { CalculationLine, CalculationResult, TaxVersion } from './types';

function normalizeParagraph(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function paragraphMatches(enabledRule: string, paragraphRef: string): boolean {
  const rule = normalizeParagraph(enabledRule);
  const paragraph = normalizeParagraph(paragraphRef);
  return (
    paragraph === rule ||
    paragraph.startsWith(`${rule}.`) ||
    paragraph.startsWith(`${rule} `)
  );
}

export function isRuleEnabled(taxVersion: TaxVersion, paragraphRef: string): boolean {
  if (taxVersion.enabledRules.length === 0) return true;
  return taxVersion.enabledRules.some((rule) => paragraphMatches(rule, paragraphRef));
}

export function pushTrace(trace: string[], paragraphRef: string, note?: string): void {
  trace.push(note ? `${paragraphRef} (${note})` : paragraphRef);
}

export function roundToPrecision(amount: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(amount * factor) / factor;
}

export function buildLine(line: CalculationLine): CalculationLine {
  const calculatedAmount = line.calculatedAmount ?? line.amount;
  const billedAmount = line.billedAmount ?? calculatedAmount;
  const roundedCalculated = roundToPrecision(calculatedAmount, line.precision);
  const roundedBilled = roundToPrecision(billedAmount, line.precision);

  return {
    ...line,
    amount: roundedBilled,
    calculatedAmount: roundedCalculated,
    billedAmount: roundedBilled,
  };
}

export function createResult(lines: CalculationLine[], ruleTrace: string[]): CalculationResult {
  const normalized = lines.map(buildLine);
  const calculatedTotal = normalized.reduce((sum, line) => sum + (line.calculatedAmount ?? line.amount), 0);
  const billedTotal = normalized.reduce((sum, line) => sum + (line.billedAmount ?? line.amount), 0);

  return {
    calculatedTotal: roundToPrecision(calculatedTotal, 2),
    total: roundToPrecision(billedTotal, 2),
    lines: normalized,
    ruleTrace,
  };
}

export function clampAmount(amount: number, min?: number, max?: number): number {
  let next = amount;
  if (typeof min === 'number') next = Math.max(min, next);
  if (typeof max === 'number') next = Math.min(max, next);
  return next;
}
