import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { createTopbar, type TopbarHandles } from './topbar.ts';
import { createActivityBar, type ActivityBarHandles } from './activity-bar.ts';
import { createResidentDock, type ResidentDockHandles } from './resident-dock.ts';
import { createStatusBar, type StatusBarHandles } from './status-bar.ts';
import { renderWorkflowStrip } from '../panels/workflow.ts';

export interface Shell {
  editorRoot: HTMLElement;
  panelHost: HTMLElement;
  searchPanel: HTMLElement;
  workbenchesPanel: HTMLElement;
  residentPanel: HTMLElement;
  statusLeft: HTMLElement;
  statusRight: HTMLElement;
  lspStatus: HTMLElement;
  residentStatus: HTMLElement;
  topbar: TopbarHandles;
  activityBar: ActivityBarHandles;
  residentDock: ResidentDockHandles;
  statusBar: StatusBarHandles;
}

const PANEL_STAGES: Panel[] = [
  'command-center',
  'resident',
  'projects',
  'editor',
  'terminal',
  'models',
  'verification',
  'skills',
  'memory',
  'security',
  'extensions',
  'settings'
];

export function createShell(app: HTMLElement, store: Store<AppState>): Shell {
  app.innerHTML = `
    <div class="shell-root">
      <section class="shell-top" id="shell-top"></section>
      <section class="shell-middle">
        <div class="workbench">
          <nav class="activity-bar" id="activity-bar"></nav>
          <main class="main-column">
            <section class="workflow-strip-mount" id="workflow-strip-mount"></section>
            <div class="editor-column" id="editor-column">
              <div class="editor-root" id="editor-root"></div>
              <section class="panel-host" id="panel-host">
                <section class="panel-stage" data-panel="command-center" id="stage-command-center"></section>
                <section class="panel-stage" data-panel="resident" id="stage-resident">
                  <div class="resident-panel-root" id="resident-panel"></div>
                </section>
                <section class="panel-stage" data-panel="projects" id="stage-projects">
                  <div class="workbenches-panel-root" id="workbenches-panel"></div>
                </section>
                <section class="panel-stage" data-panel="terminal" id="stage-terminal"></section>
                <section class="panel-stage" data-panel="models" id="stage-models"></section>
                <section class="panel-stage" data-panel="verification" id="stage-verification"></section>
                <section class="panel-stage" data-panel="skills" id="stage-skills"></section>
                <section class="panel-stage" data-panel="memory" id="stage-memory"></section>
                <section class="panel-stage" data-panel="security" id="stage-security"></section>
              </section>
            </div>
          </main>
        </div>
        <aside class="dock-mount" id="dock-mount"></aside>
      </section>
      <section class="shell-bottom" id="shell-bottom"></section>
    </div>
  `;

  const shellTop = app.querySelector<HTMLElement>('#shell-top');
  const shellBottom = app.querySelector<HTMLElement>('#shell-bottom');
  const dockMount = app.querySelector<HTMLElement>('#dock-mount');
  const activityBarHost = app.querySelector<HTMLElement>('#activity-bar');
  const editorColumn = app.querySelector<HTMLElement>('#editor-column');
  const editorRoot = app.querySelector<HTMLElement>('#editor-root');
  const panelHost = app.querySelector<HTMLElement>('#panel-host');
  const searchPanel = app.querySelector<HTMLElement>('#search-panel');
  const workbenchesPanel = app.querySelector<HTMLElement>('#workbenches-panel');
  const residentPanel = app.querySelector<HTMLElement>('#resident-panel');
  if (shellTop === null || shellBottom === null || dockMount === null || activityBarHost === null || editorColumn === null || editorRoot === null || panelHost === null || searchPanel === null || workbenchesPanel === null || residentPanel === null) throw new Error('shell root mount failed');

  const topbar = createTopbar(shellTop, store);
  const activityBar = createActivityBar(activityBarHost, store);
  const residentDock = createResidentDock(dockMount, store);
  const statusBar = createStatusBar(shellBottom, store);

  const workflowStripMount = app.querySelector<HTMLElement>('#workflow-strip-mount');
  if (workflowStripMount !== null) {
    renderWorkflowStrip(workflowStripMount, store);
  }

  const stages: Record<Panel, HTMLElement | null> = {
    'command-center': document.getElementById('stage-command-center'),
    'resident': document.getElementById('stage-resident'),
    'projects': document.getElementById('stage-projects'),
    'editor': null,
    'terminal': document.getElementById('stage-terminal'),
    'models': document.getElementById('stage-models'),
    'verification': document.getElementById('stage-verification'),
    'skills': document.getElementById('stage-skills'),
    'memory': document.getElementById('stage-memory'),
    'security': document.getElementById('stage-security'),
    'extensions': null,
    'settings': null
  };

  function applyPanelState(panel: Panel): void {
    if (panelHost === null || editorRoot === null) return;
    if (panel === 'editor') {
      panelHost.hidden = true;
      editorRoot.hidden = false;
      return;
    }
    panelHost.hidden = false;
    editorRoot.hidden = true;
    for (const p of PANEL_STAGES) {
      if (p === 'editor') continue;
      const stage = stages[p];
      if (stage !== null) stage.hidden = (p !== panel);
    }
  }

  const unbindPanel = store.subscribe(state => applyPanelState(state.panel));
  window.addEventListener('unload', () => unbindPanel());
  applyPanelState(store.get().panel);

  return {
    editorRoot,
    panelHost,
    searchPanel,
    workbenchesPanel,
    residentPanel,
    statusLeft: statusBar.statusLeft,
    statusRight: statusBar.statusRight,
    lspStatus: statusBar.lspStatus,
    residentStatus: statusBar.residentStatus,
    topbar,
    activityBar,
    residentDock,
    statusBar
  };
}
