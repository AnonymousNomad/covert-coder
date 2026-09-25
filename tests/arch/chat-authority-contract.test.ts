import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpOperationKind, OPERATION_POLICY } from '../../common/security/operation-policy.mjs';
import { chatAuthorityOperationKind, routeForChat, routeForChatStream } from '../../node/src/routes/chat.ts';
import { type ChatAuthorityTargetBinding, type ModelRouter, type ResolvedChatAuthorityTarget } from '../../node/src/services/model-router.ts';
import type { ModelRuntime } from '../../node/src/services/model-runtime.ts';
import { RouteError } from '../../node/src/server.ts';

const workspace = 'C:\\authority-chat-contract-fixture';
const router = {} as ModelRouter;
const runtime = {} as ModelRuntime;

test('non-stream chat requires a request-aware Authority descriptor', () => {
  const route = routeForChat(router, runtime, workspace);
  assert.equal(httpOperationKind(route.method, route.path), null,
    'target-dependent chat cannot inherit one static operation class');
  assert.equal(typeof route.describeOperation, 'function');
});

test('streaming chat requires the same request-aware Authority descriptor', () => {
  const route = routeForChatStream(router, runtime, workspace);
  assert.equal(httpOperationKind(route.method, route.path), null,
    'target-dependent streaming chat cannot inherit one static operation class');
  assert.equal(typeof route.describeOperation, 'function');
});

function target(executionClass: string): ResolvedChatAuthorityTarget {
  return {
    binding: { execution_class: executionClass } as ChatAuthorityTargetBinding,
    route: {} as never
  };
}

function resolver(executionClass: string): ModelRouter {
  const resolved = target(executionClass);
  return { resolveAuthorityTarget: () => ({ status: 'RESOLVED', target: resolved }) } as unknown as ModelRouter;
}

test('both endpoints derive the same registered operation class from target truth', async () => {
  const localBody = { modelId: 'local:fixture', messages: [{ role: 'user' as const, content: 'fixture' }] };
  const externalBody = { modelId: 'cloud:provider:local-looking-model', messages: localBody.messages };
  for (const route of [routeForChat(resolver('LOCAL'), runtime, workspace), routeForChatStream(resolver('LOCAL'), runtime, workspace)]) {
    const local = await route.describeOperation!({ query: {}, body: localBody }, 'local-attempt');
    assert.equal(local.kind, 'capability.execute');
    assert.equal((local.args as { route: string }).route, route.path === '/api/chat' ? 'POST /api/chat' : 'POST /api/chat/stream');
    assert.equal(Object.hasOwn(OPERATION_POLICY, local.kind), true);
  }
  for (const route of [routeForChat(resolver('EXTERNAL'), runtime, workspace), routeForChatStream(resolver('EXTERNAL'), runtime, workspace)]) {
    const external = await route.describeOperation!({ query: {}, body: externalBody }, 'external-attempt');
    assert.equal(external.kind, 'capability.external');
    assert.equal((external.args as { route: string }).route, route.path === '/api/chat' ? 'POST /api/chat' : 'POST /api/chat/stream');
    assert.equal(Object.hasOwn(OPERATION_POLICY, external.kind), true);
  }
});

test('unregistered Authority policy has no chat operation fallback', () => {
  assert.equal(chatAuthorityOperationKind('LOCAL', {}), null);
  assert.equal(chatAuthorityOperationKind('EXTERNAL', {}), null);
  assert.equal(chatAuthorityOperationKind('UNKNOWN', OPERATION_POLICY), null);
});

test('unresolved targets and unregistered execution classes are denied rather than defaulted', async () => {
  const unresolved = { resolveAuthorityTarget: () => ({ status: 'UNKNOWN', reason: 'route-not-registered' }) } as unknown as ModelRouter;
  const localBody = { modelId: 'missing', messages: [{ role: 'user' as const, content: 'fixture' }] };
  for (const route of [routeForChat(unresolved, runtime, workspace), routeForChatStream(unresolved, runtime, workspace)]) {
    await assert.rejects(
      () => route.describeOperation!({ query: {}, body: localBody }, 'unknown-attempt'),
      (error: unknown) => error instanceof RouteError && error.code === 'FORBIDDEN'
    );
  }
  const malformed = resolver('UNKNOWN');
  const route = routeForChat(malformed, runtime, workspace);
  await assert.rejects(
    () => route.describeOperation!({ query: {}, body: { ...localBody, modelId: 'local:fixture' } }, 'unknown-class'),
    (error: unknown) => error instanceof RouteError && error.code === 'FORBIDDEN'
  );
});
