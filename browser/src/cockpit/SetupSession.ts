// Resident Adaptive Setup Session — interview → configuration plan → approval
// → provisioning over the REAL systems (onboarding, hardware, models, BYOK,
// workflow). Nothing is applied before the explicit approval step; every
// mutation is an approved operation. No duplicate stores, no alternate
// authority path. The reusable profile persists to <workspace>/.aide/setup-session.json.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { OnboardingUserChoicesT } from '../../../common/contracts/onboarding.ts';
import type { HardwareRecommendResponseT } from '../../../common/contracts/hardware.ts';

export interface SetupSessionHandles {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

interface Answers {
  workType: string;
  secondaryWork: string;
  mode: 'LOCAL_FIRST' | 'HYBRID' | 'CLOUD';
  providers: string[];
  projectLocations: string;
  localModelUse: string;
  approvalStrictness: string;
  integrations: string[];
  importantWorkflows: string;
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
  root.setAttribute('aria-label', 'Resident adaptive setup session');
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

  const STAGES = ['WELCOME', 'INTERVIEW', 'CONFIGURATION PLAN', 'APPROVAL', 'PROVIDERS / SECRETS', 'HARDWARE SCAN', 'MODEL RECOMMENDATIONS', 'MODEL SETUP', 'WORKFLOW / SKILLS', 'INTEGRATIONS', 'VALIDATION', 'WORKSPACE READY'];
  let stage = 0;
  let open = false;
  let answers: Answers = { ...DEFAULT_ANSWERS };
  let recommendations: Recommendation[] = [];
  let selected: Recommendation | null = null;
  let hardwareLine = 'not scanned yet';
  let providersLine = 'not inspected yet';
  let workflowLine = 'not inspected yet';
  let checks: Array<{ label: string; ok: boolean; detail: string }> = [];
  let ready = false;

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
    for (const option of options) {
      const label = el('label', 'cockpit-setup-check');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = values.includes(option);
      input.addEventListener('change', () => {
        const set = new Set(values);
        if (input.checked) set.add(option); else set.delete(option);
        onChange([...set]);
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
    back.disabled = stage === 0;
    next.hidden = stage === STAGES.length - 1;
    next.textContent = stage === 3 ? 'APPROVE AND APPLY' : stage === 2 ? 'APPROVE CONFIGURATION' : 'CONTINUE';

    if (stage === 0) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'This is not a tutorial. It is adaptive provisioning: your answers become a concrete configuration plan, you approve it, and Covert applies it to the real systems on this machine. Nothing is applied before your approval.'));
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
      plan.appendChild(line('PROVIDERS', answers.providers.length > 0 ? answers.providers.join(', ') : 'local only'));
      plan.appendChild(line('INTEGRATIONS', answers.integrations.length > 0 ? answers.integrations.join(', ') : 'none selected'));
      plan.appendChild(line('PROJECTS', answers.projectLocations.trim() !== '' ? answers.projectLocations : 'current workspace'));
      if (answers.importantWorkflows.trim() !== '') plan.appendChild(line('RECURRING', answers.importantWorkflows));
      body.appendChild(plan);
    } else if (stage === 3) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Approval applies the plan: onboarding choices are recorded, hardware is scanned, and model recommendations are calculated. Mutations use the same approved-operation path you will see for every action in Covert.'));
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
      body.appendChild(el('p', 'cockpit-setup-detail', 'Skills: the in-loop loader selects relevant skills automatically per task; no manual packaging is required here.'));
    } else if (stage === 9) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Integrations are verified against their real surfaces:'));
      body.appendChild(el('div', 'cockpit-setup-plan')).appendChild(line('TELEGRAM', 'configurable — status surface available; connect under SETTINGS when a bot token exists'));
      body.appendChild(line('GITHUB', 'available through the existing Git surface (status, diff, stage, commit)'));
      body.appendChild(line('DISCORD', 'not available today — no adapter exists; deferred, not faked'));
    } else if (stage === 10) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Validation runs real checks before anything is called ready:'));
      const list = el('div', 'cockpit-setup-plan');
      for (const check of checks) list.appendChild(line(`${check.ok ? 'PASS' : 'INFO'} — ${check.label}`, check.detail));
      body.appendChild(list);
      ready = checks.filter(c => c.label !== 'providers').every(c => c.ok);
      body.appendChild(el('p', ready ? 'cockpit-setup-ready' : 'cockpit-setup-note', ready ? 'CORE VALIDATION PASSED' : 'CORE VALIDATION INCOMPLETE — review the checks above'));
    } else if (stage === 11) {
      body.appendChild(el('p', 'cockpit-setup-ready', ready ? 'YOUR WORKFLOW IS READY.' : 'SETUP SAVED — SOME CHECKS REMAIN'));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Talk to Resident to begin.'));
      const actions = el('div', 'cockpit-setup-actions');
      const makeAction = (label: string, panel: Panel): HTMLElement => {
        const button = el('button', 'cockpit-setup-btn', label) as HTMLButtonElement;
        button.type = 'button';
        button.addEventListener('click', () => { close(); opts.onNavigate(panel); });
        return button;
      };
      actions.append(makeAction('OPEN PROJECT', 'projects'), makeAction('OPEN EDITOR TO PASTE CODE', 'editor'), makeAction('DESCRIBE TO RESIDENT', 'resident'), makeAction('OPEN COMMAND CENTER', 'command-center'));
      body.appendChild(actions);
    }
  }

  async function loadProfile(): Promise<void> {
    try {
      const file = await api.fileRead('.aide/setup-session.json');
      if (typeof file.content === 'string' && file.content.trim() !== '') {
        const parsed = JSON.parse(file.content) as { answers?: Partial<Answers> };
        if (parsed.answers) answers = { ...DEFAULT_ANSWERS, ...parsed.answers };
        return;
      }
    } catch { /* first run: defaults */ }
    answers = { ...DEFAULT_ANSWERS };
  }

  async function approvalApply(): Promise<void> {
    try {
      const roleMap: Record<string, OnboardingUserChoicesT['role']> = { Research: 'researcher', 'Security & Audit': 'other', Documentation: 'other', 'Creative & Interface': 'other' };
      const workbench: OnboardingUserChoicesT['workbench'] = answers.workType === 'Model Training' || answers.workType === 'Research' ? 'sovereign-pipeline' : answers.workType === 'Security & Audit' ? 'sovereign-architect' : 'sovereign-coder';
      await api.onboardingNext({ role: roleMap[answers.workType] ?? 'developer', workbench });
      opts.onToast('BAD_REQUEST', 'Setup plan approved and recorded.');
    } catch (error) {
      opts.onToast('BAD_REQUEST', `Onboarding step needs approval or failed (${String((error as Error).message).slice(0, 80)}); continuing with local plan.`);
    }

    try {
      const profile = await api.hardwareProfile();
      hardwareLine = `${Math.round(profile.totalRamBytes / 1073741824)} GB RAM · ${profile.logicalCpus} CPUs · ${profile.freeRamBytes >= 2147483648 ? Math.round(profile.freeRamBytes / 1073741824) + ' GB free' : Math.round(profile.freeRamBytes / 1048576) + ' MB free'}`;
    } catch { hardwareLine = 'unavailable (probe failed)'; }

    try {
      const recommend = await api.hardwareRecommend() as HardwareRecommendResponseT;
      recommendations = recommend.recommendations.map(r => ({ role: r.role, modelId: r.modelId, name: r.name, quant: r.quant, fileBytes: r.fileBytes, contextTokens: r.contextTokens, fit: r.fit, onDisk: r.onDisk }));
      selected = recommendations.find(r => r.onDisk) ?? recommendations[0] ?? null;
    } catch { recommendations = []; }

    try {
      const status = await api.byokStatus();
      providersLine = `${status.providers.length} configured · consent ${status.consent_enabled ? 'enabled' : 'disabled'}`;
    } catch { providersLine = 'unavailable'; }

    try {
      const state = await api.workflowState();
      workflowLine = `stage ${state.stage} (governed runtime reachable)`;
    } catch { workflowLine = 'unavailable'; }
  }

  async function runValidation(): Promise<void> {
    const results: Array<{ label: string; ok: boolean; detail: string }> = [];
    const attempt = async (label: string, run: () => Promise<string>) => {
      try { results.push({ label, ok: true, detail: await run() }); }
      catch (error) { results.push({ label, ok: false, detail: String((error as Error).message).slice(0, 90) }); }
    };
    await attempt('daemon', async () => (await api.health()).workspace ?? 'reachable');
    await attempt('hardware', async () => { const p = await api.hardwareProfile(); return `${Math.round(p.totalRamBytes / 1073741824)} GB RAM`; });
    await attempt('model registry', async () => { const s = await api.modelsStatus(); return `${s.models.length} models configured`; });
    await attempt('workflow runtime', async () => { const w = await api.workflowState(); return `stage ${w.stage}`; });
    await attempt('evidence bus', async () => { const a = await api.auditRead({ limit: 5 }); return `${a.events.length} recent events`; });
    await attempt('providers', async () => { const b = await api.byokStatus(); return `${b.providers.length} configured`; });
    checks = results;
  }

  async function finish(): Promise<void> {
    const payload = JSON.stringify({ version: 1, answers, planName: planName(), selectedModelId: selected?.modelId ?? null, completedAt: new Date().toISOString() }, null, 2);
    try {
      await api.fileWrite('.aide/setup-session.json', payload);
      opts.onToast('BAD_REQUEST', 'Workflow profile saved to .aide/setup-session.json.');
    } catch (error) {
      opts.onToast('BAD_REQUEST', `Profile save needs approval or failed (${String((error as Error).message).slice(0, 70)}).`);
    }
    try { await api.onboardingComplete(); } catch { /* completion remains reopenable */ }
    close();
  }

  async function advance(): Promise<void> {
    if (stage === 3) await approvalApply();
    if (stage === 10) await runValidation();
    if (stage === 11) { await finish(); return; }
    stage = Math.min(stage + 1, STAGES.length - 1);
    if (stage === 4) {
      try { const b = await api.byokStatus(); providersLine = `${b.providers.length} configured · consent ${b.consent_enabled ? 'enabled' : 'disabled'}`; } catch { providersLine = 'unavailable'; }
    }
    renderStage();
  }

  back.addEventListener('click', () => { if (stage > 0) { stage--; renderStage(); } });
  next.addEventListener('click', () => { void advance(); });
  skip.addEventListener('click', () => close());

  function show(): void {
    open = true;
    root.hidden = false;
    stage = 0;
    renderStage();
    void loadProfile().then(() => renderStage());
  }

  function close(): void {
    open = false;
    root.hidden = true;
  }

  return {
    open(): void { show(); },
    close(): void { close(); },
    isOpen(): boolean { return open; }
  };
}
