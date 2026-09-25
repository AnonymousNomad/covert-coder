import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { HealthResponseT } from '../../../common/contracts/health.ts';
import type { HardwareProfileResponseT } from '../../../common/contracts/hardware.ts';
import type { ModelStatusResponseT } from '../../../common/contracts/models.ts';
import type { ConnectionsViewResponseT } from '../../../common/contracts/connections.ts';
import { createBlockedState } from './BlockedState.ts';

export interface SystemHealthHandles {
  refresh(): Promise<void>;
  dispose(): void;
}

type Result<T> = { value: T | null; error: boolean };

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(title: string, state: string, detail: string, tone: 'good' | 'warn' | 'unknown' = 'unknown'): HTMLElement {
  const root = el('section', `cockpit-health-card cockpit-health-${tone}`);
  root.append(el('span', 'cockpit-health-label', title), el('strong', 'cockpit-health-state', state), el('p', 'cockpit-health-detail', detail));
  return root;
}

function shortWorkspace(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).at(-1) ?? 'UNKNOWN';
}

function resourceCards(hardware: HardwareProfileResponseT | null): HTMLElement[] {
  if (hardware === null) {
    return [card('HARDWARE SNAPSHOT', 'UNKNOWN', 'The local hardware profile has not returned a verified snapshot.')];
  }
  const gib = 1024 ** 3;
  const ramFree = Math.max(0, Math.min(hardware.totalRamBytes, hardware.freeRamBytes));
  const ramUsed = Math.max(0, hardware.totalRamBytes - ramFree);
  const vramFree = Math.max(0, Math.min(hardware.vramBytes, hardware.freeVramBytes));
  const gpuDetail = hardware.vramSource === 'none'
    ? `${hardware.backend.toUpperCase()} backend · VRAM unavailable`
    : `${hardware.backend.toUpperCase()} backend · ${(hardware.vramBytes / (1024 ** 3)).toFixed(1)} GB VRAM total · ${hardware.vramSource}`;
  return [
    card('CPU', `${hardware.logicalCpus} LOGICAL PROCESSORS`, 'Live CPU utilization is not exposed by the hardware contract.'),
    card('GPU / VRAM', hardware.vramSource === 'none' ? 'VRAM UNAVAILABLE' : `${(vramFree / (1024 ** 2)).toFixed(0)} MB FREE`, gpuDetail),
    card('RAM', `${(ramUsed / gib).toFixed(1)} / ${(hardware.totalRamBytes / gib).toFixed(1)} GB USED`, `${(ramFree / gib).toFixed(1)} GB free in the last hardware snapshot; this is not an execution-admission verdict.`),
    card('STORAGE', 'UNAVAILABLE', 'Disk capacity is not exposed by the current hardware contract.')
  ];
}

