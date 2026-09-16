// Slice 3 — COMMAND CENTER panel
// The operator's home surface. Aggregates real backend state into a
// single dashboard. Read-only. No execution authority.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { HealthResponseT } from '../../../common/contracts/health.ts';
import type { ModelStatusResponseT } from '../../../common/contracts/models.ts';
import type { ResidentSummaryResponseT, ResidentPushSummaryT } from '../../../common/contracts/resident.ts';

import type { ByokStatusResponseT } from '../../../common/contracts/byok.ts';
import type { ClosedLoopStatusT } from '../../../common/contracts/closed-loop.ts';
import type { TaskStatusResponseT } from '../../../common/contracts/tasks.ts';

export interface PanelHandles {
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createCommandCenterPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content command-center-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'COMMAND CENTER'));
  header.appendChild(el('span', 'panel-maturity', 'AVAILABLE'));
  root.appendChild(header);
  const intro = el('div', 'panel-intro', 'Operator home. Aggregated, read-only state of the workspace, models, Resident, Git, verification, harness, and recent activity. No execution authority.');
  root.appendChild(intro);
  const grid = el('div', 'cc-grid');
  root.appendChild(grid);
  parent.appendChild(root);

  let alive = true;

  function clearGrid(): void {
    grid.innerHTML = '';
  }

  function tile(title: string, content: HTMLElement, status: 'ok' | 'warn' | 'err' | 'dim'): HTMLElement {
    const t = el('section', `cc-tile cc-tile-${status}`);
    const h = el('h3', 'cc-tile-title', title);
    t.appendChild(h);
    t.appendChild(content);
    return t;
  }

  function section(content: HTMLElement[]): HTMLElement {
    const s = el('div', 'cc-section');
    for (const c of content) s.appendChild(c);
    return s;
  }

  function kv(label: string, value: string): HTMLElement {
    const row = el('div', 'cc-kv');
    row.appendChild(el('span', 'cc-kv-key', label));
    row.appendChild(el('span', 'cc-kv-value', value));
    return row;
  }

  function pill(text: string, status: 'ok' | 'warn' | 'err' | 'dim'): HTMLElement {
    return el('span', `cc-pill cc-pill-${status}`, text);
  }

  function renderProject(health: HealthResponseT | null, summary: ResidentSummaryResponseT['summary'] | null): HTMLElement {
    const content = el('div', 'cc-tile-content');
    if (health === null) {
      content.appendChild(el('div', 'cc-missing', 'Health endpoint unavailable.'));
      return tile('DAEMON', content, 'err');
    }
    const sec = section([
      kv('Daemon', `v${health.version}`),
      kv('Workspace', health.workspace),
      kv('Uptime', `${Math.round(health.uptimeMs / 1000)}s`),
      kv('Free memory', `${health.freeMemoryMB} MB`)
    ]);
    if (summary !== null) {
      sec.appendChild(kv('Project type', summary.projectType));
      sec.appendChild(kv('Test script', summary.hasTestScript ? 'present' : 'absent'));
      sec.appendChild(kv('Node', summary.nodeVersion));
    }
    content.appendChild(sec);
    return tile('DAEMON + PROJECT', content, 'ok');
  }

  function renderModels(status: ModelStatusResponseT | null): HTMLElement {
    const content = el('div', 'cc-tile-content');
    if (status === null) {
      content.appendChild(el('div', 'cc-missing', 'Model status endpoint unavailable.'));
      return tile('MODELS', content, 'err');
    }
    const ready = status.models.filter(m => (m.status === 'ready' || m.status === 'running') && m.runtime_available && m.artifact_available);
    const total = status.models.length;
    const readyCount = ready.length;
    const sec = section([
      kv('Runtime available', status.runtime ? 'yes' : 'no'),
      kv('Ready', `${readyCount} of ${total}`)
    ]);
    if (total > 0) {
      const list = el('ul', 'cc-model-list');
      for (const m of status.models.slice(0, 6)) {
        const ready = (m.status === 'ready' || m.status === 'running') && m.runtime_available && m.artifact_available;
        const li = el('li', 'cc-model-item');
        li.appendChild(pill(m.status, ready ? 'ok' : m.status === 'error' ? 'err' : 'dim'));
        li.appendChild(el('span', 'cc-model-name', m.name));
        list.appendChild(li);
      }
      sec.appendChild(list);
    }
    content.appendChild(sec);
    return tile('MODELS', content, total === 0 ? 'err' : readyCount > 0 ? 'ok' : 'warn');
  }

  function renderResident(summary: ResidentSummaryResponseT['summary'] | null, push: ResidentPushSummaryT | null): HTMLElement {
    const content = el('div', 'cc-tile-content');
    if (summary === null && push === null) {
      content.appendChild(el('div', 'cc-missing', 'Resident endpoints unavailable.'));
      return tile('RESIDENT', content, 'err');
    }
    const sec = section([]);
    if (push !== null) {
      sec.appendChild(kv('Push verdict', push.verdict));
      if (push.reasons.length > 0) {
        const reasons = el('ul', 'cc-reason-list');
        for (const r of push.reasons.slice(0, 3)) reasons.appendChild(el('li', 'cc-reason', r));
        sec.appendChild(reasons);
      }
    }
    if (summary !== null) {
      const actionables = summary.conditions.filter(c => c.severity !== 'info');
      sec.appendChild(kv('Actionable conditions', `${actionables.length}`));
      if (actionables.length > 0) {
        const list = el('ul', 'cc-condition-list');
        for (const c of actionables.slice(0, 3)) {
          const li = el('li', `cc-condition cc-condition-${c.severity}`);
          li.appendChild(el('span', `cc-condition-sev cc-condition-sev-${c.severity}`, c.severity.toUpperCase()));
          li.appendChild(el('span', 'cc-condition-msg', c.message));
          list.appendChild(li);
        }
        sec.appendChild(list);
      }
      sec.appendChild(kv('Recommendation', summary.recommendation.slice(0, 120)));
    }
    content.appendChild(sec);
    const status = push === null ? 'dim' : push.verdict === 'READY' ? 'ok' : 'warn';
    return tile('RESIDENT', content, status);
  }

  function renderGit(summary: ResidentSummaryResponseT['summary'] | null): HTMLElement {
    const content = el('div', 'cc-tile-content');
    if (summary === null) {
      content.appendChild(el('div', 'cc-missing', 'Resident summary unavailable.'));
      return tile('GIT', content, 'err');
    }
    const g = summary.git;
    const sec = section([
      kv('Repo', g.git_repo ? `${g.branch ?? 'detached'}` : 'not a repo'),
      kv('Status', g.git_repo ? (g.clean ? 'clean' : `${g.changes} changes`) : '\u2014'),
      kv('Conflicts', `${g.conflicts}`),
      kv('Ahead/Behind', `${g.ahead}/${g.behind}`)
    ]);
    content.appendChild(sec);
    const status = !g.git_repo ? 'dim' : g.conflicts > 0 ? 'err' : g.clean ? 'ok' : 'warn';
    return tile('GIT', content, status);
  }

  function renderCloud(byok: ByokStatusResponseT | null): HTMLElement {
    const content = el('div', 'cc-tile-content');
    if (byok === null) {
      content.appendChild(el('div', 'cc-missing', 'BYOK endpoint unavailable.'));
      return tile('CLOUD / NETWORK', content, 'err');
    }
    const withKey = byok.providers.filter(p => p.key_stored).length;
    const sec = section([
      kv('BYOK consent', byok.consent_enabled ? 'enabled' : 'disabled'),
      kv('Providers configured', `${byok.providers.length}`),
      kv('With stored credential', `${withKey}`)
    ]);
    content.appendChild(sec);
    const status = !byok.consent_enabled ? 'ok' : withKey > 0 ? 'warn' : 'warn';
    return tile('CLOUD / NETWORK', content, status);
  }

  function renderHarness(harness: ClosedLoopStatusT | null): HTMLElement {
    const content = el('div', 'cc-tile-content');
    if (harness === null) {
      content.appendChild(el('div', 'cc-missing', 'Closed-loop endpoint unavailable.'));
      return tile('HARNESS', content, 'err');
    }
    const sec = section([
      kv('Configured', harness.enabled ? 'enabled' : 'disabled'),
      kv('Live state', harness.enabled ? 'ENABLED (not ON)' : 'STANDBY'),
      kv('Last run logged', harness.last_run_logged_at ?? 'never'),
      kv('Signal files', `${harness.signal_file_count}`),
      kv('Bus events', `${harness.bus_event_count}`)
    ]);
    content.appendChild(sec);
    return tile('HARNESS', content, 'dim');
  }

  function renderVerification(push: ResidentPushSummaryT | null): HTMLElement {
    const content = el('div', 'cc-tile-content');
    if (push === null) {
      content.appendChild(el('div', 'cc-missing', 'Resident push unavailable.'));
      return tile('VERIFICATION', content, 'err');
    }
    const sec = section([
      kv('Scope', 'workspace-resident readiness (not canonical VERIFIED)'),
      kv('Verdict', push.verdict),
      kv('Reasons', `${push.reasons.length}`),
      kv('Risky changes', `${push.risky_changes.length}`)
    ]);
    sec.appendChild(el('div', 'cc-scope-note', 'Audit-bus agent.verification events are unscoped (no workspace field); see VERIFY panel for human review.'));
    content.appendChild(sec);
    const status = push.verdict === 'ATTENTION_REQUIRED' ? 'warn' : 'dim';
    return tile('VERIFICATION', content, status);
  }

  function renderTasks(tasks: TaskStatusResponseT | null): HTMLElement {
    const content = el('div', 'cc-tile-content');
    if (tasks === null) {
      content.appendChild(el('div', 'cc-missing', 'Tasks endpoint unavailable.'));
      return tile('TASKS', content, 'err');
    }
    const running = tasks.jobs.filter(j => j.status === 'running').length;
    const failed = tasks.jobs.filter(j => j.status === 'failed').length;
    const exited = tasks.jobs.filter(j => j.status === 'exited').length;
    const sec = section([
      kv('Running', `${running}`),
      kv('Exited (clean)', `${exited}`),
      kv('Failed', `${failed}`),
      kv('Total', `${tasks.jobs.length}`)
    ]);
    content.appendChild(sec);
    const status = failed > 0 ? 'warn' : running > 0 ? 'warn' : 'ok';
    return tile('TASKS', content, status);
  }

  async function refresh(): Promise<void> {
    if (!alive) return;
    let health: HealthResponseT | null = null;
    let models: ModelStatusResponseT | null = null;
    let summary: ResidentSummaryResponseT['summary'] | null = null;
    let push: ResidentPushSummaryT | null = null;
    let byok: ByokStatusResponseT | null = null;
    let harness: ClosedLoopStatusT | null = null;
    let tasks: TaskStatusResponseT | null = null;
    await Promise.allSettled([
      api.health().then(r => (health = r)).catch(() => {}),
      api.modelsStatus().then(r => (models = r)).catch(() => {}),
      api.residentSummary().then(r => (summary = r.summary)).catch(() => {}),
      api.residentPush().then(r => (push = r.push)).catch(() => {}),
      api.byokStatus().then(r => (byok = r)).catch(() => {}),
      api.closedLoopStatus().then(r => (harness = r)).catch(() => {}),
      api.tasksStatus().then(r => (tasks = r)).catch(() => {})
    ]);
    if (!alive) return;
    clearGrid();
    grid.appendChild(renderProject(health, summary));
    grid.appendChild(renderModels(models));
    grid.appendChild(renderResident(summary, push));
    grid.appendChild(renderGit(summary));
    grid.appendChild(renderCloud(byok));
    grid.appendChild(renderHarness(harness));
    grid.appendChild(renderVerification(push));
    grid.appendChild(renderTasks(tasks));
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 8000);

  return {
    dispose() {
      alive = false;
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
