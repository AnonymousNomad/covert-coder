import type { Store } from '../store/store.ts';
import type { AppState, BottomTab } from '../store/state.ts';
import { api } from '../services/api.ts';
import type {
  TaskListResponseT,
  TaskStatusResponseT,
  TaskEntryT,
  TaskJobT
} from '../../../common/contracts/tasks.ts';
import type {
  AuditReadResponseT,
  AuditEventT
} from '../../../common/contracts/audit.ts';
import type { LspStatusResponseT, LspStatusEntryT } from '../../../common/contracts/lsp.ts';
import type { MarkerT } from '../../../common/contracts/events.ts';

export interface StatusBarHandles {
  root: HTMLElement;
  bottomStrip: HTMLElement;
  bottomStripContent: HTMLElement;
  statusLeft: HTMLElement;
  statusRight: HTMLElement;
  lspStatus: HTMLElement;
  residentStatus: HTMLElement;
  setLatestDiagnostics(markers: { uri: string; markers: MarkerT[] }): void;
  refreshActiveTab(): Promise<void>;
}

interface DiagnosticEntry {
  uri: string;
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

const LATEST_DIAGNOSTICS: { current: DiagnosticEntry[] } = { current: [] };

export function createStatusBar(parent: HTMLElement, store: Store<AppState>): StatusBarHandles {
  parent.innerHTML = `
    <section class="bottom-strip" aria-label="Output and status">
      <nav class="bottom-strip-tabs" role="tablist">
        <button class="bottom-strip-tab" type="button" role="tab" data-tab="terminal" data-maturity="EXPERIMENTAL" title="TERMINAL \u00b7 EXPERIMENTAL" aria-label="TERMINAL tab \u2014 EXPERIMENTAL"><span class="bottom-strip-tab-label">TERMINAL</span><span class="bottom-strip-tab-maturity">EXPERIMENTAL</span></button>
        <button class="bottom-strip-tab" type="button" role="tab" data-tab="output" data-maturity="EXPERIMENTAL" title="OUTPUT \u00b7 EXPERIMENTAL" aria-label="OUTPUT tab \u2014 EXPERIMENTAL"><span class="bottom-strip-tab-label">OUTPUT</span><span class="bottom-strip-tab-maturity">EXPERIMENTAL</span></button>
        <button class="bottom-strip-tab" type="button" role="tab" data-tab="problems" data-maturity="DEGRADED" title="PROBLEMS \u00b7 DEGRADED" aria-label="PROBLEMS tab \u2014 DEGRADED"><span class="bottom-strip-tab-label">PROBLEMS</span><span class="bottom-strip-tab-maturity">DEGRADED</span></button>
        <button class="bottom-strip-tab" type="button" role="tab" data-tab="tasks" data-maturity="EXPERIMENTAL" title="TASKS \u00b7 EXPERIMENTAL" aria-label="TASKS tab \u2014 EXPERIMENTAL"><span class="bottom-strip-tab-label">TASKS</span><span class="bottom-strip-tab-maturity">EXPERIMENTAL</span></button>
        <button class="bottom-strip-tab" type="button" role="tab" data-tab="verify" data-maturity="DEGRADED" title="VERIFY \u00b7 DEGRADED" aria-label="VERIFY tab \u2014 DEGRADED"><span class="bottom-strip-tab-label">VERIFY</span><span class="bottom-strip-tab-maturity">DEGRADED</span></button>
        <button class="bottom-strip-tab" type="button" role="tab" data-tab="audit" data-maturity="DEGRADED" title="AUDIT \u00b7 DEGRADED" aria-label="AUDIT tab \u2014 DEGRADED"><span class="bottom-strip-tab-label">AUDIT</span><span class="bottom-strip-tab-maturity">DEGRADED</span></button>
      </nav>
      <div class="bottom-strip-content" id="bottom-strip-content">
        <div class="bottom-strip-empty">Select a tab to load backend data.</div>
      </div>
    </section>
    <footer class="status-bar" id="status-bar" role="contentinfo">
      <span class="item" id="status-left">starting\u2026</span>
      <span class="spacer"></span>
      <span class="item lsp-status" id="lsp-status"></span>
      <span class="item resident-status" id="resident-status"></span>
      <span class="item" id="status-right"></span>
    </footer>
  `;

  const bottomStrip = parent.querySelector<HTMLElement>('.bottom-strip');
  const bottomStripContent = parent.querySelector<HTMLElement>('#bottom-strip-content');
  const statusLeft = parent.querySelector<HTMLElement>('#status-left');
  const statusRight = parent.querySelector<HTMLElement>('#status-right');
  const lspStatus = parent.querySelector<HTMLElement>('#lsp-status');
  const residentStatus = parent.querySelector<HTMLElement>('#resident-status');
  if (bottomStrip === null || bottomStripContent === null || statusLeft === null || statusRight === null || lspStatus === null || residentStatus === null) throw new Error('status-bar mount failed');

  // Legacy bottom strip. The cockpit replaces this surface; the entries
  // below keep this module compiling while the cockpit is the live shell.
  // The legacy strip only renders the six tabs the legacy HTML defines;
  // new cockpit-only tabs (workspace/files/tests/system-map) map to no
  // legacy loader and short-circuit to an honest stub.
  const TAB_IDS: BottomTab[] = ['terminal', 'output', 'problems', 'tasks', 'verify', 'audit'];
  const LOADED: Record<BottomTab, boolean> = {
    workspace: false,
    files: false,
    terminal: false,
    tests: false,
    output: false,
    'system-map': false,
    problems: false,
    tasks: false,
    verify: false,
    audit: false
  };

  function setActiveTab(tab: BottomTab): void {
    parent.querySelectorAll<HTMLElement>('.bottom-strip-tab').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });
  }

  function clearContent(): void {
    bottomStripContent!.innerHTML = '';
  }

  function showEmpty(text: string): void {
    clearContent();
    const empty = document.createElement('div');
    empty.className = 'bottom-strip-empty';
    empty.textContent = text;
    bottomStripContent!.appendChild(empty);
  }

  function showError(prefix: string, err: unknown): void {
    clearContent();
    const empty = document.createElement('div');
    empty.className = 'bottom-strip-empty';
    empty.textContent = prefix + ' \u2014 ' + (err instanceof Error ? err.message : String(err));
    bottomStripContent!.appendChild(empty);
  }

  async function loadTerminal(): Promise<void> {
    let res: TaskStatusResponseT;
    try { res = await api.tasksStatus(); }
    catch (e) { showError('Failed to load task status', e); return; }
    clearContent();
    const intro = document.createElement('div');
    intro.className = 'bottom-strip-intro';
    intro.textContent = 'Recent task and command jobs. Terminal commands are POST /api/terminal/run (no history GET).';
    bottomStripContent!.appendChild(intro);
    if (res.jobs.length === 0) {
      showEmpty('No command history \u2014 the terminal command palette is unavailable; task history is read-only in this cockpit phase.');
      return;
    }
    const list = document.createElement('div');
    list.className = 'job-list';
    for (const j of res.jobs.slice(0, 30)) renderJob_(list, j);
    bottomStripContent!.appendChild(list);
  }

  async function loadOutput(): Promise<void> {
    let res: TaskStatusResponseT;
    try { res = await api.tasksStatus(); }
    catch (e) { showError('Failed to load output stream', e); return; }
    clearContent();
    const intro = document.createElement('div');
    intro.className = 'bottom-strip-intro';
    intro.textContent = 'Stdout/stderr from completed jobs. Live output streams over WS as the tasks:output event.';
    bottomStripContent!.appendChild(intro);
    const finished = res.jobs.filter(j => j.status === 'exited' || j.status === 'failed' || j.status === 'stopped');
    if (finished.length === 0) {
      showEmpty('No completed jobs yet \u2014 output appears here when tasks/commands finish.');
      return;
    }
    const list = document.createElement('div');
    list.className = 'job-list';
    for (const j of finished.slice(0, 30)) renderJob_(list, j);
    bottomStripContent!.appendChild(list);
  }

  async function loadProblems(): Promise<void> {
    let lspRes: LspStatusResponseT;
    try { lspRes = await api.lspStatus(); }
    catch (e) { showError('Failed to load LSP status', e); return; }
    clearContent();
    const header = document.createElement('div');
    header.className = 'bottom-strip-intro';
    header.textContent = 'LSP diagnostics. Status below; live diagnostics streamed over WS as lsp:diagnostics events.';
    bottomStripContent!.appendChild(header);
    renderLspStatus_(lspRes.servers);
    if (LATEST_DIAGNOSTICS.current.length === 0) {
      showEmpty('No problems detected \u2014 LSP reports zero diagnostics.');
      return;
    }
    const list = document.createElement('div');
    list.className = 'diag-list';
    for (const d of LATEST_DIAGNOSTICS.current.slice(0, 80)) renderDiag_(list, d);
    bottomStripContent!.appendChild(list);
  }

  async function loadTasks(): Promise<void> {
    let res: TaskListResponseT;
    try { res = await api.tasksList(); }
    catch (e) { showError('Failed to load task list', e); return; }
    clearContent();
    const header = document.createElement('div');
    header.className = 'bottom-strip-intro';
    header.textContent = res.fileFound
      ? `Tasks file: ${res.filePath ?? '(inline)'} \u2014 ${res.tasks.length} task(s) defined.`
      : (res.detectedFrom ? `Detected from ${res.detectedFrom} \u2014 ${res.tasks.length} task(s).` : `No tasks file found \u2014 ${res.tasks.length} task(s).`);
    bottomStripContent!.appendChild(header);
    if (res.tasks.length === 0) {
      showEmpty('No tasks defined. Add a tasks.json or run a detected task.');
      return;
    }
    const list = document.createElement('div');
    list.className = 'task-list';
    for (const t of res.tasks) renderTask_(list, t);
    bottomStripContent!.appendChild(list);
  }

  async function loadVerify(): Promise<void> {
    let res: AuditReadResponseT;
    try { res = await api.auditRead({ type: 'agent.verification', limit: 50 }); }
    catch (e) { showError('Failed to load verification audit', e); return; }
    clearContent();
    const header = document.createElement('div');
    header.className = 'bottom-strip-intro';
    header.textContent = `Verification evidence from audit bus. Showing ${res.events.length} agent.verification event(s) of ${res.count} matching the filter.`;
    bottomStripContent!.appendChild(header);
    if (res.events.length === 0) {
      showEmpty('No verification evidence recorded. Run /api/audit?type=agent.verification to confirm \u2014 empty means unverified, not failed.');
      return;
    }
    const list = document.createElement('div');
    list.className = 'event-list';
    for (const ev of res.events) renderEvent_(list, ev);
    bottomStripContent!.appendChild(list);
  }

  async function loadAudit(): Promise<void> {
    let res: AuditReadResponseT;
    try { res = await api.auditRead({ limit: 50 }); }
    catch (e) { showError('Failed to load audit bus', e); return; }
    clearContent();
    const header = document.createElement('div');
    header.className = 'bottom-strip-intro';
    header.textContent = `Recent audit bus events. ${res.count} total; showing ${res.events.length}.`;
    bottomStripContent!.appendChild(header);
    if (res.events.length === 0) {
      showEmpty('Audit bus empty \u2014 no events recorded yet.');
      return;
    }
    const list = document.createElement('div');
    list.className = 'event-list';
    for (const ev of res.events) renderEvent_(list, ev);
    bottomStripContent!.appendChild(list);
  }

  function loadLegacyStub(tab: BottomTab): () => Promise<void> {
    return async () => {
      showEmpty(`${tab} tab is a cockpit-only surface; the legacy strip does not implement a loader for it.`);
    };
  }

  const LOADERS: Record<BottomTab, () => Promise<void>> = {
    workspace: loadLegacyStub('workspace'),
    files: loadLegacyStub('files'),
    terminal: loadTerminal,
    tests: loadLegacyStub('tests'),
    output: loadOutput,
    'system-map': loadLegacyStub('system-map'),
    problems: loadProblems,
    tasks: loadTasks,
    verify: loadVerify,
    audit: loadAudit
  };

  function renderLspStatus_(servers: LspStatusEntryT[]): void {
    if (servers.length === 0) return;
    const block = document.createElement('div');
    block.className = 'lsp-status-block';
    const heading = document.createElement('h4');
    heading.textContent = 'LSP SERVERS';
    block.appendChild(heading);
    for (const s of servers) {
      const row = document.createElement('div');
      row.className = 'lsp-status-row ' + (s.status === 'running' || s.status === 'available' ? 'ok' : s.status === 'error' || s.status === 'not_found' ? 'err' : 'dim');
      row.textContent = `${s.languageId}: ${s.status}`;
      block.appendChild(row);
    }
    bottomStripContent!.appendChild(block);
  }

  function renderJob_(parent: HTMLElement, j: TaskJobT): void {
    const card = document.createElement('div');
    card.className = 'job-card ' + (j.status === 'running' ? 'running' : j.status === 'failed' ? 'failed' : j.status === 'exited' ? 'ok' : 'dim');
    const head = document.createElement('div');
    head.className = 'job-head';
    head.textContent = `${j.label} \u00b7 ${j.status}${j.exitCode === null ? '' : ' (exit ' + j.exitCode + ')'}`;
    card.appendChild(head);
    const cmd = document.createElement('div');
    cmd.className = 'job-cmd';
    cmd.textContent = j.command + (j.args.length > 0 ? ' ' + j.args.join(' ') : '');
    card.appendChild(cmd);
    const meta = document.createElement('div');
    meta.className = 'job-meta';
    meta.textContent = `job_id=${j.job_id} started=${new Date(j.startedAt).toISOString()}${j.endedAt !== null ? ' ended=' + new Date(j.endedAt).toISOString() : ''}`;
    card.appendChild(meta);
    parent.appendChild(card);
  }

  function renderTask_(parent: HTMLElement, t: TaskEntryT): void {
    const card = document.createElement('div');
    card.className = 'task-card';
    const head = document.createElement('div');
    head.className = 'task-head';
    head.textContent = `${t.label} \u00b7 ${t.type}${t.groupKind !== undefined ? ' \u00b7 ' + t.groupKind : ''}`;
    card.appendChild(head);
    const cmd = document.createElement('div');
    cmd.className = 'task-cmd';
    cmd.textContent = t.command + (t.args !== undefined && t.args.length > 0 ? ' ' + t.args.join(' ') : '');
    card.appendChild(cmd);
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.textContent = `${t.source}${t.groupIsDefault === true ? ' \u00b7 default' : ''}${t.isBackground === true ? ' \u00b7 background' : ''}`;
    card.appendChild(meta);
    parent.appendChild(card);
  }

  function renderEvent_(parent: HTMLElement, ev: AuditEventT): void {
    const card = document.createElement('div');
    card.className = 'event-card';
    const head = document.createElement('div');
    head.className = 'event-head';
    const ts = ev.at ?? ev.ts ?? '\u2014';
    head.textContent = `${ev.type} \u00b7 ${ts}${ev.ok !== undefined ? (ev.ok ? ' \u00b7 ok' : ' \u00b7 err') : ''}`;
    card.appendChild(head);
    const meta = document.createElement('div');
    meta.className = 'event-meta';
    const pieces: string[] = [];
    if (ev.session_id !== undefined) pieces.push('session=' + ev.session_id.slice(0, 8));
    if (ev.bundle_id !== undefined) pieces.push('bundle=' + ev.bundle_id.slice(0, 8));
    if (ev.tool !== undefined) pieces.push('tool=' + ev.tool);
    if (ev.task !== undefined) pieces.push('task=' + ev.task);
    if (ev.role !== undefined) pieces.push('role=' + ev.role);
    if (ev.primary_skill !== undefined) pieces.push('skill=' + ev.primary_skill);
    meta.textContent = pieces.join(' \u00b7 ');
    if (meta.textContent.length > 0) card.appendChild(meta);
    if (ev.summary !== undefined) {
      const sum = document.createElement('div');
      sum.className = 'event-summary';
      sum.textContent = ev.summary;
      card.appendChild(sum);
    }
    if (ev.error !== undefined && ev.error !== null) {
      const err = document.createElement('div');
      err.className = 'event-error';
      err.textContent = 'error: ' + ev.error;
      card.appendChild(err);
    }
    parent.appendChild(card);
  }

  function renderDiag_(parent: HTMLElement, d: DiagnosticEntry): void {
    const card = document.createElement('div');
    card.className = 'diag-card sev-' + d.severity;
    const sevName = d.severity === 1 ? 'ERROR' : d.severity === 2 ? 'WARNING' : d.severity === 3 ? 'INFO' : 'HINT';
    const head = document.createElement('div');
    head.className = 'diag-head';
    head.textContent = `${sevName} \u00b7 ${d.uri.split('/').pop() ?? d.uri}:${d.startLineNumber}:${d.startColumn}`;
    card.appendChild(head);
    const msg = document.createElement('div');
    msg.className = 'diag-msg';
    msg.textContent = d.message;
    card.appendChild(msg);
    parent.appendChild(card);
  }

  async function loadActiveTab(): Promise<void> {
    const state = store.get();
    const tab = state.bottomTab;
    setActiveTab(tab);
    clearContent();
    const loading = document.createElement('div');
    loading.className = 'bottom-strip-loading';
    loading.textContent = `Loading ${tab} from backend\u2026`;
    bottomStripContent!.appendChild(loading);
    try {
      await LOADERS[tab]();
    } catch (e) {
      showError(`Failed to load ${tab}`, e);
    }
  }

  async function refreshActiveTab(): Promise<void> {
    LOADED[store.get().bottomTab] = false;
    await loadActiveTab();
  }

  for (const tab of TAB_IDS) {
    const button = parent.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`);
    if (button === null) continue;
    button.addEventListener('click', () => {
      if (store.get().bottomTab === tab) return;
      store.set(prev => ({ ...prev, bottomTab: tab }));
    });
  }

  const unbind = store.subscribe(state => {
    const prev = LOADED[state.bottomTab];
    setActiveTab(state.bottomTab);
    if (!prev) {
      LOADED[state.bottomTab] = true;
      void loadActiveTab();
    }
  });
  window.addEventListener('unload', () => unbind());

  LOADED[store.get().bottomTab] = true;
  void loadActiveTab();

  function setLatestDiagnostics(event: { uri: string; markers: MarkerT[] }): void {
    const flat: DiagnosticEntry[] = [];
    for (const m of event.markers) {
      flat.push({
        uri: event.uri,
        severity: m.severity,
        message: m.message,
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
        endLineNumber: m.endLineNumber,
        endColumn: m.endColumn
      });
    }
    LATEST_DIAGNOSTICS.current = flat;
    if (store.get().bottomTab === 'problems') {
      LOADED.problems = false;
      void loadActiveTab();
    }
  }

  return {
    root: parent,
    bottomStrip,
    bottomStripContent,
    statusLeft,
    statusRight,
    lspStatus,
    residentStatus,
    setLatestDiagnostics,
    refreshActiveTab
  };
}
