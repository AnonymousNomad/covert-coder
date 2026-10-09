import path from 'node:path';
import { promises as fs } from 'node:fs';
import { existsSync, statSync } from 'node:fs';
import type { RuntimeStatusResponseT } from '../../../common/contracts/runtime.ts';
import type { createResourceAdmission } from './resource-admission.ts';
import { RuntimeAdapterError, RuntimeBroker } from './runtime-adapter.ts';
import {
  hashModelArtifact,
  ModelRuntime,
  ModelRuntimeError,
  readModelProfileSidecar,
  readableArtifactWithin,
  type ModelProfileBinding,
  type ModelProfilePatch,
  type ModelRuntimeOptions
} from './model-runtime.ts';

/** Frozen V1 profile from docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json. */
export interface LocalRuntimeQualification {
  artifactName: string;
  artifactSha256: string;
  artifactBytes: number;
  backendVersion: string;
}

export const UNSLOTH_V1_QUALIFICATION: LocalRuntimeQualification = {
  artifactName: 'LFM2.5-2.6B-Q4_K_M.gguf',
  artifactSha256: '02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed',
  artifactBytes: 1_674_455_040,
  backendVersion: '2026.9.11'
};

/** The product's legacy model inventory with execution owned by the canonical Runtime Broker. */
export class BrokerModelRuntime extends ModelRuntime {
  private readonly broker: RuntimeBroker;
  private readonly qualification: LocalRuntimeQualification;
  private readonly resourceAdmission: Pick<ReturnType<typeof createResourceAdmission>, 'admitLocalRuntimeStart'>;
  private observedStatusCache: { status: RuntimeStatusResponseT; at: number } | null = null;
  private observedStatusGeneration = 0;
  private observedStatusInFlight: { generation: number; promise: Promise<RuntimeStatusResponseT> } | null = null;
  private readonly artifactHashCache = new Map<string, { mtimeMs: number; size: number; hash: string }>();

  constructor(
    options: ModelRuntimeOptions,
    broker: RuntimeBroker,
    qualification: LocalRuntimeQualification,
    resourceAdmission: Pick<ReturnType<typeof createResourceAdmission>, 'admitLocalRuntimeStart'>
  ) {
    super(options);
    this.broker = broker;
    this.qualification = qualification;
    this.resourceAdmission = resourceAdmission;
  }

  override async load(): Promise<void> {
    await super.load({ sweepLegacyEngines: false });
    await this.bindCanonicalEndpoint();
  }

  override async ingest(filePath: string) {
    const result = await super.ingest(filePath);
    await this.bindCanonicalEndpoint(result.id);
    return { ...result, endpoint: this.get(result.id)!.endpoint };
  }

  override async register(options: Parameters<ModelRuntime['register']>[0]) {
    const result = await super.register(options);
    await this.bindCanonicalEndpoint(result.id);
    return { ...result, endpoint: this.get(result.id)!.endpoint };
  }

  private async bindCanonicalEndpoint(id?: string): Promise<void> {
    const endpoint = this.endpointFor(await this.activeStatus());
    if (endpoint === null) throw new ModelRuntimeError('CONFLICT', 'Unsloth endpoint is not a verified loopback address');
    for (const model of id === undefined ? this.list() : [this.get(id)]) {
      if (model !== undefined) model.endpoint = endpoint;
    }
  }

  private async activeStatus(): Promise<RuntimeStatusResponseT> {
    return this.broker.status();
  }

  private async observedStatus(allowRetry = true): Promise<RuntimeStatusResponseT> {
    const cached = this.observedStatusCache;
    if (cached !== null && Date.now() - cached.at < 2_000) return cached.status;
    let observation = this.observedStatusInFlight;
    if (observation === null || observation.generation !== this.observedStatusGeneration) {
      observation = { generation: this.observedStatusGeneration, promise: this.activeStatus() };
      this.observedStatusInFlight = observation;
    }
    try {
      const status = await observation.promise;
      // A mutation can complete while the OS probe is pending. Do not return
      // or cache that obsolete result. One fresh read is bounded; further
      // concurrent mutation remains NOT_READY rather than fabricating health.
      if (observation.generation !== this.observedStatusGeneration) {
        if (!allowRetry) throw new ModelRuntimeError('NOT_READY', 'runtime observation changed during read');
        return this.observedStatus(false);
      }
      this.observedStatusCache = { status, at: Date.now() };
      return status;
    } finally {
      if (this.observedStatusInFlight === observation) this.observedStatusInFlight = null;
    }
  }

