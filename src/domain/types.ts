export type PropertyType = 'bostadsfastighet' | 'annan fastighet' | 'obebyggd fastighet';
export type ServiceCode = 'V' | 'S' | 'Df' | 'Dg';
export type CalculationMode = 'preliminary' | 'final';
export type CalculationStatus = 'draft' | 'calculated' | 'debited';
export type BillingInterval = 'monthly' | 'quarterly' | 'tertial' | 'semiannual';
export type MeterType = 'DN20 smallhus' | 'DN20' | 'DN25' | 'DN40';
export type SpecialActionCode = 'meter-removal' | 'meter-installation' | 'shutoff' | 'restart' | 'inspection' | 'tank-cleaning' | 'wasted-visit';

export interface ServiceSelection {
  code: ServiceCode;
  enabled: boolean;
}

export interface PropertyProfileRevision {
  id: string;
  profileId: string;
  revisionNo: number;
  snapshot: PropertyProfileSnapshot;
  changedByAction: string;
  createdAt: string;
}

export interface PropertyProfileSnapshot {
  name: string;
  propertyType: PropertyType;
  tomtyta: string;
  bostadsenheter: string;
  services: ServiceSelection[];
}

export interface PropertyProfile {
  id: string;
  name: string;
  propertyType: PropertyType;
  tomtyta: string;
  bostadsenheter: string;
  services: ServiceSelection[];
  createdAt: string;
  updatedAt: string;
  currentRevisionId: string;
  revisions: PropertyProfileRevision[];
}

export interface CalculationLine {
  id: string;
  component: 'anläggningsavgift' | 'brukningsavgift' | 'moms' | 'särskild åtgärd';
  paragraphRef: string;
  description: string;
  basis: string;
  amount: number;
  calculatedAmount?: number;
  billedAmount?: number;
  baseAmount?: number;
  share?: number;
  reductionReason?: string;
  precision: number;
  ruleIds: string[];
}

export interface CalculationResult {
  calculatedTotal: number;
  total: number;
  lines: CalculationLine[];
  ruleTrace: string[];
}

export interface CalculationRevision {
  id: string;
  calculationCaseId: string;
  revisionNo: number;
  inputSnapshot: CalculationInputSnapshot;
  resultSnapshot: CalculationResult;
  manualAdjustments: ManualAdjustment[];
  createdAt: string;
}

export interface AnlaggningsavgiftScenario {
  sharedConnectionCount: number;
  samfollighet: boolean;
  addedServisledningar: number;
  addedTomtyta: string;
  addedBostadsenheter: number;
  dfWithoutConnection: boolean;
}

export interface BrukningsavgiftScenario {
  billingInterval: BillingInterval;
  estimatedConsumptionM3: string;
  useEstimatedConsumption: boolean;
  meterType: MeterType;
  propertyTransferRequested: boolean;
  annualMeterReadingCompleted: boolean;
  latePaymentDays: number;
  afterHours: boolean;
  specialActions: SpecialActionCode[];
}

export interface CalculationInputSnapshot {
  profileId: string;
  profileRevisionId: string;
  taxVersionId: string;
  mode: CalculationMode;
  anlaggningsavgiftScenario: AnlaggningsavgiftScenario;
  brukningsavgiftScenario: BrukningsavgiftScenario;
}

export interface ManualAdjustment {
  id: string;
  targetLineId: string;
  reason: string;
  delta: number;
  createdAt: string;
}

export interface CalculationCase {
  id: string;
  profileId: string;
  taxVersionId: string;
  mode: CalculationMode;
  status: CalculationStatus;
  currentRevisionId: string;
  createdAt: string;
  updatedAt: string;
  revisions: CalculationRevision[];
}

export interface TaxRule {
  id: string;
  paragraphRef: string;
  appliesTo: string[];
  sourceText: string;
}

export interface TaxVersion {
  id: string;
  label: string;
  validFrom: string;
  validTo: string;
  enabledRules: string[];
  taxValues: Record<string, number>;
  rules: TaxRule[];
}

export interface WorkspaceState {
  profiles: PropertyProfile[];
  calculations: CalculationCase[];
  activeProfileId: string | null;
  activeCalculationId: string | null;
  activeTaxVersionId: string | null;
  taxVersions: TaxVersion[];
}
