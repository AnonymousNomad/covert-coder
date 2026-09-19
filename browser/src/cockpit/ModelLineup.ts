// Phase 4 — Model Lineup.
// Right intelligence panel. Consumes /api/models/status + /api/models/routes.
// No fake models. No fabricated roles.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { RouteEntryT } from '../../../common/contracts/routing.ts';
import { modelDisplayState, modelIsActive } from '../../../common/model-state.ts';

export interface ModelLineupHandles {
  root: HTMLElement;
  refresh(): Promise<void>;
  dispose(): void;
}

const ROLE_LABELS: Record<string, string> = {
  planner: 'Planner',
  coder: 'Coder',
  reviewer: 'Reviewer'
};

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pillClass(state: string): string {
  if (state === 'READY' || state === 'RUNNING') return 'pill-ok';
  if (state === 'FAILED') return 'pill-err';
  if (state === 'STARTABLE' || state === 'STARTING' || state === 'DEGRADED') return 'pill-warn';
  return 'pill-dim';
}

function roleLabelsForRoute(r: RouteEntryT): string[] {
  if (r.roles.length === 0) return ['UNASSIGNED'];
  const order = ['planner', 'coder', 'reviewer'];
  const labels: string[] = [];
  for (const role of order) {
    if (r.roles.includes(role)) labels.push(ROLE_LABELS[role] ?? role);
  }
  for (const role of r.roles) {
    if (!order.includes(role)) labels.push(role);
  }
  return labels.length > 0 ? labels : ['UNASSIGNED'];
}

export function createModelLineup(parent: HTMLElement, store: Store<AppState>): ModelLineupHandles {
  parent.innerHTML = '';
  const root = el('div', 'cockpit-lineup');

  const header = el('header', 'cockpit-lineup-header');
  header.appendChild(el('h2', 'cockpit-lineup-title', 'MODEL LINEUP'));
  const manage = el('button', 'cockpit-mode', 'MANAGE') as HTMLButtonElement;
  manage.type = 'button';
  manage.addEventListener('click', () => store.set(previous => ({ ...previous, panel: 'models' })));
  header.appendChild(manage);
  root.appendChild(header);

  const list = el('div', 'cockpit-lineup-list');
  root.appendChild(list);

  parent.appendChild(root);

  let alive = true;
  let refreshing = false;
  let routeById = new Map<string, RouteEntryT>();

  async function refresh(): Promise<void> {
    if (!alive || refreshing) return;
    refreshing = true;
    const [statusResult, routesResult] = await Promise.allSettled([api.modelsStatus(), api.routes()]);
    const status = statusResult.status === 'fulfilled' ? statusResult.value : null;
    const routes = routesResult.status === 'fulfilled' ? routesResult.value : null;
    refreshing = false;
    if (!alive) return;

    routeById = new Map((routes?.routes ?? []).map((r) => [r.id, r]));

    list.innerHTML = '';
    if (status === null) {
      list.appendChild(el('div', 'cockpit-lineup-unavailable', '/api/models/status unavailable. Model readiness cannot be established.'));
      if (routes === null) list.appendChild(el('div', 'cockpit-lineup-unavailable', '/api/models/routes unavailable. Role assignment cannot be established.'));
      return;
    }
    const header3 = el('div', 'cockpit-lineup-counts');
    const states = status.models.map((model) => modelDisplayState(model));
    const active = states.filter(modelIsActive).length;
    const startable = states.filter((state) => state === 'STARTABLE').length;
    const total = status.models.length;
    header3.appendChild(el('span', 'cockpit-lineup-counts-value', `${active} active · ${startable} startable · ${total} registered`));
    list.appendChild(header3);

    const roleSection = el('div', 'cockpit-lineup-roles');
    roleSection.appendChild(el('div', 'cockpit-lineup-section-label', 'ROLE SLOTS \u00b7 ROUTE EVIDENCE'));
    for (const role of ['planner', 'coder', 'reviewer']) {
      const assignments = (routes?.routes ?? []).filter((route) => route.roles.includes(role));
      const value = assignments.length === 0
        ? 'UNASSIGNED'
        : assignments.map((route) => `${ROLE_LABELS[role] ?? role}: ${route.displayName} [${route.status.toUpperCase()}]`).join(' \u00b7 ');
      const row = el('div', 'cockpit-lineup-role-row');
      row.appendChild(el('span', 'cockpit-lineup-role-label', ROLE_LABELS[role] ?? role));
      row.appendChild(el('span', 'cockpit-lineup-role-value', value));
      roleSection.appendChild(row);
    }
    if (routes === null) roleSection.appendChild(el('div', 'cockpit-lineup-unavailable', 'Role slots are unavailable until /api/models/routes responds.'));
    const roleDetails = document.createElement('details');
    roleDetails.appendChild(el('summary', '', 'Role assignments'));
    roleDetails.appendChild(roleSection);
    list.appendChild(roleDetails);

    if (status.models.length === 0) {
      list.appendChild(el('div', 'cockpit-lineup-empty', 'No models installed. Install a GGUF via /api/modelhub to populate this surface.'));
      return;
    }

    for (const m of status.models.slice(0, 3)) {
      const route = [m.id, `local:${m.id}`]
        .map((id) => routeById.get(id))
        .find((entry): entry is RouteEntryT => entry !== undefined);
      const state = modelDisplayState(m, route?.status);
      const active = modelIsActive(state);
      const card = el('div', `cockpit-lineup-card ${active ? 'cockpit-lineup-card-ok' : 'cockpit-lineup-card-dim'}`);
      const head = el('div', 'cockpit-lineup-card-head');
      head.appendChild(el('span', `cockpit-lineup-card-status ${pillClass(state)}`, state));
      head.appendChild(el('span', 'cockpit-lineup-card-name', m.name));
      card.appendChild(head);
      const role = el('div', 'cockpit-lineup-card-role', route === undefined
        ? 'Role: UNASSIGNED'
        : `Roles: ${roleLabelsForRoute(route).join(', ')}`);
      card.appendChild(role);
      card.title = route ? `${route.providerType} · ${route.status}. Open Models for runtime details.` : 'Route unassigned. Open Models for runtime details.';
      list.appendChild(card);
    }
    if (total > 3) list.appendChild(el('div', 'cockpit-lineup-subtitle', `${total - 3} more in Models · Manage to inspect all`));
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 6000);

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
