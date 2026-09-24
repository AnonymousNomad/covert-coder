import { createReadStream } from 'node:fs';
import { constants } from 'node:fs';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  ModelPackBundleView,
  ModelPackDefinition,
  ModelPackInstallRequest,
  type ModelManagerEntryT,
  type ModelManagerProviderT,
  type ModelManagerRuntimeT,
  type ModelPackBundleViewT,
  type ModelPackDefinitionT,
} from '../../../common/contracts/model-manager.ts';
import { detectQuantization } from './intelligence-discovery.ts';
import { IntelligenceRegistry, RegistrySchema, type IntelligenceEntry } from './intelligence-registry.ts';
import { probeGguf } from './gguf.ts';

export interface ModelPackArtifactCandidate {
  id: string;
  name: string;
  role: string;
  license: string;
  source_repo: string;
  source_revision: string | null;
  file: string | null;
  download_bytes_approx: number | null;
  sha256: string | null;
}

export interface ModelPackCatalog {
  items: ModelPackArtifactCandidate[];
  bundles: ModelPackDefinitionT[];
}

export interface ModelPackProjectionInput {
  definitions: ModelPackDefinitionT[];
  catalogItems: ModelPackArtifactCandidate[];
  models: ModelManagerEntryT[];
  providers: ModelManagerProviderT[];
  runtime: ModelManagerRuntimeT;
  discoveredEntries: IntelligenceEntry[];
  availableRamMb: number | null;
}

export interface ModelPackInstallResult {
  model_id: string;
  installed: true;
  idempotent: boolean;
  destination_filename: string;
  artifact_sha256: string;
  identity_verification: 'EXPECTED_HASH_MATCH' | 'SOURCE_COPY_HASH_MATCH';
  availability: 'INSTALLED';
  qualification_state: IntelligenceEntry['qualification']['state'];
  qualification_changed: boolean;
  runtime: 'UNSLOTH';
}

export class ModelPackError extends Error {
  readonly code: 'BAD_REQUEST' | 'CONFLICT' | 'NOT_FOUND' | 'NOT_READY' | 'INTERNAL';
  constructor(code: ModelPackError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,238}\.gguf$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const SECRET_VALUE = /(?:\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}\b|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bBearer\s+\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeCatalogString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (!clean || clean.length > max || /(?:api[_-]?key|token|secret|password|authorization)/i.test(clean) || SECRET_VALUE.test(clean)) return null;
  return clean;
}

export async function readModelPackCatalog(file: string): Promise<ModelPackCatalog | null> {
  try {
    const raw: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!isRecord(raw) || !Array.isArray(raw.packs)) return null;
    const items: ModelPackArtifactCandidate[] = [];
    for (const value of raw.packs) {
      if (!isRecord(value)) continue;
      const id = safeCatalogString(value.id, 128);
      const name = safeCatalogString(value.name, 240);
      const role = safeCatalogString(value.role, 80);
      const license = safeCatalogString(value.license, 120);
      const sourceRepo = safeCatalogString(value.source_repo, 240);
      const fileName = value.file === null ? null : safeCatalogString(value.file, 240);
      const revision = value.source_revision === undefined || value.source_revision === null ? null : safeCatalogString(value.source_revision, 240);
      const size = value.download_bytes_approx === null || value.download_bytes_approx === undefined
        ? null
        : typeof value.download_bytes_approx === 'number' && Number.isFinite(value.download_bytes_approx) && value.download_bytes_approx >= 0
          ? value.download_bytes_approx : null;
      const hash = typeof value.sha256 === 'string' && SHA256.test(value.sha256) ? value.sha256.toLowerCase() : null;
      if (!id || !name || !role || !license || !sourceRepo || (value.file !== null && fileName === null)) continue;
      if (fileName !== null && (!SAFE_FILENAME.test(fileName) || path.basename(fileName) !== fileName)) continue;
      items.push({ id, name, role, license, source_repo: sourceRepo, source_revision: revision, file: fileName, download_bytes_approx: size, sha256: hash });
    }

    const rawBundles = raw.model_bundles === undefined ? [] : raw.model_bundles;
    if (!Array.isArray(rawBundles)) return null;
    const bundles: ModelPackDefinitionT[] = [];
    for (const value of rawBundles) {
      const parsed = ModelPackDefinition.safeParse(value);
      if (!parsed.success) return null;
      bundles.push(parsed.data);
    }
    const itemIds = new Set(items.map(item => item.id));
    if (bundles.some(bundle => [...bundle.required_models, ...bundle.optional_models, ...bundle.qualification_requirements].some(member => !itemIds.has(member.model_id)))) return null;
    return { items, bundles };
  } catch {
    return null;
  }
}

