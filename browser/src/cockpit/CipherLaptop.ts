import { z } from 'zod';
import { ApiError, api, call } from '../services/api.ts';
import { getSharedEvents } from '../services/ws.ts';
import { AgentCancelRequest, AgentCancelResponse, AgentDecisionRequest, AgentDecisionResponse, AgentPlanEvent, AgentStartRequest, AgentStartResponse, AgentStatusQuery, AgentStatusResponse, AgentStreamEvent, type AgentStatusResponseT, type AgentStreamEventT } from '../../../common/contracts/agent.ts';
import { ResidentBinding } from '../../../common/contracts/resident-binding.ts';
import { CurrentProjectResponse } from '../../../common/contracts/project.ts';
import { ModelAtlasModelsResponse, ModelAtlasRecordResponse, type ModelAtlasRecordResponseT } from '../../../common/contracts/model-atlas.ts';
import { MissionReceiptResponse, ProvenanceListResponse, type MissionReceiptResponseT, type ProvenanceListResponseT } from '../../../common/contracts/provenance.ts';
import { CipherNotebookListResponse, CipherNotebookPut, CipherNotebookRecord } from '../../../common/contracts/cipher-notebook.ts';
import { residentWorkerForBinding } from './resident-worker-selection.ts';
import { currentLocalDossierCandidates, type DossierWorkerCandidate } from './mission-composer-policy.ts';

const EmptyQuery = z.strictObject({});

interface LaptopOptions {
  onToast(code: string, message: string): void;
}

interface LaptopHandles {
  refresh(): Promise<void>;
  dispose(): void;
}

