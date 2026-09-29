// Model Access panel. The daemon's public-safe Model Manager projection is the
// source for identity, qualification, connection, and exact route evidence.
// This view makes no selection or execution mutation.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';

export interface PanelHandles {
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stateClass(state: string): 'ok' | 'warn' | 'err' | 'dim' {
  const upper = state.toUpperCase();
  if (['READY', 'QUALIFIED', 'VERIFIED', 'HEALTHY', 'AVAILABLE', 'ELIGIBLE'].includes(upper)) return 'ok';
  if (['UNAVAILABLE', 'UNHEALTHY', 'UNSUPPORTED', 'INVALID_EVIDENCE', 'MISMATCH'].includes(upper)) return 'err';
  if (['UNKNOWN', 'UNTESTED', 'STALE', 'REQUIRES_PREFLIGHT', 'SETUP_REQUIRED', 'CONSENT_REQUIRED', 'VERIFICATION_REQUIRED', 'NOT_READY', 'BLOCKED', 'UNVERIFIED'].includes(upper)) return 'warn';
  return 'dim';
}

function metadata(...parts: string[]): HTMLElement {
  const row = el('div', 'model-card-meta');
  for (const part of parts) row.appendChild(el('span', 'model-card-meta-item', part));
  return row;
}

function roleTarget(target: ModelManagerResponseT['connections']['routed_roles']['plan']): string {
  return target === 'local' ? 'local runtime' : target.provider_id + ' · ' + target.model_id;
}

function routeState(route: ModelManagerResponseT['routes'][number]): string {
  if (route.available) return 'AVAILABLE';
  if (route.model_support_state !== 'VERIFIED') return route.model_support_state;
  if (route.setup_state !== 'READY') return route.setup_state;
  if (route.health !== 'HEALTHY') return route.health;
  return 'BLOCKED';
}

export function createModelsPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.textContent = '';
  const root = el('div', 'panel-content models-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'MODEL ACCESS'));
  header.appendChild(el('span', 'panel-maturity', 'EVIDENCE'));
  root.appendChild(header);
  root.appendChild(el('p', 'panel-intro', 'Models, local artifacts, provider connections, and exact route eligibility in one view. Current role targets are shown below; change routing in Settings.'));
  const body = el('div', 'models-body');
  root.appendChild(body);
  parent.appendChild(root);

  let alive = true;
  let pending = false;

  function render(view: ModelManagerResponseT): void {
    body.textContent = '';
    const availableRoutes = view.routes.filter(route => route.available).length;
    const counts = el('div', 'models-counts');
    counts.appendChild(el('span', 'models-counts-value', view.models.length + ' KNOWN MODELS · ' + availableRoutes + ' / ' + view.routes.length + ' AVAILABLE ROUTES'));
    body.appendChild(counts);
    body.appendChild(el('p', 'panel-intro', 'Route availability is one input to execution. Authority and Resource Admission still govern each task.'));

    body.appendChild(el('div', 'models-section-header', 'CURRENT ROLE TARGETS'));
    const roles = el('div', 'models-list');
    for (const role of ['plan', 'act', 'utility'] as const) {
      const row = el('div', 'route-row');
      row.appendChild(el('span', 'route-id', role.toUpperCase()));
      row.appendChild(el('span', 'route-name', roleTarget(view.connections.routed_roles[role])));
      roles.appendChild(row);
    }
    body.appendChild(roles);

    body.appendChild(el('div', 'models-section-header', 'LOCAL RUNTIME AND DISCOVERY'));
    const runtime = el('div', 'model-card ' + stateClass(view.runtime.health));
    runtime.appendChild(metadata(
      'runtime: ' + view.runtime.canonical_runtime_id,
      'health: ' + view.runtime.health,
      'backend: ' + (view.runtime.reported_backend ?? 'UNKNOWN'),
      'loaded model: ' + (view.runtime.selected_model_id ?? 'none')
    ));
    runtime.appendChild(metadata(
      'discovery: ' + view.local_discovery.status,
      'directories scanned: ' + view.local_discovery.scanned_dirs,
      'artifacts found: ' + view.local_discovery.discovered_count,
      'errors: ' + view.local_discovery.error_count
    ));
    body.appendChild(runtime);

    body.appendChild(el('div', 'models-section-header', 'PROVIDER CONNECTIONS'));
    const connections = el('div', 'models-list');
    for (const connection of view.connections.connections) {
      const card = el('div', 'model-card ' + stateClass(connection.status));
      const head = el('div', 'model-card-head');
      head.appendChild(el('span', 'model-card-name', connection.name));
      head.appendChild(el('span', 'model-card-status ' + stateClass(connection.status), connection.status.replace(/_/g, ' ').toUpperCase()));
      card.appendChild(head);
      card.appendChild(metadata(
        'source: ' + connection.provider_id,
        'account: ' + connection.account_label,
        'connection routing gate: ' + (connection.routing_available ? 'OPEN' : 'CLOSED'),
        'model references: ' + connection.access.model_refs.length
      ));
      card.appendChild(el('div', 'model-card-meta', connection.detail));
      connections.appendChild(card);
    }
    if (view.connections.connections.length === 0) connections.appendChild(el('div', 'models-empty', 'No provider connections are currently reported.'));
    body.appendChild(connections);

    body.appendChild(el('div', 'models-section-header', 'KNOWN MODELS'));
    const artifactById = new Map(view.artifacts.map(artifact => [artifact.id, artifact]));
    const modelList = el('div', 'models-list');
    for (const model of view.models) {
      const hasLocalArtifact = model.artifact_ids.length > 0;
      const exactRoutes = view.routes.filter(route => route.model_id === model.identity.canonical_id);
      const modelState = hasLocalArtifact ? model.readiness : exactRoutes.some(route => route.available) ? 'AVAILABLE' : 'UNVERIFIED';
      const card = el('div', 'model-card ' + stateClass(modelState));
      const head = el('div', 'model-card-head');
      head.appendChild(el('span', 'model-card-name', model.identity.display_name));
      head.appendChild(el('span', 'model-card-status ' + stateClass(modelState), modelState));
      card.appendChild(head);
      card.appendChild(metadata('id: ' + model.identity.canonical_id, 'availability: ' + model.availability));
      if (hasLocalArtifact) {
        card.appendChild(metadata(
          'local readiness: ' + model.readiness,
          'qualification: ' + model.identity.qualification.state,
          'artifact compatibility: ' + model.compatibility
        ));
      } else {
        card.appendChild(metadata('source: managed provider', 'exact routes: ' + exactRoutes.length));
      }
      if (model.identity.qualification.stale_reasons.length > 0) {
        card.appendChild(metadata('stale evidence: ' + model.identity.qualification.stale_reasons.join(', ')));
      }
      const basis = model.identity.qualification.basis;
      if (basis !== null) {
        card.appendChild(metadata(
          'qualification runtime: ' + (basis.runtime_id ?? 'UNKNOWN'),
          'runtime version: ' + (basis.runtime_version ?? 'UNKNOWN'),
          'source revision: ' + (basis.source_revision ?? 'UNKNOWN')
        ));
      }
      for (const artifactId of model.artifact_ids) {
        const artifact = artifactById.get(artifactId);
        if (artifact === undefined) continue;
        card.appendChild(metadata(
          'artifact: ' + (artifact.filename ?? artifact.id),
          'format: ' + (artifact.format ?? 'UNKNOWN'),
          'quantization: ' + (artifact.quantization ?? 'UNKNOWN'),
          'hash: ' + artifact.hash_status
        ));
        if (artifact.observed_sha256 !== null) card.appendChild(el('div', 'model-card-endpoint', 'Observed SHA-256: ' + artifact.observed_sha256));
        else if (artifact.expected_sha256 !== null) card.appendChild(el('div', 'model-card-endpoint', 'Expected SHA-256: ' + artifact.expected_sha256));
      }
      modelList.appendChild(card);
    }
    if (view.models.length === 0) modelList.appendChild(el('div', 'models-empty', 'No model identities are currently reported.'));
    body.appendChild(modelList);

    body.appendChild(el('div', 'models-section-header', 'EXACT PROVIDER / MODEL ROUTES'));
    const routeList = el('div', 'route-list');
    for (const route of view.routes) {
      const state = routeState(route);
      const card = el('div', 'route-row ' + stateClass(state));
      const head = el('div', 'model-card-head');
      head.appendChild(el('span', 'model-card-name', route.provider_id + ' · ' + route.provider_model_id));
      head.appendChild(el('span', 'route-status ' + stateClass(state), state));
      card.appendChild(head);
      card.appendChild(metadata(
        'connection: ' + route.connection_id,
        'adapter: ' + route.execution_adapter_id,
        'exact model support: ' + route.model_support_state,
        'health: ' + route.health
      ));
      card.appendChild(metadata(
        'setup: ' + route.setup_state,
        'external egress: ' + (route.external_egress_required ? 'required' : 'no'),
        'role target match: ' + (route.selected_roles.join(', ') || 'none')
      ));
      routeList.appendChild(card);
    }
    if (view.routes.length === 0) routeList.appendChild(el('div', 'models-empty', 'No exact provider/model routes are currently reported.'));
    body.appendChild(routeList);
  }

  async function refresh(): Promise<void> {
    if (!alive || pending) return;
    pending = true;
    body.textContent = 'Loading Model Access evidence…';
    try {
      const view = await api.modelManager();
      if (alive) render(view);
    } catch (error) {
      if (alive) {
        body.textContent = '';
        body.appendChild(el('div', 'panel-error', 'Model Access evidence is unavailable: ' + (error instanceof Error ? error.message : String(error))));
      }
    } finally {
      pending = false;
    }
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 30000);
  return {
    dispose() {
      alive = false;
      window.clearInterval(interval);
      parent.textContent = '';
    }
  };
}
