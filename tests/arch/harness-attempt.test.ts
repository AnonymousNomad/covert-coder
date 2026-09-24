// HARNESS vNEXT H3 — Immutable Execution Envelope + Durable Attempt/Admission
// Journal adversarial battery.
//
// Core invariant under attack: NO MUTATION WITHOUT DURABLE ADMISSION.
// Plus: immutability (drift is journaled, never mutated), H2 partial-commit
// closure, crash recovery classification, retry safety, secret safety,
// performance measurement, and live end-to-end fail-closed denial.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAttemptJournal, redactSecrets } from '../../node/src/services/attempt-journal.ts';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
const { buildRoutes } = await import('../../node/src/openapi.ts');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function workspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'h3-attempt-'));
}

function admissionInput(overrides: Record<string, unknown> = {}) {
  return {
    task: 'bounded h3 fixture task',
    mode: 'act',
    task_id: 'task-h3',
    workspace: 'ws',
    worker_role: 'act',
    worker_identity: 'local:auto',
    worker_provider: 'local',
    worker_model: 'auto',
    handoff_id: null,
    authority_owner: 'owner',
    authority_operation_kind: 'agent.start',
    max_iterations: 25,
    effective_context_tokens: null,
    resource_decision: { decision: 'START' as const, reason: 'admitted' },
    mutation_scope: ['write_file'],
    capabilities: ['read_file', 'write_file', 'attempt_completion'],
    ...overrides
  };
}

async function writeRawJournal(workspaceRoot: string, rows: Array<{ seq: number; attempt_id: string; event: string; data?: Record<string, string | number | boolean | null> }>): Promise<void> {
  const dir = path.join(workspaceRoot, '.aide', 'admission');
  await fs.mkdir(dir, { recursive: true });
  const lines = rows.map(row => JSON.stringify({ seq: row.seq, ts: new Date().toISOString(), attempt_id: row.attempt_id, event: row.event, data: row.data ?? {} }));
  await fs.writeFile(path.join(dir, 'journal.jsonl'), lines.join('\n') + '\n', 'utf8');
}

const ATTEMPT_A = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_B = '22222222-2222-4222-8222-222222222222';

test('mutation without an admitted attempt -> DENY', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws });
  const check = await journal.assertAdmitted(ATTEMPT_A);
  assert.equal(check.admitted, false);
  assert.match(check.reason, /absent or unsealed/);
});

test('permit exists but wrong attempt -> DENY', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_B });
  await journal.admit(admissionInput({ workspace: ws }));
  const check = await journal.assertAdmitted(ATTEMPT_A);
  assert.equal(check.admitted, false);
});

test('permit exists but wrong project -> DENY', async () => {
  const wsA = await workspace();
  const wsB = await workspace();
  const journalA = createAttemptJournal({ workspace: wsA, idFactory: () => ATTEMPT_A });
  await journalA.admit(admissionInput({ workspace: wsA }));
  const journalB = createAttemptJournal({ workspace: wsB });
  const check = await journalB.assertAdmitted(ATTEMPT_A);
  assert.equal(check.admitted, false);
  assert.equal((await journalB.list()).total, 0);
});

test('H2 PARTIAL-COMMIT REGRESSION: sealed envelope without journal admission -> NOT admitted, mutation DENIED', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  const envelope = await journal.admit(admissionInput({ workspace: ws }));
  assert.equal(envelope.sealed, true);
  // Reproduce the crash: sealed envelope exists on disk, journal admission
  // record is missing (rewrite journal without ATTEMPT_ADMITTED).
  await writeRawJournal(ws, [
    { seq: 0, attempt_id: ATTEMPT_A, event: 'ATTEMPT_CREATED' },
    { seq: 1, attempt_id: ATTEMPT_A, event: 'VALIDATION_COMPLETED' },
    { seq: 2, attempt_id: ATTEMPT_A, event: 'RESOURCE_ADMITTED' },
    { seq: 3, attempt_id: ATTEMPT_A, event: 'AUTHORITY_GRANTED' }
  ]);
  const check = await journal.assertAdmitted(ATTEMPT_A);
  assert.equal(check.admitted, false);
  assert.match(check.reason, /no durable ATTEMPT_ADMITTED/);
  const recovered = await journal.recover();
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0]?.classification, 'RECOVERED_INCOMPLETE_ADMISSION');
  const detail = await journal.get(ATTEMPT_A);
  assert.equal(detail?.retry_safety, 'NOT_APPLICABLE');
});