  /** Read-only product observation; does not start, stop, or select a runtime. */
  async runtimeStatusSnapshot(): Promise<RuntimeStatusResponseT> {
    return this.observedStatus();
  }

  private invalidateObservedStatus(): void {
    this.observedStatusGeneration += 1;
    this.observedStatusCache = null;
    this.observedStatusInFlight = null;
  }

  private failureCode(error: unknown, fallback: string): string {
    const code = error instanceof RuntimeAdapterError || error instanceof ModelRuntimeError ? error.code : null;
    return code !== null && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : fallback;
  }

  private async cleanupOwnedRuntimeAfterFailedStart(): Promise<
    { status: 'STOPPED' | 'NOT_COVERT_OWNED' } | { status: 'FAILED'; code: string }
  > {
    this.invalidateObservedStatus();
    try {
      const status = await this.activeStatus();
      if (status.ownership !== 'COVERT_OWNED') return { status: 'NOT_COVERT_OWNED' };
      await this.broker.shutdown(true);
      return { status: 'STOPPED' };
    } catch (error) {
      return { status: 'FAILED', code: this.failureCode(error, 'CLEANUP_FAILED') };
    } finally {
      this.invalidateObservedStatus();
    }
  }

  private isLoaded(id: string, status: RuntimeStatusResponseT): boolean {
    return status.backend === 'UNSLOTH' && status.version === this.qualification.backendVersion &&
      status.health === 'HEALTHY' &&
      (status.ownership === 'COVERT_OWNED' || status.ownership === 'USER_OWNED') &&
      status.loaded_model?.model_id === id &&
      status.loaded_model.artifact_sha256?.toLowerCase() === this.qualification.artifactSha256.toLowerCase() &&
      status.loaded_model.identity_evidence === 'REQUESTED_ARTIFACT';
  }

  private artifactMatchesProfile(file: string): boolean {
    if (path.basename(file) !== this.qualification.artifactName) return false;
    try { return statSync(file).size === this.qualification.artifactBytes; }
    catch { return false; }
  }

  private async verifyQualifiedArtifact(file: string): Promise<string> {
    if (!this.artifactMatchesProfile(file)) throw new ModelRuntimeError('NOT_READY', 'local artifact is outside the qualified Unsloth V1 profile');
    const digest = await hashModelArtifact(file);
    if (digest !== this.qualification.artifactSha256.toLowerCase()) {
      throw new ModelRuntimeError('CONFLICT', 'local artifact hash differs from the accepted Runtime Passport');
    }
    return digest;
  }

