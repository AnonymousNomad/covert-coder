import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ConnectionsViewResponse, type ConnectionsViewResponseT, type ProviderConnectionT } from '../../../common/contracts/connections.ts';
import {
  ModelManagerResponse,
  type ModelAccessIdentityT,
  type ModelArtifactSourceT,
  type ModelCredentialSourceT,
  type ModelExecutionAdapterT,
  type ModelManagerResponseT,
  type ModelProviderRouteT
} from '../../../common/contracts/model-access.ts';
import type { ModelRuntime } from './model-runtime.ts';
import type { RuntimeStatusResponseT } from '../../../common/contracts/runtime.ts';

type RuntimeObservation = Partial<RuntimeStatusResponseT> & {
  backend?: 'UNSLOTH' | 'LLAMA_CPP' | null;
  health?: 'HEALTHY' | 'UNHEALTHY' | 'STOPPED' | 'NOT_INSTALLED' | 'UNKNOWN';
  version?: string | null;
  loaded_model?: { model_id: string; artifact_sha256?: string | null } | null;
};

type QualificationBasis = {
  source_revision: string | null;
  artifact_sha256: string | null;
  runtime_id: string | null;
  runtime_version: string | null;
};

export function evaluateQualificationFreshness(
  evidence: { state: 'QUALIFIED'; basis: QualificationBasis },
  current: QualificationBasis
): { state: 'QUALIFIED' | 'STALE'; stale_reasons: string[] } {
  const stale_reasons: string[] = [];
  if (evidence.basis.source_revision !== current.source_revision) stale_reasons.push('source_revision_changed');
  if (evidence.basis.artifact_sha256 !== current.artifact_sha256) stale_reasons.push('artifact_sha256_changed');
  if (evidence.basis.runtime_id !== current.runtime_id) stale_reasons.push('runtime_changed');
  if (evidence.basis.runtime_version !== current.runtime_version) stale_reasons.push('runtime_version_changed');
  return { state: stale_reasons.length === 0 ? 'QUALIFIED' : 'STALE', stale_reasons };
}

export interface ModelManagerViewOptions {
  workspace: string;
  manifestPath: string;
  modelRuntime: Pick<ModelRuntime, 'list' | 'status'>;
  connectionsService: { list(): Promise<ConnectionsViewResponseT> };
  runtimeStatus?: () => Promise<RuntimeObservation | null>;
}

