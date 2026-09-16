// Phase 7 — Bottom system strip.
// Tabs: WORKSPACE / FILES / TERMINAL / TESTS / OUTPUT / SYSTEM MAP.
// Each tab is a read-only projection of existing data or honest empty.

import type { Store } from '../store/store.ts';
import type { AppState, BottomTab } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { TaskStatusResponseT, TaskJobT } from '../../../common/contracts/tasks.ts';
import type { TaskListResponseT } from '../../../common/contracts/tasks.ts';
import type { WorkspaceListResponseT } from '../../../common/contracts/workspace.ts';

export interface BottomStripHandles {
  root: HTMLElement;
  setLatestDiagnostics(diagnostics: { uri: string; markers: Array<{ severity: number; message: string; startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }> }): void;
  setOpenFile(openFile: (path: string) => void): void;
  dispose(): void;
}

type StripTab = BottomTab;

const TABS: { id: StripTab; label: string }[] = [
  { id: 'workspace', label: 'WORKSPACE' },
  { id: 'files', label: 'FILES' },
  { id: 'terminal', label: 'TERMINAL' },
  { id: 'tests', label: 'TESTS' },
  { id: 'output', label: 'OUTPUT' },
  { id: 'system-map', label: 'SYSTEM MAP' }
];

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function jobStatus(job: TaskJobT): string {
  const ec = job.exitCode === null ? '' : ` (exit ${job.exitCode})`;
  return `${job.label} \u00b7 ${job.status.toUpperCase()}${ec}`;
}

