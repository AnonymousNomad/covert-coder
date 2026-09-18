// node/src/services/setup-service.ts
//
// Resident Adaptive Setup (Gate #2) service.
//
// The setup profile is the single persisted artifact of the setup session
// (stored at <workspace>/.aide/setup-profile.json). It makes the resident
// configuration restart-proof: a new page load reads it back and reconstructs
// the wizard state, and readiness is always recomputed live from durable +
// probe state — never from browser-only memory.
//
// Truth rules:
//   - plan() composes recommendations from live probes (hardware scan, model
//     status, unified connections view, telegram bridge, skill filesystem). A
//     failing probe degrades its section honestly; plan() never throws.
//   - model state comes from ModelStatusEntry (artifact presence never implies
//     a running engine).
//   - provider entries reuse the Gate #1 connections view verbatim; there is
//     no second provider registry here.
//   - readiness is evidence-based; the wizard only renders the verdict.
//
// This service performs no authority operations. Every mutation is a governed
// route (routes/setup.ts) binding the exact approved body; this service owns
// the durable compare-vs-write critical section and reports conflicts.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { modelDisplayState, type ModelDisplayState } from '../../../common/model-state.ts';
import { SetupProfile, type SetupAnswersT, type SetupHardwareSnapshotT, type SetupIntegrationStateT, type SetupModelRecommendationT, type SetupPlanProviderT, type SetupPlanT, type SetupProfileT, type SetupReadinessT, type SetupRoleT, type SetupSkillFamilyT, type SetupWorkTypeT } from '../../../common/contracts/setup.ts';

export type SetupConnectionProbe =
  | {
      connections?: Array<{
        id: string;
        name?: string;
        kind?: string;
        status?: string;
        detail?: string;
        routing_available?: boolean;
      }>;
      preference?: string;
    }
  | { error?: string };

export type SetupModelProbe = {
  runtime: boolean;
  models: Array<{ id: string; status?: string | null; artifact_available?: boolean }>;
};

export type SetupModelRouteProbe = Array<{ id: string; status?: string | null }>;

export type SetupHardwareProbe = {
  totalRamBytes?: number;
  logicalCpus?: number;
  vramBytes?: number;
  tier?: string;
  backend?: string;
} | null;

export type SetupRecommendProbe = {
  recommendations?: Array<{
    role?: string;
    modelId?: string;
    name?: string;
    quant?: string;
    fileBytes?: number;
    contextTokens?: number;
    fit?: string;
    onDisk?: boolean;
    reason?: string;
  }>;
} | null;

export type SetupTelegramProbe = {
  connected?: boolean;
  running?: boolean;
  bot_username?: string | null;
} | null;

export interface SetupProbes {
  connectionsView(): Promise<SetupConnectionProbe>;
  connectionsGetPreference(): Promise<string>;
  hardwareProfile(): Promise<SetupHardwareProbe>;
  recommendRoles(): Promise<SetupRecommendProbe>;
  modelStatus(): Promise<SetupModelProbe>;
  modelRoutes(): Promise<SetupModelRouteProbe>;
  telegramStatus(): Promise<SetupTelegramProbe>;
  auditReachable(): Promise<boolean>;
}

export class SetupConflictError extends Error {
  constructor(message = 'setup profile changed before this update executed') {
    super(message);
    this.name = 'SETUP_CONFLICT';
  }
}

const MODE_PROFILE: Record<'LOCAL_FIRST' | 'HYBRID' | 'CLOUD', string> = {
  LOCAL_FIRST: 'local-first sovereign workbench',
  HYBRID: 'hybrid model-assisted workbench',
  CLOUD: 'cloud-assisted workbench'
};

function strictnessDetail(strictness: string): string {
  switch (strictness) {
    case 'STRICT':
      return 'strict capability approvals for every mutation';
    case 'BALANCED':
      return 'balanced policy planned; effective approval policy stays strict until the capability adapts';
    case 'RELAXED':
      return 'relaxed policy planned; effective approval policy stays strict until explicitly loosened by the operator';
    default:
      return strictness;
  }
}

