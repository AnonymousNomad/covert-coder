// TERMINAL panel — real interactive sessions (real-terminal lane).
//
// Truthfulness rules applied here:
//  - A provider is shown as runnable only when the daemon reports it
//    `available`. requires-setup / unhealthy / unsupported render as their real
//    state, never as a pretend RUNNING indicator.
//  - No session exists until the operator approval gate completes; xterm is
//    wired only after `/api/terminal/sessions` returns a real session.
//  - Input is activity inside that admitted session (server-verified owner),
//    transported over the shared authenticated event socket.
// The read-only task-history projection is retained below the shell.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { api } from '../services/api.ts';
import { getSharedEvents } from '../services/ws.ts';
import type { TerminalProviderInfoT, TerminalEventT } from '../../../common/contracts/terminal.ts';
import { TerminalEvent } from '../../../common/contracts/terminal.ts';
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
  const intro = el('div', 'panel-intro', 'Interactive sessions run as approved operations. Opening a session spawns a real shell; input flows only inside that admitted, actor-bound session.');
  root.appendChild(intro);

  const providerStrip = el('div', 'terminal-providers');
  root.appendChild(providerStrip);
  const openControls = el('div', 'terminal-open');
  root.appendChild(openControls);
  const sessionShell = el('div', 'terminal-session');
  root.appendChild(sessionShell);
  const historySection = el('section', 'terminal-history');
  historySection.appendChild(el('div', 'panel-section-title', 'TASK HISTORY (READ-ONLY)'));
  const body = el('div', 'terminal-body');
  historySection.appendChild(body);
  root.appendChild(historySection);
  parent.appendChild(root);

  let alive = true;
  let xterm: XTerm | null = null;
  let fitAddon: FitAddon | null = null;
  let activeSessionId: string | null = null;
  let sessionsInitialized = false;
  let activeProvider: TerminalProviderInfoT | null = null;
  let stopButton: HTMLButtonElement | null = null;
  let windowsResizeHandler: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let opening = false;

  function terminalFontSize(): number {
    const scale = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ck-text-scale'));
    return Math.round(13 * (Number.isFinite(scale) ? Math.max(0.85, Math.min(1.3, scale)) : 1));
  }

  function terminalTheme(): { background: string; foreground: string; cursor: string } {
    const tokens = getComputedStyle(document.documentElement);
    return {
      background: tokens.getPropertyValue('--ck-bg-deepest').trim(),
      foreground: tokens.getPropertyValue('--ck-text').trim(),
      cursor: tokens.getPropertyValue('--ck-cyan').trim()
    };
  }

  const onAppearanceChange = (): void => {
    if (xterm === null) return;
    xterm.options.fontSize = terminalFontSize();
    xterm.options.theme = terminalTheme();
    xterm.options.cursorBlink = document.documentElement.dataset.covertMotion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    fitAddon?.fit();
    windowsResizeHandler?.();
  };
  window.addEventListener('covert:appearancechange', onAppearanceChange);

  function disposeTerminal(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (windowsResizeHandler) window.removeEventListener('resize', windowsResizeHandler);
    windowsResizeHandler = null;
    xterm?.dispose(); xterm = null; fitAddon = null;
  }
  const bus = getSharedEvents();

  const providerEls = new Map<string, HTMLElement>();
  let providers: TerminalProviderInfoT[] = [];
  let providerSelect: HTMLSelectElement | null = null;
  let shellSelect: HTMLSelectElement | null = null;

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'terminal-refresh-btn';
  refreshBtn.textContent = 'REFRESH';
  refreshBtn.addEventListener('click', () => { void refreshProviders(); });

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'terminal-open-btn';
  openButton.textContent = 'OPEN SESSION';
  openButton.addEventListener('click', () => { void openSession(); });

  // --- provider strip ------------------------------------------------------
  function renderProviderState(p: TerminalProviderInfoT): HTMLElement {
    const state = p.state.toUpperCase();
    const card = el('div', `terminal-provider ${p.state}`);
    const head = el('div', 'terminal-provider-head');
    head.appendChild(el('span', 'terminal-provider-name', p.label));
    head.appendChild(el('span', `terminal-provider-state ${p.state}`, state));
    card.appendChild(head);
    card.appendChild(el('div', 'terminal-provider-detail', p.detail));
    if (p.shells.length > 0) {
      card.appendChild(el('div', 'terminal-provider-shells', p.shells.map(s => s.label).join(' \u00b7 ')));
    }
    return card;
  }

  function renderOpenControls(): void {
    openControls.innerHTML = '';
    if (activeProvider === null) {
      const hint = el('div', 'panel-empty', 'No runtime provider is available. Install the prerequisite shown, then refresh.');
      openControls.appendChild(hint);
      return;
    }
    if (activeProvider.state !== 'available' || activeProvider.shells.length === 0) {
      const hint = el('div', 'panel-empty', `${activeProvider.label} is ${activeProvider.state}. No shell can start here yet.`);
      openControls.appendChild(hint);
      return;
    }
    const bar = el('div', 'terminal-open-bar');
    const shellWrap = el('label', 'terminal-field');
    shellWrap.appendChild(el('span', 'terminal-field-label', 'PROVIDER'));
    providerSelect = document.createElement('select');
    providerSelect.className = 'terminal-select';
    for (const p of providers) providerSelect.add(new Option(p.label, p.id));
    providerSelect.value = activeProvider.id;
    providerSelect.addEventListener('change', () => {
      activeProvider = providers.find(p => p.id === providerSelect!.value) ?? null;
      const node = activeProvider ? providerEls.get(activeProvider.id) : null;
      for (const [, ref] of providerEls) ref.classList.toggle('selected', ref === node);
      shellSelect?.remove();
      renderOpenControls();
    });
    shellWrap.appendChild(providerSelect);
    shellSelect = document.createElement('select');
    shellSelect.className = 'terminal-select';
    shellSelect.setAttribute('aria-label', 'Shell');
    for (const s of activeProvider.shells) shellSelect.add(new Option(s.label, s.id));
    shellSelect.value = activeProvider.shells[0]!.id;
    shellWrap.appendChild(shellSelect);
    bar.appendChild(shellWrap);
    const btnRow = el('div', 'terminal-open-actions');
    btnRow.appendChild(openButton);
    const spacing = el('div', 'terminal-open-spacer');
    spacing.appendChild(refreshBtn);
    btnRow.appendChild(spacing);
    bar.appendChild(btnRow);
    openControls.appendChild(bar);
  }

  // --- session rendering ----------------------------------------------------
  function renderSessionLoading(): void {
    sessionShell.innerHTML = '';
    const stage = el('div', 'terminal-stage starting');
    stage.appendChild(el('div', 'panel-loading', 'Approved. Session registered \u2014 starting the shell\u2026'));
    sessionShell.appendChild(stage);
  }

  function renderSessionShell(): void {
    disposeTerminal();
    sessionShell.innerHTML = '';
    if (activeSessionId === null) return;
    const stage = el('div', 'terminal-stage running');
    const metaRow = el('div', 'terminal-session-meta-row');
    const meta = el('div', 'terminal-session-meta');
    meta.appendChild(el('span', 'terminal-session-meta-item', activeProvider?.label ?? 'session'));
    meta.appendChild(el('span', 'terminal-session-meta-item', `session=${activeSessionId.slice(0, 8)}`));
    metaRow.appendChild(meta);
    stopButton = document.createElement('button');
    stopButton.type = 'button';
    stopButton.className = 'terminal-stop-btn';
    stopButton.textContent = 'STOP SESSION';
    stopButton.addEventListener('click', () => { void stopSession(); });
    metaRow.appendChild(stopButton);
    stage.appendChild(metaRow);
    const termHost = el('div', 'terminal-xterm');
    stage.appendChild(termHost);
    sessionShell.appendChild(stage);

    const refreshedTerm = new XTerm({ cursorBlink: document.documentElement.dataset.covertMotion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce)').matches, fontSize: terminalFontSize(),
      fontFamily: 'Cascadia Mono, Consolas, monospace',
      theme: terminalTheme()
    });
    const addon = new FitAddon();
    refreshedTerm.loadAddon(addon);
    refreshedTerm.open(termHost);
    addon.fit();
    refreshedTerm.onData(data => {
      if (activeSessionId !== null) bus?.send({ type: 'terminal', sessionId: activeSessionId, action: 'input', data });
    });
    xterm = refreshedTerm;
    fitAddon = addon;
    windowsResizeHandler = () => {
      if (xterm && fitAddon) fitAddon.fit();
      if (xterm && activeSessionId !== null) {
        bus?.send({ type: 'terminal', sessionId: activeSessionId, action: 'resize', cols: xterm.cols, rows: xterm.rows });
      }
    };
    window.addEventListener('resize', windowsResizeHandler);
    resizeObserver = new ResizeObserver(() => {
      if (termHost.clientWidth > 0 && termHost.clientHeight > 0) windowsResizeHandler?.();
    });
    resizeObserver.observe(termHost);
    refreshedTerm.focus();
  }

  function renderSessionEnded(message: string): void {
    disposeTerminal();
    sessionShell.innerHTML = '';
    const stage = el('div', 'terminal-stage gone');
    stage.appendChild(el('div', 'panel-empty', message));
    sessionShell.appendChild(stage);
    activeSessionId = null;
  }

  function setBusy(text: string): void {
    sessionShell.innerHTML = '';
    sessionShell.appendChild(el('div', 'panel-loading', text));
  }

  // --- actions ----------------------------------------------------------------
  async function refreshProviders(): Promise<void> {
    if (!alive) return;
    providerStrip.innerHTML = '<div class="panel-loading">Probing runtime providers\u2026</div>';
    let infos: TerminalProviderInfoT[];
    try {
      infos = (await api.terminalProviders()).providers;
    } catch (e) {
      providerStrip.innerHTML = '';
      const message = e instanceof Error ? e.message : String(e);
      const timedOut = /timed out|timeout/i.test(message);
      providerStrip.appendChild(el('div', 'panel-error', timedOut
        ? 'Provider discovery timed out (bounded probe). Use REFRESH to retry.'
        : `Provider probe failed: ${message}`));
      // Retry affordance reuses the existing REFRESH control; no new state.
      providerStrip.appendChild(refreshBtn);
      return;
    }
    providers = infos;
    providerStrip.innerHTML = '';
    providerEls.clear();
    for (const p of infos) {
      const card = renderProviderState(p);
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-label', `Select ${p.label}: ${p.state}`);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); }
      });
      providerEls.set(p.id, card);
      card.addEventListener('click', () => {
        activeProvider = p;
        for (const [id, ref] of providerEls) ref.classList.toggle('selected', id === p.id);
        renderOpenControls();
      });
      providerStrip.appendChild(card);
    }
    const stillValid = activeProvider && infos.some(p => p.id === activeProvider!.id) ? activeProvider : null;
    activeProvider = stillValid ?? infos.find(p => p.state === 'available') ?? infos[0] ?? null;
    if (activeProvider) providerEls.get(activeProvider.id)?.classList.add('selected');
    if (activeSessionId === null) renderOpenControls();
  }

  async function openSession(): Promise<void> {
    if (activeProvider === null || activeSessionId !== null || opening) return;
    opening = true;
    openButton.disabled = true;
    const body: { provider: string; shell: string | null; cols: number; rows: number } = {
      provider: providerSelect?.value ?? activeProvider.id,
      shell: shellSelect?.value ?? null,
      cols: xterm ? xterm.cols : 120,
      rows: xterm ? xterm.rows : 35
    };
    setBusy('Approval required \u2014 opening approved session\u2026');
    try {
      const opened = await api.terminalSessionOpen(body);
      activeSessionId = opened.session.sessionId;
      sessionsInitialized = false;
      renderSessionLoading();
      void refreshSessions();
    } catch (e) {
      activeSessionId = null;
      sessionShell.innerHTML = '';
      sessionShell.appendChild(el('div', 'panel-error', `Session not opened: ${e instanceof Error ? e.message : String(e)}`));
      renderOpenControls();
    } finally {
      opening = false;
      openButton.disabled = activeSessionId !== null;
    }
  }

  async function stopSession(): Promise<void> {
    if (activeSessionId === null) return;
    const id = activeSessionId;
    if (stopButton) { stopButton.disabled = true; stopButton.textContent = 'STOPPING…'; }
    try {
      await api.terminalSessionStop(id);
      renderSessionEnded('STOPPED · session closed by the operator.');
      openButton.disabled = false;
      renderOpenControls();
    } catch (e) {
      sessionShell.appendChild(el('div', 'panel-error', `Stop failed: ${e instanceof Error ? e.message : String(e)}`));
      if (stopButton) { stopButton.disabled = false; stopButton.textContent = 'STOP SESSION'; }
    }
  }

  async function refreshSessions(): Promise<void> {
    if (!alive || activeSessionId === null) return;
    let mine: { state: string; exitCode: number | null; cleanup: string } | undefined;
    try {
      const res = await api.terminalSessions();
      mine = res.sessions.find(s => s.sessionId === activeSessionId);
    } catch { return; }
    if (!mine) {
      renderSessionEnded('Session ended. Open a new one from the provider bar.');
      return;
    }
    if (mine.state === 'running' && !sessionsInitialized) {
      sessionsInitialized = true;
      renderSessionShell();
    }
    if (mine.state === 'stopped' || mine.state === 'disposed' || mine.state === 'failed') {
      // A terminal state must clear the dead terminal surface; previously this
      // branch re-offered OPEN SESSION while the exited xterm stayed rendered.
      const label = `SESSION ${mine.state.toUpperCase()}${mine.exitCode !== null ? ` \u00b7 exit ${mine.exitCode}` : ''}${mine.cleanup !== 'clean' ? ` \u00b7 cleanup=${mine.cleanup}` : ''}`;
      renderSessionEnded(`${label}. Open a new one from the provider bar.`);
      openButton.disabled = false;
      renderOpenControls();
      return;
    }
    const stateLab = `${mine.state.toUpperCase()}${mine.exitCode !== null ? ` \u00b7 exit ${mine.exitCode}` : ''}${mine.cleanup !== 'clean' ? ` \u00b7 cleanup=${mine.cleanup}` : ''}`;
    let chip = sessionShell.querySelector('.terminal-session-state');
    if (chip) { chip.textContent = stateLab; return; }
    chip = el('div', 'terminal-session-state', stateLab);
    const first = sessionShell.firstElementChild;
    if (first) first.prepend(chip);
  }

  // --- event stream ------------------------------------------------------------
  const unsubscribe = bus?.subscribe('terminal', data => {
    if (activeSessionId === null) return;
    const parsed = TerminalEvent.safeParse(data);
    if (!parsed.success || parsed.data.sessionId !== activeSessionId) return;
    const event = parsed.data as TerminalEventT;
    if (event.kind === 'output' && xterm) xterm.write(event.data);
    else if (event.kind === 'state' && event.state === 'running' && !sessionsInitialized) {
      sessionsInitialized = true;
      renderSessionShell();
    } else if (event.kind === 'state' && (event.state === 'stopped' || event.state === 'disposed')) {
      sessionsInitialized = true;
    } else if (event.kind === 'exit') {
      sessionsInitialized = true;
      if (xterm) xterm.write(`\r\n[session exited ${event.exitCode}; cleanup=${event.cleanup}]\r\n`);
      void refreshSessions();
    } else if (event.kind === 'error' && xterm) {
      xterm.write(`\r\n[terminal: ${event.message}]\r\n`);
    }
  });

  // --- read-only task history projection ----------------------------------------
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

  async function refreshHistory(): Promise<void> {
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
      body.appendChild(el('div', 'panel-empty', 'No task history yet. One-shot commands remain available through the operator-gated POST /api/terminal/run flow.'));
      return;
    }
    const counts = el('div', 'terminal-counts');
    counts.appendChild(el('span', 'terminal-counts-value', `${res.jobs.length} JOB${res.jobs.length === 1 ? '' : 'S'} RECORDED`));
    body.appendChild(counts);
    const list = el('div', 'terminal-job-list');
    for (const j of res.jobs.slice(0, 50)) list.appendChild(renderJob(j));
    body.appendChild(list);
  }

  void refreshProviders();
  void refreshHistory();
  const interval = window.setInterval(() => { void refreshHistory(); void refreshSessions(); }, 5000);

  return {
    dispose() {
      alive = false;
      window.clearInterval(interval);
      window.removeEventListener('covert:appearancechange', onAppearanceChange);
      disposeTerminal();
      unsubscribe?.();
      if (xterm) {
        try { xterm.dispose(); } catch { /* already disposed */ }
        xterm = null;
      }
      parent.innerHTML = '';
    }
  };
}
