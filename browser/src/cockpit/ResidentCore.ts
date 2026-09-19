// Resident Core — advisory workspace projection.
//
// This surface consumes Resident evidence and the existing model-chat surface.
// It owns no execution authority, H2 state, provider capability, or verifier
// truth. Every unavailable endpoint remains independently visible.

import type { Store } from '../store/store.ts';
import { productText } from '../ui/product-text.ts';
import type { AppState } from '../store/state.ts';
import { api, call } from '../services/api.ts';
import { createChatPanel } from '../chat/chat.ts';
import { createOperatorIdentity, type OperatorIdentityHandles, type OperatorPresenceState } from './OperatorIdentity.ts';
import {
  AgentDecisionRequest,
  AgentDecisionResponse,
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

export function createResidentCore(parent: HTMLElement, _store: Store<AppState>, opts: ResidentCoreOptions = {}): ResidentCoreHandles {
  parent.innerHTML = '';
  const root = el('div', 'cockpit-resident');
  root.dataset.authority = 'none';

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
  header.appendChild(el('p', 'cockpit-resident-subtitle', 'Your persistent development partner. Context, conversation, and governed work.'));
  root.appendChild(header);

  const residentWorkspace = el('div', 'cockpit-resident-workspace');
  const operatorMount = el('aside', 'cockpit-resident-operator-mount');
  const operator: OperatorIdentityHandles = createOperatorIdentity(operatorMount);

  const conversation = el('div', 'cockpit-resident-conversation');
  conversation.appendChild(el('div', 'cockpit-resident-empty', 'Loading Resident summary, context, workspace verdict, and decisions\u2026'));

  const chatMount = el('section', 'cockpit-resident-chat');
  const residentContent = el('div', 'cockpit-resident-content');
  const welcome = el('div', 'cockpit-resident-welcome');
  welcome.appendChild(el('span', 'cockpit-eyebrow', 'YOUR MODELS. YOUR MACHINE. YOUR WORKFLOW.'));
  welcome.appendChild(el('h2', '', 'What are we building?'));
  welcome.appendChild(el('p', '', 'Explore an idea, inspect your workspace, or prepare a task. You review the actions. Covert keeps the evidence.'));
  residentContent.appendChild(welcome);
  residentContent.appendChild(chatMount);
  residentWorkspace.appendChild(residentContent);
  root.appendChild(residentWorkspace);

  const quickActions = el('div', 'cockpit-resident-quick');
  quickActions.appendChild(el('h2', 'cockpit-resident-section-title', 'PREPARE A TASK'));
  quickActions.appendChild(el('p', 'cockpit-resident-maturity-note', 'Choose a starting point, review the task, then submit it. Execution remains subject to operator approval.'));
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
  input.setAttribute('aria-label', 'Governed Resident task');
  input.rows = 2;
  composer.appendChild(input);
  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.className = 'cockpit-resident-send';
  sendBtn.textContent = 'START GOVERNED TASK';
  sendBtn.disabled = true;
  composer.appendChild(sendBtn);
  const agentStatusMount = el('div', 'cockpit-resident-composer-status', 'No governed Resident task is running.');
  composer.appendChild(agentStatusMount);
  root.appendChild(composer);

  const modeBar = el('div', 'cockpit-resident-modes');
  modeBar.setAttribute('aria-label', 'Resident interaction');
  const chatMode = el('button', 'cockpit-mode', 'CONVERSATION') as HTMLButtonElement;
  const taskMode = el('button', 'cockpit-mode', 'GOVERNED TASK') as HTMLButtonElement;
  chatMode.type = taskMode.type = 'button';
  const setMode = (task: boolean): void => {
    chatMount.hidden = task;
    composer.hidden = !task;
    chatMode.setAttribute('aria-pressed', String(!task));
    taskMode.setAttribute('aria-pressed', String(task));
  };
  chatMode.addEventListener('click', () => setMode(false));
  taskMode.addEventListener('click', () => { setMode(true); input.focus(); });
  modeBar.append(chatMode, taskMode);
  header.appendChild(modeBar);
  setMode(false);
  const contextDisclosure = document.createElement('details');
  contextDisclosure.className = 'cockpit-context-disclosure';
  contextDisclosure.appendChild(el('summary', '', 'Workspace context & evidence'));
  contextDisclosure.appendChild(conversation);
  root.appendChild(contextDisclosure);
  const appearanceDisclosure = document.createElement('details');
  appearanceDisclosure.className = 'cockpit-appearance-disclosure';
  appearanceDisclosure.appendChild(el('summary', '', 'Appearance preferences · optional artwork unavailable'));
  appearanceDisclosure.appendChild(operatorMount);
  root.appendChild(appearanceDisclosure);

  parent.appendChild(root);
  createChatPanel(chatMount, opts.onToast === undefined ? {} : { onToast: opts.onToast });

  let alive = true;
  let activeSessionId: string | null = null;
  let activeStatus: AgentStatusResponseT | null = null;
  let pollTimer: number | null = null;
  let starting = false;
  const taskActive = (): boolean => activeStatus?.state === 'running' || activeStatus?.state === 'awaiting_approval';
  input.addEventListener('input', () => { sendBtn.disabled = starting || taskActive() || input.value.trim().length === 0; });

  function stopAgentPolling(): void {
    if (pollTimer !== null) window.clearTimeout(pollTimer);
    pollTimer = null;
  }

  function paintAgentStatus(status: AgentStatusResponseT | null, message?: string): void {
    agentStatusMount.innerHTML = '';
    if (message !== undefined) {
      agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', message));
      if (activeSessionId !== null) {
        const retry = el('button', 'cockpit-mode', 'REFRESH TASK STATE') as HTMLButtonElement;
        retry.type = 'button';
        retry.addEventListener('click', () => { retry.disabled = true; stopAgentPolling(); void pollAgent(); });
        agentStatusMount.appendChild(retry);
      }
      return;
    }
    if (status === null) {
      agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', 'No governed Resident task is running.'));
      return;
    }
    agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `SESSION ${status.session_id} · ${status.state.toUpperCase()} · ${status.mode.toUpperCase()}`));
    if (status.error !== null) agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `Agent error · ${status.error}`));
    if (status.pending_approval !== null) {
      const approval = status.pending_approval;
      agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `OPERATOR DECISION REQUIRED · ${approval.tool}`));
      const actions = el('div', 'cockpit-resident-actions');
      for (const decision of ['approve', 'reject', 'abort'] as const) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cockpit-resident-action';
        button.textContent = decision === 'approve' ? 'APPROVE ONCE' : decision === 'abort' ? 'ABORT TASK' : 'REJECT';
        button.addEventListener('click', () => { void decideAgent(approval.approval_id, decision); });
        actions.appendChild(button);
      }
      agentStatusMount.appendChild(actions);
    }
    if (status.verification !== undefined) {
      agentStatusMount.appendChild(el('div', 'cockpit-resident-composer-note', `VERIFICATION · ${status.verification.state.toUpperCase()} · EXECUTION ${status.verification.execution.toUpperCase()}`));
    }
  }

  async function pollAgent(): Promise<void> {
    if (!alive || activeSessionId === null) return;
    try {
      const query = AgentStatusQuery.parse({ id: activeSessionId });
      activeStatus = await call('/api/agent/status', { query, schema: AgentStatusResponse });
      paintAgentStatus(activeStatus);
      sendBtn.disabled = taskActive() || input.value.trim().length === 0;
      if (activeStatus.state === 'running' || activeStatus.state === 'awaiting_approval') {
        pollTimer = window.setTimeout(() => { void pollAgent(); }, 1000);
      } else {
        pollTimer = null;
      }
    } catch (error) {
      paintAgentStatus(null, `Resident task status unavailable · ${String((error as Error).message ?? error).slice(0, 180)}`);
      pollTimer = null;
    }
  }

  async function decideAgent(approvalId: string, decision: 'approve' | 'reject' | 'abort'): Promise<void> {
    if (activeSessionId === null) return;
    try {
      const body = AgentDecisionRequest.parse({ session_id: activeSessionId, approval_id: approvalId, decision });
      await call('/api/agent/decision', { method: 'POST', body, schema: AgentDecisionResponse });
      await pollAgent();
    } catch (error) {
      paintAgentStatus(activeStatus, `Resident decision failed · ${String((error as Error).message ?? error).slice(0, 180)}`);
    }
  }

  async function startAgent(task: string): Promise<void> {
    const trimmed = task.trim();
    if (!alive || starting || trimmed.length === 0 || activeStatus?.state === 'running' || activeStatus?.state === 'awaiting_approval') return;
    starting = true;
    stopAgentPolling();
    activeSessionId = null;
    activeStatus = null;
    sendBtn.disabled = true;
    input.disabled = true;
    paintAgentStatus(null, 'Preparing governed Resident task · operator approval may be requested…');
    try {
      const body = AgentStartRequest.parse({ task: trimmed, mode: 'act', chat_source: 'local' });
      const started = await call('/api/agent/start', { method: 'POST', body, schema: AgentStartResponse });
      activeSessionId = started.session_id;
      await pollAgent();
    } catch (error) {
      paintAgentStatus(null, `Resident task was not started · ${String((error as Error).message ?? error).slice(0, 180)}`);
    } finally {
      starting = false;
      sendBtn.disabled = taskActive() || input.value.trim().length === 0;
      input.disabled = false;
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
    quickButton.title = `Prepare a task: ${label}`;
    quickButton.setAttribute('aria-label', `${label}; prepares a task for review`);
    quickButton.addEventListener('click', () => {
      setMode(true);
      input.value = `${label} for the current workspace.`;
      sendBtn.disabled = starting || taskActive();
      input.focus();
    });
  }

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
      summary.appendChild(el('div', 'cockpit-resident-recommendation', productText(data.summary.recommendation)));
      const details = el('div', 'cockpit-resident-summary-grid');
      details.appendChild(el('div', 'cockpit-resident-summary-item', `Workspace \u00b7 ${data.summary.workspace.split(/[\\/]/).filter(Boolean).pop() ?? 'local workspace'}`));
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
      stopAgentPolling();
      window.clearInterval(interval);
      operator.dispose();
      parent.innerHTML = '';
    }
  };
}
