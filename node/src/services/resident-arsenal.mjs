// node/src/services/resident-arsenal.mjs
//
// COVERT RESIDENT AWARENESS LAYER — SLICE 1: Canonical Resident Arsenal projection.
//
// READ-ONLY projection facility. It derives compact capability descriptors from
// EXISTING canonical sources: no new registry, no authority, no caching, no
// prompt/context integration. Availability is mapped from canonical states;
// facts without an authoritative owner are omitted or UNKNOWN. One failed
// source degrades only its own class (warnings[]), never the whole projection.
//
// Canonical source map:
//   SKILL        skills/registry.json
//   MODEL        models/manifest.json + .aide/ingested-models.json
//   PROVIDER     node/src/services/providers.ts (BUILTIN_PROVIDERS) + .aide/byok/providers.json
//   PLUGIN       plugins/manager.mjs (+ plugins/presets.json, .aide/plugins.json)
//   WORKFLOW     workbenches/manager.mjs (in-box bundles) + .aide/workbenches/<id>.json
//   TOOL         node/src/services/agent-tools.mjs (createAgentTools)
//   VERIFICATION harness/policy.json (verification[])
//   DEVICE       node/src/services/hardware.ts (probeHardware) + hardware-profile.mjs
//   RUNTIME      node/src/services/runtime-providers.ts (createRuntimeProviderRegistry)

import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';

export const ARSENAL_SCHEMA_VERSION = '1';

export const AVAILABILITY = Object.freeze({
  READY: 'READY',
  RUNNING: 'RUNNING',
  STARTING: 'STARTING',
  STOPPED: 'STOPPED',
  DEGRADED: 'DEGRADED',
  UNAVAILABLE: 'UNAVAILABLE',
  DISCONNECTED: 'DISCONNECTED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  NOT_INSTALLED: 'NOT_INSTALLED',
  CONNECTING: 'CONNECTING',
  UNKNOWN: 'UNKNOWN'
});

const KIND_ORDER = ['SKILL', 'MODEL', 'PROVIDER', 'PLUGIN', 'WORKFLOW', 'TOOL', 'VERIFICATION', 'DEVICE', 'RUNTIME'];
const AVAILABILITY_ORDER = Object.values(AVAILABILITY);

export const ARSENAL_SOURCES = Object.freeze({
  SKILL: 'skills/registry.json',
  MODEL: 'models/manifest.json + .aide/ingested-models.json',
  PROVIDER: 'node/src/services/providers.ts (BUILTIN_PROVIDERS) + .aide/byok/providers.json',
  PLUGIN: 'plugins/manager.mjs + plugins/presets.json + .aide/plugins.json',
  WORKFLOW: 'workbenches/manager.mjs (in-box bundles) + .aide/workbenches/<id>.json',
  TOOL: 'node/src/services/agent-tools.mjs (createAgentTools)',
  VERIFICATION: 'harness/policy.json (verification[])',
  DEVICE: 'node/src/services/hardware.ts (probeHardware) + hardware-profile.mjs (deriveTier/deriveBackend)',
  RUNTIME: 'node/src/services/runtime-providers.ts (createRuntimeProviderRegistry)'
});

// Canonical state -> availability mapping (documented in the Slice-1 report).
const MODEL_STATE_MAP = Object.freeze({
  ready: 'READY',
  running: 'RUNNING',
  starting: 'STARTING',
  stopped: 'STOPPED',
  error: 'UNAVAILABLE',
  pending: 'NOT_INSTALLED',
  experimental: 'UNKNOWN'
});
const PROVIDER_STATUS_MAP = Object.freeze({
  connected: 'READY',
  invalid_key: 'UNAVAILABLE',
  unreachable: 'DISCONNECTED',
  checking: 'CONNECTING',
  not_connected: 'NOT_CONFIGURED'
});
const RUNTIME_STATE_MAP = Object.freeze({
  available: 'READY',
  unhealthy: 'DEGRADED',
  unsupported: 'UNAVAILABLE',
  'requires-setup': 'NOT_CONFIGURED'
});

function byKindThenId(a, b) {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}
function stringArray(value) {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
}
async function readJsonSafe(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}
async function safeProbe(fn) {
  try { return await fn(); } catch { return undefined; }
}

async function collectSkills(repoRoot, warnings) {
  const registry = await readJsonSafe(path.join(repoRoot, 'skills', 'registry.json'));
  if (!registry || !Array.isArray(registry.skills)) {
    warnings.push('SKILL: canonical registry unavailable (skills/registry.json)');
    return [];
  }
  const out = [];
  for (const skill of registry.skills) {
    if (!skill || !isNonEmptyString(skill.name)) continue;
    const descriptor = { id: skill.name, kind: 'SKILL', availability: AVAILABILITY.READY, location: 'local' };
    if (isNonEmptyString(skill.category)) descriptor.category = skill.category;
    out.push(descriptor);
  }
  return out;
}

