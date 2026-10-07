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
import type { TerminalProviderInfoT, TerminalEventT, TerminalSessionInfoT, TerminalOutputSnapshotT } from '../../../common/contracts/terminal.ts';
import { TerminalEvent } from '../../../common/contracts/terminal.ts';
import type { TaskStatusResponseT, TaskJobT } from '../../../common/contracts/tasks.ts';
import { TerminalOutputProjection } from '../desktop/terminal-output-projection.ts';
import type { TerminalViewBindings } from '../desktop/terminal-view-bindings.ts';
import { DEFAULT_APPEARANCE, terminalThemeFor, type ThemeEngine } from '../desktop/theme.ts';

export interface PanelHandles {
  activate(): void;
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

export function createTerminalPanel(parent: HTMLElement, _store: Store<AppState>, theme?: ThemeEngine, view?: { viewId: string; bindings: TerminalViewBindings }): PanelHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content terminal-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'TERMINAL'));
  header.appendChild(el('span', 'panel-maturity', 'EXPERIMENTAL'));
  root.appendChild(header);
  const intro = el('div', 'panel-intro', 'Interactive sessions run as approved operations. Reattaching transfers control only after an explicit Authority decision.');
  root.appendChild(intro);

  const providerStrip = el('div', 'terminal-providers');
  root.appendChild(providerStrip);
  const resumeStrip = el('div', 'terminal-resume-list');
  root.appendChild(resumeStrip);
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
  let resumeInProgress = false;
  let openInProgress = false;
  let controlConfirmed = false;
  let outputReplayInProgress = false;
  let outputReplayGeneration = 0;
  let finishReplay: (() => void) | null = null;
  let outputProjection = new TerminalOutputProjection();
  let outputRecoveryGeneration = 0;
  let outputRecoveryInProgress = false;
  let legacyOutput = false;
  let resizeObserver: ResizeObserver | null = null;
  let termElement: HTMLElement | null = null;
  let fitFrame: number | null = null;
  let activeProvider: TerminalProviderInfoT | null = null;
  let stopButton: HTMLButtonElement | null = null;
  let windowsResizeHandler: (() => void) | null = null;
  const bus = getSharedEvents();
  let transportConnected = bus?.connected?.() !== false;

  function synchronizeInput(): void {
    if (xterm) xterm.options.disableStdin = !alive || !controlConfirmed || resumeInProgress || outputReplayInProgress || !transportConnected;
  }

  const providerEls = new Map<string, HTMLElement>();
  let providers: TerminalProviderInfoT[] = [];
  let providerRefreshGeneration = 0;
  let historyRefreshGeneration = 0;
  let sessionRefreshGeneration = 0;
  let providerSelect: HTMLSelectElement | null = null;
  let shellSelect: HTMLSelectElement | null = null;
  let detailsExpanded = false;
  const detailsBtn = document.createElement('button');
  detailsBtn.type = 'button';
  detailsBtn.className = 'terminal-details-btn';
  detailsBtn.textContent = 'DETAILS';
  detailsBtn.hidden = true;
  detailsBtn.addEventListener('click', () => { detailsExpanded = !detailsExpanded; renderOpenControls(); scheduleFit(); });
  header.appendChild(detailsBtn);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'terminal-refresh-btn';
  refreshBtn.textContent = 'REFRESH';
  refreshBtn.addEventListener('click', () => {
    void refreshProviders();
    void refreshSessions();
    void refreshHistory();
    if (controlConfirmed) void recoverOutput();
  });
  header.appendChild(refreshBtn);

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
      card.appendChild(el('div', 'terminal-provider-shells', p.shells.map(s => s.runtimeState ? `${s.label} [${s.runtimeState.toUpperCase()}]` : s.label).join(' \u00b7 ')));
    }
    return card;
  }

  function renderOpenControls(): void {
    const hasSession = activeSessionId !== null;
    root.classList.toggle('terminal-session-focused', hasSession && !detailsExpanded);
    detailsBtn.hidden = !hasSession;
    detailsBtn.setAttribute('aria-expanded', String(detailsExpanded));
    detailsBtn.setAttribute('aria-label', `${detailsExpanded ? 'Hide' : 'Show'} terminal details`);
    openControls.innerHTML = '';
    if (activeSessionId !== null || resumeInProgress || openInProgress) {
      openControls.appendChild(el('div', 'panel-empty', 'A terminal session is active. Stop it before opening another session.'));
      return;
    }
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
    for (const s of activeProvider.shells) shellSelect.add(new Option(s.runtimeState ? `${s.label} [${s.runtimeState.toUpperCase()}]` : s.label, s.id));
    shellSelect.value = activeProvider.shells[0]!.id;
    shellWrap.appendChild(shellSelect);
    bar.appendChild(shellWrap);
    const btnRow = el('div', 'terminal-open-actions');
    btnRow.appendChild(openButton);
    bar.appendChild(btnRow);
    openControls.appendChild(bar);
  }

  function renderResumeCandidates(sessions: TerminalSessionInfoT[]): void {
    resumeStrip.innerHTML = '';
    if (activeSessionId !== null) return;
    const running = sessions.filter(session => session.state === 'running' && (!view || view.bindings.availableTo(view.viewId, session.sessionId)));
    if (running.length === 0) return;
    resumeStrip.appendChild(el('div', 'panel-section-title', 'RUNNING SESSIONS · AUTHORITY REATTACH REQUIRED'));
    for (const session of running) {
      const row = el('div', 'terminal-resume-row');
      const details = el('div', 'terminal-resume-details');
      details.appendChild(el('span', 'terminal-resume-identity', `SESSION ${session.sessionId.slice(0, 8)}`));
      details.appendChild(el('span', 'terminal-resume-shell', `${session.provider} · ${session.shell} · ${new Date(session.createdAt).toLocaleTimeString()}`));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'terminal-open-btn terminal-resume-btn';
      button.textContent = 'REATTACH';
      button.setAttribute('aria-label', `Reattach terminal session ${session.sessionId}`);
      button.addEventListener('click', () => { void resumeSession(session); });
      row.append(details, button);
      resumeStrip.appendChild(row);
    }
  }

  // --- session rendering ----------------------------------------------------
  function renderSessionLoading(): void {
    sessionShell.innerHTML = '';
    const stage = el('div', 'terminal-stage starting');
    stage.appendChild(el('div', 'panel-loading', 'Approved. Session registered \u2014 starting the shell\u2026'));
    sessionShell.appendChild(stage);
  }

  function renderSessionShell(): void {
    sessionShell.innerHTML = '';
    if (activeSessionId === null) return;
    const stage = el('div', `terminal-stage ${controlConfirmed ? 'running' : 'awaiting-approval'}`);
    if (!controlConfirmed) stage.appendChild(el('div', 'terminal-session-state', 'REATTACH APPROVAL REQUIRED'));
    const metaRow = el('div', 'terminal-session-meta-row');
    const meta = el('div', 'terminal-session-meta');
    meta.appendChild(el('span', 'terminal-session-meta-item', activeProvider?.label ?? 'session'));
    meta.appendChild(el('span', 'terminal-session-meta-item', `session=${activeSessionId.slice(0, 8)}`));
    metaRow.appendChild(meta);
    stopButton = document.createElement('button');
    stopButton.type = 'button';
    stopButton.className = 'terminal-stop-btn';
    stopButton.textContent = 'STOP SESSION';
    stopButton.disabled = !controlConfirmed;
    stopButton.addEventListener('click', () => { void stopSession(); });
    metaRow.appendChild(stopButton);
    stage.appendChild(metaRow);
    const termHost = el('div', 'terminal-xterm');
    termElement = termHost;
    stage.appendChild(termHost);
    sessionShell.appendChild(stage);

    const appearance = theme?.preferences() ?? DEFAULT_APPEARANCE;
    const refreshedTerm = new XTerm({
      cursorBlink: appearance.cursorBlink,
      cursorStyle: appearance.cursorStyle,
      fontSize: appearance.fontSize,
      lineHeight: appearance.lineHeight,
      fontFamily: `'${appearance.terminalFont.replaceAll("'", '')}', Consolas, monospace`,
      scrollback: 5000,
      disableStdin: !controlConfirmed || resumeInProgress || outputReplayInProgress || !transportConnected,
      theme: terminalThemeFor(appearance)
    });
    const addon = new FitAddon();
    refreshedTerm.loadAddon(addon);
    refreshedTerm.open(termHost);
    refreshedTerm.onData(data => {
      if (alive && xterm === refreshedTerm && controlConfirmed && !resumeInProgress && !outputReplayInProgress && transportConnected && activeSessionId !== null) bus?.send({ type: 'terminal', sessionId: activeSessionId, action: 'input', data });
    });
    xterm = refreshedTerm;
    fitAddon = addon;
    windowsResizeHandler = scheduleFit;
    window.addEventListener('resize', windowsResizeHandler);
    resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(termHost);
    scheduleFit();
    refreshedTerm.focus();
  }

  function outputStatus(message: string): void {
    let status = sessionShell.querySelector('.terminal-output-status');
    if (!status) { status = el('div', 'terminal-output-status'); sessionShell.firstElementChild?.prepend(status); }
    status.textContent = message;
  }

  async function restoreOutput(snapshot: TerminalOutputSnapshotT): Promise<boolean> {
    if (snapshot.sessionId !== activeSessionId || !xterm) throw new Error('output snapshot session identity mismatch');
    const terminal = xterm, generation = ++outputReplayGeneration;
    const result = outputProjection.restore(snapshot);
    outputReplayInProgress = true;
    synchronizeInput();
    terminal.reset();
    // xterm parses asynchronously and can emit device-query replies through onData.
    // Historical output is display data; it must not manufacture live PTY input.
    await new Promise<void>(resolve => {
      finishReplay = resolve;
      terminal.write(result.reset + result.append, resolve);
    });
    if (!alive || xterm !== terminal || generation !== outputReplayGeneration || activeSessionId !== snapshot.sessionId) return false;
    finishReplay = null;
    outputReplayInProgress = false;
    synchronizeInput();
    outputStatus(snapshot.truncated ? 'RESTORED · bounded history was truncated' : 'OUTPUT SYNCHRONIZED');
    return result.needsSnapshot;
  }

  async function recoverOutput(attempt = 0): Promise<void> {
    if (!alive || !controlConfirmed || resumeInProgress || activeSessionId === null || !xterm || outputRecoveryInProgress) return;
    if (typeof api.terminalSessionOutput !== 'function') { legacyOutput = true; outputStatus('LIVE OUTPUT ONLY · replay snapshot unsupported'); return; }
    const id = activeSessionId, generation = ++outputRecoveryGeneration;
    let retryNeeded = false;
    outputRecoveryInProgress = true;
    outputProjection.beginSnapshot();
    outputStatus('RESTORING OUTPUT');
    try {
      const snapshot = await api.terminalSessionOutput(id);
      if (!alive || activeSessionId !== id || generation !== outputRecoveryGeneration) return;
      legacyOutput = false;
      retryNeeded = await restoreOutput(snapshot);
    } catch (error) {
      if (!alive || activeSessionId !== id || generation !== outputRecoveryGeneration) return;
      if ((error as { code?: string }).code === 'FORBIDDEN') {
        renderSessionEnded('Session output denied. Refresh to request governed reattachment.');
        void refreshSessions();
      } else if ((error as { code?: string }).code === 'NOT_FOUND') {
        legacyOutput = true;
        outputStatus('LIVE OUTPUT ONLY · replay snapshot unsupported');
      } else outputStatus('OUTPUT STALE · recovery failed; use REFRESH to retry');
    } finally {
      if (generation === outputRecoveryGeneration) {
        outputRecoveryInProgress = false;
        if (retryNeeded && attempt < 2) void recoverOutput(attempt + 1);
        else if (retryNeeded) outputStatus('OUTPUT STALE · buffer gap persists; use REFRESH to retry');
      }
    }
  }

  function scheduleFit(): void {
    if (!alive || fitFrame !== null) return;
    fitFrame = window.requestAnimationFrame(() => {
      fitFrame = null;
      if (!alive || !termElement?.isConnected || termElement.clientWidth <= 0 || termElement.clientHeight <= 0 || !xterm || !fitAddon) return;
      fitAddon.fit();
      if (controlConfirmed && !resumeInProgress && activeSessionId !== null) {
        bus?.send({ type: 'terminal', sessionId: activeSessionId, action: 'resize', cols: xterm.cols, rows: xterm.rows });
      }
    });
  }

  function releaseBinding(): void {
    if (activeSessionId !== null && view) view.bindings.release(view.viewId, activeSessionId);
  }

  function disposeSessionView(): void {
    outputReplayGeneration++;
    outputReplayInProgress = false;
    finishReplay?.();
    finishReplay = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    termElement = null;
    if (fitFrame !== null) window.cancelAnimationFrame(fitFrame);
    fitFrame = null;
    if (windowsResizeHandler) window.removeEventListener('resize', windowsResizeHandler);
    windowsResizeHandler = null;
    if (xterm) {
      try { xterm.dispose(); } catch { /* already disposed */ }
      xterm = null;
    }
    fitAddon = null;
    stopButton = null;
  }

  function renderSessionEnded(message: string): void {
    disposeSessionView();
    sessionShell.innerHTML = '';
    const stage = el('div', 'terminal-stage gone');
    stage.appendChild(el('div', 'panel-empty', message));
    sessionShell.appendChild(stage);
    releaseBinding();
    activeSessionId = null;
    controlConfirmed = false;
    outputRecoveryGeneration++;
    outputRecoveryInProgress = false;
    outputProjection = new TerminalOutputProjection();
    sessionsInitialized = false;
    renderOpenControls();
  }

  function setBusy(text: string): void {
    sessionShell.innerHTML = '';
    sessionShell.appendChild(el('div', 'panel-loading', text));
  }

  // --- actions ----------------------------------------------------------------
  async function refreshProviders(): Promise<void> {
    if (!alive) return;
    const generation = ++providerRefreshGeneration;
    providerStrip.innerHTML = '<div class="panel-loading">Probing runtime providers\u2026</div>';
    let infos: TerminalProviderInfoT[];
    try {
      infos = (await api.terminalProviders()).providers;
    } catch (e) {
      if (!alive || generation !== providerRefreshGeneration) return;
      providerStrip.innerHTML = '';
      providerStrip.appendChild(el('div', 'panel-error', `Provider probe failed: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    if (!alive || generation !== providerRefreshGeneration) return;
    providers = infos;
    providerStrip.innerHTML = '';
    providerEls.clear();
    for (const p of infos) {
      const card = renderProviderState(p);
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
    if (!alive || activeProvider === null || activeSessionId !== null || resumeInProgress || openInProgress) return;
    openInProgress = true;
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
      if (!alive) return; // Canonical service retains the admitted session for governed recovery.
      if (view && !view.bindings.claim(view.viewId, opened.session.sessionId)) throw new Error('Session is already displayed in another terminal window');
      activeSessionId = opened.session.sessionId;
      controlConfirmed = true;
      outputProjection = new TerminalOutputProjection();
      legacyOutput = false;
      renderResumeCandidates([]);
      renderOpenControls();
      sessionsInitialized = opened.session.state === 'running';
      if (sessionsInitialized) renderSessionShell();
      else renderSessionLoading();
      void refreshSessions();
      if (sessionsInitialized) void recoverOutput();
    } catch (e) {
      if (!alive) return;
      releaseBinding();
      activeSessionId = null;
      controlConfirmed = false;
      sessionShell.innerHTML = '';
      sessionShell.appendChild(el('div', 'panel-error', `Session not opened: ${e instanceof Error ? e.message : String(e)}`));
      renderOpenControls();
    } finally {
      openInProgress = false;
      openButton.disabled = false;
      if (alive) renderOpenControls();
    }
  }

  async function resumeSession(candidate: TerminalSessionInfoT): Promise<void> {
    if (!alive || activeSessionId !== null || resumeInProgress || openInProgress || candidate.state !== 'running') return;
    if (view && !view.bindings.claim(view.viewId, candidate.sessionId)) return;
    let recoveryNeeded = false;
    controlConfirmed = false;
    legacyOutput = false;
    outputProjection = new TerminalOutputProjection();
    resumeInProgress = true;
    activeSessionId = candidate.sessionId;
    renderResumeCandidates([]);
    renderOpenControls();
    activeProvider = providers.find(provider => provider.id === candidate.provider) ?? null;
    sessionsInitialized = true;
    renderSessionShell();
    try {
      const resumed = await api.terminalSessionResume(candidate.sessionId, candidate.owner);
      if (!alive || activeSessionId !== candidate.sessionId) return;
      if (resumed.session.sessionId !== candidate.sessionId || resumed.session.state !== 'running') {
        throw new Error('resume response identity or state mismatch');
      }
      if (resumed.output) recoveryNeeded = await restoreOutput(resumed.output);
      else { legacyOutput = true; outputStatus('LIVE OUTPUT ONLY · replay snapshot unsupported'); }
      if (!alive || activeSessionId !== candidate.sessionId || !xterm) return;
      controlConfirmed = true;
      synchronizeInput();
      if (stopButton) stopButton.disabled = false;
      const stage = sessionShell.querySelector('.terminal-stage');
      stage?.classList.remove('awaiting-approval');
      stage?.classList.add('running');
      await refreshSessions();
    } catch (error) {
      if (alive && activeSessionId === candidate.sessionId) {
        renderSessionEnded(`Reattach refused or unavailable · ${String((error as Error).message ?? error).slice(0, 180)}`);
        void refreshSessions();
      }
    } finally {
      resumeInProgress = false;
      if (alive) { synchronizeInput(); renderOpenControls(); scheduleFit(); if (controlConfirmed && recoveryNeeded) void recoverOutput(); }
    }
  }

  async function stopSession(): Promise<void> {
    if (!alive || !controlConfirmed || resumeInProgress || activeSessionId === null) return;
    const id = activeSessionId;
    disposeSessionView();
    setBusy('Stopping session\u2026');
    try {
      const stopped = await api.terminalSessionStop(id);
      if (!alive || activeSessionId !== id) return;
      if (stopped.sessionId !== id) throw new Error('stop response session identity mismatch');
      await refreshSessions();
    } catch (e) {
      if (!alive || activeSessionId !== id) return;
      sessionShell.innerHTML = '';
      sessionShell.appendChild(el('div', 'panel-error', `Stop failed: ${e instanceof Error ? e.message : String(e)}`));
      if (activeSessionId !== null) renderSessionShell();
    }
  }

  async function refreshSessions(): Promise<void> {
    if (!alive) return;
    const generation = ++sessionRefreshGeneration;
    let sessions: TerminalSessionInfoT[];
    try {
      sessions = (await api.terminalSessions()).sessions;
    } catch { return; }
    if (!alive || generation !== sessionRefreshGeneration) return;
    if (activeSessionId === null) {
      renderResumeCandidates(sessions);
      return;
    }
    const mine = sessions.find(s => s.sessionId === activeSessionId);
    if (!mine) {
      renderSessionEnded('Session ended. Open a new one from the provider bar.');
      renderResumeCandidates(sessions);
      return;
    }
    if (mine.state === 'stopped' || mine.state === 'disposed') {
      renderSessionEnded(`Session ${mine.state}. Open a new one from the provider bar.`);
      renderResumeCandidates(sessions);
      return;
    }
    if (mine.state === 'running' && !sessionsInitialized) {
      sessionsInitialized = true;
      renderSessionShell();
      if (controlConfirmed) void recoverOutput();
    }
    const stateLab = `${controlConfirmed ? mine.state.toUpperCase() : 'REATTACH APPROVAL REQUIRED'}${mine.exitCode !== null ? ` \u00b7 exit ${mine.exitCode}` : ''}${mine.cleanup !== 'clean' ? ` \u00b7 cleanup=${mine.cleanup}` : ''}`;
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
    if (event.kind === 'output' && xterm) {
      if (event.endOffset === undefined) {
        if (legacyOutput || controlConfirmed) { legacyOutput = true; xterm.write(event.data); outputStatus('LIVE OUTPUT ONLY · stream offsets unavailable'); }
      } else {
        const result = outputProjection.accept({ data: event.data, endOffset: event.endOffset });
        if (result.append) xterm.write(result.append);
        if (result.needsSnapshot && controlConfirmed) void recoverOutput();
      }
    }
    else if (event.kind === 'state' && event.state === 'running' && !sessionsInitialized) {
      sessionsInitialized = true;
      renderSessionShell();
      if (controlConfirmed) void recoverOutput();
    } else if (event.kind === 'state' && (event.state === 'stopped' || event.state === 'disposed')) {
      sessionsInitialized = true;
      void refreshSessions();
    } else if (event.kind === 'exit') {
      sessionsInitialized = true;
      if (xterm) xterm.write(`\r\n[session exited ${event.exitCode}; cleanup=${event.cleanup}]\r\n`);
    } else if (event.kind === 'error' && xterm) {
      xterm.write(`\r\n[terminal: ${event.message}]\r\n`);
    }
  });
  const unsubscribeSubscribed = bus?.onSubscribed?.('terminal', () => { if (controlConfirmed) void recoverOutput(); });
  const unsubscribeStatus = bus?.subscribeStatus?.(connected => {
    transportConnected = connected;
    if (!xterm || !controlConfirmed) return;
    synchronizeInput();
    if (!connected) outputStatus('OUTPUT STALE · event socket disconnected; input paused');
  });
  const appearanceChanged = (): void => {
    const current = theme?.preferences();
    if (xterm === null || current === undefined) return;
    xterm.options.cursorBlink = current.cursorBlink;
    xterm.options.cursorStyle = current.cursorStyle;
    xterm.options.fontSize = current.fontSize;
    xterm.options.lineHeight = current.lineHeight;
    xterm.options.fontFamily = `'${current.terminalFont.replaceAll("'", '')}', Consolas, monospace`;
    xterm.options.theme = terminalThemeFor(current);
    scheduleFit();
  };
  document.addEventListener('covert:appearance-changed', appearanceChanged);

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
    const generation = ++historyRefreshGeneration;
    body.innerHTML = '<div class="panel-loading">Loading task status\u2026</div>';
    let res: TaskStatusResponseT;
    try {
      res = await api.tasksStatus();
    } catch (e) {
      if (!alive || generation !== historyRefreshGeneration) return;
      body.innerHTML = '';
      body.appendChild(el('div', 'panel-error', `Failed to load: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    if (!alive || generation !== historyRefreshGeneration) return;
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
  void refreshSessions();
  const refreshAfterAuthorityPairing = (): void => {
    void refreshProviders();
    void refreshHistory();
    void refreshSessions();
  };
  document.addEventListener('covert:authority-paired', refreshAfterAuthorityPairing);
  const interval = window.setInterval(() => {
    if (parent.isConnected && !parent.closest<HTMLElement>('.desktop-window')?.hidden) void refreshHistory();
  }, 5000);

  return {
    activate: scheduleFit,
    dispose() {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener('covert:authority-paired', refreshAfterAuthorityPairing);
      document.removeEventListener('covert:appearance-changed', appearanceChanged);
      unsubscribe?.();
      unsubscribeSubscribed?.();
      unsubscribeStatus?.();
      outputRecoveryGeneration++;
      releaseBinding();
      controlConfirmed = false;
      disposeSessionView();
      parent.innerHTML = '';
    }
  };
}
