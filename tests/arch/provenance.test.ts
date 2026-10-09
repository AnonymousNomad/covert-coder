// Provenance Ledger + Mission Receipt battery.
// Controls that matter:
// - strict observation: unknown fields (chain-of-thought/transcript attempts)
//   are REJECTED — nothing hidden ever enters the ledger.
// - corrupt ledger lines never break reads (counted, not trusted).
// - the receipt never overclaims: every recorded run must complete with
//   verified evidence before the receipt supports a mission-level conclusion.
// - Route-backed integration (stub model): agent session finalization appends
//   one run through the loop hook, and the routes project it across restart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProvenanceLedger } from '../../node/src/services/provenance-ledger.ts';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';
import { launchSupervisedStack } from '../helpers/supervised-stack.mjs';
const { buildRoutes } = await import('../../node/src/openapi.ts');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function closeArchServer(server: ArchServer, http?: Awaited<ReturnType<ArchServer['listen']>>): Promise<void> {
  if (http !== undefined) {
    http.closeAllConnections?.();
    await new Promise<void>(resolve => http.close(() => resolve()));
  }
  server.events.close();
  await server.logger.flush();
}

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

test('INTEGRATION (fixture-backed): agent finalization persists a receipt across server restart', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-live-'));
  const server = new ArchServer(workspace, path.join(workspace, 'arch.log'));
  let lane = 0;
  let originalClosed = false;
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
    const startPayload = { task: 'provenance live run', mode: 'act', worker: { worker: 'local:auto', provider: 'local', model: 'auto', role: 'act' } };
    const headers = await owner.approve('POST', '/api/agent/start', startPayload, 'prov-start');
    const start = await owner.request('/api/agent/start', { method: 'POST', headers, body: JSON.stringify(startPayload), signal: AbortSignal.timeout(120000) });
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
    const runRecord = receipt.data.runs[0];
    const attemptId = runRecord.attempt_id as string;
    assert.equal(runRecord.attempt_event_stream_ref, `attempt:${attemptId}`);
    const journal = (await fs.readFile(path.join(workspace, '.aide', 'admission', 'journal.jsonl'), 'utf8'))
      .trim().split(String.fromCharCode(10)).map(line => JSON.parse(line));
    const timeline = journal.filter(event => event.attempt_id === attemptId);
    const provenanceRecorded = timeline.find(event => event.event === 'PROVENANCE_RECORDED');
    const terminalEvent = timeline.find(event => ['ATTEMPT_ACCEPTED', 'ATTEMPT_REJECTED', 'ATTEMPT_FAILED', 'ATTEMPT_ABORTED'].includes(event.event));
    const receiptReadyEvents = timeline.filter(event => event.event === 'MISSION_RECEIPT_READY');
    assert.equal(receiptReadyEvents.length, 1, 'the attempt timeline must publish exactly one canonical receipt-ready event');
    const receiptReady = receiptReadyEvents[0];
    assert.ok(provenanceRecorded);
    assert.ok(terminalEvent);
    assert.ok(terminalEvent.seq < receiptReady.seq, 'receipt readiness must follow a terminal attempt event');
    assert.equal(receiptReady.mission_id, receipt.data.mission_id);
    assert.equal(receiptReady.attempt_id, attemptId);
    assert.ok(provenanceRecorded.seq < receiptReady.seq, 'receipt readiness must follow provenance persistence');
    assert.equal(receiptReady.data.run_id, sessionId);
    assert.equal(receiptReady.data.evidence_file, runRecord.evidence_file);
    assert.equal(receiptReady.data.trajectory_file, runRecord.trajectory_file);
    assert.equal(receiptReady.data.verification_state, runRecord.verification_state);

    const canonicalReceiptBeforeRestart = {
      mission_id: receipt.data.mission_id,
      workspace: receipt.data.workspace,
      runs: receipt.data.runs,
      handoffs: receipt.data.handoffs,
      verification: receipt.data.verification,
      supported_conclusion: receipt.data.supported_conclusion,
      limitations: receipt.data.limitations,
      evidence_refs: receipt.data.evidence_refs
    };
    const attemptPath = '/api/harness/attempt?id=' + encodeURIComponent(attemptId);
    const attemptEventsPath = '/api/harness/attempt/events?id=' + encodeURIComponent(attemptId);
    const eventsBeforeRestart = await (await owner.request(attemptEventsPath)).json();
    assert.equal(eventsBeforeRestart.data.terminal, true);
    const attemptBeforeRestart = await (await owner.request(attemptPath)).json();
    await closeArchServer(server, http);
    originalClosed = true;

    // Recreate the server services over the same workspace. The receipt and
    // attempt stream must come from disk without replaying the agent session.
    const restartedServer = new ArchServer(workspace, path.join(workspace, 'arch-restarted.log'));
    let restartedHttp: Awaited<ReturnType<ArchServer['listen']>> | undefined;
    let replayedChatCalls = 0;
    try {
      const restartedRoutes = await buildRoutes(workspace, 'test', {
        authority: restartedServer.authority,
        events: restartedServer.events,
        modelRuntime: {
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
          replayedChatCalls += 1;
          return '';
        }
      });
      for (const route of restartedRoutes) restartedServer.route(route);
      restartedHttp = await restartedServer.listen(0);
      const restartedAddress = restartedHttp.address() as { port: number };
      const restartedOwner = await pairFixture(restartedServer, 'http://127.0.0.1:' + restartedAddress.port);

      const recoveredReceipt = await (await restartedOwner.request(
        '/api/mission/receipt?id=' + encodeURIComponent(sessionId)
      )).json();
      assert.deepEqual({
        mission_id: recoveredReceipt.data.mission_id,
        workspace: recoveredReceipt.data.workspace,
        runs: recoveredReceipt.data.runs,
        handoffs: recoveredReceipt.data.handoffs,
        verification: recoveredReceipt.data.verification,
        supported_conclusion: recoveredReceipt.data.supported_conclusion,
        limitations: recoveredReceipt.data.limitations,
        evidence_refs: recoveredReceipt.data.evidence_refs
      }, canonicalReceiptBeforeRestart);
      assert.equal(recoveredReceipt.data.supported_conclusion, null, 'restart does not turn unavailable verification into success');

      const recoveredAttemptEvents = await (await restartedOwner.request(attemptEventsPath)).json();
      const recoveredAttempt = await (await restartedOwner.request(attemptPath)).json();
      assert.deepEqual(recoveredAttemptEvents.data, eventsBeforeRestart.data, 'the durable attempt stream is unchanged after service reconstruction');
      assert.equal(recoveredAttempt.data.state, attemptBeforeRestart.data.state);
      assert.deepEqual(recoveredAttempt.data.events, attemptBeforeRestart.data.events);
      assert.equal(replayedChatCalls, 0, 'receipt recovery does not replay the completed agent session');
    } finally {
      await closeArchServer(restartedServer, restartedHttp);
    }
  } finally {
    if (!originalClosed) await closeArchServer(server, http);
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('INTEGRATION (real process restart, fixture receipt): durable receipt content survives child restart', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-process-restart-'));
  const missionId = 'process-restart-mission';
  const ledger = createProvenanceLedger({ workspace });
  await ledger.record(run({ run_id: missionId, task_id: missionId, verification_state: 'unavailable' }));
  const launch = () => launchSupervisedStack({ workspace, env: {
    AIDE_ARCH_PORT: '0', AIDE_DAEMON_PORT: '0', AIDE_LEGACY_PORT: '0', AIDE_EMBEDDINGS_URL: ''
  } });
  let stack: Awaited<ReturnType<typeof launchSupervisedStack>> | undefined;
  try {
    stack = await launch();
    const first = await stack.json('facade', 'GET', `/api/mission/receipt?id=${encodeURIComponent(missionId)}`);
    assert.equal(first.status, 200);
    assert.equal(first.body.ok, true);
    const firstReceipt = first.body.data as Record<string, unknown>;
    assert.equal((firstReceipt.runs as unknown[]).length, 1);
    assert.equal(firstReceipt.supported_conclusion, null);
    const firstRecordedAt = Date.parse(String(firstReceipt.recorded_at));
    assert.ok(Number.isFinite(firstRecordedAt), 'receipt projection must include a valid read-time timestamp');
    await stack.close();
    stack = undefined;

    stack = await launch();
    const recovered = await stack.json('facade', 'GET', `/api/mission/receipt?id=${encodeURIComponent(missionId)}`);
    assert.equal(recovered.status, 200);
    const recoveredReceipt = recovered.body.data as Record<string, unknown>;
    const firstDurableContent = Object.fromEntries(Object.entries(firstReceipt).filter(([key]) => key !== 'recorded_at'));
    const recoveredDurableContent = Object.fromEntries(Object.entries(recoveredReceipt).filter(([key]) => key !== 'recorded_at'));
    assert.deepEqual(recoveredDurableContent, firstDurableContent,
      'a fresh supervised child process must read the same durable mission, run, verification, and evidence content');
    assert.ok(Date.parse(String(recoveredReceipt.recorded_at)) >= firstRecordedAt,
      'recorded_at is generated for each receipt projection and must not move backwards across restart');
    assert.equal(recoveredReceipt.supported_conclusion, null,
      'process restart must not turn unavailable verification into success');
  } finally {
    await stack?.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('receipt with mixed run outcomes does not claim mission-wide verified completion', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'prov-mixed-'));
  const ledger = createProvenanceLedger({ workspace });
  await ledger.record(run({ run_id: 'mixed-ok', task_id: 'mixed-mission', verification_state: 'verified' }));
  await ledger.record(run({ run_id: 'mixed-failed', task_id: 'mixed-mission', result: 'error', error: 'worker failed', verification_state: 'failed' }));
  const receipt = await ledger.receipt('mixed-mission');
  assert.equal(receipt.supported_conclusion, null);
  assert.ok(receipt.limitations.some(limitation => /not every recorded run completed with verified evidence/.test(limitation)));
});