interface AgentSnapshot {
  binding: z.infer<typeof ResidentBinding> | null;
  manager: Awaited<ReturnType<typeof api.modelManager>> | null;
  routes: Awaited<ReturnType<typeof api.routes>> | null;
  atlas: z.infer<typeof ModelAtlasModelsResponse> | null;
  project: z.infer<typeof CurrentProjectResponse> | null;
  candidates: DossierWorkerCandidate[];
  errors: string[];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function failureText(error: unknown): string {
  if (error instanceof ApiError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message.slice(0, 240) : 'projection unavailable';
}

function terminal(state: AgentStatusResponseT['state']): boolean {
  return state === 'done' || state === 'error' || state === 'aborted';
}

export function createCipherLaptop(parent: HTMLElement, options: LaptopOptions): LaptopHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content cipher-laptop');
  const header = el('header', 'cipher-laptop-header');
  const titleBlock = el('div', 'cipher-laptop-title-block');
  titleBlock.append(el('p', 'cipher-laptop-kicker', 'COVERT RESIDENT · OPERATIONAL WORKSPACE'), el('h1', 'cipher-laptop-title', "CIPHER'S FIELD LAPTOP"));
  const refreshButton = el('button', 'cipher-laptop-button cipher-laptop-button-quiet', 'REFRESH PLATFORM STATE');
  refreshButton.type = 'button';
  header.append(titleBlock, refreshButton);
  root.appendChild(header);

  const statement = el('p', 'cipher-laptop-boundary', 'Cipher proposes. The operator authorizes. AgentLoop executes under Authority and Resource Admission. This first composer slice runs only Cipher through his exact local Resident binding.');
  root.appendChild(statement);

  const statusGrid = el('section', 'cipher-laptop-status-grid');
  const residentCard = el('article', 'cipher-laptop-status-card');
  residentCard.append(el('span', 'cipher-laptop-label', 'RESIDENT'), el('strong', 'cipher-laptop-value', 'UNKNOWN'), el('small', 'cipher-laptop-detail', 'Waiting for canonical binding'));
  const projectCard = el('article', 'cipher-laptop-status-card');
  projectCard.append(el('span', 'cipher-laptop-label', 'PROJECT / CHECKOUT'), el('strong', 'cipher-laptop-value', 'UNKNOWN'), el('small', 'cipher-laptop-detail', 'ProjectSeat projection not read'));
  const routeCard = el('article', 'cipher-laptop-status-card');
  routeCard.append(el('span', 'cipher-laptop-label', 'EXECUTION ROUTE'), el('strong', 'cipher-laptop-value', 'UNKNOWN'), el('small', 'cipher-laptop-detail', 'No execution claim'));
  statusGrid.append(residentCard, projectCard, routeCard);
  root.appendChild(statusGrid);

  const body = el('div', 'cipher-laptop-layout');
  const composer = el('section', 'cipher-laptop-panel');
  composer.append(el('p', 'cipher-laptop-kicker', 'MISSION COMPOSER'), el('h2', 'cipher-laptop-heading', 'Describe the result you want'));
  const objectiveLabel = el('label', 'cipher-laptop-label', 'OPERATOR OBJECTIVE');
  const objective = el('textarea', 'cipher-laptop-objective');
  objective.id = 'cipher-laptop-objective';
  objective.maxLength = 4000;
  objective.rows = 5;
  objective.placeholder = 'Example: Put together a small, distinctive developer dashboard. Explain the stages, available workers, risks, and how the result will be verified.';
  objectiveLabel.htmlFor = objective.id;
  composer.append(objectiveLabel, objective);
  const contextPreview = el('details', 'cipher-laptop-context');
  const contextSummary = el('summary', 'cipher-laptop-summary', 'INSPECT COMPOSER-SUPPLIED CONTEXT');
  const contextText = el('pre', 'cipher-laptop-context-text', 'No context package prepared.');
  contextPreview.append(contextSummary, contextText);
  composer.appendChild(contextPreview);
  const propose = el('button', 'cipher-laptop-button cipher-laptop-button-primary', 'ASK CIPHER TO PROPOSE A WORKFLOW');
  propose.type = 'button';
  composer.appendChild(propose);
  const proposalNote = el('p', 'cipher-laptop-note', 'The planning request itself is a local model operation and must pass its own Authority gate. A plan never grants tools or permission.');
  composer.appendChild(proposalNote);

  const dossierPanel = el('section', 'cipher-laptop-panel');
  dossierPanel.append(el('p', 'cipher-laptop-kicker', 'HARNESS / MODEL ATLAS'), el('h2', 'cipher-laptop-heading', 'Evidence available for lineup design'));
  const dossierList = el('div', 'cipher-laptop-dossiers');
  dossierPanel.appendChild(dossierList);
  const teamPanel = el('div', 'cipher-laptop-team');
  dossierPanel.appendChild(teamPanel);
  const lineupNote = el('p', 'cipher-laptop-note', 'Dossier roles are proposal evidence only. A model is not dispatchable here unless Model Manager, qualification, artifact hash, and an exact local route all agree.');
  dossierPanel.appendChild(lineupNote);
  body.append(composer, dossierPanel);
  root.appendChild(body);

  const missionPanel = el('section', 'cipher-laptop-panel cipher-laptop-mission');
  missionPanel.append(el('p', 'cipher-laptop-kicker', 'SESSION-OBSERVED MISSION'), el('h2', 'cipher-laptop-heading', 'Proposal → operator decision → governed execution → receipt'));
  const stageRow = el('div', 'cipher-laptop-stages');
  const stageNodes = ['PLAN', 'REVIEW', 'EXECUTE', 'RECEIPT'].map(label => {
    const item = el('div', 'cipher-laptop-stage');
    item.append(el('span', 'cipher-laptop-stage-name', label), el('strong', 'cipher-laptop-stage-state', 'WAITING'));
    stageRow.appendChild(item);
    return item;
  });
  missionPanel.appendChild(stageRow);
  const missionMeta = el('p', 'cipher-laptop-note', 'No mission session is active.');
  missionPanel.appendChild(missionMeta);
  const planLabel = el('h3', 'cipher-laptop-subheading', 'CIPHER PLAN · MODEL OUTPUT, NOT VERIFICATION');
  const planOutput = el('pre', 'cipher-laptop-plan-output', 'Cipher has not proposed a workflow yet.');
  const planEditLabel = el('label', 'cipher-laptop-label', 'REVIEW / EDIT THE PROPOSAL BEFORE APPROVAL');
  const planEditor = el('textarea', 'cipher-laptop-plan-editor');
  planEditor.id = 'cipher-laptop-plan-editor';
  planEditor.rows = 8;
  planEditor.maxLength = 8000;
  planEditor.disabled = true;
  planEditor.placeholder = 'Cipher’s observed proposal will appear here after the planning session completes.';
  planEditLabel.htmlFor = planEditor.id;
  const executionBoundary = el('p', 'cipher-laptop-note', 'Editing changes the task sent for execution. This first vertical still executes only the exact Cipher/Liquid Resident route; other models cannot be substituted or delegated here.');
  missionPanel.append(planLabel, planOutput, planEditLabel, planEditor, executionBoundary);
  const pendingDecision = el('div', 'cipher-laptop-pending');
  missionPanel.appendChild(pendingDecision);
  const controls = el('div', 'cipher-laptop-controls');
  const approvePlan = el('button', 'cipher-laptop-button cipher-laptop-button-primary', 'APPROVE PLAN AND START CIPHER');
  approvePlan.type = 'button'; approvePlan.disabled = true;
  const rejectPlan = el('button', 'cipher-laptop-button cipher-laptop-button-quiet', 'REJECT / CLEAR PLAN');
  rejectPlan.type = 'button'; rejectPlan.disabled = true;
  const cancelSession = el('button', 'cipher-laptop-button cipher-laptop-button-danger', 'CANCEL OWNED SESSION');
  cancelSession.type = 'button'; cancelSession.disabled = true;
  const savePlan = el('button', 'cipher-laptop-button cipher-laptop-button-quiet', 'RETAIN PROPOSAL IN CIPHER NOTEBOOK');
  savePlan.type = 'button'; savePlan.disabled = true;
  controls.append(approvePlan, rejectPlan, cancelSession, savePlan);
  missionPanel.appendChild(controls);
  const resultOutput = el('pre', 'cipher-laptop-result-output', 'No execution result observed.');
  missionPanel.appendChild(resultOutput);
  const receiptOutput = el('div', 'cipher-laptop-receipt', 'No Mission Receipt loaded.');
  missionPanel.appendChild(receiptOutput);
  root.appendChild(missionPanel);

  const recentPanel = el('section', 'cipher-laptop-panel cipher-laptop-recent');
  recentPanel.append(el('p', 'cipher-laptop-kicker', 'DURABLE PROVENANCE'), el('h2', 'cipher-laptop-heading', 'Recent model runs and receipts'));
  const recentList = el('div', 'cipher-laptop-recent-list');
  recentPanel.appendChild(recentList);
  root.appendChild(recentPanel);
  parent.appendChild(root);

  let alive = true;
  let busy = false;
  let snapshot: AgentSnapshot = { binding: null, manager: null, routes: null, atlas: null, project: null, candidates: [], errors: [] };
  let exactWorker: ReturnType<typeof residentWorkerForBinding> | null = null;
  let sessionId: string | null = null;
  let sessionMode: 'plan' | 'act' | null = null;
  let sessionStatus: AgentStatusResponseT | null = null;
  let planSessionId: string | null = null;
  let planText: string | null = null;
  let approvedPlanText = '';
  let objectiveText = '';
  let proposalInput = '';
  let receipt: MissionReceiptResponseT | null = null;
  let receiptError: string | null = null;
  let message: string | null = null;
  let timer: number | null = null;
  let refreshController: AbortController | null = null;
  let epoch = 0;
  const pendingAgentEvents: AgentStreamEventT[] = [];
  const eventBus = getSharedEvents();

  function statusValue(card: HTMLElement, value: string, detail: string, stateClass?: string): void {
    const strong = card.querySelector('strong');
    const small = card.querySelector('small');
    if (strong) strong.textContent = value;
    if (small) small.textContent = detail;
    card.dataset.state = stateClass ?? 'unknown';
  }

  function stage(index: number, state: string, className: string): void {
    const node = stageNodes[index];
    if (!node) return;
    const value = node.querySelector('strong');
    if (value) value.textContent = state;
    node.dataset.state = className;
  }

  function renderDossiers(): void {
    dossierList.textContent = '';
    teamPanel.textContent = '';
    if (snapshot.atlas === null) {
      dossierList.appendChild(el('p', 'cipher-laptop-empty', 'Model Atlas projection is unavailable; Cipher will not claim dossier-backed worker suitability.'));
    } else if (snapshot.atlas.models.length === 0) {
      dossierList.appendChild(el('p', 'cipher-laptop-empty', 'No canonical Model Manager identities are currently projected into Model Atlas.'));
    } else {
      const candidateById = new Map(snapshot.candidates.map(candidate => [candidate.model_id, candidate] as const));
      for (const entry of snapshot.atlas.models.slice(0, 16)) {
        const candidate = candidateById.get(entry.model_id);
        const row = el('article', 'cipher-laptop-dossier-row');
        const heading = el('div', 'cipher-laptop-dossier-head');
        heading.append(el('strong', 'cipher-laptop-dossier-name', entry.display_name), el('span', 'cipher-laptop-badge', candidate ? 'LOCAL · READY · EVIDENCED' : `${entry.evaluation_state} · ${entry.qualification_state ?? 'NO QUALIFICATION'}`));
        row.appendChild(heading);
        row.appendChild(el('code', 'cipher-laptop-dossier-id', entry.model_id));
        if (candidate) {
          row.appendChild(el('p', 'cipher-laptop-dossier-detail', `Verified dossier roles: ${candidate.roles.join(', ')} · evaluation ${candidate.evaluation_id} · evidence ${candidate.evidence_refs.join(', ')}`));
        } else {
          const roles = entry.recommended_roles.length > 0 ? `Model Manager suggestions (not Harness evidence): ${entry.recommended_roles.join(', ')}` : 'No role recommendation is supported by current full dossier evidence.';
          row.appendChild(el('p', 'cipher-laptop-dossier-detail', `${roles} · scope ${entry.scope}${entry.stale_reasons.length ? ` · stale: ${entry.stale_reasons.join(', ')}` : ''}`));
        }
        dossierList.appendChild(row);
      }
    }
    teamPanel.append(el('h3', 'cipher-laptop-subheading', 'EXECUTION-READY LINEUP'), el('p', 'cipher-laptop-team-row', exactWorker
      ? `Cipher · Liquid Resident · ${exactWorker.worker} · planning / coordination · local only. This is the only worker this slice can initialize.`
      : 'Cipher/Liquid is not currently ready; no model will be substituted.'));
    teamPanel.appendChild(el('p', 'cipher-laptop-note', snapshot.candidates.length > 0
      ? `${snapshot.candidates.length} local model dossier(s) have current role evidence and ready routes. They remain candidate information; specialist dispatch is not wired in this slice.`
      : 'No specialist model has current full qualification evidence and a ready local route. Cipher will report the gap instead of inventing a lineup.'));
  }

  function render(): void {
    const binding = snapshot.binding;
    const model = binding?.resident_model_id && snapshot.manager
      ? snapshot.manager.models.find(item => item.identity.canonical_id === binding.resident_model_id) ?? null
      : null;
    statusValue(residentCard, binding?.resident_id === 'cipher' ? `CIPHER · ${binding.binding_state}` : 'UNAVAILABLE',
      binding === null ? snapshot.errors.find(error => error.startsWith('Resident:')) ?? 'Canonical Resident binding unavailable' :
        `${binding.resident_model_id ?? 'No model bound'} · ${binding.runtime_state} · ${binding.availability_state}${model ? ` · qualification ${model.identity.qualification.state}` : ''}`,
      binding?.binding_state.toLowerCase() ?? 'unknown');
    statusValue(projectCard, snapshot.project ? snapshot.project.foreground_state.replaceAll('_', ' ') : 'UNAVAILABLE',
      snapshot.project ? `Project ${snapshot.project.project.project_id} · checkout ${snapshot.project.checkout.checkout_id} · ${snapshot.project.checkout.root}` :
        snapshot.errors.find(error => error.startsWith('Project:')) ?? 'ProjectSeat identity unavailable', snapshot.project ? 'available' : 'unknown');
    statusValue(routeCard, exactWorker ? 'LOCAL ROUTE READY' : 'NOT READY',
      exactWorker ? `${exactWorker.worker} · ${exactWorker.model} · no fallback` : snapshot.errors.find(error => error.startsWith('Resident route:')) ?? 'The exact Cipher/Liquid route has not passed all current checks.',
      exactWorker ? 'ready' : 'unknown');
    renderDossiers();

    refreshButton.disabled = busy;
    const objective = objectiveText.trim();
    const eventReady = eventBus?.connected() === true;
    propose.disabled = busy || objective.length === 0 || exactWorker === null || snapshot.project === null || !eventReady;
    propose.title = !eventReady ? 'Authenticated Covert event stream must be connected to observe the actual planning result.' :
      exactWorker === null ? 'Exact qualified Liquid Resident route unavailable.' : snapshot.project === null ? 'Canonical ProjectSeat identity is required.' : '';
    approvePlan.disabled = busy || planText === null || planSessionId === null || sessionStatus?.state !== 'done' || sessionMode !== 'plan';
    planEditor.disabled = busy || planText === null || sessionStatus?.state !== 'done' || sessionMode !== 'plan';
    if (planEditor.value !== approvedPlanText) planEditor.value = approvedPlanText;
    approvePlan.disabled ||= approvedPlanText.trim().length === 0;
    rejectPlan.disabled = planText === null || (sessionId !== null && (sessionStatus === null || sessionStatus.state === 'running'));
    cancelSession.disabled = sessionId === null || sessionStatus === null || terminal(sessionStatus.state);
    savePlan.disabled = busy || planText === null || planSessionId === null;
    missionMeta.textContent = sessionId === null
      ? message ?? (eventReady ? 'No active mission session.' : 'Authenticated Covert event stream is disconnected; the composer will not start a plan whose output cannot be observed.')
      : `SESSION ${sessionId} · ${sessionMode?.toUpperCase() ?? 'UNKNOWN'} · ${sessionStatus?.state.toUpperCase() ?? 'STARTING'}${sessionStatus?.error ? ` · ${sessionStatus.error}` : ''}`;
    planOutput.textContent = planText ?? 'Cipher has not proposed a workflow yet.';
    resultOutput.textContent = sessionMode === 'act' && sessionStatus
      ? `Lifecycle: ${sessionStatus.state.toUpperCase()}\nIterations: ${sessionStatus.iterations}\nVerification: ${sessionStatus.verification?.state.toUpperCase() ?? 'NOT REPORTED'}\n${sessionStatus.error ? `Error: ${sessionStatus.error}` : 'Result text is shown only when observed from the AgentLoop event stream.'}`
      : 'No execution result observed.';
    stage(0, planText === null ? 'WAITING' : sessionStatus?.state.toUpperCase() ?? 'OBSERVED', planText === null ? 'idle' : sessionStatus?.state ?? 'observed');
    stage(1, planText !== null && sessionStatus?.state === 'done' ? 'OPERATOR REVIEW' : sessionStatus?.state === 'awaiting_approval' ? 'AUTHORITY DECISION' : 'WAITING', planText !== null ? 'ready' : 'idle');
    stage(2, sessionMode === 'act' ? sessionStatus?.state.toUpperCase() ?? 'STARTING' : 'NOT STARTED', sessionMode === 'act' ? sessionStatus?.state ?? 'unknown' : 'idle');
    stage(3, receipt ? receipt.verification.toUpperCase() : receiptError ? 'UNAVAILABLE' : sessionMode === 'act' && sessionStatus && terminal(sessionStatus.state) ? 'LOADING' : 'WAITING', receipt ? receipt.verification.toLowerCase() : receiptError ? 'unknown' : 'idle');

    pendingDecision.textContent = '';
    const pending = sessionStatus?.pending_approval;
    if (pending !== undefined && pending !== null) {
      pendingDecision.append(el('h3', 'cipher-laptop-subheading', `OPERATOR DECISION REQUIRED · ${pending.tool}`));
      if (pending.preview) pendingDecision.appendChild(el('p', 'cipher-laptop-note', pending.preview));
      for (const risk of pending.risks) pendingDecision.appendChild(el('p', 'cipher-laptop-risk', risk));
      const decisionButtons = el('div', 'cipher-laptop-controls');
      for (const [label, decision] of [['APPROVE EXACT OPERATION', 'approve'], ['REJECT OPERATION', 'reject']] as const) {
        const button = el('button', `cipher-laptop-button ${decision === 'approve' ? 'cipher-laptop-button-primary' : 'cipher-laptop-button-danger'}`, label);
        button.type = 'button'; button.disabled = busy;
        button.addEventListener('click', () => { void decidePending(pending.approval_id, decision); });
        decisionButtons.appendChild(button);
      }
      pendingDecision.appendChild(decisionButtons);
    }
    receiptOutput.textContent = receipt ? `MISSION ${receipt.mission_id}\nVerification: ${receipt.verification}\nSupported conclusion: ${receipt.supported_conclusion ?? 'none'}\nLimitations: ${receipt.limitations.join(' · ') || 'none recorded'}\nEvidence references: ${receipt.evidence_refs.join(', ') || 'none recorded'}` : receiptError ?? 'No Mission Receipt loaded.';
  }

  async function refresh(force = false): Promise<void> {
    if (!alive || (busy && !force)) return;
    refreshController?.abort();
    const controller = new AbortController();
    refreshController = controller;
    snapshot.errors = [];
    message = 'Reading current Covert projections…';
    render();
    const requests = await Promise.allSettled([
      call('/api/resident/binding', { schema: ResidentBinding, signal: controller.signal }),
      api.modelManager(controller.signal),
      api.routes(),
      call('/api/models/atlas', { schema: ModelAtlasModelsResponse, signal: controller.signal }),
      call('/api/projects/current', { query: EmptyQuery.parse({}), schema: CurrentProjectResponse, signal: controller.signal })
    ]);
    if (!alive || controller.signal.aborted) return;
    const [bindingResult, managerResult, routesResult, atlasResult, projectResult] = requests;
    snapshot.binding = bindingResult.status === 'fulfilled' ? bindingResult.value : null;
    snapshot.manager = managerResult.status === 'fulfilled' ? managerResult.value : null;
    snapshot.routes = routesResult.status === 'fulfilled' ? routesResult.value : null;
    snapshot.atlas = atlasResult.status === 'fulfilled' ? atlasResult.value : null;
    snapshot.project = projectResult.status === 'fulfilled' ? projectResult.value : null;
    const labels = ['Resident', 'Model Manager', 'Routes', 'Model Atlas', 'Project'];
    requests.forEach((result, index) => { if (result.status === 'rejected') snapshot.errors.push(`${labels[index]}: ${failureText(result.reason)}`); });
    exactWorker = null;
    if (snapshot.binding && snapshot.manager && snapshot.routes) {
      try { exactWorker = residentWorkerForBinding(snapshot.binding, snapshot.manager, snapshot.routes, 'planner'); }
      catch (error) { snapshot.errors.push(`Resident route: ${failureText(error)}`); }
    }
    snapshot.candidates = [];
    if (snapshot.atlas && snapshot.manager && snapshot.routes) {
      const current = snapshot.atlas.models.filter(entry => entry.evaluation_state === 'CURRENT' && entry.qualification_state === 'QUALIFIED' && entry.scope === 'FULL' && entry.latest_evaluation_id !== null).slice(0, 12);
      const records = new Map<string, ModelAtlasRecordResponseT>();
      const recordResults = await Promise.allSettled(current.map(entry =>
        call('/api/models/atlas/record', { query: { model_id: entry.model_id }, schema: ModelAtlasRecordResponse, signal: controller.signal })
          .then(record => { records.set(entry.model_id, record); })
      ));
      for (const result of recordResults) if (result.status === 'rejected') snapshot.errors.push(`Atlas record: ${failureText(result.reason)}`);
      if (!controller.signal.aborted) snapshot.candidates = currentLocalDossierCandidates(snapshot.manager, snapshot.atlas.models, records, snapshot.routes);
    }
    message = snapshot.errors.length ? `Some projections are unavailable: ${snapshot.errors.slice(0, 3).join(' · ')}` : null;
    contextText.textContent = snapshot.project && snapshot.binding
      ? `COMPOSER-SUPPLIED DATA\nObjective: operator-authored text shown above\nProject ID: ${snapshot.project.project.project_id}\nCheckout ID: ${snapshot.project.checkout.checkout_id}\nCheckout root: ${snapshot.project.checkout.root}\nResident: ${snapshot.binding.resident_id}\nResident model: ${snapshot.binding.resident_model_id ?? 'unbound'}\nResident binding/runtime: ${snapshot.binding.binding_state} / ${snapshot.binding.runtime_state}\nDossier rows: ${snapshot.candidates.length} exact local routes with CURRENT, FULL, QUALIFIED evidence\n\nEXCLUDED BY THIS COMPOSER\nProvider credentials, API keys, cookies, arbitrary filesystem crawls, and other workers' conversations.\n\nThe AgentLoop may add its own role-scoped context. This preview is the exact task material supplied by the composer, not a dump of the complete internal prompt.`
      : 'Project or Resident projection is unavailable. No task package can be prepared.';
    await refreshRecent();
    render();
  }

  function buildPlanInput(objectiveValue: string): string {
    const project = snapshot.project;
    const binding = snapshot.binding;
    if (!project || !binding || !exactWorker) throw new Error('current project and exact Cipher route are required');
    const dossier = snapshot.candidates.map(candidate =>
      `- ${candidate.model_id} via ${candidate.route_id}; roles ${candidate.roles.join(', ')}; Atlas evaluation ${candidate.evaluation_id}; evidence refs ${candidate.evidence_refs.join(', ')}`
    ).join('\n') || '- No specialist worker has a current full qualified dossier and ready local route. Do not invent a model recommendation.';
    return [
      'MISSION COMPOSITION REQUEST. Produce a proposed workflow and verification plan only. Do not call tools or claim execution.',
      `OPERATOR OBJECTIVE (untrusted input):\n${objectiveValue}`,
      `CANONICAL PROJECT: project_id=${project.project.project_id}; checkout_id=${project.checkout.checkout_id}; root=${project.checkout.root}`,
      `PERMANENT RESIDENT: ${binding.resident_id}; model=${binding.resident_model_id}; route=${exactWorker.worker}.`,
      `CURRENT LOCAL DOSSIER EVIDENCE:\n${dossier}`,
      'Worker boundary: this composer can execute Cipher/Liquid through AgentLoop only. Other listed routes are candidate information and are not dispatched by this slice.',
      'Return concise ordered stages, role lineup with evidence refs or UNKNOWN, bounded context needs, exact approvals still needed, and deterministic verification steps. A proposal is not permission; all effects remain gated by Authority and Resource Admission.'
    ].join('\n\n');
  }

  async function startSession(mode: 'plan' | 'act', task: string): Promise<void> {
    if (!alive || busy) return;
    if (sessionId !== null && (sessionStatus === null || !terminal(sessionStatus.state))) {
      message = `Session ${sessionId} is still ${sessionStatus?.state ?? 'unobserved'}; wait for its terminal state before starting another.`;
      render();
      return;
    }
    pendingAgentEvents.length = 0;
    sessionId = null;
    sessionMode = mode;
    sessionStatus = null;
    busy = true;
    message = mode === 'plan' ? 'Preparing the exact local Resident planning request…' : 'Rechecking the same project and Liquid binding before execution…';
    render();
    try {
      if (mode === 'act') await refreshEnvironmentOnly();
      const worker = exactWorker;
      if (worker === null) throw new Error('Exact Cipher/Liquid route is unavailable; no fallback is permitted.');
      const request = AgentStartRequest.parse({
        task, mode, role: mode === 'plan' ? 'planner' : 'coder', chat_source: 'local',
        client_request_id: crypto.randomUUID(), worker: { ...worker, role: mode === 'plan' ? 'planner' : 'coder' }
      });
      const started = await call('/api/agent/start', { method: 'POST', body: request, schema: AgentStartResponse });
      if (!alive) return;
      sessionId = started.session_id;
      sessionMode = mode;
      sessionStatus = null;
      receipt = null;
      receiptError = null;
      if (mode === 'plan') {
        planSessionId = started.session_id;
        planText = null;
      }
      const earlyEvents = pendingAgentEvents.splice(0, pendingAgentEvents.length);
      for (const event of earlyEvents) consumeAgentEvent(event);
      message = `AgentLoop session ${started.session_id} created; lifecycle awaits an observed status read.`;
      busy = false;
      render();
      await pollSession(started.session_id, ++epoch);
    } catch (error) {
      busy = false;
      message = `${mode === 'plan' ? 'Planning request' : 'Mission start'} refused or unavailable · ${failureText(error)}`;
      render();
      options.onToast('NOT_READY', message);
    }
  }

  async function refreshEnvironmentOnly(): Promise<void> {
    const priorBinding = snapshot.binding ? `${snapshot.binding.resident_id}:${snapshot.binding.resident_model_id}:${snapshot.binding.binding_state}:${snapshot.binding.availability_state}:${snapshot.binding.runtime_state}:${snapshot.binding.execution_node}` : null;
    const priorProject = snapshot.project ? `${snapshot.project.project.project_id}:${snapshot.project.checkout.checkout_id}:${snapshot.project.checkout.root}` : null;
    const priorWorker = exactWorker ? `${exactWorker.worker}:${exactWorker.model}:${exactWorker.provider}` : null;
    await refresh(true);
    const currentBinding = snapshot.binding ? `${snapshot.binding.resident_id}:${snapshot.binding.resident_model_id}:${snapshot.binding.binding_state}:${snapshot.binding.availability_state}:${snapshot.binding.runtime_state}:${snapshot.binding.execution_node}` : null;
    const currentProject = snapshot.project ? `${snapshot.project.project.project_id}:${snapshot.project.checkout.checkout_id}:${snapshot.project.checkout.root}` : null;
    const currentWorker = exactWorker ? `${exactWorker.worker}:${exactWorker.model}:${exactWorker.provider}` : null;
    if (currentBinding !== priorBinding || currentProject !== priorProject || currentWorker !== priorWorker) {
      throw new Error('Project or Resident identity changed after plan review. Rebuild the plan before execution.');
    }
  }

  async function pollSession(id: string, ticket: number): Promise<void> {
    if (!alive || ticket !== epoch) return;
    if (timer !== null) window.clearTimeout(timer);
    try {
      const query = AgentStatusQuery.parse({ id });
      const status = await call('/api/agent/status', { query, schema: AgentStatusResponse });
      if (!alive || ticket !== epoch || sessionId !== id) return;
      if (status.session_id !== id) throw new Error('AgentLoop status identity mismatch');
      sessionStatus = status;
      if (terminal(status.state) && sessionMode === 'act') void loadReceipt(id, ticket);
      render();
      if (!terminal(status.state)) timer = window.setTimeout(() => { void pollSession(id, ticket); }, 1200);
    } catch (error) {
      if (!alive || ticket !== epoch) return;
      message = `Session status unavailable · ${failureText(error)}`;
      render();
      timer = window.setTimeout(() => { void pollSession(id, ticket); }, 2500);
    }
  }

  async function loadReceipt(id: string, ticket: number): Promise<void> {
    if (!alive || ticket !== epoch || receipt !== null) return;
    receiptError = 'Mission Receipt is not yet available from ProvenanceLedger.';
    render();
    for (let attempt = 0; attempt < 5 && alive && ticket === epoch; attempt += 1) {
      try {
        receipt = await call('/api/mission/receipt', { query: { id }, schema: MissionReceiptResponse });
        receiptError = null;
        render();
        return;
      } catch (error) {
        receiptError = `Mission Receipt unavailable · ${failureText(error)}`;
        render();
        if (attempt < 4) await new Promise(resolve => window.setTimeout(resolve, 700));
      }
    }
  }

  async function refreshRecent(): Promise<void> {
    recentList.textContent = '';
    let response: ProvenanceListResponseT;
    try { response = await call('/api/provenance/runs', { schema: ProvenanceListResponse }); }
    catch (error) { recentList.appendChild(el('p', 'cipher-laptop-empty', `ProvenanceLedger unavailable · ${failureText(error)}`)); return; }
    const runs = response.runs.slice(-8).reverse();
    if (runs.length === 0) { recentList.appendChild(el('p', 'cipher-laptop-empty', 'No durable model-run observations are recorded.')); return; }
    for (const run of runs) {
      const row = el('article', 'cipher-laptop-recent-row');
      row.append(el('strong', 'cipher-laptop-recent-task', run.task), el('code', 'cipher-laptop-recent-id', run.run_id));
      row.appendChild(el('p', 'cipher-laptop-note', `${run.result.toUpperCase()} · ${run.verification_state.toUpperCase()} · ${run.worker ?? 'worker identity not recorded'} · task ${run.task_id}`));
      const open = el('button', 'cipher-laptop-button cipher-laptop-button-quiet', 'OPEN MISSION RECEIPT');
      open.type = 'button';
      open.addEventListener('click', () => { void openReceipt(run.task_id); });
      row.appendChild(open);
      recentList.appendChild(row);
    }
  }

  async function openReceipt(id: string): Promise<void> {
    try {
      const loaded = await call('/api/mission/receipt', { query: { id }, schema: MissionReceiptResponse });
      if (!alive) return;
      receipt = loaded; receiptError = null; render();
      options.onToast('OK', `Loaded durable Mission Receipt ${loaded.mission_id}`);
    } catch (error) {
      receiptError = `Mission Receipt unavailable · ${failureText(error)}`; render();
      options.onToast('NOT_READY', receiptError);
    }
  }

  async function decidePending(approvalId: string, decision: 'approve' | 'reject'): Promise<void> {
    if (!sessionId || busy) return;
    busy = true; render();
    try {
      await call('/api/agent/decision', {
        method: 'POST', body: AgentDecisionRequest.parse({ session_id: sessionId, approval_id: approvalId, decision }), schema: AgentDecisionResponse
      });
      busy = false;
      await pollSession(sessionId, epoch);
    } catch (error) {
      busy = false; message = `Authority decision refused · ${failureText(error)}`; render();
    }
  }

  async function cancelOwnedSession(): Promise<void> {
    if (!sessionId || busy) return;
    const id = sessionId;
    busy = true; render();
    try {
      await call('/api/agent/cancel', { method: 'POST', body: AgentCancelRequest.parse({ session_id: id }), schema: AgentCancelResponse });
      busy = false;
      message = `Cancellation requested for owned session ${id}; waiting for terminal lifecycle observation.`;
      render();
      await pollSession(id, epoch);
    } catch (error) {
      busy = false; message = `Cancellation refused · ${failureText(error)}`; render();
    }
  }

  async function saveProposal(): Promise<void> {
    if (!planText || !planSessionId || busy) return;
    const content = `Cipher workflow proposal (unverified model output; operator-edited if changed)\n\nOperator objective:\n${objectiveText.trim()}\n\nProposal:\n${approvedPlanText}`;
    if (content.length > 4000) { message = 'Notebook retention refused: proposal exceeds the canonical 4000-character record limit; no truncation was applied.'; render(); return; }
    busy = true; message = 'Reading the existing Notebook record before an operator-approved revision…'; render();
    try {
      const notebook = await call('/api/cipher/laptop/notebook', { schema: CipherNotebookListResponse });
      const recordId = `workflow-${planSessionId}`;
      const existing = notebook.records.find(record => record.record_id === recordId);
      const body = CipherNotebookPut.parse({
        record_id: recordId, expected_revision: existing?.revision ?? 0,
        category: 'OPERATOR_NOTE', content, source: 'OBSERVED',
        provenance_ref: `agent-session:${planSessionId}`, confidence: null,
        retention: 'RETAIN', approved_memory: true, expires_at: null
      });
      const saved = await call('/api/cipher/laptop/notebook', { method: 'POST', body, schema: CipherNotebookRecord });
      busy = false; message = `Proposal retained in Cipher Notebook at revision ${saved.revision}; it remains an unverified proposal.`; render();
    } catch (error) {
      busy = false; message = `Notebook save refused or unavailable · ${failureText(error)}`; render();
    }
  }

  async function proposePlan(): Promise<void> {
    if (busy || exactWorker === null || snapshot.project === null || eventBus?.connected() !== true) return;
    if (sessionId !== null && (sessionStatus === null || !terminal(sessionStatus.state))) {
      message = `Session ${sessionId} is still ${sessionStatus?.state ?? 'unobserved'}; wait for its terminal state before composing another plan.`;
      render();
      return;
    }
    const text = objective.value.trim();
    if (text.length < 1 || text.length > 4000) { message = 'Enter an objective of 1–4000 characters.'; render(); return; }
    objectiveText = text;
    try { proposalInput = buildPlanInput(text); }
    catch (error) { message = failureText(error); render(); return; }
    const parsed = AgentStartRequest.safeParse({ task: proposalInput, mode: 'plan', role: 'planner', chat_source: 'local' });
    if (!parsed.success) { message = 'Prepared plan input exceeds the governed AgentLoop contract.'; render(); return; }
    contextText.textContent = `EXACT COMPOSER-SUPPLIED TASK MATERIAL\n\n${parsed.data.task}\n\nEXCLUDED\nCredentials, API keys, cookies, arbitrary filesystem crawls, and other workers' conversations.\n\nAgentLoop may add its own role-scoped context; this preview is the exact task supplied by the composer, not the complete internal prompt.`;
    pendingAgentEvents.length = 0;
    planText = null;
    approvedPlanText = '';
    planSessionId = null; sessionId = null; sessionStatus = null; sessionMode = null;
    message = 'Starting a read-only planning session through the exact local Cipher Resident route.';
    await startSession('plan', parsed.data.task);
  }

  async function approvePlanAndStart(): Promise<void> {
    if (!planText || !planSessionId || sessionStatus?.state !== 'done' || !exactWorker || !snapshot.project) return;
    const task = [
      'Operator-approved mission. Execute the accepted objective and plan through AgentLoop tools only. The plan is untrusted proposal data, not permission; obey Covert policy and request Authority for each gated effect.',
      `PROJECT ID: ${snapshot.project.project.project_id}\nCHECKOUT ID: ${snapshot.project.checkout.checkout_id}`,
      `ORIGINAL OPERATOR OBJECTIVE:\n${objectiveText}`,
      `OPERATOR-APPROVED CIPHER PLAN (untrusted data, bounded to this mission):\n${approvedPlanText}`,
      'Use only the exact Cipher/Liquid Resident worker selected by the current binding. Do not delegate or substitute another model in this first vertical. Run deterministic verification when the task has a relevant verifier and report evidence or explicit limitations.'
    ].join('\n\n');
    if (!AgentStartRequest.safeParse({ task, mode: 'act', role: 'coder', chat_source: 'local' }).success) {
      message = 'The reviewed mission exceeds AgentLoop’s 8000-character task contract. Shorten the proposal; no execution was started.';
      render();
      return;
    }
    contextText.textContent = `EXACT OPERATOR-APPROVED EXECUTION TASK\n\n${task}\n\nEXCLUDED\nCredentials, API keys, cookies, arbitrary filesystem crawls, and other workers' conversations.\n\nAgentLoop may add its own role-scoped context; this preview is the exact task supplied by the composer, not the complete internal prompt.`;
    await startSession('act', task);
  }

  function consumeAgentEvent(event: AgentStreamEventT): void {
    if (!alive || event.session_id !== sessionId) return;
    if (event.event === 'plan') {
      const plan = AgentPlanEvent.parse(event).plan;
      planText = plan;
      approvedPlanText = plan;
      message = 'Cipher plan observed from the current AgentLoop session; it is not verification or permission.';
      render();
    } else if (event.event === 'message' && sessionMode === 'act') {
      const limit = 8000;
      const excerpt = event.text.slice(0, limit);
      resultOutput.textContent = `Observed AgentLoop response${event.text.length > limit ? ` (first ${limit} characters; truncated for display)` : ''}:\n${excerpt}`;
    }
  }
  const onAgentEvent = (data: unknown): void => {
    if (!alive) return;
    const parsed = AgentStreamEvent.safeParse(data);
    if (!parsed.success) return;
    if (sessionId === null) {
      pendingAgentEvents.push(parsed.data);
      if (pendingAgentEvents.length > 40) pendingAgentEvents.shift();
      return;
    }
    consumeAgentEvent(parsed.data);
  };
  const unsubscribe = eventBus?.subscribe('agent', onAgentEvent) ?? (() => {});
  propose.addEventListener('click', () => { void proposePlan(); });
  approvePlan.addEventListener('click', () => { void approvePlanAndStart(); });
  rejectPlan.addEventListener('click', () => {
    if (sessionStatus?.state === 'running') return;
    planText = null; approvedPlanText = ''; planSessionId = null; message = 'Cipher proposal rejected by the operator. No mission was started.'; render();
  });
  cancelSession.addEventListener('click', () => { void cancelOwnedSession(); });
  savePlan.addEventListener('click', () => { void saveProposal(); });
  refreshButton.addEventListener('click', () => { void refresh(); });
  objective.addEventListener('input', () => { objectiveText = objective.value; render(); });
  planEditor.addEventListener('input', () => { approvedPlanText = planEditor.value; render(); });
  render();
  void refresh();

  return {
    refresh,
    dispose(): void {
      alive = false;
      epoch += 1;
      refreshController?.abort();
      if (timer !== null) window.clearTimeout(timer);
      unsubscribe();
      parent.innerHTML = '';
    }
  };
}
