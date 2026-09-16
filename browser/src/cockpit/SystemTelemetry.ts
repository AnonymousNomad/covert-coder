// Phase 5 — System Telemetry.
// Honest resource projection from /api/hardware/profile (snapshot).
// CPU live usage and disk space have no backend endpoint today \u2014 shown as
// UNAVAILABLE with documented reason. Never invent values.

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
  header.appendChild(el('span', 'cockpit-telemetry-subtitle', 'Honest snapshot refresh'));
  root.appendChild(header);

  const grid = el('div', 'cockpit-telemetry-grid');
  root.appendChild(grid);

  parent.appendChild(root);

  let alive = true;

  async function refresh(): Promise<void> {
    if (!alive) return;
    let hardware: HardwareProfileResponseT | null = null;
    try { hardware = await api.hardwareProfile(); }
    catch { hardware = null; }
    if (!alive) return;
    const data: TelemetryData = { hardware };
    paint(data);
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
      'UNAVAILABLE',
      null,
      'dim'));

    grid.appendChild(gauge('DISK',
      'UNAVAILABLE',
      null,
      'dim'));

    const tierCard = el('div', 'cockpit-telemetry-card cockpit-telemetry-card-info');
    tierCard.appendChild(el('h3', 'cockpit-telemetry-card-title', 'DEVICE TIER'));
    const tierRow = el('div', 'cockpit-telemetry-tier-row');
    tierRow.appendChild(el('span', 'cockpit-telemetry-tier', h.tier));
    tierRow.appendChild(el('span', 'cockpit-telemetry-backend', h.backend.toUpperCase()));
    tierCard.appendChild(tierRow);
    tierCard.appendChild(el('div', 'cockpit-telemetry-card-value', `${h.logicalCpus} cores \u00b7 ${fmtGB(h.totalRamBytes)} RAM`));
    tierCard.appendChild(el('div', 'cockpit-telemetry-card-note', `Source: ${h.vramSource} \u00b7 CPU usage and disk capacity are not exposed by the current hardware contract.`));
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
