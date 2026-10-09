import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ManagedClientAdapterError,
  createClaudeCodeAdapter,
  createCodexCliAdapter,
  createKimiCodeAdapter,
  createOpenCodeBridgeAdapter
} from '../../node/src/services/managed-clients.ts';
import { createManagedClientRegistry } from '../../node/src/services/managed-client-registry.ts';
import type { createOpenCodeBridge } from '../../node/src/services/opencode-bridge.ts';
import type { ManagedClientIdT, ManagedClientProbeResultT } from '../../common/contracts/managed-client.ts';

type OpenCodeBridge = Pick<ReturnType<typeof createOpenCodeBridge>, 'runTask' | 'runTaskStream' | 'discoverGoModels'>;

const DETECTED: ManagedClientProbeResultT = {
  executable_path: 'C:\\tools\\client.exe',
  exact_version: '1.2.3',
  executable_sha256: 'a'.repeat(64),
  credential_availability: 'AVAILABLE',
  provider_identity: 'anthropic',
  model_identity: 'claude-3'
};

const terminalAdapters = [
  { clientId: 'claude-code' as const, create: createClaudeCodeAdapter },
  { clientId: 'codex-cli' as const, create: createCodexCliAdapter },
  { clientId: 'kimi-code' as const, create: createKimiCodeAdapter }
];

async function discover(
  clientId: ManagedClientIdT,
  result: ManagedClientProbeResultT | null,
  evidenceState: 'LIVE' | 'FIXTURE' = 'FIXTURE'
) {
  const registry = createManagedClientRegistry({ probes: [{
    client_id: clientId,
    evidence_state: evidenceState,
    detect: async () => result
  }] });
  return (await registry.discover()).find(record => record.client_id === clientId)!;
}

function expectAdapterError(action: () => unknown, code: ManagedClientAdapterError['code']): void {
  assert.throws(action, error => error instanceof ManagedClientAdapterError && error.code === code);
}

test('TARGET_1 adapters emit bounded, visible, declaration-only descriptors owned by TerminalSessionService', async () => {
  for (const item of terminalAdapters) {
    const adapter = item.create();
    const record = await discover(item.clientId, DETECTED);
    const descriptor = adapter.buildLaunch(record);
    assert.equal(descriptor.client_id, item.clientId);
    assert.equal(descriptor.executable_path, DETECTED.executable_path);
    assert.deepEqual(descriptor.arguments, []);
    assert.equal(descriptor.tui_visible, true);
    assert.equal(descriptor.declaration_only, true);
    assert.equal(descriptor.lifecycle_owner, 'TERMINAL_SESSION_SERVICE');
    assert.equal(descriptor.ownership, 'TERMINAL_SESSION_SERVICE');
    assert.equal(descriptor.cancellation_semantics, 'OWNER_STOP');
    assert.equal(descriptor.timeout_semantics, 'NOT_ENFORCED_BY_DESCRIPTOR');
    assert.equal(descriptor.governance_state, 'MANAGED_OBSERVED');
    assert.equal(descriptor.provider_qualification_state, 'NOT_EVALUATED');
    assert.equal(descriptor.evidence_state, 'FIXTURE');
    assert.equal(descriptor.provider_identity, 'anthropic');
    assert.equal(descriptor.model_identity, 'claude-3');
  }
});

test('TARGET_1 adapters add no bypass flags and reject unsupported operations explicitly', () => {
  for (const item of terminalAdapters) {
    const adapter = item.create();
    assert.equal(adapter.assertSupportedOperation('INTERACTIVE_PTY_DESCRIPTOR'), undefined);
    expectAdapterError(() => adapter.assertSupportedOperation('PROGRAMMATIC_PROMPT'), 'NOT_SUPPORTED');
  }
});

test('missing, unavailable, and unknown clients do not launch or fall back', async () => {
  for (const item of terminalAdapters) {
    const adapter = item.create();
    const absent = await discover(item.clientId, null);
    expectAdapterError(() => adapter.buildLaunch(absent), 'CLIENT_UNAVAILABLE');

    const failedRegistry = createManagedClientRegistry({ probes: [{
      client_id: item.clientId,
      evidence_state: 'FIXTURE',
      detect: async () => { throw new Error('runtime unavailable'); }
    }] });
    const unknown = (await failedRegistry.discover()).find(record => record.client_id === item.clientId)!;
    expectAdapterError(() => adapter.buildLaunch(unknown), 'CLIENT_STATE_UNKNOWN');
  }
});

