// Unified Provider Connections service. One canonical read/write surface over
// every provider/connection family WITHOUT a second model registry, routing
// engine, credential store, or authority system:
//  - API keys: the EXISTING ProviderService (builtin catalog + CredentialStore)
//    and BYOK providers (exact-operation enrolled routes + secretStore slots).
//  - Local runtimes: the EXISTING modelRuntime status (ready GGUF engines).
//  - Subscription runtimes: official CLI PRESENCE + authenticated-artifact
//    presence probes ONLY (never reads or stores credential material).
//  - Hugging Face: one reserved secretStore slot ("huggingface") whose bearer
//    is attached by the EXISTING modelhub fetch path (see modelhub.mjs).
//
// The only durable state owned here is the routing preference file.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { readRoutingPreference } from './routing-preference.mjs';

const HF_SLOT = 'huggingface';
const PREFERENCE_FILE = '.aide/routing-preference.json';
const SUBSCRIPTION_RUNTIMES = {
  codex: { exec: 'codex', authFile: () => path.join(os.homedir(), '.codex', 'auth.json'), display: 'Codex' },
  claude: { exec: 'claude', authFile: () => path.join(os.homedir(), '.claude', '.credentials.json'), display: 'Claude Code' }
};

export function createProviderConnectionsService(options) {
  const workspace = options.workspace;
  const providerService = options.providerService;
  const byokService = options.byokService;
  const modelRuntime = options.modelRuntime ?? null;
  const modelRuntimeStatus =
    options.modelRuntimeStatus ??
    (async () => (modelRuntime ? await modelRuntime.status() : { runtime: null, models: [] }));
  const secretStore = options.secretStore;
  const findExecutable = options.findExecutable ?? defaultFindExecutable;
  const preferencePath = options.preferencePath ?? path.join(workspace, PREFERENCE_FILE);

  function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 1), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  async function defaultFindExecutable(name) {
    const isWin = process.platform === 'win32';
    const candidates = isWin ? [name, `${name}.exe`, `${name}.cmd`, `${name}.ps1`] : [name];
    for (const candidate of candidates) {
      let resolved = null;
      try {
        resolved = await new Promise((resolve) => {
          execFile(isWin ? 'where.exe' : 'which', [candidate], { windowsHide: true }, (error, stdout) => {
            if (error) return resolve(null);
            const first = String(stdout).split(/\r?\n/)[0]?.trim();
            resolve(first && first.length > 0 ? first : null);
          });
        });
      } catch {
        resolved = null;
      }
      if (resolved) return resolved;
    }
    return null;
  }

  const SECRET_VALUE_RE = /(?:sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9]{12,}|Bearer\s+\S+|(?:api[_-]?key|token)=\S+)/i;
  const ABSOLUTE_PATH_RE = /(?:\b[A-Za-z]:[\\/]|\\\\|(?:^|[\s"'=])\/(?:root|home|Users|mnt|tmp|private|var|etc)\/)/i;

  function safeLabel(value, fallback) {
    if (typeof value !== 'string' || value.length === 0 || SECRET_VALUE_RE.test(value) || ABSOLUTE_PATH_RE.test(value)) return fallback;
    return value.slice(0, 120);
  }

  function safeModelReference(providerId, modelId) {
    if (typeof modelId !== 'string' || modelId.length === 0 || SECRET_VALUE_RE.test(modelId) || ABSOLUTE_PATH_RE.test(modelId)) return null;
    const safeProvider = safeLabel(providerId, 'provider');
    const safeModel = safeLabel(modelId, 'model');
    return { model_id: `provider:${safeProvider}:${safeModel}`, provider_model_id: safeModel, model_support_state: 'unknown' };
  }

  function accessMetadata({
    authenticationMode, authenticationConfigured, credentialId, credentialKind,
    credentialState, health, executionAdapters, modelRefs = [], externalEgressRequired,
    operatorSetupRequired, setupState
  }) {
    return {
      authentication_mode: authenticationMode,
      authentication_configured: authenticationConfigured,
      credential_source: { id: credentialId, kind: credentialKind, configuration_state: credentialState },
      health,
      execution_adapters: executionAdapters,
      model_refs: modelRefs,
      external_egress_required: externalEgressRequired,
      operator_setup_required: operatorSetupRequired,
      setup_state: setupState
    };
  }

  async function localConnection() {
    let status = { runtime: false, models: [] };
    try {
      status = await modelRuntimeStatus() ?? status;
    } catch {
      status = { runtime: false, models: [] };
    }
    const models = Array.isArray(status.models) ? status.models : [];
    const ready = models.filter(model =>
      model && model.status === 'running' && model.qualification === 'accepted_hash_verified' &&
      model.runtime_available === true && model.artifact_available === true
    );
    const readyIds = new Set(ready.map(model => model.id).filter((id) => typeof id === 'string'));
    const configured = status.runtime === true;
    const connectionStatus = ready.length > 0 ? 'connected' : configured ? 'configured_not_verified' : 'unavailable';
    const modelRefs = models
      .map(model => {
        const id = safeLabel(model?.id, '');
        if (!id) return null;
        return {
          model_id: id,
          provider_model_id: id,
          model_support_state: readyIds.has(model.id) ? 'verified' : 'unknown'
        };
      })
      .filter(Boolean);
    return {
      id: 'local-runtime',
      provider_id: 'local',
      name: 'Unsloth local runtime',
      kind: 'local-runtime',
      status: connectionStatus,
      detail: ready.length > 0 ? 'a hash-verified model is running' : configured ? 'runtime is present; no qualified model is currently ready' : 'canonical runtime is not currently available',
      capabilities: ready.length > 0 ? ['chat', 'act', 'utility'] : [],
      routing_available: ready.length > 0,
      account_label: 'self-hosted',
      access: accessMetadata({
        authenticationMode: 'none',
        authenticationConfigured: false,
        credentialId: null,
        credentialKind: 'local_none',
        credentialState: 'not_required',
        health: ready.length > 0 ? 'healthy' : configured ? 'unknown' : 'unavailable',
        executionAdapters: ['local-runtime'],
        modelRefs,
        externalEgressRequired: false,
        operatorSetupRequired: ready.length === 0,
        setupState: ready.length > 0 ? 'ready' : configured ? 'verification_required' : 'unavailable'
      })
    };
  }

  async function apiConnections() {
    const result = [];
    let byokStatus = { providers: [], routing: { plan: 'local', act: 'local', utility: 'local' }, consent_enabled: false };
    try {
      byokStatus = byokService.status() ?? byokStatus;
    } catch {
      byokStatus = byokStatus;
    }
    const consentEnabled = byokStatus.consent_enabled === true && getPreference() !== 'local-only';
    const byokProviders = Array.isArray(byokStatus.providers) ? byokStatus.providers : [];
    for (const provider of byokProviders) {
      const providerId = safeLabel(provider?.id, 'custom-provider');
      const configured = provider?.key_stored === true;
      const providerModelId = safeLabel(provider?.model_id, 'configured-model');
      const reference = provider?.model_id ? safeModelReference(providerId, providerModelId) : null;
      result.push({
        id: 'api:' + providerId,
        provider_id: providerId,
        name: safeLabel(provider?.name, providerId),
        kind: 'api-key',
        status: configured ? 'configured_not_verified' : 'not_configured',
        detail: configured ? 'API key is stored; provider authentication has not been verified' : 'no key stored',
        capabilities: ['chat', 'act', 'utility'],
        routing_available: false,
        account_label: 'api-key vault',
        access: accessMetadata({
          authenticationMode: 'api_key',
          authenticationConfigured: configured,
          credentialId: 'credential-source:byok:' + providerId,
          credentialKind: 'api_key_vault',
          credentialState: configured ? 'configured' : 'missing',
          health: 'unknown',
          executionAdapters: ['direct-http'],
          modelRefs: reference ? [reference] : [],
          externalEgressRequired: true,
          operatorSetupRequired: true,
          setupState: !configured ? 'setup_required' : !consentEnabled ? 'consent_required' : 'verification_required'
        })
      });
    }
    let builtins = [];
    try {
      const listed = await providerService.list();
      if (Array.isArray(listed)) builtins = listed;
    } catch {
      builtins = [];
    }
    for (const provider of builtins) {
      const providerId = safeLabel(provider?.id, 'provider');
      const state = String(provider?.status ?? 'not_connected');
      const configured = provider?.configured === true;
      const healthy = configured && state === 'connected';
      const health = healthy ? 'healthy' : state === 'invalid_key' ? 'unhealthy' : state === 'unreachable' ? 'unavailable' : configured ? 'unknown' : 'unavailable';
      const status = !configured ? 'not_configured' : state === 'connected' ? 'connected' : state === 'invalid_key' ? 'invalid_key' : state === 'unreachable' ? 'unreachable' : 'configured_not_verified';
      const references = (Array.isArray(provider?.models) ? provider.models : [])
        .map(modelId => safeModelReference(providerId, modelId))
        .filter(Boolean);
      const routeAvailable = healthy && consentEnabled;
      const setupState = !configured ? 'setup_required' : state === 'invalid_key' ? 'remediation_required' : !consentEnabled ? 'consent_required' : healthy ? 'ready' : 'verification_required';
      result.push({
        id: 'builtin:' + providerId,
        provider_id: providerId,
        name: safeLabel(provider?.name, providerId),
        kind: 'api-key',
        status,
        detail: healthy ? 'provider probe passed' : state === 'invalid_key' ? 'stored key rejected by the provider' : state === 'unreachable' ? 'provider is unreachable' : configured ? 'provider authentication has not been verified' : 'no key configured',
        capabilities: ['chat', 'act', 'utility'],
        routing_available: routeAvailable,
        account_label: 'builtin provider',
        access: accessMetadata({
          authenticationMode: 'api_key',
          authenticationConfigured: configured,
          credentialId: 'credential-source:provider:' + providerId,
          credentialKind: 'api_key_vault',
          credentialState: !configured ? 'missing' : state === 'invalid_key' ? 'invalid' : 'configured',
          health,
          executionAdapters: ['direct-http'],
          modelRefs: references,
          externalEgressRequired: true,
          operatorSetupRequired: !configured || !healthy || !consentEnabled,
          setupState
        })
      });
    }
    return result;
  }

  async function subscriptionConnections() {
    const result = [];
    for (const [id, runtime] of Object.entries(SUBSCRIPTION_RUNTIMES)) {
      const exePath = await findExecutable(runtime.exec);
      let authArtifactPresent = false;
      if (exePath) {
        try {
          authArtifactPresent = fs.existsSync(runtime.authFile());
        } catch {
          authArtifactPresent = false;
        }
      }
      const configured = Boolean(exePath && authArtifactPresent);
      const adapter = id === 'codex' ? 'codex-cli' : 'claude-cli';
      result.push({
        id: 'subscription:' + id,
        provider_id: id,
        name: runtime.display + ' subscription',
        kind: 'subscription',
        status: !exePath ? 'unavailable' : configured ? 'configured_not_verified' : 'sign_in_required',
        detail: !exePath ? 'official CLI not detected on PATH' : configured ? 'official auth artifact detected; authentication has not been validated' : 'operator sign-in required',
        capabilities: ['chat'],
        routing_available: false,
        account_label: 'official CLI',
        access: accessMetadata({
          authenticationMode: 'official_cli',
          authenticationConfigured: configured,
          credentialId: 'credential-source:cli:' + id,
          credentialKind: 'official_cli_auth',
          credentialState: configured ? 'configured' : exePath ? 'missing' : 'unknown',
          health: !exePath ? 'unavailable' : 'unknown',
          executionAdapters: [adapter],
          modelRefs: [],
          externalEgressRequired: true,
          operatorSetupRequired: true,
          setupState: !exePath ? 'unavailable' : configured ? 'verification_required' : 'setup_required'
        })
      });
    }
    return result;
  }

  async function catalogConnection() {
    let stored = false;
    try {
      stored = secretStore.listProviderIds().includes(HF_SLOT);
    } catch {
      stored = false;
    }
    return {
      id: 'hf-token',
      provider_id: 'huggingface',
      name: 'Hugging Face access',
      kind: 'catalog-token',
      status: stored ? 'configured_not_verified' : 'not_configured',
      detail: stored ? 'catalog token is stored; provider validation has not been performed' : 'no token stored; public catalog entries may remain available',
      capabilities: ['catalog'],
      routing_available: false,
      account_label: 'catalog vault',
      access: accessMetadata({
        authenticationMode: 'api_key',
        authenticationConfigured: stored,
        credentialId: 'credential-source:catalog:huggingface',
        credentialKind: 'api_key_vault',
        credentialState: stored ? 'configured' : 'missing',
        health: stored ? 'unknown' : 'unavailable',
        executionAdapters: [],
        modelRefs: [],
        externalEgressRequired: true,
        operatorSetupRequired: false,
        setupState: stored ? 'verification_required' : 'not_applicable'
      })
    };
  }

  async function list() {
    const [local, api, subscription, catalog] = await Promise.all([
      localConnection(),
      apiConnections(),
      subscriptionConnections(),
      catalogConnection()
    ]);
    const all = [...subscription, ...api, local, catalog];
    const parts = [];
    if (all.some((entry) => entry.kind === 'api-key' && entry.status === 'connected')) parts.push('api-keys');
    if (all.some((entry) => entry.kind === 'subscription' && entry.status === 'connected')) parts.push('subscription');
    if (all.some((entry) => entry.kind === 'local-runtime' && entry.status === 'connected')) parts.push('local');
    if (all.some((entry) => entry.kind === 'catalog-token' && entry.status === 'connected')) parts.push('catalog');
    const consensus = parts.length > 0 ? parts.join('+') : 'none';
    return {
      consensus,
      routed_roles: currentRouting(),
      preference: getPreference(),
      connections: all
    };
  }

  function currentRouting() {
    try {
      const status = byokService.status();
      const routing = status && status.routing ? status.routing : { plan: 'local', act: 'local', utility: 'local' };
      const safeTarget = target => {
        if (target === 'local') return 'local';
        if (!target || typeof target !== 'object') return 'local';
        return {
          provider_id: safeLabel(target.provider_id, 'redacted'),
          model_id: safeLabel(target.model_id, 'redacted')
        };
      };
      return {
        plan: safeTarget(routing.plan),
        act: safeTarget(routing.act),
        utility: safeTarget(routing.utility)
      };
    } catch {
      return { plan: 'local', act: 'local', utility: 'local' };
    }
  }

  function getPreference() {
    return readRoutingPreference(workspace, preferencePath);
  }

  function setPreference(preference) {
    writeJson(preferencePath, { preference });
    return preference;
  }

  async function test(connectionId) {
    if (connectionId.startsWith('api:')) {
      const providerId = connectionId.slice('api:'.length);
      try {
        const result = await byokService.testProvider(providerId);
        return { ok: result.ok === true, detail: String(result.detail ?? '').slice(0, 240) || (result.ok === true ? 'probe passed' : 'probe failed') };
      } catch (error) {
        if (error && error.code === 'NOT_FOUND') return { ok: false, detail: 'provider is not configured' };
        if (error && error.code === 'FORBIDDEN') return { ok: false, detail: 'external egress is blocked by Local-Only policy or egress consent' };
        return { ok: false, detail: `test failed: ${String((error && error.message) ?? error).slice(0, 200)}` };
      }
    }
    if (connectionId === 'hf-token') {
      return { ok: false, detail: 'Hugging Face access is exercised by modelhub search/download operations; no synthetic probe exists' };
    }
    if (connectionId.startsWith('subscription:')) {
      return { ok: false, detail: 'state is derived from the official runtime; no synthetic probe exists' };
    }
    return { ok: false, detail: 'this connection has no live probe' };
  }

  async function subscriptionAuth(subscriptionId) {
    const runtime = SUBSCRIPTION_RUNTIMES[subscriptionId];
    if (!runtime) return { ok: false, command: '', status: 'unavailable', detail: 'unknown subscription runtime' };
    const exePath = await findExecutable(runtime.exec);
    if (!exePath) {
      return { ok: false, command: '', status: 'unavailable', detail: `${runtime.exec} CLI not detected on PATH; install the official runtime first` };
    }
    let authenticated = false;
    try {
      authenticated = fs.existsSync(runtime.authFile());
    } catch {
      authenticated = false;
    }
    if (authenticated) {
      return { ok: true, command: '', status: 'configured_not_verified', detail: 'official auth artifact detected; provider authentication has not been validated' };
    }
    return { ok: true, command: `${runtime.exec} login`, status: 'sign_in_required', detail: `run the official sign-in, then refresh this view` };
  }

  function getHfTokenStored() {
    try {
      const value = secretStore.getKey(HF_SLOT);
      return { stored: typeof value === 'string' && value.length > 0 };
    } catch {
      return { stored: false };
    }
  }

  function setHfToken(apiKey) {
    secretStore.setKey(HF_SLOT, apiKey);
    return { stored: true };
  }

  function deleteHfToken() {
    if (!getHfTokenStored().stored) {
      const error = new Error('no Hugging Face token stored');
      error.code = 'NOT_FOUND';
      throw error;
    }
    secretStore.deleteKey(HF_SLOT);
    return { ok: true };
  }

  return Object.freeze({
    list,
    getPreference,
    setPreference,
    test,
    subscriptionAuth,
    getHfTokenStored,
    setHfToken,
    deleteHfToken
  });
}