export function createSystemHealthSurface(parent: HTMLElement, store: Store<AppState>): SystemHealthHandles {
  parent.replaceChildren();
  const root = el('div', 'cockpit-health-surface');
  const header = el('div', 'cockpit-health-header');
  header.append(el('h3', 'cockpit-settings-section-title', 'SYSTEM HEALTH'), el('span', 'cockpit-health-source', 'LOCAL READ-ONLY SNAPSHOT'));
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'cockpit-settings-action';
  refreshButton.textContent = 'REFRESH STATUS';
  refreshButton.setAttribute('aria-label', 'Refresh system health snapshot');
  header.appendChild(refreshButton);
  root.appendChild(header);
  const grid = el('div', 'cockpit-health-grid');
  root.appendChild(grid);
  const limitation = el('p', 'cockpit-health-limitation', 'This view reports only existing local contracts. UNKNOWN is not a failure verdict; absent Resident, Git, and evidence-store health projections remain explicitly unknown.');
  root.appendChild(limitation);
  parent.appendChild(root);

  let alive = true;
  let request = 0;
  let data: { health: Result<HealthResponseT>; models: Result<ModelStatusResponseT>; hardware: Result<HardwareProfileResponseT>; connections: Result<ConnectionsViewResponseT> } = {
    health: { value: store.get().health, error: store.get().health === null },
    models: { value: null, error: false }, hardware: { value: null, error: false }, connections: { value: null, error: false }
  };

  function paint(): void {
    grid.replaceChildren();
    const health = data.health.value;
    grid.appendChild(health === null
      ? card('COVERT CORE', 'UNKNOWN', 'No successful local health snapshot is available.')
      : card('LOCAL DAEMON', 'RESPONDING', `Daemon v${health.version} · uptime ${Math.round(health.uptimeMs / 1000)}s · workspace ${shortWorkspace(health.workspace)}.`, 'good'));

    const state = store.get();
    grid.appendChild(card('MODEL ROUTE', state.topbar.engineReady ? 'AVAILABLE' : 'NOT READY', state.topbar.engineLabel, state.topbar.engineReady ? 'good' : 'warn'));
    grid.appendChild(data.models.value === null
      ? card('MODEL INVENTORY', data.models.error ? 'UNKNOWN' : 'PENDING', data.models.error ? 'Model status did not return a valid local response.' : 'Reading canonical model status.')
      : card('MODEL INVENTORY', `${data.models.value.models.length} REGISTERED`, `Runtime ${data.models.value.runtime ? 'reported available' : 'not reported available'} · availability does not imply role qualification.`));

    const providerView = data.connections.value;
    if (providerView === null) {
      grid.appendChild(card('PROVIDERS', data.connections.error ? 'UNKNOWN' : 'PENDING', data.connections.error ? 'Canonical connection status is unavailable.' : 'Reading canonical connection status.'));
    } else {
      const connected = providerView.connections.filter(item => item.status === 'connected').length;
      const configured = providerView.connections.length;
      const providerState = configured === 0 ? 'NOT CONFIGURED' : `${connected} CONNECTED / ${configured} KNOWN`;
      const providerTone = configured > 0 && connected === configured ? 'good' : 'warn';
      grid.appendChild(card('PROVIDERS', providerState, configured === 0
        ? 'No provider connections are registered in the canonical connection view.'
        : 'Status is from the canonical connection view; configured credentials alone are not described as connected.', providerTone));
      for (const connection of providerView.connections.slice(0, 4)) {
        grid.appendChild(card(connection.name, connection.status.replaceAll('_', ' ').toUpperCase(), connection.capabilities.length > 0 ? `Capabilities: ${connection.capabilities.join(', ')}` : 'No capability is currently reported.'));
      }
    }

    const hw = data.hardware.value;
    for (const item of resourceCards(hw)) grid.appendChild(item);
    grid.appendChild(card('RESIDENT', 'UNKNOWN', 'No canonical Resident health projection is exposed to this UI surface.'));
    grid.appendChild(card('GIT', 'UNKNOWN', 'Git health is not included in the current health contract.'));
    grid.appendChild(card('EVIDENCE STORE', 'UNKNOWN', 'Evidence-store health is not included in the current health contract.'));
    grid.appendChild(card('VERIFICATION', state.topbar.verification, 'Read-only status projected from the existing topbar state.', state.topbar.verification === 'VERIFIED' ? 'good' : 'warn'));
    grid.appendChild(card('NETWORK POLICY', state.topbar.cloud, 'Configured policy state only; this surface makes no network request beyond local status APIs.', 'unknown'));

    if (data.health.value === null || data.models.error || data.hardware.error || data.connections.error) {
      const failed = [
        data.health.value === null ? 'local health endpoint' : null,
        data.models.error ? 'model status endpoint' : null,
        data.hardware.error ? 'hardware profile endpoint' : null,
        data.connections.error ? 'provider connections endpoint' : null
      ].filter((value): value is string => value !== null);
      grid.appendChild(createBlockedState({
        owner: 'Local Covert status APIs',
        reason: `No valid response from: ${failed.join(', ')}.`,
        currentState: 'UNKNOWN; no health failure is inferred from a missing response.',
        nextAction: 'Check the local daemon status and refresh this read-only snapshot.',
        evidence: 'GET /api/health, /api/models/status, /api/hardware/profile, /api/connections'
      }));
    }
  }

  async function refresh(): Promise<void> {
    const current = ++request;
    data = {
      health: { value: store.get().health, error: false },
      models: { value: null, error: false }, hardware: { value: null, error: false }, connections: { value: null, error: false }
    };
    paint();
    const [health, models, hardware, connections] = await Promise.allSettled([
      api.health(), api.modelsStatus(), api.hardwareProfile(), api.connections()
    ]);
    if (!alive || current !== request) return;
    data = {
      health: { value: health.status === 'fulfilled' ? health.value : null, error: health.status === 'rejected' },
      models: { value: models.status === 'fulfilled' ? models.value : null, error: models.status === 'rejected' },
      hardware: { value: hardware.status === 'fulfilled' ? hardware.value : null, error: hardware.status === 'rejected' },
      connections: { value: connections.status === 'fulfilled' ? connections.value : null, error: connections.status === 'rejected' }
    };
    if (health.status === 'fulfilled') store.set(previous => ({ ...previous, health: health.value }));
    paint();
  }

  refreshButton.addEventListener('click', () => { void refresh(); });
  void refresh();
  return {
    refresh,
    dispose() {
      alive = false;
      parent.replaceChildren();
    }
  };
}