test('admission incomplete (unsealed envelope) -> DENY', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws });
  await fs.mkdir(path.join(ws, '.aide', 'admission', 'attempts'), { recursive: true });
  await fs.writeFile(path.join(ws, '.aide', 'admission', 'attempts', `${ATTEMPT_A}.json`), JSON.stringify({
    schema: 'covert.attempt.v1', attempt_id: ATTEMPT_A, sealed: false, created_at: new Date().toISOString(), sealed_at: null
  }), 'utf8');
  const check = await journal.assertAdmitted(ATTEMPT_A);
  assert.equal(check.admitted, false);
});

test('execution cannot start before the attempt is sealed and durably admitted', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.prepare(admissionInput({ workspace: ws }));
  await assert.rejects(() => journal.executionStarted(ATTEMPT_A), /execution cannot start/);
  const beforeSeal = await journal.get(ATTEMPT_A);
  assert.ok(!beforeSeal?.events.some(event => event.event === 'EXECUTION_STARTED'));
  await journal.seal(ATTEMPT_A);
  await journal.executionStarted(ATTEMPT_A);
  const afterSeal = await journal.get(ATTEMPT_A);
  assert.ok(afterSeal?.events.some(event => event.event === 'EXECUTION_STARTED'));
});

test('concurrent seal calls are idempotent and do not duplicate admission truth', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.prepare(admissionInput({ workspace: ws }));
  await journal.bindContext(ATTEMPT_A, 'a'.repeat(64), ['CONTEXT']);
  await Promise.all([journal.seal(ATTEMPT_A), journal.seal(ATTEMPT_A)]);
  const detail = await journal.get(ATTEMPT_A);
  assert.equal(detail?.integrity, 'OK');
  assert.equal(detail?.events.filter(event => event.event === 'ATTEMPT_SEALED').length, 1);
  assert.equal(detail?.events.filter(event => event.event === 'ATTEMPT_ADMITTED').length, 1);
});

test('admission persistence failure -> admit throws, nothing executed', async () => {
  const ws = await workspace();
  // Make the attempts path unwritable: a FILE where the directory must be.
  await fs.mkdir(path.join(ws, '.aide', 'admission'), { recursive: true });
  await fs.writeFile(path.join(ws, '.aide', 'admission', 'attempts'), 'blocking file', 'utf8');
  const journal = createAttemptJournal({ workspace: ws });
  await assert.rejects(() => journal.admit(admissionInput({ workspace: ws })));
  // No sealed envelope exists; the mutation guard cannot pass.
  const check = await journal.assertAdmitted(ATTEMPT_A);
  assert.equal(check.admitted, false);
});

test('duplicate attempt start -> deterministic distinct identities', async () => {
  const ws = await workspace();
  const ids = [ATTEMPT_A, ATTEMPT_B];
  let index = 0;
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ids[index++] ?? '33333333-3333-4333-8333-333333333333' });
  const first = await journal.admit(admissionInput({ workspace: ws }));
  const second = await journal.admit(admissionInput({ workspace: ws }));
  assert.notEqual(first.attempt_id, second.attempt_id);
  assert.equal((await journal.list()).total, 2);
});