export function createBottomStrip(parent: HTMLElement, store: Store<AppState>): BottomStripHandles {
  parent.innerHTML = '';
  const root = el('div', 'cockpit-strip');

  const tabsRow = el('nav', 'cockpit-strip-tabs');
  tabsRow.setAttribute('role', 'tablist');
  tabsRow.setAttribute('aria-label', 'Bottom strip tabs');
  for (const t of TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cockpit-strip-tab';
    btn.dataset.tab = t.id;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', `${t.label} tab`);
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      store.set((prev) => ({ ...prev, bottomTab: t.id }));
    });
    tabsRow.appendChild(btn);
  }
  root.appendChild(tabsRow);

  const body = el('div', 'cockpit-strip-body');
  const diagnosticsLine = el('div', 'cockpit-strip-diagnostics');
  diagnosticsLine.hidden = true;
  root.appendChild(diagnosticsLine);
  root.appendChild(body);

  parent.appendChild(root);

  let alive = true;
  let openFile: (path: string) => void = () => {};
  const LATEST_DIAGNOSTICS: { current: { uri: string; markers: ReadonlyArray<unknown> } | null } = { current: null };

  function setLatestDiagnostics(diagnostics: { uri: string; markers: Array<{ severity: number; message: string; startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }> }): void {
    LATEST_DIAGNOSTICS.current = diagnostics;
    const count = diagnostics.markers.length;
    diagnosticsLine.hidden = count === 0;
    diagnosticsLine.textContent = count > 0
      ? `Latest diagnostics: ${count} marker(s) on ${diagnostics.uri} · see Monaco gutter for details.`
      : 'No diagnostics reported by the event bus.';
  }

  function paintWorkspace(workspace: WorkspaceListResponseT | null): HTMLElement {
    const card = el('div', 'cockpit-strip-pane');
    card.appendChild(el('h3', 'cockpit-strip-pane-title', 'WORKSPACE'));
    if (workspace === null) {
      card.appendChild(el('div', 'cockpit-strip-pane-empty', '/api/workspace unavailable.'));
      return card;
    }
    card.appendChild(el('div', 'cockpit-strip-pane-meta', workspace.workspace));
    const list = el('ul', 'cockpit-strip-file-list');
    for (const entry of workspace.entries.slice(0, 80)) {
      const item = el('li', 'cockpit-strip-file-item');
      item.appendChild(el('span', 'cockpit-strip-file-kind', entry.kind === 'directory' ? 'DIR' : 'FILE'));
      item.appendChild(el('span', 'cockpit-strip-file-name', entry.name));
      list.appendChild(item);
    }
    card.appendChild(list);
    return card;
  }

  function paintFiles(workspace: WorkspaceListResponseT | null): HTMLElement {
    const card = el('div', 'cockpit-strip-pane');
    card.appendChild(el('h3', 'cockpit-strip-pane-title', 'FILES'));
    if (workspace === null) {
      card.appendChild(el('div', 'cockpit-strip-pane-empty', '/api/workspace unavailable.'));
      return card;
    }
    const list = el('div', 'cockpit-strip-file-list');
    const files = workspace.entries.filter(entry => entry.kind === 'file');
    if (files.length === 0) {
      card.appendChild(el('div', 'cockpit-strip-pane-empty', 'No files reported by /api/workspace.'));
      return card;
    }
    for (const entry of files.slice(0, 80)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cockpit-strip-file-open';
      button.textContent = entry.name;
      button.title = `Open ${entry.name} in Monaco`;
      button.addEventListener('click', () => openFile(entry.name));
      list.appendChild(button);
    }
    card.appendChild(list);
    return card;
  }

  function paintTerminal(jobs: TaskJobT[] | null): HTMLElement {
    return paintOutput(jobs, 'TERMINAL');
  }

  function paintOutput(jobs: TaskJobT[] | null, title = 'OUTPUT'): HTMLElement {
    const card = el('div', 'cockpit-strip-pane');
    card.appendChild(el('h3', 'cockpit-strip-pane-title', title));
    if (jobs === null) {
      card.appendChild(el('div', 'cockpit-strip-pane-empty', '/api/tasks/status unavailable.'));
      return card;
    }
    if (jobs.length === 0) {
      card.appendChild(el('div', 'cockpit-strip-pane-empty', 'No task jobs yet. Task execution is operator-gated through POST /api/terminal/run.'));
      return card;
    }
    const list = el('ol', 'cockpit-strip-output-list');
    for (const j of jobs.slice(0, 8)) {
      const li = document.createElement('li');
      li.appendChild(el('span', 'cockpit-strip-output-label', jobStatus(j)));
      li.appendChild(el('div', 'cockpit-strip-output-cmd', `${j.command}${j.args.length > 0 ? ' ' + j.args.join(' ') : ''}`));
      list.appendChild(li);
    }
    card.appendChild(list);
    return card;
  }

  function paintTests(tasks: TaskListResponseT | null): HTMLElement {
    const card = el('div', 'cockpit-strip-pane');
    card.appendChild(el('h3', 'cockpit-strip-pane-title', 'TESTS'));
    if (tasks === null) {
      card.appendChild(el('div', 'cockpit-strip-pane-empty', '/api/tasks unavailable.'));
      return card;
    }
    const testTasks = tasks.tasks.filter(task => task.groupKind === 'test' || (typeof task.group === 'string' && task.group === 'test'));
    if (testTasks.length === 0) {
      card.appendChild(el('div', 'cockpit-strip-pane-empty', tasks.fileFound ? 'No task marked as a test task.' : 'No tasks file or detected test task.'));
      return card;
    }
    const list = el('ol', 'cockpit-strip-output-list');
    for (const task of testTasks.slice(0, 12)) {
      const li = document.createElement('li');
      li.appendChild(el('span', 'cockpit-strip-output-label', task.label));
      li.appendChild(el('div', 'cockpit-strip-output-cmd', `${task.command}${task.args && task.args.length > 0 ? ` ${task.args.join(' ')}` : ''}`));
      list.appendChild(li);
    }
    card.appendChild(list);
    card.appendChild(el('div', 'cockpit-strip-pane-empty', 'Read-only task projection; execution remains operator-gated.'));
    return card;
  }

  function paintSystemMap(): HTMLElement {
    const card = el('div', 'cockpit-strip-pane');
    card.appendChild(el('h3', 'cockpit-strip-pane-title', 'SYSTEM MAP'));
    card.appendChild(el('div', 'cockpit-strip-pane-empty', 'System map is not exposed on the browser facade. See legacy bottom-strip SYSTEM MAP for the operator dashboard snapshot.'));
    return card;
  }

  async function refreshPane(active: StripTab): Promise<void> {
    if (!alive) return;
    body.innerHTML = '';
    if (active === 'workspace' || active === 'files') {
      let workspace: WorkspaceListResponseT | null = null;
      try { workspace = await api.workspaceList(); }
      catch { workspace = null; }
      if (!alive) return;
      body.appendChild(active === 'workspace' ? paintWorkspace(workspace) : paintFiles(workspace));
      return;
    }
    if (active === 'terminal' || active === 'output') {
      let jobs: TaskStatusResponseT | null = null;
      try { jobs = await api.tasksStatus(); }
      catch { jobs = null; }
      if (!alive) return;
      body.appendChild(active === 'terminal' ? paintTerminal(jobs === null ? null : jobs.jobs) : paintOutput(jobs === null ? null : jobs.jobs));
      return;
    }
    if (active === 'tests') {
      let tasks: TaskListResponseT | null = null;
      try { tasks = await api.tasksList(); }
      catch { tasks = null; }
      if (!alive) return;
      body.appendChild(paintTests(tasks));
      return;
    }
    if (active === 'system-map') body.appendChild(paintSystemMap());
  }

  const unbind = store.subscribe((state) => {
    parent.querySelectorAll<HTMLElement>('.cockpit-strip-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === state.bottomTab);
      btn.setAttribute('aria-selected', btn.dataset.tab === state.bottomTab ? 'true' : 'false');
    });
    void refreshPane(state.bottomTab);
  });
  window.addEventListener('unload', () => unbind());

  // initial paint
  parent.querySelectorAll<HTMLElement>('.cockpit-strip-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === store.get().bottomTab);
    btn.setAttribute('aria-selected', btn.dataset.tab === store.get().bottomTab ? 'true' : 'false');
  });
  void refreshPane(store.get().bottomTab);

  return {
    root,
    setLatestDiagnostics,
    setOpenFile(nextOpenFile: (path: string) => void) {
      openFile = nextOpenFile;
    },
    dispose() {
      alive = false;
      parent.innerHTML = '';
    }
  };
}
