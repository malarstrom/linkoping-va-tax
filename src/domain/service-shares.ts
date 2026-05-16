import type { ServiceCode, TaxVersion } from './types';

export type ServiceShareComponent =
  | 'anlaggningServis'
  | 'anlaggningForbindelsepunkt'
  | 'anlaggningTomtyta'
  | 'anlaggningBostadsenhet'
  | 'anlaggningDfUtanForbindelsepunkt'
  | 'brukningGrundavgift'
  | 'brukningForbrukning'
  | 'brukningDagvatten'
  | 'brukningMatare';

const TAX_2026_09_01_SHARES: Record<ServiceShareComponent, Record<ServiceCode, number>> = {
  // §5.1 a / §6.1 a uses number of service pipes, not V/S/Df/Dg percentages.
  // Kept at 100% for selected connection services when a caller needs a generic servis share.
  anlaggningServis: { V: 1, S: 1, Df: 1, Dg: 0 },
  // §5.1 b / §6.1 b: 16 583 (27%) + 18 242 (30%) + 26 534 (43%) = 61 359.
  anlaggningForbindelsepunkt: { V: 16583 / 61359, S: 18242 / 61359, Df: 26534 / 61359, Dg: 0 },
  // §5.1 c / §6.1 c: 16,35 (24%) + 17,95 (27%) + 21,25 (32%) + 11,45 (17%) = 67,00.
  anlaggningTomtyta: { V: 16.35 / 67, S: 17.95 / 67, Df: 21.25 / 67, Dg: 11.45 / 67 },
  // §5.1 d: 10 509 (48%) + 11 560 (52%) = 22 069.
  anlaggningBostadsenhet: { V: 10509 / 22069, S: 11560 / 22069, Df: 0, Dg: 0 },
  // §5.1 e / §6.1 d belongs only to Df and is 100% of that row.
  anlaggningDfUtanForbindelsepunkt: { V: 0, S: 0, Df: 1, Dg: 0 },
  // §13.1 a: 821 (44%) + 1 029 (56%) = 1 850.
  brukningGrundavgift: { V: 821 / 1850, S: 1029 / 1850, Df: 0, Dg: 0 },
  // §13.1 b belongs to V.
  brukningForbrukning: { V: 1, S: 0, Df: 0, Dg: 0 },
  // §13.1 c: 1,25 (66%) + 0,65 (34%) = 1,90.
  brukningDagvatten: { V: 0, S: 0, Df: 1.25 / 1.9, Dg: 0.65 / 1.9 },
  // Meter fee belongs to V.
  brukningMatare: { V: 1, S: 0, Df: 0, Dg: 0 },
};

function taxValueKey(component: ServiceShareComponent, code: ServiceCode): string {
  return `serviceShare.${component}.${code}`;
}

export function selectedServiceCodes(services: { code: ServiceCode; enabled: boolean }[]): ServiceCode[] {
  return services.filter((service) => service.enabled).map((service) => service.code);
}

export function serviceShare(
  taxVersion: TaxVersion,
  component: ServiceShareComponent,
  enabledServices: ServiceCode[],
): number {
  const defaults = TAX_2026_09_01_SHARES[component];
  const share = enabledServices.reduce((sum, code) => {
    const configured = taxVersion.taxValues[taxValueKey(component, code)];
    return sum + (typeof configured === 'number' ? configured : defaults[code]);
  }, 0);

  return Math.max(0, Math.min(1, share));
}

export function serviceShareBasis(
  taxVersion: TaxVersion,
  component: ServiceShareComponent,
  enabledServices: ServiceCode[],
): string {
  const defaults = TAX_2026_09_01_SHARES[component];
  const parts = enabledServices
    .map((code) => {
      const configured = taxVersion.taxValues[taxValueKey(component, code)];
      const share = typeof configured === 'number' ? configured : defaults[code];
      if (share <= 0) return null;
      return `${code} ${Math.round(share * 100)} %`;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' + ') : '0 %';
}
