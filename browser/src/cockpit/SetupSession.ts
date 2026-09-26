// Guided first-run configuration over the canonical Model Manager, provider,
// routing, workspace, and onboarding services. Durable onboarding data stores
// progress only; actual configuration remains in its existing owners.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { api, ApiError } from '../services/api.ts';
import type { OnboardingStateT, OnboardingStepT } from '../../../common/contracts/onboarding.ts';
import type { ConnectionsViewResponseT } from '../../../common/contracts/connections.ts';
import type { ByokStatusResponseT } from '../../../common/contracts/byok.ts';
import type { HardwareProfileResponseT } from '../../../common/contracts/hardware.ts';
import type { ModelManagerSnapshotResponseT } from '../../../common/contracts/model-manager.ts';
import type { HealthResponseT } from '../../../common/contracts/health.ts';
import type { ModelStatusResponseT } from '../../../common/contracts/models.ts';
import type { RoutesResponseT } from '../../../common/contracts/routing.ts';

export interface SetupSessionHandles {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

const STEPS: Array<{ id: OnboardingStepT; title: string }> = [
  { id: 'welcome', title: 'WELCOME TO COVERT' },
  { id: 'local_intelligence', title: 'THIS COMPUTER & LOCAL MODELS' },
  { id: 'providers', title: 'YOUR PROVIDER CONNECTIONS' },
  { id: 'workflow', title: 'CHOOSE A WORKFLOW' },
  { id: 'security', title: 'PERMISSIONS & TRUST' },
  { id: 'workspace', title: 'YOUR WORKSPACE' },
  { id: 'verify', title: 'VERIFY THE SETUP' },
  { id: 'finish', title: 'READY TO WORK' }
];

const ROUTES = [
  { id: 'plan', label: 'Planner' },
  { id: 'act', label: 'Implementer' },
  { id: 'utility', label: 'Utility' }
] as const;
type Role = (typeof ROUTES)[number]['id'];
type WorkflowProfile = 'local' | 'custom';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stepIndex(step: OnboardingStepT): number {
  return Math.max(0, STEPS.findIndex(entry => entry.id === step));
}

function statusLine(status: string): string {
  return status.replaceAll('_', ' ').toUpperCase();
}

function bytesGiB(value: number): string {
  return `${(value / 1073741824).toFixed(1)} GiB`;
}

export function createSetupSession(
  host: HTMLElement,
  _store: Store<AppState>,
  opts: {
    onToast: (code: string, message: string) => void;
    onNavigate: (panel: Panel) => void;
    onOpenProviders?: () => void;
  }
): SetupSessionHandles {
  const root = el('div', 'cockpit-setup');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Covert first-run setup');
  const card = el('div', 'cockpit-setup-card');
  const header = el('div', 'cockpit-setup-header');
  const counter = el('span', 'cockpit-setup-stage');
  const title = el('h2', 'cockpit-setup-title');
  const dismiss = el('button', 'cockpit-setup-dismiss', 'CLOSE') as HTMLButtonElement;
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Close setup and return to Covert');
  header.append(counter, title, dismiss);
  const resume = el('div', 'cockpit-setup-resume');
  const body = el('div', 'cockpit-setup-body');
  const controls = el('div', 'cockpit-setup-controls');
  const back = el('button', 'cockpit-setup-btn', 'BACK') as HTMLButtonElement;
  const skipStep = el('button', 'cockpit-setup-btn', 'SKIP THIS STEP') as HTMLButtonElement;
  const defer = el('button', 'cockpit-setup-btn', 'SKIP FOR NOW') as HTMLButtonElement;
  const next = el('button', 'cockpit-setup-btn cockpit-setup-primary', 'CONTINUE') as HTMLButtonElement;
  for (const button of [back, skipStep, defer, next]) button.type = 'button';
  controls.append(back, skipStep, defer, next);
  card.append(header, resume, body, controls);
  root.appendChild(card);
  host.appendChild(root);

  let state: OnboardingStateT | null = null;
  let stage = 0;
  let open = false;
  let busy = false;
  let workflowProfile: WorkflowProfile = 'local';
  let routing: ByokStatusResponseT['routing'] = { plan: 'local', act: 'local', utility: 'local' };
  let providerStatus: ByokStatusResponseT = { providers: [], routing, consent_enabled: false };
  let connections: ConnectionsViewResponseT | null = null;
  let hardware: HardwareProfileResponseT | null = null;
  let models: ModelManagerSnapshotResponseT | null = null;
  let runtimeModels: ModelStatusResponseT | null = null;
  let workspace: HealthResponseT | null = null;
  let routes: RoutesResponseT | null = null;
  const testedProviders = new Set<string>();
  const testResults = new Map<string, string>();

  function setBusy(value: boolean): void {
    busy = value;
    next.disabled = value;
    back.disabled = value || stage === 0;
    skipStep.disabled = value || stage === STEPS.length - 1;
    defer.disabled = value;
    dismiss.disabled = value;
  }

  function addParagraph(text: string, className = 'cockpit-setup-detail'): void {
    body.appendChild(el('p', className, text));
  }

  function addKeyValue(label: string, value: string): HTMLElement {
    const row = el('div', 'cockpit-setup-kv');
    row.append(el('span', 'cockpit-setup-k', label), el('span', 'cockpit-setup-v', value));
    body.appendChild(row);
    return row;
  }

  function button(label: string, action: () => void, className = 'cockpit-setup-btn'): HTMLButtonElement {
    const control = el('button', className, label) as HTMLButtonElement;
    control.type = 'button';
    control.addEventListener('click', action);
    return control;
  }

  function currentRoleValue(role: Role): string {
    const target = routing[role];
    return target === 'local' ? 'local' : target.provider_id;
  }

  function routeSelect(role: Role, label: string): HTMLSelectElement {
    const field = el('label', 'cockpit-setup-field');
    field.appendChild(el('span', 'cockpit-setup-label', label));
    const select = el('select', 'cockpit-setup-input') as HTMLSelectElement;
    select.dataset.role = role;
    const local = el('option', '', 'Local model route') as HTMLOptionElement;
    local.value = 'local';
    select.appendChild(local);
    for (const provider of providerStatus.providers) {
      if (!provider.key_stored) continue;
      const option = el('option', '', `${provider.name} · ${provider.model_id}${testedProviders.has(provider.id) ? '' : ' · TEST REQUIRED'}`) as HTMLOptionElement;
      option.value = provider.id;
      option.disabled = !testedProviders.has(provider.id);
      select.appendChild(option);
    }
    select.value = currentRoleValue(role);
    select.disabled = workflowProfile === 'local';
    field.appendChild(select);
    body.appendChild(field);
    return select;
  }

  function renderProviderConnections(): void {
    const group = el('div', 'cockpit-setup-plan');
    if (connections === null) {
      group.appendChild(el('p', 'cockpit-setup-note', 'Connection status is unavailable. The workbench can still open; review Providers in Settings when the connection service is reachable.'));
    } else if (connections.connections.length === 0) {
      group.appendChild(el('p', 'cockpit-setup-note', 'No provider or local-runtime connection is configured yet. You can continue with the workbench and configure this later.'));
    } else {
      for (const connection of connections.connections) {
        const row = el('div', 'cockpit-setup-kv');
        row.append(
          el('span', 'cockpit-setup-k', connection.name),
          el('span', 'cockpit-setup-v', `${statusLine(connection.status)} · ${connection.detail}`)
        );
        group.appendChild(row);
      }
    }
    body.appendChild(group);
    addParagraph('A stored API key is configured, not proof of a live connection. Covert never reads passwords or copies credentials from Codex, Claude, or another client. Only connection methods that are actually available are shown in Settings.', 'cockpit-setup-note');
    body.appendChild(button('OPEN SETTINGS → INTELLIGENCE → PROVIDERS', () => {
      close();
      if (opts.onOpenProviders !== undefined) opts.onOpenProviders();
      else opts.onNavigate('settings');
    }));
    body.appendChild(button('TEST CONFIGURED API CONNECTIONS', () => { void testConnections(); }));
    if (providerStatus.providers.length > 0 && !providerStatus.consent_enabled) {
      addParagraph('Provider egress consent is off. Enable it in Providers before running a live connection test.', 'cockpit-setup-note');
    }
    for (const [id, result] of testResults) addKeyValue(`TEST · ${id}`, result);
  }

  function renderWorkflow(): void {
    addParagraph('Choose which existing route Covert uses for its Planner, Implementer, and Utility calls. This edits the canonical BYOK role routing. It never creates automatic fallback across providers or billing sources.');
    const localChoice = el('label', 'cockpit-setup-check');
    const localRadio = el('input') as HTMLInputElement;
    localRadio.type = 'radio';
    localRadio.name = 'covert-workflow-profile';
    localRadio.value = 'local';
    localRadio.checked = workflowProfile === 'local';
    localRadio.addEventListener('change', () => { workflowProfile = 'local'; render(); });
    localChoice.append(localRadio, el('span', '', 'LOCAL WORKFLOW — keep all three roles on local routing'));
    body.appendChild(localChoice);

    const customChoice = el('label', 'cockpit-setup-check');
    const customRadio = el('input') as HTMLInputElement;
    customRadio.type = 'radio';
    customRadio.name = 'covert-workflow-profile';
    customRadio.value = 'custom';
    customRadio.checked = workflowProfile === 'custom';
    customRadio.addEventListener('change', () => { workflowProfile = 'custom'; render(); });
    customChoice.append(customRadio, el('span', '', 'CUSTOM — select a verified route for each role'));
    body.appendChild(customChoice);

    if (workflowProfile === 'custom') {
      const selects = new Map<Role, HTMLSelectElement>();
      for (const role of ROUTES) selects.set(role.id, routeSelect(role.id, role.label));
      body.appendChild(button('APPLY WORKFLOW ROUTING', () => { void applyWorkflow(selects); }));
      addParagraph('API routes appear only after the provider has stored a key, egress consent is enabled, and Test Connections passes in this setup session. Subscription CLI clients are not offered as model routes until an official execution adapter is verified.', 'cockpit-setup-note');
    } else {
      body.appendChild(button('APPLY LOCAL WORKFLOW', () => { void applyWorkflow(new Map()); }));
    }
    addParagraph('Local model routing does not claim that a model is installed or qualified. Check Model Manager for the current installation and qualification state.', 'cockpit-setup-note');
    body.appendChild(button('OPEN MODEL MANAGER', () => { close(); opts.onNavigate('models'); }));
  }

  function render(): void {
    if (!open) return;
    const step = STEPS[stage]!;
    counter.textContent = `SETUP ${stage + 1} OF ${STEPS.length}`;
    title.textContent = step.title;
    body.replaceChildren();
    resume.replaceChildren();
    back.disabled = busy || stage === 0;
    skipStep.hidden = stage === STEPS.length - 1;
    next.textContent = stage === 0 ? 'SET UP COVERT' : stage === STEPS.length - 1 ? 'FINISH & OPEN COVERT' : 'CONTINUE';

    if (state !== null && (state.walkthrough_complete || stepIndex(state.current_step) > 0)) {
      const message = state.walkthrough_complete
        ? 'You are reviewing setup again. Existing connections, model state, routing, workspace, and permissions are preserved.'
        : `Saved progress is at “${STEPS[stepIndex(state.current_step)]!.title}”. Continue from that step or restart the wizard steps. Existing application settings are preserved.`;
      resume.appendChild(el('p', 'cockpit-setup-note', message));
      if (!state.walkthrough_complete) {
        resume.appendChild(button('CONTINUE SETUP', () => { resume.replaceChildren(); }, 'cockpit-setup-btn'));
        resume.appendChild(button('START OVER', () => { void restartProgress(); }, 'cockpit-setup-btn'));
      }
    }

    if (step.id === 'welcome') {
      addParagraph('Covert is your engineering control plane. Use local models, provider connections you already have, or a deliberate combination of both.');
      addParagraph('This setup reads the current workstation and saves choices through the same Model Manager, provider, routing, workspace, and permission services used after setup.');
      addParagraph('Local models run on this computer. Provider account and API billing are different connection types; Covert will show the method it can verify.');
      body.appendChild(button('ADVANCED SETUP', () => {
        close();
        if (opts.onOpenProviders !== undefined) opts.onOpenProviders();
        else opts.onNavigate('settings');
      }));
    } else if (step.id === 'local_intelligence') {
      if (hardware === null) addKeyValue('HARDWARE PROFILE', 'UNKNOWN · hardware probe unavailable');
      else {
        addKeyValue('CPU', `${hardware.logicalCpus} logical processors`);
        addKeyValue('RAM', `${bytesGiB(hardware.totalRamBytes)} total · ${bytesGiB(hardware.freeRamBytes)} available`);
        addKeyValue('GPU BACKEND', hardware.backend.toUpperCase());
        addKeyValue('VRAM', hardware.vramSource === 'none' || hardware.vramBytes === 0
          ? 'UNKNOWN · dedicated VRAM telemetry unavailable'
          : `${bytesGiB(hardware.vramBytes - Math.min(hardware.vramBytes, hardware.freeVramBytes))} used · ${bytesGiB(hardware.freeVramBytes)} available · ${bytesGiB(hardware.vramBytes)} total`);
        addKeyValue('AVAILABLE STORAGE', 'UNKNOWN · current hardware profile does not report disk capacity');
      }
      if (models !== null) {
        addKeyValue('LOCAL RUNTIME', `${models.runtime.canonical_name} · ${models.runtime.registered ? models.runtime.health : 'NOT CONFIGURED'}`);
        addKeyValue('QUALIFIED MODELS', String(models.models.filter(model => model.qualification.state === 'QUALIFIED').length));
        addKeyValue('LOCAL MODEL PACKS', models.model_packs.catalog_status === 'AVAILABLE'
          ? `${models.model_packs.items.length} listed · ${models.model_packs.items.filter(item => item.qualification_state === 'QUALIFIED').length} qualified`
          : 'UNKNOWN · Model Manager pack catalog unavailable');
      } else if (runtimeModels !== null) {
        addKeyValue('LOCAL RUNTIME', runtimeModels.runtime ? 'AVAILABLE' : 'NOT CONFIGURED');
        addKeyValue('MODEL RECORDS', String(runtimeModels.models.length));
      } else addKeyValue('LOCAL RUNTIME', 'UNKNOWN · Model Manager is unavailable');
      addParagraph('Covert can run local models without a provider account. Hardware fit, installation, qualification, and active runtime are separate states.');
      body.appendChild(button('OPEN MODEL MANAGER', () => { close(); opts.onNavigate('models'); }));
    } else if (step.id === 'providers') {
      addParagraph('Connect only through a method that Covert currently supports. A subscription login remains owned by its official client. An API key is stored by Covert in the encrypted credential store and may use separate usage billing.');
      renderProviderConnections();
    } else if (step.id === 'workflow') {
      renderWorkflow();
    } else if (step.id === 'security') {
      addParagraph('Files, terminal, Git, desktop control, network access, and provider calls are separate capabilities. Covert asks for approval where the current Authority policy requires it.');
      addParagraph('Selecting a project folder does not make its code trusted. Review workspace trust and execution permissions in their owning Security and Workspace surfaces before running project code.');
      addParagraph('This build does not expose a first-run permission profile. No permission is granted by continuing; current per-action Authority checks remain in force.', 'cockpit-setup-note');
      addParagraph('The system-wide Local-Only release gate is still open. This wizard does not claim that every network path is blocked by a local routing choice.', 'cockpit-setup-note');
      body.appendChild(button('OPEN SECURITY', () => { close(); opts.onNavigate('security'); }));
    } else if (step.id === 'workspace') {
      addKeyValue('CURRENT WORKSPACE', workspace?.workspace ?? 'UNKNOWN · workspace service unavailable');
      addParagraph('Open an existing project from Projects, or continue without a project. Choosing a folder does not automatically grant trust or execution permission.');
      body.appendChild(button('OPEN PROJECTS', () => { close(); opts.onNavigate('projects'); }));
    } else if (step.id === 'verify') {
      addKeyValue('WORKSPACE', workspace?.workspace ?? 'UNKNOWN');
      addKeyValue('LOCAL MODEL RECORDS', models !== null ? `${models.models.length} catalog entries` : runtimeModels !== null ? `${runtimeModels.models.length} runtime records` : 'UNKNOWN');
      addKeyValue('QUALIFIED LOCAL MODELS', models === null ? 'UNKNOWN' : String(models.models.filter(model => model.qualification.state === 'QUALIFIED').length));
      const liveConnections = connections?.connections.filter(connection => connection.status === 'connected') ?? [];
      addKeyValue('RECENTLY VERIFIED CONNECTIONS', connections === null ? 'UNKNOWN' : liveConnections.length === 0 ? 'NONE' : liveConnections.map(connection => connection.name).join(', '));
      addKeyValue('ROLE ROUTING', ROUTES.map(role => {
        const target = routing[role.id];
        const provider = target === 'local' ? undefined : providerStatus.providers.find(candidate => candidate.id === target.provider_id);
        return `${role.label}: ${target === 'local' ? 'Local' : provider?.name ?? 'Unknown provider'}`;
      }).join(' · '));
      addParagraph('Use Test Connections on the Providers step for an explicit, small live health check. No provider is contacted automatically by this summary.');
    } else {
      const readyLocal = routes?.routes.some(route => route.providerType === 'local' && route.status === 'ready') === true;
      const readyProvider = routes?.routes.some(route => route.providerType === 'cloud' && route.status === 'ready') === true;
      const hasReadyRoute = readyLocal || readyProvider;
      addParagraph('Your current settings remain available in the workbench. The summary reflects saved state; it does not mark uninstalled or unqualified models ready.');
      addParagraph(readyLocal
        ? 'A local model route is ready. Open Resident for a first interaction.'
        : readyProvider
          ? 'A connected provider route is ready. Open Resident for a first interaction; its billing follows the provider connection shown in Settings.'
          : 'No model or provider route is currently verified. Covert still opens; review Models or Providers when ready.');
      body.appendChild(button(hasReadyRoute ? 'OPEN RESIDENT' : 'OPEN PROJECTS', () => { close(); opts.onNavigate(hasReadyRoute ? 'resident' : 'projects'); }));
      body.appendChild(button('OPEN MODEL MANAGER', () => { close(); opts.onNavigate('models'); }));
    }
  }

  async function refreshSnapshot(): Promise<void> {
    const [connectionResult, byokResult, hardwareResult, modelResult, runtimeResult, workspaceResult, routesResult] = await Promise.allSettled([
      api.connections(), api.byokStatus(), api.hardwareProfile(), api.modelsManager(), api.modelsStatus(), api.health(), api.routes()
    ]);
    connections = connectionResult.status === 'fulfilled' ? connectionResult.value : null;
    if (byokResult.status === 'fulfilled') {
      providerStatus = byokResult.value;
      routing = byokResult.value.routing;
      workflowProfile = Object.values(routing).some(target => target !== 'local') ? 'custom' : 'local';
    }
    hardware = hardwareResult.status === 'fulfilled' ? hardwareResult.value : null;
    models = modelResult.status === 'fulfilled' ? modelResult.value : null;
    runtimeModels = runtimeResult.status === 'fulfilled' ? runtimeResult.value : null;
    workspace = workspaceResult.status === 'fulfilled' ? workspaceResult.value : null;
    routes = routesResult.status === 'fulfilled' ? routesResult.value : null;
  }

  async function testConnections(): Promise<void> {
    if (busy) return;
    setBusy(true);
    testResults.clear();
    try {
      const [status, connectionView] = await Promise.all([api.byokStatus(), api.connections()]);
      providerStatus = status;
      connections = connectionView;
      let tested = 0;
      if (!status.consent_enabled) {
        testResults.set('provider egress', 'NOT RUN · enable provider egress consent in Settings first');
      } else {
        for (const provider of status.providers.filter(entry => entry.key_stored)) {
          tested++;
          try {
            const result = await api.byokTest(provider.id);
            testResults.set(provider.name, result.ok ? `PASS · ${result.detail}` : `FAIL · ${result.detail}`);
            if (result.ok) testedProviders.add(provider.id);
            else testedProviders.delete(provider.id);
          } catch {
            testedProviders.delete(provider.id);
            testResults.set(provider.name, 'FAIL · provider test did not complete; inspect Provider settings');
          }
        }
        for (const connection of connectionView.connections.filter(entry => entry.kind === 'api-key' && entry.id.startsWith('builtin:') && entry.status !== 'not_configured')) {
          tested++;
          try {
            const result = await api.connectionsTest(connection.id);
            testResults.set(connection.name, result.ok ? `PASS · ${result.detail}` : `FAIL · ${result.detail}`);
          } catch {
            testResults.set(connection.name, 'FAIL · provider test did not complete; inspect Provider settings');
          }
        }
        if (tested === 0) testResults.set('provider connections', 'NOT RUN · no configured API key is available to test');
      }
      try { connections = await api.connections(); } catch { /* Keep the last read-only snapshot. */ }
    } catch {
      testResults.set('provider connections', 'FAIL · connection state is unavailable');
    } finally {
      setBusy(false);
      render();
    }
  }

  async function applyWorkflow(selects: Map<Role, HTMLSelectElement>): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const nextRouting: ByokStatusResponseT['routing'] = { plan: 'local', act: 'local', utility: 'local' };
      if (workflowProfile === 'custom') {
        for (const role of ROUTES) {
          const providerId = selects.get(role.id)?.value ?? 'local';
          if (providerId === 'local') continue;
          if (!testedProviders.has(providerId) || !providerStatus.consent_enabled) {
            opts.onToast('NOT_READY', 'Test the provider in this setup session and enable provider egress consent before routing a role to it.');
            return;
          }
          const provider = providerStatus.providers.find(entry => entry.id === providerId && entry.key_stored);
          if (provider === undefined) {
            opts.onToast('NOT_READY', 'The selected provider is no longer configured. Refresh Provider settings.');
            return;
          }
          nextRouting[role.id] = { provider_id: provider.id, model_id: provider.model_id };
        }
      }
      await api.byokSetRouting(nextRouting);
      routing = nextRouting;
      opts.onToast('OK', 'Workflow routing saved through the existing role-routing service.');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL';
      opts.onToast(code, 'Workflow routing was not saved. Resolve the approval or configuration issue and try again.');
    } finally {
      setBusy(false);
      render();
    }
  }

  async function restartProgress(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      state = await api.onboardingRestart();
      stage = 0;
      opts.onToast('OK', 'Setup steps restarted. Existing application settings were preserved.');
      render();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL';
      opts.onToast(code, 'Setup progress was not restarted. Existing settings were not changed.');
    } finally {
      setBusy(false);
    }
  }

  async function deferSetup(): Promise<void> {
    if (busy || state === null) return;
    setBusy(true);
    try {
      state = await api.onboardingDefer();
      close();
      opts.onToast('OK', 'Setup was deferred. You can resume it from Settings → Setup & Onboarding.');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL';
      opts.onToast(code, 'Setup could not be deferred. Your saved progress remains available.');
    } finally {
      setBusy(false);
    }
  }

  async function show(restartCompleted: boolean): Promise<void> {
    if (busy) return;
    setBusy(true);
    open = true;
    root.hidden = false;
    body.replaceChildren(el('p', 'cockpit-setup-detail', 'Loading saved setup and current Covert state…'));
    try {
      state = await api.onboardingState();
      if (state.walkthrough_complete) {
        if (!restartCompleted) { close(); return; }
        state = await api.onboardingRestart();
      } else if (state.deferred) {
        if (!restartCompleted) { close(); return; }
        state = await api.onboardingResume();
      }
      stage = stepIndex(state.current_step);
      await refreshSnapshot();
      render();
    } catch (error) {
      body.replaceChildren(el('p', 'cockpit-setup-note', 'Setup state is unavailable. Covert remains open; try again from Settings when the onboarding service is available.'));
      opts.onToast(error instanceof ApiError ? error.code : 'NOT_READY', 'The setup wizard could not read its saved progress.');
    } finally {
      setBusy(false);
    }
  }

  async function advance(skip: boolean): Promise<void> {
    if (busy || state === null) return;
    const persistedIndex = stepIndex(state.current_step);
    if (stage < persistedIndex) {
      stage = Math.min(stage + 1, STEPS.length - 1);
      render();
      return;
    }
    if (stage === STEPS.length - 1) {
      setBusy(true);
      try {
        await api.onboardingComplete();
        state = { ...state, walkthrough_complete: true };
        close();
        opts.onToast('OK', 'Setup progress saved. Covert is opening with the currently verified configuration.');
        opts.onNavigate('command-center');
      } catch (error) {
        const code = error instanceof ApiError ? error.code : 'INTERNAL';
        opts.onToast(code, 'Setup could not be marked complete. Your saved settings remain unchanged.');
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const result = skip ? await api.onboardingSkip() : await api.onboardingNext({});
      state = result.state;
      stage = stepIndex(result.advanced_to);
      if (stage === 0 && !skip) stage = Math.min(persistedIndex + 1, STEPS.length - 1);
      await refreshSnapshot();
      render();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'INTERNAL';
      opts.onToast(code, 'Setup progress was not saved. Resolve the approval or connection issue, then retry.');
    } finally {
      setBusy(false);
    }
  }

  back.addEventListener('click', () => {
    if (!busy && stage > 0) { stage--; render(); }
  });
  skipStep.addEventListener('click', () => { void advance(true); });
  next.addEventListener('click', () => { void advance(false); });
  defer.addEventListener('click', () => { void deferSetup(); });
  dismiss.addEventListener('click', close);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !busy) close();
  });

  // First-run configuration is resumable and does not block the workbench if
  // the onboarding service is unavailable.
  void show(false);

  function close(): void {
    open = false;
    root.hidden = true;
  }

  return {
    open(): void { void show(true); },
    close,
    isOpen(): boolean { return open; }
  };
}