test('invalid discovery and mismatched client identity fail with sanitized errors', async () => {
  const adapter = createClaudeCodeAdapter();
  expectAdapterError(() => adapter.buildLaunch({
    client_id: 'claude-code',
    availability: 'AVAILABLE',
    credential_availability: 'AVAILABLE',
    provider_identity: 'token=secret-canary'
  }), 'INVALID_DISCOVERY');

  const otherClient = await discover('codex-cli', DETECTED);
  expectAdapterError(() => adapter.buildLaunch(otherClient), 'CLIENT_ID_MISMATCH');

  try {
    adapter.buildLaunch({ ...otherClient, provider_identity: 'token=secret-canary' });
    assert.fail('malformed discovery must be rejected');
  } catch (error) {
    assert.equal((error as Error).message.includes('secret-canary'), false);
  }
});

test('requested provider/model identity must exactly match observation; no default or alternate model is selected', async () => {
  const record = await discover('claude-code', DETECTED);
  const adapter = createClaudeCodeAdapter();
  const descriptor = adapter.buildLaunch(record, {
    provider_identity: 'anthropic',
    model_identity: 'claude-3'
  });
  assert.equal(descriptor.provider_identity, 'anthropic');
  assert.equal(descriptor.model_identity, 'claude-3');
  expectAdapterError(() => adapter.buildLaunch(record, {
    provider_identity: 'anthropic',
    model_identity: 'other-model'
  }), 'PROVIDER_MODEL_MISMATCH');
  expectAdapterError(() => adapter.buildLaunch(record, {
    provider_identity: 'anthropic',
    model_identity: 'claude-3',
    extra_configuration: 'must-not-be-ignored'
  }), 'INVALID_TARGET');

  const unobserved = await discover('claude-code', { ...DETECTED, provider_identity: null, model_identity: null });
  expectAdapterError(() => adapter.buildLaunch(unobserved, {
    provider_identity: 'anthropic',
    model_identity: 'claude-3'
  }), 'PROVIDER_MODEL_IDENTITY_UNOBSERVED');
});

test('credential absence remains visible without exposing values or selecting another provider', async () => {
  const adapter = createClaudeCodeAdapter();
  const record = await discover('claude-code', { ...DETECTED, credential_availability: 'UNAVAILABLE' });
  const descriptor = adapter.buildLaunch(record);
  assert.equal(descriptor.credential_availability, 'UNAVAILABLE');
  assert.equal(descriptor.credential_owner, 'CLIENT');
  assert.equal(descriptor.provider_identity, 'anthropic');
  assert.equal(descriptor.model_identity, 'claude-3');
  assert.deepEqual(descriptor.arguments, []);
  const serialized = JSON.stringify(descriptor);
  assert.equal(/sk-|hf_|ghp_|Bearer|token=|secret/i.test(serialized), false);
});

