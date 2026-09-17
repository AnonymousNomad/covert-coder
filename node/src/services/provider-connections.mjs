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

const HF_SLOT = 'huggingface';
const PREFERENCE_FILE = '.aide/routing-preference.json';
const DEFAULT_PREFERENCE = 'local-first';
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

  function readJson(filePath, fallback) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return fallback;
    }
  }

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

  function connected(entry) {
    return entry && entry.runtime_available === true;
  }

  async function localConnection() {
    let models = [];
    try {
      const status = await modelRuntimeStatus();
      if (status && Array.isArray(status.models)) models = status.models;
    } catch {
      models = [];
    }
    const ready = models.filter(connected);
    return {
      id: 'local-runtime',
      provider_id: 'local',
      name: 'Local runtime (llama.cpp GGUF)',
      kind: 'local-runtime',
      status: ready.length > 0 ? 'connected' : 'not_configured',
      detail: ready.length > 0 ? `${ready.length} model${ready.length === 1 ? '' : 's'} ready` : 'no local GGUF model ready',
      capabilities: ready.length > 0 ? ['chat', 'act', 'utility'] : [],
      routing_available: true,
      account_label: 'self-hosted'
    };
  }

  async function apiConnections() {
    const result = [];
    // BYOK providers (exact-op enrolled config + secretStore slots).
    let byokStatus = { providers: [], routing: { plan: 'local', act: 'local', utility: 'local' }, consent_enabled: false };
    try {
      byokStatus = byokService.status() ?? byokStatus;
    } catch {
      byokStatus = byokStatus;
    }
    const byokProviders = Array.isArray(byokStatus.providers) ? byokStatus.providers : [];
    for (const provider of byokProviders) {
      const configured = Boolean(provider && provider.key_stored === true);
      result.push({
        id: `api:${provider.id}`,
        provider_id: provider.id,
        name: String(provider.name || provider.id),
        kind: 'api-key',
        status: configured ? 'connected' : 'not_configured',
        detail: configured ? 'API key stored in the encrypted vault' : 'no key stored',
        capabilities: ['chat', 'act', 'utility'],
        routing_available: true,
        account_label: 'api-key vault'
      });
    }
    // Builtin catalog cards (existing CredentialStore surface).
    let builtins = [];
    try {
      const listed = await providerService.list();
      if (Array.isArray(listed)) builtins = listed;
    } catch {
      builtins = [];
    }
    for (const provider of builtins) {
      const state = String(provider.status ?? 'not_connected');
      result.push({
        id: `builtin:${provider.id}`,
        provider_id: provider.id,
        name: String(provider.name || provider.id),
        kind: 'api-key',
        status: state === 'connected' ? 'connected' : state === 'invalid_key' ? 'invalid_key' : state === 'unreachable' ? 'unreachable' : 'not_configured',
        detail: state === 'connected' ? 'live probe passed' : state === 'invalid_key' ? 'stored key rejected by the provider' : state === 'unreachable' ? 'provider unreachable' : 'no key configured',
        capabilities: ['chat', 'act', 'utility'],
        routing_available: true,
        account_label: 'builtin provider'
      });
    }
    return result;
  }

  async function subscriptionConnections() {
    const result = [];
    for (const [id, runtime] of Object.entries(SUBSCRIPTION_RUNTIMES)) {
      const exePath = await findExecutable(runtime.exec);
      let authenticated = false;
      if (exePath) {
        try {
          authenticated = fs.existsSync(runtime.authFile());
        } catch {
          authenticated = false;
        }
      }
      result.push({
        id: `subscription:${id}`,
        provider_id: id,
        name: `${runtime.display} subscription`,
        kind: 'subscription',
        status: !exePath ? 'unavailable' : authenticated ? 'connected' : 'sign_in_required',
        detail: !exePath ? `${runtime.exec} CLI not detected on PATH` : authenticated ? `authenticated with the official ${runtime.exec} runtime` : 'run the official sign-in, then refresh',
        capabilities: ['chat'],
        routing_available: false,
        account_label: 'official CLI'
      });
    }
    return result;
  }

  async function catalogConnection() {
    let stored = false;
    try {
      const value = secretStore.getKey(HF_SLOT);
      stored = typeof value === 'string' && value.length > 0;
    } catch {
      stored = false;
    }
    return {
      id: 'hf-token',
      provider_id: 'huggingface',
      name: 'Hugging Face access',
      kind: 'catalog-token',
      status: stored ? 'connected' : 'not_configured',
      detail: stored ? 'access token stored; attached to modelhub egress' : 'no token stored (public repos still reachable)',
      capabilities: ['catalog'],
      routing_available: false,
      account_label: 'catalog vault'
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
      return {
        plan: routing.plan ?? 'local',
        act: routing.act ?? 'local',
        utility: routing.utility ?? 'local'
      };
    } catch {
      return { plan: 'local', act: 'local', utility: 'local' };
    }
  }

  function getPreference() {
    const value = readJson(preferencePath, null);
    const candidate = value && typeof value.preference === 'string' ? value.preference : DEFAULT_PREFERENCE;
    return ['local-first', 'local-only', 'api-keys-with-approval'].includes(candidate) ? candidate : DEFAULT_PREFERENCE;
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
        if (error && error.code === 'FORBIDDEN') return { ok: false, detail: 'egress consent is disabled; enable consent, then restore the exact test approval' };
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
      return { ok: true, command: '', status: 'connected', detail: `${runtime.exec} is authenticated with the official runtime` };
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