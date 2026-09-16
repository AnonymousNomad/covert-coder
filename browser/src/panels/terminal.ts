// Slice 3 — TERMINAL panel
// Shows recent task jobs (read-only). No execution authority here.
// The terminal/run POST endpoint exists but is operator-gated and not
// driven by this panel. Today this surface is a viewer.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { TaskStatusResponseT, TaskJobT } from '../../../common/contracts/tasks.ts';

export interface PanelHandles {
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusClass(status: TaskJobT['status']): string {
  if (status === 'running') return 'running';
  if (status === 'failed' || status === 'stopped') return 'err';
  if (status === 'exited') return 'ok';
  return 'dim';
}

export function createTerminalPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content terminal-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'TERMINAL'));
  header.appendChild(el('span', 'panel-maturity', 'EXPERIMENTAL'));
  root.appendChild(header);
  const intro = el('div', 'panel-intro', 'Recent task jobs. Read-only projection of /api/tasks/status. Command execution is operator-gated and is not wired into this cockpit surface.');
  root.appendChild(intro);
  const body = el('div', 'terminal-body');
  root.appendChild(body);
  parent.appendChild(root);

  let alive = true;

  function renderJob(j: TaskJobT): HTMLElement {
    const card = el('div', `terminal-job ${statusClass(j.status)}`);
    const head = el('div', 'terminal-job-head');
    head.appendChild(el('span', 'terminal-job-label', j.label));
    head.appendChild(el('span', `terminal-job-status ${statusClass(j.status)}`, j.status.toUpperCase()));
    if (j.exitCode !== null) head.appendChild(el('span', 'terminal-job-exit', `exit ${j.exitCode}`));
    card.appendChild(head);
    card.appendChild(el('div', 'terminal-job-cmd', `${j.command}${j.args.length > 0 ? ' ' + j.args.join(' ') : ''}`));
    const meta = el('div', 'terminal-job-meta');
    meta.appendChild(el('span', 'terminal-job-meta-item', `job_id=${j.job_id}`));
    meta.appendChild(el('span', 'terminal-job-meta-item', `started=${new Date(j.startedAt).toISOString()}`));
    if (j.endedAt !== null) meta.appendChild(el('span', 'terminal-job-meta-item', `ended=${new Date(j.endedAt).toISOString()}`));
    card.appendChild(meta);
    return card;
  }

  async function refresh(): Promise<void> {
    if (!alive) return;
    body.innerHTML = '<div class="panel-loading">Loading task status\u2026</div>';
    let res: TaskStatusResponseT;
    try {
      res = await api.tasksStatus();
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(el('div', 'panel-error', `Failed to load: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    body.innerHTML = '';
    if (res.jobs.length === 0) {
      body.appendChild(el('div', 'panel-empty', 'No task history. Invoke a backend command only through the operator-gated POST /api/terminal/run flow.'));
      return;
    }
    const counts = el('div', 'terminal-counts');
    counts.appendChild(el('span', 'terminal-counts-value', `${res.jobs.length} JOB${res.jobs.length === 1 ? '' : 'S'} RECORDED`));
    body.appendChild(counts);
    const list = el('div', 'terminal-job-list');
    for (const j of res.jobs.slice(0, 50)) list.appendChild(renderJob(j));
    body.appendChild(list);
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 5000);

  return {
    dispose() {
      alive = false;
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
