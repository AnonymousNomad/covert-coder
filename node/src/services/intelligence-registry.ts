// node/src/services/intelligence-registry.ts
// CANONICAL INTELLIGENCE REGISTRY (production model-management infrastructure).
// One representation for local artifacts, cloud providers and qualification
// evidence. Availability and qualification are SEPARATE states (an installed
// model is not a qualified model). Qualification attaches to the exact
// artifact/revision/hash/runtime treatment (artifact identity law).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const AVAILABILITY_STATES = ['UNAVAILABLE', 'DISCOVERED', 'AVAILABLE', 'INSTALLED', 'CONNECTED', 'LOADABLE'] as const;
export const QUALIFICATION_STATES = ['UNTESTED', 'TESTED', 'QUALIFIED', 'NOT_QUALIFIED', 'INVALID_EVIDENCE', 'STALE'] as const;
export const PROVIDER_STATES = ['CONFIGURED_NOT_VERIFIED', 'AUTHENTICATED', 'AUTH_FAILURE', 'UNAVAILABLE'] as const;

export const ArtifactSchema = z.object({
  file: z.string().optional(),
  revision: z.string().optional(),
  hash: z.string().optional(),
  hash_status: z.enum(['verified', 'not_computed', 'mismatch']).optional(),
  format: z.string().optional(),
  quantization: z.string().optional()
}).strict();

export const QualificationBasisSchema = z.object({
  artifact_hash: z.string().optional(),
  harness_profile_hash: z.string().optional(),
  runtime: z.string().optional(),
  contract_version: z.string().optional()
}).strict();

export const QualificationSchema = z.object({
  state: z.enum(QUALIFICATION_STATES),
  qualified_roles: z.array(z.string()),
  unqualified_roles: z.array(z.string()),
  evidence_refs: z.array(z.string()),
  basis: QualificationBasisSchema.optional()
}).strict();

export const IntelligenceEntrySchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1),
  family: z.string().optional(),
  provider: z.string().min(1),
  locality: z.enum(['LOCAL', 'CLOUD']),
  artifact: ArtifactSchema.optional(),
  runtime: z.object({ backend: z.string(), endpoint: z.string().optional(), profile_ref: z.string().optional() }).strict().optional(),
  availability: z.enum(AVAILABILITY_STATES),
  provider_state: z.enum(PROVIDER_STATES).optional(),
  qualification: QualificationSchema,
  known_strengths: z.array(z.string()).default([]),
  known_failures: z.array(z.string()).default([]),
  resource_requirements: z.object({ ram_mb: z.number().optional(), vram_mb: z.number().optional(), disk_mb: z.number().optional() }).strict().optional(),
  harness_profile_ref: z.string().optional(),
  passport_ref: z.string().optional(),
  evidence_refs: z.array(z.string()).default([])
}).strict();

export const RegistrySchema = z.object({
  schema: z.literal('intelligence-registry-v1'),
  entries: z.array(IntelligenceEntrySchema)
}).strict();

export type IntelligenceEntry = z.infer<typeof IntelligenceEntrySchema>;
export type Registry = z.infer<typeof RegistrySchema>;

export function emptyRegistry(): Registry {
  return { schema: 'intelligence-registry-v1', entries: [] };
}

export class IntelligenceRegistry {
  private file: string;
  private registry: Registry = emptyRegistry();

  constructor(options: { workspace: string }) {
    this.file = path.join(options.workspace, '.aide', 'intelligence', 'registry.json');
  }

  async load(): Promise<Registry> {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.registry = RegistrySchema.parse(raw);
    } catch {
      this.registry = emptyRegistry();
    }
    return this.registry;
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this.registry, null, 2), 'utf8');
  }

  list(): IntelligenceEntry[] {
    return this.registry.entries;
  }

  get(id: string): IntelligenceEntry | undefined {
    return this.registry.entries.find(entry => entry.id === id);
  }

  async upsert(entry: IntelligenceEntry): Promise<IntelligenceEntry> {
    const parsed = IntelligenceEntrySchema.parse(entry);
    const index = this.registry.entries.findIndex(existing => existing.id === parsed.id);
    if (index >= 0) this.registry.entries[index] = parsed;
    else this.registry.entries.push(parsed);
    await this.save();
    return parsed;
  }

  async remove(id: string): Promise<boolean> {
    const before = this.registry.entries.length;
    this.registry.entries = this.registry.entries.filter(entry => entry.id !== id);
    await this.save();
    return this.registry.entries.length !== before;
  }

  // Artifact-identity staleness: qualification survives only while the exact
  // artifact/revision/hash and material runtime treatment are unchanged.
  evaluateStaleness(id: string, current: { artifact_hash?: string; harness_profile_hash?: string; runtime?: string }): { stale: boolean; reasons: string[] } {
    const entry = this.get(id);
    const reasons: string[] = [];
    if (!entry) return { stale: true, reasons: ['entry_missing'] };
    if (entry.qualification.state !== 'QUALIFIED') return { stale: false, reasons: [] };
    const basis = entry.qualification.basis;
    if (basis?.artifact_hash && current.artifact_hash && basis.artifact_hash !== current.artifact_hash) reasons.push('artifact_hash_changed');
    if (basis?.harness_profile_hash && current.harness_profile_hash && basis.harness_profile_hash !== current.harness_profile_hash) reasons.push('harness_profile_changed');
    if (basis?.runtime && current.runtime && basis.runtime !== current.runtime) reasons.push('runtime_treatment_changed');
    if (reasons.length > 0 && entry.qualification.state === 'QUALIFIED') {
      entry.qualification.state = 'STALE';
    }
    return { stale: reasons.length > 0, reasons };
  }
}

// ---------------------------------------------------------------------------
// Public-safe serialization: the website lane consumes this and nothing else.
// Strips: local filesystem paths, endpoints, provider internals, credentials.
const SECRET_RE = /(api[_-]?key|token|secret|password|authorization:\s*bearer)/i;
const ABS_PATH_RE = /(?:^|[^A-Za-z0-9])([A-Za-z]:\\|\/Users\/|\/home\/)/;

export function toPublicSafe(entry: IntelligenceEntry): Record<string, unknown> {
  const safe: Record<string, unknown> = {
    id: entry.id,
    display_name: entry.display_name,
    family: entry.family,
    provider: entry.provider,
    locality: entry.locality,
    availability: entry.availability,
    qualification: {
      state: entry.qualification.state,
      qualified_roles: entry.qualification.qualified_roles,
      evidence_refs: entry.qualification.evidence_refs
    },
    format: entry.artifact?.format,
    quantization: entry.artifact?.quantization,
    known_strengths: entry.known_strengths,
    known_failures: entry.known_failures
  };
  const serialized = JSON.stringify(safe);
  if (SECRET_RE.test(serialized)) throw new Error('public-safe serialization would leak a credential-shaped value');
  if (ABS_PATH_RE.test(serialized)) throw new Error('public-safe serialization would leak a local path');
  return safe;
}
