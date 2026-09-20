import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { AndroidEnvironmentT, AndroidDeviceListResponseT, AndroidProjectResponseT, MobilePluginResponseT } from '../../../common/contracts/mobile.ts';

export interface PanelHandles {
  dispose(): void;
}

type LoadState = {
  plugin: MobilePluginResponseT | null;
  environment: AndroidEnvironmentT | null;
  project: AndroidProjectResponseT['project'] | null;
  devices: AndroidDeviceListResponseT | null;
  error: string | null;
};

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusClass(status: string): string {
  if (status === 'AVAILABLE') return 'ok';
  if (status === 'MISSING' || status === 'MISCONFIGURED') return 'warn';
  return 'dim';
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ');
}

export function createMobileProductionPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content mobile-production-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'ANDROID PRODUCTION'));
  header.appendChild(el('span', 'panel-maturity', 'EXPERIMENTAL'));
  root.appendChild(header);
  root.appendChild(el('p', 'panel-intro', 'Bounded mobile production for Covert Edge. Heavy development remains on Covert Workstation.'));
  const body = el('div', 'mobile-production-body');
  root.appendChild(body);
  parent.appendChild(root);

  let alive = true;
  let refreshing = false;
  let buildInFlight = false;
  let state: LoadState = { plugin: null, environment: null, project: null, devices: null, error: null };

  function render(): void {
    body.innerHTML = '';
    const projectCard = el('section', 'mobile-card');
    projectCard.appendChild(el('h3', 'mobile-card-title', 'PROJECT'));
    projectCard.appendChild(el('div', 'mobile-kv', state.project ? `${state.project.project_path} · ${state.project.kind}` : 'Inspecting workspace root…'));
    if (state.project) {
      projectCard.appendChild(el('div', 'mobile-kv', `Application ID · ${state.project.application_id ?? 'not observed'}`));
      projectCard.appendChild(el('div', 'mobile-kv', `Gradle wrapper · ${state.project.gradle_wrapper ?? 'not observed'}`));
      if (state.project.limitations.length > 0) projectCard.appendChild(el('p', 'mobile-note', state.project.limitations[0]));
    }
    body.appendChild(projectCard);

    const environmentCard = el('section', 'mobile-card');
    environmentCard.appendChild(el('h3', 'mobile-card-title', 'ENVIRONMENT'));
    if (state.environment === null) {
      environmentCard.appendChild(el('p', 'mobile-note', 'Environment status unavailable.'));
    } else {
      const grid = el('div', 'mobile-status-grid');
      for (const [label, item] of Object.entries(state.environment.components)) {
        const row = el('div', 'mobile-status-row');
        row.appendChild(el('span', 'mobile-status-name', label.replaceAll('_', ' ').toUpperCase()));
        row.appendChild(el('span', `mobile-status-pill mobile-status-${statusClass(item.status)}`, statusLabel(item.status)));
        grid.appendChild(row);
      }
      environmentCard.appendChild(grid);
      if (state.environment.limitations.length > 0) environmentCard.appendChild(el('p', 'mobile-note', state.environment.limitations[0]));
    }
    body.appendChild(environmentCard);

    const deviceCard = el('section', 'mobile-card');
    deviceCard.appendChild(el('h3', 'mobile-card-title', 'DEVICE'));
    const device = state.devices?.devices.find(item => item.state === 'online') ?? null;
    deviceCard.appendChild(el('div', 'mobile-kv', device ? `${device.model ?? device.serial} · ${device.state.toUpperCase()}` : 'No connected physical device observed.'));
    if (state.devices && state.devices.devices.length > 1) deviceCard.appendChild(el('p', 'mobile-note', `${state.devices.devices.length} adb device entries observed; only online devices are eligible.`));
    body.appendChild(deviceCard);

    const buildCard = el('section', 'mobile-card mobile-build-card');
    buildCard.appendChild(el('h3', 'mobile-card-title', 'BUILD / VERIFY'));
    const actions = el('div', 'mobile-actions');
    const canBuild = state.project?.supported === true && state.project.gradle_wrapper !== null && state.environment?.components.jdk.status === 'AVAILABLE';
    const build = document.createElement('button');
    build.type = 'button';
    build.className = 'cockpit-mode';
    build.textContent = buildInFlight ? 'BUILDING…' : 'BUILD';
    build.disabled = !canBuild || buildInFlight;
    build.title = canBuild ? 'Run the structured debug APK operation through Execution Authority.' : 'Requires a supported Android project, project Gradle wrapper, and JDK.';
    build.addEventListener('click', () => {
      if (!canBuild || buildInFlight) return;
      buildInFlight = true;
      render();
      void api.androidBuildDebug('.').then(result => {
        if (!alive) return;
        state.error = result.status === 'BUILD_PASSED' ? `BUILD PASSED · ${result.artifact?.sha256 ?? 'hash unavailable'}` : `${result.status} · ${result.limitation ?? 'no artifact proof'}`;
      }).catch(error => {
        if (alive) state.error = error instanceof Error ? error.message : 'Android build failed';
      }).finally(() => {
        if (alive) {
          buildInFlight = false;
          render();
        }
      });
    });
    actions.appendChild(build);
    for (const label of ['INSTALL', 'LAUNCH', 'LOGS']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cockpit-mode';
      button.textContent = label;
      button.disabled = true;
      button.title = 'Enabled only after the corresponding verified artifact/device gate is present.';
      actions.appendChild(button);
    }
    buildCard.appendChild(actions);
    if (state.error) buildCard.appendChild(el('p', 'mobile-note mobile-result', state.error));
    buildCard.appendChild(el('p', 'mobile-note', 'Gradle success is not application verification. Artifact hash, install, package presence, launch, and runtime evidence remain separate stages.'));
    body.appendChild(buildCard);

    if (state.plugin) body.appendChild(el('p', 'mobile-footer-note', `${state.plugin.publisher} · ${state.plugin.version} · ${state.plugin.status} · ${state.plugin.adapters.map(adapter => `${adapter.id}:${adapter.status}`).join(' · ')}`));
    if (state.error && state.plugin === null) body.appendChild(el('p', 'mobile-note', state.error));
  }

  async function refresh(): Promise<void> {
    if (refreshing) return;
    refreshing = true;
    try {
      const results = await Promise.allSettled([api.mobilePlugin(), api.androidEnvironment(), api.androidProject('.'), api.androidDevices()]);
      if (!alive) return;
      const [plugin, environment, project, devices] = results;
      state = {
        plugin: plugin.status === 'fulfilled' ? plugin.value : null,
        environment: environment.status === 'fulfilled' ? environment.value : null,
        project: project.status === 'fulfilled' ? project.value.project : null,
        devices: devices.status === 'fulfilled' ? devices.value : null,
        error: results.find(result => result.status === 'rejected')?.reason instanceof Error ? (results.find(result => result.status === 'rejected')?.reason as Error).message : null
      };
      render();
    } finally {
      refreshing = false;
    }
  }

  render();
  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 15000);
  return {
    dispose(): void {
      alive = false;
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
