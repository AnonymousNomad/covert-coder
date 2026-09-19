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
    btn.id = `console-tab-${t.id}`;
    btn.setAttribute('aria-controls', 'console-pane');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', `${t.label} tab`);
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      store.set((prev) => ({ ...prev, bottomTab: t.id }));
    });
    btn.addEventListener('keydown', event => {
      const index = TABS.findIndex(tab => tab.id === t.id);
      const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault();
      const target = tabsRow.querySelector<HTMLButtonElement>(`[data-tab="${TABS[next]!.id}"]`);
      target?.click();
      target?.focus();
    });
    tabsRow.appendChild(btn);
  }
  root.appendChild(tabsRow);
  const collapse = document.createElement('button');
  collapse.type = 'button';
  collapse.className = 'cockpit-console-toggle';
  collapse.textContent = 'COLLAPSE';
  collapse.setAttribute('aria-label', 'Collapse console');
  collapse.setAttribute('aria-expanded', 'true');
  collapse.addEventListener('click', () => {
    const collapsed = parent.closest('.cockpit-shell')?.classList.toggle('console-collapsed') ?? false;
    collapse.textContent = collapsed ? 'EXPAND' : 'COLLAPSE';
    collapse.setAttribute('aria-label', collapsed ? 'Expand console' : 'Collapse console');
    collapse.setAttribute('aria-expanded', String(!collapsed));
  });
  tabsRow.appendChild(collapse);

  const body = el('div', 'cockpit-strip-body');
  body.id = 'console-pane';
  body.setAttribute('role', 'tabpanel');
  body.setAttribute('aria-labelledby', `console-tab-${store.get().bottomTab}`);
  const diagnosticsLine = el('div', 'cockpit-strip-diagnostics');
  diagnosticsLine.hidden = true;
  root.appendChild(diagnosticsLine);
  root.appendChild(body);

  parent.appendChild(root);

  let alive = true;
  let openFile: ((path: string) => void) | null = null;
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
    card.appendChild(el('div', 'cockpit-strip-pane-meta', `${workspace.workspace.split(/[\\/]/).filter(Boolean).pop() ?? 'Workspace'} · ${workspace.entries.length} entries · local filesystem`));
    const list = el('ul', 'cockpit-strip-file-list');
    for (const entry of workspace.entries.slice(0, 12)) {
      const item = el('li', 'cockpit-strip-file-item');
      item.appendChild(el('span', 'cockpit-strip-file-kind', entry.kind === 'directory' ? 'DIR' : 'FILE'));
      item.appendChild(el('span', 'cockpit-strip-file-name', entry.name));
      list.appendChild(item);
    }
    card.appendChild(list);
    const browse = el('button', 'cockpit-mode', 'OPEN PROJECTS') as HTMLButtonElement;
    browse.type = 'button';
    browse.addEventListener('click', () => store.set(previous => ({ ...previous, panel: 'projects' })));
    card.appendChild(browse);
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
      button.title = openFile === null ? 'Waiting for editor session restoration' : `Open ${entry.name} in Monaco`;
      button.disabled = openFile === null;
      button.addEventListener('click', () => { store.set(previous => ({ ...previous, panel: 'editor' })); openFile?.(entry.name); });
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
    card.appendChild(el('div', 'cockpit-strip-pane-empty', 'Architecture reference · not a live execution trace'));
    card.appendChild(el('div', 'cockpit-system-map', 'Resident → Context Control → Skill Intelligence + Workflow Engine → Orchestrator → Execution Authority → Harness → Models / Tools → Veritas → Ghost + Memory → Resident'));
    return card;
  }

  async function refreshPane(active: StripTab): Promise<void> {
    if (!alive) return;
    body.innerHTML = '';
    if (active === 'workspace' || active === 'files') {
      let workspace: WorkspaceListResponseT | null = null;
      try { workspace = await api.workspaceList(); }
      catch { workspace = null; }
      if (!alive || store.get().bottomTab !== active) return;
      body.appendChild(active === 'workspace' ? paintWorkspace(workspace) : paintFiles(workspace));
      return;
    }
    if (active === 'terminal' || active === 'output') {
      let jobs: TaskStatusResponseT | null = null;
      try { jobs = await api.tasksStatus(); }
      catch { jobs = null; }
      if (!alive || store.get().bottomTab !== active) return;
      body.appendChild(active === 'terminal' ? paintTerminal(jobs === null ? null : jobs.jobs) : paintOutput(jobs === null ? null : jobs.jobs));
      return;
    }
    if (active === 'tests') {
      let tasks: TaskListResponseT | null = null;
      try { tasks = await api.tasksList(); }
      catch { tasks = null; }
      if (!alive || store.get().bottomTab !== active) return;
      body.appendChild(paintTests(tasks));
      return;
    }
    if (active === 'system-map') body.appendChild(paintSystemMap());
  }

  let currentTab = store.get().bottomTab;
  const unbind = store.subscribe((state) => {
    if (state.bottomTab === currentTab) return;
    currentTab = state.bottomTab;
    parent.querySelectorAll<HTMLElement>('.cockpit-strip-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === state.bottomTab);
      btn.setAttribute('aria-selected', btn.dataset.tab === state.bottomTab ? 'true' : 'false');
      btn.tabIndex = btn.dataset.tab === state.bottomTab ? 0 : -1;
    });
    body.setAttribute('aria-labelledby', `console-tab-${state.bottomTab}`);
    void refreshPane(state.bottomTab);
  });
  window.addEventListener('unload', () => unbind());

  // initial paint
  parent.querySelectorAll<HTMLElement>('.cockpit-strip-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === store.get().bottomTab);
    btn.setAttribute('aria-selected', btn.dataset.tab === store.get().bottomTab ? 'true' : 'false');
    btn.tabIndex = btn.dataset.tab === store.get().bottomTab ? 0 : -1;
  });
  void refreshPane(store.get().bottomTab);

  return {
    root,
    setLatestDiagnostics,
    setOpenFile(nextOpenFile: (path: string) => void) {
      openFile = nextOpenFile;
      if (store.get().bottomTab === 'files') void refreshPane('files');
    },
    dispose() {
      alive = false;
      unbind();
      parent.innerHTML = '';
    }
  };
}
