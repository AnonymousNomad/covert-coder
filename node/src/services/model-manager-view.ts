import os from 'node:os';
import path from 'node:path';
import { ModelManagerSnapshotResponse, type ModelManagerSnapshotResponseT } from '../../../common/contracts/model-manager.ts';
import { Advisories } from './system-advisories.ts';
import { SEED_NOTES } from './developer-notes.ts';
import { discoverLocalModels, probeCloudProviders, type CloudProviderProbe, type LocalDiscoveryResult } from './intelligence-discovery.ts';
import { IntelligenceRegistry, type IntelligenceEntry } from './intelligence-registry.ts';
import { recommend } from './recommendation-engine.ts';
import type { RuntimeAdapter, RuntimeAdapterRegistry } from './runtime-adapter.ts';
import { projectModelPackBundles, readModelPackCatalog, type ModelPackArtifactCandidate } from './model-packs.ts';

const SECRET_RE = /(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|authorization\s*:|\btoken\s*[:=])/i;
const SECRET_VALUE_RE = /(?:\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bBearer\s+\S+)/i;
const ABSOLUTE_PATH_RE = /(?:^[a-z]:[\\/]|^\\\\|^\/(?:users|home)\/)/i;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

function safeText(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!normalized || normalized.length > max || SECRET_RE.test(normalized) || SECRET_VALUE_RE.test(normalized) || ABSOLUTE_PATH_RE.test(normalized) || normalized.includes('://')) return null;
  return normalized;
}

function safeRef(value: unknown): string | null {
  const text = safeText(value, 240);
  if (text === null || text.startsWith('/') || text.includes('\\') || text.split('/').includes('..')) return null;
  return text;
}

function safeModelId(value: unknown): string | null {
  if (typeof value !== 'string' || !SAFE_ID_RE.test(value) || value.includes('\\') || SECRET_VALUE_RE.test(value) || ABSOLUTE_PATH_RE.test(value)) return null;
  const segments = value.split('/');
  return segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..') ? value : null;
}

function safeMetricKey(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value);
}

function resourceFit(requirement: number | undefined, availableRamMb: number | null): 'FIT' | 'INCOMPATIBLE' | 'UNKNOWN' {
  if (requirement === undefined || availableRamMb === null || !Number.isFinite(requirement)) return 'UNKNOWN';
  // Matches the recommendation engine's default 20% resource reserve.
  return requirement <= availableRamMb * 0.8 ? 'FIT' : 'INCOMPATIBLE';
}

function artifactLabel(entry: IntelligenceEntry): string | null {
  const file = entry.artifact?.file;
  if (!file || file.includes('://')) return null;
  return safeText(path.basename(file), 240);
}

function sameArtifact(left: IntelligenceEntry, right: IntelligenceEntry): boolean {
  if (left.id === right.id) return true;
  const leftLabel = artifactLabel(left)?.toLocaleLowerCase();
  const rightLabel = artifactLabel(right)?.toLocaleLowerCase();
  return leftLabel !== undefined && leftLabel === rightLabel;
}

function mergeRegistryAndDiscovery(saved: IntelligenceEntry[], discovered: IntelligenceEntry[]): IntelligenceEntry[] {
  const merged = [...saved];
  for (const found of discovered) {
    const index = merged.findIndex(existing => sameArtifact(existing, found));
    if (index < 0) {
      merged.push(found);
      continue;
    }
    const existing = merged[index];
    if (!existing) continue;
    // Discovery refreshes physical availability and safe artifact facts only.
    // Qualification, role evidence, provider identity, and other canonical
    // registry fields remain the persisted Registry's responsibility.
    merged[index] = {
      ...existing,
      availability: 'INSTALLED',
      artifact: {
        ...existing.artifact,
        ...found.artifact,
        hash: existing.artifact?.hash,
        hash_status: existing.artifact?.hash_status ?? found.artifact?.hash_status
      }
    };
  }
  return merged;
}

function safeProviderId(value: string): string | null {
  return safeText(value, 80);
}

function providerStateFor(entry: IntelligenceEntry, providers: CloudProviderProbe[]): CloudProviderProbe['state'] | null {
  if (entry.locality !== 'CLOUD') return null;
  if (entry.provider_state) return entry.provider_state;
  const providerId = entry.provider.toLocaleLowerCase();
  const match = providers.find(provider => provider.id.toLocaleLowerCase() === providerId || providerId.includes(provider.id.toLocaleLowerCase()));
  return match?.state ?? null;
}