test('same attempt envelope mutation attempted -> drift journaled, envelope unchanged', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.prepare(admissionInput({ workspace: ws }));
  const first = await journal.bindContext(ATTEMPT_A, 'a'.repeat(64), ['SKILL CONTEXT']);
  assert.equal(first.drift, false);
  await journal.seal(ATTEMPT_A);
  const second = await journal.bindContext(ATTEMPT_A, 'b'.repeat(64), ['SKILL CONTEXT', 'WORKSPACE CONTEXT']);
  assert.equal(second.drift, true);
  const detail = await journal.get(ATTEMPT_A);
  assert.equal(detail?.envelope.context_envelope.sha256, 'a'.repeat(64));
  assert.ok(detail?.events.some(event => event.event === 'CONTEXT_DRIFT'));
});

test('crash after admission, before execution -> RECOVERED_NOT_STARTED, safe to retry', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.admit(admissionInput({ workspace: ws }));
  const recovered = await journal.recover();
  assert.equal(recovered[0]?.classification, 'RECOVERED_NOT_STARTED');
  const detail = await journal.get(ATTEMPT_A);
  assert.equal(detail?.retry_safety, 'SAFE_TO_RETRY');
});

test('crash after mutation began, effect uncertain -> UNCERTAIN, retry BLOCKED', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.admit(admissionInput({ workspace: ws }));
  await journal.executionStarted(ATTEMPT_A);
  await journal.effectUncertain(ATTEMPT_A, { tool: 'replace_in_file', path: 'src/a.mjs', error: 'partial apply' });
  const recovered = await journal.recover();
  assert.equal(recovered[0]?.classification, 'RECOVERED_UNCERTAIN');
  const detail = await journal.get(ATTEMPT_A);
  assert.equal(detail?.retry_safety, 'UNCERTAIN_BLOCKED');
});

test('mutation observed without verification -> RECOVERED_MUTATED_UNVERIFIED, new attempt required', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.admit(admissionInput({ workspace: ws }));
  await journal.executionStarted(ATTEMPT_A);
  await journal.effectObserved(ATTEMPT_A, { tool: 'write_file', path: 'src/a.mjs', sha256: 'c'.repeat(64), bytes: 10 });
  await journal.recover();
  const detail = await journal.get(ATTEMPT_A);
  assert.equal(detail?.state, 'RECOVERED_MUTATED_UNVERIFIED');
  assert.equal(detail?.retry_safety, 'UNCERTAIN_BLOCKED');
});

test('wrong-attempt evidence isolation: attempt details only carry their own events', async () => {
  const ws = await workspace();
  const ids = [ATTEMPT_A, ATTEMPT_B];
  let index = 0;
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ids[index++] ?? ATTEMPT_A });
  await journal.admit(admissionInput({ workspace: ws }));
  await journal.admit(admissionInput({ workspace: ws }));
  await journal.executionStarted(ATTEMPT_B);
  await journal.effectObserved(ATTEMPT_B, { tool: 'write_file', path: 'src/b.mjs', sha256: 'd'.repeat(64), bytes: 4 });
  const detailA = await journal.get(ATTEMPT_A);
  assert.ok(detailA?.events.every(event => event.attempt_id === ATTEMPT_A));
  assert.ok(!detailA?.events.some(event => event.event === 'EFFECT_OBSERVED'));
  const detailB = await journal.get(ATTEMPT_B);
  assert.ok(detailB?.events.some(event => event.event === 'EFFECT_OBSERVED'));
});

test('secret safety: secrets in task and reasons are redacted before persistence', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.admit(admissionInput({
    workspace: ws,
    task: 'use key sk-supersecret12345678 and Authorization: Bearer abcdef123456 to call the API',
    resource_decision: { decision: 'START', reason: 'api_key=sk-anothersecret99 accepted' }
  }));
  await journal.recordEvent(ATTEMPT_A, 'COMMAND_OBSERVED', {
    output: 'Authorization: Bearer terminal-secret-123456789 and token=provider-secret-123456'
  }, 'harness');
  await journal.recordEvent(ATTEMPT_A, 'MODEL_RESPONSE_RECEIVED', {
    error: 'provider error: api_key=provider-secret-987654321'
  }, 'model-router');
  const raw = await fs.readFile(journal.journalPath, 'utf8');
  const envelopeRaw = await fs.readFile(path.join(journal.attemptsDir, `${ATTEMPT_A}.json`), 'utf8');
  for (const text of [raw, envelopeRaw]) {
    assert.ok(!text.includes('sk-supersecret12345678'));
    assert.ok(!text.includes('sk-anothersecret99'));
    assert.ok(!/Bearer abcdef123456/.test(text));
  }
  assert.match(redactSecrets('token=abc12345678'), /\[REDACTED\]/);
});

