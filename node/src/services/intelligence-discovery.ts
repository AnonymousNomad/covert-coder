// node/src/services/intelligence-discovery.ts
// Bounded discovery: local GGUF artifacts in configured locations + cloud
// provider state representation WITHOUT network calls and WITHOUT credentials.
// Never crawls entire disks; never prints credential values.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IntelligenceEntry } from './intelligence-registry.ts';

export const GGUF_QUANT_RE = /(?:^|[.\-_])((?:Q\d(?:_[A-Z0-9]+)*(?:_[A-Z])?|IQ\d_[A-Z]+|q\d(?:_[a-z0-9]+)*|BF16|F16|F32))(?:[.\-_]|$)/i;

export function detectQuantization(filename: string): string | undefined {
  const match = GGUF_QUANT_RE.exec(filename);
  return match ? match[1].toUpperCase() : undefined;
}

export function configuredModelDirs(workspace: string): string[] {
  const dirs = [path.join(workspace, 'models')];
  const extra = (process.env.AIDE_MODEL_DIRS ?? '').split(path.delimiter).map(s => s.trim()).filter(Boolean);
  return [...new Set([...dirs, ...extra])];
}

export interface LocalDiscoveryResult {
  entries: IntelligenceEntry[];
  scanned_dirs: number;
  errors: string[];
}

// Depth-1 scan of bounded directories only. Hashing is deliberately NOT done
// here (GB-scale); hash_status: not_computed until an explicit verification.
export async function discoverLocalModels(workspace: string): Promise<LocalDiscoveryResult> {
  const entries: IntelligenceEntry[] = [];
  const errors: string[] = [];
  const dirs = configuredModelDirs(workspace);
  for (const dir of dirs) {
    let files: string[] = [];
    try { files = await fs.readdir(dir); } catch { continue; }
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.gguf')) continue;
      const full = path.join(dir, file);
      try {
        const stat = await fs.stat(full);
        if (!stat.isFile()) continue;
        entries.push({
          id: file.replace(/\.gguf$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          display_name: file.replace(/\.gguf$/i, ''),
          provider: 'local',
          locality: 'LOCAL',
          artifact: { file: full, format: 'gguf', quantization: detectQuantization(file), hash_status: 'not_computed' },
          availability: 'INSTALLED',
          qualification: { state: 'UNTESTED', qualified_roles: [], unqualified_roles: [], evidence_refs: [] },
          resource_requirements: { disk_mb: Math.round(stat.size / (1024 * 1024)) },
          known_strengths: [], known_failures: [], evidence_refs: []
        });
      } catch (error) {
        errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return { entries, scanned_dirs: dirs.length, errors };
}

export interface CloudProviderProbe {
  id: string;
  state: 'CONFIGURED_NOT_VERIFIED' | 'AUTHENTICATED' | 'AUTH_FAILURE' | 'UNAVAILABLE';
  models: string[];
  detail?: string;
}

// Provider state from LOCAL configuration presence only. No network requests
// (cloud access stays blocked until credential rotation is confirmed).
export async function probeCloudProviders(workspace: string): Promise<CloudProviderProbe[]> {
  const probes: CloudProviderProbe[] = [];
  const known: Array<{ id: string; env: string[] }> = [
    { id: 'openai-codex', env: ['OPENAI_API_KEY'] },
    { id: 'opencode', env: ['OPENCODE_API_KEY'] }
  ];
  let providersFile: Record<string, unknown> | null = null;
  try { providersFile = JSON.parse(await fs.readFile(path.join(workspace, '.aide', 'providers.json'), 'utf8')); } catch { providersFile = null; }
  for (const provider of known) {
    const envConfigured = provider.env.some(name => typeof process.env[name] === 'string' && process.env[name]!.length > 0);
    const fileConfigured = providersFile !== null && typeof providersFile[provider.id] === 'object';
    if (!envConfigured && !fileConfigured) {
      probes.push({ id: provider.id, state: 'UNAVAILABLE', models: [], detail: 'no local configuration present' });
    } else {
      probes.push({ id: provider.id, state: 'CONFIGURED_NOT_VERIFIED', models: [], detail: 'configuration present; not contacted (rotation pending)' });
    }
  }
  return probes;
}
