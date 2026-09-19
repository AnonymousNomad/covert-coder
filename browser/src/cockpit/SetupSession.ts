// Resident Adaptive Setup Session (Gate #2) — interview → configuration plan →
// approval → providers → hardware → model recommendations/selection → workflow
// profile + skills → integrations → validation → WORKSPACE READY.
//
// Truth rules this session enforces:
//   - The CONTEXT PLAN, model states, provider states, integration states and
//     the final WIN verdict all come from the SERVER (/api/setup/plan,
//     /api/setup/readiness, /api/connections). The wizard composes and renders
//     the verdict; it never recomputes readiness on the client.
//   - Model state chips come from the runtime/artifact probe merged server-side;
//     artifact presence never renders as a running engine.
//   - Every mutation (apply profile, rescan persistence, model/skill commits,
//     reset) flows through the governed route layer; a 409 surfaces the
//     approval dialog through the same path as every other operation.
//   - The profile is owned by the server (<workspace>/.aide/setup-profile.json).
//     This session hydrates from it on open, so a restart reconstructs the
//     session from durable state — never from a browser-only file.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { SetupAnswersT, SetupPlanT, SetupProfileT, SetupReadinessT } from '../../../common/contracts/setup.ts';

export interface SetupSessionHandles {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

type Answers = SetupAnswersT;

const DEFAULT_ANSWERS: Answers = {
  workType: 'Software Engineering',
  secondaryWork: 'None',
  mode: 'LOCAL_FIRST',
  providers: [],
  projectLocations: '',
  localModelUse: 'Primary driver',
  approvalStrictness: 'STRICT',
  integrations: [],
  importantWorkflows: ''
};

const WORK_TYPES = ['Software Engineering', 'Web Development', 'Model Training', 'Research', 'Security & Audit', 'Documentation', 'Creative & Interface', 'Game Development'];
const SECONDARY = ['None', 'Web Development', 'Documentation', 'Research', 'Security & Audit', 'Creative & Interface'];
const PROVIDERS = ['OpenAI / compatible', 'Anthropic / Claude', 'Hugging Face', 'Local only'];
const LOCAL_USE = ['Primary driver', 'Assistant / copilot', 'Offline fallback', 'Evaluate only'];
const INTEGRATIONS = ['Telegram', 'GitHub', 'Discord'];
const STRICTNESS: Array<{ value: string; label: string }> = [
  { value: 'STRICT', label: 'STRICT (every operation is approved)' },
  { value: 'BALANCED', label: 'BALANCED (planned; effective remains strict)' },
  { value: 'RELAXED', label: 'RELAXED (planned; effective remains strict)' }
];
const ROLE_LABEL: Record<string, string> = { planner: 'Planner', coder: 'Coder', reviewer: 'Reviewer' };

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

const STATE_CHIP: Record<string, { label: string; cls: string }> = {
  available: { label: 'AVAILABLE', cls: 'warn' },
  startable: { label: 'STARTABLE', cls: 'warn' },
  running: { label: 'RUNNING', cls: 'ok' },
  ready: { label: 'READY', cls: 'ok' },
  starting: { label: 'STARTING', cls: 'warn' },
  stopped: { label: 'STOPPED', cls: 'warn' },
  degraded: { label: 'DEGRADED', cls: 'bad' },
  failed: { label: 'FAILED', cls: 'bad' }
};

const INTEGRATION_STATE: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: 'AVAILABLE', cls: 'ok' },
  CONFIGURABLE: { label: 'CONFIGURABLE', cls: 'warn' },
  PARTIAL: { label: 'PARTIAL', cls: 'warn' },
  DEFERRED: { label: 'DEFERRED', cls: 'warn' },
  UNAVAILABLE: { label: 'UNAVAILABLE', cls: 'bad' }
};

