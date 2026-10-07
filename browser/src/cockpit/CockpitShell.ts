// Covert's isolated sovereign desktop composition. Existing surfaces keep their
// service, authority, session, and runtime ownership; this module only hosts them.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import type { EditorHost } from '../editor/host.ts';
import { createTopbar } from '../shell/topbar.ts';
import { createResidentCore, type ResidentCoreHandles } from './ResidentCore.ts';
import { createModelLineup, type ModelLineupHandles } from './ModelLineup.ts';
import { createSystemTelemetry, type SystemTelemetryHandles } from './SystemTelemetry.ts';
import { createActivityTimeline, type ActivityTimelineHandles } from './ActivityTimeline.ts';
import { createBottomStrip, type BottomStripHandles } from './BottomStrip.ts';
import { createCommandCenterPanel } from '../panels/command-center.ts';
import { createCipherLaptopPanel } from '../panels/cipher-laptop.ts';
import { createModelsPanel } from '../panels/models.ts';
import { TerminalViewBindings } from '../desktop/terminal-view-bindings.ts';
import { createTerminalPanel } from '../panels/terminal.ts';
import { createVerificationPanel } from '../panels/verification.ts';
import { createSkillsPanel } from '../panels/skills.ts';
import { createMemoryPanel } from '../panels/memory.ts';
import { createSecurityPanel } from '../panels/security.ts';
import { renderWorkflowStrip } from '../panels/workflow.ts';
import { createProjectsSurface, type ProjectsSurfaceHandles } from './ProjectsSurface.ts';
import { createSettingsSurface } from './SettingsSurface.ts';
import { createWalkthrough, type WalkthroughHandles } from './Walkthrough.ts';
import { createSetupSession, type SetupSessionHandles } from './SetupSession.ts';
import { showToast } from '../ui/toast.ts';
import { loadLayoutState } from '../desktop/layout.ts';
import { WindowManager } from '../desktop/window-manager.ts';
import { WindowManagerView } from '../desktop/window-manager-view.ts';
import type { DesktopAppId } from '../desktop/types.ts';
import { createThemeEngine, type ThemeEngine } from '../desktop/theme.ts';
import { createCipherVoiceService, type CipherSpeechState, type CipherVoiceService } from '../desktop/cipher-voice.ts';

interface DisposablePanel {
  activate?(): void;
  dispose(): void;
}

interface PanelRegistration {
  root: HTMLElement;
  mount(): void;
  activate(): void;
  dispose(): void;
}

