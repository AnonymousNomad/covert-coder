// Direct operator surface for the same governed local worker route exposed
// to authorized machine callers. All state and decisions remain in canonical
// Project, Model Access, AgentLoop, Authority, Resource Admission, and journal
// owners; this module owns presentation only.
import { api, call, ApiError } from '../services/api.ts';
import {
  AgentCancelRequest,
  AgentCancelResponse,
  AgentStartRequest,
  AgentStartResponse,
  AgentStatusQuery,
  AgentStatusResponse,
  type AgentStatusResponseT
} from '../../../common/contracts/agent.ts';
import { AppCatalogResponse } from '../../../common/contracts/platform-app.ts';
import { RoutesResponse } from '../../../common/contracts/routing.ts';
import type { RouteEntryT } from '../../../common/contracts/routing.ts';
import { CurrentProjectResponse, type CurrentProjectResponseT } from '../../../common/contracts/project.ts';
import { GitStatusResponse } from '../../../common/contracts/git.ts';
import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';
import { AttemptDetail } from '../../../common/contracts/attempt.ts';
import type { AttemptDetailT } from '../../../common/contracts/attempt.ts';
import {
  WorkerHandoffCreateRequest,
  WorkerHandoffCreateResponse,
  type WorkerDescriptorT,
  type WorkerHandoffEnvelopeT
} from '../../../common/contracts/worker-handoff.ts';
import type { ContextApertureT } from '../../../common/contracts/context-aperture.ts';

const CAPABILITY_ID = 'project.worker.execute.local';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function field(labelText: string, control: HTMLElement): HTMLLabelElement {
  const label = el('label', 'worker-execution-field');
  label.append(el('span', 'worker-execution-label', labelText), control);
  return label;
}

function terminal(status: AgentStatusResponseT | null): boolean {
  return status !== null && ['done', 'error', 'aborted'].includes(status.state);
}

function workerDescriptor(route: RouteEntryT): WorkerDescriptorT {
  const model = route.id.startsWith('local:') ? route.id.slice('local:'.length) : route.id;
  return { worker: route.id, provider: 'local', model, role: 'planner' };
}

function localQualification(route: RouteEntryT, manager: ModelManagerResponseT | null): { qualified: boolean; reason: string } {
  if (route.providerType !== 'local' || !route.id.startsWith('local:')) return { qualified: false, reason: 'route is not local' };
  if (manager === null) return { qualified: false, reason: 'Model Manager state is unavailable' };
  const modelId = route.id.slice('local:'.length);
  const model = manager.models.find(item => item.identity.canonical_id === modelId);
  if (!model) return { qualified: false, reason: 'exact model is absent from Model Manager' };
  const basis = model.identity.qualification.basis;
  if (model.readiness !== 'READY' || model.identity.qualification.state !== 'QUALIFIED' || basis === null ||
      basis.artifact_sha256 === null || basis.runtime_id === null || basis.runtime_version === null) {
    return { qualified: false, reason: `qualification is ${model.identity.qualification.state}/${model.readiness}` };
  }
  const artifact = manager.artifacts.some(item => model.artifact_ids.includes(item.id) &&
    item.hash_status === 'VERIFIED' && item.observed_sha256 === basis.artifact_sha256);
  if (!artifact) return { qualified: false, reason: 'qualified artifact digest is not verified' };
  const adapter = manager.execution_adapters.some(item => item.kind === 'LOCAL_RUNTIME' &&
    item.implementation === 'IMPLEMENTED' && item.configured && item.available);
  if (!adapter) return { qualified: false, reason: 'no implemented, configured local runtime adapter is available' };
  if (manager.runtime.health !== 'HEALTHY' || manager.runtime.selected_model_id !== modelId) {
    return { qualified: false, reason: 'the exact qualified model is not the healthy loaded runtime model' };
  }
  return { qualified: true, reason: 'qualified artifact, adapter, and loaded runtime match' };
}

interface ExecutionChain {
  taskId: string;
  objective: string;
  acceptance: string[];
  includedFiles: string[];
  worker: WorkerDescriptorT;
  sessionId: string;
  attemptId: string | null;
  aperture: ContextApertureT | null;
  handoff: WorkerHandoffEnvelopeT | null;
  nextWorker: WorkerDescriptorT | null;
  successorStarted: boolean;
}

