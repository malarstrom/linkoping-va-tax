import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowDownToLine,
  Calculator,
  Check,
  CircleDollarSign,
  Clock3,
  CopyCheck,
  FileClock,
  Home,
  Layers3,
  PencilLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  Waves,
  X,
} from 'lucide-react';
import { applyManualAdjustment, createCalculationCase, deleteManualAdjustment } from '@/domain/calculations';
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

const serviceLabels: Record<ServiceCode, string> = {
  V: 'Vatten',
  S: 'Spillvatten',
  Df: 'Dagvatten fastighet',
  Dg: 'Dagvatten gata',
};

const specialActionLabels: Record<BrukningsavgiftScenario['specialActions'][number], string> = {
  'meter-removal': 'Mätarnedtagning',
  'meter-installation': 'Mätaruppsättning',
  shutoff: 'Avstängning',
  restart: 'Återinkoppling',
  inspection: 'Besiktning',
  'tank-cleaning': 'Tankrengöring',
  'wasted-visit': 'Förgävesbesök',
};

const formatCurrency = (amount: number) => `${amount.toLocaleString('sv-SE')} kr`;

const propertyTypeHints: Record<PropertyType, string> = {
  bostadsfastighet: 'Standardläge för småhus/flerbostad där Dg kan vara relevant.',
  'annan fastighet': 'För verksamhet eller annan användning — kontrollera bostadsenheter och tjänster extra noga.',
  'obebyggd fastighet': 'Används när anslutning prövas utan befintlig bebyggelse.',
};

