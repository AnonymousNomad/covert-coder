// Provenance Ledger + Mission Receipt battery.
// Controls that matter:
// - strict observation: unknown fields (chain-of-thought/transcript attempts)
//   are REJECTED — nothing hidden ever enters the ledger.
// - corrupt ledger lines never break reads (counted, not trusted).
// - the receipt never fabricates: absent truth = 'not_recorded' + limitation;
//   a verified run yields the supported conclusion.
// - LIVE wiring: a real agent session finalize appends one run through the loop
//   hook, and the reads project it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProvenanceLedger } from '../../node/src/services/provenance-ledger.ts';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
const { buildRoutes } = await import('../../node/src/openapi.ts');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function run(overrides: Record<string, unknown> = {}) {
  return {
    run_id: 'run-1', task_id: 'run-1', task: 'bounded fixture task', mode: 'act',
    worker: null, handoff_id: null, chat_source: null, result: 'done', error: null,
    verification_state: 'unavailable', evidence_file: null, trajectory_file: null,
    iterations: 3, started_at: '2026-09-23T00:00:00.000Z', finished_at: '2026-09-23T00:01:00.000Z',
    ...overrides
  };
}

test('record then get returns the exact validated run', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-'));
  const ledger = createProvenanceLedger({ workspace });
  await ledger.record(run());
  const got = await ledger.get('run-1');
  assert.equal(got?.run_id, 'run-1');
  assert.equal(got?.result, 'done');
});

test('strict: unknown fields (transcript/CoT attempts) are rejected', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-'));
  const ledger = createProvenanceLedger({ workspace });
  await assert.rejects(() => ledger.record(run({ transcript: [{ role: 'assistant', content: 'hidden reasoning' }] })));
  await assert.rejects(() => ledger.record(run({ chain_of_thought: 'secret' })));
});

test('list is newest-first and counts corrupt lines without trusting them', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-'));
  const ledger = createProvenanceLedger({ workspace });
  await ledger.record(run({ run_id: 'old', task_id: 'old' }));
  await ledger.record(run({ run_id: 'new', task_id: 'new' }));
  await fs.appendFile(ledger.ledgerPath, 'this is not json\n', 'utf8');
  const listed = await ledger.list(10);
  assert.equal(listed.runs[0]?.run_id, 'new');
  assert.equal(listed.runs[1]?.run_id, 'old');
  assert.equal(listed.corrupt_lines, 1);
  assert.equal(listed.total, 2);
});

test('receipt of an unknown mission never fabricates', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-'));
  const ledger = createProvenanceLedger({ workspace });
  const receipt = await ledger.receipt('missing-mission');
  assert.equal(receipt.verification, 'not_recorded');
  assert.equal(receipt.supported_conclusion, null);
  assert.ok(receipt.limitations.some(limitation => /no provenance runs/.test(limitation)));
});

test('receipt: verified run yields supported conclusion; unverified adds limitation', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-'));
  const ledger = createProvenanceLedger({ workspace });
  await ledger.record(run({ run_id: 'm1', task_id: 'm1', verification_state: 'verified', evidence_file: '.aide/verifications/m1.verification.json' }));
  const verified = await ledger.receipt('m1');
  assert.equal(verified.verification, 'verified');
  assert.match(String(verified.supported_conclusion), /verified evidence/);
  assert.ok(verified.evidence_refs.includes('.aide/verifications/m1.verification.json'));
  await ledger.record(run({ run_id: 'm2', task_id: 'm2', verification_state: 'incomplete' }));
  const incomplete = await ledger.receipt('m2');
  assert.equal(incomplete.supported_conclusion, null);
  assert.ok(incomplete.limitations.some(limitation => /no run reached verified/.test(limitation)));
});

