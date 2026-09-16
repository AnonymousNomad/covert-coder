import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker';
import 'monaco-editor/editor/editor.main';
import '../../node_modules/monaco-editor/min/vs/editor/editor.main.css';
import { Store } from './store/store.ts';
import { INITIAL_STATE } from './store/state.ts';
import { api } from './services/api.ts';
import { SessionService } from './services/session.ts';
import { mountCockpit, type CockpitHandles } from './cockpit/CockpitShell.ts';
import './cockpit/cockpit.css';
import { createEditorHost, type EditorHost } from './editor/host.ts';
import { createGroups } from './editor/groups.ts';
import { createSearchPanel } from './editor/search.ts';
import { onDirtyChange, isDirty, openPaths } from './editor/models.ts';
import { ArchLspBridge, applyDiagnostics } from './editor/lsp-bridge.ts';
import { registerLspProviders } from './editor/lsp-providers.ts';
import type { DiagnosticsEventT } from '../../common/contracts/events.ts';
import type { LspStatusEventT } from '../../common/contracts/lsp.ts';
import type { ModelStatusResponseT } from '../../common/contracts/models.ts';
import type { ByokStatusResponseT } from '../../common/contracts/byok.ts';
import type { ClosedLoopStatusT } from '../../common/contracts/closed-loop.ts';

import { connectEvents } from './services/ws.ts';
import { facadeWebSocketUrl } from './services/runtime-config.ts';
import { initializeAuthority } from './services/authority.ts';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

function renderTabBar(tabBar: HTMLElement, groupId: string, host: EditorHost): void {
  tabBar.textContent = '';
  const paths = host.tabsIn(groupId);
  for (const relPath of paths) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab' + (host.activePath() === relPath ? ' active' : '') + (isDirty(relPath) ? ' dirty' : '');
    button.textContent = relPath.split('\\').pop() ?? relPath;
    button.title = relPath;
    button.addEventListener('click', () => host.activate(relPath));
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '\u00d7';
    close.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      void host.close(relPath);
    });
    button.appendChild(close);
    tabBar.appendChild(button);
  }
}

function renderAllTabs(host: EditorHost): void {
  for (const group of host.groups()) renderTabBar(group.tabBar, group.id, host);
}

async function boot(): Promise<void> {
  await initializeAuthority();
  const app = document.getElementById('app');
  if (app === null) throw new Error('#app missing');
  const store = new Store(INITIAL_STATE);
  const shell: CockpitHandles = mountCockpit(app, store);
  const session = new SessionService();

  // Editor mounts inside the cockpit center column.
  const groups = createGroups(shell.editorWorkspace, {
    onSplit: direction => {
      void host.split(direction);
    },
    onCloseGroup: () => {
      void host.closeGroup();
    }
  });
  const host = createEditorHost(groups, session, {
    confirmDirty: relPath => window.confirm(`${relPath} has unsaved changes. Close anyway?`),
    onTabChange: () => {
      renderAllTabs(host);
      if (openPaths().length > 0) session.set(() => host.captureSession());
    },
    onToast: shell.notify
  }, new ArchLspBridge());
  registerLspProviders(host);
  createSearchPanel(shell.searchMount, { host, onToast: shell.notify });
  shell.setEditorHost(host);
  shell.bottom.setOpenFile(path => { void host.open(path); });
  onDirtyChange(() => renderAllTabs(host));
  groups.onGroupsChange(() => renderAllTabs(host));

  const events = connectEvents(facadeWebSocketUrl('/ws'), {
    onStatus: connected => {
      shell.topbar.setDaemon({ label: connected ? 'ONLINE' : 'OFFLINE', reachable: connected });
    }
  });
  const lspStates: Record<string, string> = {};
  events.subscribe('log', data => {
    const event = data as { level?: string; message?: string; path?: string };
    if (event.level === 'error') shell.notify('INTERNAL', `daemon: ${event.message ?? 'error'}${event.path ? ` (${event.path})` : ''}`);
  });
  events.subscribe('diagnostics', data => {
    const event = data as DiagnosticsEventT;
    applyDiagnostics(event);
    shell.bottom.setLatestDiagnostics({ uri: event.uri, markers: event.markers });
  });
  events.subscribe('lsp-status', data => {
    const event = data as LspStatusEventT;
    lspStates[event.languageId] = event.status;
    renderLspStatus(shell, lspStates);
  });

  try {
    const health = await api.health();
    store.set(prev => ({ ...prev, booted: true, health }));
    shell.topbar.setDaemon({ label: 'ONLINE', reachable: true });
  } catch (error) {
    shell.topbar.setDaemon({ label: 'DOWN', reachable: false });
    shell.notify('NOT_READY', error instanceof Error ? error.message : 'daemon unreachable');
    return;
  }

  try {
    await session.restore();
    await host.restoreSession(session.current);
    store.set(prev => ({ ...prev, session: session.current }));
  } catch {
    // restore is best-effort
  }
  renderAllTabs(host);

  try {
    const workspace = await api.workspaceList();
    store.set(prev => ({ ...prev, workspace }));
  } catch {
    // workspace listing is best-effort
  }

  void wireTopbarToBackends(shell);
  void refreshLspStatus(shell, lspStates);

  window.addEventListener('pagehide', () => {
    session.set(() => host.captureSession());
    void session.flush();
    events.dispose();
  });
}

