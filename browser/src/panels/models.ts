// Model Access panel. The daemon's public-safe Model Manager projection is the
// source for identity, qualification, connection, and exact route evidence.
// This view makes no selection or execution mutation.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';
import { presentModelQualification } from './model-qualification-presentation.ts';

export interface PanelHandles {
  dispose(): void;
}

const LFM_PROFILE_ARTIFACT = 'LFM2.5-2.6B-Q4_K_M.gguf';
const LFM_PROFILE_SHA256 = '02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed';

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
  if (['UNKNOWN', 'UNTESTED', 'STALE', 'REQUIRES_PREFLIGHT', 'SETUP_REQUIRED', 'CONSENT_REQUIRED', 'VERIFICATION_REQUIRED', 'NOT_READY', 'BLOCKED', 'QUALIFICATION BLOCKED', 'DISCOVERED', 'INTEGRITY_NOT_VERIFIED', 'UNVERIFIED'].includes(upper)) return 'warn';
  return 'dim';
}

function metadata(...parts: string[]): HTMLElement {
  const row = el('div', 'model-card-meta');
  for (const part of parts) row.appendChild(el('span', 'model-card-meta-item', part));
  return row;
}

function roleTarget(target: ModelManagerResponseT['connections']['routed_roles']['planner']): string {
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
  root.appendChild(el('p', 'panel-intro', 'Models, local artifacts, provider connections, and exact route eligibility in one view. Workspace role targets persist through Settings; each conversation keeps its own selection.'));
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

    body.appendChild(el('div', 'models-section-header', 'MODEL SELECTION SCOPE'));
    body.appendChild(metadata(
      'conversation: Chat selection is saved with that conversation and does not change project defaults',
      'project role defaults: planner, coder, reviewer, and utility targets below persist for this project',
      'default lane: local runtime; no exact local model is selected until a model identity is chosen'
    ));

    body.appendChild(el('div', 'models-section-header', 'PROJECT ROLE DEFAULTS'));
    const roles = el('div', 'models-list');
    for (const role of ['planner', 'coder', 'reviewer', 'utility'] as const) {
      const row = el('div', 'route-row');
      row.appendChild(el('span', 'route-id', role.toUpperCase()));
      row.appendChild(el('span', 'route-name', roleTarget(view.connections.routed_roles[role])));
      roles.appendChild(row);
    }
    body.appendChild(roles);
    body.appendChild(el('p', 'model-card-meta', 'These workspace role targets persist through the Authority-governed Settings routing flow and affect execution. Selection does not grant Authority or bypass Resource Admission. OpenCode Go is one connection with its currently discovered models; exact model verification is still required before routing is available.'));

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
      const presentation = presentModelQualification(model, view.artifacts);
      const modelState = model.qualification_gate.state === 'QUALIFICATION_BLOCKED' ? 'QUALIFICATION BLOCKED'
        : hasLocalArtifact ? model.readiness : exactRoutes.some(route => route.available) ? 'AVAILABLE' : 'UNVERIFIED';
      const card = el('div', 'model-card ' + stateClass(modelState));
      const head = el('div', 'model-card-head');
      head.appendChild(el('span', 'model-card-name', model.identity.display_name));
      head.appendChild(el('span', 'model-card-status ' + stateClass(modelState), modelState));
      card.appendChild(head);
      card.appendChild(metadata('id: ' + model.identity.canonical_id, 'availability: ' + model.availability));
      if (hasLocalArtifact) {
        card.appendChild(metadata(
          presentation.artifact_presence,
          'integrity: ' + presentation.integrity,
          'local readiness: ' + model.readiness,
          'qualification: ' + presentation.qualification,
          'qualification evidence: ' + presentation.qualification_evidence,
          'qualification preflight: ' + presentation.preflight,
          'artifact compatibility: ' + model.compatibility
        ));
        if (presentation.reason_codes.length > 0) {
          card.appendChild(metadata('qualification blockers: ' + presentation.reason_codes.join(', ')));
        }
        if (presentation.model_invalid !== null) {
          card.appendChild(metadata(presentation.model_invalid));
        }
        if (presentation.explanation !== null) {
          card.appendChild(el('p', 'model-card-meta', presentation.explanation));
        }
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
          'integrity: ' + presentModelQualification(model, [artifact]).integrity
        ));
        if (artifact.observed_sha256 !== null) card.appendChild(el('div', 'model-card-endpoint', 'Observed SHA-256: ' + artifact.observed_sha256));
        else if (artifact.expected_sha256 !== null) card.appendChild(el('div', 'model-card-endpoint', 'Expected SHA-256: ' + artifact.expected_sha256));
      }
      const exactLfmArtifact = model.artifact_ids.some(artifactId => {
        const artifact = artifactById.get(artifactId);
        return artifact?.filename === LFM_PROFILE_ARTIFACT &&
          artifact.expected_sha256?.toLowerCase() === LFM_PROFILE_SHA256 &&
          artifact.hash_status !== 'MISMATCH' &&
          (artifact.observed_sha256 === null || artifact.observed_sha256.toLowerCase() === LFM_PROFILE_SHA256);
      });
      if (exactLfmArtifact) {
        const profile = el('div', 'model-profile-config');
        profile.appendChild(el('div', 'models-section-header', 'RESEARCHED LFM2.5 REQUEST PROFILE'));
        profile.appendChild(el('p', 'model-card-meta', 'The canonical adapter uses the GGUF embedded chat template and clears inherited template-file overrides. Stop-token behavior remains unmeasured. This saves temperature 0, context request 2,048, and output limit 512 through Model Access Authority. The context is a prior request value, not measured served context. Saving does not start or qualify the model.'));
        const saveProfile = document.createElement('button');
        saveProfile.className = 'model-profile-save';
        saveProfile.textContent = 'Save exact-artifact request profile';
        saveProfile.type = 'button';
        const profileStatus = el('p', 'model-card-meta model-profile-status', 'No profile save has been requested from this panel.');
        profileStatus.setAttribute('role', 'status');
        profileStatus.setAttribute('aria-live', 'polite');
        saveProfile.addEventListener('click', async () => {
          saveProfile.disabled = true;
          profileStatus.textContent = 'Saving through the Model Access request path; any required Authority approval will be presented…';
          try {
            const result = await api.modelProfileSave({
              id: model.identity.canonical_id,
              samplers: { temperature: 0 },
              runtime: { context_tokens: 2048, max_tokens: 512 }
            });
            profileStatus.textContent = result.saved
              ? 'Profile save acknowledged. The service has not started or qualified the model; exact-artifact admission and runtime verification still apply.'
              : 'The runtime did not confirm that the model profile was saved.';
          } catch (error) {
            profileStatus.textContent = 'Profile was not saved: ' + (error instanceof Error ? error.message : String(error));
          } finally {
            saveProfile.disabled = !alive;
          }
        });
        profile.appendChild(saveProfile);
        profile.appendChild(profileStatus);
        card.appendChild(profile);
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
    if (!alive || pending || (document.activeElement instanceof HTMLElement && body.contains(document.activeElement))) return;
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
