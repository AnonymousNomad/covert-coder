import {
  ManagedClientDiscovery,
  ManagedClientTarget,
  ManagedLaunchDescriptor,
  CLIENT_MATRIX,
  type ManagedClientDiscoveryT,
  type ManagedClientIdT,
  type ManagedClientTargetT,
  type ManagedLaunchDescriptorT,
} from '../../../common/contracts/managed-client.ts';
import type { createOpenCodeBridge } from './opencode-bridge.ts';

type Target1ClientId = Extract<ManagedClientIdT, 'claude-code' | 'codex-cli' | 'kimi-code'>;
type OpenCodeBridge = Pick<ReturnType<typeof createOpenCodeBridge>, 'runTask' | 'runTaskStream' | 'discoverGoModels'>;

export type ManagedClientAdapterErrorCode =
  | 'CLIENT_UNAVAILABLE'
  | 'CLIENT_STATE_UNKNOWN'
  | 'INVALID_DISCOVERY'
  | 'INVALID_TARGET'
  | 'CLIENT_ID_MISMATCH'
  | 'PROVIDER_MODEL_IDENTITY_UNOBSERVED'
  | 'PROVIDER_MODEL_MISMATCH'
  | 'NOT_SUPPORTED';

export class ManagedClientAdapterError extends Error {
  readonly code: ManagedClientAdapterErrorCode;

  constructor(code: ManagedClientAdapterErrorCode, message: string) {
    super(message);
    this.name = 'ManagedClientAdapterError';
    this.code = code;
  }
}

export interface ManagedTerminalClientAdapter {
  readonly client_id: Target1ClientId;
  readonly governance_state: 'MANAGED_OBSERVED';
  readonly provider_qualification_state: 'NOT_EVALUATED';
  readonly execution_surface: 'TERMINAL_PTY_DESCRIPTOR';
  readonly ownership: 'TERMINAL_SESSION_SERVICE';
  readonly supported_capabilities: readonly ['INTERACTIVE_PTY_DESCRIPTOR'];
  assertSupportedOperation(operation: unknown): void;
  buildLaunch(discovery: unknown, target?: unknown): ManagedLaunchDescriptorT;
}

const NO_BYPASS = /(?:--dangerously|--yolo|--skip-permissions|--no-approval|--unsafe)/i;

function createTerminalAdapter(options: {
  clientId: Target1ClientId;
  toolRestrictions: string[];
  notes: string[];
}): ManagedTerminalClientAdapter {
  const matrix = CLIENT_MATRIX[options.clientId];
  const safeDescriptorStrings = [...options.toolRestrictions, ...options.notes];
  if (safeDescriptorStrings.some(value => NO_BYPASS.test(value))) {
    throw new Error('managed client adapter contains a prohibited bypass declaration');
  }

  function assertSupportedOperation(operation: unknown): void {
    const supported = matrix.supported_capabilities as readonly unknown[];
    if (typeof operation !== 'string' || !supported.includes(operation)) {
      throw new ManagedClientAdapterError('NOT_SUPPORTED', 'managed client operation is not supported');
    }
  }

  function buildLaunch(untrustedDiscovery: unknown, untrustedTarget?: unknown): ManagedLaunchDescriptorT {
    const parsed = ManagedClientDiscovery.safeParse(untrustedDiscovery);
    if (!parsed.success) {
      throw new ManagedClientAdapterError('INVALID_DISCOVERY', 'managed client discovery is invalid');
    }
    const discovery: ManagedClientDiscoveryT = parsed.data;
    if (discovery.client_id !== options.clientId) {
      throw new ManagedClientAdapterError('CLIENT_ID_MISMATCH', 'managed client identity mismatch');
    }
    if (discovery.governance_state !== matrix.default_truth ||
        discovery.provider_qualification_state !== matrix.provider_qualification_state ||
        discovery.execution_surface !== matrix.execution_surface ||
        discovery.ownership !== matrix.ownership ||
        discovery.supported_capabilities.join('|') !== matrix.supported_capabilities.join('|')) {
      throw new ManagedClientAdapterError('INVALID_DISCOVERY', 'managed client classifications are inconsistent');
    }
    if (discovery.availability === 'UNKNOWN') {
      throw new ManagedClientAdapterError('CLIENT_STATE_UNKNOWN', 'managed client availability is unknown');
    }
    if (discovery.availability !== 'AVAILABLE' || discovery.executable_path === null) {
      throw new ManagedClientAdapterError('CLIENT_UNAVAILABLE', 'managed client is unavailable');
    }

    let target: ManagedClientTargetT | null = null;
    if (untrustedTarget !== undefined) {
      const targetResult = ManagedClientTarget.safeParse(untrustedTarget);
      if (!targetResult.success) {
        throw new ManagedClientAdapterError('INVALID_TARGET', 'provider/model target is invalid');
      }
      target = targetResult.data;
      if (discovery.provider_identity === null || discovery.model_identity === null) {
        throw new ManagedClientAdapterError('PROVIDER_MODEL_IDENTITY_UNOBSERVED', 'provider/model identity is not observed');
      }
      if (target.provider_identity !== discovery.provider_identity || target.model_identity !== discovery.model_identity) {
        throw new ManagedClientAdapterError('PROVIDER_MODEL_MISMATCH', 'requested provider/model does not match the observed client identity');
      }
    }

    return ManagedLaunchDescriptor.parse({
      client_id: options.clientId,
      executable_path: discovery.executable_path,
      arguments: [],
      tool_restrictions: options.toolRestrictions,
      tui_visible: true,
      declaration_only: true,
      supported_capabilities: [...matrix.supported_capabilities],
      execution_surface: matrix.execution_surface,
      ownership: matrix.ownership,
      credential_availability: discovery.credential_availability,
      credential_owner: matrix.credential_owner,
      provider_identity: target?.provider_identity ?? discovery.provider_identity,
      model_identity: target?.model_identity ?? discovery.model_identity,
      lifecycle_owner: 'TERMINAL_SESSION_SERVICE',
      cancellation_semantics: 'OWNER_STOP',
      timeout_semantics: 'NOT_ENFORCED_BY_DESCRIPTOR',
      governance_state: matrix.default_truth,
      provider_qualification_state: matrix.provider_qualification_state,
      evidence_state: discovery.evidence_state,
      notes: options.notes
    });
  }

  return Object.freeze({
    client_id: options.clientId,
    governance_state: 'MANAGED_OBSERVED',
    provider_qualification_state: 'NOT_EVALUATED',
    execution_surface: 'TERMINAL_PTY_DESCRIPTOR',
    ownership: 'TERMINAL_SESSION_SERVICE',
    supported_capabilities: matrix.supported_capabilities as readonly ['INTERACTIVE_PTY_DESCRIPTOR'],
    assertSupportedOperation,
    buildLaunch
  });
}