export function createWorkerExecutionPanel(parent: HTMLElement): { dispose(): void } {
  const root = el('section', 'worker-execution-panel');
  root.append(el('h3', 'cockpit-projects-section-title', 'GOVERNED LOCAL WORKER'));
  root.append(el('p', 'worker-execution-intro', 'Run one bounded local worker task from Projects. Cipher is not required. Discovery, route qualification, one-time Authority approval, Resource Admission, and evidence remain separate gates. No cloud fallback is available here.'));

  const snapshot = el('div', 'worker-execution-snapshot', 'Reading canonical project, route, capability, and source state…');
  root.appendChild(snapshot);

  const routeSelect = el('select', 'worker-execution-select');
  routeSelect.setAttribute('aria-label', 'Qualified local worker route');
  const taskInput = el('textarea', 'worker-execution-textarea');
  taskInput.maxLength = 8000;
  taskInput.rows = 3;
  taskInput.placeholder = 'Describe one bounded worker task';
  taskInput.setAttribute('aria-label', 'Worker task objective');
  const acceptanceInput = el('textarea', 'worker-execution-textarea');
  acceptanceInput.rows = 2;
  acceptanceInput.value = 'Report only observations supported by the supplied aperture and evidence.';
  acceptanceInput.setAttribute('aria-label', 'Acceptance criteria, one per line');
  const filesInput = el('textarea', 'worker-execution-textarea');
  filesInput.rows = 2;
  filesInput.placeholder = 'Optional checkout-relative file references, one per line';
  filesInput.setAttribute('aria-label', 'Included checkout-relative file references');
  const form = el('div', 'worker-execution-form');
  form.append(field('LOCAL ROUTE', routeSelect), field('OBJECTIVE', taskInput),
    field('ACCEPTANCE CRITERIA', acceptanceInput), field('OPTIONAL FILE REFERENCES', filesInput));

  const actionRow = el('div', 'worker-execution-actions');
  const refreshButton = el('button', 'cockpit-projects-refresh', 'REFRESH STATE');
  refreshButton.type = 'button';
  const startButton = el('button', 'worker-execution-primary', 'PREVIEW AND START');
  startButton.type = 'button';
  actionRow.append(refreshButton, startButton);
  root.append(form, actionRow);

  const statusView = el('div', 'worker-execution-status', 'No worker session started.');
  root.appendChild(statusView);
  const handoffControls = el('div', 'worker-execution-handoff');
  const nextRouteSelect = el('select', 'worker-execution-select');
  nextRouteSelect.setAttribute('aria-label', 'Receiving local worker route');
  const handoffButton = el('button', 'worker-execution-primary', 'CREATE HANDOFF');
  handoffButton.type = 'button';
  const receiveButton = el('button', 'worker-execution-primary', 'START RECEIVING WORKER');
  receiveButton.type = 'button';
  handoffControls.append(field('NEXT WORKER ROUTE', nextRouteSelect), handoffButton, receiveButton);
  root.appendChild(handoffControls);
  parent.appendChild(root);

  let alive = true;
  let timer: number | null = null;
  let busy = false;
  let project: CurrentProjectResponseT | null = null;
  let git: ReturnType<typeof GitStatusResponse.parse> | null = null;
  let routes: RouteEntryT[] = [];
  let manager: ModelManagerResponseT | null = null;
  let capabilityState = 'UNKNOWN';
  let chain: ExecutionChain | null = null;
  let status: AgentStatusResponseT | null = null;
  let attempt: AttemptDetailT | null = null;
  let lastError: string | null = null;

  function targetOptions(select: HTMLSelectElement, selectedId?: string): void {
    const local = routes.filter(route => route.providerType === 'local' && route.id.startsWith('local:'));
    select.replaceChildren();
    if (local.length === 0) {
      const option = el('option'); option.value = ''; option.textContent = 'No local routes discovered'; select.appendChild(option);
      return;
    }
    for (const route of local) {
      const qualification = localQualification(route, manager);
      const option = el('option');
      option.value = route.id;
      option.textContent = `${route.displayName} · ${qualification.qualified ? 'QUALIFIED' : `UNAVAILABLE: ${qualification.reason}`}`;
      option.disabled = !qualification.qualified;
      select.appendChild(option);
    }
    if (selectedId && local.some(route => route.id === selectedId && localQualification(route, manager).qualified)) select.value = selectedId;
  }

  function selectedRoute(select: HTMLSelectElement): RouteEntryT | null {
    return routes.find(route => route.id === select.value && localQualification(route, manager).qualified) ?? null;
  }

  function paint(): void {
    const address = project === null ? null : { project_id: project.project.project_id, checkout_id: project.checkout.checkout_id };
    const source = git === null ? 'UNKNOWN' : git.git_repo && git.oid
      ? `${git.oid} · ${git.changes.length === 0 ? 'CLEAN' : `DIRTY (${git.changes.length} changes)`}`
      : 'UNKNOWN · a Git revision is required';
    snapshot.textContent = [
      `CAPABILITY ${CAPABILITY_ID} · ${capabilityState} (discovery only; grants and Authority are checked at invocation)`,
      address === null ? 'PROJECT/CHECKOUT · UNKNOWN' : `PROJECT ${address.project_id} · CHECKOUT ${address.checkout_id}`,
      `SOURCE ${source}`,
      manager === null ? 'LOCAL MODEL QUALIFICATION · UNKNOWN' : `LOCAL RUNTIME · ${manager.runtime.health} · selected ${manager.runtime.selected_model_id ?? 'none'}`
    ].join('\n');

    const hasQualifiedRoute = selectedRoute(routeSelect) !== null;
    const criteria = acceptanceInput.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    const files = filesInput.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    startButton.disabled = busy || chain !== null && !terminal(status) || capabilityState !== 'ADDRESSABLE' ||
      project === null || git === null || !git.git_repo || !git.oid || !hasQualifiedRoute ||
      taskInput.value.trim().length === 0 || criteria.length === 0 || criteria.length > 8 || files.length > 32;
    refreshButton.disabled = busy;

    statusView.replaceChildren();
    if (lastError !== null) statusView.appendChild(el('div', 'worker-execution-error', lastError));
    if (chain === null) {
      statusView.appendChild(el('div', 'worker-execution-line', 'No worker session started.'));
    }
    if (chain !== null) {
      statusView.appendChild(el('div', 'worker-execution-line', `WORKER SESSION ${chain.sessionId} · TASK ${chain.taskId}`));
      statusView.appendChild(el('div', 'worker-execution-line', `ROUTE ${chain.worker.worker} · ${chain.worker.model} · local`));
      if (status !== null) statusView.appendChild(el('div', 'worker-execution-line', `LIFECYCLE ${status.worker_lifecycle ?? status.state.toUpperCase()} · AGENT ${status.state.toUpperCase()}`));
      if (status?.error) statusView.appendChild(el('div', 'worker-execution-error', status.error));
      if (attempt !== null) {
        statusView.appendChild(el('div', 'worker-execution-line', `ATTEMPT ${attempt.envelope.attempt_id} · ${attempt.state} · ${attempt.retry_safety}`));
        statusView.appendChild(el('div', 'worker-execution-line', `RESOURCE ${attempt.envelope.resource_admission.decision} · ${attempt.envelope.resource_admission.reason}`));
        statusView.appendChild(el('div', 'worker-execution-line', `VERIFICATION ${status?.verification?.state?.toUpperCase() ?? 'UNKNOWN'} · a completed response is not proof of correctness`));
        const eventList = el('ul', 'worker-execution-events');
        for (const event of attempt.events.slice(-12)) eventList.appendChild(el('li', '', `${event.seq} · ${event.event}`));
        statusView.appendChild(eventList);
      }
      const aperture = chain.aperture ?? attempt?.envelope.context_aperture ?? null;
      if (aperture !== null) {
        const disclosure = el('details', 'worker-execution-aperture');
        disclosure.open = true;
        disclosure.append(el('summary', '', `CONTEXT APERTURE ${aperture.aperture_id} · SHA-256 ${aperture.sha256}`));
        disclosure.appendChild(el('pre', '', aperture.content));
        statusView.appendChild(disclosure);
      }
      if (chain.handoff !== null) statusView.appendChild(el('div', 'worker-execution-line', `HANDOFF ${chain.handoff.handoff_id} · ${chain.handoff.state} · next worker ${chain.handoff.to.worker}`));
      if (chain.handoff !== null && !chain.successorStarted) receiveButton.disabled = busy || selectedRoute(nextRouteSelect) === null;
      else receiveButton.disabled = true;
      handoffButton.disabled = busy || !terminal(status) || chain.successorStarted || chain.handoff !== null || attempt === null || selectedRoute(nextRouteSelect) === null;
      if (!terminal(status)) {
        const stop = el('button', 'worker-execution-stop', 'STOP OWNED SESSION');
        stop.type = 'button';
        stop.disabled = busy;
        stop.addEventListener('click', () => { void stopCurrent(); });
        statusView.appendChild(stop);
      }
    }
    if (chain === null && attempt !== null) {
      statusView.appendChild(el('div', 'worker-execution-line', `ATTEMPT ${attempt.envelope.attempt_id} · ${attempt.state} · ${attempt.retry_safety}`));
      statusView.appendChild(el('div', 'worker-execution-line', `RESOURCE ${attempt.envelope.resource_admission.decision} · ${attempt.envelope.resource_admission.reason}`));
      const aperture = attempt.envelope.context_aperture;
      if (aperture !== undefined) {
        const disclosure = el('details', 'worker-execution-aperture');
        disclosure.open = true;
        disclosure.append(el('summary', '', `CONTEXT APERTURE ${aperture.aperture_id} · SHA-256 ${aperture.sha256}`));
        disclosure.appendChild(el('pre', '', aperture.content));
        statusView.appendChild(disclosure);
      }
    }
    receiveButton.hidden = chain === null || chain.handoff === null || chain.successorStarted;
    handoffButton.hidden = chain === null || !terminal(status) || chain.successorStarted || chain.handoff !== null;
    handoffControls.hidden = chain === null || !terminal(status) || chain.successorStarted;
  }

  async function refresh(): Promise<void> {
    if (!alive || busy) return;
    const [projectResult, gitResult, routesResult, managerResult] = await Promise.allSettled([
      api.projectsCurrent(), api.gitStatus(), api.routes(), api.modelManager()
    ]);
    if (!alive) return;
    project = projectResult.status === 'fulfilled' ? CurrentProjectResponse.parse(projectResult.value) : null;
    git = gitResult.status === 'fulfilled' ? GitStatusResponse.parse(gitResult.value) : null;
    routes = routesResult.status === 'fulfilled' ? RoutesResponse.parse(routesResult.value).routes : [];
    manager = managerResult.status === 'fulfilled' ? managerResult.value : null;
    capabilityState = 'UNKNOWN';
    if (project !== null) {
      const address = { project_id: project.project.project_id, checkout_id: project.checkout.checkout_id };
      try {
        const catalog = await call('/api/apps/catalog', { query: address, schema: AppCatalogResponse });
        const capability = catalog.apps.flatMap(app => app.manifest.capabilities)
          .find(item => item.id === CAPABILITY_ID);
        const binding = catalog.apps.flatMap(app => app.capability_bindings).find(item => item.id === CAPABILITY_ID);
        capabilityState = capability !== undefined && binding?.state === 'ADDRESSABLE' ? 'ADDRESSABLE' : 'UNAVAILABLE';
      } catch { capabilityState = 'UNKNOWN'; }
    }
    targetOptions(routeSelect, routeSelect.value);
    targetOptions(nextRouteSelect, nextRouteSelect.value);
    paint();
  }

  async function loadAttempt(attemptId: string): Promise<void> {
    try {
      attempt = await call('/api/harness/attempt', { query: { id: attemptId }, schema: AttemptDetail });
    } catch (error) {
      attempt = null;
      lastError = `Attempt receipt unavailable · ${String((error as Error).message ?? error).slice(0, 180)}`;
    }
  }

  async function poll(): Promise<void> {
    if (!alive || chain === null) return;
    const sessionId = chain.sessionId;
    try {
      status = await call('/api/agent/status', { query: AgentStatusQuery.parse({ id: sessionId }), schema: AgentStatusResponse });
      if (status.session_id !== sessionId) throw new Error('agent status identity mismatch');
      if (status.attempt_id) {
        chain.attemptId = status.attempt_id;
        await loadAttempt(status.attempt_id);
      }
      lastError = null;
      paint();
    } catch (error) {
      lastError = `Status observation unavailable · ${String((error as Error).message ?? error).slice(0, 180)}`;
      paint();
    }
    if (!terminal(status) && alive) timer = window.setTimeout(() => { void poll(); }, 1200);
  }

  async function startWorker(route: RouteEntryT, taskId: string, handoff: WorkerHandoffEnvelopeT | null): Promise<void> {
    if (project === null || git === null || !git.oid) throw new Error('canonical project and Git source state are required');
    const workerSessionId = crypto.randomUUID();
    const effectiveTaskId = handoff === null ? workerSessionId : taskId;
    const criteria = (handoff === null ? acceptanceInput.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean) : chain?.acceptance ?? []).slice(0, 8);
    const files = (handoff === null ? filesInput.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean) : chain?.includedFiles ?? []).slice(0, 32);
    const objective = handoff === null ? taskInput.value.trim() : chain?.objective ?? taskInput.value.trim();
    const worker = workerDescriptor(route);
    const request = AgentStartRequest.parse({
      task: objective,
      client_request_id: crypto.randomUUID(),
      mode: 'plan',
      chat_source: 'local',
      role: 'planner',
      worker,
      ...(handoff === null ? {} : { handoff_id: handoff.handoff_id }),
      governed_execution: {
        capability_id: CAPABILITY_ID,
        worker_session_id: workerSessionId,
        task_id: effectiveTaskId,
        project: { project_id: project.project.project_id, checkout_id: project.checkout.checkout_id },
        aperture_id: crypto.randomUUID(),
        acceptance_criteria: criteria,
        ...(files.length === 0 ? {} : { included_files: files })
      }
    });
    // apiFetch presents the exact immutable Authority operation for operator
    // approval before invoking this route. The server constructs the aperture.
    const started = await call('/api/agent/start', { method: 'POST', body: request, schema: AgentStartResponse });
    if (started.session_id !== workerSessionId) throw new Error('server returned a different worker session identity');
    if (handoff === null) {
      chain = {
        taskId: effectiveTaskId, objective, acceptance: criteria, includedFiles: files, worker,
        sessionId: started.session_id, attemptId: started.attempt_id ?? null,
        aperture: started.context_aperture ?? null, handoff: null, nextWorker: null, successorStarted: false
      };
    } else if (chain !== null) {
      chain = { ...chain, worker, sessionId: started.session_id, attemptId: started.attempt_id ?? null,
        aperture: started.context_aperture ?? null, successorStarted: true };
    }
    status = null;
    attempt = null;
    lastError = started.context_aperture === undefined ? 'Server did not return the prepared Context Aperture.' : null;
    paint();
    void poll();
  }

  startButton.addEventListener('click', () => {
    const route = selectedRoute(routeSelect);
    if (route === null || busy) return;
    busy = true; lastError = null; paint();
    void startWorker(route, '', null).catch(async error => {
      lastError = `Worker start refused · ${String((error as Error).message ?? error).slice(0, 300)}`;
      if (error instanceof ApiError && typeof error.detail === 'object' && error.detail !== null) {
        const attemptId = (error.detail as { attempt_id?: unknown }).attempt_id;
        if (typeof attemptId === 'string') await loadAttempt(attemptId);
      }
    }).finally(() => { busy = false; paint(); });
  });

  async function stopCurrent(): Promise<void> {
    if (chain === null || busy) return;
    busy = true; lastError = null; paint();
    try {
      await call('/api/agent/cancel', {
        method: 'POST', body: AgentCancelRequest.parse({ session_id: chain.sessionId }), schema: AgentCancelResponse
      });
      // The acknowledgement is not evidence of stop. Continue observing the
      // exact session until the status route reports a terminal state.
      void poll();
    } catch (error) {
      lastError = `Stop request refused or unresolved · ${String((error as Error).message ?? error).slice(0, 220)}`;
    } finally { busy = false; paint(); }
  }

  handoffButton.addEventListener('click', () => {
    if (chain === null || status === null || !terminal(status) || attempt === null || busy) return;
    const target = selectedRoute(nextRouteSelect);
    if (target === null) return;
    const nextWorker = workerDescriptor(target);
    const request = WorkerHandoffCreateRequest.parse({
      task_id: chain.taskId,
      from: chain.worker,
      to: nextWorker,
      objective: chain.objective,
      next_action: 'Continue this task using the canonical handoff evidence and a fresh Context Aperture.'
    });
    busy = true; lastError = null; paint();
    void call('/api/worker-handoff/create', { method: 'POST', body: request, schema: WorkerHandoffCreateResponse })
      .then(result => {
        if (chain !== null) { chain.handoff = result.handoff; chain.nextWorker = nextWorker; }
      })
      .catch(error => { lastError = `Handoff creation refused · ${String((error as Error).message ?? error).slice(0, 240)}`; })
      .finally(() => { busy = false; paint(); });
  });

  receiveButton.addEventListener('click', () => {
    if (chain === null || chain.handoff === null || chain.successorStarted || busy) return;
    const target = selectedRoute(nextRouteSelect);
    if (target === null || chain.nextWorker?.worker !== target.id) {
      lastError = 'Select the exact destination route named by the approved handoff.'; paint(); return;
    }
    busy = true; lastError = null; paint();
    void startWorker(target, chain.taskId, chain.handoff).catch(error => {
      lastError = `Receiving worker start refused · ${String((error as Error).message ?? error).slice(0, 240)}`;
    }).finally(() => { busy = false; paint(); });
  });

  refreshButton.addEventListener('click', () => { void refresh(); });
  routeSelect.addEventListener('change', paint);
  nextRouteSelect.addEventListener('change', paint);
  taskInput.addEventListener('input', paint);
  acceptanceInput.addEventListener('input', paint);
  refreshButton.disabled = false;
  targetOptions(routeSelect);
  targetOptions(nextRouteSelect);
  paint();
  void refresh();

  return {
    dispose(): void {
      alive = false;
      if (timer !== null) window.clearTimeout(timer);
      parent.removeChild(root);
    }
  };
}