function projectEntry(entry: IntelligenceEntry, providers: CloudProviderProbe[], availableRamMb: number | null, staleReasons: string[] = []): ModelManagerSnapshotResponseT['models'][number] | null {
  const id = safeModelId(entry.id);
  const displayName = safeText(entry.display_name);
  const provider = safeText(entry.provider, 120);
  if (!id || !displayName || !provider) return null;

  const qualificationRefs = entry.qualification.evidence_refs.map(safeRef).filter((ref): ref is string => ref !== null);
  const entryRefs = entry.evidence_refs.map(safeRef).filter((ref): ref is string => ref !== null);
  const strengths = entry.known_strengths.map(value => safeText(value)).filter((value): value is string => value !== null);
  const failures = entry.known_failures.map(value => safeText(value)).filter((value): value is string => value !== null);
  const resource = entry.resource_requirements;
  const needs = resource ? {
    ram_mb: Number.isFinite(resource.ram_mb) ? resource.ram_mb ?? null : null,
    vram_mb: Number.isFinite(resource.vram_mb) ? resource.vram_mb ?? null : null,
    disk_mb: Number.isFinite(resource.disk_mb) ? resource.disk_mb ?? null : null
  } : null;
  const family = safeText(entry.family, 120);
  const runtimeBackend = safeText(entry.runtime?.backend, 80);
  const revision = safeText(entry.artifact?.revision);
  const hash = entry.artifact?.hash && /^[a-f0-9]{32,128}$/i.test(entry.artifact.hash) ? entry.artifact.hash : null;
  const evidenceRefs = [...new Set([...qualificationRefs, ...entryRefs])];
  const state = entry.qualification.state;
  const validStaleReasons = staleReasons
    .map(reason => safeText(reason, 80))
    .filter((reason): reason is string => reason !== null);
  const staleReasonsForProjection = state === 'STALE' ? validStaleReasons : [];
  if (state === 'STALE' && staleReasonsForProjection.length === 0) staleReasonsForProjection.push('qualification_marked_stale');
  return {
    id,
    display_name: displayName,
    family,
    provider,
    locality: entry.locality,
    availability: entry.availability,
    provider_state: providerStateFor(entry, providers),
    offline_capable: entry.locality === 'LOCAL' && entry.availability !== 'UNAVAILABLE',
    qualification: {
      state,
      qualified_roles: entry.qualification.qualified_roles.map(role => safeText(role, 64)).filter((role): role is string => role !== null),
      unqualified_roles: entry.qualification.unqualified_roles.map(role => safeText(role, 64)).filter((role): role is string => role !== null),
      evidence_refs: qualificationRefs,
      stale: state === 'STALE',
      stale_reasons: staleReasonsForProjection
    },
    artifact: {
      label: artifactLabel(entry),
      revision,
      hash,
      hash_status: entry.artifact?.hash_status ?? null,
      format: safeText(entry.artifact?.format, 40),
      quantization: safeText(entry.artifact?.quantization, 40)
    },
    runtime_backend: runtimeBackend,
    resource_requirements: needs,
    resource_fit: resourceFit(resource?.ram_mb, availableRamMb),
    passport_ref: safeRef(entry.passport_ref),
    evidence_refs: evidenceRefs,
    known_strengths: strengths,
    known_failures: failures
  };
}

function recommendationEntry(model: ModelManagerSnapshotResponseT['models'][number]): IntelligenceEntry {
  const ramMb = model.resource_requirements?.ram_mb;
  return {
    id: model.id,
    display_name: model.display_name,
    ...(model.family !== null ? { family: model.family } : {}),
    provider: model.provider,
    locality: model.locality,
    availability: model.availability,
    ...(model.provider_state !== null ? { provider_state: model.provider_state } : {}),
    qualification: {
      state: model.qualification.state,
      qualified_roles: model.qualification.qualified_roles,
      unqualified_roles: model.qualification.unqualified_roles,
      evidence_refs: model.qualification.evidence_refs
    },
    known_strengths: model.known_strengths,
    known_failures: model.known_failures,
    evidence_refs: model.evidence_refs,
    ...(ramMb !== null && ramMb !== undefined ? { resource_requirements: { ram_mb: ramMb } } : {})
  };
}

function matchPackEntry(pack: ModelPackArtifactCandidate, entries: IntelligenceEntry[]): IntelligenceEntry | undefined {
  const expectedFile = pack.file?.toLocaleLowerCase();
  return entries.find(entry => entry.id === pack.id) ?? entries.find(entry => artifactLabel(entry)?.toLocaleLowerCase() === expectedFile);
}