  private boundRuntimeProfile(model: NonNullable<ReturnType<ModelRuntime['get']>>, artifactSha256: string): {
    contextTokens: number;
    generationDefaults: { maxTokens: number; temperature: number };
  } {
    const profile = readModelProfileSidecar(model.file);
    if (profile.invalid) throw new ModelRuntimeError('CONFLICT', 'model runtime profile is invalid; inspect it before starting the model');
    const binding = profile.binding;
    if (profile.schema_version !== 1 || binding === undefined) {
      throw new ModelRuntimeError('NOT_READY', 'an Authority-saved runtime profile is required before this local model can start');
    }
    if (binding.artifact_sha256?.toLowerCase() !== artifactSha256.toLowerCase() ||
        binding.runtime_id !== 'UNSLOTH' || binding.runtime_version !== this.qualification.backendVersion) {
      throw new ModelRuntimeError('CONFLICT', 'saved runtime profile is bound to a different artifact or Unsloth version');
    }
    const samplerKeys = Object.keys(profile.samplers ?? {});
    const runtimeKeys = Object.keys(profile.runtime ?? {});
    if (samplerKeys.some(key => key !== 'temperature') ||
        runtimeKeys.some(key => key !== 'context_tokens' && key !== 'max_tokens')) {
      throw new ModelRuntimeError('NOT_READY', 'saved profile contains settings not qualified for the canonical Unsloth adapter');
    }
    const temperature = profile.samplers?.temperature;
    const contextTokens = profile.runtime?.context_tokens;
    const maxTokens = profile.runtime?.max_tokens;
    if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2 ||
        typeof contextTokens !== 'number' || !Number.isInteger(contextTokens) || contextTokens < 128 || contextTokens > 131072 ||
        typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192) {
      throw new ModelRuntimeError('NOT_READY', 'saved runtime profile must specify supported temperature, context_tokens, and max_tokens values');
    }
    return { contextTokens, generationDefaults: { temperature, maxTokens } };
  }

  override async saveProfile(id: string, patch: ModelProfilePatch): Promise<{ id: string; preset: string; saved: true }> {
    const model = this.get(id);
    if (model === undefined) throw new ModelRuntimeError('BAD_REQUEST', 'model is not allowlisted');
    const artifactSha256 = await this.verifyQualifiedArtifact(model.file);
    const binding: ModelProfileBinding = {
      artifact_sha256: artifactSha256,
      runtime_id: 'UNSLOTH',
      runtime_version: this.qualification.backendVersion
    };
    return this.persistProfile(id, patch, {
      binding,
      samplerKeys: ['temperature'],
      runtimeKeys: ['context_tokens', 'max_tokens']
    });
  }

  private endpointFor(status: RuntimeStatusResponseT): string | null {
    if (status.endpoint === null) return null;
    const url = new URL(status.endpoint);
    if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    return `${url.origin}/v1`;
  }

  override async status(): Promise<{ runtime: boolean; models: Array<Record<string, unknown>> }> {
    const status = await this.observedStatus();
    const runtime = status.backend === 'UNSLOTH' && (status.health === 'STOPPED' || status.health === 'HEALTHY');
    return {
      runtime,
      models: await Promise.all(this.list().map(async model => {
        const artifactAvailable = model.file.length > 0 && await readableArtifactWithin(this.modelDir, model.file);
        let observedSha256: string | null = null;
        if (artifactAvailable && (model.sha256 !== undefined || this.artifactMatchesProfile(model.file))) {
          try {
            const stat = await fs.stat(model.file);
            const cached = this.artifactHashCache.get(model.file);
            observedSha256 = cached !== undefined && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size
              ? cached.hash : await hashModelArtifact(model.file);
            this.artifactHashCache.set(model.file, { mtimeMs: stat.mtimeMs, size: stat.size, hash: observedSha256 });
          } catch { observedSha256 = null; }
        }
        const expectedSha256 = model.sha256 ?? (this.artifactMatchesProfile(model.file) ? this.qualification.artifactSha256 : undefined);
        const artifactIntegrity = !artifactAvailable ? 'UNAVAILABLE'
          : observedSha256 === null || expectedSha256 === undefined ? 'UNBOUND'
            : observedSha256 === expectedSha256.toLowerCase() ? 'VERIFIED' : 'MISMATCH';
        const artifactCandidate = artifactAvailable && artifactIntegrity === 'VERIFIED' &&
          observedSha256 === this.qualification.artifactSha256.toLowerCase() &&
          this.artifactMatchesProfile(model.file) && status.version === this.qualification.backendVersion;
        let savedProfileCandidate = false;
        if (artifactCandidate) {
          try {
            this.boundRuntimeProfile(model, this.qualification.artifactSha256);
            savedProfileCandidate = true;
          } catch { /* a missing or incompatible model profile remains setup-required */ }
        }
        const profileCandidate = artifactCandidate && savedProfileCandidate;
        const running = this.isLoaded(model.id, status);
        const backendEndpoint = this.endpointFor(status);
        if (running && backendEndpoint !== null) model.endpoint = backendEndpoint;
        return {
          id: model.id,
          name: model.name,
          status: running ? 'running' : profileCandidate && runtime ? 'ready' : 'pending',
          declared_status: model.status,
          endpoint: model.endpoint,
          runtime_available: runtime,
          artifact_available: artifactAvailable,
          artifact_integrity: artifactIntegrity,
          observed_sha256: observedSha256,
          sha256: expectedSha256 ?? null,
          file_size: artifactAvailable ? (await fs.stat(model.file).catch(() => null))?.size ?? null : null,
          source_revision: model.source_revision ?? null,
          setup_required: !runtime || !profileCandidate,
          setup_message: !runtime ? status.health === 'NOT_INSTALLED' ?
            'Unsloth CLI not discovered; set AIDE_UNSLOTH_CLI to its absolute path and restart Covert, or install the qualified runtime' :
            `Unsloth unavailable (${status.health}); install or repair the qualified runtime` :
            !artifactAvailable ? 'local model artifact unavailable' :
              !artifactCandidate ? 'artifact or backend version is outside the qualified Unsloth V1 profile' :
                !savedProfileCandidate ? 'Authority-saved exact-artifact Unsloth profile required before start' : undefined,
          qualification: running ? 'accepted_hash_verified' : 'requires_start_preflight',
          ingested: model.ingested === true
        };
      }))
    };
  }

  override async start(id: string): Promise<{ id: string; status: string; endpoint: string }> {
    const model = this.get(id);
    if (!model) throw new ModelRuntimeError('CHILD_FAILED', 'model is not allowlisted');
    if (!model.file || !existsSync(model.file)) throw new ModelRuntimeError('NOT_READY', 'local model artifact is unavailable');
    const current = await this.activeStatus();
    if (current.version !== this.qualification.backendVersion) throw new ModelRuntimeError('NOT_READY', 'Unsloth version differs from the accepted Runtime Passport');
    if (current.ownership === 'FOREIGN' || current.health === 'UNKNOWN') throw new ModelRuntimeError('CONFLICT', 'Unsloth port ownership is not verified');
    if (this.isLoaded(id, current)) {
      const endpoint = this.endpointFor(current);
      if (endpoint === null) throw new ModelRuntimeError('CONFLICT', 'loaded Unsloth endpoint is not a verified loopback address');
      model.endpoint = endpoint;
      return { id, status: 'running', endpoint };
    }
    if (current.loaded_model !== null && current.health === 'HEALTHY') {
      throw new ModelRuntimeError('CONFLICT', 'another model is loaded; stop it before selecting this model');
    }
    const artifactSha256 = await this.verifyQualifiedArtifact(model.file);
    const profile = this.boundRuntimeProfile(model, artifactSha256);
    const admission = await this.resourceAdmission.admitLocalRuntimeStart();
    if (admission.decision !== 'START') {
      throw new ModelRuntimeError('NOT_READY', `local model start refused by final Resource Admission: ${admission.reason}`, admission);
    }
    try {
      model.context_tokens = profile.contextTokens;
      await this.broker.load({
        modelId: id,
        modelPath: path.resolve(model.file),
        displayName: model.name,
        contextTokens: profile.contextTokens,
        generationDefaults: profile.generationDefaults
      }, true);
      this.invalidateObservedStatus();
      const status = await this.activeStatus();
      const endpoint = this.endpointFor(status);
      if (!this.isLoaded(id, status) || endpoint === null) throw new ModelRuntimeError('CHILD_FAILED', 'Unsloth did not confirm the loaded model and endpoint');
      model.endpoint = endpoint;
      return { id, status: 'running', endpoint };
    } catch (error) {
      const cleanup = await this.cleanupOwnedRuntimeAfterFailedStart();
      if (cleanup.status === 'FAILED') {
        const startCode = this.failureCode(error, 'RUNTIME_OPERATION_FAILED');
        const detail = { startErrorCode: startCode, cleanupErrorCode: cleanup.code };
        throw new ModelRuntimeError(
          'CHILD_FAILED',
          `model start failed (${startCode}) and cleanup of the Covert-owned runtime could not be confirmed (${cleanup.code}); inspect runtime status before retrying`,
          detail
        );
      }
      throw error;
    }
  }

  override async stop(id: string): Promise<{ id: string; status: string }> {
    const status = await this.activeStatus();
    if (status.loaded_model !== null && !this.isLoaded(id, status)) {
      throw new ModelRuntimeError('CONFLICT', 'loaded model identity is not verified for this stop request');
    }
    if (!this.isLoaded(id, status)) return { id, status: 'stopped' };
    await this.broker.unload(id, true);
    if (status.ownership === 'COVERT_OWNED') await this.broker.shutdown(true);
    this.invalidateObservedStatus();
    return { id, status: 'stopped' };
  }

  override async stopAll(): Promise<void> {
    const status = await this.activeStatus();
    if (status.ownership === 'COVERT_OWNED') await this.broker.shutdown(true);
    this.invalidateObservedStatus();
  }

  override async verifyEndpointModel(id: string): Promise<{ ready: boolean; status: string; served_models: string[]; error?: string }> {
    const status = await this.observedStatus();
    const ready = this.isLoaded(id, status);
    return { ready, status: ready ? 'running' : status.ownership === 'FOREIGN' || status.ownership === 'UNKNOWN' && status.health === 'UNKNOWN' ? 'conflict' : 'not-ready', served_models: ready ? [id] : [] };
  }

  override async isReady(id: string): Promise<{ id: string; ready: boolean; status: 'running' | 'warming' | 'conflict' | 'not-ready'; endpoint: string; error?: string }> {
    const model = this.get(id);
    if (!model) return { id, ready: false, status: 'not-ready', endpoint: '', error: 'model is not allowlisted' };
    const result = await this.verifyEndpointModel(id);
    return { id, ready: result.ready, status: result.ready ? 'running' : result.status === 'conflict' ? 'conflict' : 'not-ready', endpoint: model.endpoint };
  }

  override getEffectiveContext(): number | null {
    // The legacy declared context is not evidence of Unsloth's effective served window.
    return null;
  }

  override async refreshServedContext(): Promise<void> {
    // The legacy implementation fetches unauthenticated llama.cpp /props.
    // Unsloth has not exposed a qualified effective-context endpoint.
  }

  override async waitReady(id: string, timeoutMs = 60_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await this.verifyEndpointModel(id)).ready) return true;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  override async chat(id: string, messages: Array<{ role: string; content: string }>, options: { maxTokens?: number; temperature?: number; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<{ text: string; modelId: string; tokens?: number; timingMs: number }> {
    if (!this.isLoaded(id, await this.activeStatus())) throw new ModelRuntimeError('NOT_READY', 'model is not loaded in Unsloth');
    const signal = options.signal === undefined ? AbortSignal.timeout(Math.min(options.timeoutMs ?? 90_000, 300_000)) :
      AbortSignal.any([options.signal, AbortSignal.timeout(Math.min(options.timeoutMs ?? 90_000, 300_000))]);
    const result = await this.broker.infer({ modelId: id, messages,
      ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }) }, signal);
    return { text: result.text, modelId: id, timingMs: result.timingMs, ...(result.completionTokens === null ? {} : { tokens: result.completionTokens }) };
  }

  override async chatStream(id: string, messages: Array<{ role: string; content: string }>, onDelta: (delta: string) => void, signal: AbortSignal, options: { maxTokens?: number; temperature?: number } = {}): Promise<void> {
    if (!this.isLoaded(id, await this.activeStatus())) throw new ModelRuntimeError('NOT_READY', 'model is not loaded in Unsloth');
    await this.broker.stream({ modelId: id, messages,
      ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }) }, onDelta, signal);
  }
}
