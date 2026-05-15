import type { CalculationCase, PropertyProfile, TaxVersion, WorkspaceState } from './types';

export const WORKSPACE_EXPORT_SCHEMA_VERSION = 1 as const;

export type ImportResolution = 'keep-existing' | 'replace-imported' | 'merge-history';
export type ImportConflictKind = 'profile' | 'calculation' | 'taxVersion';

export interface WorkspaceExportPackageV1 {
  schemaVersion: number;
  exportedAt: string;
  app: 'va-taxemotor';
  workspace: WorkspaceState;
}

export interface WorkspaceImportConflict {
  kind: ImportConflictKind;
  id: string;
  label: string;
  currentLabel: string;
  importedLabel: string;
  resolution: ImportResolution;
}

export interface WorkspaceImportPlan {
  package: WorkspaceExportPackageV1;
  conflicts: WorkspaceImportConflict[];
}

export interface WorkspaceImportChoice {
  kind: ImportConflictKind;
  id: string;
  resolution: ImportResolution;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asWorkspaceState(value: unknown): WorkspaceState | null {
  if (!isRecord(value)) return null;

  return {
    profiles: asArray<PropertyProfile>(value.profiles),
    calculations: asArray<CalculationCase>(value.calculations),
    activeProfileId: typeof value.activeProfileId === 'string' || value.activeProfileId === null ? (value.activeProfileId as string | null) : null,
    activeCalculationId:
      typeof value.activeCalculationId === 'string' || value.activeCalculationId === null ? (value.activeCalculationId as string | null) : null,
    activeTaxVersionId:
      typeof value.activeTaxVersionId === 'string' || value.activeTaxVersionId === null ? (value.activeTaxVersionId as string | null) : null,
    taxVersions: asArray<TaxVersion>(value.taxVersions),
  };
}

function asExportPackage(value: unknown): WorkspaceExportPackageV1 | null {
  if (!isRecord(value)) return null;

  const schemaVersion = typeof value.schemaVersion === 'number' ? value.schemaVersion : null;
  const workspace = asWorkspaceState(value.workspace);

  if (!schemaVersion || schemaVersion < WORKSPACE_EXPORT_SCHEMA_VERSION || !workspace) {
    return null;
  }

  return {
    schemaVersion,
    exportedAt: asString(value.exportedAt, new Date().toISOString()),
    app: 'va-taxemotor',
    workspace,
  };
}

export function exportWorkspacePackage(state: WorkspaceState): string {
  const payload: WorkspaceExportPackageV1 = {
    schemaVersion: WORKSPACE_EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'va-taxemotor',
    workspace: state,
  };

  return JSON.stringify(payload, null, 2);
}

export function parseWorkspaceExport(raw: string): WorkspaceExportPackageV1 | null {
  try {
    return asExportPackage(JSON.parse(raw));
  } catch {
    return null;
  }
}

function labelProfile(profile: PropertyProfile | undefined): string {
  if (!profile) return 'okänd profil';
  return `${profile.name} (${profile.id})`;
}

function labelCalculation(calculation: CalculationCase | undefined): string {
  if (!calculation) return 'okänd beräkning';
  return `${calculation.id}`;
}

function labelTaxVersion(version: TaxVersion | undefined): string {
  if (!version) return 'okänd taxeversion';
  return `${version.label} (${version.id})`;
}

function mergeUniqueById<T extends { id: string }>(currentItems: T[], importedItems: T[]): T[] {
  const merged = [...currentItems];
  const existingIds = new Set(currentItems.map((item) => item.id));

  for (const item of importedItems) {
    if (existingIds.has(item.id)) continue;
    merged.unshift(item);
  }

  return merged;
}

function mergeProfile(current: PropertyProfile, imported: PropertyProfile): PropertyProfile {
  const revisions = mergeUniqueById(current.revisions, imported.revisions).sort((left, right) => {
    if (left.revisionNo !== right.revisionNo) return left.revisionNo - right.revisionNo;
    return left.createdAt.localeCompare(right.createdAt);
  });

  return {
    ...current,
    ...imported,
    revisions,
    currentRevisionId: imported.currentRevisionId || current.currentRevisionId,
  };
}

function mergeCalculation(current: CalculationCase, imported: CalculationCase): CalculationCase {
  const revisions = mergeUniqueById(current.revisions, imported.revisions).sort((left, right) => {
    if (left.revisionNo !== right.revisionNo) return left.revisionNo - right.revisionNo;
    return left.createdAt.localeCompare(right.createdAt);
  });

  return {
    ...current,
    ...imported,
    revisions,
    currentRevisionId: imported.currentRevisionId || current.currentRevisionId,
  };
}

function mergeTaxVersion(current: TaxVersion, imported: TaxVersion): TaxVersion {
  return {
    ...current,
    ...imported,
  };
}

export function buildWorkspaceImportPlan(current: WorkspaceState, incoming: WorkspaceExportPackageV1): WorkspaceImportPlan {
  const conflicts: WorkspaceImportConflict[] = [];

  for (const importedProfile of incoming.workspace.profiles) {
    const currentProfile = current.profiles.find((profile) => profile.id === importedProfile.id);
    if (currentProfile) {
      conflicts.push({
        kind: 'profile',
        id: importedProfile.id,
        label: labelProfile(importedProfile),
        currentLabel: labelProfile(currentProfile),
        importedLabel: labelProfile(importedProfile),
        resolution: 'merge-history',
      });
    }
  }

  for (const importedCalculation of incoming.workspace.calculations) {
    const currentCalculation = current.calculations.find((calculation) => calculation.id === importedCalculation.id);
    if (currentCalculation) {
      conflicts.push({
        kind: 'calculation',
        id: importedCalculation.id,
        label: labelCalculation(importedCalculation),
        currentLabel: labelCalculation(currentCalculation),
        importedLabel: labelCalculation(importedCalculation),
        resolution: 'merge-history',
      });
    }
  }

  for (const importedVersion of incoming.workspace.taxVersions) {
    const currentVersion = current.taxVersions.find((version) => version.id === importedVersion.id);
    if (currentVersion) {
      conflicts.push({
        kind: 'taxVersion',
        id: importedVersion.id,
        label: labelTaxVersion(importedVersion),
        currentLabel: labelTaxVersion(currentVersion),
        importedLabel: labelTaxVersion(importedVersion),
        resolution: 'replace-imported',
      });
    }
  }

  return { package: incoming, conflicts };
}

export function applyWorkspaceImport(
  current: WorkspaceState,
  plan: WorkspaceImportPlan,
  choices: WorkspaceImportChoice[],
): WorkspaceState {
  const choiceByKey = new Map(choices.map((choice) => [`${choice.kind}:${choice.id}`, choice.resolution]));
  const imported = plan.package.workspace;

  const nextProfiles = [...current.profiles];
  for (const importedProfile of imported.profiles) {
    const index = nextProfiles.findIndex((profile) => profile.id === importedProfile.id);
    if (index === -1) {
      nextProfiles.unshift(importedProfile);
      continue;
    }

    const resolution = choiceByKey.get(`profile:${importedProfile.id}`) ?? 'merge-history';
    if (resolution === 'keep-existing') continue;
    nextProfiles[index] = resolution === 'merge-history' ? mergeProfile(nextProfiles[index], importedProfile) : importedProfile;
  }

  const nextCalculations = [...current.calculations];
  for (const importedCalculation of imported.calculations) {
    const index = nextCalculations.findIndex((calculation) => calculation.id === importedCalculation.id);
    if (index === -1) {
      nextCalculations.unshift(importedCalculation);
      continue;
    }

    const resolution = choiceByKey.get(`calculation:${importedCalculation.id}`) ?? 'merge-history';
    if (resolution === 'keep-existing') continue;
    nextCalculations[index] = resolution === 'merge-history' ? mergeCalculation(nextCalculations[index], importedCalculation) : importedCalculation;
  }

  const nextTaxVersions = [...current.taxVersions];
  for (const importedVersion of imported.taxVersions) {
    const index = nextTaxVersions.findIndex((version) => version.id === importedVersion.id);
    if (index === -1) {
      nextTaxVersions.push(importedVersion);
      continue;
    }

    const resolution = choiceByKey.get(`taxVersion:${importedVersion.id}`) ?? 'replace-imported';
    if (resolution === 'keep-existing') continue;
    nextTaxVersions[index] = mergeTaxVersion(nextTaxVersions[index], importedVersion);
  }

  const activeProfileId = nextProfiles.some((profile) => profile.id === imported.activeProfileId)
    ? imported.activeProfileId
    : current.activeProfileId;
  const activeCalculationId = nextCalculations.some((calculation) => calculation.id === imported.activeCalculationId)
    ? imported.activeCalculationId
    : current.activeCalculationId;
  const activeTaxVersionId = nextTaxVersions.some((version) => version.id === imported.activeTaxVersionId)
    ? imported.activeTaxVersionId
    : current.activeTaxVersionId;

  return {
    profiles: nextProfiles,
    calculations: nextCalculations,
    activeProfileId,
    activeCalculationId,
    activeTaxVersionId,
    taxVersions: nextTaxVersions,
  };
}