function installationState(entry: IntelligenceEntry | undefined, providerAuthenticated: boolean, artifactDeclared: boolean): 'INSTALLED' | 'AVAILABLE_LOCALLY' | 'MISSING' | 'PROVIDER_CONNECTION_REQUIRED' | 'SOURCE_ONLY' {
  if (!entry && !artifactDeclared) return 'SOURCE_ONLY';
  if (!entry) return 'MISSING';
  if (entry.locality === 'CLOUD') return providerAuthenticated ? 'SOURCE_ONLY' : 'PROVIDER_CONNECTION_REQUIRED';
  if (entry.availability === 'INSTALLED' || entry.availability === 'LOADABLE') return 'INSTALLED';
  if (entry.availability === 'DISCOVERED' || entry.availability === 'AVAILABLE') return 'AVAILABLE_LOCALLY';
  return 'MISSING';
}

function makePackItems(manifest: { items: ModelPackArtifactCandidate[] } | null, entries: IntelligenceEntry[], models: ModelManagerSnapshotResponseT['models'], providers: CloudProviderProbe[]): ModelManagerSnapshotResponseT['model_packs']['items'] {
  if (!manifest) return [];
  return manifest.items.map(pack => {
    const matched = matchPackEntry(pack, entries);
    const view = matched ? models.find(model => model.id === matched.id) : undefined;
    const providerAuthenticated = matched?.locality !== 'CLOUD' || providerStateFor(matched, providers) === 'AUTHENTICATED';
    return {
      id: pack.id,
      display_name: pack.name,
      intended_role: pack.role,
      source_repo: pack.source_repo,
      declared_license: pack.license,
      artifact_label: pack.file,
      expected_sha256: pack.sha256,
      expected_size_bytes: pack.download_bytes_approx,
      installation_state: installationState(matched, providerAuthenticated, pack.file !== null),
      qualification_state: view?.qualification.state ?? null,
      qualified_roles: view?.qualification.qualified_roles ?? [],
      resource_fit: view?.resource_fit ?? 'UNKNOWN',
      matched_model_id: view?.id ?? null,
      evidence_refs: view?.evidence_refs ?? []
    };
  });
}

function makeOfflineBundle(items: ModelManagerSnapshotResponseT['model_packs']['items']): ModelManagerSnapshotResponseT['model_packs']['offline_bundle'] {
  const dependencies = items.filter(item => item.artifact_label !== null);
  const states = dependencies.map(item => item.installation_state);
  let state: ModelManagerSnapshotResponseT['model_packs']['offline_bundle']['state'] = 'MISSING_DEPENDENCY';
  if (dependencies.some(item => item.resource_fit === 'INCOMPATIBLE')) state = 'RESOURCE_INCOMPATIBLE';
  else if (dependencies.length > 0 && states.every(value => value === 'INSTALLED')) state = 'INSTALLED';
  else if (states.includes('PROVIDER_CONNECTION_REQUIRED')) state = 'PROVIDER_CONNECTION_REQUIRED';
  else if (dependencies.length > 0 && states.every(value => value === 'INSTALLED' || value === 'AVAILABLE_LOCALLY')) state = 'AVAILABLE_LOCALLY';
  const qualified = dependencies.length > 0 && dependencies.every(item => item.qualification_state === 'QUALIFIED');
  return {
    id: 'covert-offline-model-bundle',
    display_name: 'Covert Offline Model Bundle',
    state,
    qualification_state: dependencies.length === 0 ? 'UNKNOWN' : qualified ? 'QUALIFIED' : 'QUALIFICATION_MISSING',
    dependency_ids: dependencies.map(item => item.id),
    installation_available: false
  };
}

function makeHybridSetup(models: ModelManagerSnapshotResponseT['models']): ModelManagerSnapshotResponseT['model_packs']['hybrid_setup'] {
  const localQualified = models.filter(model => model.locality === 'LOCAL' && model.qualification.qualified_roles.includes('IMPLEMENTER') && model.resource_fit !== 'INCOMPATIBLE');
  const cloudQualified = models.filter(model => model.locality === 'CLOUD' && model.provider_state === 'AUTHENTICATED' && model.qualification.qualified_roles.includes('REVIEWER'));
  const localIncompatible = models.some(model => model.locality === 'LOCAL' && model.qualification.qualified_roles.includes('IMPLEMENTER') && model.resource_fit === 'INCOMPATIBLE');
  const cloudAuthenticated = models.some(model => model.locality === 'CLOUD' && model.provider_state === 'AUTHENTICATED');
  let state: ModelManagerSnapshotResponseT['model_packs']['hybrid_setup']['state'];
  if (localIncompatible && localQualified.length === 0) state = 'RESOURCE_INCOMPATIBLE';
  else if (localQualified.length === 0) state = 'LOCAL_MODEL_REQUIRED';
  else if (cloudQualified.length > 0) state = 'READY';
  else if (!cloudAuthenticated) state = 'PROVIDER_CONNECTION_REQUIRED';
  else state = 'QUALIFICATION_MISSING';
  return { state, qualified_local_implementers: localQualified.length, qualified_connected_cloud_reviewers: cloudQualified.length, configuration_only: true };
}

