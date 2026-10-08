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
  if (['UNKNOWN', 'UNTESTED', 'STALE', 'REQUIRES_PREFLIGHT', 'SETUP_REQUIRED', 'CONSENT_REQUIRED', 'VERIFICATION_REQUIRED', 'NOT_READY', 'BLOCKED', 'UNVERIFIED'].includes(upper)) return 'warn';
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
  root.appendChild(el('p', 'panel-intro', 'Models, local artifacts, provider connections, and exact route eligibility in one view. Conversation selection and persistent project role defaults remain separate.'));
  const body = el('div', 'models-body');
  root.appendChild(body);
  parent.appendChild(root);

  let alive = true;
  let pending = false;
  const hubPolls = new Set<number>();

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
      'global model override: none configured; the built-in default lane is the local runtime'
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
    body.appendChild(el('p', 'model-card-meta', 'Edit these persistent targets in Settings. OpenCode Go is one connection with its currently discovered models; exact model verification is still required before routing is available.'));

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
        card.appendChild(metadata(
          'repository license label: ' + (artifact.repository_license ?? 'UNKNOWN'),
          'GGUF metadata license: ' + (artifact.license ?? 'UNKNOWN')
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
    appendHubAcquisition();
  }

  function appendHubAcquisition(): void {
    const section = el('section', 'model-profile-config modelhub-acquisition');
    section.appendChild(el('div', 'models-section-header', 'HUGGING FACE → LOCAL ARTIFACT'));
    section.appendChild(el('p', 'model-card-meta', 'Search and inspect a GGUF source, then acquire its immutable revision only after explicit Authority approval. The verified file is written under the current workspace models/ directory; model weights are not bundled with Covert.'));

    const searchRow = el('div', 'modelhub-search-row');
    const query = document.createElement('input');
    query.className = 'modelhub-search-input';
    query.type = 'search';
    query.maxLength = 200;
    query.value = 'LFM2.5-2.6B-GGUF';
    query.setAttribute('aria-label', 'Hugging Face model search');
    const searchButton = document.createElement('button');
    searchButton.className = 'model-profile-save';
    searchButton.type = 'button';
    searchButton.textContent = 'Search Hugging Face';
    searchRow.append(query, searchButton);
    section.appendChild(searchRow);

    const status = el('p', 'model-card-meta model-profile-status', 'No Hugging Face request has been made.');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    section.appendChild(status);
    const results = el('div', 'models-list');
    section.appendChild(results);

    searchButton.addEventListener('click', async () => {
      const term = query.value.trim();
      if (!term) {
        status.textContent = 'Enter a model search term.';
        return;
      }
      searchButton.disabled = true;
      status.textContent = 'Preparing the exact external search operation. Covert will ask for one-time approval before contacting Hugging Face…';
      results.textContent = '';
      try {
        const response = await api.modelHubSearch(term);
        status.textContent = `Hugging Face returned ${response.models.length} GGUF repository result(s). Inspect a repository to pin its current revision and file digest.`;
        for (const model of response.models) {
          const card = el('div', 'model-card dim');
          const head = el('div', 'model-card-head');
          head.appendChild(el('span', 'model-card-name', model.repo_id));
          head.appendChild(el('span', 'model-card-status dim', `${model.downloads.toLocaleString()} downloads`));
          card.appendChild(head);
          card.appendChild(metadata(`likes: ${model.likes}`, `tags: ${model.tags.slice(0, 8).join(', ') || 'none reported'}`));
          const inspect = document.createElement('button');
          inspect.className = 'model-profile-save';
          inspect.type = 'button';
          inspect.textContent = 'Inspect GGUF files';
          const files = el('div', 'models-list');
          inspect.addEventListener('click', async () => {
            inspect.disabled = true;
            files.textContent = 'Preparing an exact repository metadata request…';
            try {
              const listing = await api.modelHubFiles(model.repo_id);
              files.textContent = '';
              files.appendChild(metadata(`immutable revision: ${listing.revision}`, `repository license label: ${listing.license ?? 'not reported'}`));
              files.appendChild(el('p', 'model-card-meta model-card-meta-warn', 'Review the source license terms before redistribution. A repository license label is not legal approval.'));
              if (listing.files.length === 0) files.appendChild(el('div', 'models-empty', 'This repository reported no GGUF files.'));
              for (const file of listing.files) {
                const fileCard = el('div', 'model-card dim');
                fileCard.appendChild(el('div', 'model-card-name', file.filename));
                fileCard.appendChild(metadata(
                  `size: ${file.size === null ? 'unknown' : `${file.size.toLocaleString()} bytes`}`,
                  `LFS SHA-256: ${file.lfs_sha256 ?? 'not available'}`
                ));
                const acquire = document.createElement('button');
                acquire.className = 'model-profile-save';
                acquire.type = 'button';
                acquire.textContent = 'Download and verify';
                acquire.disabled = file.lfs_sha256 === null || file.size === null;
                const jobStatus = el('p', 'model-card-meta model-profile-status', acquire.disabled
                  ? 'This file lacks the pinned size or LFS SHA-256 required for verified acquisition.'
                  : 'No download started.');
                const register = document.createElement('button');
                register.className = 'model-profile-save';
                register.type = 'button';
                register.textContent = 'Register in Model Manager';
                register.disabled = true;
                acquire.addEventListener('click', async () => {
                  acquire.disabled = true;
                  jobStatus.textContent = 'Preparing the exact external download operation. Covert will ask for one-time approval before downloading…';
                  const quant = /(?:^|[._-])(Q\d(?:_[A-Z0-9]+)*(?:_[A-Z])?)(?:[._-]|$)/i.exec(file.filename)?.[1]?.toUpperCase();
                  try {
                    const started = await api.modelHubDownload({
                      repo_id: model.repo_id,
                      filename: file.filename,
                      quant_label: quant ?? null,
                      revision: listing.revision,
                      expected_sha256: file.lfs_sha256!,
                      expected_size_bytes: file.size!
                    });
                    jobStatus.textContent = 'Approved download started. Waiting for size, SHA-256, and GGUF verification…';
                    const poll = window.setInterval(async () => {
                      try {
                        const snapshot = await api.modelHubDownloads();
                        const job = snapshot.jobs.find(item => item.job_id === started.job_id);
                        if (!job) {
                          window.clearInterval(poll);
                          hubPolls.delete(poll);
                          jobStatus.textContent = 'Download job disappeared before a terminal result; verification is unknown.';
                          acquire.disabled = false;
                          return;
                        }
                        if (job.status === 'running') {
                          const total = job.bytes_total ?? job.expected_size_bytes;
                          jobStatus.textContent = `Downloading and verifying: ${job.bytes_done.toLocaleString()} / ${total.toLocaleString()} bytes · ${job.revision}`;
                          return;
                        }
                        window.clearInterval(poll);
                        hubPolls.delete(poll);
                        if (job.status === 'done') {
                          jobStatus.textContent = `Verified and stored: SHA-256 ${job.expected_sha256}; immutable revision ${job.revision}.`;
                          register.disabled = false;
                        } else {
                          jobStatus.textContent = `Download ${job.status}: ${job.error ?? 'no error detail was returned'}. No registration is offered.`;
                          acquire.disabled = false;
                        }
                      } catch (error) {
                        window.clearInterval(poll);
                        hubPolls.delete(poll);
                        jobStatus.textContent = 'Could not read download verification status: ' + (error instanceof Error ? error.message : String(error));
                        acquire.disabled = false;
                      }
                    }, 1500);
                    hubPolls.add(poll);
                  } catch (error) {
                    jobStatus.textContent = 'Download was not started: ' + (error instanceof Error ? error.message : String(error));
                    acquire.disabled = false;
                  }
                });
                register.addEventListener('click', async () => {
                  register.disabled = true;
                  jobStatus.textContent = 'Registering the verified artifact through the canonical Model Manager route; Authority may request approval…';
                  try {
                    const registered = await api.modelRegister({
                      filename: file.filename,
                      repo_id: model.repo_id,
                      ...(quantFromFilename(file.filename) ? { quant_label: quantFromFilename(file.filename)! } : {})
                    });
                    jobStatus.textContent = `Registered as ${registered.id}. This records local availability; it does not start or qualify the model.`;
                    const latest = await api.modelManager();
                    if (alive) render(latest);
                  } catch (error) {
                    jobStatus.textContent = 'Registration was not completed: ' + (error instanceof Error ? error.message : String(error));
                    register.disabled = false;
                  }
                });
                fileCard.append(acquire, register, jobStatus);
                files.appendChild(fileCard);
              }
            } catch (error) {
              files.textContent = 'Repository inspection failed: ' + (error instanceof Error ? error.message : String(error));
            } finally {
              inspect.disabled = false;
            }
          });
          card.append(inspect, files);
          results.appendChild(card);
        }
      } catch (error) {
        status.textContent = 'Hugging Face search failed or was not approved: ' + (error instanceof Error ? error.message : String(error));
      } finally {
        searchButton.disabled = false;
      }
    });
    body.appendChild(section);
  }

  function quantFromFilename(filename: string): string | null {
    return /(?:^|[._-])(Q\d(?:_[A-Z0-9]+)*(?:_[A-Z])?)(?:[._-]|$)/i.exec(filename)?.[1]?.toUpperCase() ?? null;
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
      for (const poll of hubPolls) window.clearInterval(poll);
      hubPolls.clear();
      parent.textContent = '';
    }
  };
}
