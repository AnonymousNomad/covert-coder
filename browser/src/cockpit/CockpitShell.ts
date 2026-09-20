// Covert Coder cockpit shell.
//
// This is the only live frontend shell. The center destinations are resolved
// through one typed registry; a destination is either mounted to an existing
// frontend surface or explicitly phase-gated.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import type { EditorHost } from '../editor/host.ts';
import { createTopbar } from '../shell/topbar.ts';
import { createNavigationRail, type NavigationRailHandles } from './NavigationRail.ts';
import { createResidentCore, type ResidentCoreHandles } from './ResidentCore.ts';
import { createModelLineup, type ModelLineupHandles } from './ModelLineup.ts';
import { createSystemTelemetry, type SystemTelemetryHandles } from './SystemTelemetry.ts';
import { createActivityTimeline, type ActivityTimelineHandles } from './ActivityTimeline.ts';
import { createBottomStrip, type BottomStripHandles } from './BottomStrip.ts';
import { createAmbientEffects } from './AmbientEffects.ts';
import { createCommandCenterPanel } from '../panels/command-center.ts';
import { createModelsPanel } from '../panels/models.ts';
import { createTerminalPanel } from '../panels/terminal.ts';
import { createVerificationPanel } from '../panels/verification.ts';
import { createSkillsPanel } from '../panels/skills.ts';
import { createMemoryPanel } from '../panels/memory.ts';
import { createSecurityPanel } from '../panels/security.ts';
import { createMobileProductionPanel } from '../panels/mobile-production.ts';
import { renderWorkflowStrip } from '../panels/workflow.ts';
import { createProjectsSurface, type ProjectsSurfaceHandles } from './ProjectsSurface.ts';
import { createSettingsSurface } from './SettingsSurface.ts';
import { createWalkthrough, type WalkthroughHandles } from './Walkthrough.ts';
import { createSetupSession, type SetupSessionHandles } from './SetupSession.ts';
import { showToast } from '../ui/toast.ts';

interface DisposablePanel {
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
  navigation: NavigationRailHandles;
  resident: ResidentCoreHandles;
  modelLineup: ModelLineupHandles;
  telemetry: SystemTelemetryHandles;
  activity: ActivityTimelineHandles;
  bottom: BottomStripHandles;
  editorMount: HTMLElement;
  editorWorkspace: HTMLElement;
  searchMount: HTMLElement;
  statusRoot: HTMLElement;
  lspStatus: HTMLElement;
  notify(code: string, message: string): void;
  walkthrough: WalkthroughHandles;
  setup: SetupSessionHandles;
  setEditorHost(host: EditorHost): void;
}

const PANEL_IDS: Panel[] = [
  'command-center',
  'resident',
  'projects',
  'editor',
  'terminal',
  'models',
  'skills',
  'memory',
  'verification',
  'security',
  'mobile-production',
  'extensions',
  'settings'
];

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function lazyPanel(root: HTMLElement, factory: () => DisposablePanel, activate: () => void = (): void => {}): PanelRegistration {
  let handle: DisposablePanel | null = null;
  return {
    root,
    mount(): void {
      if (handle === null) handle = factory();
    },
    activate,
    dispose(): void {
      handle?.dispose();
      handle = null;
      root.innerHTML = '';
    }
  };
}

function phaseGatedPanel(parent: HTMLElement, title: string, maturity: string, message: string): DisposablePanel {
  parent.innerHTML = '';
  const root = el('div', 'panel-content cockpit-phase-gated');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', title));
  header.appendChild(el('span', 'panel-maturity', maturity));
  root.appendChild(header);
  const body = el('section', 'panel-empty');
  body.appendChild(el('div', 'panel-empty-glyph', '\u25c7'));
  body.appendChild(el('h3', 'panel-empty-title', 'PHASE-GATED'));
  body.appendChild(el('p', 'panel-empty-detail', message));
  root.appendChild(body);
  parent.appendChild(root);
  return { dispose: () => { parent.innerHTML = ''; } };
}