async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', resolve);
  });
  return hash.digest('hex');
}

function contained(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function modelForCandidate(candidate: ModelPackArtifactCandidate, models: ModelManagerEntryT[]): ModelManagerEntryT | undefined {
  return models.find(model => model.id === candidate.id) ?? models.find(model => model.artifact.label?.toLocaleLowerCase() === candidate.file?.toLocaleLowerCase());
}

function candidateIsDiscovered(candidate: ModelPackArtifactCandidate, discovered: IntelligenceEntry[]): boolean {
  return discovered.some(entry => entry.id === candidate.id || path.basename(entry.artifact?.file ?? '').toLocaleLowerCase() === candidate.file?.toLocaleLowerCase());
}

function meetsPackQualifications(definition: ModelPackDefinitionT, models: ModelManagerEntryT[]): boolean {
  return definition.qualification_requirements.every(requirement => {
    const model = models.find(item => item.id === requirement.model_id);
    return model?.qualification.state === 'QUALIFIED' && requirement.roles.every(role => model.qualification.qualified_roles.includes(role));
  });
}

export function projectModelPackBundles(input: ModelPackProjectionInput): ModelPackBundleViewT[] {
  const providerById = new Map(input.providers.map(provider => [provider.id.toLocaleLowerCase(), provider]));
  const catalogById = new Map(input.catalogItems.map(item => [item.id, item]));
  return input.definitions.map(definition => {
    const references = [
      ...definition.required_models.map(member => ({ member, required: true })),
      ...definition.optional_models.map(member => ({ member, required: false }))
    ];
    const members = references.map(({ member, required }) => {
      const catalog = catalogById.get(member.model_id);
      const model = catalog ? modelForCandidate(catalog, input.models) : undefined;
      const providerForCloud = model?.locality === 'CLOUD'
        ? input.providers.find(provider => provider.id.toLocaleLowerCase() === model.provider.toLocaleLowerCase())
        : undefined;
      let installationState: ModelPackBundleViewT['members'][number]['installation_state'] = 'SOURCE_ONLY';
      if (!catalog) installationState = 'MISSING_ARTIFACT';
      else if (catalog.file === null) installationState = 'SOURCE_ONLY';
      else if (model?.locality === 'CLOUD') installationState = providerForCloud?.state === 'AUTHENTICATED' ? 'SOURCE_ONLY' : 'PROVIDER_CONNECTION_REQUIRED';
      else {
        const installed = model?.locality === 'LOCAL' && ['INSTALLED', 'LOADABLE'].includes(model.availability);
        const discovered = model?.locality === 'LOCAL' && ['DISCOVERED', 'AVAILABLE'].includes(model.availability);
        installationState = installed ? 'INSTALLED' : discovered || candidateIsDiscovered(catalog, input.discoveredEntries) ? 'AVAILABLE_LOCALLY' : 'MISSING';
      }
      return {
        model_id: member.model_id,
        required,
        roles: member.roles,
        display_name: catalog?.name ?? model?.display_name ?? null,
        source_repo: catalog?.source_repo ?? null,
        artifact_filename: catalog?.file ?? null,
        artifact_revision: catalog?.source_revision ?? null,
        expected_sha256: catalog?.sha256 ?? null,
        declared_license: catalog?.license ?? null,
        installation_state: installationState,
        qualification_state: model?.qualification.state ?? null,
        qualified_roles: model?.qualification.qualified_roles ?? [],
        resource_fit: model?.resource_fit ?? 'UNKNOWN' as const,
        evidence_refs: model?.evidence_refs ?? []
      };
    });

    const requiredMembers = members.filter(member => member.required);
    const installedRequired = requiredMembers.filter(member => member.installation_state === 'INSTALLED');
    const missingCatalogArtifact = requiredMembers.some(member =>
      member.installation_state === 'MISSING_ARTIFACT' || member.artifact_filename === null || member.source_repo === null || member.declared_license === null
    );
    const missingProvider = definition.provider_dependencies.some(id => providerById.get(id.toLocaleLowerCase())?.state !== 'AUTHENTICATED')
      || requiredMembers.some(member => member.installation_state === 'PROVIDER_CONNECTION_REQUIRED');
    const resourceIncompatible = requiredMembers.some(member => member.resource_fit === 'INCOMPATIBLE')
      || (definition.resource_expectations.ram_mb !== null && input.availableRamMb !== null && definition.resource_expectations.ram_mb > input.availableRamMb * 0.8);
    const runtimeUnavailable = definition.runtime_requirements.some(requirement => {
      const sameRuntime = input.runtime.canonical_name.toLocaleLowerCase() === requirement.runtime_id.toLocaleLowerCase();
      const capabilitiesUnavailable = requirement.capabilities.some(capability => input.runtime.capabilities?.[capability] !== true);
      return !sameRuntime || !input.runtime.registered || (requirement.health_required && input.runtime.health !== 'HEALTHY') || capabilitiesUnavailable;
    }) || requiredMembers.some(member => {
      const catalog = catalogById.get(member.model_id);
      const model = catalog ? modelForCandidate(catalog, input.models) : input.models.find(item => item.id === member.model_id);
      if (member.installation_state !== 'INSTALLED' || model?.locality !== 'LOCAL') return false;
      const runtimeRequirement = definition.runtime_requirements.find(requirement => requirement.runtime_id.toLocaleLowerCase() === input.runtime.canonical_name.toLocaleLowerCase());
      if (!runtimeRequirement || model.runtime_backend?.toLocaleLowerCase() !== runtimeRequirement.runtime_id.toLocaleLowerCase()) return true;
      const artifactLabel = catalog?.file?.toLocaleLowerCase();
      return !input.runtime.loaded_models.some(runtimeModel =>
        runtimeModel.id.toLocaleLowerCase() === model.id.toLocaleLowerCase() ||
        (artifactLabel !== undefined && runtimeModel.id.toLocaleLowerCase() === artifactLabel)
      );
    });
    const qualificationMet = meetsPackQualifications(definition, input.models);
    const explicitlyNotQualified = definition.qualification_requirements.some(requirement => {
      const model = input.models.find(item => item.id === requirement.model_id);
      return model?.qualification.state === 'NOT_QUALIFIED' && requirement.roles.some(role => model.qualification.unqualified_roles.includes(role));
    });
    const qualificationState: ModelPackBundleViewT['qualification_state'] = definition.qualification_requirements.length === 0
      ? 'UNKNOWN' : qualificationMet ? 'QUALIFIED' : explicitlyNotQualified ? 'NOT_QUALIFIED' : 'QUALIFICATION_REQUIRED';
    const reasons: string[] = [];
    if (missingProvider) reasons.push('MISSING_PROVIDER');
    if (resourceIncompatible) reasons.push('RESOURCE_INCOMPATIBLE');
    if (missingCatalogArtifact) reasons.push('MISSING_ARTIFACT');
    if (runtimeUnavailable) reasons.push('RUNTIME_UNAVAILABLE');
    if (!qualificationMet && definition.qualification_requirements.length > 0) reasons.push('QUALIFICATION_REQUIRED');

    const installationState: ModelPackBundleViewT['installation_state'] = missingCatalogArtifact
      ? 'AVAILABLE'
      : installedRequired.length === 0
        ? 'AVAILABLE'
        : installedRequired.length < requiredMembers.length
          ? 'PARTIALLY_INSTALLED'
          : 'INSTALLED';

    let state: ModelPackBundleViewT['state'];
    if (resourceIncompatible) state = 'RESOURCE_INCOMPATIBLE';
    else if (missingProvider) state = 'MISSING_PROVIDER';
    else if (missingCatalogArtifact) state = 'MISSING_ARTIFACT';
    else if (installationState === 'AVAILABLE') state = 'AVAILABLE';
    else if (installationState === 'PARTIALLY_INSTALLED') state = 'PARTIALLY_INSTALLED';
    else if (runtimeUnavailable) state = 'RUNTIME_UNAVAILABLE';
    else if (!qualificationMet && definition.qualification_requirements.length > 0) state = 'QUALIFICATION_REQUIRED';
    else if (definition.qualification_requirements.length > 0) state = 'READY';
    else state = 'INSTALLED';

    return ModelPackBundleView.parse({ ...definition, state, installation_state: installationState, qualification_state: qualificationState, members, block_reasons: reasons });
  });
}

function qualificationForNewArtifact(
  existing: IntelligenceEntry | undefined,
  artifactHash: string
): { qualification: IntelligenceEntry['qualification']; changed: boolean } {
  if (!existing) {
    return {
      qualification: { state: 'UNTESTED', qualified_roles: [], unqualified_roles: [], evidence_refs: [] },
      changed: false
    };
  }
  const oldHash = existing.artifact?.hash;
  const identityChanged = oldHash !== artifactHash;
  const qualifiesAsStale = identityChanged && (existing.qualification.state === 'QUALIFIED' || existing.qualification.state === 'TESTED');
  return {
    qualification: qualifiesAsStale
      ? { ...existing.qualification, state: 'STALE' }
      : existing.qualification,
    changed: qualifiesAsStale
  };
}

async function validateRegistryBeforeWrite(workspace: string): Promise<void> {
  const registryFile = path.join(workspace, '.aide', 'intelligence', 'registry.json');
  try {
    const raw = JSON.parse(await fs.readFile(registryFile, 'utf8')) as unknown;
    RegistrySchema.parse(raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return;
    throw new ModelPackError('NOT_READY', 'The existing Intelligence Registry is invalid; installation was not registered.');
  }
}

export interface ModelPackInstallerOptions {
  workspace: string;
  modelPacksPath: string;
  probe?: (file: string) => Promise<{ architecture: string }>;
}

export interface ModelPackInstallPlan {
  model: ModelPackArtifactCandidate;
  source_path: string;
  source_path_digest: string;
  source_sha256: string;
  destination_filename: string;
}

export function createModelPackInstaller(options: ModelPackInstallerOptions) {
  const probe = options.probe ?? probeGguf;

  async function plan(requestValue: unknown): Promise<ModelPackInstallPlan> {
    const parsed = ModelPackInstallRequest.safeParse(requestValue);
    if (!parsed.success) throw new ModelPackError('BAD_REQUEST', 'Invalid local model import request.');
    const catalog = await readModelPackCatalog(options.modelPacksPath);
    if (!catalog) throw new ModelPackError('NOT_READY', 'The local Model Pack catalog is unavailable or invalid.');
    const model = catalog.items.find(item => item.id === parsed.data.model_id);
    if (!model) throw new ModelPackError('NOT_FOUND', 'The requested artifact is not present in the Model Pack catalog.');
    if (!model.file || !SAFE_FILENAME.test(model.file) || !model.license || !model.source_repo) {
      throw new ModelPackError('NOT_READY', 'This catalog entry lacks the filename, source, or license metadata required for import.');
    }
    if (!path.isAbsolute(parsed.data.source_path)) throw new ModelPackError('BAD_REQUEST', 'Select an absolute path to an existing local GGUF file.');
    const sourcePath = path.resolve(parsed.data.source_path);
    if (path.basename(sourcePath).toLocaleLowerCase() !== model.file.toLocaleLowerCase()) {
      throw new ModelPackError('BAD_REQUEST', 'The selected filename does not match the catalog artifact.');
    }
    let sourceStat;
    try { sourceStat = await fs.lstat(sourcePath); }
    catch { throw new ModelPackError('NOT_FOUND', 'The selected local model artifact could not be read.'); }
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new ModelPackError('BAD_REQUEST', 'The selected source must be a regular local file.');
    let sourceHash: string;
    try { sourceHash = await hashFile(sourcePath); }
    catch { throw new ModelPackError('NOT_FOUND', 'The selected local model artifact could not be hashed.'); }
    if (model.sha256 && sourceHash !== model.sha256) {
      throw new ModelPackError('BAD_REQUEST', 'The selected artifact does not match the catalog SHA-256.');
    }
    const canonicalPath = process.platform === 'win32' ? sourcePath.toLocaleLowerCase() : sourcePath;
    const sourcePathDigest = createHash('sha256').update(canonicalPath).digest('hex');
    return { model, source_path: sourcePath, source_path_digest: sourcePathDigest, source_sha256: sourceHash, destination_filename: model.file };
  }

  async function installPlan(installPlan: ModelPackInstallPlan): Promise<ModelPackInstallResult> {
    const catalog = await readModelPackCatalog(options.modelPacksPath);
    const currentCatalogItem = catalog?.items.find(item => item.id === installPlan.model.id);
    if (!currentCatalogItem || currentCatalogItem.file !== installPlan.model.file ||
        currentCatalogItem.source_repo !== installPlan.model.source_repo ||
        currentCatalogItem.license !== installPlan.model.license ||
        currentCatalogItem.sha256 !== installPlan.model.sha256 ||
        currentCatalogItem.source_revision !== installPlan.model.source_revision) {
      throw new ModelPackError('CONFLICT', 'The Model Pack catalog changed after the install request was prepared.');
    }
    const sourcePath = path.resolve(installPlan.source_path);
    const canonicalPath = process.platform === 'win32' ? sourcePath.toLocaleLowerCase() : sourcePath;
    if (createHash('sha256').update(canonicalPath).digest('hex') !== installPlan.source_path_digest) {
      throw new ModelPackError('CONFLICT', 'The selected source identity changed after approval.');
    }
    let sourceStat;
    try { sourceStat = await fs.lstat(sourcePath); }
    catch { throw new ModelPackError('NOT_FOUND', 'The selected local model artifact could not be read.'); }
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new ModelPackError('BAD_REQUEST', 'The selected source must be a regular local file.');

    const sourceHash = await hashFile(sourcePath);
    if (sourceHash !== installPlan.source_sha256 || (installPlan.model.sha256 && sourceHash !== installPlan.model.sha256)) {
      throw new ModelPackError('CONFLICT', 'The selected artifact changed after approval.');
    }

    const workspace = path.resolve(options.workspace);
    const modelsDir = path.join(workspace, 'models');
    let workspaceReal: string;
    try { workspaceReal = await fs.realpath(workspace); }
    catch { throw new ModelPackError('NOT_READY', 'The project workspace is unavailable.'); }
    await validateRegistryBeforeWrite(workspace);
    const initialModelsDir = await fs.lstat(modelsDir).catch(error => {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw error;
    });
    if (initialModelsDir?.isSymbolicLink() || (initialModelsDir && !initialModelsDir.isDirectory())) {
      throw new ModelPackError('BAD_REQUEST', 'The managed model directory must be a real directory inside the workspace.');
    }
    if (!initialModelsDir) {
      try { await fs.mkdir(modelsDir); }
      catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') throw error;
      }
    }
    const checkedModelsDir = await fs.lstat(modelsDir).catch(() => null);
    if (!checkedModelsDir?.isDirectory() || checkedModelsDir.isSymbolicLink()) {
      throw new ModelPackError('BAD_REQUEST', 'The managed model directory changed during installation.');
    }
    const modelsReal = await fs.realpath(modelsDir).catch(() => '');
    if (!modelsReal || !contained(modelsReal, workspaceReal)) throw new ModelPackError('BAD_REQUEST', 'The managed model destination is outside the project workspace.');
    const destination = path.join(modelsReal, installPlan.destination_filename);
    const tempPath = path.join(modelsReal, `.${installPlan.destination_filename}.${randomUUID()}.installing`);
    const existingDestination = await fs.lstat(destination).catch(error => {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw error;
    });
    if (existingDestination?.isSymbolicLink() || (existingDestination && !existingDestination.isFile())) {
      throw new ModelPackError('CONFLICT', 'The managed artifact destination is not a regular file.');
    }
    if (existingDestination) {
      const existingHash = await hashFile(destination);
      if (existingHash !== sourceHash) throw new ModelPackError('CONFLICT', 'A different artifact already occupies this managed filename.');
    }

    const registry = new IntelligenceRegistry({ workspace });
    await registry.load();
    const current = registry.get(installPlan.model.id);
    if (current?.locality === 'CLOUD') throw new ModelPackError('CONFLICT', 'A cloud intelligence already uses this registry identity.');

    let idempotent = existingDestination !== null;
    if (!idempotent) {
      try {
        await fs.copyFile(sourcePath, tempPath, constants.COPYFILE_EXCL);
        const stagedHash = await hashFile(tempPath);
        if (stagedHash !== sourceHash) throw new ModelPackError('CONFLICT', 'The source changed while it was being imported.');
        await probe(tempPath);
        const finalModelsReal = await fs.realpath(modelsDir).catch(() => '');
        const finalModelsStat = await fs.lstat(modelsDir).catch(() => null);
        if (finalModelsReal !== modelsReal || !finalModelsStat?.isDirectory() || finalModelsStat.isSymbolicLink() || !contained(finalModelsReal, workspaceReal)) {
          throw new ModelPackError('CONFLICT', 'The managed model directory changed during installation.');
        }
        await fs.link(tempPath, destination);
      } catch (error) {
        if (error instanceof ModelPackError) throw error;
        if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') throw new ModelPackError('CONFLICT', 'The managed destination was created by another operation.');
        throw new ModelPackError('BAD_REQUEST', 'The selected file is not a readable supported GGUF artifact.');
      } finally {
        await fs.unlink(tempPath).catch(() => {});
      }
    } else {
      await probe(destination).catch(() => { throw new ModelPackError('BAD_REQUEST', 'The existing managed file is not a readable GGUF artifact.'); });
    }

    const identity = qualificationForNewArtifact(current, sourceHash);
    const entry: IntelligenceEntry = {
      ...(current ? { ...current } : {}),
      id: installPlan.model.id,
      display_name: current?.display_name ?? installPlan.model.name,
      ...(current?.family ? { family: current.family } : {}),
      provider: 'local',
      locality: 'LOCAL',
      artifact: {
        file: installPlan.destination_filename,
        ...(installPlan.model.source_revision ? { revision: installPlan.model.source_revision } : {}),
        hash: sourceHash,
        hash_status: 'verified',
        format: 'gguf',
        ...(detectQuantization(installPlan.destination_filename) ? { quantization: detectQuantization(installPlan.destination_filename) } : {})
      },
      runtime: { backend: 'UNSLOTH' },
      availability: 'INSTALLED',
      qualification: identity.qualification,
      known_strengths: current?.known_strengths ?? [],
      known_failures: current?.known_failures ?? [],
      evidence_refs: current?.evidence_refs ?? []
    };
    try {
      await registry.upsert(entry);
    } catch {
      throw new ModelPackError('INTERNAL', 'The artifact is present, but Registry registration failed; refresh Model Manager before retrying.');
    }

    return {
      model_id: entry.id,
      installed: true,
      idempotent,
      destination_filename: installPlan.destination_filename,
      artifact_sha256: sourceHash,
      identity_verification: installPlan.model.sha256 ? 'EXPECTED_HASH_MATCH' : 'SOURCE_COPY_HASH_MATCH',
      availability: 'INSTALLED',
      qualification_state: entry.qualification.state,
      qualification_changed: identity.changed,
      runtime: 'UNSLOTH'
    };
  }

  async function install(requestValue: unknown): Promise<ModelPackInstallResult> {
    return installPlan(await plan(requestValue));
  }

  return { plan, install, installPlan };
}