// Curated work-type -> skill-family map. Availability is verified against the
// skills filesystem at plan() time; never assumed from this table.
const FAMILIES: Record<SetupWorkTypeT, Array<{ id: string; label: string }>> = {
  'Software Engineering': [
    { id: 'aide-arch-backend-core', label: 'Backend architecture + route discipline' },
    { id: 'aide-debugging-discipline', label: 'Debugging discipline' },
    { id: 'aide-route-slice-sop', label: 'Route-slice engineering SOP' },
    { id: 'aide-unified-diff-repair', label: 'Unified-diff format discipline' }
  ],
  'Web Development': [
    { id: 'web-builder', label: 'Web-builder structured specs' },
    { id: 'web-builder-spec-renderer', label: 'Spec renderer + design scoring' },
    { id: 'aide-responsive-a11y', label: 'Responsive + accessibility discipline' },
    { id: 'ex-fnt-component-composition', label: 'Frontend component architecture' }
  ],
  'Model Training': [
    { id: 'training-sop', label: 'Training SOP (battle-tested numbers)' },
    { id: 'device-training-1060', label: 'This-machine training discipline' },
    { id: 'pipeline-phase-3-data-curation', label: 'Data curation doctrine' },
    { id: 'gguf-quantization-deployment', label: 'Quantize / serve / deploy chain' }
  ],
  Research: [
    { id: 'verify-first-discipline', label: 'Verify-first research law' },
    { id: 'corpus-curation', label: 'Corpus grading + budgeting' },
    { id: 'pipeline-excellence', label: 'Pipeline excellence constitution' },
    { id: 'kd-corpus-production', label: 'Knowledge-distillation corpus production' }
  ],
  'Security & Audit': [
    { id: 'aide-security-hardening', label: 'Security hardening SOP' },
    { id: 'aide-credo-guardrail', label: 'Credo + influence-literacy lens' },
    { id: 'web-human-systems-security', label: 'Human-factor security synthesis' },
    { id: 'aide-ci-diagnostics', label: 'CI diagnostics (no-auth evidence)' }
  ],
  Documentation: [
    { id: 'aide-project-replay', label: 'Project replay + provenance' },
    { id: 'github-repo-professional-setup', label: 'Professional repository setup' },
    { id: 'gold-training-docs', label: 'Gold-standard doc format' },
    { id: 'continuous-improvement-sop', label: 'Continuous improvement SOP' }
  ],
  'Creative & Interface': [
    { id: 'ex-vis-premium-aesthetic-language', label: 'Premium visual language' },
    { id: 'ex-arch-immersive-landing-architecture', label: 'Immersive experience architecture' },
    { id: 'ex-int-motion-choreography', label: 'Interaction + motion choreography' },
    { id: 'web-builder-spec-renderer', label: 'Spec renderer + scoring' }
  ],
  'Game Development': [
    { id: 'aide-p2-descent-intro', label: 'Cinematic onboarding scene engineering' },
    { id: 'aide-arch-editor', label: 'Editor core engineering' },
    { id: 'aide-responsive-a11y', label: 'Responsive + accessibility discipline' },
    { id: 'ex-arch-immersive-landing-architecture', label: 'Immersive world building' }
  ]
};

function providerFamilyMatch(id: string, providers: string[]): boolean {
  if (id === 'local-runtime') return providers.includes('Local only');
  if (id === 'hf-token') return providers.includes('Hugging Face');
  if (id === 'subscription:claude') return providers.includes('Anthropic / Claude');
  if (id.startsWith('api:') || id === 'subscription:codex') return providers.includes('OpenAI / compatible');
  return false;
}

