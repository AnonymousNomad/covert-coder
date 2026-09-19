// tests/arch/performance-ledger.test.ts
// Harness Lab ledger: append/restart persistence, integrity chain detection,
// strict privacy rejection (unknown fields, secret-shape content), bounded
// queries. The ledger stores observations only — these tests are the
// adversarial guard that raw prompts, reasoning, or credentials can never be
// persisted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createPerformanceLedger,
  chainHash,
  LedgerIntegrityError,
  LedgerSecurityError,
  performanceIdentity
} from '../../node/src/services/performance-ledger.ts';
import { makeEvent } from './performance-fixture.ts';

async function tempRoot(label: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `aide-${label}-`));
}

test('append, chain, and restart persistence', async () => {
  const root = await tempRoot('ledger');
  try {
    const ledger = createPerformanceLedger({ root });
    const first = await ledger.append(makeEvent({ taskId: 't1' }));
    const second = await ledger.append(makeEvent({ taskId: 't2' }));
    assert.equal(first.chain.seq, 0);
    assert.equal(second.chain.seq, 1);
    assert.equal(second.chain.prev_hash, first.chain.hash);

    const restarted = createPerformanceLedger({ root });
    const third = await restarted.append(makeEvent({ taskId: 't3' }));
    assert.equal(third.chain.seq, 2);
    assert.equal(third.chain.prev_hash, second.chain.hash);

    const { events, issues } = await restarted.read();
    assert.deepEqual(issues, []);
    assert.equal(events.length, 3);
    assert.deepEqual(events.map(record => record.chain.seq), [0, 1, 2]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('tampering is detected (hash mismatch) and readStrict fails closed', async () => {
  const root = await tempRoot('ledger-tamper');
  try {
    const ledger = createPerformanceLedger({ root });
    await ledger.append(makeEvent({ taskId: 't1' }));
    await ledger.append(makeEvent({ taskId: 't2' }));
    const raw = await fs.readFile(ledger.file, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const record = JSON.parse(lines[1]!) as { model: { model_id: string } };
    record.model.model_id = 'tampered-model';
    lines[1] = JSON.stringify(record);
    await fs.writeFile(ledger.file, `${lines.join('\n')}\n`, 'utf8');

    const { events, issues } = await ledger.read();
    assert.equal(events.length, 2, 'no event was deleted by detection');
    assert.ok(issues.some(issue => issue.kind === 'hash-mismatch'), `expected hash-mismatch, got ${JSON.stringify(issues)}`);
    await assert.rejects(() => ledger.readStrict(), (error: unknown) => error instanceof LedgerIntegrityError);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('malformed lines are reported without losing valid history', async () => {
  const root = await tempRoot('ledger-corrupt');
  try {
    const ledger = createPerformanceLedger({ root });
    await ledger.append(makeEvent({ taskId: 't1' }));
    await fs.appendFile(ledger.file, '{"not": "an event"}\n', 'utf8');
    const { events, issues } = await ledger.read();
    assert.equal(events.length, 1);
    assert.ok(issues.some(issue => issue.kind === 'schema-invalid'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('secret-shaped content is rejected and never echoed', async () => {
  const root = await tempRoot('ledger-secret');
  const sentinel = 'sk-abcdefghijklmnopqrstuvwx12';
  try {
    const ledger = createPerformanceLedger({ root });
    await assert.rejects(
      () => ledger.append(makeEvent({ modelVersion: `leak ${sentinel}` })),
      (error: unknown) => {
        assert.ok(error instanceof LedgerSecurityError);
        assert.ok(!String((error as Error).message).includes(sentinel), 'error must not echo the secret material');
        return true;
      }
    );
    const raw = await fs.readFile(ledger.file, 'utf8').catch(() => '');
    assert.ok(!raw.includes(sentinel), 'nothing was persisted');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('unknown fields (raw prompts, keys, reasoning) are rejected by the strict schema', async () => {
  const root = await tempRoot('ledger-strict');
  try {
    const ledger = createPerformanceLedger({ root });
    const withPrompt = { ...makeEvent(), prompt: 'raw prompt text must never persist' };
    await assert.rejects(() => ledger.append(withPrompt as never), /rejected/);
    const withKey = { ...makeEvent(), api_key: 'redacted' };
    await assert.rejects(() => ledger.append(withKey as never), /rejected/);
    const badNested = makeEvent();
    (badNested as unknown as Record<string, unknown>).reasoning = 'chain of thought';
    await assert.rejects(() => ledger.append(badNested), /rejected/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('v1.0 history remains readable and hash-verified beside v1.1 records', async () => {
  const root = await tempRoot('ledger-legacy');
  try {
    const ledger = createPerformanceLedger({ root });
    await ledger.append(makeEvent({ taskId: 'modern' }));
    const legacyEvent = {
      schema_version: '1.0',
      event_id: 'legacy-1',
      run: { run_id: 'r', task_id: 'legacy', timestamp: '2026-09-19T10:00:00.000Z', covert_sha: '600b91c', harness_version: '2.1.0' },
      model: { model_id: 'legacy-model', provider: 'local', runtime: 'llama-server', model_version: 'x', artifact_hash: 'a'.repeat(64), quantization: 'Q8_0', configured_context: 2048 },
      machine: { hardware_profile_id: 'm' },
      operating_mode: { mode_id: 'software-engineering' },
      methodology: { workflow_id: 'harness-baseline-v1', workflow_version: '1.0', skill_ids: [], sop_ids: [] },
      task: { benchmark_suite: 'harness-baseline-v1', benchmark_task_id: 'legacy', task_class: 'bug-repair' },
      execution: { attempts: 1, tool_calls: 0, tool_failures: 0, retries: 0, escalations: 0, authority_requests: 1, duration_ms: 10, time_to_first_token_ms: null, input_tokens: null, output_tokens: null, peak_ram_mb: null, peak_vram_mb: null },
      verification: { deterministic_checks: { passed: 1, failed: 0 }, tests_passed: 0, tests_failed: 0, veritas_verdict: null, evidence_refs: [] },
      outcome: { completed: true, first_attempt_success: true, fallback_required: false, failure_class: null },
      provenance: { ghost_ref: null }
    };
    const previousHash = (await ledger.read()).events[0]!.chain.hash;
    const legacyRecord = { ...legacyEvent, chain: { seq: 1, prev_hash: previousHash, hash: chainHash(previousHash, legacyEvent as never) } };
    await fs.appendFile(ledger.file, `${JSON.stringify(legacyRecord)}\n`, 'utf8');

    const { events, issues } = await ledger.read();
    assert.deepEqual(issues, []);
    assert.equal(events.length, 2);
    assert.equal(events[1]!.schema_version, '1.0');
    assert.equal(events[0]!.schema_version, '1.1');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('query filters and bounded reads', async () => {
  const root = await tempRoot('ledger-query');
  try {
    const ledger = createPerformanceLedger({ root });
    for (let index = 0; index < 5; index++) {
      await ledger.append(makeEvent({
        taskId: `t${index}`,
        modelId: index % 2 === 0 ? 'model-a' : 'model-b',
        taskClass: index < 3 ? 'bug-repair' : 'terminal',
        skillIds: index === 0 ? ['developer-discipline'] : [],
        modeId: index === 4 ? 'web-production' : 'software-engineering',
        timestamp: `2026-09-19T12:0${index}:00.000Z`
      }));
    }
    assert.equal((await ledger.query({ model_id: 'model-a' })).total_matched, 3);
    assert.equal((await ledger.query({ task_class: 'bug-repair' })).total_matched, 3);
    assert.equal((await ledger.query({ skill_id: 'developer-discipline' })).total_matched, 1);
    assert.equal((await ledger.query({ mode_id: 'web-production' })).total_matched, 1);
    assert.equal((await ledger.query({ since: '2026-09-19T12:03:00.000Z' })).total_matched, 2);
    const bounded = await ledger.query({ limit: 2 });
    assert.equal(bounded.events.length, 2);
    assert.equal(bounded.total_matched, 5);
    assert.equal(bounded.bounded, true);
    const identity = performanceIdentity(makeEvent({ modelId: 'model-a' }).model);
    assert.equal((await ledger.query({ performance_identity: identity })).total_matched, 3);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