export interface CockpitHandles {
  topbar: ReturnType<typeof createTopbar>;
  resident: ResidentCoreHandles | null;
  modelLineup: ModelLineupHandles | null;
  telemetry: SystemTelemetryHandles | null;
  activity: ActivityTimelineHandles | null;
  bottom: BottomStripHandles;
  editorMount: HTMLElement;
  editorWorkspace: HTMLElement;
  searchMount: HTMLElement;
  statusRoot: HTMLElement;
  lspStatus: HTMLElement;
  notify(code: string, message: string): void;
  walkthrough: WalkthroughHandles;
  setup: SetupSessionHandles;
  theme: ThemeEngine;
  cipherVoice: CipherVoiceService;
  setEditorHost(host: EditorHost): void;
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appRoot(id: Panel): HTMLElement {
  const root = el('section', `desktop-app-root cockpit-panel-stage desktop-app-${id}`);
  root.dataset.panel = id;
  root.setAttribute('aria-label', `${id} application surface`);
  return root;
}

function lazyPanel(root: HTMLElement, factory: () => DisposablePanel, activate: () => void = (): void => {}): PanelRegistration {
  let handle: DisposablePanel | null = null;
  return {
    root,
    mount(): void {
      if (handle === null) handle = factory();
    },
    activate(): void { handle?.activate?.(); activate(); },
    dispose(): void {
      handle?.dispose();
      handle = null;
      root.replaceChildren();
    }
  };
}

function phaseGatedPanel(parent: HTMLElement, title: string, maturity: string, message: string): DisposablePanel {
  parent.replaceChildren();
  const root = el('div', 'panel-content cockpit-phase-gated');
  const header = el('header', 'panel-header');
  header.append(el('h2', 'panel-title', title), el('span', 'panel-maturity', maturity));
  root.appendChild(header);
  const body = el('section', 'panel-empty');
  body.append(el('div', 'panel-empty-glyph', '\u25c7'), el('h3', 'panel-empty-title', 'PHASE-GATED'), el('p', 'panel-empty-detail', message));
  root.appendChild(body);
  parent.appendChild(root);
  return { dispose: () => parent.replaceChildren() };
}

function safeLayoutStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function mountCockpit(app: HTMLElement, store: Store<AppState>): CockpitHandles {
  app.replaceChildren();
  const shell = el('div', 'cockpit-shell covert-desktop-shell');
  shell.dataset.theme = 'covert-phosphor';
  shell.innerHTML = `
    <div class="cockpit-ambient desktop-ambient" aria-hidden="true"></div>
    <div class="desktop-systembar" id="cockpit-topbar"></div>
    <main class="desktop-work-area" aria-label="Covert workstation">
      <aside class="desktop-application-rail" id="desktop-application-launcher" aria-label="Application launcher"></aside>
      <div class="desktop-workspace">
        <div class="desktop-window-layer" id="desktop-window-layer"></div>
        <div class="desktop-resident-anchor" id="desktop-resident-anchor"></div>
      </div>
    </main>
    <footer class="desktop-dock-wrap" id="desktop-dock" aria-label="Workstation taskbar"></footer>
    <div class="desktop-shell-status" id="cockpit-status" aria-live="polite">
      <span id="cockpit-lsp-status">LSP: UNKNOWN</span>
    </div>
    <div class="desktop-palette-host" id="desktop-palette-host"></div>
  `;
  app.appendChild(shell);
  const theme = createThemeEngine(shell);
  const cipherVoice = createCipherVoiceService();

  const topbarHost = shell.querySelector<HTMLElement>('#cockpit-topbar');
  const layer = shell.querySelector<HTMLElement>('#desktop-window-layer');
  const residentAnchor = shell.querySelector<HTMLElement>('#desktop-resident-anchor');
  const dock = shell.querySelector<HTMLElement>('#desktop-dock');
  const launcherHost = shell.querySelector<HTMLElement>('#desktop-application-launcher');
  const statusRoot = shell.querySelector<HTMLElement>('#cockpit-status');
  const lspStatus = shell.querySelector<HTMLElement>('#cockpit-lsp-status');
  const paletteHost = shell.querySelector<HTMLElement>('#desktop-palette-host');
  if (!topbarHost || !layer || !residentAnchor || !dock || !launcherHost || !statusRoot || !lspStatus || !paletteHost) {
    throw new Error('desktop shell mounts failed');
  }

  const topbar = createTopbar(topbarHost, store);
  const notify = (code: string, message: string): void => showToast(statusRoot, code, message);
  const stopSpeech = el('button', 'desktop-stop-speech', 'STOP CIPHER SPEECH') as HTMLButtonElement;
  stopSpeech.type = 'button';
  stopSpeech.setAttribute('aria-label', 'Stop Cipher speech immediately');
  stopSpeech.hidden = true;
  stopSpeech.addEventListener('click', () => cipherVoice.stopSpeaking());
  statusRoot.appendChild(stopSpeech);
  const speechStateChanged = (event: Event): void => {
    const state = (event as CustomEvent<CipherSpeechState>).detail;
    stopSpeech.hidden = state !== 'speaking';
  };
  document.addEventListener('covert:cipher-speech-state', speechStateChanged);
  const walkthrough = createWalkthrough(app, store, { onToast: notify });
  const setup = createSetupSession(app, store, { onToast: notify, onNavigate: panel => store.set(prev => ({ ...prev, panel })) });

  const editorMount = appRoot('editor');
  const editorLayout = el('div', 'cockpit-editor-layout');
  const editorWorkspace = el('div', 'cockpit-editor-workspace');
  editorWorkspace.id = 'cockpit-editor-workspace';
  const searchMount = el('aside', 'cockpit-editor-search');
  searchMount.id = 'cockpit-editor-search';
  searchMount.setAttribute('aria-label', 'Workspace search');
  editorLayout.append(editorWorkspace, searchMount);
  const shelfMount = el('div', 'desktop-workspace-shelf');
  editorMount.append(editorLayout, shelfMount);

  const residentRoot = appRoot('resident');
  const residentMount = el('div', 'cockpit-resident-mount');
  residentRoot.appendChild(residentMount);

  const commandRoot = appRoot('command-center');
  const commandLayout = el('div', 'desktop-command-layout');
  const commandCenterMount = el('div', 'cockpit-command-center-mount');
  const workflowMount = el('div', 'cockpit-workflow-mount');
  const insightColumn = el('aside', 'desktop-command-insights');
  const modelSlot = el('section', 'cockpit-intel-slot');
  modelSlot.setAttribute('aria-label', 'Model lineup');
  const telemetrySlot = el('section', 'cockpit-intel-slot');
  telemetrySlot.setAttribute('aria-label', 'System telemetry');
  const activitySlot = el('section', 'cockpit-intel-slot');
  activitySlot.setAttribute('aria-label', 'Recent activity');
  insightColumn.append(modelSlot, telemetrySlot, activitySlot);
  commandLayout.append(commandCenterMount, insightColumn);
  commandRoot.append(commandLayout, workflowMount);

  const projectsRoot = appRoot('projects');
  const terminalRoot = appRoot('terminal');
  const modelsRoot = appRoot('models');
  const resourcesRoot = appRoot('resources');
  const laptopRoot = appRoot('cipher-laptop');
  const skillsRoot = appRoot('skills');
  const memoryRoot = appRoot('memory');
  const verificationRoot = appRoot('verification');
  const securityRoot = appRoot('security');
  const extensionsRoot = appRoot('extensions');
  const settingsRoot = appRoot('settings');

  const bottom = createBottomStrip(shelfMount, store);
  let resident: ResidentCoreHandles | null = null;
  let modelLineup: ModelLineupHandles | null = null;
  let telemetry: SystemTelemetryHandles | null = null;
  let activity: ActivityTimelineHandles | null = null;
  let projects: ProjectsSurfaceHandles | null = null;
  let editorHost: EditorHost | null = null;
  const appearanceChanged = (): void => editorHost?.setAppearance(theme.preferences());
  document.addEventListener('covert:appearance-changed', appearanceChanged);

  const commandCenter = lazyPanel(commandCenterMount, () => createCommandCenterPanel(commandCenterMount, store));
  const workflow = lazyPanel(workflowMount, () => renderWorkflowStrip(workflowMount, store));
  const projectsPanel = lazyPanel(projectsRoot, () => {
    projects = createProjectsSurface(projectsRoot, store, { onToast: notify });
    if (editorHost !== null) projects.setEditorHost(editorHost);
    return projects;
  });
  const terminalBindings = new TerminalViewBindings();
  const terminal = lazyPanel(terminalRoot, () => createTerminalPanel(terminalRoot, store, theme, { viewId: 'terminal', bindings: terminalBindings }));
  const terminalInstances = new Map<string, PanelRegistration>([['terminal', terminal]]);
  const models = lazyPanel(modelsRoot, () => createModelsPanel(modelsRoot, store));
  const resources = lazyPanel(resourcesRoot, () => createSystemTelemetry(resourcesRoot, store));
  const laptop = lazyPanel(laptopRoot, () => createCipherLaptopPanel(laptopRoot));
  const skills = lazyPanel(skillsRoot, () => createSkillsPanel(skillsRoot, store));
  const memory = lazyPanel(memoryRoot, () => createMemoryPanel(memoryRoot, store));
  const verification = lazyPanel(verificationRoot, () => createVerificationPanel(verificationRoot, store));
  const security = lazyPanel(securityRoot, () => createSecurityPanel(securityRoot, store));
  const extensions = lazyPanel(extensionsRoot, () => phaseGatedPanel(extensionsRoot, 'EXTENSIONS', 'DISABLED', 'The extension host is not integrated into this phase. No extension capability or authority is implied.'));
  const settings = lazyPanel(settingsRoot, () => createSettingsSurface(settingsRoot, store, { onToast: notify, onReopenWalkthrough: () => walkthrough.open(), onRunSetup: () => setup.open(), theme, cipherVoice }));

  const commandRegistration: PanelRegistration = {
    root: commandRoot,
    mount(): void {
      commandCenter.mount();
      workflow.mount();
      if (modelLineup === null) modelLineup = createModelLineup(modelSlot, store);
      if (telemetry === null) telemetry = createSystemTelemetry(telemetrySlot, store);
      if (activity === null) activity = createActivityTimeline(activitySlot, store);
    },
    activate(): void {},
    dispose(): void {
      commandCenter.dispose();
      workflow.dispose();
      modelLineup?.dispose();
      telemetry?.dispose();
      activity?.dispose();
      modelLineup = null;
      telemetry = null;
      activity = null;
    }
  };
  const residentPanel: PanelRegistration = {
    root: residentRoot,
    mount(): void {
      if (resident === null) resident = createResidentCore(residentMount, store, { onToast: notify });
    },
    activate(): void {},
    dispose(): void {
      resident?.dispose();
      resident = null;
    }
  };
  const editorPanel: PanelRegistration = { root: editorMount, mount(): void {}, activate(): void {}, dispose(): void {} };

  const panels: Record<Panel, PanelRegistration> = {
    'command-center': commandRegistration,
    resident: residentPanel,
    projects: projectsPanel,
    editor: editorPanel,
    terminal,
    models,
    resources,
    'cipher-laptop': laptop,
    skills,
    memory,
    verification,
    security,
    extensions,
    settings
  };

  const storage = safeLayoutStorage();
  const loaded = loadLayoutState(storage);
  const manager = new WindowManager(loaded.state, storage);
  const view = new WindowManagerView({
    layer,
    dock,
    launcherHost,
    paletteHost,
    manager,
    onAttach(appId: DesktopAppId, content: HTMLElement, instanceId: string): void {
      let registration = panels[appId];
      if (appId === 'terminal') {
        let terminalInstance = terminalInstances.get(instanceId);
        if (!terminalInstance) {
          const root = appRoot('terminal');
          root.dataset.instanceId = instanceId;
          terminalInstance = lazyPanel(root, () => createTerminalPanel(root, store, theme, { viewId: instanceId, bindings: terminalBindings }));
          terminalInstances.set(instanceId, terminalInstance);
        }
        registration = terminalInstance;
      }
      registration.mount();
      registration.activate();
      registration.root.hidden = false;
      content.appendChild(registration.root);
    }
  });

  const residentPresence = document.createElement('button');
  residentPresence.type = 'button';
  residentPresence.className = 'desktop-resident-presence';
  residentPresence.setAttribute('aria-label', 'Open Cipher Console');
  residentPresence.title = 'Open Cipher Console';
  residentPresence.innerHTML = '<span class="desktop-resident-glyph" aria-hidden="true">◈</span><span class="desktop-resident-label">CIPHER</span><span class="desktop-resident-open">Open console</span>';
  residentPresence.addEventListener('click', () => manager.open('resident'));
  residentAnchor.appendChild(residentPresence);

  let currentPanel = store.get().panel;
  const unsubscribePanel = store.subscribe(state => {
    if (state.panel === currentPanel) return;
    currentPanel = state.panel;
    manager.open(currentPanel);
  });

  if (loaded.recovered) notify('LAYOUT_RESET', 'Saved desktop layout was invalid or unavailable. Coding layout restored.');

  let disposed = false;
  return {
    topbar,
    get resident() { return resident; },
    get modelLineup() { return modelLineup; },
    get telemetry() { return telemetry; },
    get activity() { return activity; },
    bottom,
    editorMount,
    editorWorkspace,
    searchMount,
    statusRoot,
    lspStatus,
    notify,
    walkthrough,
    setup,
    theme,
    cipherVoice,
    setEditorHost(host: EditorHost): void {
      editorHost = host;
      editorHost.setAppearance(theme.preferences());
      projects?.setEditorHost(host);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      document.removeEventListener('covert:cipher-speech-state', speechStateChanged);
      document.removeEventListener('covert:appearance-changed', appearanceChanged);
      unsubscribePanel();
      view.dispose();
      for (const [id, registration] of Object.entries(panels)) if (id !== 'terminal') registration.dispose();
      for (const registration of terminalInstances.values()) registration.dispose();
      terminalInstances.clear();
      theme.dispose();
      cipherVoice.dispose();
      bottom.dispose();
    }
  };
}
