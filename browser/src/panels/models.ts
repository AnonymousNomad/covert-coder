// Slice 3 — MODELS panel
// Consumes existing /api/models/status and /api/models/routes.
// Read-only. No execution authority.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api, call } from '../services/api.ts';
import { ModelStartResponse, ModelStopResponse } from '../../../common/contracts/models.ts';
import type { ModelStatusResponseT } from '../../../common/contracts/models.ts';
import type { RoutesResponseT } from '../../../common/contracts/routing.ts';
import { modelDisplayState, modelIsActive } from '../../../common/model-state.ts';

export interface PanelHandles {
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusClass(state: string): string {
  if (state === 'READY' || state === 'RUNNING') return 'ok';
  if (state === 'FAILED') return 'err';
  if (state === 'STARTABLE' || state === 'STARTING' || state === 'DEGRADED') return 'warn';
  return 'dim';
}

export function createModelsPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content models-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'MODELS'));
  header.appendChild(el('span', 'panel-maturity', 'AVAILABLE'));
  root.appendChild(header);
  const intro = el('div', 'panel-intro', 'Artifact, runtime, and readiness are separate facts. Start and stop require approval for the selected model.');
  root.appendChild(intro);
  const body = el('div', 'models-body');
  root.appendChild(body);
  parent.appendChild(root);

  let alive = true;
  let refreshing = false;
  let pending = false;
  const feedback = el('div', 'panel-intro');
  feedback.setAttribute('role', 'status');
  root.insertBefore(feedback, body);

  async function refresh(): Promise<void> {
    if (!alive || refreshing || pending) return;
    refreshing = true;
    if (!body.childElementCount) body.innerHTML = '<div class="panel-loading">Loading model status and routes\u2026</div>';
    let status: ModelStatusResponseT;
    let routes: RoutesResponseT;
    try {
      const results = await Promise.all([api.modelsStatus(), api.routes()]);
      status = results[0];
      routes = results[1];
    } catch (e) {
      refreshing = false;
      body.innerHTML = '';
      const err = el('div', 'panel-error', `Failed to load: ${e instanceof Error ? e.message : String(e)}`);
      body.appendChild(err);
      return;
    }
    refreshing = false;
    if (!alive) return;
    body.innerHTML = '';

    const runtimeRow = el('div', 'models-runtime');
    runtimeRow.appendChild(el('span', 'models-runtime-label', 'Runtime available'));
    const runtimeDot = el('span', `models-runtime-dot ${status.runtime ? 'ok' : 'err'}`);
    runtimeRow.appendChild(runtimeDot);
    runtimeRow.appendChild(el('span', 'models-runtime-value', status.runtime ? 'yes' : 'no'));
    body.appendChild(runtimeRow);

    if (status.models.length === 0) {
      body.appendChild(el('div', 'models-empty', 'No models registered.'));
      return;
    }

    const routeById = new Map(routes.routes.map(route => [route.id, route]));
    const states = status.models.map(model => modelDisplayState(model, routeById.get(`local:${model.id}`)?.status));
    const activeCount = states.filter(modelIsActive).length;
    const startableCount = states.filter(state => state === 'STARTABLE').length;
    const totalCount = status.models.length;
    const counts = el('div', 'models-counts');
    counts.appendChild(el('span', 'models-counts-value', `${activeCount} ACTIVE · ${startableCount} STARTABLE · ${totalCount} REGISTERED`));
    body.appendChild(counts);

    const listHeader = el('div', 'models-section-header', 'MODEL INVENTORY');
    body.appendChild(listHeader);
    const list = el('div', 'models-list');
    for (const m of status.models) {
      const route = routeById.get(`local:${m.id}`);
      const state = modelDisplayState(m, route?.status);
      const card = el('div', `model-card ${statusClass(state)}`);
      const head = el('div', 'model-card-head');
      head.appendChild(el('span', 'model-card-name', m.name));
      const statusBadge = el('span', `model-card-status ${statusClass(state)}`, state);
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
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'cockpit-mode';
      const active = state === 'RUNNING' || state === 'READY' || state === 'STARTING';
      action.textContent = active ? 'STOP MODEL' : 'START MODEL';
      const canStart = m.runtime_available === true && m.artifact_available === true && ['STARTABLE', 'STOPPED', 'FAILED', 'AVAILABLE'].includes(state);
      action.disabled = !active && !canStart;
      action.title = action.disabled ? 'A runnable artifact and runtime are required. Use Adaptive Setup in Settings.' : `Request approval to ${active ? 'stop' : 'start'} ${m.name}`;
      action.addEventListener('click', () => {
        if (pending) return;
        pending = true;
        action.disabled = true;
        feedback.textContent = `Approval required to ${active ? 'stop' : 'start'} ${m.name}.`;
        const request = active
          ? call('/api/models/stop', { method: 'POST', body: { id: m.id }, schema: ModelStopResponse })
          : call('/api/models/start', { method: 'POST', body: { id: m.id }, schema: ModelStartResponse });
        void request.then(result => { feedback.textContent = `${m.name}: ${result.status.toUpperCase()}. Readiness is established by the next runtime probe.`; })
          .catch(error => { feedback.textContent = `Model operation did not complete: ${error instanceof Error ? error.message : String(error)}`; })
          .finally(() => { pending = false; if (alive) void refresh(); });
      });
      card.appendChild(action);
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
        row.appendChild(el('span', `route-status ${statusClass(r.status.toUpperCase())}`, r.status.toUpperCase()));
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
