// Resident Adaptive Setup Session — interview → configuration plan → approval
// → approved preference persistence and inspection of existing systems.
// Account connection, model setup and execution policy remain explicit actions.
// Nothing is written before the explicit approval step; every
// mutation is an approved operation. No duplicate stores, no alternate
// authority path. The reusable profile persists to <workspace>/.aide/setup-session.json.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { OnboardingUserChoicesT } from '../../../common/contracts/onboarding.ts';
import type { HardwareRecommendResponseT } from '../../../common/contracts/hardware.ts';
import { createSetupValidation, setupOperationalIdentityFingerprint, setupValidationReady, type SetupCheck } from './setup-validation.ts';
import { SetupProfile, parseSetupProfile, setupPreferenceSignature, setupChoiceDispositions, type Answers } from './setup-profile.ts';

export interface SetupSessionHandles {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

interface Recommendation { role: string; modelId: string; name: string; quant: string; fileBytes: number; contextTokens: number; fit: string; onDisk: boolean; }

const DEFAULT_ANSWERS: Answers = {
  workType: 'Software Engineering',
  secondaryWork: 'None',
  mode: 'LOCAL_FIRST',
  providers: [],
  projectLocations: '',
  localModelUse: 'Primary driver',
  approvalStrictness: 'STRICT (every operation is approved)',
  integrations: [],
  importantWorkflows: ''
};

const WORK_TYPES = ['Software Engineering', 'Web Development', 'Model Training', 'Research', 'Security & Audit', 'Documentation', 'Creative & Interface', 'Game Development'];
const SECONDARY = ['None', 'Web Development', 'Documentation', 'Research', 'Security & Audit', 'Creative & Interface'];
const PROVIDERS = ['OpenAI / compatible', 'Anthropic / Claude', 'Hugging Face', 'Local only'];
const LOCAL_USE = ['Primary driver', 'Assistant / copilot', 'Offline fallback', 'Evaluate only'];
const INTEGRATIONS = ['Telegram', 'GitHub', 'Discord (unavailable today)'];
const STRICTNESS = ['STRICT (every operation is approved)', 'BALANCED (planned)', 'RELAXED (planned)'];

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function bytes(size: number): string {
  if (size >= 1073741824) return `${(size / 1073741824).toFixed(1)} GB`;
  return `${Math.round(size / 1048576)} MB`;
}

export function createSetupSession(
  host: HTMLElement,
  _store: Store<AppState>,
  opts: { onToast: (code: string, message: string) => void; onNavigate: (panel: Panel) => void }
): SetupSessionHandles {
  const root = el('div', 'cockpit-setup');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Cipher adaptive setup session');
  const card = el('div', 'cockpit-setup-card');
  const header = el('div', 'cockpit-setup-header');
  const stageLabel = el('span', 'cockpit-setup-stage', '');
  const title = el('h2', 'cockpit-setup-title', '');
  header.append(stageLabel, title);
  const body = el('div', 'cockpit-setup-body');
  const controls = el('div', 'cockpit-setup-controls');
  const back = el('button', 'cockpit-setup-btn', 'BACK') as HTMLButtonElement;
  const next = el('button', 'cockpit-setup-btn cockpit-setup-primary', 'CONTINUE') as HTMLButtonElement;
  const skip = el('button', 'cockpit-setup-btn', 'CLOSE') as HTMLButtonElement;
  for (const b of [back, next, skip]) b.type = 'button';
  controls.append(back, next, skip);
  card.append(header, body, controls);
  root.appendChild(card);
  host.appendChild(root);

  const STAGES = ['WELCOME', 'INTERVIEW', 'CONFIGURATION PLAN', 'APPROVAL', 'PROVIDERS / SECRETS', 'HARDWARE SCAN', 'MODEL RECOMMENDATIONS', 'MODEL SETUP', 'WORKFLOW / SKILLS', 'INTEGRATIONS', 'VALIDATION', 'SETUP RESULTS'];
  let stage = 0;
  let open = false;
  let answers: Answers = { ...DEFAULT_ANSWERS };
  let recommendations: Recommendation[] = [];
  let selected: Recommendation | null = null;
  let hardwareLine = 'not scanned yet';
  let providersLine = 'not inspected yet';
  let workflowLine = 'not inspected yet';
  const validation = createSetupValidation();
  let busy = false;
  let session = 0;
  let savedSignature: string | null = null;
  let savedModelId: string | null = null;
  let setupError = '';
  let completion: 'NOT_RUN' | 'PASSED' | 'FAILED' = 'NOT_RUN';
  let validatedIdentityFingerprint: string | null = null;
  let identityMonitorTimer: number | null = null;
  let identityMonitorEpoch = 0;
  let identityMonitorInFlight = false;

  function stopIdentityMonitor(): void {
    identityMonitorEpoch++;
    if (identityMonitorTimer !== null) window.clearInterval(identityMonitorTimer);
    identityMonitorTimer = null;
  }

  async function readOperationalIdentitySnapshot(): Promise<{ fingerprint: string; providerCount: number }> {
    const [modelAccess, providers] = await Promise.all([api.modelManager(), api.byokStatus()]);
    return { fingerprint: await setupOperationalIdentityFingerprint(modelAccess, providers), providerCount: providers.providers.length };
  }

  function revokeIdentityValidation(message: string): void {
    stopIdentityMonitor();
    validatedIdentityFingerprint = null;
    validation.invalidate();
    completion = 'NOT_RUN';
    setupError = message;
    renderStage();
  }

  function monitorOperationalIdentity(currentSession: number): void {
    stopIdentityMonitor();
    const epoch = identityMonitorEpoch;
    const recheck = async () => {
      if (identityMonitorInFlight || !open || session !== currentSession || stage !== 11 || busy || !setupValidationReady(validation.snapshot()) || validatedIdentityFingerprint === null) return;
      identityMonitorInFlight = true;
      try {
        const current = await readOperationalIdentitySnapshot();
        if (!open || session !== currentSession || stage !== 11 || busy || epoch !== identityMonitorEpoch) return;
        if (current.fingerprint !== validatedIdentityFingerprint) revokeIdentityValidation('MODEL / RUNTIME / PROVIDER IDENTITY CHANGED SINCE VALIDATION — rerun validation before setup can complete.');
      } catch {
        if (open && session === currentSession && stage === 11 && !busy && epoch === identityMonitorEpoch) revokeIdentityValidation('CURRENT MODEL / RUNTIME / PROVIDER IDENTITY UNAVAILABLE — validation was revoked; rerun when status can be read.');
      } finally {
        identityMonitorInFlight = false;
      }
    };
    identityMonitorTimer = window.setInterval(() => { void recheck(); }, 2000);
    void recheck();
  }

  async function identityStillMatches(currentSession: number): Promise<boolean> {
    if (validatedIdentityFingerprint === null) {
      revokeIdentityValidation('CURRENT MODEL / RUNTIME / PROVIDER IDENTITY WAS NOT BOUND — rerun validation before setup can complete.');
      return false;
    }
    try {
      const current = await readOperationalIdentitySnapshot();
      if (!open || session !== currentSession) return false;
      if (current.fingerprint !== validatedIdentityFingerprint) {
        revokeIdentityValidation('MODEL / RUNTIME / PROVIDER IDENTITY CHANGED SINCE VALIDATION — rerun validation before setup can complete.');
        return false;
      }
      return true;
    } catch {
      if (open && session === currentSession) revokeIdentityValidation('CURRENT MODEL / RUNTIME / PROVIDER IDENTITY UNAVAILABLE — validation was revoked; rerun when status can be read.');
      return false;
    }
  }

  function preferenceSignature(): string { return setupPreferenceSignature(answers, selected?.modelId ?? savedModelId); }
  function preferencesSaved(): boolean { return savedSignature === preferenceSignature(); }

  function renderField(labelText: string, control: HTMLElement): HTMLElement {
    const field = el('label', 'cockpit-setup-field');
    field.appendChild(el('span', 'cockpit-setup-label', labelText));
    field.appendChild(control);
    return field;
  }

  function select(value: string, options: string[], onChange: (value: string) => void): HTMLElement {
    const node = document.createElement('select');
    node.className = 'cockpit-setup-input';
    for (const option of options) {
      const item = document.createElement('option');
      item.value = option; item.textContent = option;
      if (option === value) item.selected = true;
      node.appendChild(item);
    }
    node.addEventListener('change', () => onChange(node.value));
    return node;
  }

  function multiSelect(values: string[], options: string[], onChange: (values: string[]) => void): HTMLElement {
    const group = el('div', 'cockpit-setup-multi');
    let selection = [...values];
    for (const option of options) {
      const label = el('label', 'cockpit-setup-check');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = values.includes(option);
      input.addEventListener('change', () => {
        const set = new Set(selection);
        if (input.checked) set.add(option); else set.delete(option);
        selection = [...set];
        onChange(selection);
      });
      label.append(input, el('span', '', option));
      group.appendChild(label);
    }
    return group;
  }

  function line(labelText: string, value: string): HTMLElement {
    const row = el('div', 'cockpit-setup-kv');
    row.append(el('span', 'cockpit-setup-k', labelText), el('span', 'cockpit-setup-v', value));
    return row;
  }

  function planName(): string {
    return answers.secondaryWork === 'None' ? answers.workType : `${answers.workType} + ${answers.secondaryWork}`;
  }

  function renderStage(): void {
    stageLabel.textContent = `SETUP ${stage + 1} OF ${STAGES.length}`;
    title.textContent = STAGES[stage]!;
    body.innerHTML = '';
    back.disabled = stage === 0 || busy;
    next.disabled = busy;
    next.hidden = stage === STAGES.length - 1 && completion === 'PASSED';
    if (stage === 11) next.disabled = busy || !setupValidationReady(validation.snapshot());
    next.textContent = stage === 11 ? 'SAVE AND COMPLETE SETUP' : stage === 3 ? 'APPROVE AND SAVE' : stage === 2 ? 'REVIEW APPROVAL' : stage === 10 ? 'RUN VALIDATION' : 'CONTINUE';
    if (setupError) body.appendChild(el('p', 'cockpit-setup-note', setupError));

    if (stage === 0) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'This session records your workflow preferences and inspects existing services after approval. Provider connections, model download/qualification, routing, consent, integrations and execution policy require their own explicit setup actions.'));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Every write crosses the same evaluation gate as the rest of the product. Secrets stay in the OS-backed credential store; models stay in the existing registry.'));
    } else if (stage === 1) {
      body.appendChild(renderField('Primary work', select(answers.workType, WORK_TYPES, v => { answers.workType = v; })));
      body.appendChild(renderField('Secondary work', select(answers.secondaryWork, SECONDARY, v => { answers.secondaryWork = v; })));
      const modes = el('div', 'cockpit-setup-multi');
      for (const mode of ['LOCAL_FIRST', 'HYBRID', 'CLOUD'] as const) {
        const label = el('label', 'cockpit-setup-check');
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'cockpit-mode'; input.checked = answers.mode === mode;
        input.addEventListener('change', () => { answers.mode = mode; });
        label.append(input, el('span', '', mode.replace('_', '-').toLowerCase()));
        modes.appendChild(label);
      }
      body.appendChild(renderField('Model preference', modes));
      body.appendChild(renderField('Subscriptions / providers you hold', multiSelect(answers.providers, PROVIDERS, v => { answers.providers = v; })));
      body.appendChild(renderField('Project locations (comma-separated)', (() => { const i = document.createElement('input'); i.className = 'cockpit-setup-input'; i.value = answers.projectLocations; i.placeholder = 'e.g. E:\\projects'; i.addEventListener('input', () => { answers.projectLocations = i.value; }); return i; })()));
      body.appendChild(renderField('Desired local model use', select(answers.localModelUse, LOCAL_USE, v => { answers.localModelUse = v; })));
      body.appendChild(renderField('Approval strictness', select(answers.approvalStrictness, STRICTNESS, v => { answers.approvalStrictness = v; })));
      body.appendChild(renderField('Integrations', multiSelect(answers.integrations, INTEGRATIONS, v => { answers.integrations = v; })));
      body.appendChild(renderField('Important recurring workflows', (() => { const i = document.createElement('input'); i.className = 'cockpit-setup-input'; i.value = answers.importantWorkflows; i.placeholder = 'e.g. review PRs, write tests, audit changes'; i.addEventListener('input', () => { answers.importantWorkflows = i.value; }); return i; })()));
    } else if (stage === 2) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Proposed configuration — nothing is applied yet.'));
      const plan = el('div', 'cockpit-setup-plan');
      plan.appendChild(line('WORKFLOW', planName()));
      plan.appendChild(line('MODE', answers.mode.replace('_', '-').toLowerCase()));
      plan.appendChild(line('MODEL USE', answers.localModelUse));
      plan.appendChild(line('EXECUTION POLICY', answers.approvalStrictness));
      plan.appendChild(line('PROVIDERS', answers.providers.length > 0 ? answers.providers.join(', ') : 'none recorded'));
      plan.appendChild(line('INTEGRATIONS', answers.integrations.length > 0 ? answers.integrations.join(', ') : 'none selected'));
      plan.appendChild(line('PROJECTS', answers.projectLocations.trim() !== '' ? answers.projectLocations : 'current workspace'));
      if (answers.importantWorkflows.trim() !== '') plan.appendChild(line('RECURRING', answers.importantWorkflows));
      body.appendChild(plan);
      for (const disposition of setupChoiceDispositions(preferencesSaved())) {
        body.appendChild(line(`${disposition.choice} — ${disposition.status}`, disposition.detail));
      }
    } else if (stage === 3) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Approval records role/workbench choices and saves interview preferences, then inspects hardware, providers and workflows. This does not provision accounts, models, projects or integrations. Failed required writes keep this step open for retry.'));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Secrets are never part of this plan and never enter the record; provider credentials are configured separately under SETTINGS → SECURITY.'));
      if (answers.approvalStrictness !== STRICTNESS[0]) body.appendChild(el('p', 'cockpit-setup-note', 'BALANCED and RELAXED policies are planned; today every operation is approved (STRICT).'));
    } else if (stage === 4) {
      body.appendChild(el('p', 'cockpit-setup-detail', `Providers: ${providersLine}`));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Custody of secrets: the OS-backed credential store is the only owner. Configure keys under SETTINGS → SECURITY → provider panels; this session never reads, stores, or transmits credential values.'));
      const openSettings = el('button', 'cockpit-setup-btn', 'OPEN SETTINGS') as HTMLButtonElement;
      openSettings.type = 'button';
      openSettings.addEventListener('click', () => { close(); opts.onNavigate('settings'); });
      body.appendChild(openSettings);
    } else if (stage === 5) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Hardware scan (real probe, unknown stays unknown):'));
      body.appendChild(el('div', 'cockpit-setup-plan', undefined)).appendChild(line('HARDWARE', hardwareLine));
    } else if (stage === 6) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Recommended for this machine (from the existing hardware recommender; advisory, you stay in control):'));
      if (recommendations.length === 0) body.appendChild(el('p', 'cockpit-setup-note', 'No recommendations available — open MODELS to search Hugging Face directly.'));
      for (const rec of recommendations) {
        const row = el('label', 'cockpit-setup-rec');
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'cockpit-rec'; input.checked = selected?.modelId === rec.modelId;
        input.addEventListener('change', () => { selected = rec; });
        const text = el('span', 'cockpit-setup-rec-text', `${rec.name} (${rec.quant}) · ${bytes(rec.fileBytes)} · ${rec.contextTokens} ctx · ${rec.fit}${rec.onDisk ? ' · ON DISK' : ''}`);
        row.append(input, text);
        body.appendChild(row);
      }
    } else if (stage === 7) {
      if (selected === null) body.appendChild(el('p', 'cockpit-setup-note', 'No model selected — you can install one any time from MODELS.'));
      else if (selected.onDisk) body.appendChild(el('p', 'cockpit-setup-detail', `${selected.name} (${selected.quant}) is already on disk in this workspace. Role assignment and runtime start live under MODELS and remain explicit operations.`));
      else body.appendChild(el('p', 'cockpit-setup-detail', `${selected.name} is recommended but not installed yet. Open MODELS to download/import it through the existing Hugging Face pipeline; setup continues without it.`));
      const openModels = el('button', 'cockpit-setup-btn', 'OPEN MODELS') as HTMLButtonElement;
      openModels.type = 'button';
      openModels.addEventListener('click', () => { close(); opts.onNavigate('models'); });
      body.appendChild(openModels);
    } else if (stage === 8) {
      body.appendChild(line('WORKFLOW PROFILE', planName()));
      body.appendChild(el('p', 'cockpit-setup-detail', `Workflow runtime: ${workflowLine}`));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Recurring workflow and skill preferences are recorded only. This interview does not create or enable a workflow or skill.'));
    } else if (stage === 9) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Integrations are verified against their real surfaces:'));
      body.appendChild(el('div', 'cockpit-setup-plan')).appendChild(line('TELEGRAM', 'configurable — status surface available; connect under SETTINGS when a bot token exists'));
      body.appendChild(line('GITHUB', 'available through the existing Git surface (status, diff, stage, commit)'));
      body.appendChild(line('DISCORD', 'not available today — no adapter exists; deferred, not faked'));
    } else if (stage === 10) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Validation runs real checks before anything is called ready:'));
      const list = el('div', 'cockpit-setup-plan');
      const result = validation.snapshot();
      for (const check of result.checks) list.appendChild(line(`${check.status} — ${check.label}`, check.detail));
      body.appendChild(list);
      const ready = setupValidationReady(result);
      body.appendChild(el('p', ready ? 'cockpit-setup-ready' : 'cockpit-setup-note', ready ? 'CORE VALIDATION PASSED' : `CORE VALIDATION ${result.status} — required checks must complete successfully`));
    } else if (stage === 11) {
      const result = validation.snapshot();
      const ready = setupValidationReady(result);
      const checks = el('div', 'cockpit-setup-plan');
      for (const check of result.checks) checks.appendChild(line(`${check.status} — ${check.label}`, check.detail));
      body.appendChild(checks);
      body.appendChild(el('p', ready ? 'cockpit-setup-ready' : 'cockpit-setup-note', ready ? 'CORE VALIDATION PASSED.' : `SETUP UNRESOLVED — VALIDATION ${result.status}`));
      body.appendChild(el('p', completion === 'PASSED' ? 'cockpit-setup-ready' : 'cockpit-setup-note', completion === 'PASSED' ? 'SETUP PREFERENCES SAVED AND COMPLETION RECORDED.' : `SETUP COMPLETION ${completion === 'FAILED' ? 'UNRESOLVED' : 'NOT RUN'}.`));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Core checks do not qualify a model or prove a usable execution route. Open MODELS to configure and verify the route you want to use.'));
      for (const disposition of setupChoiceDispositions(preferencesSaved())) body.appendChild(line(`${disposition.choice} — ${disposition.status}`, disposition.detail));
      const rerun = el('button', 'cockpit-setup-btn', 'RERUN VALIDATION') as HTMLButtonElement;
      rerun.type = 'button';
      rerun.addEventListener('click', () => { if (busy) return; stopIdentityMonitor(); validatedIdentityFingerprint = null; validation.invalidate(); completion = 'NOT_RUN'; setupError = ''; stage = 10; renderStage(); });
      body.appendChild(rerun);
      body.appendChild(el('p', 'cockpit-setup-detail', 'Talk to Cipher to begin.'));
      const actions = el('div', 'cockpit-setup-actions');
      const makeAction = (label: string, panel: Panel): HTMLElement => {
        const button = el('button', 'cockpit-setup-btn', label) as HTMLButtonElement;
        button.type = 'button';
        button.addEventListener('click', () => { close(); opts.onNavigate(panel); });
        return button;
      };
      actions.append(makeAction('OPEN PROJECT', 'projects'), makeAction('OPEN EDITOR TO PASTE CODE', 'editor'), makeAction('DESCRIBE TO CIPHER', 'resident'), makeAction('OPEN COMMAND CENTER', 'command-center'));
      body.appendChild(actions);
    }
  }

  async function loadProfile(currentSession: number): Promise<void> {
    try {
      const file = await api.fileRead('.aide/setup-session.json');
      if (!open || session !== currentSession) return;
      if (typeof file.content === 'string' && file.content.trim() !== '') {
        const parsed = parseSetupProfile(file.content);
        if (!parsed) { setupError = 'Saved setup preferences could not be validated. Review and save a new plan.'; return; }
        answers = parsed.answers;
        savedModelId = parsed.selectedModelId;
        savedSignature = preferenceSignature();
        // A persisted completion timestamp is historical, never current READY.
        stage = Math.min(parsed.stage, 10);
        return;
      }
    } catch { if (open && session === currentSession) setupError = 'Saved setup status unavailable; no previous completion is assumed.'; }
  }

  function onboardingChoices(): Pick<OnboardingUserChoicesT, 'role' | 'workbench'> {
    const roleMap: Record<string, OnboardingUserChoicesT['role']> = { Research: 'researcher', 'Security & Audit': 'other', Documentation: 'other', 'Creative & Interface': 'other' };
    const workbench: OnboardingUserChoicesT['workbench'] = answers.workType === 'Model Training' || answers.workType === 'Research' ? 'sovereign-pipeline' : answers.workType === 'Security & Audit' ? 'sovereign-architect' : 'sovereign-coder';
    return { role: roleMap[answers.workType] ?? 'developer', workbench };
  }

  async function saveProfile(resumeStage: number, currentSession: number, completedAt: string | null = null): Promise<boolean> {
    if (!open || session !== currentSession) return false;
    try {
      const profile = SetupProfile.parse({ version: 2, answers, planName: planName(), selectedModelId: selected?.modelId ?? savedModelId, stage: resumeStage, completedAt });
      await api.fileWrite('.aide/setup-session.json', JSON.stringify(profile, null, 2));
      if (!open || session !== currentSession) return false;
      savedModelId = profile.selectedModelId;
      savedSignature = setupPreferenceSignature(profile.answers, profile.selectedModelId);
      return true;
    } catch {
      if (open && session === currentSession) {
        stopIdentityMonitor();
        validatedIdentityFingerprint = null;
        savedSignature = null;
        validation.invalidate();
        setupError = 'SETUP SAVE FAILED — preferences/completion are unresolved. Retry the approved write.';
      }
      return false;
    }
  }

  async function approvalApply(currentSession: number): Promise<boolean> {
    try {
      const choices = onboardingChoices();
      let state = await api.onboardingState();
      if (!open || session !== currentSession) return false;
      // A profile-save retry must not advance the canonical walkthrough twice.
      if (state.user_choices.role !== choices.role || state.user_choices.workbench !== choices.workbench) {
        state = (await api.onboardingNext(choices)).state;
      }
      if (state.user_choices.role !== choices.role || state.user_choices.workbench !== choices.workbench) throw new Error('choices not recorded');
    } catch {
      if (open && session === currentSession) setupError = 'ONBOARDING CHOICES UNRESOLVED — approval/write did not complete. Retry before continuing.';
      return false;
    }

    if (!await saveProfile(4, currentSession)) return false;

    try {
      const profile = await api.hardwareProfile();
      if (!open || session !== currentSession) return false;
      hardwareLine = `${Math.round(profile.totalRamBytes / 1073741824)} GB RAM · ${profile.logicalCpus} CPUs · ${profile.freeRamBytes >= 2147483648 ? Math.round(profile.freeRamBytes / 1073741824) + ' GB free' : Math.round(profile.freeRamBytes / 1048576) + ' MB free'}`;
    } catch { if (!open || session !== currentSession) return false; hardwareLine = 'unavailable (probe failed)'; }

    try {
      const recommend = await api.hardwareRecommend() as HardwareRecommendResponseT;
      if (!open || session !== currentSession) return false;
      recommendations = recommend.recommendations.map(r => ({ role: r.role, modelId: r.modelId, name: r.name, quant: r.quant, fileBytes: r.fileBytes, contextTokens: r.contextTokens, fit: r.fit, onDisk: r.onDisk }));
      selected = savedModelId ? recommendations.find(r => r.modelId === savedModelId) ?? null : recommendations.find(r => r.onDisk) ?? recommendations[0] ?? null;
    } catch { if (!open || session !== currentSession) return false; recommendations = []; }

    try {
      const status = await api.byokStatus();
      if (!open || session !== currentSession) return false;
      providersLine = `${status.providers.length} configured · consent ${status.consent_enabled ? 'enabled' : 'disabled'}`;
    } catch { if (!open || session !== currentSession) return false; providersLine = 'unavailable'; }

    try {
      const state = await api.workflowState();
      if (!open || session !== currentSession) return false;
      workflowLine = `stage ${state.stage} (governed runtime reachable)`;
    } catch { if (!open || session !== currentSession) return false; workflowLine = 'unavailable'; }
    return true;
  }

  async function runValidation(): Promise<void> {
    stopIdentityMonitor();
    validatedIdentityFingerprint = null;
    const runId = validation.begin();
    renderStage();
    const results: SetupCheck[] = [];
    const attempt = async (label: string, run: () => Promise<string>) => {
      try { results.push({ label, status: 'PASSED', detail: await run() }); }
      catch { results.push({ label, status: 'UNAVAILABLE', detail: 'Check could not complete; retry when the service is available.' }); }
    };
    try {
      const health = await api.health();
      results.push({ label: 'daemon', status: health.state === 'HEALTHY' ? 'PASSED' : health.state === 'UNKNOWN' || health.state === 'STARTING' ? 'UNAVAILABLE' : 'FAILED', detail: `Daemon ${health.state}` });
    } catch { results.push({ label: 'daemon', status: 'UNAVAILABLE', detail: 'Daemon status unavailable' }); }
    await attempt('hardware', async () => { const p = await api.hardwareProfile(); return `${Math.round(p.totalRamBytes / 1073741824)} GB RAM`; });
    await attempt('model registry', async () => { const s = await api.modelsStatus(); return `${s.models.length} models configured`; });
    await attempt('workflow runtime', async () => { const w = await api.workflowState(); return `stage ${w.stage}`; });
    await attempt('evidence bus', async () => { const a = await api.auditRead({ limit: 5 }); return `${a.events.length} recent events`; });
    const choices = onboardingChoices();
    try {
      const state = await api.onboardingState();
      const matched = state.user_choices.role === choices.role && state.user_choices.workbench === choices.workbench;
      results.push({ label: 'onboarding choices', status: matched ? 'PASSED' : 'FAILED', detail: matched ? 'Role/workbench preferences recorded' : 'Required choices not recorded' });
    } catch { results.push({ label: 'onboarding choices', status: 'UNAVAILABLE', detail: 'Recorded choice status unavailable' }); }
    try {
      const file = await api.fileRead('.aide/setup-session.json');
      const profile = file.content ? parseSetupProfile(file.content) : null;
      const matched = profile !== null && setupPreferenceSignature(profile.answers, profile.selectedModelId) === preferenceSignature();
      if (matched && validation.snapshot().run === runId) savedSignature = preferenceSignature();
      results.push({ label: 'setup preferences', status: matched ? 'PASSED' : 'FAILED', detail: matched ? 'Current preferences persisted' : 'Current preferences missing or mismatched' });
    } catch { results.push({ label: 'setup preferences', status: 'UNAVAILABLE', detail: 'Persisted preferences unavailable' }); }
    try {
      const identitySnapshot = await readOperationalIdentitySnapshot();
      results.push({ label: 'providers', status: 'PASSED', detail: `${identitySnapshot.providerCount} configured` });
      results.push({ label: 'model access identity', status: 'PASSED', detail: 'Current models, artifacts and runtime are bound to this validation' });
      results.push({ label: 'provider identity', status: 'PASSED', detail: 'Current provider identities and routing are bound to this validation' });
      if (validation.complete(runId, results) && setupValidationReady(validation.snapshot())) validatedIdentityFingerprint = identitySnapshot.fingerprint;
    } catch {
      results.push({ label: 'providers', status: 'UNAVAILABLE', detail: 'Provider status could not be read during identity validation' });
      results.push({ label: 'model access identity', status: 'UNAVAILABLE', detail: 'Current model, artifact and runtime identity could not be bound to validation' });
      results.push({ label: 'provider identity', status: 'UNAVAILABLE', detail: 'Current provider identity could not be bound to validation' });
      validation.complete(runId, results);
    }
    if (!setupValidationReady(validation.snapshot())) validatedIdentityFingerprint = null;
  }

  async function finish(currentSession: number): Promise<void> {
    if (!setupValidationReady(validation.snapshot())) return;
    if (!await identityStillMatches(currentSession)) return;
    if (!await saveProfile(10, currentSession)) { if (open && session === currentSession) completion = 'FAILED'; return; }
    if (!await identityStillMatches(currentSession)) return;
    try {
      await api.onboardingComplete();
      if (!open || session !== currentSession) return;
      if (!await identityStillMatches(currentSession)) return;
    } catch {
      if (open && session === currentSession) { stopIdentityMonitor(); validatedIdentityFingerprint = null; completion = 'FAILED'; validation.invalidate(); setupError = 'SETUP COMPLETION FAILED — preferences remain saved; retry validation and completion.'; }
      return;
    }
    if (!await saveProfile(10, currentSession, new Date().toISOString())) { if (open && session === currentSession) completion = 'FAILED'; return; }
    completion = 'PASSED';
    stopIdentityMonitor();
  }

  async function advance(): Promise<void> {
    if (busy || !open) return;
    const currentSession = session;
    const currentStage = stage;
    busy = true;
    setupError = '';
    renderStage();
    try {
      if (currentStage === 3 && !await approvalApply(currentSession)) return;
      if (currentStage === 9 && !await saveProfile(10, currentSession)) return;
      if (currentStage === 10) await runValidation();
      if (currentStage === 11) { await finish(currentSession); return; }
      if (!open || session !== currentSession) return;
      stage = Math.min(currentStage + 1, STAGES.length - 1);
      if (stage === 4) {
        try {
          const b = await api.byokStatus();
          if (!open || session !== currentSession) return;
          providersLine = `${b.providers.length} configured · consent ${b.consent_enabled ? 'enabled' : 'disabled'}`;
        } catch {
          if (!open || session !== currentSession) return;
          providersLine = 'unavailable';
        }
      }
    } finally {
      if (open && session === currentSession) {
        busy = false;
        renderStage();
        if (stage === 11 && completion !== 'PASSED' && setupValidationReady(validation.snapshot())) monitorOperationalIdentity(currentSession);
      }
    }
  }

  back.addEventListener('click', () => { if (stage > 0 && !busy) { stopIdentityMonitor(); validatedIdentityFingerprint = null; validation.invalidate(); completion = 'NOT_RUN'; setupError = ''; stage--; renderStage(); } });
  next.addEventListener('click', () => { void advance(); });
  skip.addEventListener('click', () => close());

  function show(): void {
    stopIdentityMonitor();
    validatedIdentityFingerprint = null;
    session++;
    const currentSession = session;
    open = true;
    busy = true;
    validation.invalidate();
    completion = 'NOT_RUN';
    setupError = '';
    answers = { ...DEFAULT_ANSWERS, providers: [], integrations: [] };
    selected = null;
    recommendations = [];
    hardwareLine = 'not scanned yet';
    providersLine = 'not inspected yet';
    workflowLine = 'not inspected yet';
    savedModelId = null;
    savedSignature = null;
    root.hidden = false;
    stage = 0;
    renderStage();
    void loadProfile(currentSession).then(() => { if (open && session === currentSession) { busy = false; renderStage(); } });
  }

  function close(): void {
    stopIdentityMonitor();
    validatedIdentityFingerprint = null;
    session++;
    validation.invalidate();
    busy = false;
    open = false;
    root.hidden = true;
  }

  return {
    open(): void { show(); },
    close(): void { close(); },
    isOpen(): boolean { return open; }
  };
}
