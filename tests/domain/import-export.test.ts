import { describe, expect, it } from 'vitest';
import { buildWorkspaceImportPlan, exportWorkspacePackage, parseWorkspaceExport } from '../../src/domain/import-export';
import { createEmptyProfile } from '../../src/domain/profile';
import { seedWorkspaceState } from '../../src/domain/seed';

describe('import/export', () => {
  it('exports schema version and parses future additive fields', () => {
    const exported = JSON.parse(exportWorkspacePackage({
      ...seedWorkspaceState,
      profiles: [createEmptyProfile()],
    }));

    exported.schemaVersion = 2;
    exported.futureField = { hello: 'world' };

    const parsed = parseWorkspaceExport(JSON.stringify(exported));
    expect(parsed?.schemaVersion).toBe(2);
    expect(parsed?.workspace.profiles).toHaveLength(1);
  });

  it('creates a conflict plan for matching UUIDs', () => {
    const profile = createEmptyProfile();
    const current = { ...seedWorkspaceState, profiles: [profile] };
    const incoming = parseWorkspaceExport(exportWorkspacePackage(current));

    expect(incoming).toBeTruthy();
    const plan = buildWorkspaceImportPlan(current, incoming!);
    expect(plan.conflicts.some((conflict) => conflict.kind === 'profile' && conflict.id === profile.id)).toBe(true);
  });
});
