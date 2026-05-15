import type { TaxVersion } from './types';

const seedTaxValues = {
  servisavgift1: 43750,
  servisavgift2: 53125,
  servisavgift3: 62500,
  forbindelsepunkt: 61359,
  tomtyteavgift: 67,
  tomtyteavgiftCap: 43750,
  bostadsenhetsavgift: 22069,
  dagvattenutanforbindelsepunkt: 35909,
  brukningsgrundavgiftAnnual: 1850,
  brukningsm3Rate: 22.35,
  brukningsdagvattenRate: 1.9,
  brukningsmeterDn20Smallhus: 1479,
  brukningsmeterDn20: 5916,
  brukningsmeterDn25: 11832,
  brukningsmeterDn40: 23664,
  specialServiceFee: 1444,
  specialServiceFeeCap: 1444,
  specialServiceAfterHoursCap: 2888,
  vatRate: 0.25,
  lateInterestRate: 0.08,
};

export const seedTaxVersions: TaxVersion[] = [
  {
    id: 'tax-2026-09-01',
    label: 'Taxa 2026-09-01',
    validFrom: '2026-09-01',
    validTo: '9999-12-31',
    enabledRules: ['§2', '§4', '§5', '§6', '§7', '§13', '§14', '§15', '§16', '§17', '§18', '§19', '§20', '§21'],
    taxValues: { ...seedTaxValues },
    rules: [
      { id: '§2', paragraphRef: '§2', appliesTo: ['brukningsavgift'], sourceText: 'Mervärdesskatt som separat komponent.' },
      { id: '§5.1 c', paragraphRef: '§5.1 c', appliesTo: ['anläggningsavgift'], sourceText: 'Tomtyteavgift med begränsningsregel.' },
      { id: '§17', paragraphRef: '§17', appliesTo: ['brukningsavgift'], sourceText: 'Särskilda åtgärder.' },
      { id: '§18', paragraphRef: '§18', appliesTo: ['brukningsavgift'], sourceText: 'Dröjsmålsränta.' },
    ],
  },
  {
    id: 'tax-2026-01-01-arkiv',
    label: 'Taxa 2026-01-01 (arkivkopia)',
    validFrom: '2026-01-01',
    validTo: '2026-08-31',
    enabledRules: ['§2', '§4', '§5', '§6', '§7', '§13', '§14', '§15', '§16', '§18', '§19', '§20', '§21'],
    taxValues: { ...seedTaxValues, specialServiceFeeCap: 0 },
    rules: [
      { id: '§2', paragraphRef: '§2', appliesTo: ['brukningsavgift'], sourceText: 'Mervärdesskatt som separat komponent.' },
      { id: '§5.1 c', paragraphRef: '§5.1 c', appliesTo: ['anläggningsavgift'], sourceText: 'Tomtyteavgift med begränsningsregel.' },
      { id: '§18', paragraphRef: '§18', appliesTo: ['brukningsavgift'], sourceText: 'Dröjsmålsränta.' },
    ],
  },
];

function parseDate(value: string): number {
  return new Date(`${value}T00:00:00Z`).getTime();
}

export function assertDisjointTaxVersions(versions: TaxVersion[]): void {
  const sorted = [...versions].sort((left, right) => parseDate(left.validFrom) - parseDate(right.validFrom));

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];

    if (parseDate(current.validFrom) <= parseDate(previous.validTo)) {
      throw new Error(`Taxeversioner överlappar: ${previous.id} och ${current.id}`);
    }
  }
}

export function getDefaultTaxVersionId(versions: TaxVersion[]): string | null {
  return versions[0]?.id ?? null;
}

export function findTaxVersion(versions: TaxVersion[], taxVersionId: string | null | undefined): TaxVersion | null {
  if (!taxVersionId) return null;
  return versions.find((version) => version.id === taxVersionId) ?? null;
}

assertDisjointTaxVersions(seedTaxVersions);
