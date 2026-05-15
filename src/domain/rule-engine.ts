import type { CalculationLine, CalculationResult, TaxVersion } from './types';

function parseParagraphNumber(value: string): number[] {
  return value
    .replace(/^§/, '')
    .split(/[ .]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}

function paragraphMatches(enabledRule: string, paragraphRef: string): boolean {
  const left = parseParagraphNumber(enabledRule);
  const right = parseParagraphNumber(paragraphRef);
  if (left.length === 0 || right.length === 0) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (right[index] !== left[index]) return false;
  }
  return true;
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