const SAFE_HASH = /^[a-f0-9]{64}$/i;
const SECRET_VALUE_RE = /(?:sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,}|Bearer\s+\S+|(?:api[_-]?key|token)=\S+)/i;
const ABSOLUTE_PATH_RE = /(?:\b[A-Za-z]:[\\/]|\\\\|(?:^|[\s"'=])\/(?:root|home|Users|mnt|tmp|private|var|etc)\/)/i;
const QUANT_RE = /(?:^|[._-])((?:Q\d(?:_[A-Z0-9]+)*(?:_[A-Z])?|IQ\d_[A-Z]+|BF16|F16|F32))(?:[._-]|$)/i;
const MAX_DISCOVERY_DIRS = 8;
const MAX_DISCOVERY_FILES = 512;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeText(value: unknown, fallback: string, max = 240): string {
  if (typeof value !== 'string' || value.length === 0 || SECRET_VALUE_RE.test(value) || ABSOLUTE_PATH_RE.test(value)) return fallback;
  return value.slice(0, max);
}

function nullableText(value: unknown, max = 240): string | null {
  if (typeof value !== 'string' || value.length === 0 || SECRET_VALUE_RE.test(value) || ABSOLUTE_PATH_RE.test(value)) return null;
  return value.slice(0, max);
}

function validHash(value: unknown): string | null {
  return typeof value === 'string' && SAFE_HASH.test(value) ? value.toLowerCase() : null;
}

function modelDirectories(workspace: string): string[] {
  const configured = (process.env.AIDE_MODEL_DIRS ?? '').split(path.delimiter).map(value => value.trim()).filter(Boolean);
  return [...new Set([path.join(workspace, 'models'), ...configured].map(value => path.resolve(value)))].slice(0, MAX_DISCOVERY_DIRS);
}

async function discoverLocalArtifacts(workspace: string, ignoredPaths: Set<string>, knownNames: Set<string>) {
  const entries: Array<{ id: string; name: string; filename: string; quantization: string | null }> = [];
  const errors: string[] = [];
  const dirs = modelDirectories(workspace);
  let scannedDirs = 0;
  for (const dir of dirs) {
    let files;
    try {
      files = await fs.readdir(dir, { withFileTypes: true });
      scannedDirs++;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push('directory_scan_failed');
      continue;
    }
    for (const item of files.slice(0, MAX_DISCOVERY_FILES)) {
      if (!item.isFile() || !item.name.toLowerCase().endsWith('.gguf')) continue;
      const fullPath = path.resolve(dir, item.name);
      if (ignoredPaths.has(fullPath.toLowerCase()) || knownNames.has(item.name.toLowerCase())) continue;
      try {
        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) continue;
      } catch {
        errors.push('artifact_stat_failed');
        continue;
      }
      const digest = createHash('sha256').update(fullPath.toLowerCase()).digest('hex').slice(0, 24);
      const quant = QUANT_RE.exec(item.name)?.[1]?.toUpperCase() ?? null;
      entries.push({
        id: 'local-discovered:' + digest,
        name: safeText(path.basename(item.name, path.extname(item.name)), 'Discovered local model'),
        filename: safeText(item.name, 'model.gguf'),
        quantization: quant
      });
      knownNames.add(item.name.toLowerCase());
      if (entries.length >= MAX_DISCOVERY_FILES) break;
    }
    if (entries.length >= MAX_DISCOVERY_FILES) break;
  }
  return {
    entries,
    status: errors.length === 0 ? 'AVAILABLE' as const : scannedDirs > 0 ? 'PARTIAL' as const : 'FAILED' as const,
    scanned_dirs: scannedDirs,
    discovered_count: entries.length,
    error_count: errors.length
  };
}

function sourceRevision(raw: Record<string, unknown>): { source: string | null; revision: string | null } {
  const combined = nullableText(raw.source_revision);
  const explicitSource = nullableText(raw.source_repo);
  if (combined && combined.includes('@')) {
    const index = combined.lastIndexOf('@');
    return {
      source: explicitSource ?? nullableText(combined.slice(0, index)),
      revision: nullableText(combined.slice(index + 1))
    };
  }
  return { source: explicitSource ?? nullableText(raw.artifact_uri), revision: nullableText(raw.revision) };
}

function quantization(raw: Record<string, unknown>, filename: string | null): string | null {
  const direct = nullableText(raw.quantization, 40) ?? nullableText(raw.quant_label, 40);
  if (direct) return direct;
  return filename ? QUANT_RE.exec(filename)?.[1]?.toUpperCase() ?? null : null;
}

function availability(connection: ProviderConnectionT, modelSupportState: string): 'UNAVAILABLE' | 'AVAILABLE' | 'CONNECTED' {
  if (modelSupportState === 'unsupported' || connection.status === 'unavailable') return 'UNAVAILABLE';
  if (modelSupportState === 'verified' && connection.status === 'connected') return 'CONNECTED';
  return 'AVAILABLE';
}

function selectedRoles(connections: ConnectionsViewResponseT, connection: ProviderConnectionT, providerModelId: string): string[] {
  const roles: string[] = [];
  for (const role of ['plan', 'act', 'utility'] as const) {
    const target = connections.routed_roles[role] as unknown;
    if (target && typeof target === 'object') {
      const route = target as { provider_id?: string; model_id?: string };
      if (route.provider_id === connection.provider_id && route.model_id === providerModelId) {
        roles.push(role === 'plan' ? 'PLANNING' : role === 'act' ? 'IMPLEMENTATION' : 'UTILITY');
      }
    }
  }
  return roles;
}

function mapHealth(value: string): 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN' | 'UNAVAILABLE' {
  if (value === 'healthy') return 'HEALTHY';
  if (value === 'unhealthy') return 'UNHEALTHY';
  if (value === 'unavailable') return 'UNAVAILABLE';
  return 'UNKNOWN';
}

function mapSetup(value: string): 'READY' | 'SETUP_REQUIRED' | 'VERIFICATION_REQUIRED' | 'CONSENT_REQUIRED' | 'REMEDIATION_REQUIRED' | 'UNAVAILABLE' | 'NOT_APPLICABLE' {
  if (value === 'ready') return 'READY';
  if (value === 'setup_required') return 'SETUP_REQUIRED';
  if (value === 'consent_required') return 'CONSENT_REQUIRED';
  if (value === 'remediation_required') return 'REMEDIATION_REQUIRED';
  if (value === 'unavailable') return 'UNAVAILABLE';
  if (value === 'not_applicable') return 'NOT_APPLICABLE';
  return 'VERIFICATION_REQUIRED';
}

function credentialSource(connection: ProviderConnectionT): ModelCredentialSourceT {
  const source = connection.access.credential_source;
  const kind = source.kind === 'api_key_vault' ? 'API_KEY_VAULT'
    : source.kind === 'subscription_account' ? 'SUBSCRIPTION_ACCOUNT'
      : source.kind === 'official_cli_auth' ? 'OFFICIAL_CLI_AUTH'
        : source.kind === 'opencode_managed_auth' ? 'OPENCODE_MANAGED_AUTH'
          : source.kind === 'oauth_session' ? 'OAUTH_SESSION'
            : source.kind === 'local_none' ? 'LOCAL_NONE' : 'UNKNOWN';
  const mode = connection.access.authentication_mode.toUpperCase() as ModelCredentialSourceT['authentication_mode'];
  return {
    id: source.id ?? 'credential-source:none:' + connection.id,
    kind,
    authentication_mode: mode,
    configuration_state: source.configuration_state.toUpperCase() as ModelCredentialSourceT['configuration_state'],
    setup_required: connection.access.operator_setup_required
  };
}

function buildAdapters(connections: ConnectionsViewResponseT, runtime: ModelManagerResponseT['runtime']): ModelExecutionAdapterT[] {
  const has = (id: string) => connections.connections.some(connection => connection.access.execution_adapters.includes(id as never));
  return [
    { id: 'direct-http', kind: 'DIRECT_HTTP', implementation: 'IMPLEMENTED', discovered: null, configured: has('direct-http'), available: connections.connections.some(connection => connection.access.execution_adapters.includes('direct-http') && connection.routing_available), canonical_default: false },
    { id: 'opencode', kind: 'OPENCODE', implementation: 'IMPLEMENTED', discovered: has('opencode'), configured: has('opencode'), available: connections.connections.some(connection => connection.access.execution_adapters.includes('opencode') && connection.routing_available), canonical_default: false },
    { id: 'codex-cli', kind: 'CODEX_CLI', implementation: 'CONTRACT_ONLY', discovered: connections.connections.some(connection => connection.id === 'subscription:codex' && connection.status !== 'unavailable'), configured: connections.connections.some(connection => connection.id === 'subscription:codex' && connection.access.authentication_configured), available: false, canonical_default: false },
    { id: 'claude-cli', kind: 'CLAUDE_CLI', implementation: 'CONTRACT_ONLY', discovered: connections.connections.some(connection => connection.id === 'subscription:claude' && connection.status !== 'unavailable'), configured: connections.connections.some(connection => connection.id === 'subscription:claude' && connection.access.authentication_configured), available: false, canonical_default: false },
    { id: 'local-runtime', kind: 'LOCAL_RUNTIME', implementation: 'IMPLEMENTED', discovered: runtime.discovered_state === 'DISCOVERED', configured: runtime.configured, available: runtime.available, canonical_default: true }
  ];
}

export function createModelManagerView(options: ModelManagerViewOptions): { snapshot(): Promise<ModelManagerResponseT> } {
  return Object.freeze({ snapshot: async () => {
    const [manifestText, runtimeView, connectionsRaw, runtimeObservation] = await Promise.all([
      fs.readFile(options.manifestPath, 'utf8').catch(() => null),
      options.modelRuntime.status().catch(() => ({ runtime: false, models: [] })),
      options.connectionsService.list().catch(() => null),
      options.runtimeStatus ? options.runtimeStatus().catch(() => null) : Promise.resolve(null)
    ]);
    const manifest = manifestText ? record(JSON.parse(manifestText)) : {};
    const connectionFallback = ConnectionsViewResponse.parse({
      consensus: 'none',
      routed_roles: { plan: 'local', act: 'local', utility: 'local' },
      preference: 'local-first',
      connections: []
    });
    const connections = connectionsRaw ? ConnectionsViewResponse.parse(connectionsRaw) : connectionFallback;
    const runtimeHealth = runtimeObservation?.health ?? (runtimeView.runtime ? 'UNKNOWN' : 'NOT_INSTALLED');
    const runtime = {
      canonical_runtime_id: 'unsloth' as const,
      default_runtime_id: 'unsloth' as const,
      reported_backend: runtimeObservation?.backend ?? null,
      discovered_state: runtimeHealth === 'NOT_INSTALLED' ? 'NOT_DISCOVERED' as const : runtimeHealth === 'UNKNOWN' ? 'UNKNOWN' as const : 'DISCOVERED' as const,
      configured_runtime_id: runtimeObservation?.backend ? runtimeObservation.backend.toLowerCase() : null,
      configured: runtimeObservation?.backend != null,
      available: runtimeHealth === 'HEALTHY',
      health: runtimeHealth,
      selected_model_id: nullableText(runtimeObservation?.loaded_model?.model_id)
    };
    const runtimeEntries = options.modelRuntime.list().map(entry => record(entry));
    const ignoredPaths = new Set(runtimeEntries.map(entry => typeof entry.file === 'string' ? path.resolve(entry.file).toLowerCase() : '').filter(Boolean));
    const packs = Array.isArray(manifest.packs) ? manifest.packs.map(record) : [];
    const sourceModels = Array.isArray(manifest.models) ? manifest.models.map(record) : [];
    const records = new Map<string, Record<string, unknown>>();
    for (const candidate of [...packs, ...sourceModels]) {
      const id = safeText(candidate.id, '');
      if (!id) continue;
      records.set(id, { ...(records.get(id) ?? {}), ...candidate });
    }
    const knownNames = new Set([...records.values()].map(candidate => safeText(candidate.file, '').toLowerCase()).filter(Boolean));
    const discovery = await discoverLocalArtifacts(options.workspace, ignoredPaths, knownNames);
    const localDiscovery = {
      status: discovery.status,
      scanned_dirs: discovery.scanned_dirs,
      discovered_count: discovery.discovered_count,
      error_count: discovery.error_count
    };
    for (const found of discovery.entries) {
      records.set(found.id, { id: found.id, name: found.name, file: found.filename, quant_label: found.quantization, discovered: true });
    }
    const statusRows = Array.isArray(runtimeView.models) ? runtimeView.models.map(record) : [];
    const statusById = new Map(statusRows.map(row => [String(row.id ?? ''), row]));
    const artifactById = new Map<string, ModelArtifactSourceT>();
    const identityById = new Map<string, ModelAccessIdentityT>();
    const modelById = new Map<string, ModelManagerResponseT['models'][number]>();
    const modelRuntimeId = runtime.configured_runtime_id;
    for (const [id, raw] of records) {
      const statusRow = statusById.get(id) ?? {};
      const source = sourceRevision(raw);
      const filenameValue = raw.file ?? raw.model;
      const rawFilename = typeof filenameValue === 'string' ? path.basename(filenameValue.replace(/^local:\/\//, '')) : null;
      const filename = rawFilename ? safeText(rawFilename, 'model.gguf') : null;
      const expectedHash = validHash(raw.sha256);
      const loadedHash = runtimeObservation?.loaded_model?.model_id === id ? validHash(runtimeObservation.loaded_model.artifact_sha256) : null;
      const observedHash = loadedHash;
      const hashMismatch = Boolean(expectedHash && observedHash && expectedHash !== observedHash);
      const installed = statusRow.artifact_available === true || (raw.discovered === true);
      const artifactAvailability = installed ? 'INSTALLED' as const : source.source ? 'AVAILABLE' as const : 'UNAVAILABLE' as const;
      const sourceKind = raw.discovered === true ? 'LOCAL_DISCOVERY' as const : installed ? 'LOCAL_MANIFEST' as const : 'MODEL_CATALOG' as const;
      const hashStatus = hashMismatch ? 'MISMATCH' as const : observedHash ? 'VERIFIED' as const : expectedHash ? 'EXPECTED' as const : 'NOT_COMPUTED' as const;
      const artifact: ModelArtifactSourceT = {
        id: 'artifact:' + id,
        model_id: id,
        source_kind: sourceKind,
        source_ref: source.source,
        revision: source.revision,
        filename,
        format: nullableText(raw.format, 40)?.toUpperCase().includes('GGUF') ? 'GGUF' : nullableText(raw.format, 40),
        quantization: quantization(raw, filename),
        expected_sha256: expectedHash,
        observed_sha256: observedHash,
        hash_status: hashStatus,
        license: nullableText(raw.license, 120),
        availability: artifactAvailability,
        compatibility: hashMismatch ? 'INCOMPATIBLE' : loadedHash ? 'COMPATIBLE' : 'UNKNOWN'
      };
      artifactById.set(id, artifact);
      const evidenceQualified = statusRow.qualification === 'accepted_hash_verified' && Boolean(observedHash);
      let qualificationState: ModelAccessIdentityT['qualification']['state'] = statusRow.qualification === 'requires_start_preflight' ? 'REQUIRES_PREFLIGHT' : 'UNTESTED';
      let basis: ModelAccessIdentityT['qualification']['basis'] = null;
      let staleReasons: string[] = [];
      if (evidenceQualified && modelRuntimeId) {
        basis = { source_revision: null, artifact_sha256: observedHash, runtime_id: modelRuntimeId, runtime_version: runtimeObservation?.version ?? null };
        const freshness = evaluateQualificationFreshness(
          { state: 'QUALIFIED', basis },
          { source_revision: source.revision, artifact_sha256: observedHash, runtime_id: modelRuntimeId, runtime_version: runtimeObservation?.version ?? null }
        );
        qualificationState = hashMismatch ? 'STALE' : freshness.state;
        staleReasons = hashMismatch ? ['artifact_sha256_changed'] : freshness.stale_reasons;
      }
      const identity: ModelAccessIdentityT = {
        canonical_id: id,
        display_name: safeText(raw.name, id),
        family: nullableText(raw.family, 120),
        capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.filter((value): value is string => typeof value === 'string').map(value => safeText(value, '').slice(0, 64)).filter(Boolean) : [],
        context_window_tokens: Number.isInteger(raw.context_tokens) && Number(raw.context_tokens) > 0 ? Number(raw.context_tokens) : null,
        qualification: { state: qualificationState, basis, stale_reasons: staleReasons }
      };
      identityById.set(id, identity);
      const recordAvailability = artifactAvailability;
      const model: ModelManagerResponseT['models'][number] = {
        identity,
        artifact_ids: [artifact.id],
        availability: recordAvailability,
        compatibility: artifact.compatibility,
        readiness: 'NOT_READY',
        recommended_roles: Array.isArray(raw.recommended_roles) ? raw.recommended_roles.filter((value): value is string => typeof value === 'string').map(value => safeText(value, '').slice(0, 64)).filter(Boolean) : [],
        execution_selected_roles: []
      };
      modelById.set(id, model);
    }
    const routes: ModelProviderRouteT[] = [];
    const credentialMap = new Map<string, ModelCredentialSourceT>();
    for (const connection of connections.connections) {
      const credential = credentialSource(connection);
      credentialMap.set(credential.id, credential);
      for (const adapter of connection.access.execution_adapters) {
        for (const reference of connection.access.model_refs) {
          if (!identityById.has(reference.model_id)) {
            const identity: ModelAccessIdentityT = {
              canonical_id: reference.model_id,
              display_name: safeText(reference.provider_model_id, reference.model_id),
              family: null,
              capabilities: [],
              context_window_tokens: null,
              qualification: { state: 'UNTESTED', basis: null, stale_reasons: [] }
            };
            identityById.set(reference.model_id, identity);
            modelById.set(reference.model_id, {
              identity,
              artifact_ids: [],
              availability: availability(connection, reference.model_support_state),
              compatibility: 'UNKNOWN',
              readiness: 'NOT_READY',
              recommended_roles: [],
              execution_selected_roles: []
            });
          }
          const routeId = 'route:' + connection.id + ':' + reference.provider_model_id + ':' + adapter;
          const modelSupportState = reference.model_support_state === 'verified' ? 'VERIFIED'
            : reference.model_support_state === 'unsupported' ? 'UNSUPPORTED' : 'UNKNOWN';
          const route: ModelProviderRouteT = {
            id: safeText(routeId, 'route:unknown').replace(/[^A-Za-z0-9:._/-]/g, '-'),
            model_id: reference.model_id,
            provider_id: connection.provider_id,
            connection_id: connection.id,
            provider_model_id: reference.provider_model_id,
            credential_source_id: credential.id,
            execution_adapter_id: adapter,
            model_support_state: modelSupportState,
            configured: connection.access.authentication_configured || connection.access.credential_source.configuration_state === 'not_required',
            health: mapHealth(connection.access.health),
            available: reference.model_support_state === 'verified' && connection.routing_available &&
              (connection.kind !== 'local-runtime' || identityById.get(reference.model_id)?.qualification.state === 'QUALIFIED'),
            external_egress_required: connection.access.external_egress_required,
            operator_setup_required: connection.access.operator_setup_required,
            setup_state: mapSetup(connection.access.setup_state),
            selected_roles: selectedRoles(connections, connection, reference.provider_model_id)
          };
          routes.push(route);
          const model = modelById.get(reference.model_id);
          if (model) model.execution_selected_roles = [...new Set([...model.execution_selected_roles, ...route.selected_roles])];
        }
      }
    }
    for (const model of modelById.values()) {
      if (model.identity.qualification.state === 'QUALIFIED' && routes.some(route => route.model_id === model.identity.canonical_id && route.available && route.health === 'HEALTHY')) model.readiness = 'READY';
      else if (model.availability === 'UNAVAILABLE') model.readiness = 'UNAVAILABLE';
      else if (model.availability === 'INSTALLED') model.readiness = 'SETUP_REQUIRED';
    }
    const snapshot = {
      generated_at: new Date().toISOString(),
      public_safe: true as const,
      local_discovery: localDiscovery,
      runtime,
      models: [...modelById.values()],
      artifacts: [...artifactById.values()],
      routes,
      credential_sources: [...credentialMap.values()],
      execution_adapters: buildAdapters(connections, runtime),
      connections,
      selection_policy: {
        persistence_state: 'NOT_PERSISTED' as const,
        mutation_enabled: false as const,
        execution_routing_effect: false as const,
        scopes: ['GLOBAL', 'PROJECT', 'ROLE'] as const,
        roles: ['PLANNING', 'IMPLEMENTATION', 'REVIEW', 'UTILITY', 'BACKGROUND'] as const,
        precedence: ['PROJECT_ROLE', 'PROJECT_DEFAULT', 'GLOBAL_ROLE', 'GLOBAL_DEFAULT'] as const
      }
    };
    return ModelManagerResponse.parse(snapshot);
  } });
}
