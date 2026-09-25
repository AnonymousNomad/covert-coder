import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpOperationKind } from '../../common/security/operation-policy.mjs';
import { routeForChat, routeForChatStream } from '../../node/src/routes/chat.ts';
import type { ModelRouter } from '../../node/src/services/model-router.ts';
import type { ModelRuntime } from '../../node/src/services/model-runtime.ts';

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