export function createClaudeCodeAdapter(): ManagedTerminalClientAdapter {
  return createTerminalAdapter({
    clientId: 'claude-code',
    toolRestrictions: ['no-added-bypass-flags'],
    notes: [
      'Descriptor only; TerminalSessionService owns PTY execution and stop behavior.',
      'Authentication remains Claude Code owned; this adapter never reads credentials.'
    ]
  });
}

export function createCodexCliAdapter(): ManagedTerminalClientAdapter {
  return createTerminalAdapter({
    clientId: 'codex-cli',
    toolRestrictions: ['no-added-bypass-flags', 'sandbox-policy-not-widened'],
    notes: [
      'Descriptor only; TerminalSessionService owns PTY execution and stop behavior.',
      'No sandbox bypass is added by this adapter; CLI sandbox enforcement is not qualified here.'
    ]
  });
}

export function createKimiCodeAdapter(): ManagedTerminalClientAdapter {
  return createTerminalAdapter({
    clientId: 'kimi-code',
    toolRestrictions: ['no-added-bypass-flags', 'exact-version-required-for-qualification'],
    notes: [
      'Descriptor only; TerminalSessionService owns PTY execution and stop behavior.',
      'Kimi qualification requires exact-version evidence; client authentication remains client-owned.'
    ]
  });
}

export interface OpenCodeBridgeAdapter {
  readonly client_id: 'opencode';
  readonly discovery: ManagedClientDiscoveryT;
  readonly runTask: OpenCodeBridge['runTask'];
  readonly runTaskStream: OpenCodeBridge['runTaskStream'];
  readonly discoverGoModels: OpenCodeBridge['discoverGoModels'];
  assertSupportedOperation(operation: unknown): void;
  buildPtyLaunch(): never;
}

export function createOpenCodeBridgeAdapter(options: {
  bridge: OpenCodeBridge | null;
  discovery: unknown;
}): OpenCodeBridgeAdapter {
  const matrix = CLIENT_MATRIX.opencode;
  const parsed = ManagedClientDiscovery.safeParse(options.discovery);
  if (!parsed.success) {
    throw new ManagedClientAdapterError('INVALID_DISCOVERY', 'OpenCode discovery is invalid');
  }
  const discovery: ManagedClientDiscoveryT = parsed.data;
  Object.freeze(discovery.supported_capabilities);
  Object.freeze(discovery);
  if (discovery.client_id !== 'opencode') {
    throw new ManagedClientAdapterError('CLIENT_ID_MISMATCH', 'OpenCode discovery identity mismatch');
  }
  if (discovery.governance_state !== matrix.default_truth ||
      discovery.provider_qualification_state !== matrix.provider_qualification_state ||
      discovery.execution_surface !== matrix.execution_surface ||
      discovery.ownership !== matrix.ownership ||
      discovery.supported_capabilities.join('|') !== matrix.supported_capabilities.join('|')) {
    throw new ManagedClientAdapterError('INVALID_DISCOVERY', 'OpenCode discovery classifications are inconsistent');
  }
  const unavailable = (): never => {
    throw new ManagedClientAdapterError('CLIENT_UNAVAILABLE', 'OpenCode bridge is unavailable');
  };
  const runTask: OpenCodeBridge['runTask'] = options.bridge?.runTask ?? (async () => unavailable());
  const runTaskStream: OpenCodeBridge['runTaskStream'] = options.bridge?.runTaskStream ?? (async () => unavailable());
  const discoverGoModels: OpenCodeBridge['discoverGoModels'] = options.bridge?.discoverGoModels ?? (async () => unavailable());

  function assertSupportedOperation(operation: unknown): void {
    const supported = matrix.supported_capabilities as readonly unknown[];
    if (typeof operation !== 'string' || !supported.includes(operation)) {
      throw new ManagedClientAdapterError('NOT_SUPPORTED', 'OpenCode operation is not supported by this adapter');
    }
  }

  function buildPtyLaunch(): never {
    throw new ManagedClientAdapterError('NOT_SUPPORTED', 'OpenCode uses the existing bridge and has no PTY launch path');
  }

  return Object.freeze({
    client_id: 'opencode',
    discovery,
    runTask,
    runTaskStream,
    discoverGoModels,
    assertSupportedOperation,
    buildPtyLaunch
  });
}