async function runtimeView(registry?: RuntimeAdapterRegistry): Promise<ModelManagerSnapshotResponseT['runtime']> {
  const adapter = registry?.list().some(item => item.name.toLocaleLowerCase() === 'unsloth')
    ? registry?.get(registry.list().find(item => item.name.toLocaleLowerCase() === 'unsloth')?.name ?? '')
    : null;
  if (!adapter) {
    return { canonical_name: 'UNSLOTH', registered: false, health: 'UNKNOWN', health_detail: null, version: null, ownership: null, loaded_models: [], metrics: {}, capabilities: null };
  }
  const [healthResult, modelsResult, metricsResult] = await Promise.allSettled([adapter.health(), adapter.discover(), adapter.metrics()]);
  const health = healthResult.status === 'fulfilled' ? healthResult.value.ok ? 'HEALTHY' : 'UNHEALTHY' : 'UNAVAILABLE';
  const loadedModels = modelsResult.status === 'fulfilled' ? modelsResult.value.flatMap(model => {
    const id = safeModelId(model.id);
    if (!id) return [];
    return [{ id, loaded: model.loaded, context_tokens: Number.isInteger(model.context_tokens) && (model.context_tokens ?? 0) > 0 ? model.context_tokens! : null }];
  }) : [];
  const metrics: Record<string, number> = {};
  if (metricsResult.status === 'fulfilled') {
    for (const [key, value] of Object.entries(metricsResult.value)) if (safeMetricKey(key) && Number.isFinite(value)) metrics[key] = value;
  }
  return {
    canonical_name: 'UNSLOTH',
    registered: true,
    health,
    health_detail: healthResult.status === 'fulfilled' ? safeText(healthResult.value.detail, 240) : 'Health query failed; details withheld.',
    version: safeText(adapter.version, 80),
    ownership: safeText(adapter.ownership, 80),
    loaded_models: loadedModels,
    metrics,
    capabilities: {
      tools: adapter.capabilities.tools,
      metrics: adapter.capabilities.metrics,
      unload: adapter.capabilities.unload
    }
  };
}

export interface ModelManagerViewOptions {
  workspace: string;
  modelPacksPath: string;
  runtimeAdapters?: RuntimeAdapterRegistry;
  role?: string;
  offline?: boolean;
  availableRamMb?: number;
  localDiscovery?: (workspace: string) => Promise<LocalDiscoveryResult>;
  providerProbe?: (workspace: string) => Promise<CloudProviderProbe[]>;
}

