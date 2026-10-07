// Presentation of the canonical hardware owner. Snapshot age is source age,
// never response time. Unsupported metrics remain explicit, without fake gauges.
import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { HardwareProfileResponseT } from '../../../common/contracts/hardware.ts';

export interface SystemTelemetryHandles {
  root: HTMLElement;
  refresh(): Promise<void>;
  activate(): void;
  dispose(): void;
}
const GB = 1024 ** 3;
const MB = 1024 ** 2;
function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSystemTelemetry(parent: HTMLElement, _store: Store<AppState>): SystemTelemetryHandles {
  parent.innerHTML = '';
  const root = el('div', 'cockpit-telemetry resource-monitor');
  const header = el('header', 'resource-monitor-toolbar');
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'resource-monitor-refresh';
  refreshButton.textContent = 'REFRESH';
  refreshButton.setAttribute('aria-label', 'Refresh resource snapshot');
  header.append(el('h2', 'resource-monitor-title', 'SYSTEM RESOURCES'), refreshButton);
  const status = el('div', 'resource-monitor-status', 'UNAVAILABLE · awaiting hardware owner');
  status.setAttribute('role', 'status');
  const table = el('table', 'resource-monitor-table');
  table.setAttribute('aria-label', 'Observed host resource snapshot');
  const headings = el('thead', '');
  const columns = el('tr', '');
  for (const name of ['RESOURCE', 'VALUE', 'USAGE', 'SOURCE']) columns.appendChild(el('th', '', name));
  headings.appendChild(columns);
  const body = el('tbody', '');
  table.append(headings, body);
  const note = el('div', 'resource-monitor-note', 'HOST SCOPE · /api/hardware/profile · snapshot cache up to 30s');
  root.append(header, status, table, note);
  parent.appendChild(root);
  let alive = true;
  let inFlight = false;
  let hardware: HardwareProfileResponseT | null = null;
  let failed = false;

  function row(label: string, value: string, usage: number | null, source: string): void {
    const item = el('tr', 'resource-monitor-row');
    item.append(el('th', '', label), el('td', 'resource-monitor-value', value));
    const meter = el('td', 'resource-monitor-usage');
    if (usage !== null) {
      const track = el('div', 'resource-monitor-track');
      track.setAttribute('role', 'meter');
      track.setAttribute('aria-label', `${label} used percent`);
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(Math.round(usage)));
      const fill = el('div', 'resource-monitor-fill telemetry-fill');
      fill.style.width = `${usage}%`;
      track.appendChild(fill);
      meter.appendChild(track);
    } else meter.textContent = '—';
    item.append(meter, el('td', 'resource-monitor-source', source));
    body.appendChild(item);
  }

  function paintStatus(): void {
    if (hardware === null) return;
    const age = Date.now() - hardware.detectedAt;
    const timeKnown = Number.isFinite(age) && age >= 0;
    const stale = failed || !timeKnown || age > 40000;
    status.textContent = `${stale ? 'STALE' : 'SNAPSHOT'} · ${timeKnown ? `${Math.floor(age / 1000)}s` : 'age UNKNOWN'} · ${failed ? 'refresh unavailable; retaining last observation' : 'owner observation time'}${inFlight ? ' · refresh pending' : ''}`;
  }

  function paint(): void {
    paintStatus();
    body.innerHTML = '';
    if (hardware === null) {
      status.textContent = 'UNAVAILABLE · hardware owner did not return a sample';
      row('RAM', 'UNAVAILABLE', null, 'no sample');
      row('VRAM', 'UNAVAILABLE', null, 'no sample');
    } else {
      const h = hardware;
      const ramKnown = h.totalRamBytes > 0 && h.freeRamBytes >= 0 && h.freeRamBytes <= h.totalRamBytes;
      const ramUsed = h.totalRamBytes - h.freeRamBytes;
      row('RAM', ramKnown ? `${(ramUsed / GB).toFixed(1)} / ${(h.totalRamBytes / GB).toFixed(1)} GB` : 'UNAVAILABLE',
        ramKnown ? ramUsed / h.totalRamBytes * 100 : null, 'host memory');
      const vramKnown = h.vramSource !== 'none' && h.freeVramKnown === true && h.vramBytes > 0 && h.freeVramBytes >= 0 && h.freeVramBytes <= h.vramBytes;
      const vramUsed = h.vramBytes - h.freeVramBytes;
      row('VRAM', vramKnown ? `${Math.round(vramUsed / MB)} / ${Math.round(h.vramBytes / MB)} MB` : 'UNAVAILABLE',
        vramKnown ? vramUsed / h.vramBytes * 100 : null, vramKnown ? h.vramSource : 'free memory UNKNOWN');
      note.textContent = `HOST SCOPE · ${h.logicalCpus} logical CPUs · ${h.tier} / ${h.backend.toUpperCase()} · snapshot cache up to 30s`;
    }
    row('CPU', 'UNAVAILABLE', null, 'usage not exposed');
    row('DISK', 'UNAVAILABLE', null, 'capacity not exposed');
    row('COMMIT', 'UNAVAILABLE', null, 'commit not exposed');
    row('GPU', 'UNAVAILABLE', null, 'utilization not exposed');
  }

  async function readSnapshot(force = false): Promise<void> {
    if (!alive) return;
    paintStatus();
    if (inFlight) return;
    if (!force && (document.hidden || !root.isConnected || root.closest('[hidden]'))) return;
    inFlight = true;
    refreshButton.disabled = true;
    root.setAttribute('aria-busy', 'true');
    try {
      const sample = await api.hardwareProfile();
      if (!alive) return;
      hardware = sample;
      failed = false;
    } catch {
      if (!alive) return;
      failed = true;
    } finally {
      inFlight = false;
      if (alive) {
        refreshButton.disabled = false;
        root.setAttribute('aria-busy', 'false');
        paint();
      }
    }
  }
  refreshButton.addEventListener('click', () => { void readSnapshot(true); });
  paint();
  void readSnapshot(true);
  const interval = window.setInterval(() => { void readSnapshot(); }, 8000);
  return {
    root,
    refresh: () => readSnapshot(),
    activate: () => { void readSnapshot(true); },
    dispose() {
      alive = false;
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