export function createSetupService(options: { workspace: string; probes: SetupProbes; skillsRoot: string }) {
  if (!options.workspace) throw new Error('workspace is required');
  const profileFile = path.join(options.workspace, '.aide', 'setup-profile.json');

  // Per-service FIFO critical section (same pattern as the onboarding service):
  // holds compare -> derive -> durable write as one serialized operation so a
  // stale approved update can never observe state another writer changed. It is
  // not authority; grant/approval live in the governed route layer.
  let queue = Promise.resolve();
  function critical<T>(operation: () => Promise<T>): Promise<T> {
    const run = queue.then(operation, operation);
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  async function readProfile(): Promise<SetupProfileT | null> {
    try {
      const raw = await fs.readFile(profileFile, 'utf8');
      const parsed = SetupProfile.parse(JSON.parse(raw));
      return parsed;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') return null;
      // Corrupt state: treat as unconfigured (atomic write protects the next save).
      return null;
    }
  }

  async function writeAtomic(profile: SetupProfileT): Promise<void> {
    const partial = profileFile + '.partial';
    await fs.mkdir(path.dirname(profileFile), { recursive: true });
    await fs.writeFile(partial, JSON.stringify(profile, null, 2), 'utf8');
    await fs.rename(partial, profileFile);
  }

  async function skillAvailable(id: string): Promise<boolean> {
    for (const candidate of [
      path.join(options.skillsRoot, 'skills', 'packs', id, 'SKILL.md'),
      path.join(options.skillsRoot, 'skills', id, 'SKILL.md')
    ]) {
      try {
        await fs.access(candidate);
        return true;
      } catch {
        // try the next layout
      }
    }
    return false;
  }

  async function skillFamiliesFor(workType: SetupWorkTypeT): Promise<SetupSkillFamilyT[]> {
    const base = FAMILIES[workType] ?? [];
    const checked: SetupSkillFamilyT[] = [];
    for (const family of base.slice(0, 4)) {
      checked.push({ id: family.id, label: family.label, available: await skillAvailable(family.id) });
    }
    return checked;
  }

  async function getProfile(): Promise<SetupProfileT | null> {
    return readProfile();
  }

  async function applyProfile(profile: SetupProfileT, expectedUpdatedAt: number | null): Promise<SetupProfileT> {
    return critical(async () => {
      const current = await readProfile();
      const currentUpdatedAt = current?.updatedAt ?? null;
      if (currentUpdatedAt !== expectedUpdatedAt) {
        throw new SetupConflictError(
          `expected updatedAt ${expectedUpdatedAt} (none persisted) but found ${currentUpdatedAt}`
        );
      }
      const now = Date.now();
      const next: SetupProfileT = {
        version: 1,
        answers: profile.answers,
        skillFamilies: profile.skillFamilies.slice(0, 8),
        selectedModelId: profile.selectedModelId,
        roles: profile.roles,
        hardware: profile.hardware,
        appliedAt: current?.appliedAt ?? now,
        updatedAt: now
      };
      await writeAtomic(next);
      return next;
    });
  }

  async function resetProfile(): Promise<void> {
    return critical(async () => {
      try {
        await fs.unlink(profileFile);
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT')) throw error;
      }
    });
  }

  async function plan(answers: SetupAnswersT): Promise<SetupPlanT> {
    const now = Date.now();
    const hardware = await probeHardware();

    const view = await probeConnectionsView();
    const modelProbe = await probeModelStatus();
    const modelRoutes = await options.probes.modelRoutes();
    const routeStatuses = new Map(modelRoutes.map(route => [normalizeModelId(route.id), route.status ?? 'unknown']));
    const telegram = await probeTelegram();

    const providers: SetupPlanProviderT[] = [];
    if (view && 'connections' in view && Array.isArray(view.connections)) {
      for (const connection of view.connections.slice(0, 24)) {
        const selected = providerFamilyMatch(connection.id, answers.providers) || connection.status === 'connected';
        if (!selected && connection.status === 'not_configured') continue;
        providers.push({
          id: connection.id,
          name: connection.name ?? connection.id,
          kind: connection.kind ?? 'unknown',
          status: connection.status ?? 'unavailable',
          detail: (connection.detail ?? '').slice(0, 160) || (connection.status ?? ''),
          routing_available: connection.routing_available === true,
          selected
        });
      }
      // Deterministic ordering: selected + connected first.
      providers.sort((a, b) => Number(b.selected) - Number(a.selected) || Number(b.routing_available) - Number(a.routing_available));
    }
    const boundedProviders = providers.slice(0, 12);

    const recProbe = await probeRecommend();
    const models: SetupModelRecommendationT[] = [];
    if (recProbe && Array.isArray(recProbe.recommendations)) {
      for (const rec of recProbe.recommendations.slice(0, 3)) {
        const role = (rec.role ?? 'coder') as SetupRoleT;
        if (!['planner', 'coder', 'reviewer'].includes(role)) continue;
        const onDisk = rec.onDisk === true || modelProbe.models.some(entry => String(entry.id).replace(/^local:/, '') === String(rec.modelId ?? '').replace(/^local:/, '') && entry.artifact_available === true);
        const state = stateOfModel(String(rec.modelId ?? ''), modelProbe, onDisk, routeStatuses.get(normalizeModelId(String(rec.modelId ?? ''))));
        models.push({
          role,
          modelId: String(rec.modelId ?? ''),
          name: String(rec.name ?? rec.modelId ?? ''),
          quant: String(rec.quant ?? 'unknown'),
          fileBytes: rec.fileBytes ?? 0,
          contextTokens: rec.contextTokens ?? 4096,
          fit: (rec.fit === 'COMFORTABLE' || rec.fit === 'TIGHT' || rec.fit === 'OVER') ? rec.fit : 'OVER',
          onDisk,
          state,
          reason: String(rec.reason ?? '')
        });
      }
    }

    const skillFamilies = await skillFamiliesFor(answers.workType);
    const integrations = await integrationStates(answers.integrations, telegram);

    const localUse = answers.localModelUse;
    const runtimeAvailable = modelProbe.runtime === true;
    const localRuntime = {
      recommendation:
        localUse === 'Evaluate only'
          ? 'observe the local runtime and models; no serving claim is made'
          : runtimeAvailable
            ? 'local runtime is reachable; start the recommended model once selected'
            : 'local runtime is not serving yet; the models panel can start it after setup',
      runtime: runtimeAvailable,
      state: runtimeAvailable ? 'available' : 'unavailable'
    };

    return {
      workflowProfile: MODE_PROFILE[answers.mode] ?? MODE_PROFILE.LOCAL_FIRST,
      mode: answers.mode,
      modelUse: answers.localModelUse,
      executionPolicy: answers.approvalStrictness,
      providers: boundedProviders,
      localRuntime,
      models,
      skillFamilies,
      integrations,
      workspace: options.workspace,
      projectLocations: answers.projectLocations,
      importantWorkflows: answers.importantWorkflows,
      hardware,
      generatedAt: now
    };
  }

  function stateOfModel(modelId: string, modelProbe: SetupModelProbe, onDisk: boolean, routeStatus?: string): SetupModelRecommendationT['state'] {
    const needle = String(modelId).replace(/^local:/, '');
    const entry = modelProbe.models.find(e => String(e.id).replace(/^local:/, '') === needle);
    const evidence = {
      ...(typeof entry?.status === 'string' ? { status: entry.status } : onDisk ? { status: 'stopped' } : {}),
      runtime_available: modelProbe.runtime,
      artifact_available: onDisk
    };
    const display = modelDisplayState(evidence, routeStatus);
    return displayState(display);
  }

  function displayState(state: ModelDisplayState): SetupModelRecommendationT['state'] {
    return state.toLowerCase() as SetupModelRecommendationT['state'];
  }

  function normalizeModelId(modelId: string): string {
    return modelId.replace(/^local:/, '');
  }

  async function integrationStates(ids: string[], telegram: SetupTelegramProbe): Promise<SetupIntegrationStateT[]> {
    const result: SetupIntegrationStateT[] = [];
    if (ids.includes('Telegram')) {
      const connected = telegram?.connected === true;
      const running = telegram?.running === true;
      result.push({
        id: 'Telegram',
        state: connected ? 'AVAILABLE' : running ? 'PARTIAL' : 'CONFIGURABLE',
        detail: connected
          ? (telegram?.bot_username ? `bot @${telegram.bot_username} connected` : 'telegram connected')
          : running
            ? 'bridge running; authorize a chat to complete setup'
            : 'bridge wired; connect a bot token in Settings to enable',
        connected
      });
    } else {
      result.push({ id: 'Telegram', state: 'CONFIGURABLE', detail: 'not requested; connect later in Settings', connected: false });
    }
    if (ids.includes('GitHub')) {
      result.push({ id: 'GitHub', state: 'AVAILABLE', detail: 'git panel operates on local workspace repositories; no external sync', connected: false });
    } else {
      result.push({ id: 'GitHub', state: 'AVAILABLE', detail: 'git panel available on request', connected: false });
    }
    if (ids.includes('Discord')) {
      result.push({ id: 'Discord', state: 'DEFERRED', detail: 'no Discord adapter is wired in this build', connected: false });
    } else {
      result.push({ id: 'Discord', state: 'DEFERRED', detail: 'no Discord adapter is wired in this build', connected: false });
    }
    return result.filter(entry => ids.includes(entry.id));
  }

  async function probeHardware(): Promise<SetupHardwareSnapshotT> {
    try {
      const probe = await options.probes.hardwareProfile();
      if (!probe) return emptyHardware();
      return {
        totalRamGb: Math.round((probe.totalRamBytes ?? 0) / (1024 * 1024 * 1024) * 10) / 10,
        logicalCpus: probe.logicalCpus ?? 0,
        vramMb: Math.round((probe.vramBytes ?? 0) / (1024 * 1024)),
        tier: probe.tier ?? 'unknown',
        backend: probe.backend ?? 'unknown',
        scannedAt: Date.now()
      };
    } catch {
      return emptyHardware();
    }
  }

  function emptyHardware(): SetupHardwareSnapshotT {
    return { totalRamGb: 0, logicalCpus: 0, vramMb: 0, tier: 'unknown', backend: 'unknown', scannedAt: Date.now() };
  }

  async function probeConnectionsView(): Promise<SetupConnectionProbe | null> {
    try {
      return await options.probes.connectionsView();
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'connections view unavailable' };
    }
  }

  async function probePreference(view: SetupConnectionProbe | null): Promise<string> {
    try {
      return await options.probes.connectionsGetPreference();
    } catch {
      return (view && 'preference' in view && typeof view.preference === 'string') ? view.preference : 'local-first';
    }
  }

  async function probeModelStatus(): Promise<SetupModelProbe> {
    try {
      const status = await options.probes.modelStatus();
      return { runtime: status?.runtime === true, models: status?.models ?? [] };
    } catch {
      return { runtime: false, models: [] };
    }
  }

  async function probeRecommend(): Promise<SetupRecommendProbe> {
    try {
      return await options.probes.recommendRoles();
    } catch {
      return null;
    }
  }

  async function probeTelegram(): Promise<SetupTelegramProbe> {
    try {
      return await options.probes.telegramStatus();
    } catch {
      return null;
    }
  }

  async function readiness(): Promise<SetupReadinessT> {
    const profile = await readProfile();
    const evaluated_at = Date.now();
    const checks: SetupReadinessT['checks'] = [];

    // 1. workspace resolves (required)
    let workspaceOk = false;
    try {
      const stat = await fs.stat(options.workspace);
      workspaceOk = stat.isDirectory();
    } catch {
      workspaceOk = false;
    }
    checks.push({ id: 'workspace.resolves', label: 'Workspace root resolves', required: true, ok: workspaceOk, detail: workspaceOk ? options.workspace : 'workspace root does not resolve on disk' });

    // 2. profile persisted (required)
    checks.push({ id: 'profile.persisted', label: 'Setup profile persisted', required: true, ok: profile !== null, detail: profile ? `applied ${new Date(profile.appliedAt).toISOString()}` : 'no setup profile applied yet' });

    // 3. backend services reachable (required)
    const view = await probeConnectionsView();
    const servicesOk = !(view && 'error' in view && view.error !== undefined);
    checks.push({ id: 'backend.services', label: 'Backend services reachable', required: true, ok: servicesOk, detail: servicesOk ? 'unified connections probe resolved' : (view && 'error' in view ? String(view.error).slice(0, 200) : 'unreachable') });

    // 4. providers routing (required)
    const modelRoutes = await options.probes.modelRoutes();
    const localRouteReady = modelRoutes.some(route => route.id.startsWith('local:') && route.status === 'ready');
    const nonLocalRouteAvailable = view && 'connections' in view
      ? (view.connections ?? []).some(c => c.id !== 'local-runtime' && c.status === 'connected' && c.routing_available === true)
      : false;
    const routingAvailable = localRouteReady || nonLocalRouteAvailable;
    const preference = await probePreference(view);
    checks.push({ id: 'providers.routing', label: 'Provider routing usable', required: true, ok: routingAvailable, detail: routingAvailable ? `routing usable (preference: ${preference})` : 'no connection reports routing availability; configure a provider or a local runtime first' });

    // 5. providers config (required for CLOUD, advisory otherwise)
    const anyConnected = view && 'connections' in view ? (view.connections ?? []).some(c => c.status === 'connected') : false;
    const mode = profile?.answers.mode ?? 'LOCAL_FIRST';
    const configRequired = mode === 'CLOUD';
    const anyLocalModel = profile !== null && profile.selectedModelId !== null;
    const configOk = mode === 'CLOUD' ? anyConnected : (anyConnected || anyLocalModel);
    checks.push({ id: 'providers.config', label: mode === 'CLOUD' ? 'Provider configured' : 'Local or connected provider available', required: configRequired, ok: configOk, detail: configOk ? (anyConnected ? 'at least one connection is connected' : 'no connected provider; local runtime intended per selected mode') : (mode === 'CLOUD' ? 'CLOUD mode selected but no connection is connected' : 'no provider connected and no local model selected') });

    // 6. hardware scan (required)
    const hwOk = profile !== null && profile.hardware && profile.hardware.totalRamGb > 0 && profile.hardware.logicalCpus > 0;
    checks.push({ id: 'hardware.scan', label: 'Hardware scan completed', required: true, ok: hwOk, detail: hwOk ? `known: ${profile!.hardware.totalRamGb}GB RAM / ${profile!.hardware.logicalCpus} cores` : 'hardware scan missing from profile' });

    // 7. model selection (required unless evaluate-only)
    const evaluateOnly = profile?.answers.localModelUse === 'Evaluate only';
    let modelOk = evaluateOnly;
    let modelDetail = evaluateOnly ? 'evaluate-only mode; no serving selection required' : 'no model selected';
    if (!evaluateOnly) {
      const recProbe = await probeRecommend();
      const knownIds = new Set<string>();
      const models = await probeModelStatus();
      const modelRoutes = await options.probes.modelRoutes();
      for (const m of models.models) knownIds.add(String(m.id).replace(/^local:/, ''));
      if (recProbe && Array.isArray(recProbe.recommendations)) {
        for (const rec of recProbe.recommendations) knownIds.add(String(rec.modelId ?? '').replace(/^local:/, ''));
      }
      if (profile && profile.selectedModelId) {
        const selected = String(profile.selectedModelId).replace(/^local:/, '');
        const selectionKnown = knownIds.has(selected);
        const selectedEntry = models.models.find(e => normalizeModelId(String(e.id)) === selected);
        const selectedRoute = modelRoutes.find(route => normalizeModelId(route.id) === selected);
        const selectedState = selectedEntry === undefined
          ? 'degraded'
          : stateOfModel(selected, models, selectedEntry.artifact_available === true, selectedRoute?.status ?? undefined);
        modelOk = selectionKnown && selectedState === 'ready';
        modelDetail = modelOk
          ? `selection recorded and serving endpoint verified: ${profile.selectedModelId}`
          : `selected model ${profile.selectedModelId} is ${selectedState}; a verified serving endpoint is required`;
      }
    }
    checks.push({ id: 'models.selection', label: 'Model selection valid', required: !evaluateOnly, ok: modelOk, detail: modelDetail });

    // 8. workflow profile (required: persisted answers imply the derived profile)
    checks.push({ id: 'workflow.profile', label: 'Workflow profile recorded', required: true, ok: profile !== null, detail: profile ? (MODE_PROFILE[profile.answers.mode] ?? MODE_PROFILE.LOCAL_FIRST) : 'apply a configuration plan to record the workflow profile' });

    // 9. skills selection (required)
    const skillsOk = profile !== null && profile.skillFamilies.length > 0 && profile.skillFamilies.length <= 8;
    checks.push({ id: 'skills.selection', label: 'Skill families selected', required: true, ok: skillsOk, detail: profile ? (skillsOk ? `${profile.skillFamilies.length} skill families committed` : 'select 1-8 skill families') : 'no skill families committed' });

    // 10. execution policy (required; documentable always)
    checks.push({ id: 'execution.policy', label: 'Execution policy defined', required: true, ok: true, detail: profile ? strictnessDetail(profile.answers.approvalStrictness) : strictnessDetail('STRICT') });

    // 11. verification subsystem reachable (required)
    let auditOk = false;
    try {
      auditOk = await options.probes.auditReachable();
    } catch {
      auditOk = false;
    }
    checks.push({ id: 'verification.reachable', label: 'Verification subsystem reachable', required: true, ok: auditOk, detail: auditOk ? 'audit/verification spine reachable' : 'audit/verification spine unreachable' });

    // 12. skills availability (advisory)
    let skillsAvailableOk = true;
    let availabilityDetail = 'no families selected yet';
    if (profile && profile.skillFamilies.length > 0) {
      let missing = 0;
      for (const familyId of profile.skillFamilies) {
        if (!(await skillAvailable(familyId))) missing += 1;
      }
      skillsAvailableOk = missing === 0;
      availabilityDetail = missing === 0 ? 'all selected families verified on disk' : `${missing} selected family(ies) missing on disk`;
    }
    checks.push({ id: 'skills.available', label: 'Skill families available on disk', required: false, ok: skillsAvailableOk, detail: availabilityDetail });

    // 13. integrations (advisory)
    let integrationsOk = true;
    let integrationsDetail = 'no integrations requested';
    if (profile && profile.answers.integrations.length > 0) {
      const states = await integrationStates(profile.answers.integrations, await probeTelegram());
      const blocked = states.filter(s => s.state === 'UNAVAILABLE');
      integrationsOk = blocked.length === 0;
      const telemetryConnected = states.find(s => s.id === 'Telegram');
      integrationsDetail = blocked.length > 0
        ? `${blocked.map(b => b.id).join(', ')} unavailable on this build`
        : (telemetryConnected && telemetryConnected.connected ? 'requested integrations available' : 'requested integrations bound; Telegram still needs a connect/authorize');
    }
    checks.push({ id: 'integrations.resolved', label: 'Requested integrations resolved', required: false, ok: integrationsOk, detail: integrationsDetail });

    // 14. telegram connected (advisory)
    let telegramOk = true;
    let telegramDetail = 'telegram not requested';
    if (profile && profile.answers.integrations.includes('Telegram')) {
      const tg = await probeTelegram();
      telegramOk = tg?.connected === true;
      telegramDetail = tg?.connected === true ? 'telegram bot connected' : 'telegram configured but not yet connected/authorized';
    }
    checks.push({ id: 'telegram.connected', label: 'Telegram connected', required: false, ok: telegramOk, detail: telegramDetail });

    const requiredFails = checks.filter(c => c.required && !c.ok).length;
    const advisoryFails = checks.filter(c => !c.required && !c.ok).length;
    const status = requiredFails > 0 ? 'ACTION_REQUIRED' : advisoryFails > 0 ? 'DEGRADED' : 'READY';

    return {
      status,
      checks,
      profile_applied_at: profile?.appliedAt ?? null,
      evaluated_at
    };
  }

  return { getProfile, applyProfile, resetProfile, plan, readiness };
}