test('OpenCode adapter reuses the exact bridge methods and refuses a parallel PTY launch', async () => {
  const calls: unknown[] = [];
  const bridgeFixture = {
    runTask: async (input: unknown) => { calls.push(['runTask', input]); return { provider: 'opencode', text: 'ok' }; },
    runTaskStream: async (input: unknown) => { calls.push(['runTaskStream', input]); return { provider: 'opencode', text: 'ok' }; },
    discoverGoModels: async (workspace: string) => { calls.push(['discoverGoModels', workspace]); return { connected: false, model_ids: [] }; }
  } as unknown as OpenCodeBridge;
  const clientDiscovery = await discover('opencode', DETECTED);
  const adapter = createOpenCodeBridgeAdapter({ bridge: bridgeFixture, discovery: clientDiscovery });
  assert.strictEqual(adapter.runTask, bridgeFixture.runTask);
  assert.strictEqual(adapter.runTaskStream, bridgeFixture.runTaskStream);
  assert.strictEqual(adapter.discoverGoModels, bridgeFixture.discoverGoModels);
  assert.equal(adapter.discovery.availability, 'AVAILABLE');
  assert.equal(adapter.discovery.governance_state, 'MANAGED_OBSERVED');
  assert.equal(adapter.discovery.provider_qualification_state, 'NOT_EVALUATED');
  assert.equal(adapter.discovery.evidence_state, 'FIXTURE');
  assert.equal(adapter.assertSupportedOperation('BRIDGE_RUN_TASK'), undefined);
  const disconnectedCatalog = await adapter.discoverGoModels('C:\\workspace');
  assert.deepEqual(disconnectedCatalog, { connected: false, model_ids: [] });
  assert.deepEqual(calls[0], ['discoverGoModels', 'C:\\workspace']);
  assert.throws(() => {
    (adapter.discovery.supported_capabilities as unknown as string[]).push('INTERACTIVE_PTY_DESCRIPTOR');
  }, TypeError);
  expectAdapterError(() => adapter.assertSupportedOperation('INTERACTIVE_PTY_DESCRIPTOR'), 'NOT_SUPPORTED');
  expectAdapterError(() => adapter.buildPtyLaunch(), 'NOT_SUPPORTED');

  const controller = new AbortController();
  const request = {
    workspace: 'C:\\workspace',
    prompt: 'bounded fixture request',
    providerID: 'provider-a',
    modelID: 'model-b',
    timeoutMs: 17000,
    signal: controller.signal
  };
  await adapter.runTask(request);
  assert.deepEqual(calls[1], ['runTask', request]);
  assert.equal((calls[1] as [string, typeof request])[1].providerID, 'provider-a');
  assert.equal((calls[1] as [string, typeof request])[1].modelID, 'model-b');
  assert.equal((calls[1] as [string, typeof request])[1].timeoutMs, 17000);
  assert.strictEqual((calls[1] as [string, typeof request])[1].signal, controller.signal);
});

test('OpenCode cancellation and timeout outcomes remain owned by the bridge', async () => {
  const cancelled = Object.assign(new Error('OpenCode task cancelled'), { code: 'CANCELLED' });
  const timeout = Object.assign(new Error('OpenCode task timed out'), { code: 'TIMEOUT' });
  const result = {
    provider: 'opencode',
    text: 'fixture answer',
    session_id: 'ses_fixture',
    delegated_provider: 'provider-a',
    delegated_model: 'model-b',
    server_url: 'http://127.0.0.1:4000',
    duration_ms: 1,
    version: 'fixture'
  };
  let nextError: Error | null = null;
  const bridgeFixture = {
    runTask: async () => {
      if (nextError) throw nextError;
      return result;
    },
    runTaskStream: async () => {
      if (nextError) throw nextError;
      return result;
    },
    discoverGoModels: async () => ({ connected: false, model_ids: [] })
  } as unknown as OpenCodeBridge;
  const clientDiscovery = await discover('opencode', DETECTED);
  const adapter = createOpenCodeBridgeAdapter({ bridge: bridgeFixture, discovery: clientDiscovery });
  const request = { workspace: 'C:\\workspace', prompt: 'fixture', providerID: 'provider-a', modelID: 'model-b' };

  // The wrapper does not replace response validation or lifecycle handling.
  assert.strictEqual(await adapter.runTask(request), result);
  nextError = cancelled;
  await assert.rejects(adapter.runTask(request), error => error === cancelled);
  nextError = timeout;
  await assert.rejects(adapter.runTaskStream({ ...request, onDelta: () => undefined }), error => error === timeout);
});

test('OpenCode absence and unsupported operations fail closed without another execution path', async () => {
  const clientDiscovery = await discover('opencode', null);
  const adapter = createOpenCodeBridgeAdapter({ bridge: null, discovery: clientDiscovery });
  assert.equal(adapter.discovery.availability, 'UNAVAILABLE');
  assert.equal(adapter.discovery.credential_owner, 'OPENCODE');
  assert.equal(adapter.discovery.credential_availability, 'UNKNOWN');
  expectAdapterError(() => adapter.buildPtyLaunch(), 'NOT_SUPPORTED');
  await assert.rejects(adapter.runTask({
    workspace: 'C:\\workspace',
    prompt: 'fixture',
    providerID: 'provider-a',
    modelID: 'model-b'
  }), error => error instanceof ManagedClientAdapterError && error.code === 'CLIENT_UNAVAILABLE');
});