function modelArtifactPresent(modelsDir, entry) {
  const uri = isNonEmptyString(entry.artifact_uri) ? entry.artifact_uri : '';
  if (uri.startsWith('hf://')) return false;
  let candidate = uri.startsWith('local://') ? uri.slice('local://'.length) : '';
  candidate = candidate.split(' (')[0].trim();
  if (!candidate && isNonEmptyString(entry.file)) candidate = entry.file;
  if (!candidate && isNonEmptyString(entry.model)) candidate = entry.model;
  if (!candidate) return false;
  const abs = path.isAbsolute(candidate) ? candidate : path.join(modelsDir, candidate);
  return existsSync(abs);
}

async function collectModels(repoRoot, workspace, probes, warnings) {
  const manifest = await readJsonSafe(path.join(repoRoot, 'models', 'manifest.json'));
  const entries = manifest && Array.isArray(manifest.models) ? manifest.models.slice() : [];
  if (!manifest || !Array.isArray(manifest.models)) warnings.push('MODEL: models/manifest.json unavailable');
  const ingested = await readJsonSafe(path.join(workspace, '.aide', 'ingested-models.json'));
  const ingestedList = Array.isArray(ingested) ? ingested : (ingested && Array.isArray(ingested.models) ? ingested.models : []);
  const seen = new Set(entries.filter(entry => entry && isNonEmptyString(entry.id)).map(entry => entry.id));
  for (const entry of ingestedList) {
    if (entry && isNonEmptyString(entry.id) && !seen.has(entry.id)) { entries.push(entry); seen.add(entry.id); }
  }
  const modelsDir = path.join(repoRoot, 'models');
  const out = [];
  for (const entry of entries) {
    if (!entry || !isNonEmptyString(entry.id)) continue;
    const live = probes.modelStatus ? await safeProbe(() => probes.modelStatus(entry.id)) : undefined;
    const status = isNonEmptyString(live) ? live : (isNonEmptyString(entry.status) ? entry.status : null);
    let availability = MODEL_STATE_MAP[status] ?? AVAILABILITY.UNKNOWN;
    if (status === 'ready' || status === 'running' || status === 'starting' || status === 'stopped') {
      if (!modelArtifactPresent(modelsDir, entry)) availability = AVAILABILITY.UNAVAILABLE;
    }
    const descriptor = { id: entry.id, kind: 'MODEL', availability };
    const roles = stringArray(entry.roles);
    if (roles.length > 0) descriptor.roles = roles;
    if (typeof entry.context_tokens === 'number' && Number.isFinite(entry.context_tokens)) descriptor.context_limit = entry.context_tokens;
    const local = entry.providerType === 'local' || (isNonEmptyString(entry.artifact_uri) && entry.artifact_uri.startsWith('local://'));
    if (local) descriptor.location = 'local';
    out.push(descriptor);
  }
  return out;
}

async function collectProviders(workspace, probes, warnings) {
  let builtin = [];
  try {
    const mod = await import('./providers.ts');
    builtin = Array.isArray(mod.BUILTIN_PROVIDERS) ? mod.BUILTIN_PROVIDERS : [];
  } catch {
    warnings.push('PROVIDER: builtin catalog unavailable (providers.ts)');
  }
  const byok = await readJsonSafe(path.join(workspace, '.aide', 'byok', 'providers.json'));
  const byokList = Array.isArray(byok) ? byok.filter(entry => entry && isNonEmptyString(entry.id)) : [];
  const byokIds = new Set(byokList.map(entry => entry.id));
  const seen = new Set();
  const out = [];
  for (const provider of builtin) {
    if (!isNonEmptyString(provider.id) || seen.has(provider.id)) continue;
    seen.add(provider.id);
    const configured = byokIds.has(provider.id);
    const descriptor = { id: provider.id, kind: 'PROVIDER', availability: AVAILABILITY.NOT_CONFIGURED, location: 'cloud' };
    const caps = isNonEmptyString(provider.kind) ? ['api:' + provider.kind] : [];
    if (caps.length > 0) descriptor.capabilities = caps;
    if (typeof provider.contextLength === 'number' && Number.isFinite(provider.contextLength)) descriptor.context_limit = provider.contextLength;
    if (configured) {
      descriptor.availability = AVAILABILITY.UNKNOWN;
      if (probes.providerStatus) {
        const status = await safeProbe(() => probes.providerStatus(provider.id));
        descriptor.availability = PROVIDER_STATUS_MAP[status] ?? AVAILABILITY.UNKNOWN;
      }
    }
    out.push(descriptor);
  }
  for (const provider of byokList) {
    if (seen.has(provider.id)) continue;
    seen.add(provider.id);
    const descriptor = { id: provider.id, kind: 'PROVIDER', availability: AVAILABILITY.UNKNOWN };
    if (probes.providerStatus) {
      const status = await safeProbe(() => probes.providerStatus(provider.id));
      descriptor.availability = PROVIDER_STATUS_MAP[status] ?? AVAILABILITY.UNKNOWN;
    }
    out.push(descriptor);
  }
  return out;
}

