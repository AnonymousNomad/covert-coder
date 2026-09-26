// Operator-facing projection of the canonical Intelligence Registry.
// Availability and qualification are separate, and all data arrives through
// the typed, authenticated Model Manager read contract.
import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { ModelManagerEntryT, ModelManagerSnapshotResponseT, ModelPackInstallResponseT, ModelSelectionRequestResponseT } from '../../../common/contracts/model-manager.ts';
import { modelQualificationForRole, overrideBlockReason, selectionRequestBlockReasons } from './model-manager-logic.ts';
import { DEVELOPER_SPECIALS } from './developer-specials.ts';

export interface PanelHandles { dispose(): void }
type View = 'ALL' | 'LOCAL' | 'CLOUD' | 'MODEL PACKS';

const VIEWS: View[] = ['ALL', 'LOCAL', 'CLOUD', 'MODEL PACKS'];
const ROLES = ['PLANNER', 'IMPLEMENTER', 'REVIEWER', 'RECON', 'REPAIR', 'RESIDENT', 'UTILITY', 'CHAT'];
const DISMISSED_KEY = 'aide.model-manager.dismissed-notes.v1';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendField(parent: HTMLElement, label: string, value: string, extraClass = ''): void {
  const field = el('div', `mm-field ${extraClass}`.trim());
  field.appendChild(el('span', 'mm-field-label', label));
  field.appendChild(el('span', 'mm-field-value', value));
  parent.appendChild(field);
}

function statusClass(value: string): string {
  if (['INSTALLED', 'LOADABLE', 'CONNECTED', 'QUALIFIED', 'HEALTHY', 'FIT', 'READY'].includes(value)) return 'good';
  if (['STALE', 'INVALID_EVIDENCE', 'NOT_QUALIFIED', 'AUTH_FAILURE', 'UNAVAILABLE', 'UNHEALTHY', 'FAILED', 'INCOMPATIBLE', 'RESOURCE_INCOMPATIBLE', 'MISSING_ARTIFACT', 'MISSING_PROVIDER', 'BLOCKING', 'SYSTEM_BLOCKED'].includes(value)) return 'bad';
  if (['UNTESTED', 'TESTED', 'DISCOVERED', 'AVAILABLE', 'PARTIALLY_INSTALLED', 'CONFIGURED_NOT_VERIFIED', 'UNKNOWN', 'MISSING', 'MISSING_DEPENDENCY', 'PROVIDER_CONNECTION_REQUIRED', 'QUALIFICATION_MISSING', 'QUALIFICATION_REQUIRED', 'NOT_RUN', 'CAUTION'].includes(value)) return 'caution';
  return 'neutral';
}

function badge(value: string, extra = ''): HTMLElement {
  return el('span', `mm-badge ${statusClass(value)} ${extra}`.trim(), value.replaceAll('_', ' '));
}

function artifactDescription(model: ModelManagerEntryT): string {
  const pieces = [model.artifact.label, model.artifact.format, model.artifact.quantization].filter((item): item is string => Boolean(item));
  return pieces.join(' · ') || 'Artifact not identified';
}

function resourceDescription(model: ModelManagerEntryT): string {
  if (model.resource_fit === 'INCOMPATIBLE') return 'INCOMPATIBLE — hard resource block';
  if (model.resource_fit === 'FIT') return 'FIT — within current RAM reserve';
  const requirement = model.resource_requirements?.ram_mb;
  return requirement === null || requirement === undefined ? 'UNKNOWN — no RAM estimate recorded' : `UNKNOWN — requires about ${requirement} MB`;
}

function currentRuntimeDescription(model: ModelManagerEntryT, snapshot: ModelManagerSnapshotResponseT): string {
  if (model.runtime_backend) return model.runtime_backend;
  if (model.locality === 'LOCAL') return snapshot.runtime.registered ? 'Unsloth adapter available; model binding not recorded' : 'Unsloth — canonical runtime; adapter not registered';
  return `Provider-managed (${model.provider})`;
}

function readDismissed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === 'string')) : new Set();
  } catch { return new Set(); }
}

function persistDismissed(ids: Set<string>): void {
  try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); }
  catch { /* session preference only; persistence failure does not block the view */ }
}

