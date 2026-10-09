// Resident Core — advisory workspace projection.
//
// This surface consumes Resident evidence and the existing model-chat surface.
// It owns no execution authority, H2 state, provider capability, or verifier
// truth. Every unavailable endpoint remains independently visible.

import type { Store } from '../store/store.ts';
import type { AppState, ResidentTaskProjection } from '../store/state.ts';
import { api, call, ApiError } from '../services/api.ts';
import { createChatPanel } from '../chat/chat.ts';
import { residentWorkerForBinding } from './resident-worker-selection.ts';
import { createOperatorIdentity, type OperatorIdentityHandles, type OperatorPresenceState } from './OperatorIdentity.ts';
import {
  AgentDecisionRequest,
  AgentDecisionResponse,
  AgentCancelRequest,
  AgentCancelResponse,
  AgentStartRequest,
  AgentStartResponse,
  AgentStatusQuery,
  AgentStatusResponse,
  type AgentStatusResponseT
} from '../../../common/contracts/agent.ts';
import type {
  ResidentSummaryResponseT,
  ResidentContextT,
  ResidentPushSummaryT,
  ResidentDecisionT
} from '../../../common/contracts/resident.ts';
import { ResidentBinding } from '../../../common/contracts/resident-binding.ts';

export interface ResidentCoreHandles {
  root: HTMLElement;
  refresh(): Promise<void>;
  dispose(): void;
}

export interface ResidentCoreOptions {
  onToast?: (code: string, message: string) => void;
}

interface ResidentData {
  summary: ResidentSummaryResponseT['summary'] | null;
  context: ResidentContextT | null;
  push: ResidentPushSummaryT | null;
  decisions: ResidentDecisionT[] | null;
}

