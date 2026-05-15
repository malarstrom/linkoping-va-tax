import type { WorkspaceState } from './types';
import { seedTaxVersions } from './tax-versions';

export const seedWorkspaceState: WorkspaceState = {
  profiles: [],
  calculations: [],
  activeProfileId: null,
  activeCalculationId: null,
  activeTaxVersionId: seedTaxVersions[0]?.id ?? null,
  taxVersions: seedTaxVersions,
};