export function createSetupSession(
  host: HTMLElement,
  _store: Store<AppState>,
  opts: { onToast: (code: string, message: string) => void; onNavigate: (panel: Panel) => void }
): SetupSessionHandles {
  const root = el('div', 'cockpit-setup');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Resident adaptive setup session');
  root.setAttribute('aria-modal', 'true');
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

  const STAGES = ['WELCOME', 'INTERVIEW', 'CONFIGURATION PLAN', 'APPROVAL', 'PROVIDERS / SECRETS', 'HARDWARE', 'MODEL RECOMMENDATIONS', 'MODEL SETUP', 'WORKFLOW / SKILLS', 'INTEGRATIONS', 'VALIDATION', 'WORKSPACE READY'];
  let stage = 0;
  let open = false;
  let opener: HTMLElement | null = null;
  let answers: Answers = { ...DEFAULT_ANSWERS };
  let plan: SetupPlanT | null = null;
  let planBusy = false;
  let planError: string | null = null;
  let appliedProfile: SetupProfileT | null = null;
  let roles: { planner: string | null; coder: string | null; reviewer: string | null } = { planner: null, coder: null, reviewer: null };
  let selectedRole: 'planner' | 'coder' | 'reviewer' | null = null;
  let chosenFamilies: string[] = [];
  let readiness: SetupReadinessT | null = null;
  let readinessBusy = false;

  function renderField(labelText: string, control: HTMLElement): HTMLElement {
    const field = el('label', 'cockpit-setup-field');
    field.appendChild(el('span', 'cockpit-setup-label', labelText));
    field.appendChild(control);
    return field;
  }

  function select(values: Array<{ value: string; label: string }>, current: string, onChange: (value: string) => void): HTMLElement {
    const node = document.createElement('select');
    node.className = 'cockpit-setup-input';
    for (const option of values) {
      const item = document.createElement('option');
      item.value = option.value; item.textContent = option.label;
      if (option.value === current) item.selected = true;
      node.appendChild(item);
    }
    node.addEventListener('change', () => onChange(node.value));
    return node;
  }

  function multiSelect(values: string[], options: Array<{ value: string; label: string }>, onChange: (values: string[]) => void): HTMLElement {
    const group = el('div', 'cockpit-setup-multi');
    for (const option of options) {
      const label = el('label', 'cockpit-setup-check');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = values.includes(option.value);
      input.addEventListener('change', () => {
        const set = new Set(values);
        if (input.checked) set.add(option.value); else set.delete(option.value);
        onChange([...set]);
      });
      label.append(input, el('span', '', option.label));
      group.appendChild(label);
    }
    return group;
  }

  function line(labelText: string, value: string): HTMLElement {
    const row = el('div', 'cockpit-setup-kv');
    row.append(el('span', 'cockpit-setup-k', labelText), el('span', 'cockpit-setup-v', value));
    return row;
  }

  function stateChip(state: string): HTMLElement {
    const meta = STATE_CHIP[state] ?? STATE_CHIP.unknown!;
    return el('span', `cockpit-setup-chip ${meta.cls}`, meta.label);
  }

  function integrationChip(state: string): HTMLElement {
    const meta = INTEGRATION_STATE[state] ?? INTEGRATION_STATE.UNAVAILABLE!;
    return el('span', `cockpit-setup-chip ${meta.cls}`, meta.label);
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
    next.disabled = stage === 2 && (planBusy || (plan === null && planError === null));
    next.textContent = stage === 2 ? 'COMPILE PLAN' : stage === 3 ? 'APPROVE AND APPLY' : stage === 6 ? 'CONFIRM SELECTION' : stage === 7 ? 'CONFIRM ROLES' : 'CONTINUE';
    if (appliedProfile !== null && stage > 0) {
      body.appendChild(el('p', 'cockpit-setup-note', `RESUMING — profile applied ${new Date(appliedProfile.appliedAt).toISOString()}; changes below re-approve through the same gate.`));
    }

    if (stage === 0) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'This is not a tutorial. It is adaptive provisioning: your answers become a configuration plan compiled by the resident, you approve it, and Covert applies it to the real systems on this machine — through the same evaluation gate as every other operation.'));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Credentials stay in the OS-backed credential store. Models, providers and routing stay in their existing registries; this session composes views of them, it never duplicates them.'));
      if (appliedProfile !== null) {
        const reset = el('button', 'cockpit-setup-btn', 'RESET SETUP PROFILE') as HTMLButtonElement;
        reset.type = 'button';
        reset.addEventListener('click', () => { void resetSetup(); });
        body.appendChild(reset);
      }
    } else if (stage === 1) {
      body.appendChild(renderField('Primary work', select(WORK_TYPES.map(v => ({ value: v, label: v })), answers.workType, v => { answers.workType = v as Answers['workType']; })));
      body.appendChild(renderField('Secondary work', select(SECONDARY.map(v => ({ value: v, label: v })), answers.secondaryWork, v => { answers.secondaryWork = v as Answers['secondaryWork']; })));
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
      body.appendChild(renderField('Subscriptions / providers you hold', multiSelect(answers.providers, PROVIDERS.map(v => ({ value: v, label: v })), v => { answers.providers = v; })));
      body.appendChild(renderField('Project locations (comma-separated)', (() => { const i = document.createElement('input'); i.className = 'cockpit-setup-input'; i.value = answers.projectLocations; i.placeholder = 'e.g. E:\\projects'; i.addEventListener('input', () => { answers.projectLocations = i.value; }); return i; })()));
      body.appendChild(renderField('Desired local model use', select(LOCAL_USE.map(v => ({ value: v, label: v })), answers.localModelUse, v => { answers.localModelUse = v as Answers['localModelUse']; })));
      body.appendChild(renderField('Approval strictness', select(STRICTNESS, answers.approvalStrictness, v => { answers.approvalStrictness = v as Answers['approvalStrictness']; })));
      body.appendChild(renderField('Integrations', multiSelect(answers.integrations, INTEGRATIONS.map(v => ({ value: v, label: v })), v => { answers.integrations = v as Answers['integrations']; })));
      body.appendChild(renderField('Important recurring workflows', (() => { const i = document.createElement('input'); i.className = 'cockpit-setup-input'; i.value = answers.importantWorkflows; i.placeholder = 'e.g. review PRs, write tests, audit changes'; i.addEventListener('input', () => { answers.importantWorkflows = i.value; }); return i; })()));
    } else if (stage === 2) {
      if (plan === null && !planBusy) {
        void fetchPlan();
        body.appendChild(el('p', 'cockpit-setup-detail', 'COMPILING CONFIGURATION PLAN from live hardware, model, connection and skill probes…'));
        return;
      }
      if (planBusy) {
        body.appendChild(el('p', 'cockpit-setup-detail', 'COMPILING CONFIGURATION PLAN…'));
        return;
      }
      if (plan === null) {
        body.appendChild(el('p', 'cockpit-setup-note', `CONFIGURATION PLAN UNAVAILABLE — ${planError ?? 'live probes failed'}. Retry by pressing COMPILE PLAN.`));
      } else {
        body.appendChild(el('p', 'cockpit-setup-detail', 'Proposed configuration — nothing is applied yet.'));
        const planBox = el('div', 'cockpit-setup-plan');
        planBox.appendChild(line('WORKFLOW PROFILE', plan.workflowProfile));
        planBox.appendChild(line('MODE', plan.mode.replace('_', '-').toLowerCase()));
        planBox.appendChild(line('MODEL USE', plan.modelUse));
        planBox.appendChild(line('EXECUTION POLICY', plan.executionPolicy));
        planBox.appendChild(line('LOCAL RUNTIME', plan.localRuntime.state.toUpperCase() + ' — ' + plan.localRuntime.recommendation));
        planBox.appendChild(line('PROJECTS', plan.projectLocations.trim() !== '' ? plan.projectLocations : 'current workspace'));
        if (plan.importantWorkflows.trim() !== '') planBox.appendChild(line('RECURRING', plan.importantWorkflows));
        body.appendChild(planBox);
        const section = el('div', 'cockpit-setup-plan');
        section.appendChild(el('p', 'cockpit-setup-kv', ''))?.appendChild(el('span', 'cockpit-setup-k', 'CONNECTIONS (LIVE VIEW)'));
        for (const provider of plan.providers) {
          section.appendChild(line(`${provider.status.toUpperCase()}${provider.routing_available ? '' : ' · ROUTING N/A'} — ${provider.name}`, provider.detail || provider.status));
        }
        if (plan.providers.length === 0) section.appendChild(el('p', 'cockpit-setup-note', 'No provider entries surfaced — local-first route stays available.'));
        body.appendChild(section);
        const hw = el('div', 'cockpit-setup-plan');
        hw.appendChild(line('HARDWARE', `${plan.hardware.tier} / ${plan.hardware.backend} — ${plan.hardware.totalRamGb} GB RAM · ${plan.hardware.logicalCpus} cores · ${plan.hardware.vramMb} MB VRAM`));
        body.appendChild(hw);
        const modelSection = el('div', 'cockpit-setup-plan');
        modelSection.appendChild(el('span', 'cockpit-setup-k', 'MODEL RECOMMENDATIONS'));
        for (const rec of plan.models) {
          const row = el('label', 'cockpit-setup-rec');
          const text = el('span', 'cockpit-setup-rec-text', `${ROLE_LABEL[rec.role] ?? rec.role} → ${rec.name} (${rec.quant}) · ${bytes(rec.fileBytes)} · ${rec.contextTokens} ctx · ${rec.fit}${rec.onDisk ? ' · ON DISK' : ''}`);
          row.append(stateChip(rec.state), text);
          modelSection.appendChild(row);
        }
        if (plan.models.length === 0) modelSection.appendChild(el('p', 'cockpit-setup-note', 'No recommendations available — open MODELS to search Hugging Face directly.'));
        body.appendChild(modelSection);
        const skillSection = el('div', 'cockpit-setup-plan');
        skillSection.appendChild(el('span', 'cockpit-setup-k', 'SKILL FAMILIES'));
        for (const family of plan.skillFamilies) {
          skillSection.appendChild(line(family.available ? 'AVAILABLE' : 'MISSING ON DISK — ' + family.label, family.id));
        }
        body.appendChild(skillSection);
        const intSection = el('div', 'cockpit-setup-plan');
        intSection.appendChild(el('span', 'cockpit-setup-k', 'INTEGRATIONS'));
        for (const integration of plan.integrations) {
          intSection.appendChild(line(`${integration.id} — ${integration.detail}`, integration.state));
        }
        body.appendChild(intSection);
      }
    } else if (stage === 3) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Approval applies the configuration plan as the setup profile. It records answers, the hardware snapshot, execution policy, workflow profile and the skill selection; model and provider registries stay in their existing stores and remain governed.'));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Secrets are never part of this plan and never enter the record; provider credentials are configured separately under SETTINGS → SECURITY.'));
      if (answers.approvalStrictness !== 'STRICT') body.appendChild(el('p', 'cockpit-setup-note', 'BALANCED and RELAXED are planned policies; today every operation is approved (STRICT).'));
    } else if (stage === 4) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Provider state comes from the connection registry. Review each status and its evidence; an unconfigured provider requires setup before use.'));
      const list = el('div', 'cockpit-setup-plan');
      for (const provider of plan?.providers ?? []) {
        list.appendChild(line(`${provider.name} (${provider.kind})`, `${provider.status.toUpperCase()}${provider.routing_available ? ' · ROUTING AVAILABLE' : ' · ROUTING NOT AVAILABLE'}${provider.selected ? ' · SELECTED' : ''}`));
      }
      if ((plan?.providers.length ?? 0) === 0) list.appendChild(el('p', 'cockpit-setup-note', 'No provider entries surfaced.'));
      body.appendChild(list);
      body.appendChild(el('p', 'cockpit-setup-detail', 'Secret custody: the OS-backed credential store is the only owner. Configure keys under SETTINGS → SECURITY; this session never reads, stores, or transmits credential values.'));
      const openSettings = el('button', 'cockpit-setup-btn', 'OPEN SETTINGS') as HTMLButtonElement;
      openSettings.type = 'button';
      openSettings.addEventListener('click', () => { close(); opts.onNavigate('settings'); });
      body.appendChild(openSettings);
    } else if (stage === 5) {
      const hw = plan?.hardware;
      if (hw === undefined) {
        body.appendChild(el('p', 'cockpit-setup-note', 'No hardware snapshot — rerun the configuration plan.'));
      } else {
        body.appendChild(el('p', 'cockpit-setup-detail', 'Real scan evidence captured when the plan was compiled:'));
        const box = el('div', 'cockpit-setup-plan');
        box.appendChild(line('TIER', `${hw.tier} (${hw.backend})`));
        box.appendChild(line('RAM', `${hw.totalRamGb} GB`));
        box.appendChild(line('CPU', `${hw.logicalCpus} logical cores`));
        box.appendChild(line('VRAM', `${hw.vramMb} MB`));
        box.appendChild(line('SCANNED AT', new Date(hw.scannedAt).toISOString()));
        body.appendChild(box);
        const rescan = el('button', 'cockpit-setup-btn', 'RESCAN HARDWARE') as HTMLButtonElement;
        rescan.type = 'button';
        rescan.addEventListener('click', () => { void rescanHardware(); });
        body.appendChild(rescan);
      }
    } else if (stage === 6) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Recommended for this machine (hardware fit + model registry; advisory — you stay in control). State chips come from the model runtime, never from file headers:'));
      if ((plan?.models.length ?? 0) === 0) body.appendChild(el('p', 'cockpit-setup-note', 'No recommendations available — open MODELS to search Hugging Face directly.'));
      for (const rec of plan?.models ?? []) {
        const row = el('label', 'cockpit-setup-rec');
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'cockpit-rec'; input.checked = (selectedRole !== null && rec.role === selectedRole);
        input.addEventListener('change', () => { selectedRole = rec.role; });
        const text = el('span', 'cockpit-setup-rec-text', `${ROLE_LABEL[rec.role] ?? rec.role} → ${rec.name} (${rec.quant}) · ${bytes(rec.fileBytes)} · ${rec.contextTokens} ctx · ${rec.fit}${rec.onDisk ? ' · ON DISK' : ''} — ${rec.reason}`);
        row.append(input, stateChip(rec.state), text);
        body.appendChild(row);
      }
      body.appendChild(el('p', 'cockpit-setup-detail', 'Confirming records the selection in the setup profile and maps it to its role. Starting the engine stays an explicit operation in MODELS.'));
    } else if (stage === 7) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Role mapping (recorded in the profile; the routing engine remains authoritative for requests):'));
      const box = el('div', 'cockpit-setup-plan');
      if (plan !== null) {
        for (const rec of plan.models) {
          const v = roles[rec.role] ?? 'unassigned';
          box.appendChild(line(`${ROLE_LABEL[rec.role] ?? rec.role}`, v !== 'unassigned' ? rec.name : 'unassigned → local-first fallback applies'));
        }
      }
      body.appendChild(box);
      body.appendChild(el('p', 'cockpit-setup-detail', 'Model serving state is managed in the MODELS panel; setup records intent, not a running-engine claim.'));
      const openModels = el('button', 'cockpit-setup-btn', 'OPEN MODELS') as HTMLButtonElement;
      openModels.type = 'button';
      openModels.addEventListener('click', () => { close(); opts.onNavigate('models'); });
      body.appendChild(openModels);
    } else if (stage === 8) {
      body.appendChild(line('WORKFLOW PROFILE', plan?.workflowProfile ?? planName()));
      body.appendChild(el('p', 'cockpit-setup-detail', 'Skill families are committed to the setup profile. Selection is bounded; the in-loop loader still auto-selects per task at run time.'));
      if (plan !== null) {
        for (const family of plan.skillFamilies) {
          const row = el('label', 'cockpit-setup-check');
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = chosenFamilies.includes(family.id);
          input.disabled = !family.available;
          input.addEventListener('change', () => {
            const set = new Set(chosenFamilies);
            if (input.checked) set.add(family.id); else set.delete(family.id);
            chosenFamilies = [...set];
          });
          row.append(input, el('span', '', `${family.label}${family.available ? '' : ' — not on disk'}`));
          body.appendChild(row);
        }
      }
    } else if (stage === 9) {
      body.appendChild(el('p', 'cockpit-setup-detail', 'Integrations are verified against their real surfaces — no row claims success without a live status:'));
      const list = el('div', 'cockpit-setup-plan');
      for (const integration of plan?.integrations ?? []) {
        const row = el('div', 'cockpit-setup-kv');
        row.append(el('span', 'cockpit-setup-k', integration.id), integrationChip(integration.state));
        list.appendChild(row);
        list.appendChild(el('p', 'cockpit-setup-detail', integration.detail));
      }
      if ((plan?.integrations.length ?? 0) === 0) list.appendChild(el('p', 'cockpit-setup-note', 'No integrations requested.'));
      body.appendChild(list);
    } else if (stage === 10) {
      if (readiness === null && !readinessBusy) {
        void fetchReadiness();
        body.appendChild(el('p', 'cockpit-setup-detail', 'RUNNING VALIDATION CHECKS…'));
        return;
      }
      if (readinessBusy) {
        body.appendChild(el('p', 'cockpit-setup-detail', 'RUNNING VALIDATION CHECKS…'));
        return;
      }
      if (readiness === null) {
        body.appendChild(el('p', 'cockpit-setup-note', 'VALIDATION UNAVAILABLE — probes failed.'));
      } else {
        body.appendChild(el('p', 'cockpit-setup-detail', 'Server-computed readiness — the wizard renders the verdict, it does not fabricate it:'));
        const list = el('div', 'cockpit-setup-plan');
        for (const check of readiness.checks) {
          list.appendChild(line(`${(check.required ? 'REQUIRED' : 'ADVISORY')} · ${check.ok ? 'PASS' : 'FAIL'} — ${check.label}`, check.detail));
        }
        body.appendChild(list);
        const verdict = el('p', readiness.status === 'READY' ? 'cockpit-setup-ready' : 'cockpit-setup-note', readiness.status === 'READY' ? 'READINESS: READY' : readiness.status === 'DEGRADED' ? 'READINESS: DEGRADED — advisory checks pending' : 'READINESS: ACTION REQUIRED — required checks pending');
        body.appendChild(verdict);
      }
    } else if (stage === 11) {
      const status = readiness?.status ?? 'ACTION_REQUIRED';
      body.appendChild(el('p', status === 'READY' ? 'cockpit-setup-ready' : 'cockpit-setup-note', status === 'READY' ? 'YOUR WORKSPACE IS READY.' : status === 'DEGRADED' ? 'WORKSPACE DEGRADED — revisions are advisory.' : 'WORKSPACE ACTION REQUIRED — complete the required steps below.'));
      if (status !== 'READY') {
        body.appendChild(el('p', 'cockpit-setup-detail', 'Answer the required checks (marker) before claiming readiness; DEGRADED is honest, READY is earned.'));
      }
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

  async function fetchPlan(): Promise<void> {
    planBusy = true;
    planError = null;
    renderStage();
    try {
      const response = await api.setupPlan(answers);
      plan = response.plan;
      chosenFamilies = plan.skillFamilies.filter(f => f.available).map(f => f.id);
      if (plan.models.length > 0 && !plan.models.some(m => m.role === selectedRole)) selectedRole = plan.models.find(m => m.onDisk)?.role ?? plan.models[0]?.role ?? null;
    } catch (error) {
      plan = null;
      planError = String((error as Error).message).slice(0, 160);
      opts.onToast('BAD_REQUEST', `Plan compile failed (${String((error as Error).message).slice(0, 90)}).`);
    } finally {
      planBusy = false;
      renderStage();
    }
  }

  function buildProfile(): SetupProfileT {
    const nextRoles = { ...roles };
    if (selectedRole !== null && plan !== null) {
      const rec = plan.models.find(m => m.role === selectedRole);
      if (rec !== undefined) nextRoles[selectedRole] = rec.modelId;
    }
    return {
      version: 1,
      answers,
      skillFamilies: chosenFamilies.slice(0, 8),
      selectedModelId: Object.values(nextRoles).find(v => v !== null) ?? null,
      roles: nextRoles,
      hardware: plan?.hardware ?? { totalRamGb: 0, logicalCpus: 0, vramMb: 0, tier: 'unknown', backend: 'unknown', scannedAt: Date.now() },
      // The server replaces these with its durable timestamps, but the
      // request contract intentionally rejects zero/placeholder timestamps.
      appliedAt: appliedProfile?.appliedAt ?? Date.now(),
      updatedAt: appliedProfile?.updatedAt ?? Date.now()
    };
  }

  async function approveAndApply(): Promise<boolean> {
    try {
      if (plan === null) throw new Error('configuration plan is required before approval');
      const response = await api.setupProfilePut(buildProfile(), appliedProfile?.updatedAt ?? null);
      if (response.profile === null) throw new Error('server returned no profile');
      const profile = response.profile;
      appliedProfile = profile;
      opts.onToast('OK', `Setup profile applied (${profile.answers.mode} · ${profile.skillFamilies.length} skill families).`);
    } catch (error) {
      opts.onToast('BAD_REQUEST', `Profile apply needs approval or failed (${String((error as Error).message).slice(0, 90)}).`);
      return false;
    }
    // Best-effort legacy onboarding record; failures stay non-blocking.
    try {
      const roleMap: Record<string, string> = { 'Model Training': 'researcher', Research: 'researcher', 'Security & Audit': 'other', Documentation: 'other', 'Creative & Interface': 'other' };
      const workbench = answers.workType === 'Model Training' || answers.workType === 'Research' ? 'sovereign-pipeline' : answers.workType === 'Security & Audit' ? 'sovereign-architect' : 'sovereign-coder';
      await api.onboardingNext({ role: (roleMap[answers.workType] ?? 'developer') as never, workbench: workbench as never });
    } catch { /* legacy surface optional */ }
    return true;
  }

  async function rescanHardware(): Promise<void> {
    opts.onToast('INFO', 'Rescanning hardware…');
    try {
      const response = await api.setupPlan(answers);
      plan = response.plan;
      await api.setupProfilePut(buildProfile(), appliedProfile?.updatedAt ?? null).then(r => { appliedProfile = r.profile; });
      opts.onToast('OK', `Hardware snapshot updated (${plan.hardware.totalRamGb} GB RAM).`);
    } catch (error) {
      opts.onToast('BAD_REQUEST', `Rescan needs approval or failed (${String((error as Error).message).slice(0, 90)}).`);
    }
    renderStage();
  }

  async function resetSetup(): Promise<void> {
    try {
      await api.setupProfileReset();
      appliedProfile = null;
      plan = null;
      readiness = null;
      answers = { ...DEFAULT_ANSWERS };
      roles = { planner: null, coder: null, reviewer: null };
      selectedRole = null;
      chosenFamilies = [];
      opts.onToast('OK', 'Setup profile reset; the wizard starts fresh.');
    } catch (error) {
      opts.onToast('BAD_REQUEST', `Reset needs approval or failed (${String((error as Error).message).slice(0, 90)}).`);
    }
    renderStage();
  }

  async function fetchReadiness(): Promise<void> {
    readinessBusy = true;
    renderStage();
    try {
      const response = await api.setupReadiness();
      readiness = response.readiness;
    } catch (error) {
      readiness = null;
      opts.onToast('BAD_REQUEST', `Validation failed (${String((error as Error).message).slice(0, 90)}).`);
    } finally {
      readinessBusy = false;
      renderStage();
    }
  }

  function commitProfile(): void {
    void api.setupProfilePut(buildProfile(), appliedProfile?.updatedAt ?? null)
      .then(response => {
        appliedProfile = response.profile;
        opts.onToast('OK', 'Setup profile updated.');
      })
      .catch(error => opts.onToast('BAD_REQUEST', `Update needs approval or failed (${String((error as Error).message).slice(0, 90)}).`));
  }

  async function advance(): Promise<void> {
    if (stage === 2 && plan === null) {
      if (!planBusy) void fetchPlan();
      return;
    }
    if (stage === 3) {
      if (!await approveAndApply()) { renderStage(); return; }
      stage = Math.min(stage + 1, STAGES.length - 1); renderStage(); return;
    }
    if (stage === 8) commitProfile();
    stage = Math.min(stage + 1, STAGES.length - 1);
    renderStage();
  }

  back.addEventListener('click', () => { if (stage > 0) { stage--; renderStage(); } });
  next.addEventListener('click', () => { void advance(); });
  skip.addEventListener('click', () => close());

  async function hydrate(): Promise<void> {
    try {
      const response = await api.setupProfile();
      const profile = response.profile;
      if (profile !== null) {
        answers = { ...profile.answers };
        appliedProfile = profile;
        roles = { ...profile.roles };
        chosenFamilies = [...profile.skillFamilies];
      }
    } catch { /* first run */ }
  }

  function show(): void {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    open = true;
    root.hidden = false;
    stage = 0;
    renderStage();
    next.focus();
    void hydrate().then(() => renderStage());
  }

  function close(): void {
    open = false;
    root.hidden = true;
    opener?.focus();
  }
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(node => node.getClientRects().length > 0);
    const first = controls[0]; const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });

  return {
    open(): void { show(); },
    close(): void { close(); },
    isOpen(): boolean { return open; }
  };
}