function FieldHint({ children }: { children: ReactNode }) {
  return <span className="block text-xs leading-relaxed text-muted-foreground">{children}</span>;
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

  const profileCalculations = useMemo<CalculationCase[]>(() => {
    if (!workspace) return [];
    return workspace.calculations.filter((calculation) => calculation.profileId === activeProfile?.id);
  }, [workspace, activeProfile?.id]);

  const activeCalculation = useMemo<CalculationCase | null>(() => {
    if (!workspace || !workspace.activeCalculationId) return null;
    return profileCalculations.find((calculation) => calculation.id === workspace.activeCalculationId) ?? null;
  }, [workspace, profileCalculations]);

  useEffect(() => {
    if (activeCalculation && manualAdjustmentTargetId) {
      const targetStillExists = latestRevision(activeCalculation)?.resultSnapshot.lines.some((line) => line.id === manualAdjustmentTargetId);
      if (targetStillExists) return;
    }

    setManualAdjustmentTargetId('');
    setManualAdjustmentReason('');
    setManualAdjustmentDelta('');
    setManualAdjustmentError(null);
  }, [activeCalculation?.id, manualAdjustmentTargetId]);

  const activeTaxVersion = useMemo<TaxVersion | null>(() => {
    if (!workspace) return null;
    return findTaxVersion(workspace.taxVersions, workspace.activeTaxVersionId) ?? workspace.taxVersions[0] ?? null;
  }, [workspace]);

  const livePreview = useMemo(() => {
    if (!activeProfile || !activeTaxVersion) return null;
    return calculatePreview(activeProfile, activeTaxVersion, anlaggningsScenario, brukningsScenario);
  }, [activeProfile, activeTaxVersion, anlaggningsScenario, brukningsScenario]);

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

  const beginManualAdjustment = (lineId: string) => {
    if (!activeCalculation) {
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
    }

    setManualAdjustmentTargetId(lineId);
    setManualAdjustmentReason('');
    setManualAdjustmentDelta('');
    setManualAdjustmentError(null);
  };

  const cancelManualAdjustment = () => {
    setManualAdjustmentTargetId('');
    setManualAdjustmentReason('');
    setManualAdjustmentDelta('');
    setManualAdjustmentError(null);
  };

  const removeManualAdjustment = (adjustmentId: string) => {
    if (!activeCalculation) return;

    try {
      const updated = deleteManualAdjustment(activeCalculation, adjustmentId);
      setWorkspace((current) => {
        if (!current) return current;
        return {
          ...current,
          calculations: current.calculations.map((calculation) => (calculation.id === updated.id ? updated : calculation)),
        };
      });
      setManualAdjustmentError(null);
    } catch (error) {
      setManualAdjustmentError(error instanceof Error ? error.message : 'Kunde inte radera justeringen.');
    }
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
      setManualAdjustmentTargetId('');
      setManualAdjustmentReason('');
      setManualAdjustmentDelta('');
      setManualAdjustmentError(null);
    } catch (error) {
      setManualAdjustmentError(error instanceof Error ? error.message : 'Kunde inte spara justeringen.');
    }
  };

  if (!workspace || !activeProfile || !activeTaxVersion) {
    return (
      <main className="grid min-h-screen place-items-center bg-transparent p-6 text-foreground">
        <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-card/90 p-8 text-center shadow-2xl shadow-primary/10 backdrop-blur">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Waves className="h-6 w-6 animate-pulse" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">Laddar arbetsutrymme…</p>
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
  const latestActiveRevision = activeCalculation ? latestRevision(activeCalculation) : null;
  const activeServices = activeProfile.services.filter((service) => service.enabled).map((service) => service.code);
  const resultComponentTotals = visibleResult?.lines.reduce<Record<string, number>>((totals, line) => {
    totals[line.component] = (totals[line.component] ?? 0) + (line.billedAmount ?? line.amount);
    return totals;
  }, {}) ?? {};
  const readinessChecks = [
    { label: 'Fastighetstyp', ready: Boolean(activeProfile.propertyType) },
    { label: 'Tomtyta', ready: Boolean(activeProfile.tomtyta) },
    { label: 'Bostadsenheter', ready: Boolean(activeProfile.bostadsenheter) },
    { label: 'VA-tjänster', ready: activeServices.length > 0 },
    { label: 'Taxeversion', ready: Boolean(activeTaxVersion) },
  ];
  const readyCount = readinessChecks.filter((item) => item.ready).length;
  const readinessPercent = Math.round((readyCount / readinessChecks.length) * 100);
  const modeDescription = activeCalculation
    ? 'Du granskar en sparad kalkyl. Ändra taxeversion och kör om för att skapa en ny revision.'
    : 'Liveförhandsvisning uppdateras direkt när du ändrar underlaget.';

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,rgba(15,118,110,0.22),transparent_28%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.62),transparent_42%)]" />
      <nav aria-label="Snabbnavigering" className="sticky top-0 z-30 border-b border-white/60 bg-background/75 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[92rem] gap-2 overflow-x-auto text-sm">
          <a className="rounded-full bg-white/80 px-4 py-2 font-medium shadow-sm ring-1 ring-border/70" href="#overview">Översikt</a>
          <a className="rounded-full bg-white/80 px-4 py-2 font-medium shadow-sm ring-1 ring-border/70" href="#overview">Underlag</a>
          <a className="rounded-full bg-white/80 px-4 py-2 font-medium shadow-sm ring-1 ring-border/70" href="#scenarios">Scenario</a>
          <a className="rounded-full bg-white/80 px-4 py-2 font-medium shadow-sm ring-1 ring-border/70" href="#result">Resultat</a>
        </div>
      </nav>
      <div className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[24rem_repeat(3,minmax(0,1fr))] lg:px-8 lg:py-8">
        <aside className="space-y-4 lg:sticky lg:top-8 lg:col-span-1 lg:self-start">
          <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 p-6 text-white shadow-2xl shadow-primary/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/15">
                  <Waves className="h-5 w-5 text-cyan-200" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/70">VA taxemotor</p>
                  <h1 className="text-lg font-semibold">Taxor i kontroll</h1>
                </div>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-100 ring-1 ring-emerald-200/20">Lokal</span>
            </div>

            <div className="mt-7 rounded-3xl bg-white/[0.08] p-5 ring-1 ring-white/10">
              <p className="text-sm text-cyan-100/70">Aktuell total</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight">{visibleResult ? formatCurrency(visibleResult.total) : '—'}</p>
              <p className="mt-2 text-sm text-cyan-100/70">{activeCalculation ? 'Historisk kalkyl' : 'Liveförhandsvisning'} · {visibleVersion?.label ?? activeTaxVersion.label}</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-cyan-100/75">
              <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
                <p className="text-lg font-semibold text-white">{workspace.profiles.length}</p>
                <p>Fastigheter</p>
              </div>
              <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
                <p className="text-lg font-semibold text-white">{profileCalculations.length}</p>
                <p>Kalkyler</p>
              </div>
              <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
                <p className="text-lg font-semibold text-white">{activeProfile.revisions.length}</p>
                <p>Revisioner</p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-white/[0.07] p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-cyan-100/75">Underlag klart</span>
                <strong className="text-white">{readinessPercent}%</strong>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-cyan-200 transition-all" style={{ width: `${readinessPercent}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {readinessChecks.map((item) => (
                  <span key={item.label} className={`rounded-full px-2 py-1 text-[0.68rem] font-medium ${item.ready ? 'bg-emerald-300/15 text-emerald-100' : 'bg-white/10 text-cyan-100/60'}`}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-card/85 p-4 shadow-xl shadow-slate-200/70 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-1 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Arbetsyta</p>
                <h2 className="text-lg font-semibold">Välj underlag</h2>
              </div>
              <Button type="button" variant="secondary" className="h-10 w-10 rounded-2xl p-0" onClick={createProfile} aria-label="Skapa ny fastighet" title="Skapa ny fastighet">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Aktiv fastighet</span>
                <Select value={activeProfile.id} onValueChange={setActiveProfile}>
                  <SelectTrigger data-testid="active-profile-select">
                    <SelectValue placeholder="Välj fastighet" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspace.profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name} · {profile.propertyType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-2">
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
                <span className="block text-xs text-muted-foreground">Gäller {activeTaxVersion.validFrom} – {activeTaxVersion.validTo}</span>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Beräkningsläge</span>
                <Select
                  value={activeCalculation?.id ?? 'live-preview'}
                  onValueChange={(value) =>
                    setWorkspace((current) => (current ? { ...current, activeCalculationId: value === 'live-preview' ? null : value } : current))
                  }
                >
                  <SelectTrigger data-testid="active-calculation-select">
                    <SelectValue placeholder="Välj beräkning" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live-preview">Liveförhandsvisning</SelectItem>
                    {profileCalculations.map((calculation) => {
                      const revision = latestRevision(calculation);
                      const version = findTaxVersion(workspace.taxVersions, calculation.taxVersionId);
                      return (
                        <SelectItem key={calculation.id} value={calculation.id}>
                          {version?.label ?? calculation.taxVersionId} · {revision ? formatCurrency(revision.resultSnapshot.total) : '—'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FieldHint>{modeDescription}</FieldHint>
              </label>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button type="button" onClick={saveCalculation} data-testid="save-calculation-button" className="rounded-2xl">
                  <Calculator className="mr-2 h-4 w-4" />
                  Spara
                </Button>
                <Button type="button" variant="outline" onClick={rerunSelectedCalculation} disabled={!activeCalculation} data-testid="rerun-calculation-button" className="rounded-2xl">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Kör om
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={openImportPicker} data-testid="import-json-button" className="rounded-2xl">
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <Button type="button" variant="outline" onClick={exportWorkspace} data-testid="export-json-button" className="rounded-2xl">
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>

              <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFileChange} />
              {importError ? <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{importError}</p> : null}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-card/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <FileClock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Audit</p>
                <h3 className="text-lg font-semibold">Revisioner</h3>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Revisioner:</strong> {activeProfile.revisions.length}</p>
              <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-border/70">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Aktivt spår</p>
                <p className="mt-1 break-all"><strong className="text-foreground">Fastighetsrevision:</strong> {activeCalculation?.revisions.at(-1)?.inputSnapshot.profileRevisionId ?? activeProfile.currentRevisionId}</p>
                <p className="mt-1 break-all"><strong className="text-foreground">Taxeversion-ID:</strong> {activeCalculation?.taxVersionId ?? activeTaxVersion.id}</p>
              </div>
              <details className="rounded-2xl border bg-white/60 p-3">
                <summary className="cursor-pointer font-medium text-foreground">Visa tekniska ID:n och regelspår</summary>
                <div className="mt-3 space-y-2">
                  <p className="break-all"><strong className="text-foreground">Fastighet-ID:</strong> {activeCalculation?.profileId ?? activeProfile.id}</p>
                  {visibleResult ? <p><strong className="text-foreground">Regelspår:</strong> {visibleResult.ruleTrace.join(' → ')}</p> : null}
                </div>
              </details>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-card/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Historik</p>
                <h3 className="text-lg font-semibold">Sparade beräkningar</h3>
              </div>
              <Layers3 className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-4 space-y-3">
              {profileCalculations.length > 0 ? (
                profileCalculations.map((calculation) => {
                  const revision = latestRevision(calculation);
                  const version = findTaxVersion(workspace.taxVersions, calculation.taxVersionId);
                  const selected = calculation.id === activeCalculation?.id;
                  return (
                    <div key={calculation.id} className={`rounded-3xl border p-3 transition ${selected ? 'border-primary/30 bg-primary/10' : 'bg-white/70'}`}>
                      <button type="button" className="w-full text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2" aria-pressed={selected} onClick={() => setWorkspace((current) => (current ? { ...current, activeCalculationId: calculation.id } : current))}>
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{revision ? formatCurrency(revision.resultSnapshot.total) : '—'}</span>
                          {selected ? <span className="rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">Vald</span> : null}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{version?.label ?? calculation.taxVersionId}</span>
                      </button>
                      <div className="mt-3 flex gap-2">
                        <Button type="button" variant="outline" className="h-8 flex-1 rounded-full px-3 text-xs" onClick={() => setWorkspace((current) => (current ? { ...current, activeCalculationId: calculation.id } : current))}>
                          Visa
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 rounded-full px-3 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                          data-testid={`delete-calculation-${calculation.id}`}
                          aria-label="Radera beräkning"
                          onClick={() => {
                            if (window.confirm('Radera beräkningen?')) deleteCalculation(calculation.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-3xl border border-dashed bg-white/60 p-4 text-sm text-muted-foreground">Inga sparade beräkningar.</p>
              )}
            </div>
          </section>

          {activeCalculation ? (
            <section className="rounded-[2rem] border border-white/80 bg-card/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                  <CopyCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kontroll</p>
                  <h3 className="text-lg font-semibold">Justeringar</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Justera direkt på pennan i avgiftsraden.</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {latestActiveRevision?.manualAdjustments.length ? (
                  latestActiveRevision.manualAdjustments.map((adjustment) => {
                    const line = latestActiveRevision.resultSnapshot.lines.find((item) => item.id === adjustment.targetLineId);
                    return (
                      <div key={adjustment.id} className="flex items-start justify-between gap-3 rounded-2xl bg-amber-50/70 p-3 text-sm ring-1 ring-amber-100">
                        <div>
                          <p className="font-semibold text-amber-950">{formatCurrency(adjustment.delta)}</p>
                          <p className="mt-1 text-amber-900">{adjustment.reason}</p>
                          <p className="mt-1 text-xs text-amber-800/75">{line?.description ?? adjustment.targetLineId}</p>
                        </div>
                        <button
                          type="button"
                          className="rounded-full p-1.5 text-amber-900/70 transition hover:bg-amber-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                          onClick={() => removeManualAdjustment(adjustment.id)}
                          data-testid={`delete-manual-adjustment-summary-${adjustment.id}`}
                          aria-label={`Radera justering ${adjustment.reason}`}
                          title="Radera justering"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-2xl border border-dashed bg-white/60 p-4 text-sm text-muted-foreground">Inga manuella justeringar ännu.</p>
                )}
              </div>
            </section>
          ) : null}
        </aside>

        <div className="space-y-6 lg:col-span-3">
          <section id="overview" className="scroll-mt-24 overflow-hidden rounded-[2.25rem] border border-white/80 bg-card/90 shadow-2xl shadow-slate-200/80 backdrop-blur">
            <div className="relative p-6 sm:p-8">
              <div aria-hidden className="absolute right-0 top-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/10">
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      {activeCalculation ? 'Sparad beräkning' : 'Aktiv beräkning'}
                    </span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground ring-1 ring-primary/10">{visibleVersion?.label ?? activeTaxVersion.label}</span>
                  </div>
                  <h2 className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">{visibleProfile.name}</h2>
                  <p className="mt-3 max-w-2xl text-base text-muted-foreground">
                    Modernt beslutsstöd för VA-taxa: redigera underlag, se konsekvens direkt, spara beräkning med revisionsspår.
                  </p>
                  <div className="mt-5 max-w-2xl rounded-3xl border border-primary/10 bg-primary/5 p-4 text-sm text-primary/90">
                    {modeDescription}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {activeServices.map((code) => (
                      <span key={code} className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-800 ring-1 ring-cyan-100">
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        {serviceLabels[code]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-primary/10 bg-gradient-to-br from-white to-secondary/50 p-5 shadow-inner">
                  <p className="text-sm font-medium text-muted-foreground">Total att debitera</p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-primary">{visibleResult ? formatCurrency(visibleResult.total) : '—'}</p>
                  {visibleResult && visibleResult.calculatedTotal !== visibleResult.total ? (
                    <p className="mt-1 text-sm text-muted-foreground">Beräknat {formatCurrency(visibleResult.calculatedTotal)}</p>
                  ) : null}
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-primary/10">
                      <p className="text-muted-foreground">Rader</p>
                      <p className="font-semibold">{visibleResult?.lines.length ?? 0}</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-primary/10">
                      <p className="text-muted-foreground">Läge</p>
                      <p className="font-semibold">{activeCalculation ? 'Låst' : 'Live'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-primary/10 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fastighetsunderlag</p>
                    <h3 className="text-2xl font-semibold">Profil och nyttigheter</h3>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Samla alla beslut som påverkar taxan innan du sparar en beräkning.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl text-red-700 hover:bg-red-50 hover:text-red-800"
                    data-testid={`delete-profile-${activeProfile.id}`}
                    onClick={() => {
                      if (window.confirm('Radera fastigheten och dess beräkningar?')) deleteProfile(activeProfile.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Radera
                  </Button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-2 xl:col-span-2">
                    <span className="text-sm font-medium">Namn</span>
                    <Input data-testid="profile-name-input" value={activeProfile.name} onChange={(e) => updateActiveProfile({ name: e.target.value })} aria-describedby="profile-name-hint" />
                    <span id="profile-name-hint"><FieldHint>Namn visas i rubriker, export och historik.</FieldHint></span>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium">Fastighetstyp</span>
                    <Select value={activeProfile.propertyType} onValueChange={(value) => updateActiveProfile({ propertyType: value as PropertyType })}>
                      <SelectTrigger data-testid="property-type-select">
                        <SelectValue placeholder="Välj fastighetstyp" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bostadsfastighet">Bostadsfastighet</SelectItem>
                        <SelectItem value="annan fastighet">Annan fastighet</SelectItem>
                        <SelectItem value="obebyggd fastighet">Obebyggd fastighet</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldHint>{propertyTypeHints[activeProfile.propertyType]}</FieldHint>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium">Tomtyta (m²)</span>
                    <Input inputMode="decimal" value={activeProfile.tomtyta} onChange={(e) => updateActiveProfile({ tomtyta: e.target.value })} placeholder="ex. 850" />
                    <FieldHint>Används för tomtyteavgift och tillkommande yta.</FieldHint>
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium">Bostadsenheter</span>
                    <Input inputMode="numeric" value={activeProfile.bostadsenheter} onChange={(e) => updateActiveProfile({ bostadsenheter: e.target.value })} placeholder="ex. 1" />
                    <FieldHint>Påverkar bostadsenhetsavgifter.</FieldHint>
                  </label>

                  <div className="space-y-2 md:col-span-2 xl:col-span-3">
                    <span className="text-sm font-medium">Tjänster</span>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {activeProfile.services.map((service) => (
                        <button
                          key={service.code}
                          type="button"
                          onClick={() => handleServiceToggle(service.code)}
                          aria-pressed={service.enabled}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                            service.enabled
                              ? 'border-primary/20 bg-primary/10 text-primary shadow-sm'
                              : 'border-border bg-white/70 text-muted-foreground hover:bg-accent/60'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-3">
                            {serviceLabels[service.code]}
                            {service.enabled ? <Check className="h-4 w-4" /> : null}
                          </span>
                          <span className="mt-1 block text-xs opacity-75">{service.enabled ? 'Ingår i beräkningen' : 'Avstängd'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
              <div id="scenarios" className="scroll-mt-24 space-y-6">
                <div className="rounded-[2rem] border border-white/80 bg-card/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Home className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scenario</p>
                      <h3 className="text-xl font-semibold">Anläggningsavgift</h3>
                      <p className="mt-1 text-sm text-muted-foreground">För nyanslutning, utökning och särskilda anslutningsfall.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Delad förbindelsepunkt</span>
                      <Input inputMode="numeric" value={anlaggningsScenario.sharedConnectionCount} onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, sharedConnectionCount: Number.parseInt(e.target.value, 10) || 1 }))} />
                      <FieldHint>Antal fastigheter som delar samma punkt.</FieldHint>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Tillkommande servisledningar</span>
                      <Input inputMode="numeric" value={anlaggningsScenario.addedServisledningar} onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, addedServisledningar: Number.parseInt(e.target.value, 10) || 0 }))} />
                      <FieldHint>Extra servisledningar utöver grundfallet.</FieldHint>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Tillkommande tomtyta</span>
                      <Input inputMode="decimal" value={anlaggningsScenario.addedTomtyta} onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, addedTomtyta: e.target.value }))} placeholder="m²" />
                      <FieldHint>Endast ny tillkommande yta.</FieldHint>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Tillkommande bostadsenheter</span>
                      <Input inputMode="numeric" value={anlaggningsScenario.addedBostadsenheter} onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, addedBostadsenheter: Number.parseInt(e.target.value, 10) || 0 }))} />
                      <FieldHint>Nya lägenheter/enheter i utökningen.</FieldHint>
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border bg-white/70 p-3 text-sm">
                      <input className="h-4 w-4 accent-primary" type="checkbox" checked={anlaggningsScenario.samfollighet} onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, samfollighet: e.target.checked }))} />
                      Samfällighet
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border bg-white/70 p-3 text-sm">
                      <input className="h-4 w-4 accent-primary" type="checkbox" checked={anlaggningsScenario.dfWithoutConnection} onChange={(e) => setAnlaggningsScenario((current) => ({ ...current, dfWithoutConnection: e.target.checked }))} />
                      Df utan etablerad förbindelsepunkt
                    </label>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/80 bg-card/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                      <Clock3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Scenario</p>
                      <h3 className="text-xl font-semibold">Brukningsavgift</h3>
                      <p className="mt-1 text-sm text-muted-foreground">För löpande debitering, avläsning, dröjsmål och åtgärder.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Debiteringsintervall</span>
                      <Select value={brukningsScenario.billingInterval} onValueChange={(value) => setBrukningsScenario((current) => ({ ...current, billingInterval: value as BrukningsavgiftScenario['billingInterval'] }))}>
                        <SelectTrigger data-testid="billing-interval-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Månadsvis</SelectItem>
                          <SelectItem value="quarterly">Kvartal</SelectItem>
                          <SelectItem value="tertial">Tertial</SelectItem>
                          <SelectItem value="semiannual">Halvår</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldHint>Styr periodisering av fasta avgifter.</FieldHint>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Mätartyp</span>
                      <Select value={brukningsScenario.meterType} onValueChange={(value) => setBrukningsScenario((current) => ({ ...current, meterType: value as BrukningsavgiftScenario['meterType'] }))}>
                        <SelectTrigger data-testid="meter-type-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DN20 smallhus">DN20 småhus</SelectItem>
                          <SelectItem value="DN20">DN20</SelectItem>
                          <SelectItem value="DN25">DN25</SelectItem>
                          <SelectItem value="DN40">DN40</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldHint>Påverkar mätar- och brukningsavgift.</FieldHint>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Uppskattad förbrukning (m³)</span>
                      <Input inputMode="decimal" value={brukningsScenario.estimatedConsumptionM3} onChange={(e) => setBrukningsScenario((current) => ({ ...current, estimatedConsumptionM3: e.target.value }))} placeholder="m³/år" />
                      <FieldHint>Används bara om uppskattad förbrukning är markerad.</FieldHint>
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Dröjsmål (dagar)</span>
                      <Input inputMode="numeric" value={brukningsScenario.latePaymentDays} onChange={(e) => setBrukningsScenario((current) => ({ ...current, latePaymentDays: Number.parseInt(e.target.value, 10) || 0 }))} />
                      <FieldHint>0 dagar ger ingen dröjsmålseffekt.</FieldHint>
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border bg-white/70 p-3 text-sm">
                      <input className="h-4 w-4 accent-primary" type="checkbox" checked={brukningsScenario.useEstimatedConsumption} onChange={(e) => setBrukningsScenario((current) => ({ ...current, useEstimatedConsumption: e.target.checked }))} />
                      Använd uppskattad förbrukning
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border bg-white/70 p-3 text-sm">
                      <input className="h-4 w-4 accent-primary" type="checkbox" checked={brukningsScenario.afterHours} onChange={(e) => setBrukningsScenario((current) => ({ ...current, afterHours: e.target.checked }))} />
                      Utanför ordinarie arbetstid
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border bg-white/70 p-3 text-sm">
                      <input className="h-4 w-4 accent-primary" type="checkbox" checked={brukningsScenario.annualMeterReadingCompleted} onChange={(e) => setBrukningsScenario((current) => ({ ...current, annualMeterReadingCompleted: e.target.checked }))} />
                      Årlig mätaravläsning genomförd
                    </label>
                    <label className="flex items-center gap-3 rounded-2xl border bg-white/70 p-3 text-sm">
                      <input className="h-4 w-4 accent-primary" type="checkbox" checked={brukningsScenario.propertyTransferRequested} onChange={(e) => setBrukningsScenario((current) => ({ ...current, propertyTransferRequested: e.target.checked }))} />
                      Avläsning vid fastighetsöverlåtelse
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/80 bg-card/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tillval</p>
                    <h3 className="text-xl font-semibold">Särskilda åtgärder</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Välj bara åtgärder som ska faktureras i scenariot.</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">{brukningsScenario.specialActions.length} valda</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(specialActionLabels) as BrukningsavgiftScenario['specialActions']).map((action) => {
                    const active = brukningsScenario.specialActions.includes(action);
                    return (
                      <Button
                        key={action}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        className="rounded-full"
                        aria-pressed={active}
                        onClick={() => setBrukningsScenario((current) => ({ ...current, specialActions: active ? current.specialActions.filter((item) => item !== action) : [...current.specialActions, action] }))}
                      >
                        {specialActionLabels[action]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div id="result" className="scroll-mt-24 rounded-[2rem] border border-white/80 bg-card/90 p-5 shadow-xl shadow-slate-200/70 backdrop-blur sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Resultat</p>
                    <h3 className="text-2xl font-semibold">Avgiftsrader</h3>
                  </div>
                  <CircleDollarSign className="h-6 w-6 text-primary" />
                </div>
                {visibleResult ? (
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {Object.entries(resultComponentTotals).map(([component, amount]) => (
                        <div key={component} className="rounded-2xl bg-secondary/55 p-3 ring-1 ring-primary/10">
                          <p className="text-xs font-medium text-muted-foreground">{component}</p>
                          <p className="mt-1 font-semibold text-slate-950">{formatCurrency(amount)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      {visibleResult.lines.map((line) => {
                        const isEditing = activeCalculation && manualAdjustmentTargetId === line.id;
                        const lineAdjustments = latestActiveRevision?.manualAdjustments.filter((adjustment) => adjustment.targetLineId === line.id) ?? [];

                        return (
                          <article key={line.id} className={`group rounded-3xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isEditing ? 'border-primary/30 bg-primary/5' : 'border-border/80 bg-white/72'}`}>
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{line.component}</span>
                                  <span className="text-xs text-muted-foreground">{line.paragraphRef}</span>
                                  {lineAdjustments.length > 0 ? (
                                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-100">{lineAdjustments.length} just.</span>
                                  ) : null}
                                </div>
                                <p className="mt-2 font-semibold text-slate-950">{line.description}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{line.basis}</p>
                                {line.calculatedAmount !== undefined && line.billedAmount !== undefined && line.calculatedAmount !== line.billedAmount ? (
                                  <p className="mt-1 text-xs text-muted-foreground">Beräknad {formatCurrency(line.calculatedAmount)} · Debiterad {formatCurrency(line.billedAmount)}</p>
                                ) : null}
                                {lineAdjustments.length > 0 ? (
                                  <div className="mt-3 space-y-2 rounded-2xl bg-amber-50/70 p-3 text-xs text-amber-900 ring-1 ring-amber-100">
                                    {lineAdjustments.map((adjustment) => (
                                      <div key={adjustment.id} className="flex items-start justify-between gap-3 rounded-xl bg-white/55 px-3 py-2 ring-1 ring-amber-100/70">
                                        <p>
                                          <strong>{formatCurrency(adjustment.delta)}</strong> · {adjustment.reason}
                                        </p>
                                        {!isEditing ? (
                                          <button
                                            type="button"
                                            className="rounded-full p-1 text-amber-900/70 transition hover:bg-amber-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                                            onClick={() => removeManualAdjustment(adjustment.id)}
                                            data-testid={`delete-manual-adjustment-${adjustment.id}`}
                                            aria-label={`Radera justering ${adjustment.reason}`}
                                            title="Radera justering"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex flex-col items-end gap-3">
                                <p className="text-lg font-semibold text-primary">{formatCurrency(line.billedAmount ?? line.amount)}</p>
                                <Button
                                  type="button"
                                  variant={isEditing ? 'secondary' : 'outline'}
                                  className="h-9 rounded-full px-3 text-xs"
                                  onClick={() => (isEditing ? cancelManualAdjustment() : beginManualAdjustment(line.id))}
                                  aria-expanded={Boolean(isEditing)}
                                  aria-controls={`manual-adjustment-${line.id}`}
                                  aria-label={`${isEditing ? 'Avbryt justering för' : 'Justera'} ${line.description}`}
                                  title={activeCalculation ? 'Justera raden' : 'Spara beräkning och justera raden'}
                                >
                                  {isEditing ? <X className="mr-1.5 h-3.5 w-3.5" /> : <PencilLine className="mr-1.5 h-3.5 w-3.5" />}
                                  {isEditing ? 'Avbryt' : 'Justera'}
                                </Button>
                              </div>
                            </div>

                            {isEditing ? (
                              <div id={`manual-adjustment-${line.id}`} className="mt-4 rounded-3xl border border-primary/15 bg-white/85 p-4 ring-1 ring-primary/10">
                                <div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:items-end">
                                  <label className="space-y-2">
                                    <span className="text-sm font-medium">Justering</span>
                                    <Input data-testid="manual-adjustment-delta-input" inputMode="decimal" value={manualAdjustmentDelta} onChange={(e) => setManualAdjustmentDelta(e.target.value)} placeholder="ex. -250" aria-describedby={`manual-adjustment-hint-${line.id}`} />
                                    <span id={`manual-adjustment-hint-${line.id}`}><FieldHint>Negativt belopp krediterar raden.</FieldHint></span>
                                  </label>
                                  <label className="space-y-2">
                                    <span className="text-sm font-medium">Motivering</span>
                                    <Input data-testid="manual-adjustment-reason-input" value={manualAdjustmentReason} onChange={(e) => setManualAdjustmentReason(e.target.value)} placeholder="Varför justeras just den här raden?" />
                                  </label>
                                  <div className="flex gap-2">
                                    <Button type="button" onClick={commitManualAdjustment} data-testid="save-manual-adjustment-button" className="rounded-2xl">
                                      Spara
                                    </Button>
                                    <Button type="button" variant="outline" onClick={cancelManualAdjustment} className="rounded-2xl">
                                      Avbryt
                                    </Button>
                                  </div>
                                </div>
                                {manualAdjustmentError ? <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{manualAdjustmentError}</p> : null}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-muted-foreground">Ingen beräkning tillgänglig.</p>
                )}
              </div>

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
              <p className="text-sm text-foreground/70">
                Export skapad {importPlan.package.exportedAt}. {importPlan.conflicts.length} objekt krockar.
              </p>

              <div className="space-y-3">
                {importPlan.conflicts.map((conflict) => {
                  const key = importChoiceKey(conflict.kind, conflict.id);
                  const value = importChoices[key] ?? conflict.resolution;

                  return (
                    <div key={key} className="rounded-2xl border bg-white/70 p-4">
                      <p className="font-medium">{conflict.kind}</p>
                      <p className="text-sm text-muted-foreground">ID: {conflict.id}</p>
                      <p className="text-sm text-muted-foreground">Nu: {conflict.currentLabel}</p>
                      <p className="text-sm text-muted-foreground">Import: {conflict.importedLabel}</p>

                      <label className="mt-3 block space-y-2">
                        <span className="text-sm font-medium">Hantering</span>
                        <Select value={value} onValueChange={(next) => setImportChoices((current) => ({ ...current, [key]: next as ImportResolution }))}>
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
