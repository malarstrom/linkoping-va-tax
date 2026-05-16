import { isRuleEnabled, pushTrace } from './rule-engine';
import type { CalculationLine, TaxVersion } from './types';

export function pushVatLine(
  lines: CalculationLine[],
  taxVersion: TaxVersion,
  ruleTrace?: string[],
  basisDescription = '25 % på avgiftsunderlag',
  id = 'line-moms',
): void {
  if (!isRuleEnabled(taxVersion, '§2')) return;

  const subtotal = lines
    .filter((line) => line.component !== 'moms')
    .reduce((sum, line) => sum + (line.billedAmount ?? line.amount), 0);
  if (subtotal <= 0) return;

  const vat = subtotal * (taxVersion.taxValues.vatRate ?? 0.25);
  lines.push({
    id,
    component: 'moms',
    paragraphRef: '§2',
    description: 'Mervärdesskatt',
    basis: basisDescription,
    amount: vat,
    calculatedAmount: vat,
    billedAmount: vat,
    baseAmount: subtotal,
    share: taxVersion.taxValues.vatRate ?? 0.25,
    precision: 2,
    ruleIds: ['§2'],
  });
  if (ruleTrace) pushTrace(ruleTrace, '§2');
}