test('receipt projects canonical handoffs for the mission', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-'));
  const ledger = createProvenanceLedger({ workspace });
  await ledger.record(run({ run_id: 'h-mission', task_id: 'h-mission' }));
  await fs.mkdir(path.join(workspace, '.aide', 'worker-handoffs'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'worker-handoffs', 'h1.json'), JSON.stringify({
    handoff_id: '11111111-2222-3333-4444-555555555555', state: 'CONSUMED', task_id: 'h-mission',
    from: { worker: 'local:auto' }, to: { worker: 'opencode-go/deepseek-v4.1-flash' }, objective: 'continue'
  }), 'utf8');
  const receipt = await ledger.receipt('h-mission');
  assert.equal(receipt.handoffs.length, 1);
  assert.equal(receipt.handoffs[0]?.from, 'local:auto');
  assert.equal(receipt.handoffs[0]?.to, 'opencode-go/deepseek-v4.1-flash');
});

test('LIVE: agent session finalize appends one run and the routes project it', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-live-'));
  const server = new ArchServer(workspace, path.join(workspace, 'arch.log'));
  let lane = 0;
  const routes = await buildRoutes(workspace, 'test', {
    authority: server.authority,
    events: server.events,
    modelRuntime: {
      // Deterministic loop stub; the runtime surface used by these paths is narrow.
      list: () => [{ id: 'stub', name: 'Stub', endpoint: 'http://127.0.0.1:9/v1', model: 'stub', context_tokens: 8192, roles: ['chat', 'act'] }],
      status: async () => ({ models: [{ id: 'stub', status: 'running' }] }),
      verifyEndpointModel: async () => ({ ready: true }),
      getEffectiveContext: () => 8192,
      getEffectiveBudget: () => 8192 - 512,
      refreshServedContext: async () => undefined,
      chat: async () => ({ text: '', modelId: 'stub', timingMs: 1 }),
      chatStream: async () => ({ modelId: 'stub', usedApprox: 1, dropped: 0, truncatedSystem: false, timingMs: 1 })
    } as never,
    agentChatFn: async () => {
      lane += 1;
      return lane === 1 ? '<attempt_completion><result>PROV-DONE</result></attempt_completion>' : '';
    }
  });
  for (const route of routes) server.route(route);
  const http = await server.listen(0);
  const address = http.address() as { port: number };
  const owner = await pairFixture(server, `http://127.0.0.1:${address.port}`);
  try {
    const startBody = { task: 'provenance live run', mode: 'act', worker: { worker: 'local:auto', provider: 'local', model: 'auto', role: 'act' } };
    const headers = await owner.approve('POST', '/api/agent/start', startBody, 'prov-start');
    const start = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(startBody), signal: AbortSignal.timeout(120000) });
    const startBody = await start.json();
    assert.equal(start.status, 200);
    const sessionId = startBody.data.session_id as string;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const status = await owner.request(`/api/agent/status?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(30000) });
      const payload = await status.json();
      if (['done', 'error', 'aborted'].includes(payload.data?.state)) break;
      await sleep(300);
    }
    const listed = await (await owner.request('/api/provenance/runs', { signal: AbortSignal.timeout(30000) })).json();
    assert.equal(listed.data.runs.length, 1);
    assert.equal(listed.data.runs[0].run_id, sessionId);
    assert.equal(listed.data.runs[0].result, 'done');
    // Worker objects normalize to the descriptor's worker string (regression:
    // an object here previously failed the strict contract and the run was
    // silently dropped into evidence errors).
    assert.equal(listed.data.runs[0].worker, 'local:auto');
    const receipt = await (await owner.request(`/api/mission/receipt?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(30000) })).json();
    assert.equal(receipt.data.runs.length, 1);
    assert.ok(['failed', 'incomplete', 'unavailable', 'errored'].includes(receipt.data.verification));
    const single = await (await owner.request(`/api/provenance/run?id=${encodeURIComponent(sessionId)}`, { signal: AbortSignal.timeout(30000) })).json();
    assert.equal(single.data.run.task, 'provenance live run');
  } finally {
    http.closeAllConnections?.();
    await new Promise<void>(resolve => http.close(() => resolve()));
    server.events.close();
    await server.logger.flush();
  }
});