export async function buildModelManagerSnapshot(options: ModelManagerViewOptions): Promise<ModelManagerSnapshotResponseT> {
  const registry = new IntelligenceRegistry({ workspace: options.workspace });
  await registry.load();
  const discoveryFn = options.localDiscovery ?? discoverLocalModels;
  let discovery: LocalDiscoveryResult = { entries: [], scanned_dirs: 0, errors: [] };
  let discoveryFailed = false;
  try { discovery = await discoveryFn(options.workspace); }
  catch { discoveryFailed = true; }

  const providerFn = options.providerProbe ?? probeCloudProviders;
  let providers: CloudProviderProbe[] = [];
  let providerProbeFailed = false;
  try { providers = await providerFn(options.workspace); }
  catch { providerProbeFailed = true; }

  const availableRamMb = options.availableRamMb ?? Math.round(os.freemem() / (1024 * 1024));
  const merged = mergeRegistryAndDiscovery(registry.list(), discovery.entries);
  const safeModels = merged.flatMap(entry => {
    try {
      // Re-evaluate only against identity material the Registry actually has.
      const staleness = registry.evaluateStaleness(entry.id, {
        ...(entry.artifact?.hash !== undefined ? { artifact_hash: entry.artifact.hash } : {}),
        ...(entry.runtime?.backend !== undefined ? { runtime: entry.runtime.backend } : {})
      });
      const projectionEntry = staleness.stale
        ? { ...entry, qualification: { ...entry.qualification, state: 'STALE' as const } }
        : entry;
      const projected = projectEntry(projectionEntry, providers, availableRamMb, staleness.reasons);
      return projected ? [projected] : [];
    } catch {
      // Unsafe metadata is omitted per entry; it must not erase safe local state.
      return [];
    }
  }).sort((a, b) => a.display_name.localeCompare(b.display_name));

  const packManifest = await readModelPackCatalog(options.modelPacksPath);
  const packItems = makePackItems(packManifest, merged, safeModels, providers);
  const runtime = await runtimeView(options.runtimeAdapters);
  const role = safeText(options.role ?? 'IMPLEMENTER', 64) ?? 'IMPLEMENTER';
  const offline = options.offline === true;
  const recommendationCandidates = safeModels.map(model => {
    let candidate = recommendationEntry(model);
    if (model.qualification.stale) {
      candidate = { ...candidate, qualification: { ...candidate.qualification, state: 'STALE', qualified_roles: [] } };
    }
    if (candidate.locality === 'CLOUD' && (providerProbeFailed || model.provider_state !== 'AUTHENTICATED')) {
      candidate = { ...candidate, availability: 'UNAVAILABLE' as const };
    }
    return candidate;
  });
  const recommendationBase = recommend(recommendationCandidates, { role, offline, availableRamMb });
  const recommendation = {
    ...recommendationBase,
    excluded: recommendationBase.excluded.map(item => {
      const model = safeModels.find(candidate => candidate.id === item.id);
      return model?.locality === 'CLOUD' && (providerProbeFailed || model.provider_state !== 'AUTHENTICATED')
        ? { ...item, reasons: ['PROVIDER_NOT_AUTHENTICATED' as const] }
        : item;
    })
  };

  const advisories: ModelManagerSnapshotResponseT['system_advisories'] = [];
  for (const model of safeModels) {
    if (model.qualification.state === 'STALE') {
      advisories.push(Advisories.evidenceStale(model.display_name, model.qualification.stale_reasons));
    } else if (model.qualification.state === 'UNTESTED') {
      advisories.push(Advisories.qualificationPending(model.display_name, model.evidence_refs));
    }
    if (model.resource_fit === 'INCOMPATIBLE' && model.resource_requirements !== null && model.resource_requirements.ram_mb !== null && availableRamMb !== null) {
      advisories.push(Advisories.insufficientRam(model.display_name, model.resource_requirements?.ram_mb ?? 0, availableRamMb));
    }
  }
  const developerNotes = SEED_NOTES.filter(note => note.active).map(note => ({ ...note, trigger: note.trigger }));
  const discoveryStatus = discoveryFailed ? 'FAILED' : discovery.errors.length > 0 ? 'PARTIAL' : 'AVAILABLE';
  const providerViews = providers.flatMap(provider => {
    const id = safeProviderId(provider.id);
    if (!id) return [];
    const modelIds = safeModels.filter(model => model.locality === 'CLOUD' && model.provider.toLocaleLowerCase() === id.toLocaleLowerCase()).map(model => model.id);
    return [{ id, state: provider.state, model_ids: modelIds }];
  });
  const modelPackBundles = projectModelPackBundles({
    definitions: packManifest?.bundles ?? [],
    catalogItems: packManifest?.items ?? [],
    models: safeModels,
    providers: providerViews,
    runtime,
    discoveredEntries: discovery.entries,
    availableRamMb
  });
  return ModelManagerSnapshotResponse.parse({
    generated_at: new Date().toISOString(),
    public_safe: true,
    available_ram_mb: availableRamMb,
    local_discovery: {
      status: discoveryStatus,
      scanned_dirs: discovery.scanned_dirs,
      discovered_count: discovery.entries.length,
      error_count: discovery.errors.length + (discoveryFailed ? 1 : 0) + (merged.length - safeModels.length)
    },
    provider_probe: providerProbeFailed ? 'FAILED' : 'AVAILABLE',
    models: safeModels,
    providers: providers.flatMap(provider => {
      const id = safeProviderId(provider.id);
      if (!id) return [];
      const modelIds = safeModels.filter(model => model.locality === 'CLOUD' && model.provider.toLocaleLowerCase() === id.toLocaleLowerCase()).map(model => model.id);
      return [{ id, state: provider.state, model_ids: modelIds }];
    }),
    recommendation: { role, offline_only: offline, recommended: recommendation.recommended, alternatives: recommendation.alternatives, excluded: recommendation.excluded },
    model_packs: {
      catalog_status: packManifest ? 'AVAILABLE' : 'UNAVAILABLE',
      items: packItems,
      bundles: modelPackBundles,
      offline_bundle: makeOfflineBundle(packItems),
      hybrid_setup: makeHybridSetup(safeModels)
    },
    runtime,
    developer_notes: developerNotes,
    system_advisories: advisories
  });
}

export type ModelManagerRuntimeAdapter = RuntimeAdapter;