async function wireTopbarToBackends(shell: CockpitHandles): Promise<void> {
  void refreshEngineChip(shell);
  void refreshCloudChip(shell);
  void refreshHarnessChip(shell);
  void refreshVerificationChip(shell);
  void refreshModes(shell);
}

async function refreshModes(shell: CockpitHandles): Promise<void> {
  // Mode derivation from real backend state only:
  //   PRIVATE   = BYOK consent disabled (no egress consented)
  //   LOCAL     = daemon health reachable (the daemon runs on 127.0.0.1)
  //   VERIFIABLE = audit bus reachable (verification evidence infrastructure exists)
  let privateMode: boolean | null = null;
  let localMode: boolean | null = null;
  let verifiable: boolean | null = null;

  try {
    const byok = await api.byokStatus();
    privateMode = !byok.consent_enabled;
  } catch { privateMode = null; }

  try {
    await api.health();
    localMode = true;
  } catch { localMode = false; }

  try {
    await api.auditRead({ limit: 1 });
    verifiable = true;
  } catch { verifiable = false; }

  shell.topbar.setModes({ private: privateMode, local: localMode, verifiable });
}

async function refreshEngineChip(shell: CockpitHandles): Promise<void> {
  let res: ModelStatusResponseT;
  try { res = await api.modelsStatus(); }
  catch {
    shell.topbar.setEngine({ label: 'NO MODEL READY', ready: false });
    return;
  }
  const readyModels = res.models.filter(m =>
    (m.status === 'ready' || m.status === 'running') &&
    m.runtime_available &&
    m.artifact_available
  );
  const readyCount = readyModels.length;
  const totalCount = res.models.length;
  if (readyCount === 0) {
    shell.topbar.setEngine({ label: totalCount > 0 ? `0 OF ${totalCount} MODELS READY` : 'NO MODEL READY', ready: false });
    return;
  }
  const label = totalCount > 0
    ? `${readyCount} OF ${totalCount} MODELS READY`
    : `${readyCount} MODEL${readyCount > 1 ? 'S' : ''} READY`;
  shell.topbar.setEngine({ label, ready: true });
}

async function refreshCloudChip(shell: CockpitHandles): Promise<void> {
  let res: ByokStatusResponseT;
  try { res = await api.byokStatus(); }
  catch { shell.topbar.setCloud('LOCAL_ONLY'); return; }
  if (!res.consent_enabled) {
    shell.topbar.setCloud('LOCAL_ONLY');
    return;
  }
  const providersWithKey = res.providers.filter(p => p.key_stored);
  if (providersWithKey.length === 0) {
    shell.topbar.setCloud('CREDENTIAL_MISSING');
    return;
  }
  shell.topbar.setCloud('REMOTE_CONFIGURED');
}

function renderLspStatus(shell: CockpitHandles, states: Record<string, string>): void {
  const entries = Object.entries(states);
  if (entries.length === 0) {
    shell.lspStatus.textContent = 'LSP: NONE REPORTED';
    return;
  }
  const available = entries.filter(([, state]) => state === 'running' || state === 'available').length;
  shell.lspStatus.textContent = `LSP: ${available}/${entries.length} AVAILABLE`;
}

async function refreshLspStatus(shell: CockpitHandles, states: Record<string, string>): Promise<void> {
  try {
    const status = await api.lspStatus();
    for (const server of status.servers) states[server.languageId] = server.status;
    renderLspStatus(shell, states);
  } catch {
    shell.lspStatus.textContent = 'LSP: UNAVAILABLE';
  }
}

async function refreshHarnessChip(shell: CockpitHandles): Promise<void> {
  let res: ClosedLoopStatusT;
  try { res = await api.closedLoopStatus(); }
  catch { shell.topbar.setHarness('STANDBY'); return; }
  if (!res.enabled) {
    shell.topbar.setHarness('STANDBY');
    return;
  }
  // No live current-running signal is exposed by /api/closed-loop/status
  // (enabled is configuration, last_run_logged_at is historical, no WS tick).
  // ON is intentionally never emitted today — a stale run is not operation.
  shell.topbar.setHarness('ENABLED');
}

async function refreshVerificationChip(shell: CockpitHandles): Promise<void> {
  // Truth-gate (Checkpoint 0 — final): the topbar reflects CURRENT UI scope.
  // Without a scope-correlation key (no current_session_id / current_bundle_id
  // exposed to the frontend, no workspace-scoped audit query), neither
  // unscoped positive NOR unscoped negative audit events may alter the
  // current-scope topbar. They remain visible in the VERIFY/AUDIT panels
  // for human review. The only workspace-scoped signal that may emit
  // DEGRADED on the topbar is ResidentPushSummary.verdict === 'ATTENTION_REQUIRED'
  // (ResidentPushSummary is workspace-scoped per its contract).
  let pushOk = false;
  let pushAttention = false;
  try {
    const push = (await api.residentPush()).push;
    pushOk = true;
    pushAttention = push.verdict === 'ATTENTION_REQUIRED';
  } catch {
    // push unavailable
  }
  if (pushOk && pushAttention) {
    shell.topbar.setVerification('DEGRADED');
    return;
  }
  // No scope-correlated positive or negative evidence exists today.
  // All audit-only signals (including most-recent agent.verification failure)
  // remain visible in the VERIFY/AUDIT panels but do not alter this topbar.
  shell.topbar.setVerification('UNVERIFIED');
}

void boot();
