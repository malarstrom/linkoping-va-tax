import type {
  PropertyProfile,
  PropertyProfileRevision,
  PropertyProfileSnapshot,
  PropertyType,
  ServiceCode,
  ServiceSelection,
} from './types';
import { createId } from './ids';

export function createDefaultServices(): ServiceSelection[] {
  return [
    { code: 'V', enabled: true },
    { code: 'S', enabled: true },
    { code: 'Df', enabled: true },
    { code: 'Dg', enabled: false },
  ];
}

export function createProfileSnapshot(profile: Pick<PropertyProfile, 'name' | 'propertyType' | 'tomtyta' | 'bostadsenheter' | 'services'>): PropertyProfileSnapshot {
  return {
    name: profile.name,
    propertyType: profile.propertyType,
    tomtyta: profile.tomtyta,
    bostadsenheter: profile.bostadsenheter,
    services: profile.services.map((service) => ({ ...service })),
  };
}

export function createProfileRevision(
  profileId: string,
  revisionNo: number,
  snapshot: PropertyProfileSnapshot,
  changedByAction: string,
): PropertyProfileRevision {
  return {
    id: createId('profile-revision'),
    profileId,
    revisionNo,
    snapshot,
    changedByAction,
    createdAt: new Date().toISOString(),
  };
}

export function createEmptyProfile(name = 'Ny fastighet'): PropertyProfile {
  const id = createId('profile');
  const snapshot = createProfileSnapshot({
    name,
    propertyType: 'bostadsfastighet',
    tomtyta: '',
    bostadsenheter: '1',
    services: createDefaultServices(),
  });
  const firstRevision = createProfileRevision(id, 1, snapshot, 'create');

  return {
    id,
    ...snapshot,
    createdAt: firstRevision.createdAt,
    updatedAt: firstRevision.createdAt,
    currentRevisionId: firstRevision.id,
    revisions: [firstRevision],
  };
}

export function updateProfile(
  profile: PropertyProfile,
  patch: Partial<Pick<PropertyProfile, 'name' | 'propertyType' | 'tomtyta' | 'bostadsenheter' | 'services'>>,
  changedByAction = 'edit',
): PropertyProfile {
  const nextSnapshot = createProfileSnapshot({
    name: patch.name ?? profile.name,
    propertyType: patch.propertyType ?? profile.propertyType,
    tomtyta: patch.tomtyta ?? profile.tomtyta,
    bostadsenheter: patch.bostadsenheter ?? profile.bostadsenheter,
    services: patch.services ?? profile.services,
  });
  const nextRevision = createProfileRevision(profile.id, profile.revisions.length + 1, nextSnapshot, changedByAction);

  return {
    ...profile,
    ...nextSnapshot,
    updatedAt: nextRevision.createdAt,
    currentRevisionId: nextRevision.id,
    revisions: [...profile.revisions, nextRevision],
  };
}

export function toggleService(profile: PropertyProfile, code: ServiceCode): PropertyProfile {
  const services = profile.services.map((service) =>
    service.code === code ? { ...service, enabled: !service.enabled } : service,
  );

  return updateProfile(profile, { services }, 'toggle-service');
}

export function applyPropertyTypeRules(profile: PropertyProfile, propertyType: PropertyType): PropertyProfile {
  const services = profile.services.map((service) =>
    service.code === 'Dg'
      ? { ...service, enabled: propertyType === 'bostadsfastighet' ? service.enabled : false }
      : service,
  );

  return updateProfile(profile, { propertyType, services }, 'change-property-type');
}
