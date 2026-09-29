import { createHash } from 'node:crypto';
import type { ModelRuntime } from './model-runtime.ts';
import type { ProviderService } from './providers.ts';
import { BUILTIN_PROVIDERS, type ProviderDefinition } from './providers.ts';
import { fitHistory, estimateTokens } from './history-fit.ts';
import type { ChatMessageT } from '../../../common/contracts/chat.ts';
import type { RouteFallbackT, RouteStatusT } from '../../../common/contracts/routing.ts';
import type { ModelProviderRouteT } from '../../../common/contracts/model-access.ts';

export type RouteFailureReason = 'down' | 'busy' | 'unsupported' | 'context_overflow';

export class RouterError extends Error {
  readonly reason: RouteFailureReason;
  readonly code: 'NOT_READY' | 'CHILD_FAILED';

  constructor(reason: RouteFailureReason, message: string) {
    super(message);
    this.reason = reason;
    this.code = reason === 'down' || reason === 'busy' ? 'NOT_READY' : 'CHILD_FAILED';
  }
}

export interface ModelRoute {
  id: string;
  displayName: string;
  providerType: 'local' | 'cloud';
  baseUrl: string;
  modelString: string;
  contextLength: number;
  chatTemplate: string;
  status: RouteStatusT;
  probeMs: number | null;
  roles: string[];
  capabilities: string[];
}

export interface RouteSelection {
  modelId: string;
  displayName: string;
  providerType: 'local' | 'cloud';
  status: RouteStatusT;
  contextLength: number;
  fellBack?: RouteFallbackT;
}

export interface RouteChatResult {
  text: string;
  modelId: string;
  tokens?: number;
  timingMs: number;
  usedApprox: number;
  dropped: number;
  truncatedSystem: boolean;
  overflowTrimmed?: boolean;
}

export interface ChatAuthorityTargetBinding {
  execution_class: 'LOCAL' | 'EXTERNAL';
  route_id: string;
  model_id: string;
  source: 'model-runtime' | 'provider-service' | 'model-access';
  runtime_class: 'local-model-runtime' | 'provider-service' | 'opencode-managed';
  endpoint_origin: string;
  target_revision: string;
  provider_id?: string;
  provider_model?: string;
  model_access_route_id?: string;
  canonical_model_id?: string;
  connection_id?: string;
  credential_source_id?: string;
  execution_adapter_id?: string;
  egress_host?: string;
}

export interface ResolvedChatAuthorityTarget {
  binding: Readonly<ChatAuthorityTargetBinding>;
  route: ModelRoute;
}

export type ChatAuthorityTargetResolution =
  | { status: 'RESOLVED'; target: ResolvedChatAuthorityTarget }
  | { status: 'UNKNOWN'; reason: 'route-not-registered' | 'local-source-not-contained' | 'provider-catalog-invalid' | 'provider-model-route-ineligible' };

export class ChatTargetChangedError extends Error {
  constructor() {
    super('chat execution target changed after Authority resolution; prepare a fresh operation');
    this.name = 'ChatTargetChangedError';
  }
}

const PROBE_TTL_MS = 30_000;
const LOCAL_PROBE_TIMEOUT_MS = 3_000;

function normalizeOptions(options: { maxTokens?: number | undefined; temperature?: number | undefined; timeoutMs?: number | undefined; signal?: AbortSignal | undefined }): { maxTokens?: number; temperature?: number; timeoutMs?: number; signal?: AbortSignal } {
  const out: { maxTokens?: number; temperature?: number; timeoutMs?: number; signal?: AbortSignal } = {};
  if (options.maxTokens !== undefined) out.maxTokens = options.maxTokens;
  if (options.temperature !== undefined) out.temperature = options.temperature;
  if (options.timeoutMs !== undefined) out.timeoutMs = options.timeoutMs;
  if (options.signal !== undefined) out.signal = options.signal;
  return out;
}