test('canonical event stream serializes concurrent observations with unique ordered cursors', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.admit(admissionInput({ workspace: ws }));
  await Promise.all(Array.from({ length: 12 }, (_, index) => journal.recordEvent(ATTEMPT_A, 'TOOL_OBSERVED', { index }, 'test')));
  const stream = await journal.stream(ATTEMPT_A, -1, 200);
  assert.ok(stream);
  assert.equal(stream.integrity, 'OK');
  const observed = stream.events.filter(event => event.event === 'TOOL_OBSERVED');
  assert.equal(observed.length, 12);
  assert.equal(new Set(observed.map(event => event.event_id)).size, observed.length);
  assert.ok(observed.every((event, index) => event.seq === index + 6));
});

test('out-of-order event stream is explicit and cannot authorize mutation', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  await journal.admit(admissionInput({ workspace: ws }));
  await writeRawJournal(ws, [
    { seq: 0, attempt_id: ATTEMPT_A, event: 'ATTEMPT_CREATED' },
    { seq: 1, attempt_id: ATTEMPT_A, event: 'ATTEMPT_ADMITTED' },
    { seq: 1, attempt_id: ATTEMPT_A, event: 'EXECUTION_STARTED' }
  ]);
  const stream = await journal.stream(ATTEMPT_A, -1, 200);
  assert.equal(stream?.integrity, 'OUT_OF_ORDER');
  const check = await journal.assertAdmitted(ATTEMPT_A);
  assert.equal(check.admitted, false);
  assert.match(check.reason, /integrity/);
});

test('performance: admission and durability checks are bounded (measured, not asserted as SLA)', async () => {
  const ws = await workspace();
  const journal = createAttemptJournal({ workspace: ws, idFactory: () => ATTEMPT_A });
  const admitStart = Date.now();
  await journal.admit(admissionInput({ workspace: ws }));
  const admitMs = Date.now() - admitStart;
  const checkStart = Date.now();
  const check = await journal.assertAdmitted(ATTEMPT_A);
  const checkMs = Date.now() - checkStart;
  assert.equal(check.admitted, true);
  console.log(JSON.stringify({ measured: { admit_ms: admitMs, assert_admitted_ms: checkMs } }));
  assert.ok(admitMs < 2000, `admission took ${admitMs}ms`);
  assert.ok(checkMs < 1000, `durability check took ${checkMs}ms`);
});