export function mountCockpit(app: HTMLElement, store: Store<AppState>): CockpitHandles {
  app.innerHTML = `
    <div class="cockpit-shell">
      <div class="cockpit-ambient" aria-hidden="true"></div>
      <header class="cockpit-topbar" id="cockpit-topbar"></header>
      <main class="cockpit-main">
        <nav class="cockpit-nav" id="cockpit-nav" aria-label="Workspace navigation"></nav>
        <section class="cockpit-center" id="cockpit-center" aria-label="Cockpit workspace">
          <div class="cockpit-center-surface" id="cockpit-center-surface">
            <section class="cockpit-panel-stage cockpit-command-stage" id="cockpit-command-stage" data-panel="command-center">
              <div class="cockpit-command-layout">
                <div class="cockpit-resident-mount" id="cockpit-resident-mount"></div>
                <div class="cockpit-command-center-mount" id="cockpit-command-center-mount"></div>
              </div>
              <div class="cockpit-workflow-mount" id="cockpit-workflow-mount"></div>
            </section>
            <section class="cockpit-panel-stage" id="cockpit-projects-stage" data-panel="projects"></section>
            <section class="cockpit-panel-stage" id="cockpit-terminal-stage" data-panel="terminal"></section>
            <section class="cockpit-panel-stage" id="cockpit-models-stage" data-panel="models"></section>
            <section class="cockpit-panel-stage" id="cockpit-skills-stage" data-panel="skills"></section>
            <section class="cockpit-panel-stage" id="cockpit-memory-stage" data-panel="memory"></section>
            <section class="cockpit-panel-stage" id="cockpit-verification-stage" data-panel="verification"></section>
            <section class="cockpit-panel-stage" id="cockpit-security-stage" data-panel="security"></section>
            <section class="cockpit-panel-stage" id="cockpit-mobile-production-stage" data-panel="mobile-production"></section>
            <section class="cockpit-panel-stage" id="cockpit-extensions-stage" data-panel="extensions"></section>
            <section class="cockpit-panel-stage" id="cockpit-settings-stage" data-panel="settings"></section>
            <section class="cockpit-editor-mount" id="cockpit-editor-mount" data-panel="editor" hidden>
              <div class="cockpit-editor-layout">
                <div class="cockpit-editor-workspace" id="cockpit-editor-workspace"></div>
                <aside class="cockpit-editor-search" id="cockpit-editor-search" aria-label="Workspace search"></aside>
              </div>
            </section>
          </div>
        </section>
        <aside class="cockpit-intel" id="cockpit-intel" aria-label="Intelligence column">
          <button class="cockpit-intel-close" type="button">CLOSE INTELLIGENCE</button>
          <section class="cockpit-intel-slot" id="cockpit-intel-models" aria-label="Model lineup"></section>
          <section class="cockpit-intel-slot" id="cockpit-intel-telemetry" aria-label="System telemetry"></section>
          <section class="cockpit-intel-slot" id="cockpit-intel-activity" aria-label="Recent activity"></section>
        </aside>
      </main>
      <footer class="cockpit-bottom" id="cockpit-bottom"></footer>
      <div class="cockpit-status-mount" id="cockpit-status" aria-live="polite">
        <span id="cockpit-lsp-status">LSP: UNKNOWN</span>
      </div>
    </div>
  `;

  const topbarHost = app.querySelector<HTMLElement>('#cockpit-topbar');
  const navHost = app.querySelector<HTMLElement>('#cockpit-nav');
  const commandStage = app.querySelector<HTMLElement>('#cockpit-command-stage');
  const residentMount = app.querySelector<HTMLElement>('#cockpit-resident-mount');
  const commandCenterMount = app.querySelector<HTMLElement>('#cockpit-command-center-mount');
  const workflowMount = app.querySelector<HTMLElement>('#cockpit-workflow-mount');
  const projectsStage = app.querySelector<HTMLElement>('#cockpit-projects-stage');
  const terminalStage = app.querySelector<HTMLElement>('#cockpit-terminal-stage');
  const modelsStage = app.querySelector<HTMLElement>('#cockpit-models-stage');
  const skillsStage = app.querySelector<HTMLElement>('#cockpit-skills-stage');
  const memoryStage = app.querySelector<HTMLElement>('#cockpit-memory-stage');
  const verificationStage = app.querySelector<HTMLElement>('#cockpit-verification-stage');
  const securityStage = app.querySelector<HTMLElement>('#cockpit-security-stage');
  const mobileProductionStage = app.querySelector<HTMLElement>('#cockpit-mobile-production-stage');
  const extensionsStage = app.querySelector<HTMLElement>('#cockpit-extensions-stage');
  const settingsStage = app.querySelector<HTMLElement>('#cockpit-settings-stage');
  const editorMount = app.querySelector<HTMLElement>('#cockpit-editor-mount');
  const editorWorkspace = app.querySelector<HTMLElement>('#cockpit-editor-workspace');
  const searchMount = app.querySelector<HTMLElement>('#cockpit-editor-search');
  const modelSlot = app.querySelector<HTMLElement>('#cockpit-intel-models');
  const telemetrySlot = app.querySelector<HTMLElement>('#cockpit-intel-telemetry');
  const activitySlot = app.querySelector<HTMLElement>('#cockpit-intel-activity');
  const bottomHost = app.querySelector<HTMLElement>('#cockpit-bottom');
  const statusRoot = app.querySelector<HTMLElement>('#cockpit-status');
  const lspStatus = app.querySelector<HTMLElement>('#cockpit-lsp-status');
  const ambientHost = app.querySelector<HTMLElement>('.cockpit-ambient');

  if (!topbarHost || !navHost || !commandStage || !residentMount || !commandCenterMount || !workflowMount || !projectsStage || !terminalStage || !modelsStage || !skillsStage || !memoryStage || !verificationStage || !securityStage || !mobileProductionStage || !extensionsStage || !settingsStage || !editorMount || !editorWorkspace || !searchMount || !modelSlot || !telemetrySlot || !activitySlot || !bottomHost || !statusRoot || !lspStatus || !ambientHost) {
    throw new Error('cockpit shell mounts failed');
  }

  const notify = (code: string, message: string): void => showToast(statusRoot, code, message);
  const walkthrough = createWalkthrough(app, store, { onToast: notify });
  const setup = createSetupSession(app, store, { onToast: notify, onNavigate: (panel) => store.set(prev => ({ ...prev, panel })) });
  const topbar = createTopbar(topbarHost, store);
  const intel = app.querySelector<HTMLElement>('#cockpit-intel')!;
  const intelToggle = app.querySelector<HTMLButtonElement>('.cockpit-intel-toggle')!;
  const closeIntel = (): void => {
    intel.classList.remove('is-open');
    intelToggle.setAttribute('aria-expanded', 'false');
    intelToggle.focus();
  };
  intelToggle.addEventListener('click', () => {
    const open = intel.classList.toggle('is-open');
    intelToggle.setAttribute('aria-expanded', String(open));
    if (open) intel.querySelector<HTMLButtonElement>('.cockpit-intel-close')?.focus();
  });
  intel.querySelector('.cockpit-intel-close')?.addEventListener('click', closeIntel);
  intel.addEventListener('keydown', event => { if (event.key === 'Escape') closeIntel(); });
  const navigation = createNavigationRail(navHost, store);
  const resident = createResidentCore(residentMount, store, { onToast: notify });
  const modelLineup = createModelLineup(modelSlot, store);
  const telemetry = createSystemTelemetry(telemetrySlot, store);
  const activity = createActivityTimeline(activitySlot, store);
  const bottom = createBottomStrip(bottomHost, store);
  createAmbientEffects(ambientHost);

  let projects: ProjectsSurfaceHandles | null = null;
  let editorHost: EditorHost | null = null;

  const commandCenter = lazyPanel(commandCenterMount, () => createCommandCenterPanel(commandCenterMount, store));
  const workflow = lazyPanel(workflowMount, () => renderWorkflowStrip(workflowMount, store));
  const projectsRegistration = lazyPanel(projectsStage, () => {
    projects = createProjectsSurface(projectsStage, store, { onToast: notify });
    if (editorHost !== null) projects.setEditorHost(editorHost);
    return projects;
  });
  const terminal = lazyPanel(terminalStage, () => createTerminalPanel(terminalStage, store));
  const models = lazyPanel(modelsStage, () => createModelsPanel(modelsStage, store));
  const skills = lazyPanel(skillsStage, () => createSkillsPanel(skillsStage, store));
  const memory = lazyPanel(memoryStage, () => createMemoryPanel(memoryStage, store));
  const verification = lazyPanel(verificationStage, () => createVerificationPanel(verificationStage, store));
  const security = lazyPanel(securityStage, () => createSecurityPanel(securityStage, store));
  const mobileProduction = lazyPanel(mobileProductionStage, () => createMobileProductionPanel(mobileProductionStage, store));
  const extensions = lazyPanel(extensionsStage, () => phaseGatedPanel(extensionsStage, 'EXTENSIONS', 'DISABLED', 'The extension host is not integrated into this cockpit phase. No extension capability or authority is implied.'));
  const settings = lazyPanel(settingsStage, () => createSettingsSurface(settingsStage, store, { onToast: notify, onReopenWalkthrough: () => walkthrough.open(), onRunSetup: () => setup.open() }));

  const panelRegistry: Record<Panel, PanelRegistration> = {
    'command-center': {
      root: commandStage,
      mount(): void { commandCenter.mount(); workflow.mount(); },
      activate(): void {
        residentMount.hidden = false;
        commandCenterMount.hidden = false;
        workflowMount.hidden = false;
      },
      dispose(): void { commandCenter.dispose(); workflow.dispose(); }
    },
    resident: {
      root: commandStage,
      mount(): void {},
      activate(): void {
        residentMount.hidden = false;
        commandCenterMount.hidden = true;
        workflowMount.hidden = true;
      },
      dispose(): void {}
    },
    projects: projectsRegistration,
    editor: {
      root: editorMount,
      mount(): void {},
      activate(): void {},
      dispose(): void {}
    },
    terminal,
    models,
    skills,
    memory,
    verification,
    security,
    'mobile-production': mobileProduction,
    extensions,
    settings
  };

  function applyCenterPanel(panel: Panel): void {
    for (const panelId of PANEL_IDS) panelRegistry[panelId].root.hidden = true;
    const registration = panelRegistry[panel];
    registration.mount();
    registration.root.hidden = false;
    registration.activate();
    editorMount!.setAttribute('aria-hidden', panel === 'editor' ? 'false' : 'true');
    commandStage!.setAttribute('aria-hidden', panel === 'command-center' || panel === 'resident' ? 'false' : 'true');
    app.dataset.activePanel = panel;
  }

  let currentPanel = store.get().panel;
  const unbindCenter = store.subscribe((state) => {
    if (state.panel === currentPanel) return;
    currentPanel = state.panel;
    applyCenterPanel(state.panel);
    const stage = panelRegistry[state.panel].root;
    stage.classList.remove('cockpit-enter');
    requestAnimationFrame(() => stage.classList.add('cockpit-enter'));
  });
  applyCenterPanel(store.get().panel);

  window.addEventListener('unload', () => {
    unbindCenter();
    resident.dispose();
    modelLineup.dispose();
    telemetry.dispose();
    activity.dispose();
    bottom.dispose();
    for (const panelId of PANEL_IDS) panelRegistry[panelId].dispose();
  });

  return {
    topbar,
    navigation,
    resident,
    modelLineup,
    telemetry,
    activity,
    bottom,
    editorMount,
    editorWorkspace,
    searchMount,
    statusRoot,
    lspStatus,
    notify,
    walkthrough,
    setup,
    setEditorHost(host: EditorHost): void {
      editorHost = host;
      projects?.setEditorHost(host);
    }
  };
}