export function createModelsPanel(parent: HTMLElement, _store: Store<AppState>, opts: { onManageProviders?: () => void } = {}): PanelHandles {
  parent.textContent = '';
  const root = el('div', 'panel-content models-panel model-manager-panel');
  const header = el('header', 'panel-header mm-header');
  header.appendChild(el('h2', 'panel-title', 'MODEL MANAGER'));
  header.appendChild(badge('REGISTRY VIEW', 'mm-heading-badge'));
  if (opts.onManageProviders !== undefined) {
    const providerButton = el('button', 'mm-provider-link', 'PROVIDER CONNECTIONS') as HTMLButtonElement;
    providerButton.type = 'button';
    providerButton.addEventListener('click', () => opts.onManageProviders!());
    header.appendChild(providerButton);
  }
  root.appendChild(header);
  root.appendChild(el('p', 'panel-intro', 'Manage available intelligence without conflating a model being present with evidence that it is qualified. Model discovery is bounded to configured locations; cloud state is read locally and is never contacted here.'));

  const toolbar = el('div', 'mm-toolbar');
  const search = el('input', 'mm-search') as HTMLInputElement;
  search.type = 'search';
  search.placeholder = 'Filter by model, provider, artifact, or role';
  search.setAttribute('aria-label', 'Filter models');
  const roleLabel = el('label', 'mm-role-label', 'RECOMMEND FOR');
  const role = el('select', 'mm-role-select') as HTMLSelectElement;
  role.setAttribute('aria-label', 'Recommendation role');
  for (const name of ROLES) {
    const option = el('option', '', name) as HTMLOptionElement;
    option.value = name;
    role.appendChild(option);
  }
  role.value = 'IMPLEMENTER';
  roleLabel.appendChild(role);
  const offlineLabel = el('label', 'mm-offline-toggle');
  const offline = el('input') as HTMLInputElement;
  offline.type = 'checkbox';
  offline.setAttribute('aria-label', 'Recommend local models only');
  offlineLabel.append(offline, el('span', '', 'OFFLINE-ONLY RECOMMENDATIONS'));
  const refresh = el('button', 'mm-refresh', 'REFRESH') as HTMLButtonElement;
  refresh.type = 'button';
  toolbar.append(search, roleLabel, offlineLabel, refresh);
  root.appendChild(toolbar);

  const tabs = el('nav', 'mm-tabs');
  tabs.setAttribute('aria-label', 'Model Manager views');
  root.appendChild(tabs);
  const liveRegion = el('div', 'mm-live', 'Loading Registry, discovery, and provider state…');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  root.appendChild(liveRegion);
  const content = el('div', 'mm-content');
  root.appendChild(content);
  parent.appendChild(root);

  let snapshot: ModelManagerSnapshotResponseT | null = null;
  let requestId = 0;
  let disposed = false;
  let failure: string | null = null;
  let activeView: View = 'ALL';
  let query = '';
  let selectedOverrideId: string | null = null;
  let selectionResult: ModelSelectionRequestResponseT | null = null;
  let selectionError: string | null = null;
  let selectionBusyId: string | null = null;
  let packInstallBusyId: string | null = null;
  let packInstallResult: ModelPackInstallResponseT | null = null;
  let packInstallError: string | null = null;
  const dismissed = readDismissed();

  function effectiveOffline(): boolean { return offline.checked || activeView === 'LOCAL'; }

  async function load(): Promise<void> {
    if (disposed) return;
    const currentRequest = ++requestId;
    failure = null;
    liveRegion.textContent = 'Refreshing model inventory…';
    refresh.disabled = true;
    try {
      const next = await api.modelsManager(role.value, effectiveOffline());
      if (currentRequest !== requestId) return;
      snapshot = next;
    } catch (error) {
      if (currentRequest !== requestId) return;
      failure = error instanceof Error ? 'Model Manager request failed; details are withheld. Check local diagnostics.' : 'Model Manager data is unavailable.';
    } finally {
      if (currentRequest === requestId) {
        refresh.disabled = false;
        if (!disposed) render();
      }
    }
  }

  function visibleModels(): ModelManagerEntryT[] {
    if (!snapshot) return [];
    const needle = query.trim().toLocaleLowerCase();
    return snapshot.models.filter(model => {
      if (activeView === 'LOCAL' && model.locality !== 'LOCAL') return false;
      if (activeView === 'CLOUD' && model.locality !== 'CLOUD') return false;
      if (activeView === 'MODEL PACKS') return false;
      if (!needle) return true;
      return [model.display_name, model.provider, model.id, model.family ?? '', artifactDescription(model), ...model.qualification.qualified_roles].join(' ').toLocaleLowerCase().includes(needle);
    });
  }

  function chooseOverride(modelId: string): void {
    const model = snapshot?.models.find(item => item.id === modelId);
    if (overrideBlockReason(model) !== null) return;
    selectedOverrideId = modelId;
    render();
  }

  async function createSelectionRequest(modelId: string): Promise<void> {
    const model = snapshot?.models.find(item => item.id === modelId);
    if (!snapshot || selectionRequestBlockReasons(model, snapshot).length > 0) return;
    selectionBusyId = modelId;
    selectionResult = null;
    selectionError = null;
    render();
    try {
      selectionResult = await api.modelSelectionRequest({
        requested_role: role.value,
        selected_model_id: modelId,
        operator_override: snapshot.recommendation.recommended[0]?.id !== modelId
      });
    } catch {
      selectionResult = null;
      selectionError = 'Selection request could not be created. No routing state was changed.';
    } finally {
      selectionBusyId = null;
      render();
    }
  }

  async function installPackArtifact(modelId: string, sourcePath: string): Promise<void> {
    if (!sourcePath.trim()) return;
    packInstallBusyId = modelId;
    packInstallResult = null;
    packInstallError = null;
    render();
    try {
      packInstallResult = await api.modelPackInstall({ model_id: modelId, source_path: sourcePath.trim() });
      await load();
    } catch {
      packInstallError = 'The local artifact was not registered. Check the exact catalog filename, license/source metadata, GGUF validity, and Authority decision.';
    } finally {
      packInstallBusyId = null;
      render();
    }
  }

  function renderSelectionResult(): HTMLElement | null {
    if (selectionError) return el('section', 'mm-selection-result mm-danger-text', selectionError);
    if (!selectionResult) return null;
    const region = el('section', 'mm-selection-result');
    region.appendChild(el('strong', '', selectionResult.decision.replaceAll('_', ' ')));
    if (selectionResult.block_reasons.length) {
      region.appendChild(el('p', 'mm-danger-text', `Blocked: ${selectionResult.block_reasons.join(', ')}`));
    } else if (selectionResult.selection_request) {
      const request = selectionResult.selection_request;
      region.appendChild(el('p', '', `${request.selected_intelligence_id} · ${request.requested_role} · ${request.artifact_identity.locality}`));
      region.appendChild(el('p', 'mm-inline-note', 'Selection request created. It is scoped to this project and has not changed mission routing, evaluated Authority, or admitted resources.'));
      region.appendChild(el('small', '', `Project reference: ${request.scope.project_id}`));
    }
    return region;
  }

  function renderRuntime(): HTMLElement {
    const runtime = snapshot!.runtime;
    const section = el('section', 'mm-runtime-section');
    const heading = el('div', 'mm-section-heading');
    heading.appendChild(el('h3', '', 'LOCAL RUNTIME ADAPTER'));
    heading.appendChild(badge(runtime.registered ? runtime.health : 'NOT REGISTERED'));
    section.appendChild(heading);
    const grid = el('div', 'mm-runtime-grid');
    appendField(grid, 'Canonical runtime', 'UNSLOTH');
    appendField(grid, 'Health', runtime.registered ? runtime.health : 'NOT REPORTED');
    appendField(grid, 'Health detail', runtime.health_detail ?? 'Not reported');
    appendField(grid, 'Version', runtime.version ?? 'NOT REPORTED BY CURRENT ADAPTER CONTRACT');
    appendField(grid, 'Ownership', runtime.ownership ?? 'NOT REPORTED BY CURRENT ADAPTER CONTRACT');
    appendField(grid, 'Loaded models', runtime.loaded_models.map(model => model.id).join(', ') || 'None reported');
    appendField(grid, 'Capabilities', runtime.capabilities === null ? 'Not reported' : Object.entries(runtime.capabilities).map(([key, value]) => `${key}: ${value === null ? 'unknown' : value ? 'yes' : 'no'}`).join(' · '));
    appendField(grid, 'Metrics', Object.keys(runtime.metrics).length ? Object.entries(runtime.metrics).map(([key, value]) => `${key}: ${value}`).join(' · ') : 'None reported');
    section.appendChild(grid);
    section.appendChild(el('p', 'mm-inline-note', 'Runtime implementation and registration are owned by the Unsloth runtime lane. This panel does not start or configure a runtime.'));
    return section;
  }

  function renderRecommendation(): HTMLElement {
    const recommendation = snapshot!.recommendation;
    const section = el('section', 'mm-recommendation');
    const heading = el('div', 'mm-section-heading');
    heading.appendChild(el('h3', '', `RECOMMENDATION · ${recommendation.role}`));
    heading.appendChild(el('span', 'mm-section-caption', recommendation.offline_only ? 'LOCAL CANDIDATES ONLY' : 'ROLE-SCOPED · NO GLOBAL RANKING'));
    section.appendChild(heading);
    const reasonRows = [
      ...recommendation.recommended.map(candidate => ({ ...candidate, group: 'RECOMMENDED' })),
      ...recommendation.alternatives.map(candidate => ({ ...candidate, group: 'ALTERNATIVE' }))
    ];
    if (reasonRows.length === 0) section.appendChild(el('p', 'mm-empty', 'No available model has evidence for this role. Review excluded candidates below; qualification is not inferred from installation.'));
    for (const candidate of reasonRows) {
      const row = el('div', 'mm-recommendation-row');
      const text = el('div', 'mm-recommendation-copy');
      text.appendChild(el('strong', '', candidate.display_name));
      text.appendChild(el('span', 'mm-recommendation-group', candidate.group));
      const reasons = el('div', 'mm-reason-codes');
      for (const reason of candidate.reasons) reasons.appendChild(badge(reason));
      text.appendChild(reasons);
      if (candidate.evidence_refs.length) text.appendChild(el('small', 'mm-evidence-line', `Evidence: ${candidate.evidence_refs.join(', ')}`));
      row.appendChild(text);
      const model = snapshot!.models.find(item => item.id === candidate.id);
      const blocked = overrideBlockReason(model);
      const action = el('button', 'mm-select-model', selectedOverrideId === candidate.id ? 'SELECTED FOR VIEW' : 'CHOOSE FOR VIEW') as HTMLButtonElement;
      action.type = 'button';
      action.disabled = blocked !== null;
      action.title = blocked === 'RESOURCE_INCOMPATIBLE' ? 'Blocked by current resource fit.' : blocked === 'PROVIDER_NOT_AUTHENTICATED' ? 'The provider is not verified as authenticated.' : blocked === 'UNAVAILABLE' ? 'Model is unavailable.' : 'View-only choice; does not change execution routing.';
      action.addEventListener('click', () => chooseOverride(candidate.id));
      row.appendChild(action);
      section.appendChild(row);
    }
    if (recommendation.excluded.length) {
      const details = el('details', 'mm-excluded');
      details.appendChild(el('summary', '', `EXCLUDED CANDIDATES (${recommendation.excluded.length})`));
      for (const item of recommendation.excluded) {
        const model = snapshot!.models.find(candidate => candidate.id === item.id);
        const line = el('div', 'mm-excluded-row');
        line.appendChild(el('span', '', model?.display_name ?? item.id));
        for (const reason of item.reasons) line.appendChild(badge(reason));
        const block = overrideBlockReason(model);
        if (block === null) {
          const choose = el('button', 'mm-select-model mm-small', selectedOverrideId === item.id ? 'SELECTED' : 'OVERRIDE VIEW') as HTMLButtonElement;
          choose.type = 'button';
          choose.addEventListener('click', () => chooseOverride(item.id));
          line.appendChild(choose);
        } else {
          line.appendChild(el('span', 'mm-blocked-label', block.replaceAll('_', ' ')));
        }
        details.appendChild(line);
      }
      section.appendChild(details);
    }
    const selection = selectedOverrideId ? snapshot!.models.find(model => model.id === selectedOverrideId) : undefined;
    if (selection) {
      const note = el('p', 'mm-override-notice');
      note.appendChild(el('strong', '', `View-only override: ${selection.display_name}.`));
      note.appendChild(el('span', '', ' This does not change persisted role routing or the model used by a mission.'));
      section.appendChild(note);
    }
    return section;
  }

  function renderModelCard(model: ModelManagerEntryT): HTMLElement {
    const card = el('article', `mm-model-card ${model.locality.toLocaleLowerCase()}`);
    const head = el('div', 'mm-model-head');
    const title = el('div', 'mm-model-title');
    title.appendChild(el('h3', '', model.display_name));
    title.appendChild(el('small', '', `${model.family ? `${model.family} · ` : ''}${model.provider} · ${model.id}`));
    head.append(title, badge(model.locality), badge(model.availability));
    const qualify = el('div', 'mm-qualification-line');
    qualify.appendChild(el('span', 'mm-field-label', 'QUALIFICATION'));
    qualify.appendChild(badge(model.qualification.state));
    qualify.appendChild(el('span', 'mm-field-value', modelQualificationForRole(model, role.value)));
    card.append(head, qualify);

    const facts = el('div', 'mm-facts');
    appendField(facts, 'Qualified roles', model.qualification.qualified_roles.join(', ') || 'None recorded');
    appendField(facts, 'Offline', model.offline_capable ? 'YES — LOCAL' : 'NO — CLOUD');
    appendField(facts, 'Resource fit', `${resourceDescription(model)} · estimate, not Resource Admission`, model.resource_fit === 'INCOMPATIBLE' ? 'mm-danger-text' : '');
    appendField(facts, 'Runtime', currentRuntimeDescription(model, snapshot!));
    appendField(facts, 'Artifact', artifactDescription(model));
    appendField(facts, 'Provider state', model.locality === 'CLOUD' ? model.provider_state ?? 'NOT VERIFIED' : 'NOT APPLICABLE');
    card.appendChild(facts);

    const refs = el('details', 'mm-model-evidence');
    refs.appendChild(el('summary', '', 'ARTIFACT IDENTITY & EVIDENCE'));
    const meta = el('div', 'mm-facts mm-detail-facts');
    appendField(meta, 'Revision', model.artifact.revision ?? 'Not recorded');
    appendField(meta, 'SHA-256', model.artifact.hash ?? 'Not computed');
    appendField(meta, 'Hash state', model.artifact.hash_status ?? 'Not recorded');
    appendField(meta, 'Passport', model.passport_ref ?? 'No Capability Passport reference');
    appendField(meta, 'Evidence', model.evidence_refs.join(', ') || 'No evidence reference');
    if (model.qualification.stale_reasons.length) appendField(meta, 'Staleness', model.qualification.stale_reasons.join(', '), 'mm-danger-text');
    card.appendChild(refs);
    refs.appendChild(meta);

    const actions = el('div', 'mm-model-actions');
    const block = overrideBlockReason(model);
    const choose = el('button', 'mm-select-model', selectedOverrideId === model.id ? 'SELECTED FOR VIEW' : 'CHOOSE FOR VIEW') as HTMLButtonElement;
    choose.type = 'button';
    choose.disabled = block !== null;
    choose.title = block === 'RESOURCE_INCOMPATIBLE' ? 'Blocked by current resource fit.' : block === 'PROVIDER_NOT_AUTHENTICATED' ? 'The provider is not verified as authenticated.' : block === 'UNAVAILABLE' ? 'Model is unavailable.' : 'View-only choice; does not change execution routing.';
    choose.addEventListener('click', () => chooseOverride(model.id));
    actions.append(choose, el('span', 'mm-action-note', block ? block.replaceAll('_', ' ') : 'Selection is a view-only override'));
    const selectionBlocks = selectionRequestBlockReasons(model, snapshot!);
    const request = el('button', 'mm-create-selection', selectionBusyId === model.id ? 'CREATING REQUEST…' : 'CREATE ROLE SELECTION REQUEST') as HTMLButtonElement;
    request.type = 'button';
    request.disabled = selectionBusyId !== null || selectionBlocks.length > 0;
    request.title = selectionBlocks.length ? `Blocked: ${selectionBlocks.join(', ')}` : 'Creates a project-scoped request only; it does not change mission routing.';
    request.addEventListener('click', () => { void createSelectionRequest(model.id); });
    actions.appendChild(request);
    card.appendChild(actions);
    if (selectionBlocks.length) card.appendChild(el('small', 'mm-blocked-label', `Selection request blocked: ${selectionBlocks.join(', ')}`));
    return card;
  }

  function renderProviderSection(): HTMLElement {
    const section = el('section', 'mm-provider-section');
    const heading = el('div', 'mm-section-heading');
    heading.appendChild(el('h3', '', 'CLOUD CONNECTION STATE'));
    heading.appendChild(badge(snapshot!.provider_probe));
    section.appendChild(heading);
    if (snapshot!.providers.length === 0) {
      section.appendChild(el('p', 'mm-empty', snapshot!.provider_probe === 'FAILED' ? 'Provider-state inspection failed. Local model state remains available.' : 'No cloud provider state is configured in the Intelligence Registry. This view makes no provider requests.'));
      return section;
    }
    for (const provider of snapshot!.providers) {
      const row = el('div', 'mm-provider-row');
      row.appendChild(el('strong', '', provider.id));
      row.appendChild(badge(provider.state));
      row.appendChild(el('span', 'mm-provider-models', provider.model_ids.length ? provider.model_ids.join(', ') : 'No model catalog enumerated'));
      section.appendChild(row);
    }
    return section;
  }

  function renderModelPacks(): HTMLElement {
    const page = el('div', 'mm-pack-page');
    page.appendChild(el('p', 'mm-page-lede', 'Pack definitions reference the existing model manifest and Intelligence Registry. Import is local-only: Covert does not download or execute model artifacts here. Installation never implies qualification.'));

    if (snapshot!.model_packs.bundles.length === 0) page.appendChild(el('p', 'mm-empty', 'No versioned Model Pack definitions are present in the existing catalog.'));
    for (const definition of snapshot!.model_packs.bundles) {
      const bundleCard = el('section', 'mm-pack-bundle');
      bundleCard.dataset.testid = `model-pack-${definition.id}`;
      const bundleHead = el('div', 'mm-section-heading');
      bundleHead.appendChild(el('h3', '', definition.display_name));
      bundleHead.append(badge(definition.state), badge(definition.installation_state), badge(definition.qualification_state));
      bundleCard.appendChild(bundleHead);
      bundleCard.appendChild(el('p', 'mm-pack-explainer', `${definition.summary} · Version ${definition.version}`));
      const requirements = el('div', 'mm-facts');
      appendField(requirements, 'Roles', [...definition.required_models, ...definition.optional_models].flatMap(member => member.roles).filter((value, index, all) => all.indexOf(value) === index).join(', ') || 'Not specified');
      appendField(requirements, 'Provider dependencies', definition.provider_dependencies.join(', ') || 'None');
      appendField(requirements, 'Runtime requirements', definition.runtime_requirements.map(item => `${item.runtime_id}${item.health_required ? ' · health required' : ''}${item.capabilities.length ? ` · ${item.capabilities.join(', ')}` : ''}`).join('; ') || 'None');
      appendField(requirements, 'Resource expectations', definition.resource_expectations.ram_mb === null ? 'Not recorded; current fit is estimated only' : `${definition.resource_expectations.ram_mb} MB RAM expected`);
      bundleCard.appendChild(requirements);
      const members = el('div', 'mm-pack-list');
      for (const member of definition.members) {
        const row = el('div', 'mm-pack-row');
        const identity = el('div', 'mm-pack-identity');
        identity.appendChild(el('strong', '', member.display_name ?? member.model_id));
        identity.appendChild(el('span', 'mm-pack-role', `${member.required ? 'Required' : 'Optional'} · ${member.roles.join(', ')}`));
        identity.appendChild(el('small', '', [member.artifact_filename, member.artifact_revision, member.declared_license].filter(Boolean).join(' · ') || 'Catalog artifact metadata incomplete'));
        const statuses = el('div', 'mm-pack-states');
        statuses.append(badge(member.installation_state), badge(member.qualification_state ?? 'UNTESTED'), badge(member.resource_fit));
        statuses.appendChild(el('span', 'mm-pack-roles', `Qualified roles: ${member.qualified_roles.join(', ') || 'none recorded'}`));
        row.append(identity, statuses);
        members.appendChild(row);
      }
      bundleCard.append(requirements, members);
      if (definition.block_reasons.length) bundleCard.appendChild(el('p', 'mm-blocked-label', `Readiness conditions: ${definition.block_reasons.join(', ')}`));
      bundleCard.appendChild(el('p', 'mm-inline-note', 'Resource fit is an estimate, not Resource Admission. READY is a pack projection, not permission to start a mission.'));
      page.appendChild(bundleCard);
    }

    const bundle = snapshot!.model_packs.offline_bundle;
    const bundleCard = el('section', 'mm-pack-bundle');
    const bundleHead = el('div', 'mm-section-heading');
    bundleHead.appendChild(el('h3', '', bundle.display_name));
    bundleHead.appendChild(badge(bundle.state));
    bundleCard.appendChild(bundleHead);
    bundleCard.appendChild(el('p', 'mm-pack-explainer', `Legacy offline setup projection: ${bundle.state.replaceAll('_', ' ')} · Qualification: ${bundle.qualification_state.replaceAll('_', ' ')}. Installation and qualification remain independent.`));
    const dependencies = el('div', 'mm-pack-list');
    const dependencyItems = snapshot!.model_packs.items.filter(item => bundle.dependency_ids.includes(item.id));
    if (dependencyItems.length === 0) dependencies.appendChild(el('p', 'mm-empty', 'No artifact-backed model packs were found in the local manifest.'));
    for (const item of dependencyItems) {
      const row = el('div', 'mm-pack-row');
      const identity = el('div', 'mm-pack-identity');
      identity.appendChild(el('strong', '', item.display_name));
      identity.appendChild(el('span', 'mm-pack-role', `Pack role: ${item.intended_role}`));
      identity.appendChild(el('small', '', [item.artifact_label, item.declared_license, item.expected_size_bytes === null ? null : `${Math.round(item.expected_size_bytes / (1024 * 1024))} MB`].filter(Boolean).join(' · ')));
      const states = el('div', 'mm-pack-states');
      states.append(badge(item.installation_state), badge(item.qualification_state ?? 'UNTESTED'), badge(item.resource_fit));
      states.appendChild(el('span', 'mm-pack-roles', `Qualified roles: ${item.qualified_roles.join(', ') || 'none recorded'}`));
      row.append(identity, states);
      dependencies.appendChild(row);
    }
    bundleCard.appendChild(dependencies);
    page.appendChild(bundleCard);

    if (packInstallResult) {
      const result = el('section', 'mm-install-result');
      result.setAttribute('role', 'status');
      result.appendChild(el('strong', '', 'LOCAL ARTIFACT VERIFIED AND REGISTERED'));
      result.appendChild(el('p', '', `${packInstallResult.model_id} · ${packInstallResult.destination_filename} · SHA-256 ${packInstallResult.artifact_sha256}`));
      result.appendChild(el('p', 'mm-inline-note', `Availability: ${packInstallResult.availability} · Qualification: ${packInstallResult.qualification_state}. No runtime was started.`));
      page.appendChild(result);
    }
    if (packInstallError) page.appendChild(el('p', 'mm-danger-text', packInstallError));

    const candidates = el('section', 'mm-pack-candidates');
    candidates.appendChild(el('h3', 'mm-section-title', 'MODEL PACK CATALOG'));
    if (snapshot!.model_packs.catalog_status === 'UNAVAILABLE') candidates.appendChild(el('p', 'mm-empty', 'The existing model pack manifest could not be read. Registry models remain available above.'));
    const cards = el('div', 'mm-pack-grid');
    for (const item of snapshot!.model_packs.items) {
      const card = el('article', 'mm-pack-card');
      const h = el('div', 'mm-pack-card-head');
      h.appendChild(el('h4', '', item.display_name));
      h.appendChild(badge(item.installation_state));
      card.appendChild(h);
      card.appendChild(el('p', 'mm-pack-role', `Intended pack role: ${item.intended_role}. This is catalog metadata, not a qualification.`));
      const data = el('div', 'mm-facts');
      appendField(data, 'License (manifest)', item.declared_license || 'Not recorded');
      appendField(data, 'Source', item.source_repo || 'Not recorded');
      appendField(data, 'Artifact', item.artifact_label ?? 'No local artifact file declared');
      appendField(data, 'Expected SHA-256', item.expected_sha256 ?? 'Not recorded');
      appendField(data, 'Qualification', item.qualification_state ?? 'No matching Registry entry');
      appendField(data, 'Qualified roles', item.qualified_roles.join(', ') || 'None recorded');
      appendField(data, 'Resource fit', item.resource_fit);
      card.appendChild(data);
      card.appendChild(el('p', 'mm-pack-footer', 'Installing or discovering this artifact does not qualify it. Qualification remains bound to its exact artifact/runtime evidence.'));
      if (item.artifact_label && item.installation_state !== 'INSTALLED') {
        const pathLabel = el('label', 'mm-pack-path-label', `EXISTING LOCAL FILE · EXACT NAME: ${item.artifact_label}`);
        const sourcePath = el('input', 'mm-pack-source-path') as HTMLInputElement;
        sourcePath.type = 'text';
        sourcePath.autocomplete = 'off';
        sourcePath.spellcheck = false;
        sourcePath.placeholder = 'Paste the absolute path to this local GGUF';
        sourcePath.setAttribute('aria-label', `Local artifact path for ${item.display_name}`);
        pathLabel.appendChild(sourcePath);
        card.appendChild(pathLabel);
        const install = el('button', 'mm-pack-install', packInstallBusyId === item.id ? 'VERIFYING / IMPORTING…' : 'VERIFY AND IMPORT LOCAL GGUF') as HTMLButtonElement;
        install.type = 'button';
        install.disabled = packInstallBusyId !== null || !item.source_repo || !item.declared_license;
        install.title = 'Copies a user-selected local GGUF after exact source/hash/format verification. Does not download, load, or qualify the model.';
        install.addEventListener('click', () => { void installPackArtifact(item.id, sourcePath.value); });
        card.appendChild(install);
      }
      cards.appendChild(card);
    }
    candidates.appendChild(cards);
    page.appendChild(candidates);

    const hybrid = snapshot!.model_packs.hybrid_setup;
    const hybridCard = el('section', 'mm-hybrid-card');
    const hybridHead = el('div', 'mm-section-heading');
    hybridHead.appendChild(el('h3', '', 'CONNECTED REVIEW SETUP · CONFIGURATION TEMPLATE'));
    hybridHead.appendChild(badge(hybrid.state));
    hybridCard.appendChild(hybridHead);
    hybridCard.appendChild(el('p', 'mm-pack-explainer', `Requires a role-qualified local IMPLEMENTER and an authenticated, role-qualified cloud REVIEWER. Current matches: ${hybrid.qualified_local_implementers} local implementer(s), ${hybrid.qualified_connected_cloud_reviewers} connected cloud reviewer(s).`));
    hybridCard.appendChild(el('p', 'mm-inline-note', 'Configuration preview only. No provider is contacted and no routing or Authority state is changed.'));
    page.appendChild(hybridCard);

    const specials = el('section', 'mm-specials');
    specials.appendChild(el('div', 'mm-section-heading', 'DEVELOPER SPECIALS'));
    specials.appendChild(el('p', 'mm-page-lede', 'Workflow recipes, not rankings. Exact model membership and qualification evidence are intentionally left unset until verified data exists.'));
    const specialGrid = el('div', 'mm-special-grid');
    for (const special of DEVELOPER_SPECIALS) {
      const card = el('article', 'mm-special-card');
      card.dataset.testid = `developer-special-${special.id}`;
      card.appendChild(el('span', 'mm-special-kicker', 'DEVELOPER WORKFLOW'));
      card.appendChild(el('h4', '', special.name));
      card.appendChild(el('span', 'mm-special-category', special.category.replaceAll('_', ' ')));
      card.appendChild(el('p', 'mm-special-purpose', special.purpose));
      card.appendChild(el('p', '', special.summary));
      appendField(card, 'Roles', special.roles.join(', '));
      appendField(card, 'Models / providers', special.model_ids.length || special.providers.length ? [...special.model_ids, ...special.providers].join(', ') : 'None assigned; evidence required');
      appendField(card, 'Placement / artifact', `${special.placement} · ${special.artifact ?? 'Not specified'}`);
      appendField(card, 'Why used', special.why_used);
      appendField(card, 'Cost / context', `${special.cost_notes} ${special.context_notes}`);
      appendField(card, 'Known limitations', special.known_limitations.join('; '));
      card.appendChild(el('small', '', `Developer Special · last reviewed ${special.last_reviewed}`));
      specialGrid.appendChild(card);
    }
    specials.appendChild(specialGrid);
    page.appendChild(specials);
    return page;
  }

  function renderAdvisoriesAndNotes(): HTMLElement {
    const region = el('div', 'mm-guidance-grid');
    const advisorySection = el('section', 'mm-advisories');
    advisorySection.appendChild(el('h3', 'mm-section-title', 'SYSTEM ADVISORIES'));
    if (snapshot!.system_advisories.length === 0) advisorySection.appendChild(el('p', 'mm-empty', 'No current Model Manager advisories.'));
    for (const advisory of snapshot!.system_advisories) {
      if (advisory.kind !== 'system-advisory') continue;
      const card = el('article', `mm-advisory-card ${advisory.severity.toLowerCase()}`);
      const h = el('div', 'mm-guidance-head');
      h.append(el('strong', '', advisory.title), badge(advisory.severity));
      card.append(h, el('p', '', advisory.detail));
      if (advisory.evidence_refs.length) card.appendChild(el('small', '', `Evidence: ${advisory.evidence_refs.join(', ')}`));
      advisorySection.appendChild(card);
    }
    region.appendChild(advisorySection);

    const noteSection = el('section', 'mm-developer-notes');
    noteSection.appendChild(el('h3', 'mm-section-title', 'DEVELOPER NOTES — JAMES FERRELL'));
    noteSection.appendChild(el('p', 'mm-guidance-subtitle', 'Practical developer methodology. These notes are not system state, model qualification, or Covert recommendations.'));
    const activeNotes = snapshot!.developer_notes.filter(note => note.kind === 'developer-note' && !dismissed.has(note.note_id));
    if (activeNotes.length === 0) noteSection.appendChild(el('p', 'mm-empty', 'No active Developer Notes. Dismissals last for this browser session.'));
    for (const note of activeNotes) {
      const card = el('article', 'mm-note-card');
      const h = el('div', 'mm-guidance-head');
      h.append(el('strong', '', note.title), badge(note.category));
      card.append(h, el('p', '', note.body));
      card.appendChild(el('small', '', note.source));
      const dismiss = el('button', 'mm-dismiss-note', 'DISMISS FOR THIS SESSION') as HTMLButtonElement;
      dismiss.type = 'button';
      dismiss.addEventListener('click', () => { dismissed.add(note.note_id); persistDismissed(dismissed); render(); });
      card.appendChild(dismiss);
      noteSection.appendChild(card);
    }
    region.appendChild(noteSection);
    return region;
  }

  function render(): void {
    if (disposed) return;
    tabs.textContent = '';
    for (const view of VIEWS) {
      const tab = el('button', `mm-tab ${view === activeView ? 'active' : ''}`, view) as HTMLButtonElement;
      tab.type = 'button';
      tab.setAttribute('aria-pressed', view === activeView ? 'true' : 'false');
      tab.addEventListener('click', () => {
        activeView = view;
        selectedOverrideId = null;
        render();
        void load();
      });
      tabs.appendChild(tab);
    }
    content.textContent = '';
    if (failure) {
      liveRegion.textContent = 'Model Manager is unavailable.';
      const error = el('section', 'mm-load-error');
      error.appendChild(el('h3', '', 'INTELLIGENCE INVENTORY UNAVAILABLE'));
      error.appendChild(el('p', '', failure));
      error.appendChild(el('p', 'mm-inline-note', 'No local or cloud model state was inferred from a failed request. Retry when the local service is available.'));
      content.appendChild(error);
      return;
    }
    if (!snapshot) {
      liveRegion.textContent = 'Loading Model Manager.';
      content.appendChild(el('p', 'mm-empty', 'Loading the Registry projection…'));
      return;
    }
    const localCount = snapshot.models.filter(model => model.locality === 'LOCAL').length;
    const cloudCount = snapshot.models.filter(model => model.locality === 'CLOUD').length;
    const qualifiedCount = snapshot.models.filter(model => model.qualification.state === 'QUALIFIED').length;
    const summary = el('div', 'mm-summary');
    summary.append(
      el('div', 'mm-summary-cell', `${localCount} LOCAL`),
      el('div', 'mm-summary-cell', `${cloudCount} CLOUD`),
      el('div', 'mm-summary-cell', `${qualifiedCount} QUALIFIED ENTRIES`),
      el('div', 'mm-summary-cell', `FREE RAM ${snapshot.available_ram_mb === null ? 'UNKNOWN' : `${snapshot.available_ram_mb} MB`}`)
    );
    content.appendChild(summary);
    liveRegion.textContent = `Inventory updated ${new Date(snapshot.generated_at).toLocaleTimeString()}. ${localCount} local and ${cloudCount} cloud entries.`;

    if (activeView === 'MODEL PACKS') {
      content.appendChild(renderModelPacks());
      content.appendChild(renderRuntime());
      content.appendChild(renderAdvisoriesAndNotes());
      return;
    }
    content.appendChild(renderRuntime());
    content.appendChild(renderRecommendation());
    const selection = renderSelectionResult();
    if (selection) content.appendChild(selection);
    const models = visibleModels();
    const section = el('section', 'mm-model-list-section');
    const heading = el('div', 'mm-section-heading');
    heading.appendChild(el('h3', '', activeView === 'ALL' ? 'ALL REGISTERED INTELLIGENCE' : `${activeView} INTELLIGENCE`));
    heading.appendChild(el('span', 'mm-section-caption', `${models.length} MATCHING ENTRY/ENTRIES`));
    section.appendChild(heading);
    if (activeView === 'CLOUD') section.appendChild(renderProviderSection());
    if (models.length === 0) section.appendChild(el('p', 'mm-empty', query ? 'No model entries match this filter.' : `No ${activeView === 'ALL' ? '' : `${activeView.toLocaleLowerCase()} `}model entries are currently available. Discovery does not invent provider model catalogs.`));
    const list = el('div', 'mm-model-grid');
    for (const model of models) list.appendChild(renderModelCard(model));
    section.appendChild(list);
    content.appendChild(section);
    content.appendChild(renderAdvisoriesAndNotes());
  }

  refresh.addEventListener('click', () => { void load(); });
  role.addEventListener('change', () => { selectedOverrideId = null; void load(); });
  offline.addEventListener('change', () => { selectedOverrideId = null; void load(); });
  search.addEventListener('input', () => { query = search.value; render(); });
  render();
  void load();

  return {
    dispose(): void {
      disposed = true;
      parent.textContent = '';
    }
  };
}