function targetRevision(value: Record<string, string>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function localRuntimeEndpointOrigin(raw: string): string | null {
  try {
    const endpoint = new URL(raw);
    // The local runtime contract uses a numeric loopback endpoint. A model
    // display name or a generic "local" label cannot turn remote HTTP into
    // local inference.
    if (endpoint.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(endpoint.hostname) ||
        endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
    return endpoint.origin;
  } catch {
    return null;
  }
}

function providerEndpoint(provider: ProviderDefinition): string | null {
  try {
    const endpoint = new URL(provider.baseUrl);
    if (endpoint.protocol !== 'https:' || endpoint.hostname.toLowerCase() !== provider.egressHost.toLowerCase() ||
        endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
    return endpoint.origin;
  } catch {
    return null;
  }
}

function localRoute(entry: { id: string; name: string; endpoint: string; model: string; context_tokens: number; roles: string[] }): ModelRoute {
  return {
    id: `local:${entry.id}`,
    displayName: entry.name,
    providerType: 'local',
    baseUrl: entry.endpoint,
    modelString: entry.model,
    contextLength: entry.context_tokens,
    chatTemplate: 'gguf-metadata',
    status: 'unverified',
    probeMs: null,
    roles: entry.roles,
    capabilities: []
  };
}

function bindingEqual(left: Readonly<ChatAuthorityTargetBinding>, right: Readonly<ChatAuthorityTargetBinding>): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function modelAccessProviderRouteEligible(route: ModelProviderRouteT, adapter: string): boolean {
  return route.model_support_state === 'VERIFIED' && route.available && route.configured &&
    route.health === 'HEALTHY' && route.external_egress_required && !route.operator_setup_required &&
    route.setup_state === 'READY' && route.credential_source_id !== null && route.execution_adapter_id === adapter;
}

const OPENCODE_PROVIDER_ID = 'opencode';
const OPENCODE_GO_ID = 'opencode-go';
const OPENCODE_GO_EGRESS_HOST = 'opencode.ai';
const OPENCODE_GO_ORIGIN = `https://${OPENCODE_GO_EGRESS_HOST}`;

export interface OpenCodeModelRouterAdapter {
  workspace: string;
  assertExternalEgressAllowed: () => void;
  runTaskStream(options: {
    workspace: string;
    prompt: string;
    providerID: string;
    modelID: string;
    timeoutMs?: number;
    signal?: AbortSignal;
    onDelta: (delta: string) => void;
  }): Promise<{ text: string; duration_ms: number; delegated_provider: string | null; delegated_model: string | null }>;
}

export class ModelRouter {
  private readonly runtime: ModelRuntime;
  private readonly providers: ProviderService;
  private readonly providerCatalog: readonly ProviderDefinition[];
  private readonly providerModelRoutes: () => Promise<readonly ModelProviderRouteT[]>;
  private readonly openCode: OpenCodeModelRouterAdapter | null;
  private readonly health = new Map<string, { status: RouteStatusT; at: number }>();

  constructor(
    runtime: ModelRuntime,
    providers: ProviderService,
    providerCatalog: readonly ProviderDefinition[] = BUILTIN_PROVIDERS,
    providerModelRoutes: () => Promise<readonly ModelProviderRouteT[]> = async () => [],
    openCode: OpenCodeModelRouterAdapter | null = null
  ) {
    this.runtime = runtime;
    this.providers = providers;
    this.providerCatalog = providerCatalog;
    this.providerModelRoutes = providerModelRoutes;
    this.openCode = openCode;
  }

  private async eligibleProviderModelRoute(providerId: string, providerModelId: string): Promise<ModelProviderRouteT | null> {
    const matches = (await this.providerModelRoutes()).filter(route =>
      route.provider_id === providerId &&
      route.provider_model_id === providerModelId &&
      route.execution_adapter_id === 'direct-http'
    );
    if (matches.length !== 1 || !modelAccessProviderRouteEligible(matches[0]!, 'direct-http')) return null;
    return matches[0]!;
  }

  private localRoute(entry: { id: string; name: string; endpoint: string; model: string; context_tokens: number; roles: string[] }): ModelRoute {
    return localRoute(entry);
  }

  private cloudRoutes(): ModelRoute[] {
    const routes: ModelRoute[] = [];
    for (const provider of this.providerCatalog) {
      for (const model of provider.models) {
        routes.push({
          id: `cloud:${provider.id}:${model}`,
          displayName: `${provider.name} · ${model}`,
          providerType: 'cloud',
          baseUrl: provider.baseUrl,
          modelString: model,
          contextLength: provider.contextLength,
          chatTemplate: 'provider',
          status: 'unverified',
          probeMs: null,
          roles: ['chat'],
          capabilities: []
        });
      }
    }
    return routes;
  }

  async routes(): Promise<ModelRoute[]> {
    const status = await this.runtime.status();
    const running = new Set(status.models.filter(model => model.status === 'running').map(model => String(model.id)));
    const local = this.runtime.list().map(entry => {
      const route = this.localRoute(entry);
      if (running.has(entry.id)) {
        const health = this.health.get(route.id);
        route.status = health !== undefined && Date.now() - health.at < PROBE_TTL_MS ? health.status : 'unverified';
        route.probeMs = health?.at ?? null;
      } else {
        route.status = entry.status === 'ready' ? 'unverified' : 'down';
        route.probeMs = null;
      }
      return route;
    });
    const providerModelRoutes = await this.providerModelRoutes();
    const connected = new Set(await this.providers.list().then(list => list.filter(provider => provider.status === 'connected').map(provider => provider.id)));
    const cloud = this.cloudRoutes().map(route => {
      const providerId = route.id.split(':')[1]!;
      const matches = providerModelRoutes.filter(candidate =>
        candidate.provider_id === providerId && candidate.provider_model_id === route.modelString &&
        candidate.execution_adapter_id === 'direct-http'
      );
      if (connected.has(providerId) && matches.length === 1 && modelAccessProviderRouteEligible(matches[0]!, 'direct-http')) {
        const health = this.health.get(route.id);
        route.status = health !== undefined && Date.now() - health.at < PROBE_TTL_MS ? health.status : 'unverified';
        route.probeMs = health?.at ?? null;
      } else {
        route.status = 'down';
        route.probeMs = null;
      }
      return route;
    });
    const openCodeRoutes = providerModelRoutes
      .filter(candidate => candidate.execution_adapter_id === 'opencode' && candidate.provider_id === OPENCODE_PROVIDER_ID)
      .map(candidate => {
        const id = `cloud:${OPENCODE_PROVIDER_ID}:${candidate.provider_model_id}`;
        const routeEligible = modelAccessProviderRouteEligible(candidate, 'opencode');
        const health = this.health.get(id);
        const healthFresh = health !== undefined && Date.now() - health.at < PROBE_TTL_MS;
        return {
          id,
          displayName: `OpenCode Go · ${candidate.provider_model_id}`,
          providerType: 'cloud' as const,
          baseUrl: OPENCODE_GO_ORIGIN,
          modelString: candidate.provider_model_id,
          contextLength: 8192,
          chatTemplate: 'provider',
          status: !routeEligible ? 'down' as const : healthFresh ? health.status : 'unverified' as const,
          probeMs: routeEligible && healthFresh ? health!.at : null,
          roles: ['chat'],
          capabilities: []
        };
      });
    return [...local, ...cloud, ...openCodeRoutes];
  }

  /**
   * Resolve the exact, configured inference destination without probing,
   * starting, loading, or contacting a provider/runtime. The returned binding
   * is included in the Authority operation digest and must be revalidated at
   * dispatch.
   */
  async resolveAuthorityTarget(requestedId: string): Promise<ChatAuthorityTargetResolution> {
    const localId = requestedId.startsWith('local:')
      ? requestedId.slice('local:'.length)
      : requestedId.startsWith('cloud:') ? null : requestedId;
    if (localId !== null) {
      const entry = this.runtime.list().find(candidate => candidate.id === localId);
      if (entry !== undefined) {
        const endpointOrigin = localRuntimeEndpointOrigin(entry.endpoint);
        const artifactUri = typeof entry.artifact_uri === 'string' ? entry.artifact_uri : '';
        const artifactFile = typeof entry.file === 'string' ? entry.file : '';
        if (endpointOrigin === null || !artifactUri.startsWith('local://') || artifactUri.length <= 'local://'.length || artifactFile.length === 0) {
          return { status: 'UNKNOWN', reason: 'local-source-not-contained' };
        }
        const route = localRoute(entry);
        const binding = Object.freeze({
          execution_class: 'LOCAL' as const,
          route_id: route.id,
          model_id: entry.id,
          source: 'model-runtime' as const,
          runtime_class: 'local-model-runtime' as const,
          endpoint_origin: endpointOrigin,
          target_revision: targetRevision({
            route_id: route.id,
            model_id: entry.id,
            model: entry.model,
            artifact_uri: artifactUri,
            artifact_file: artifactFile,
            endpoint: entry.endpoint
          })
        });
        return { status: 'RESOLVED', target: Object.freeze({ binding, route }) };
      }
    }

    for (const provider of this.providerCatalog) {
      for (const model of provider.models) {
        const routeId = `cloud:${provider.id}:${model}`;
        if (requestedId !== routeId) continue;
        const endpointOrigin = providerEndpoint(provider);
        if (endpointOrigin === null) return { status: 'UNKNOWN', reason: 'provider-catalog-invalid' };
        const providerRoute = await this.eligibleProviderModelRoute(provider.id, model);
        if (providerRoute === null) return { status: 'UNKNOWN', reason: 'provider-model-route-ineligible' };
        const route: ModelRoute = {
          id: routeId,
          displayName: `${provider.name} · ${model}`,
          providerType: 'cloud',
          baseUrl: provider.baseUrl,
          modelString: model,
          contextLength: provider.contextLength,
          chatTemplate: 'provider',
          status: 'unverified',
          probeMs: null,
          roles: ['chat'],
          capabilities: []
        };
        const binding = Object.freeze({
          execution_class: 'EXTERNAL' as const,
          route_id: routeId,
          model_id: model,
          source: 'provider-service' as const,
          runtime_class: 'provider-service' as const,
          endpoint_origin: endpointOrigin,
          target_revision: targetRevision({
            route_id: routeId,
            provider_id: provider.id,
            provider_model: model,
            endpoint: provider.baseUrl,
            egress_host: provider.egressHost,
            provider_kind: provider.kind,
            model_access_route_id: providerRoute.id,
            canonical_model_id: providerRoute.model_id,
            connection_id: providerRoute.connection_id,
            credential_source_id: providerRoute.credential_source_id!,
            execution_adapter_id: providerRoute.execution_adapter_id
          }),
          provider_id: provider.id,
          provider_model: model,
          model_access_route_id: providerRoute.id,
          canonical_model_id: providerRoute.model_id,
          connection_id: providerRoute.connection_id,
          credential_source_id: providerRoute.credential_source_id!,
          execution_adapter_id: providerRoute.execution_adapter_id,
          egress_host: provider.egressHost
        });
        return { status: 'RESOLVED', target: Object.freeze({ binding, route }) };
      }
    }
    const openCodeRoutes = (await this.providerModelRoutes()).filter(candidate =>
      candidate.execution_adapter_id === 'opencode' && candidate.provider_id === OPENCODE_PROVIDER_ID &&
      requestedId === `cloud:${OPENCODE_PROVIDER_ID}:${candidate.provider_model_id}`
    );
    if (openCodeRoutes.length > 0) {
      if (openCodeRoutes.length !== 1 || !modelAccessProviderRouteEligible(openCodeRoutes[0]!, 'opencode')) {
        return { status: 'UNKNOWN', reason: 'provider-model-route-ineligible' };
      }
      const providerRoute = openCodeRoutes[0]!;
      const [delegatedProvider, delegatedModel, extra] = providerRoute.provider_model_id.split('/');
      if (delegatedProvider !== OPENCODE_GO_ID || !delegatedModel || extra !== undefined || providerRoute.credential_source_id === null) {
        return { status: 'UNKNOWN', reason: 'provider-model-route-ineligible' };
      }
      const routeId = `cloud:${OPENCODE_PROVIDER_ID}:${providerRoute.provider_model_id}`;
      const route: ModelRoute = {
        id: routeId,
        displayName: `OpenCode Go · ${providerRoute.provider_model_id}`,
        providerType: 'cloud',
        baseUrl: OPENCODE_GO_ORIGIN,
        modelString: providerRoute.provider_model_id,
        contextLength: 8192,
        chatTemplate: 'provider',
        status: 'unverified',
        probeMs: null,
        roles: ['chat'],
        capabilities: []
      };
      const binding = Object.freeze({
        execution_class: 'EXTERNAL' as const,
        route_id: routeId,
        model_id: providerRoute.model_id,
        source: 'model-access' as const,
        runtime_class: 'opencode-managed' as const,
        endpoint_origin: OPENCODE_GO_ORIGIN,
        target_revision: targetRevision({
          route_id: routeId,
          canonical_model_id: providerRoute.model_id,
          provider_model: providerRoute.provider_model_id,
          model_access_route_id: providerRoute.id,
          connection_id: providerRoute.connection_id,
          credential_source_id: providerRoute.credential_source_id,
          execution_adapter_id: providerRoute.execution_adapter_id,
          egress_host: OPENCODE_GO_EGRESS_HOST
        }),
        provider_id: OPENCODE_PROVIDER_ID,
        provider_model: providerRoute.provider_model_id,
        model_access_route_id: providerRoute.id,
        canonical_model_id: providerRoute.model_id,
        connection_id: providerRoute.connection_id,
        credential_source_id: providerRoute.credential_source_id,
        execution_adapter_id: providerRoute.execution_adapter_id,
        egress_host: OPENCODE_GO_EGRESS_HOST
      });
      return { status: 'RESOLVED', target: Object.freeze({ binding, route }) };
    }
    return { status: 'UNKNOWN', reason: 'route-not-registered' };
  }

  private async currentBoundRoute(target: ResolvedChatAuthorityTarget): Promise<ModelRoute> {
    const current = await this.resolveAuthorityTarget(target.binding.route_id);
    if (current.status !== 'RESOLVED' || !bindingEqual(current.target.binding, target.binding)) throw new ChatTargetChangedError();
    return current.target.route;
  }

  async chatResolvedTarget(target: ResolvedChatAuthorityTarget, messages: ChatMessageT[], options: { maxTokens?: number | undefined; temperature?: number | undefined; timeoutMs?: number | undefined } = {}): Promise<RouteChatResult> {
    const route = await this.currentBoundRoute(target);
    const { fit, overflowTrimmed } = this.fitForRoute(route, messages, options.maxTokens);
    const chatOptions = normalizeOptions(options);
    const result: { text: string; modelId: string; tokens?: number; timingMs: number } = route.providerType === 'local'
      ? await this.runtime.chat(route.id.slice('local:'.length), fit.messages, chatOptions)
      : target.binding.execution_adapter_id === 'opencode'
        ? await this.runOpenCode(target, fit.messages, undefined, chatOptions.signal, chatOptions.timeoutMs)
        : await this.providers.chat(target.binding.provider_id!, target.binding.provider_model!, fit.messages, chatOptions);
    const out: RouteChatResult = {
      text: result.text,
      modelId: route.id,
      timingMs: result.timingMs,
      usedApprox: fit.estimatedTokens,
      dropped: fit.dropped,
      truncatedSystem: fit.truncatedSystem
    };
    if (overflowTrimmed) out.overflowTrimmed = true;
    if (result.tokens !== undefined) out.tokens = result.tokens;
    return out;
  }

  async chatStreamResolvedTarget(target: ResolvedChatAuthorityTarget, messages: ChatMessageT[], onDelta: (delta: string) => void, signal: AbortSignal, options: { maxTokens?: number | undefined } = {}): Promise<RouteChatResult> {
    const route = await this.currentBoundRoute(target);
    const { fit, overflowTrimmed } = this.fitForRoute(route, messages, options.maxTokens);
    const chatOptions = normalizeOptions({ ...options, signal });
    let result: { text: string; modelId: string; tokens?: number; timingMs: number };
    if (route.providerType === 'local') {
      const modelId = route.id.slice('local:'.length);
      const started = Date.now();
      let text = '';
      await this.runtime.chatStream(modelId, fit.messages, delta => {
        text += delta;
        onDelta(delta);
      }, signal, chatOptions);
      result = { text, modelId, timingMs: Date.now() - started };
    } else {
      result = target.binding.execution_adapter_id === 'opencode'
        ? await this.runOpenCode(target, fit.messages, onDelta, signal)
        : await this.providers.chatStream(target.binding.provider_id!, target.binding.provider_model!, fit.messages, onDelta, chatOptions);
    }
    const out: RouteChatResult = {
      text: result.text,
      modelId: route.id,
      timingMs: result.timingMs,
      usedApprox: fit.estimatedTokens,
      dropped: fit.dropped,
      truncatedSystem: fit.truncatedSystem
    };
    if (overflowTrimmed) out.overflowTrimmed = true;
    if (result.tokens !== undefined) out.tokens = result.tokens;
    return out;
  }

  private async runOpenCode(
    target: ResolvedChatAuthorityTarget,
    messages: ChatMessageT[],
    onDelta?: (delta: string) => void,
    signal?: AbortSignal,
    timeoutMs?: number
  ): Promise<{ text: string; modelId: string; timingMs: number }> {
    if (this.openCode === null) throw new RouterError('unsupported', 'OpenCode route has no managed stream adapter');
    if (target.binding.execution_adapter_id !== 'opencode' || target.binding.provider_id !== OPENCODE_PROVIDER_ID) {
      throw new RouterError('unsupported', 'OpenCode route binding is invalid');
    }
    const [providerID, modelID, extra] = (target.binding.provider_model ?? '').split('/');
    if (providerID !== OPENCODE_GO_ID || !modelID || extra !== undefined) {
      throw new RouterError('unsupported', 'OpenCode route does not bind the exact OpenCode Go model');
    }
    this.openCode.assertExternalEgressAllowed();
    const result = await this.openCode.runTaskStream({
      workspace: this.openCode.workspace,
      prompt: messages.map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n'),
      providerID,
      modelID,
      onDelta: onDelta ?? (() => undefined),
      ...(signal !== undefined ? { signal } : {}),
      ...(timeoutMs !== undefined ? { timeoutMs } : {})
    });
    if (result.delegated_provider !== providerID || result.delegated_model !== modelID) {
      throw Object.assign(new Error('OpenCode returned a different provider/model identity'), { code: 'TARGET_MISMATCH' });
    }
    return { text: result.text, modelId: target.route.id, timingMs: result.duration_ms };
  }

  async probe(id: string): Promise<RouteStatusT> {
    const route = (await this.routes()).find(entry => entry.id === id);
    if (route === undefined) return 'down';
    let status: RouteStatusT;
    let at = Date.now();
    if (route.providerType === 'local') {
      const modelId = id.slice('local:'.length);
      const result = await this.runtime.verifyEndpointModel(modelId, LOCAL_PROBE_TIMEOUT_MS).catch(() => ({ ready: false as const }));
      status = result.ready ? 'ready' : 'down';
    } else if (id.startsWith(`cloud:${OPENCODE_PROVIDER_ID}:`)) {
      const target = (await this.providerModelRoutes()).filter(candidate =>
        candidate.execution_adapter_id === 'opencode' && candidate.provider_id === OPENCODE_PROVIDER_ID &&
        id === `cloud:${OPENCODE_PROVIDER_ID}:${candidate.provider_model_id}`
      );
      status = target.length === 1 && modelAccessProviderRouteEligible(target[0]!, 'opencode') ? 'ready' : 'down';
      if (status !== 'ready') at = Date.now();
    } else {
      const parts = id.split(':');
      const providerId = parts[1]!;
      const list = await this.providers.list();
      const provider = list.find(entry => entry.id === providerId);
      const exactRoute = await this.eligibleProviderModelRoute(providerId, route.modelString);
      status = provider !== undefined && provider.status === 'connected' && exactRoute !== null ? 'ready' : 'down';
      if (provider !== undefined && provider.status === 'connected' && exactRoute !== null) at = Date.now();
    }
    this.health.set(id, { status, at });
    return status;
  }

  private async freshStatus(id: string): Promise<RouteStatusT> {
    const health = this.health.get(id);
    if (health !== undefined && Date.now() - health.at < PROBE_TTL_MS) return health.status;
    return this.probe(id);
  }

  async routeForRole(role: string): Promise<RouteSelection> {
    const routes = await this.routes();
    const candidates = routes.filter(route => route.providerType === 'local' && route.roles.includes(role));
    if (candidates.length === 0) {
      throw new RouterError('down', `no local model is configured for role "${role}"`);
    }
    for (const candidate of candidates) {
      const status = await this.freshStatus(candidate.id);
      if (status === 'ready') {
        const fellBack = candidate.id !== candidates[0]!.id ? { from: candidates[0]!.id, to: candidate.id, reason: 'down' as const } : undefined;
        return { modelId: candidate.id, displayName: candidate.displayName, providerType: candidate.providerType, status, contextLength: candidate.contextLength, ...(fellBack !== undefined ? { fellBack } : {}) };
      }
    }
    throw new RouterError('down', `no model is ready for role "${role}"; start this model in the models panel and try again`);
  }

  async routeForId(id: string): Promise<RouteSelection> {
    const routes = await this.routes();
    const route = routes.find(entry => entry.id === id) ?? routes.find(entry => entry.id === `local:${id}`);
    if (route === undefined) throw new RouterError('down', `start this model before chatting: route ${id} is not available`);
    const status = await this.freshStatus(id);
    if (status === 'ready') {
      return { modelId: route.id, displayName: route.displayName, providerType: route.providerType, status, contextLength: route.contextLength };
    }
    const role = route.roles[0] ?? 'chat';
    const fallback = await this.routeForRole(role).catch(() => null);
    if (fallback === null) throw new RouterError('down', `start this model before chatting: route ${id} is down (${status}) and no fallback is ready`);
    return {
      modelId: fallback.modelId,
      displayName: fallback.displayName,
      providerType: fallback.providerType,
      status: fallback.status,
      contextLength: fallback.contextLength,
      fellBack: { from: id, to: fallback.modelId, reason: 'down' }
    };
  }

  private async resolve(routeId: string): Promise<{ route: ModelRoute; selection: RouteSelection }> {
    const routes = await this.routes();
    // Accept bare manifest ids ('smollm2-360m-q8') as well as fully-qualified
    // 'local:<id>' route ids — callers use both forms interchangeably.
    const direct = routes.find(entry => entry.id === routeId)
      ?? routes.find(entry => entry.id === `local:${routeId}`);
    if (direct === undefined) throw new RouterError('down', `unknown route ${routeId}`);
    if ((await this.freshStatus(direct.id)) === 'ready') {
      return { route: direct, selection: { modelId: direct.id, displayName: direct.displayName, providerType: direct.providerType, status: 'ready', contextLength: direct.contextLength } };
    }
    const selection = await this.routeForId(routeId);
    const fallback = routes.find(entry => entry.id === selection.modelId);
    if (fallback === undefined) throw new RouterError('down', `fallback route ${selection.modelId} disappeared`);
    return { route: fallback, selection };
  }

  // Fit history against the engine's EFFECTIVE served window, not the
  // manifest's declared context_tokens. llama-server clamps n_ctx for some
  // artifacts; fitting against the declared value produced HTTP-400 overflow
  // failures in the 2026-08-28 audit (C1/D1). Falls back to the declared
  // value when the served window has not been probed yet (legacy parity).
  // The newest turn is always delivered: if it alone exceeds the budget its
  // head is trimmed, because the engine rejects oversized prompts outright.
  private fitForRoute(route: ModelRoute, messages: ChatMessageT[], maxTokens: number | undefined): { fit: ReturnType<typeof fitHistory>; overflowTrimmed: boolean } {
    const reserve = maxTokens ?? 512;
    const modelId = route.providerType === 'local' ? route.id.slice('local:'.length) : null;
    const served = modelId !== null ? this.runtime.getEffectiveBudget(modelId, reserve) : null;
    if (served === null) {
      return { fit: fitHistory(messages, route.contextLength, maxTokens !== undefined ? { maxTokens } : {}), overflowTrimmed: false };
    }
    const budget = Math.max(1, served - reserve);
    const fit = fitHistory(messages, served, maxTokens !== undefined ? { maxTokens } : {});
    let overflowTrimmed = false;
    const newest = fit.messages[fit.messages.length - 1];
    if (newest !== undefined && estimateTokens(newest.content) > budget) {
      const keepChars = budget * 4;
      const trimmedContent = newest.content.slice(Math.max(0, newest.content.length - keepChars));
      fit.messages = [...fit.messages.slice(0, -1), { ...newest, content: trimmedContent }];
      fit.estimatedTokens = Math.max(1, fit.estimatedTokens - estimateTokens(newest.content) + estimateTokens(trimmedContent));
      overflowTrimmed = true;
    }
    return { fit, overflowTrimmed };
  }

  async chat(routeId: string, messages: ChatMessageT[], options: { maxTokens?: number | undefined; temperature?: number | undefined; timeoutMs?: number | undefined; signal?: AbortSignal | undefined } = {}): Promise<RouteChatResult> {
    const { route, selection } = await this.resolve(routeId);
    const { fit, overflowTrimmed } = this.fitForRoute(route, messages, options.maxTokens);
    const chatOptions = normalizeOptions(options);
    let result: { text: string; modelId: string; tokens?: number; timingMs: number };
    try {
      if (route.providerType === 'local') {
        result = await this.runtime.chat(route.id.slice('local:'.length), fit.messages, chatOptions);
      } else {
        throw new RouterError('unsupported', 'external chat requires an Authority-resolved provider model route');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('busy')) throw new RouterError('busy', error.message);
      if (error instanceof Error && error.message.includes('timed out')) throw new RouterError('busy', error.message);
      throw error;
    }
    const out: RouteChatResult = {
      text: result.text,
      modelId: selection.modelId,
      timingMs: result.timingMs,
      usedApprox: fit.estimatedTokens,
      dropped: fit.dropped,
      truncatedSystem: fit.truncatedSystem
    };
    if (overflowTrimmed) out.overflowTrimmed = true;
    if (result.tokens !== undefined) out.tokens = result.tokens;
    return out;
  }

  async chatStream(routeId: string, messages: ChatMessageT[], onDelta: (delta: string) => void, signal: AbortSignal, options: { maxTokens?: number | undefined } = {}): Promise<RouteChatResult> {
    const { route, selection } = await this.resolve(routeId);
    const { fit, overflowTrimmed } = this.fitForRoute(route, messages, options.maxTokens);
    const chatOptions = normalizeOptions({ ...options, signal });
    let result: { text: string; modelId: string; tokens?: number; timingMs: number };
    if (route.providerType === 'local') {
      const modelId = route.id.slice('local:'.length);
      const started = Date.now();
      let text = '';
      await this.runtime.chatStream(modelId, fit.messages, delta => {
        text += delta;
        onDelta(delta);
      }, signal, chatOptions);
      result = { text, modelId, timingMs: Date.now() - started };
    } else {
      throw new RouterError('unsupported', 'external streaming requires an Authority-resolved provider model route');
    }
    const out: RouteChatResult = {
      text: result.text,
      modelId: selection.modelId,
      timingMs: result.timingMs,
      usedApprox: fit.estimatedTokens,
      dropped: fit.dropped,
      truncatedSystem: fit.truncatedSystem
    };
    if (overflowTrimmed) out.overflowTrimmed = true;
    if (result.tokens !== undefined) out.tokens = result.tokens;
    return out;
  }
}