async function collectPlugins(repoRoot, workspace, warnings) {
  const pluginsDir = path.join(workspace, 'plugins');
  const presetsPath = path.join(repoRoot, 'plugins', 'presets.json');
  const statePath = path.join(workspace, '.aide', 'plugins.json');
  let installed = [];
  let presets = [];
  if (existsSync(pluginsDir)) {
    try {
      const { PluginManager } = await import('../../../plugins/manager.mjs');
      const manager = new PluginManager({ pluginsDir, statePath, presetsPath });
      await manager.load();
      installed = manager.list();
      presets = manager.presets();
    } catch {
      warnings.push('PLUGIN: manager load failed');
      return [];
    }
  } else {
    const catalog = await readJsonSafe(presetsPath);
    if (Array.isArray(catalog)) presets = catalog.map(preset => ({ ...preset, installed: false }));
    else warnings.push('PLUGIN: no plugin sources available (plugins/ and presets.json)');
  }
  const out = [];
  for (const plugin of installed) {
    if (!plugin || !isNonEmptyString(plugin.id)) continue;
    const descriptor = {
      id: plugin.id,
      kind: 'PLUGIN',
      availability: plugin.trusted === true ? AVAILABILITY.READY : AVAILABILITY.UNAVAILABLE,
      location: 'local'
    };
    const caps = stringArray(plugin.capabilities);
    if (caps.length > 0) descriptor.capabilities = caps;
    out.push(descriptor);
  }
  const installedIds = new Set(out.map(descriptor => descriptor.id));
  for (const preset of presets) {
    if (!preset || !isNonEmptyString(preset.id) || installedIds.has(preset.id)) continue;
    const descriptor = { id: preset.id, kind: 'PLUGIN', availability: AVAILABILITY.NOT_INSTALLED, location: 'local' };
    const caps = stringArray(preset.capabilities);
    if (caps.length > 0) descriptor.capabilities = caps;
    out.push(descriptor);
  }
  return out;
}

async function collectWorkflows(workspace, warnings) {
  try {
    const { WorkbenchManager } = await import('../../../workbenches/manager.mjs');
    const manager = new WorkbenchManager({ workspace });
    const { workbenches } = await manager.list();
    if (!Array.isArray(workbenches)) return [];
    return workbenches.filter(bundle => bundle && isNonEmptyString(bundle.id)).map(bundle => {
      let availability = AVAILABILITY.NOT_INSTALLED;
      if (bundle.installed && bundle.enabled && bundle.validated) availability = AVAILABILITY.READY;
      else if (bundle.installed && bundle.enabled) availability = AVAILABILITY.DEGRADED;
      else if (bundle.installed) availability = AVAILABILITY.UNAVAILABLE;
      return { id: bundle.id, kind: 'WORKFLOW', availability, location: 'local' };
    });
  } catch {
    warnings.push('WORKFLOW: workbench manager unavailable');
    return [];
  }
}

async function collectTools(workspace, warnings) {
  try {
    const { createAgentTools } = await import('./agent-tools.mjs');
    const { tools } = createAgentTools({ workspace, rg: null, desktop: null, authority: null });
    return tools.map(tool => ({
      id: tool.name,
      kind: 'TOOL',
      availability: AVAILABILITY.READY,
      location: 'local',
      read_only: tool.readOnly === true
    }));
  } catch {
    warnings.push('TOOL: agent tools registry unavailable');
    return [];
  }
}

async function collectVerification(repoRoot, warnings) {
  const policy = await readJsonSafe(path.join(repoRoot, 'harness', 'policy.json'));
  if (!policy || !Array.isArray(policy.verification)) {
    warnings.push('VERIFICATION: harness/policy.json unavailable');
    return [];
  }
  return policy.verification.filter(isNonEmptyString).map(gate => ({
    id: gate,
    kind: 'VERIFICATION',
    availability: AVAILABILITY.READY,
    location: 'local'
  }));
}

