// Slice 3 — MODELS panel
// Consumes existing /api/models/status and /api/models/routes.
// Read-only. No execution authority.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { ModelStatusResponseT } from '../../../common/contracts/models.ts';
import type { RoutesResponseT } from '../../../common/contracts/routing.ts';

export interface PanelHandles {
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusClass(status: string): string {
  if (status === 'ready' || status === 'running') return 'ok';
  if (status === 'error') return 'err';
  if (status === 'starting') return 'warn';
  return 'dim';
}

export function createModelsPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content models-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'MODELS'));
  header.appendChild(el('span', 'panel-maturity', 'AVAILABLE'));
  root.appendChild(header);
  const intro = el('div', 'panel-intro', 'Installed models, runtime availability, and role routing. Read-only projection of /api/models/status and /api/models/routes.');
  root.appendChild(intro);
  const body = el('div', 'models-body');
  root.appendChild(body);
  parent.appendChild(root);

  let alive = true;

  async function refresh(): Promise<void> {
    if (!alive) return;
    body.innerHTML = '<div class="panel-loading">Loading model status and routes\u2026</div>';
    let status: ModelStatusResponseT;
    let routes: RoutesResponseT;
    try {
      const results = await Promise.all([api.modelsStatus(), api.routes()]);
      status = results[0];
      routes = results[1];
    } catch (e) {
      body.innerHTML = '';
      const err = el('div', 'panel-error', `Failed to load: ${e instanceof Error ? e.message : String(e)}`);
      body.appendChild(err);
      return;
    }
    body.innerHTML = '';

    const runtimeRow = el('div', 'models-runtime');
    runtimeRow.appendChild(el('span', 'models-runtime-label', 'Runtime available'));
    const runtimeDot = el('span', `models-runtime-dot ${status.runtime ? 'ok' : 'err'}`);
    runtimeRow.appendChild(runtimeDot);
    runtimeRow.appendChild(el('span', 'models-runtime-value', status.runtime ? 'yes' : 'no'));
    body.appendChild(runtimeRow);

    if (status.models.length === 0) {
      body.appendChild(el('div', 'models-empty', 'No models installed.'));
      return;
    }

    const readyCount = status.models.filter(m => (m.status === 'ready' || m.status === 'running') && m.runtime_available && m.artifact_available).length;
    const totalCount = status.models.length;
    const counts = el('div', 'models-counts');
    counts.appendChild(el('span', 'models-counts-value', `${readyCount} OF ${totalCount} MODELS READY`));
    body.appendChild(counts);

    const listHeader = el('div', 'models-section-header', 'INSTALLED MODELS');
    body.appendChild(listHeader);
    const list = el('div', 'models-list');
    for (const m of status.models) {
      const card = el('div', `model-card ${statusClass(m.status)}`);
      const head = el('div', 'model-card-head');
      head.appendChild(el('span', 'model-card-name', m.name));
      const statusBadge = el('span', `model-card-status ${statusClass(m.status)}`, m.status.toUpperCase());
      head.appendChild(statusBadge);
      card.appendChild(head);
      const meta = el('div', 'model-card-meta');
      meta.appendChild(el('span', 'model-card-meta-item', `id: ${m.id}`));
      meta.appendChild(el('span', 'model-card-meta-item', `runtime: ${m.runtime_available ? 'available' : 'unavailable'}`));
      meta.appendChild(el('span', 'model-card-meta-item', `artifact: ${m.artifact_available ? 'available' : 'unavailable'}`));
      if (m.setup_required && m.setup_message !== undefined) {
        meta.appendChild(el('span', 'model-card-meta-item model-card-meta-warn', `setup: ${m.setup_message}`));
      }
      card.appendChild(meta);
      if (m.endpoint.length > 0) {
        card.appendChild(el('div', 'model-card-endpoint', m.endpoint));
      }
      list.appendChild(card);
    }
    body.appendChild(list);

    if (routes.routes.length > 0) {
      body.appendChild(el('div', 'models-section-header', 'MODEL ROUTES'));
      const routeTable = el('div', 'route-list');
      for (const r of routes.routes) {
        const row = el('div', `route-row ${statusClass(r.status)}`);
        row.appendChild(el('span', 'route-id', r.id));
        row.appendChild(el('span', 'route-name', r.displayName));
        row.appendChild(el('span', 'route-provider-type', r.providerType));
        row.appendChild(el('span', 'route-roles', `roles: ${r.roles.join(', ') || '\u2014'}`));
        row.appendChild(el('span', `route-status ${statusClass(r.status)}`, r.status.toUpperCase()));
        routeTable.appendChild(row);
      }
      body.appendChild(routeTable);
    }
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 10000);

  return {
    dispose() {
      alive = false;
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
