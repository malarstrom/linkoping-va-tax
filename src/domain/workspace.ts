import type { PropertyProfile, WorkspaceState } from './types';
import { seedWorkspaceState } from './seed';

const STORAGE_KEY = 'va-taxemotor.workspace.v1';

export function loadWorkspace(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedWorkspaceState;
    return JSON.parse(raw) as WorkspaceState;
  } catch {
    return seedWorkspaceState;
  }
}

export function saveWorkspace(state: WorkspaceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createEmptyProfile(id: string): PropertyProfile {
  return {
    id,
    name: 'Ny fastighet',
    propertyType: 'bostadsfastighet',
    tomtyta: '',
    bostadsenheter: '1',
    services: [
      { code: 'V', enabled: true },
      { code: 'S', enabled: true },
      { code: 'Df', enabled: true },
      { code: 'Dg', enabled: false },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentRevisionId: `${id}:rev1`,
    revisions: [],
  };
}
