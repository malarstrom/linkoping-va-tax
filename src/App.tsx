import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { applyManualAdjustment, createCalculationCase } from '@/domain/calculations';
import { calculatePreview } from '@/domain/calculate';
import { createEmptyProfile, toggleService, updateProfile } from '@/domain/profile';
import { applyWorkspaceImport, buildWorkspaceImportPlan, exportWorkspacePackage, parseWorkspaceExport, type ImportResolution, type WorkspaceImportPlan } from '@/domain/import-export';
import { seedWorkspaceState } from '@/domain/seed';
import { findTaxVersion, getDefaultTaxVersionId } from '@/domain/tax-versions';
import { loadWorkspaceState, saveWorkspaceState } from '@/domain/workspace-storage';
import type { AnlaggningsavgiftScenario, BrukningsavgiftScenario, CalculationCase, PropertyProfile, PropertyType, ServiceCode, TaxVersion, WorkspaceState } from '@/domain/types';

function ensureWorkspace(state: WorkspaceState | null): WorkspaceState {
  const base = state ?? seedWorkspaceState;
  const profiles = base.profiles.length > 0 ? base.profiles : [createEmptyProfile()];
  const taxVersions = base.taxVersions.length > 0 ? base.taxVersions : seedWorkspaceState.taxVersions;
  const activeTaxVersionId = findTaxVersion(taxVersions, base.activeTaxVersionId)?.id ?? getDefaultTaxVersionId(taxVersions);

  return {
    ...base,
    profiles,
    calculations: base.calculations ?? [],
    activeProfileId: base.activeProfileId ?? profiles[0].id,
    activeCalculationId: base.activeCalculationId ?? null,
    activeTaxVersionId,
    taxVersions,
  };
}

function latestRevision(calculation: CalculationCase) {
  return calculation.revisions[calculation.revisions.length - 1] ?? null;
}