test('LIVE: end-to-end fail-closed — envelope tampered mid-session -> mutation DENIED, file untouched', async () => {
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'h3-live-'));
  await fs.mkdir(path.join(ws, 'src'), { recursive: true });
  await fs.writeFile(path.join(ws, 'src', 'math.mjs'), 'export function add(a, b) {\n  return a - b;\n}\n', 'utf8');
  const server = new ArchServer(ws, path.join(ws, 'arch.log'));
  let lane = 0;
  let tampered = false;
  const routes = await buildRoutes(ws, 'test', {
    authority: server.authority,
    events: server.events,
    agentChatFn: async () => {
      lane += 1;
      if (lane === 1) {
        // Tamper: delete the sealed envelope AFTER admission, before dispatch.
        const attemptsDir = path.join(ws, '.aide', 'admission', 'attempts');
        const files = await fs.readdir(attemptsDir).catch(() => [] as string[]);
        for (const file of files) await fs.rm(path.join(attemptsDir, file), { force: true }).catch(() => {});
        tampered = files.length > 0;
        return '<write_file>\n<path>src/math.mjs</path>\n<content>export function add(a, b) {\n  return a + b;\n}\n</content>\n</write_file>';
      }
      return '<attempt_completion><result>H3-LIVE-DONE</result></attempt_completion>';
    }
  });
  for (const route of routes) server.route(route);
  const http = await server.listen(0);
  const address = http.address() as { port: number };
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  try {
    const headers = await owner.approve('POST', '/api/agent/start', { task: 'h3 live tamper test', mode: 'act' }, 'h3-live-start');
    const start = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify({ task: 'h3 live tamper test', mode: 'act' }), signal: AbortSignal.timeout(120000) });
    const startBody = await start.json();
    assert.equal(start.status, 200);
    const sessionId = startBody.data.session_id as string;
    const deadline = Date.now() + 60000;
    let finalState = null;
    while (Date.now() < deadline) {
      const status = await owner.request(`/api/agent/status?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(30000) });
      const payload = await status.json();
      if (payload.data?.pending_approval?.approval_id) {
        const decisionBody = { session_id: sessionId, approval_id: payload.data.pending_approval.approval_id, decision: 'approve' };
        const decisionHeaders = await owner.approve('POST', '/api/agent/decision', decisionBody, `h3-tamper-decide-${String(payload.data.pending_approval.approval_id).slice(0, 8)}`);
        await owner.request('/api/agent/decision', { method: 'POST', headers: decisionHeaders, body: JSON.stringify(decisionBody), signal: AbortSignal.timeout(30000) });
        continue;
      }
      if (['done', 'error', 'aborted'].includes(payload.data?.state)) { finalState = payload.data.state; break; }
      await sleep(300);
    }
    assert.equal(tampered, true, 'the test must actually have tampered with the envelope');
    const file = await fs.readFile(path.join(ws, 'src', 'math.mjs'), 'utf8');
    assert.ok(file.includes('a - b'), 'the denied mutation must not have modified the file');
    assert.ok(['done', 'error', 'aborted'].includes(String(finalState)), `session must terminate honestly, got ${String(finalState)}`);
  } finally {
    http.closeAllConnections?.();
    await new Promise<void>(resolve => http.close(() => resolve()));
    server.events.close();
    await server.logger.flush();
  }
});

test('LIVE: real session seals a complete envelope, binds context, observes effects, feeds provenance', async () => {
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'h3-live-ok-'));
  await fs.mkdir(path.join(ws, 'src'), { recursive: true });
  await fs.writeFile(path.join(ws, 'src', 'math.mjs'), 'export function add(a, b) {\n  return a - b;\n}\n', 'utf8');
  const server = new ArchServer(ws, path.join(ws, 'arch.log'));
  let lane = 0;
  const routes = await buildRoutes(ws, 'test', {
    authority: server.authority,
    events: server.events,
    agentChatFn: async () => {
      lane += 1;
      if (lane === 1) return '<write_file>\n<path>src/math.mjs</path>\n<content>export function add(a, b) {\n  return a + b;\n}\n</content>\n</write_file>';
      return '<attempt_completion><result>H3-OK</result></attempt_completion>';
    }
  });
  for (const route of routes) server.route(route);
  const http = await server.listen(0);
  const address = http.address() as { port: number };
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  try {
    const payload = { task: 'h3 live happy path', mode: 'act', worker: { worker: 'local:auto', provider: 'local', model: 'auto', role: 'act' } };
    const headers = await owner.approve('POST', '/api/agent/start', payload, 'h3-ok-start');
    const start = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(120000) });
    const startBody = await start.json();
    const sessionId = startBody.data.session_id as string;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const status = await owner.request(`/api/agent/status?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(30000) });
      const payload = await status.json();
      if (payload.data?.pending_approval?.approval_id) {
        const decisionBody = { session_id: sessionId, approval_id: payload.data.pending_approval.approval_id, decision: 'approve' };
        const decisionHeaders = await owner.approve('POST', '/api/agent/decision', decisionBody, `h3-ok-decide-${String(payload.data.pending_approval.approval_id).slice(0, 8)}`);
        await owner.request('/api/agent/decision', { method: 'POST', headers: decisionHeaders, body: JSON.stringify(decisionBody), signal: AbortSignal.timeout(30000) });
        continue;
      }
      const state = payload.data?.state;
      if (['done', 'error', 'aborted'].includes(state)) break;
      await sleep(300);
    }
    const list = await (await owner.request('/api/harness/attempts', { signal: AbortSignal.timeout(30000) })).json();
    assert.equal(list.data.total, 1);
    const attemptId = list.data.attempts[0].attempt_id as string;
    assert.equal(list.data.attempts[0].sealed, true);
  const detail = await (await owner.request(`/api/harness/attempt?id=${encodeURIComponent(attemptId)}`, { signal: AbortSignal.timeout(30000) })).json();
    const events = (detail.data.events as Array<{ event: string }>).map(event => event.event);
    for (const required of ['ATTEMPT_CREATED', 'VALIDATION_COMPLETED', 'RESOURCE_ADMITTED', 'AUTHORITY_GRANTED', 'ATTEMPT_ADMITTED', 'EXECUTION_STARTED', 'CONTEXT_BOUND', 'EFFECT_OBSERVED', 'VERIFICATION_STARTED', 'ATTEMPT_COMPLETED']) {
      assert.ok(events.includes(required), `journal must contain ${required}`);
    }
    assert.equal(detail.data.envelope.worker_identity, 'local:auto');
    assert.equal(detail.data.envelope.resource_admission.decision, 'START');
    assert.match(String(detail.data.envelope.context_envelope.sha256), /^[0-9a-f]{64}$/);
    assert.ok(detail.data.envelope.context_envelope.blocks.length >= 1);
    assert.equal(detail.data.retry_safety, 'NEW_ATTEMPT_REQUIRED');
    assert.equal(detail.data.integrity, 'OK');
    const detailedEvents = detail.data.events as Array<{ event_id: string; seq: number; mission_id: string; project_id: string; source: string; redacted: boolean }>;
    assert.equal(new Set(detailedEvents.map(event => event.event_id)).size, detailedEvents.length);
    assert.ok(detailedEvents.every((event, index) => event.seq === index));
    assert.ok(detailedEvents.every(event => event.mission_id === sessionId && event.project_id === ws && event.redacted === true));
    assert.ok(detailedEvents.every(event => event.mission_id !== attemptId));
    const firstPage = await (await owner.request(`/api/harness/attempt/events?id=${encodeURIComponent(attemptId)}&limit=5`, { signal: AbortSignal.timeout(30000) })).json();
    assert.ok(firstPage.data, JSON.stringify(firstPage));
    assert.equal(firstPage.data.integrity, 'OK');
    assert.equal(firstPage.data.events.length, 5);
    const secondPage = await (await owner.request(`/api/harness/attempt/events?id=${encodeURIComponent(attemptId)}&after=${firstPage.data.next_after}&limit=200`, { signal: AbortSignal.timeout(30000) })).json();
    const streamed = [...firstPage.data.events, ...secondPage.data.events];
    assert.equal(new Set(streamed.map(event => event.event_id)).size, streamed.length);
    assert.deepEqual(streamed.map(event => event.event_id), detailedEvents.map(event => event.event_id));
    const runs = await (await owner.request('/api/provenance/runs', { signal: AbortSignal.timeout(30000) })).json();
    assert.equal(runs.data.runs[0].attempt_id, attemptId);
  } finally {
    http.closeAllConnections?.();
    await new Promise<void>(resolve => http.close(() => resolve()));
    server.events.close();
    await server.logger.flush();
  }
});