const QUICK_ACTIONS = [
  { label: 'Analyze Repository', intent: 'analyze' },
  { label: 'Implement Feature', intent: 'implement' },
  { label: 'Debug Issue', intent: 'debug' },
  { label: 'Improve Tests', intent: 'tests' },
  { label: 'Explain Code', intent: 'explain' },
  { label: 'Security Review', intent: 'security' },
  { label: 'Optimize Performance', intent: 'optimize' },
  { label: 'Add To Memory', intent: 'memory' }
];

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createResidentCore(parent: HTMLElement, store: Store<AppState>, opts: ResidentCoreOptions = {}): ResidentCoreHandles {
  parent.innerHTML = '';
  const root = el('div', 'cockpit-resident');

  const header = el('header', 'cockpit-resident-header');
  const titleRow = el('div', 'cockpit-resident-title-row');
  const title = el('h1', 'cockpit-resident-title', 'RESIDENT');
  const presence = el('div', 'cockpit-resident-presence');
  presence.dataset.authority = 'none';
  presence.dataset.presentationState = 'unknown';
  presence.setAttribute('role', 'img');
  presence.setAttribute('aria-label', 'Resident presentation seam; advisory only');
  presence.appendChild(el('span', 'cockpit-resident-presence-visor', '\u25c8'));
  presence.appendChild(el('span', 'cockpit-resident-presence-label', 'ADVISORY \u00b7 UNKNOWN'));
  const stateBadge = el('span', 'cockpit-resident-state', 'UNKNOWN');
  titleRow.appendChild(title);
  titleRow.appendChild(presence);
  titleRow.appendChild(stateBadge);
  header.appendChild(titleRow);
  header.appendChild(el('p', 'cockpit-resident-subtitle', 'Workspace advice and governed tasks · execution requires operator approval through Authority.'));
  root.appendChild(header);

  const residentWorkspace = el('div', 'cockpit-resident-workspace');
  const operatorMount = el('aside', 'cockpit-resident-operator-mount');
  const operator: OperatorIdentityHandles = createOperatorIdentity(operatorMount, { titleMount: titleRow });
  residentWorkspace.appendChild(operatorMount);

  const conversation = el('div', 'cockpit-resident-conversation');
  conversation.appendChild(el('div', 'cockpit-resident-empty', 'Loading Resident summary, context, workspace verdict, and decisions\u2026'));

  const chatMount = el('section', 'cockpit-resident-chat');
  const residentContent = el('div', 'cockpit-resident-content');
  residentContent.appendChild(conversation);
  residentContent.appendChild(chatMount);
  residentWorkspace.appendChild(residentContent);
  root.appendChild(residentWorkspace);

  const quickActions = el('div', 'cockpit-resident-quick');
  quickActions.appendChild(el('h2', 'cockpit-resident-section-title', 'QUICK ACTIONS'));
  quickActions.appendChild(el('p', 'cockpit-resident-maturity-note', 'GOVERNED TASKS · Cipher always uses his exact Liquid Resident binding; dispatch and each effect remain subject to Authority.'));
  const actionsRow = el('div', 'cockpit-resident-actions');
  for (const action of QUICK_ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cockpit-resident-action';
    btn.textContent = action.label;
    btn.disabled = true;
    btn.dataset.maturity = 'ADVISORY ONLY';
    btn.title = `ADVISORY ONLY: ${action.intent} is not connected to the Resident composer.`;
    btn.setAttribute('aria-label', `${action.label}; advisory only, unavailable`);
    actionsRow.appendChild(btn);
  }
  quickActions.appendChild(actionsRow);
  root.appendChild(quickActions);

  const composer = el('form', 'cockpit-resident-composer');
  composer.setAttribute('aria-label', 'Resident governed composer');
  composer.appendChild(el('div', 'cockpit-resident-composer-note', 'GOVERNED RESIDENT COMPOSER · requests enter the existing AgentLoop and remain subject to operator approval.'));
  const input = document.createElement('textarea');
  input.className = 'cockpit-resident-input';
  input.placeholder = 'Describe a task for the governed Resident workflow…';
  input.rows = 2;
  composer.appendChild(input);
  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.className = 'cockpit-resident-send';
  sendBtn.textContent = 'START GOVERNED TASK';
  composer.appendChild(sendBtn);
  const agentStatusMount = el('div', 'cockpit-resident-composer-status', 'No governed Resident task is running.');
  composer.appendChild(agentStatusMount);
  root.appendChild(composer);

  parent.appendChild(root);
  const chatPanel = createChatPanel(chatMount, opts.onToast === undefined ? {} : { onToast: opts.onToast });

  let alive = true;
  const presentationOwner = crypto.randomUUID();
  let projection: ResidentTaskProjection | undefined = store.get().residentTask;
  let busy = false;
  let epoch = 0;
  let pollTimer: number | null = null;
  let pollController: AbortController | null = null;
  let selectionController: AbortController | null = null;
  if (projection !== undefined) {
    projection = { ...projection, presentationOwner,
      phase: projection.phase === 'selecting' ? 'not_started' : projection.phase === 'starting' ? 'unknown' : projection.phase,
      message: projection.phase === 'selecting' ? 'Model selection interrupted before dispatch. Start a new task when ready.'
        : projection.phase === 'starting' ? 'Start outcome unknown · recover the same request before starting another task.' : projection.message };
    store.set(state => ({ ...state, residentTask: projection! }));
  }

  function ownsPresentation(ticket = epoch): boolean {
    return alive && ticket === epoch && (projection === undefined || store.get().residentTask?.presentationOwner === presentationOwner);
  }

  function save(next: ResidentTaskProjection): void {
    projection = next;
    store.set(state => ({ ...state, residentTask: next }));
  }

  function terminal(status: AgentStatusResponseT | null): boolean {
    return status !== null && ['done', 'error', 'aborted'].includes(status.state);
  }

  function blocksStart(): boolean {
    return busy || (projection !== undefined && projection.phase !== 'not_started'
      && !(projection.phase === 'session' && projection.message === null && terminal(projection.status)));
  }

  function stopAgentPolling(): void {
    if (pollTimer !== null) window.clearTimeout(pollTimer);
    pollTimer = null;
    pollController?.abort();
    pollController = null;
  }

  function paintAgentStatus(): void {
    const blocked = !ownsPresentation() || blocksStart();
    sendBtn.disabled = blocked;
    input.disabled = blocked;
    for (const button of actionsRow.querySelectorAll<HTMLButtonElement>('button')) button.disabled = blocked;
    agentStatusMount.innerHTML = '';
    const status = projection?.status ?? null;
    if (projection?.request.worker) agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `REQUESTED WORKER · ${projection.request.worker.worker}`));
    if (projection?.message) agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', projection.message));
    function action(label: string, run: () => Promise<void>, ariaLabel?: string): void {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'cockpit-resident-action'; button.textContent = label;
      button.disabled = busy || !ownsPresentation();
      if (ariaLabel !== undefined) button.setAttribute('aria-label', ariaLabel);
      button.addEventListener('click', () => { void run(); });
      agentStatusMount.appendChild(button);
    }
    if (projection?.phase === 'unknown') action('RECOVER START RESULT', recoverStart);
    if (projection?.sessionId && !busy) action('REFRESH TASK STATUS', pollAgent);
    if (status === null) {
      if (projection === undefined) agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', 'No governed Resident task is running.'));
      else if (projection.sessionId !== null) agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `SESSION ${projection.sessionId} · STATUS UNKNOWN`));
    } else {
    agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `SESSION ${status.session_id} · ${status.state.toUpperCase()} · ${status.mode.toUpperCase()}`));
    if (status.error !== null) agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `Agent error · ${status.error}`));
    if (status.pending_approval !== null && projection?.message === null) {
      const approval = status.pending_approval;
      agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `OPERATOR DECISION REQUIRED · ${approval.tool}`));
      const actions = el('div', 'cockpit-resident-actions');
      for (const decision of ['approve', 'reject'] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cockpit-resident-action';
        button.textContent = decision === 'approve' ? 'APPROVE ONCE' : 'REJECT';
        button.disabled = busy || !ownsPresentation();
        button.addEventListener('click', () => { void decideAgent(status.session_id, approval.approval_id, decision); });
        actions.appendChild(button);
      }
      agentStatusMount.appendChild(actions);
    }
    if (status.verification !== undefined) {
      agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `VERIFICATION · ${status.verification.state.toUpperCase()} · EXECUTION ${status.verification.execution.toUpperCase()}`));
    }
    }
    if (projection?.sessionId && (!terminal(status) || projection.message !== null)) {
      const id = projection.sessionId;
      action('STOP TASK', () => cancelAgent(id), 'Stop the running governed Resident task');
    }
  }

  async function pollAgent(): Promise<void> {
    if (!ownsPresentation() || busy || projection?.sessionId == null) return;
    stopAgentPolling();
    const id = projection.sessionId;
    const ticket = ++epoch;
    pollController = new AbortController();
    const signal = AbortSignal.any([pollController.signal, AbortSignal.timeout(10000)]);
    try {
      const query = AgentStatusQuery.parse({ id });
      const status = await call('/api/agent/status', { query, schema: AgentStatusResponse, signal });
      if (!ownsPresentation(ticket) || projection.sessionId !== id) return;
      if (status.session_id !== id || (status.pending_approval !== null && status.pending_approval.session_id !== id)) throw new Error('task response identity mismatch');
      save({ ...projection, status, message: null });
      if (!terminal(status)) {
        pollTimer = window.setTimeout(() => { void pollAgent(); }, 1000);
      }
    } catch (error) {
      if (ownsPresentation(ticket)) save({ ...projection, message: `Resident task status unavailable · ${String((error as Error).message ?? error).slice(0, 180)}` });
    } finally {
      if (ownsPresentation(ticket)) { pollController = null; paintAgentStatus(); }
    }
  }

  async function taskAction(id: string, run: () => Promise<unknown>, label: string): Promise<void> {
    if (!ownsPresentation() || busy || projection?.sessionId !== id) return;
    stopAgentPolling();
    const ticket = ++epoch;
    busy = true;
    paintAgentStatus();
    try {
      await run();
      if (!ownsPresentation(ticket) || projection.sessionId !== id) return;
      busy = false;
      await pollAgent(); // Cancellation acknowledgement alone never proves stop.
    } catch (error) {
      if (ownsPresentation(ticket)) {
        busy = false;
        save({ ...projection, message: `${label} failed · ${String((error as Error).message ?? error).slice(0, 180)}` });
        paintAgentStatus();
      }
    }
  }

  async function decideAgent(id: string, approvalId: string, decision: 'approve' | 'reject'): Promise<void> {
    await taskAction(id, () => call('/api/agent/decision', { method: 'POST', body: AgentDecisionRequest.parse({ session_id: id, approval_id: approvalId, decision }), schema: AgentDecisionResponse }), 'Resident decision');
  }

  async function cancelAgent(id: string): Promise<void> {
    await taskAction(id, () => call('/api/agent/cancel', { method: 'POST', body: AgentCancelRequest.parse({ session_id: id }), schema: AgentCancelResponse }), 'Resident cancellation');
  }

  async function recoverStart(): Promise<void> {
    if (!ownsPresentation() || busy || projection?.phase !== 'unknown') return;
    stopAgentPolling();
    const ticket = ++epoch;
    const request = projection.request;
    busy = true;
    save({ ...projection, phase: 'starting', message: 'Preparing or recovering the same governed task · operator approval may be requested…' });
    paintAgentStatus();
    try {
      const started = await call('/api/agent/start', { method: 'POST', body: request, schema: AgentStartResponse });
      if (!ownsPresentation(ticket)) return;
      save({ ...projection, phase: 'session', sessionId: started.session_id, status: null, message: null });
      busy = false;
      await pollAgent();
    } catch (error) {
      if (!ownsPresentation(ticket)) return;
      const detail = error instanceof ApiError ? error.detail as { start_outcome?: unknown; request_id?: unknown } | undefined : undefined;
      const notStarted = detail?.start_outcome === 'not_started' && detail.request_id === request.client_request_id;
      busy = false;
      save({ ...projection, phase: notStarted ? 'not_started' : 'unknown', message: `${notStarted ? 'Start refused before dispatch' : 'Start outcome unknown · recover the same request'} · ${String((error as Error).message ?? error).slice(0, 180)}` });
      paintAgentStatus();
    }
  }

  async function startAgent(task: string): Promise<void> {
    const trimmed = task.trim();
    if (!ownsPresentation() || blocksStart() || trimmed.length === 0) return;
    const parsed = AgentStartRequest.safeParse({ task: trimmed, mode: 'act', client_request_id: crypto.randomUUID() });
    if (!parsed.success) { opts.onToast?.('BAD_REQUEST', 'Task must contain 1–8000 characters.'); return; }
    const ticket = ++epoch;
    const controller = new AbortController();
    selectionController = controller;
    const deadline = window.setTimeout(() => controller.abort(), 10000);
    busy = true;
    save({ presentationOwner, request: parsed.data, phase: 'selecting', sessionId: null, status: null, message: 'Checking Cipher’s canonical Resident binding and exact Liquid readiness…' });
    paintAgentStatus();
    try {
      const [binding, view, routes] = await Promise.all([
        call('/api/resident/binding', { schema: ResidentBinding, signal: controller.signal }),
        api.modelManager(controller.signal),
        api.routes()
      ]);
      if (!ownsPresentation(ticket)) return;
      const worker = residentWorkerForBinding(binding, view, routes);
      const request = AgentStartRequest.parse({ ...parsed.data, worker, chat_source: worker.provider === 'local' ? 'local' : 'provider' });
      busy = false;
      save({ ...projection!, request, phase: 'unknown', message: null });
      await recoverStart();
    } catch (error) {
      if (!ownsPresentation(ticket)) return;
      busy = false;
      save({ ...projection!, phase: 'not_started', message: `Worker selection unavailable before dispatch · ${String((error as Error).message ?? error).slice(0, 220)}` });
      paintAgentStatus();
    } finally {
      window.clearTimeout(deadline);
      if (selectionController === controller) selectionController = null;
    }
  }

  composer.addEventListener('submit', event => {
    event.preventDefault();
    void startAgent(input.value);
  });

  for (const [button, action] of actionsRow.querySelectorAll<HTMLButtonElement>('button').entries()) {
    const intent = QUICK_ACTIONS[button]?.intent;
    if (intent === undefined) continue;
    const label = QUICK_ACTIONS[button]?.label ?? intent;
    const quickButton = action;
    quickButton.disabled = false;
    quickButton.dataset.maturity = 'GOVERNED';
    quickButton.title = `Start a governed Resident task: ${label}`;
    quickButton.setAttribute('aria-label', `${label}; starts a governed Resident task`);
    quickButton.addEventListener('click', () => { void startAgent(`${label} for the current workspace.`); });
  }
  paintAgentStatus();
  if (projection?.phase === 'session') void pollAgent();

  async function loadSummary(): Promise<ResidentSummaryResponseT['summary'] | null> {
    try { return (await api.residentSummary()).summary; }
    catch { return null; }
  }
  async function loadContext(): Promise<ResidentContextT | null> {
    try { return (await api.residentContext()).context; }
    catch { return null; }
  }
  async function loadPush(): Promise<ResidentPushSummaryT | null> {
    try { return (await api.residentPush()).push; }
    catch { return null; }
  }
  async function loadDecisions(): Promise<ResidentDecisionT[] | null> {
    try { return (await api.residentDecisions(10)).decisions; }
    catch { return null; }
  }

  function paintStateBadge(data: ResidentData): void {
    let label = 'UNKNOWN';
    let cls = 'cockpit-resident-state-dim';
    if (data.push !== null) {
      if (data.push.verdict === 'READY') { label = 'READY'; cls = 'cockpit-resident-state-ok'; }
      else if (data.push.verdict === 'ATTENTION_REQUIRED') { label = 'ATTENTION'; cls = 'cockpit-resident-state-warn'; }
    } else if (data.summary !== null) {
      label = data.summary.status === 'ready' ? 'READY' : 'ATTENTION';
      cls = data.summary.status === 'ready' ? 'cockpit-resident-state-ok' : 'cockpit-resident-state-warn';
    } else if (data.context !== null || data.decisions !== null) {
      label = 'DEGRADED';
      cls = 'cockpit-resident-state-warn';
    } else {
      label = 'UNAVAILABLE';
    }
    stateBadge.textContent = label;
    stateBadge.className = `cockpit-resident-state ${cls}`;
    presence.dataset.presentationState = label.toLowerCase();
    const presenceLabel = presence.querySelector<HTMLElement>('.cockpit-resident-presence-label');
    if (presenceLabel !== null) presenceLabel.textContent = `ADVISORY \u00b7 ${label}`;
    const operatorState: OperatorPresenceState = label === 'READY'
      ? 'idle'
      : label === 'ATTENTION'
        ? 'attention'
        : label === 'DEGRADED' || label === 'UNAVAILABLE'
          ? 'unavailable'
          : 'unknown';
    operator.setPresentationState(operatorState);
  }

  function paintConversation(data: ResidentData): void {
    conversation.innerHTML = '';
    if (data.summary !== null) {
      const summary = el('section', 'cockpit-resident-summary');
      summary.appendChild(el('h2', 'cockpit-resident-section-title', 'RESIDENT SUMMARY'));
      summary.appendChild(el('div', 'cockpit-resident-recommendation', data.summary.recommendation));
      const details = el('div', 'cockpit-resident-summary-grid');
      details.appendChild(el('div', 'cockpit-resident-summary-item', `Workspace \u00b7 ${data.summary.workspace}`));
      details.appendChild(el('div', 'cockpit-resident-summary-item', `Project \u00b7 ${data.summary.projectType}`));
      details.appendChild(el('div', 'cockpit-resident-summary-item', `Git \u00b7 ${data.summary.git.git_repo ? `${data.summary.git.branch ?? 'detached'} \u00b7 ${data.summary.git.clean ? 'clean' : `${data.summary.git.changes} working-tree changes`}` : 'not a repository'}`));
      details.appendChild(el('div', 'cockpit-resident-summary-item', `LSP \u00b7 ${data.summary.lsp.available ? 'available' : 'unavailable'}`));
      details.appendChild(el('div', 'cockpit-resident-summary-item', `Model \u00b7 ${data.summary.model.runtime_available ? `${data.summary.model.ready_count} active` : 'unavailable'}`));
      details.appendChild(el('div', 'cockpit-resident-summary-item', `Tests \u00b7 ${data.summary.hasTestScript ? 'script present' : 'not detected'}`));
      summary.appendChild(details);
      conversation.appendChild(summary);
    } else {
      conversation.appendChild(el('div', 'cockpit-resident-empty', 'Resident summary unavailable \u00b7 GET /api/resident/summary failed.'));
    }

    if (data.context !== null) {
      const context = el('section', 'cockpit-resident-context');
      context.appendChild(el('h2', 'cockpit-resident-section-title', 'WORKSPACE CONTEXT'));
      context.appendChild(el('div', 'cockpit-resident-context-line', data.context.git_status));
      context.appendChild(el('div', 'cockpit-resident-context-line', data.context.model_status));
      if (data.context.changed_files.length > 0) context.appendChild(el('div', 'cockpit-resident-context-line', `${data.context.changed_files.length} changed file(s) in context`));
      if (data.context.diagnostics.length > 0) context.appendChild(el('div', 'cockpit-resident-context-line', `${data.context.diagnostics.length} diagnostic(s) in context`));
      conversation.appendChild(context);
    } else {
      conversation.appendChild(el('div', 'cockpit-resident-empty', 'Resident context unavailable \u00b7 GET /api/resident/context failed.'));
    }

    if (data.push !== null) {
      const push = el('section', `cockpit-resident-push cockpit-resident-push-${data.push.verdict === 'READY' ? 'ok' : 'warn'}`);
      push.appendChild(el('h2', 'cockpit-resident-section-title', `WORKSPACE VERDICT \u00b7 ${data.push.verdict}`));
      if (data.push.reasons.length > 0) {
        const reasons = el('ul', 'cockpit-resident-reason-list');
        for (const reason of data.push.reasons.slice(0, 6)) reasons.appendChild(el('li', 'cockpit-resident-reason', reason));
        push.appendChild(reasons);
      }
      conversation.appendChild(push);
    } else {
      conversation.appendChild(el('div', 'cockpit-resident-empty', 'Workspace verdict unavailable \u00b7 GET /api/resident/push-summary failed.'));
    }

    if (data.decisions !== null && data.decisions.length > 0) {
      const recent = el('section', 'cockpit-resident-decisions');
      recent.appendChild(el('h2', 'cockpit-resident-section-title', 'RECENT DECISIONS'));
      const list = el('ol', 'cockpit-resident-decision-list');
      for (const d of data.decisions.slice(0, 8)) {
        const li = document.createElement('li');
        li.className = `cockpit-resident-decision cockpit-resident-decision-${d.severity}`;
        li.appendChild(el('span', 'cockpit-resident-decision-sev', d.severity.toUpperCase()));
        li.appendChild(el('span', 'cockpit-resident-decision-msg', d.message));
        if (d.recommendation.length > 0) li.appendChild(el('div', 'cockpit-resident-decision-reco', `\u2192 ${d.recommendation}`));
        list.appendChild(li);
      }
      recent.appendChild(list);
      conversation.appendChild(recent);
    } else if (data.decisions !== null) {
      conversation.appendChild(el('div', 'cockpit-resident-empty', 'No recent Resident decisions on the audit bus.'));
    } else {
      conversation.appendChild(el('div', 'cockpit-resident-empty', 'Resident decisions unavailable \u00b7 GET /api/resident/decisions failed.'));
    }
  }

  async function refresh(): Promise<void> {
    if (!alive) return;
    const [summary, context, push, decisions] = await Promise.all([loadSummary(), loadContext(), loadPush(), loadDecisions()]);
    if (!alive) return;
    const data: ResidentData = { summary, context, push, decisions };
    paintStateBadge(data);
    paintConversation(data);
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 8000);

  return {
    root,
    refresh,
    dispose() {
      alive = false;
      selectionController?.abort();
      stopAgentPolling();
      window.clearInterval(interval);
      chatPanel.dispose();
      operator.dispose();
      parent.innerHTML = '';
    }
  };
}
