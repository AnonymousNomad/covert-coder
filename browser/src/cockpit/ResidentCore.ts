// Resident Core — advisory workspace projection.
//
// This surface consumes Resident evidence and the existing model-chat surface.
// It owns no execution authority, H2 state, provider capability, or verifier
// truth. Every unavailable endpoint remains independently visible.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import { createChatPanel } from '../chat/chat.ts';
import { createOperatorIdentity, type OperatorIdentityHandles, type OperatorPresenceState } from './OperatorIdentity.ts';
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
  header.appendChild(el('p', 'cockpit-resident-subtitle', 'Your development partner \u2014 read-only projection. Agent routes exist, but this surface does not grant execution authority.'));
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
  quickActions.appendChild(el('p', 'cockpit-resident-maturity-note', 'ADVISORY ONLY \u00b7 actions are visible for the approved cockpit language but are not connected to a lawful Resident composer path.'));
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
  composer.setAttribute('aria-label', 'Resident composer unavailable');
  composer.appendChild(el('div', 'cockpit-resident-composer-note', 'Agent routes exist, but the Resident cockpit does not yet possess a lawful execution/composer integration.'));
  const input = document.createElement('textarea');
  input.className = 'cockpit-resident-input';
  input.placeholder = 'Resident composer unavailable in this phase.';
  input.rows = 2;
  input.disabled = true;
  composer.appendChild(input);
  const sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.className = 'cockpit-resident-send';
  sendBtn.textContent = 'COMPOSER UNAVAILABLE';
  sendBtn.disabled = true;
  composer.appendChild(sendBtn);
  root.appendChild(composer);

  parent.appendChild(root);
  createChatPanel(chatMount, opts.onToast === undefined ? {} : { onToast: opts.onToast });

  let alive = true;

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
      details.appendChild(el('div', 'cockpit-resident-summary-item', `Model \u00b7 ${data.summary.model.runtime_available ? `${data.summary.model.ready_count} ready` : 'unavailable'}`));
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
      window.clearInterval(interval);
      operator.dispose();
      parent.innerHTML = '';
    }
  };
}
