// Phase 5 — System Telemetry.
// Honest resource projection from /api/hardware/profile (snapshot).
// RAM/VRAM/storage are canonical hardware snapshots. CPU utilization is not
// exposed by the backend and remains UNAVAILABLE rather than fabricated.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { HardwareProfileResponseT } from '../../../common/contracts/hardware.ts';

export interface SystemTelemetryHandles {
  root: HTMLElement;
  refresh(): Promise<void>;
  dispose(): void;
}

interface TelemetryData {
  hardware: HardwareProfileResponseT | null;
}

const BYTES_PER_GB = 1024 ** 3;
const BYTES_PER_MB = 1024 ** 2;

function fmtGB(bytes: number): string {
  return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
}
function fmtMB(bytes: number): string {
  return `${(bytes / BYTES_PER_MB).toFixed(0)} MB`;
}

function usableRam(h: HardwareProfileResponseT): { used: number; total: number } | null {
  if (h.totalRamBytes <= 0) return null;
  const free = Math.max(0, Math.min(h.totalRamBytes, h.freeRamBytes));
  return { used: h.totalRamBytes - free, total: h.totalRamBytes };
}

function usableVram(h: HardwareProfileResponseT): { used: number; total: number } | null {
  if (h.vramSource === 'none' || h.vramBytes <= 0) return null;
  const free = Math.max(0, Math.min(h.vramBytes, h.freeVramBytes));
  return { used: h.vramBytes - free, total: h.vramBytes };
}

function usableStorage(h: HardwareProfileResponseT): { used: number; total: number } | null {
  if (h.storageSource === 'unavailable' || h.storageTotalBytes <= 0) return null;
  const free = Math.max(0, Math.min(h.storageTotalBytes, h.storageFreeBytes));
  return { used: h.storageTotalBytes - free, total: h.storageTotalBytes };
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function gauge(label: string, valueText: string, pct: number | null, status: 'ok' | 'warn' | 'err' | 'dim' = 'dim'): HTMLElement {
  const card = el('section', `cockpit-telemetry-card cockpit-telemetry-card-${status}`);
  const title = el('h3', 'cockpit-telemetry-card-title', label);
  card.appendChild(title);
  const value = el('div', 'cockpit-telemetry-card-value', valueText);
  card.appendChild(value);
  if (pct !== null) {
    const track = el('div', 'cockpit-telemetry-track');
    const fill = el('div', `cockpit-telemetry-fill cockpit-telemetry-fill-${status}`);
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    track.appendChild(fill);
    card.appendChild(track);
  } else {
    card.appendChild(el('div', 'cockpit-telemetry-unavailable', 'Backend does not expose a live sample for this metric.'));
  }
  return card;
}

export function createSystemTelemetry(parent: HTMLElement, _store: Store<AppState>): SystemTelemetryHandles {
  parent.innerHTML = '';
  const root = el('div', 'cockpit-telemetry');

  const header = el('header', 'cockpit-telemetry-header');
  header.appendChild(el('h2', 'cockpit-telemetry-title', 'SYSTEM RESOURCES'));
  header.appendChild(el('span', 'cockpit-telemetry-subtitle', 'DEVICE SNAPSHOT'));
  root.appendChild(header);

  const grid = el('div', 'cockpit-telemetry-grid');
  root.appendChild(grid);

  parent.appendChild(root);

  let alive = true;
  let refreshing = false;

  async function refresh(): Promise<void> {
    if (!alive || refreshing) return;
    refreshing = true;
    let hardware: HardwareProfileResponseT | null = null;
    try { hardware = await api.hardwareProfile(); }
    catch { hardware = null; }
    finally { refreshing = false; }
    if (!alive) return;
    const data: TelemetryData = { hardware };
    paint(data);
    if (hardware !== null) window.dispatchEvent(new CustomEvent('covert:hardwareprofile', { detail: hardware }));
  }

  function paint(data: TelemetryData): void {
    grid.innerHTML = '';
    if (data.hardware === null) {
      grid.appendChild(el('div', 'cockpit-telemetry-unavailable', '/api/hardware/profile unavailable; resource samples are not available.'));
      return;
    }
    const h = data.hardware;

    const ram = usableRam(h);
    grid.appendChild(ram === null
      ? gauge('RAM', 'UNAVAILABLE', null, 'dim')
      : gauge('RAM',
        `${fmtGB(ram.used)} / ${fmtGB(ram.total)}`,
        Math.round((ram.used / ram.total) * 100),
        ram.used / ram.total > 0.9 ? 'warn' : 'ok'));

    const vram = usableVram(h);
    grid.appendChild(vram === null
      ? gauge('VRAM', 'UNAVAILABLE', null, 'dim')
      : gauge('VRAM',
        `${fmtMB(vram.used)} / ${fmtMB(vram.total)}`,
        Math.round((vram.used / vram.total) * 100),
        vram.used / vram.total > 0.9 ? 'warn' : 'ok'));

    grid.appendChild(gauge('CPU',
      `${h.logicalCpus} LOGICAL · USAGE UNAVAILABLE`,
      null,
      'dim'));

    const storage = usableStorage(h);
    grid.appendChild(storage === null
      ? gauge('STORAGE', 'UNAVAILABLE', null, 'dim')
      : gauge('STORAGE',
        `${fmtGB(storage.used)} / ${fmtGB(storage.total)}`,
        Math.round((storage.used / storage.total) * 100),
        storage.used / storage.total > 0.9 ? 'warn' : 'ok'));

    const tierCard = el('div', 'cockpit-telemetry-card cockpit-telemetry-card-info');
    tierCard.appendChild(el('h3', 'cockpit-telemetry-card-title', 'DEVICE TIER'));
    const tierRow = el('div', 'cockpit-telemetry-tier-row');
    tierRow.appendChild(el('span', 'cockpit-telemetry-tier', h.tier));
    tierRow.appendChild(el('span', 'cockpit-telemetry-backend', h.backend.toUpperCase()));
    tierCard.appendChild(tierRow);
    tierCard.appendChild(el('div', 'cockpit-telemetry-card-value', `${h.logicalCpus} logical processors \u00b7 ${fmtGB(h.totalRamBytes)} RAM`));
    tierCard.appendChild(el('div', 'cockpit-telemetry-card-note', `VRAM source: ${h.vramSource} \u00b7 storage source: ${h.storageSource} \u00b7 CPU utilization remains unavailable.`));
    grid.appendChild(tierCard);
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 8000);

  return {
    root,
    refresh,
    dispose() {
      alive = false;
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