async function collectDevice(probes, warnings) {
  try {
    const hardware = probes.hardware ? await probes.hardware() : await (await import('./hardware.ts')).probeHardware();
    const { deriveTier, deriveBackend } = await import('./hardware-profile.mjs');
    const capabilities = [];
    if (typeof hardware.totalRamBytes === 'number') {
      capabilities.push('tier:' + deriveTier(hardware.totalRamBytes));
      capabilities.push('ram:' + Math.round(hardware.totalRamBytes / 1073741824) + 'gb');
    }
    if (typeof hardware.vramBytes === 'number') {
      capabilities.push('backend:' + deriveBackend(hardware.vramBytes));
      capabilities.push('vram:' + Math.round(hardware.vramBytes / 1048576) + 'mb');
    }
    if (typeof hardware.logicalCpus === 'number') capabilities.push('cpus:' + hardware.logicalCpus);
    return [{ id: 'local-device', kind: 'DEVICE', availability: AVAILABILITY.READY, capabilities }];
  } catch {
    warnings.push('DEVICE: hardware probe failed');
    return [{ id: 'local-device', kind: 'DEVICE', availability: AVAILABILITY.UNKNOWN }];
  }
}

async function collectRuntimes(probes, warnings) {
  try {
    let registry = probes.runtimeProviders;
    if (!registry) {
      const mod = await import('./runtime-providers.ts');
      registry = mod.createRuntimeProviderRegistry(mod.createDefaultProviderDeps());
    }
    const list = await registry.list();
    if (!Array.isArray(list)) return [];
    return list.filter(entry => entry && isNonEmptyString(entry.id)).map(entry => ({
      id: entry.id,
      kind: 'RUNTIME',
      availability: RUNTIME_STATE_MAP[entry.state] ?? AVAILABILITY.UNKNOWN,
      location: 'local'
    }));
  } catch {
    warnings.push('RUNTIME: provider registry unavailable');
    return [];
  }
}

async function measureBody(body) {
  const { estimateTokens } = await import('./history-fit.ts');
  const text = JSON.stringify(body, null, 2);
  const byKind = {};
  for (const kind of KIND_ORDER) {
    const descriptors = body.descriptors.filter(descriptor => descriptor.kind === kind);
    if (descriptors.length === 0) continue;
    const kindText = JSON.stringify(descriptors);
    byKind[kind] = { count: descriptors.length, characters: kindText.length, estimated_tokens: estimateTokens(kindText) };
  }
  return {
    note: 'characters/estimated_tokens are measured over the projection body excluding this measurements block',
    characters: text.length,
    estimated_tokens: estimateTokens(text),
    summary_tokens: estimateTokens(JSON.stringify(body.summary)),
    by_kind: byKind
  };
}

export async function buildArsenalProjection({ workspace, repoRoot = workspace, probes = {} } = {}) {
  if (!isNonEmptyString(workspace)) throw new Error('workspace is required');
  const warnings = [];
  const descriptors = [
    ...await collectSkills(repoRoot, warnings),
    ...await collectModels(repoRoot, workspace, probes, warnings),
    ...await collectProviders(workspace, probes, warnings),
    ...await collectPlugins(repoRoot, workspace, warnings),
    ...await collectWorkflows(workspace, warnings),
    ...await collectTools(workspace, warnings),
    ...await collectVerification(repoRoot, warnings),
    ...await collectDevice(probes, warnings),
    ...await collectRuntimes(probes, warnings)
  ].sort(byKindThenId);

  const byKind = {};
  for (const kind of KIND_ORDER) {
    const count = descriptors.filter(descriptor => descriptor.kind === kind).length;
    if (count > 0) byKind[kind] = count;
  }
  const byAvailability = {};
  for (const state of AVAILABILITY_ORDER) {
    const count = descriptors.filter(descriptor => descriptor.availability === state).length;
    if (count > 0) byAvailability[state] = count;
  }

  const body = {
    schema_version: ARSENAL_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    note: 'Resident Awareness Layer Slice 1 — canonical arsenal projection (read-only; not wired into any prompt/context).',
    availability_values: AVAILABILITY_ORDER.slice(),
    sources: { ...ARSENAL_SOURCES },
    descriptors,
    summary: { total: descriptors.length, by_kind: byKind, by_availability: byAvailability },
    unsupported: {
      classes: [
        { id: 'RESIDENT_SOPS', reason: 'no canonical resident-SOP registry exists (design-planned namespace; later slice)' },
        { id: 'WORKERS', reason: 'no separate canonical worker registry; worker routing metadata is exposed via MODEL roles[]' },
        { id: 'TOOLS.commands', reason: 'the builtin command registry has no exported canonical source (module-local in openapi.ts); agent tools are covered' }
      ],
      fields: [
        { id: 'cost_class', reason: 'no canonical cost source exists; omitted from every descriptor' },
        { id: 'sop', reason: 'no resident.* routing hints exist yet; omitted from every descriptor' }
      ]
    },
    warnings
  };
  const measurements = await measureBody(body);
  return { ...body, measurements };
}