function importChoiceKey(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export default function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [importPlan, setImportPlan] = useState<WorkspaceImportPlan | null>(null);
  const [importChoices, setImportChoices] = useState<Record<string, ImportResolution>>({});
  const [importError, setImportError] = useState<string | null>(null);
  const [manualAdjustmentError, setManualAdjustmentError] = useState<string | null>(null);
  const [manualAdjustmentTargetId, setManualAdjustmentTargetId] = useState<string>('');
  const [manualAdjustmentReason, setManualAdjustmentReason] = useState('');
  const [manualAdjustmentDelta, setManualAdjustmentDelta] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [anlaggningsScenario, setAnlaggningsScenario] = useState<AnlaggningsavgiftScenario>({
    sharedConnectionCount: 1,
    samfollighet: false,
    addedServisledningar: 0,
    addedTomtyta: '',
    addedBostadsenheter: 0,
    dfWithoutConnection: false,
  });
  const [brukningsScenario, setBrukningsScenario] = useState<BrukningsavgiftScenario>({
    billingInterval: 'quarterly',
    estimatedConsumptionM3: '',
    useEstimatedConsumption: false,
    meterType: 'DN20 smallhus',
    propertyTransferRequested: false,
    annualMeterReadingCompleted: true,
    latePaymentDays: 0,
    afterHours: false,
    specialActions: [],
  });

  useEffect(() => {
    let mounted = true;

    void loadWorkspaceState()
      .then((stored) => {
        if (!mounted) return;
        setWorkspace(ensureWorkspace(stored));
        setHydrated(true);
      })
      .catch(() => {
        if (!mounted) return;
        setWorkspace(ensureWorkspace(null));
        setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !workspace) return;
    void saveWorkspaceState(workspace);
  }, [workspace, hydrated]);

  const activeProfile = useMemo<PropertyProfile | null>(() => {
    if (!workspace) return null;
    return workspace.profiles.find((profile) => profile.id === workspace.activeProfileId) ?? workspace.profiles[0] ?? null;
  }, [workspace]);

  const activeCalculation = useMemo<CalculationCase | null>(() => {
    if (!workspace || !workspace.activeCalculationId) return null;
    return workspace.calculations.find((calculation) => calculation.id === workspace.activeCalculationId) ?? null;
  }, [workspace]);

  useEffect(() => {
    const firstLineId = activeCalculation ? latestRevision(activeCalculation)?.resultSnapshot.lines[0]?.id ?? '' : '';
    setManualAdjustmentTargetId(firstLineId);
    setManualAdjustmentReason('');
    setManualAdjustmentDelta('');
    setManualAdjustmentError(null);
  }, [activeCalculation?.id]);

  const activeTaxVersion = useMemo<TaxVersion | null>(() => {
    if (!workspace) return null;
    return findTaxVersion(workspace.taxVersions, workspace.activeTaxVersionId) ?? workspace.taxVersions[0] ?? null;
  }, [workspace]);

  const livePreview = useMemo(() => {
    if (!activeProfile || !activeTaxVersion) return null;
    return calculatePreview(activeProfile, activeTaxVersion);
  }, [activeProfile, activeTaxVersion]);

  const setActiveProfile = (profileId: string) => {
    setWorkspace((current) => (current ? { ...current, activeProfileId: profileId, activeCalculationId: null } : current));
  };

  const setActiveTaxVersion = (taxVersionId: string) => {
    setWorkspace((current) => {
      if (!current) return current;
      const nextVersion = findTaxVersion(current.taxVersions, taxVersionId);
      if (!nextVersion) return current;
      return { ...current, activeTaxVersionId: nextVersion.id };
    });
  };

  const createProfile = () => {
    const profile = createEmptyProfile();
    setWorkspace((current) => {
      const base = current ?? ensureWorkspace(null);
      return {
        ...base,
        profiles: [profile, ...base.profiles],
        activeProfileId: profile.id,
        activeCalculationId: null,
      };
    });
  };

  const deleteProfile = (profileId: string) => {
    setWorkspace((current) => {
      if (!current) return current;
      const remaining = current.profiles.filter((profile) => profile.id !== profileId);
      const nextProfiles = remaining.length > 0 ? remaining : [createEmptyProfile()];
      const nextActiveProfileId = nextProfiles[0]?.id ?? null;
      const nextCalculations = current.calculations.filter((calculation) => calculation.profileId !== profileId);
      const nextActiveCalculationId = nextCalculations.some((calculation) => calculation.id === current.activeCalculationId)
        ? current.activeCalculationId
        : null;

      return {
        ...current,
        profiles: nextProfiles,
        calculations: nextCalculations,
        activeProfileId: nextActiveProfileId,
        activeCalculationId: nextActiveCalculationId,
      };
    });
  };

  const updateActiveProfile = (
    patch: Partial<Pick<PropertyProfile, 'name' | 'propertyType' | 'tomtyta' | 'bostadsenheter' | 'services'>>,
  ) => {
    setWorkspace((current) => {
      if (!current) return current;

      const targetId = current.activeProfileId ?? current.profiles[0]?.id;
      if (!targetId) return current;

      return {
        ...current,
        profiles: current.profiles.map((profile) => (profile.id === targetId ? updateProfile(profile, patch) : profile)),
      };
    });
  };

  const handleServiceToggle = (code: ServiceCode) => {
    setWorkspace((current) => {
      if (!current) return current;

      const targetId = current.activeProfileId ?? current.profiles[0]?.id;
      if (!targetId) return current;

      return {
        ...current,
        profiles: current.profiles.map((profile) => {
          if (profile.id !== targetId) return profile;
          return toggleService(profile, code);
        }),
      };
    });
  };

  const saveCalculation = () => {
    if (!activeProfile || !activeTaxVersion) return;
    const calculation = createCalculationCase(activeProfile, activeTaxVersion, 'final', anlaggningsScenario, brukningsScenario);

    setWorkspace((current) => {
      if (!current) return current;
      return {
        ...current,
        calculations: [calculation, ...current.calculations],
        activeCalculationId: calculation.id,
      };
    });
  };

  const rerunSelectedCalculation = () => {
    if (!workspace || !activeCalculation || !activeTaxVersion) return;
    const sourceProfile = workspace.profiles.find((profile) => profile.id === activeCalculation.profileId);
    const latestInput = latestRevision(activeCalculation)?.inputSnapshot;
    if (!sourceProfile || !latestInput) return;

    const calculation = createCalculationCase(
      sourceProfile,
      activeTaxVersion,
      latestInput.mode,
      latestInput.anlaggningsavgiftScenario,
      latestInput.brukningsavgiftScenario,
    );
    setWorkspace((current) => {
      if (!current) return current;
      return {
        ...current,
        activeProfileId: sourceProfile.id,
        calculations: [calculation, ...current.calculations],
        activeCalculationId: calculation.id,
      };
    });
  };

  const deleteCalculation = (calculationId: string) => {
    setWorkspace((current) => {
      if (!current) return current;
      const remaining = current.calculations.filter((calculation) => calculation.id !== calculationId);
      const nextActiveCalculationId = current.activeCalculationId === calculationId ? remaining[0]?.id ?? null : current.activeCalculationId;
      return {
        ...current,
        calculations: remaining,
        activeCalculationId: remaining.length > 0 ? nextActiveCalculationId : null,
      };
    });
  };

  const exportWorkspace = () => {
    if (!workspace) return;

    const json = exportWorkspacePackage(workspace);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `va-taxemotor-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openImportPicker = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = parseWorkspaceExport(raw);
      if (!parsed) {
        setImportError('Kunde inte läsa JSON-exporten.');
        return;
      }

      const currentWorkspace = ensureWorkspace(workspace);
      const plan = buildWorkspaceImportPlan(currentWorkspace, parsed);

      if (plan.conflicts.length === 0) {
        setWorkspace(ensureWorkspace(applyWorkspaceImport(currentWorkspace, plan, [])));
        return;
      }

      setImportChoices(
        Object.fromEntries(plan.conflicts.map((conflict) => [importChoiceKey(conflict.kind, conflict.id), conflict.resolution])),
      );
      setImportPlan(plan);
    } catch {
      setImportError('Kunde inte importera filen.');
    }
  };

  const commitImportPlan = () => {
    if (!workspace || !importPlan) return;

    const choices = importPlan.conflicts.map((conflict) => ({
      kind: conflict.kind,
      id: conflict.id,
      resolution: importChoices[importChoiceKey(conflict.kind, conflict.id)] ?? conflict.resolution,
    }));

    setWorkspace(ensureWorkspace(applyWorkspaceImport(ensureWorkspace(workspace), importPlan, choices)));
    setImportPlan(null);
    setImportChoices({});
  };

  const cancelImportPlan = () => {
    setImportPlan(null);
    setImportChoices({});
  };

  const commitManualAdjustment = () => {
    if (!workspace || !activeCalculation) return;

    const delta = Number.parseFloat(manualAdjustmentDelta.replace(',', '.'));
    if (!manualAdjustmentTargetId) {
      setManualAdjustmentError('Välj en rad.');
      return;
    }
    if (!manualAdjustmentReason.trim()) {
      setManualAdjustmentError('Motivering krävs.');
      return;
    }
    if (!Number.isFinite(delta) || delta === 0) {
      setManualAdjustmentError('Justering måste vara skild från noll.');
      return;
    }

    try {
      const updated = applyManualAdjustment(activeCalculation, manualAdjustmentTargetId, manualAdjustmentReason, delta);
      setWorkspace((current) => {
        if (!current) return current;
        return {
          ...current,
          calculations: current.calculations.map((calculation) => (calculation.id === updated.id ? updated : calculation)),
        };
      });
      setManualAdjustmentReason('');
      setManualAdjustmentDelta('');
      setManualAdjustmentError(null);
    } catch (error) {
      setManualAdjustmentError(error instanceof Error ? error.message : 'Kunde inte spara justeringen.');
    }
  };

  if (!workspace || !activeProfile || !activeTaxVersion) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-4xl rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">Laddar arbetsutrymme…</p>
        </div>
      </main>
    );
  }

  const visibleResult = activeCalculation ? latestRevision(activeCalculation)?.resultSnapshot ?? livePreview : livePreview;
  const visibleVersion = activeCalculation
    ? findTaxVersion(workspace.taxVersions, activeCalculation.taxVersionId) ?? activeTaxVersion
    : activeTaxVersion;
  const visibleProfile = activeCalculation
    ? workspace.profiles.find((profile) => profile.id === activeCalculation.profileId) ?? activeProfile
    : activeProfile;

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">VA taxemotor</p>
              <h1 className="mt-2 text-3xl font-semibold">Lokalt arbetsutrymme + versionerade taxeversioner</h1>
              <p className="mt-2 text-slate-600">Fastigheter, taxeversioner och beräkningar sparas lokalt i browsern.</p>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-72">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={openImportPicker} data-testid="import-json-button">
                  Importera JSON
                </Button>
                <Button type="button" variant="outline" onClick={exportWorkspace} data-testid="export-json-button">
                  Exportera JSON
                </Button>
              </div>

              <label className="space-y-2">
                <span className="text-sm font-medium">Taxeversion</span>
                <Select value={activeTaxVersion.id} onValueChange={setActiveTaxVersion}>
                  <SelectTrigger data-testid="tax-version-select">
                    <SelectValue placeholder="Välj taxeversion" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspace.taxVersions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {version.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Gäller {activeTaxVersion.validFrom} – {activeTaxVersion.validTo}
                </p>
              </label>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFileChange} />
          {importError ? <p className="mt-4 text-sm text-red-600">{importError}</p> : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-6 rounded-2xl border bg-white p-4 shadow-sm">
            <section>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Fastigheter</h2>
                <Button type="button" onClick={createProfile}>
                  Ny
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {workspace.profiles.map((profile) => {
                  const active = profile.id === activeProfile.id;
                  return (
                    <div
                      key={profile.id}
                      className={`w-full rounded-xl border px-3 py-2 transition ${
                        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <button type="button" className="w-full text-left" onClick={() => setActiveProfile(profile.id)}>
                        <div className="font-medium">{profile.name}</div>
                        <div className="text-xs opacity-80">{profile.propertyType}</div>
                      </button>
                      <div className="mt-2 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          data-testid={`delete-profile-${profile.id}`}
                          onClick={() => {
                            if (window.confirm(`Ta bort fastigheten ${profile.name}?`)) deleteProfile(profile.id);
                          }}
                        >
                          Ta bort
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Beräkningar</h2>
                <span className="text-xs text-slate-500">{workspace.calculations.length}</span>
              </div>
              <div className="mt-4 space-y-2">
                {workspace.calculations.length === 0 ? (
                  <p className="text-sm text-slate-500">Inga sparade beräkningar.</p>
                ) : (
                  workspace.calculations.map((calculation) => {
                    const revision = latestRevision(calculation);
                    const profile = workspace.profiles.find((item) => item.id === calculation.profileId);
                    const version = findTaxVersion(workspace.taxVersions, calculation.taxVersionId);
                    const active = calculation.id === activeCalculation?.id;

                    return (
                      <div
                        key={calculation.id}
                        className={`w-full rounded-xl border px-3 py-2 transition ${
                          active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => setWorkspace((current) => (current ? { ...current, activeCalculationId: calculation.id } : current))}
                        >
                          <div className="font-medium">{profile?.name ?? calculation.profileId}</div>
                          <div className="text-xs opacity-80">{version?.label ?? calculation.taxVersionId}</div>
                          <div className="text-xs opacity-80">{revision?.resultSnapshot.total.toLocaleString('sv-SE') ?? '—'} kr</div>
                        </button>
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            data-testid={`delete-calculation-${calculation.id}`}
                            onClick={() => {
                              if (window.confirm('Ta bort beräkningen?')) deleteCalculation(calculation.id);
                            }}
                          >
                            Ta bort
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </aside>

          <section className="space-y-4">
            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList>
                <TabsTrigger value="profile">Fastighet</TabsTrigger>
                <TabsTrigger value="resultat">Resultat</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Namn</span>
                    <Input data-testid="profile-name-input" value={activeProfile.name} onChange={(e) => updateActiveProfile({ name: e.target.value })} />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium">Fastighetstyp</span>
                    <Select
                      value={activeProfile.propertyType}
                      onValueChange={(value) => updateActiveProfile({ propertyType: value as PropertyType })}
                    >
                      <SelectTrigger data-testid="property-type-select">
                        <SelectValue placeholder="Välj fastighetstyp" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bostadsfastighet">bostadsfastighet</SelectItem>
                        <SelectItem value="annan fastighet">annan fastighet</SelectItem>
                        <SelectItem value="obebyggd fastighet">obebyggd fastighet</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium">Tomtyta (m²)</span>
                    <Input
                      inputMode="decimal"
                      value={activeProfile.tomtyta}
                      onChange={(e) => updateActiveProfile({ tomtyta: e.target.value })}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium">Bostadsenheter</span>
                    <Input
                      inputMode="numeric"
                      value={activeProfile.bostadsenheter}
                      onChange={(e) => updateActiveProfile({ bostadsenheter: e.target.value })}
                    />
                  </label>
                </div>

                <div className="mt-6 space-y-3">
                  <span className="text-sm font-medium">Tjänster</span>
                  <div className="flex flex-wrap gap-2">
                    {activeProfile.services.map((service) => (
                      <Button
                        key={service.code}
                        type="button"
                        variant={service.enabled ? 'default' : 'outline'}
                        onClick={() => handleServiceToggle(service.code)}
                      >
                        {service.code}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                  <p>
                    <strong>Fastighet-ID:</strong> {activeProfile.id}
                  </p>
                  <p>
                    <strong>Current revision:</strong> {activeProfile.currentRevisionId}
                  </p>
                  <p>
                    <strong>Revisioner:</strong> {activeProfile.revisions.length}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="resultat" className="rounded-2xl border bg-white p-6 shadow-sm">
                {visibleResult ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-slate-500">{activeCalculation ? 'Sparad beräkning' : 'Aktiv beräkning'}</p>
                        <h2 className="text-xl font-semibold">{visibleVersion?.label ?? activeTaxVersion.label}</h2>
                        <p className="text-sm text-slate-500">{visibleProfile.name}</p>
                      </div>
                      <p className="text-2xl font-semibold">{visibleResult.total.toLocaleString('sv-SE')} kr</p>
                      {visibleResult.calculatedTotal !== visibleResult.total ? (
                        <p className="text-sm text-slate-500">
                          Beräknat {visibleResult.calculatedTotal.toLocaleString('sv-SE')} kr
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-4 rounded-xl border bg-slate-50 p-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Delad förbindelsepunkt</span>
                        <Input
                          inputMode="numeric"
                          value={anlaggningsScenario.sharedConnectionCount}
                          onChange={(e) =>
                            setAnlaggningsScenario((current) => ({
                              ...current,
                              sharedConnectionCount: Number.parseInt(e.target.value, 10) || 1,
                            }))
                          }
                        />
                      </label>

                      <label className="flex items-center gap-2 pt-8 text-sm">
                        <input
                          type="checkbox"
                          checked={anlaggningsScenario.samfollighet}
                          onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, samfollighet: e.target.checked }))}
                        />
                        Samfällighet
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Tillkommande servisledningar</span>
                        <Input
                          inputMode="numeric"
                          value={anlaggningsScenario.addedServisledningar}
                          onChange={(e) =>
                            setAnlaggningsScenario((current) => ({
                              ...current,
                              addedServisledningar: Number.parseInt(e.target.value, 10) || 0,
                            }))
                          }
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Tillkommande tomtyta</span>
                        <Input
                          inputMode="decimal"
                          value={anlaggningsScenario.addedTomtyta}
                          onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, addedTomtyta: e.target.value }))}
                        />
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Tillkommande bostadsenheter</span>
                        <Input
                          inputMode="numeric"
                          value={anlaggningsScenario.addedBostadsenheter}
                          onChange={(e) =>
                            setAnlaggningsScenario((current) => ({
                              ...current,
                              addedBostadsenheter: Number.parseInt(e.target.value, 10) || 0,
                            }))
                          }
                        />
                      </label>

                      <label className="flex items-center gap-2 pt-8 text-sm">
                        <input
                          type="checkbox"
                          checked={anlaggningsScenario.dfWithoutConnection}
                          onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, dfWithoutConnection: e.target.checked }))}
                        />
                        Df utan etablerad förbindelsepunkt
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 rounded-xl border bg-slate-50 p-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-medium">Debiteringsintervall</span>
                        <Select
                          value={brukningsScenario.billingInterval}
                          onValueChange={(value) => setBrukningsScenario((current) => ({ ...current, billingInterval: value as BrukningsavgiftScenario['billingInterval'] }))}
                        >
                          <SelectTrigger data-testid="billing-interval-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">månadsvis</SelectItem>
                            <SelectItem value="quarterly">kvartal</SelectItem>
                            <SelectItem value="tertial">tertial</SelectItem>
                            <SelectItem value="semiannual">halvår</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Mätartyp</span>
                        <Select
                          value={brukningsScenario.meterType}
                          onValueChange={(value) => setBrukningsScenario((current) => ({ ...current, meterType: value as BrukningsavgiftScenario['meterType'] }))}
                        >
                          <SelectTrigger data-testid="meter-type-select">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DN20 smallhus">DN20 småhus</SelectItem>
                            <SelectItem value="DN20">DN20</SelectItem>
                            <SelectItem value="DN25">DN25</SelectItem>
                            <SelectItem value="DN40">DN40</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Uppskattad förbrukning (m³)</span>
                        <Input
                          inputMode="decimal"
                          value={brukningsScenario.estimatedConsumptionM3}
                          onChange={(e) => setBrukningsScenario((current) => ({ ...current, estimatedConsumptionM3: e.target.value }))}
                        />
                      </label>

                      <label className="flex items-center gap-2 pt-8 text-sm">
                        <input
                          type="checkbox"
                          checked={brukningsScenario.useEstimatedConsumption}
                          onChange={(e) => setBrukningsScenario((current) => ({ ...current, useEstimatedConsumption: e.target.checked }))}
                        />
                        Använd uppskattad förbrukning
                      </label>

                      <label className="space-y-2">
                        <span className="text-sm font-medium">Dröjsmål (dagar)</span>
                        <Input
                          inputMode="numeric"
                          value={brukningsScenario.latePaymentDays}
                          onChange={(e) =>
                            setBrukningsScenario((current) => ({
                              ...current,
                              latePaymentDays: Number.parseInt(e.target.value, 10) || 0,
                            }))
                          }
                        />
                      </label>

                      <label className="flex items-center gap-2 pt-8 text-sm">
                        <input
                          type="checkbox"
                          checked={brukningsScenario.afterHours}
                          onChange={(e) => setBrukningsScenario((current) => ({ ...current, afterHours: e.target.checked }))}
                        />
                        Utanför ordinarie arbetstid
                      </label>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={brukningsScenario.annualMeterReadingCompleted}
                          onChange={(e) => setBrukningsScenario((current) => ({ ...current, annualMeterReadingCompleted: e.target.checked }))}
                        />
                        Årlig mätaravläsning genomförd
                      </label>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={brukningsScenario.propertyTransferRequested}
                          onChange={(e) => setBrukningsScenario((current) => ({ ...current, propertyTransferRequested: e.target.checked }))}
                        />
                        Avläsning vid fastighetsöverlåtelse
                      </label>
                    </div>

                    <div className="mt-4 rounded-xl border bg-slate-50 p-4">
                      <p className="text-sm font-medium">Särskilda åtgärder</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(['meter-removal', 'meter-installation', 'shutoff', 'restart', 'inspection', 'tank-cleaning', 'wasted-visit'] as const).map((action) => {
                          const active = brukningsScenario.specialActions.includes(action);
                          return (
                            <Button
                              key={action}
                              type="button"
                              variant={active ? 'default' : 'outline'}
                              onClick={() =>
                                setBrukningsScenario((current) => ({
                                  ...current,
                                  specialActions: active
                                    ? current.specialActions.filter((item) => item !== action)
                                    : [...current.specialActions, action],
                                }))
                              }
                            >
                              {action}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeCalculation ? (
                        <Button type="button" onClick={rerunSelectedCalculation} data-testid="rerun-calculation-button">
                          Kör om med vald taxeversion
                        </Button>
                      ) : (
                        <Button type="button" onClick={saveCalculation} data-testid="save-calculation-button">
                          Spara beräkning
                        </Button>
                      )}
                    </div>

                    <div className="mt-6 space-y-3">
                      {visibleResult.lines.map((line) => (
                        <article key={line.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="font-medium">{line.description}</p>
                              <p className="text-sm text-slate-500">
                                {line.paragraphRef} · {line.basis}
                              </p>
                              {line.calculatedAmount !== undefined && line.billedAmount !== undefined && line.calculatedAmount !== line.billedAmount ? (
                                <p className="text-xs text-slate-500">
                                  Beräknad {line.calculatedAmount.toLocaleString('sv-SE')} kr · Debiterad {line.billedAmount.toLocaleString('sv-SE')} kr
                                </p>
                              ) : null}
                            </div>
                            <p className="font-semibold">{(line.billedAmount ?? line.amount).toLocaleString('sv-SE')} kr</p>
                          </div>
                        </article>
                      ))}
                    </div>

                    {activeCalculation ? (
                      <div className="mt-6 rounded-xl border bg-slate-50 p-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <label className="space-y-2 md:col-span-1">
                            <span className="text-sm font-medium">Rad</span>
                            <Select value={manualAdjustmentTargetId} onValueChange={setManualAdjustmentTargetId}>
                              <SelectTrigger data-testid="manual-adjustment-target-select">
                                <SelectValue placeholder="Välj rad" />
                              </SelectTrigger>
                              <SelectContent>
                                {visibleResult.lines.map((line) => (
                                  <SelectItem key={line.id} value={line.id}>
                                    {line.description}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </label>

                          <label className="space-y-2 md:col-span-1">
                            <span className="text-sm font-medium">Justering</span>
                            <Input
                              data-testid="manual-adjustment-delta-input"
                              inputMode="decimal"
                              value={manualAdjustmentDelta}
                              onChange={(e) => setManualAdjustmentDelta(e.target.value)}
                            />
                          </label>

                          <label className="space-y-2 md:col-span-3">
                            <span className="text-sm font-medium">Motivering</span>
                            <Input data-testid="manual-adjustment-reason-input" value={manualAdjustmentReason} onChange={(e) => setManualAdjustmentReason(e.target.value)} />
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button type="button" onClick={commitManualAdjustment} data-testid="save-manual-adjustment-button">
                            Spara manuell justering
                          </Button>
                          {manualAdjustmentError ? <p className="text-sm text-red-600">{manualAdjustmentError}</p> : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                      <p>
                        <strong>Taxeversion-ID:</strong> {activeCalculation?.taxVersionId ?? activeTaxVersion.id}
                      </p>
                      <p>
                        <strong>Fastighet-ID:</strong> {activeCalculation?.profileId ?? activeProfile.id}
                      </p>
                      <p>
                        <strong>Fastighetsrevision:</strong> {activeCalculation?.revisions.at(-1)?.inputSnapshot.profileRevisionId ?? activeProfile.currentRevisionId}
                      </p>
                      <p className="mt-2">
                        <strong>Regelspår:</strong> {visibleResult.ruleTrace.join(' → ')}
                      </p>
                      {activeCalculation?.revisions.at(-1)?.manualAdjustments.length ? (
                        <p className="mt-2">
                          <strong>Manuella justeringar:</strong>{' '}
                          {activeCalculation.revisions.at(-1)?.manualAdjustments.map((adj) => `${adj.reason} (${adj.delta})`).join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-600">Ingen beräkning tillgänglig.</p>
                )}
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>

      <Dialog open={Boolean(importPlan)} onOpenChange={(open) => (!open ? cancelImportPlan() : undefined)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importkonflikter</DialogTitle>
            <DialogDescription>
              Välj hur varje objekt ska hanteras. Importen bevarar revisionshistorik och full audit trace.
            </DialogDescription>
          </DialogHeader>

          {importPlan ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Export skapad {importPlan.package.exportedAt}. {importPlan.conflicts.length} objekt krockar.
              </p>

              <div className="space-y-3">
                {importPlan.conflicts.map((conflict) => {
                  const key = importChoiceKey(conflict.kind, conflict.id);
                  const value = importChoices[key] ?? conflict.resolution;

                  return (
                    <div key={key} className="rounded-lg border p-4">
                      <p className="font-medium">{conflict.kind}</p>
                      <p className="text-sm text-slate-500">ID: {conflict.id}</p>
                      <p className="text-sm text-slate-500">Nu: {conflict.currentLabel}</p>
                      <p className="text-sm text-slate-500">Import: {conflict.importedLabel}</p>

                      <label className="mt-3 block space-y-2">
                        <span className="text-sm font-medium">Hantering</span>
                        <Select
                          value={value}
                          onValueChange={(next) =>
                            setImportChoices((current) => ({
                              ...current,
                              [key]: next as ImportResolution,
                            }))
                          }
                        >
                          <SelectTrigger data-testid={`import-resolution-${key}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="keep-existing">Behåll nuvarande</SelectItem>
                            <SelectItem value="replace-imported">Ersätt med import</SelectItem>
                            <SelectItem value="merge-history">Slå ihop historik</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelImportPlan}>
              Avbryt
            </Button>
            <Button type="button" onClick={commitImportPlan}>
              Importera val
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
