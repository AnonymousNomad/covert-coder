// tests/arch/model-passport.test.ts
// Model Passport is a DERIVED projection: counts, rates, and medians over the
// exact events that produced them. These tests pin the no-fake-scores laws:
// insufficient evidence is labeled, distinct configurations are distinct
// identities, and nothing ever declares a universal best model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  derivePassport,
  derivePassports,
  evidenceConfidence,
  readPassports,
  writePassports
} from '../../node/src/services/model-passport.ts';
import { createPerformanceLedger } from '../../node/src/services/performance-ledger.ts';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeEvent } from './performance-fixture.ts';

test('confidence labels are mechanical, never invented', () => {
  assert.equal(evidenceConfidence(0), 'INSUFFICIENT');
  assert.equal(evidenceConfidence(1), 'LOW');
  assert.equal(evidenceConfidence(2), 'LOW');
  assert.equal(evidenceConfidence(3), 'MODERATE');
  assert.equal(evidenceConfidence(7), 'MODERATE');
  assert.equal(evidenceConfidence(8), 'HIGH');
});

test('passport reports counts, rates and medians from observations only', () => {
  const events = [
    makeEvent({ taskId: 'a', completed: true, durationMs: 1000, outputTokens: 10 }),
    makeEvent({ taskId: 'b', completed: true, durationMs: 3000, outputTokens: 30 }),
    makeEvent({ taskId: 'c', completed: false, failureClass: 'verification_failed', durationMs: 2000, outputTokens: null }),
    makeEvent({ taskId: 'd', completed: true, durationMs: 5000, outputTokens: 50 })
  ];
  const passport = derivePassport(events);
  assert.ok(passport);
  assert.equal(passport.evidence.sample_size, 4);
  assert.equal(passport.evidence.evidence_confidence, 'MODERATE');
  assert.equal(passport.outcome.completed, 3);
  assert.equal(passport.outcome.failed, 1);
  assert.equal(passport.outcome.completion_rate, 0.75);
  assert.equal(passport.execution.median_duration_ms, 2500);
  assert.equal(passport.execution.median_output_tokens, 30);
  assert.ok(passport.failure_classes.some(entry => entry.failure_class === 'verification_failed' && entry.count === 1));
  assert.ok(!('score' in passport) && !('best' in passport) && !('intelligence' in passport), 'no invented quality fields exist');
});

test('insufficient data is labeled, not fabricated', () => {
  assert.equal(derivePassport([]), null);
  const single = derivePassport([makeEvent({ completed: true, durationMs: 900 })]);
  assert.ok(single);
  assert.equal(single.evidence.sample_size, 1);
  assert.equal(single.evidence.evidence_confidence, 'LOW');
  assert.equal(single.insufficient_data, false);
  assert.ok(single.notes.some(note => note.includes('insufficient sample')));
});

test('distinct configurations are distinct performance identities', () => {
  const base = makeEvent({ modelId: 'model-x', quantization: 'Q4_K_M', artifactHash: 'b'.repeat(64), configuredContext: 2048 });
  const differentQuant = makeEvent({ modelId: 'model-x', quantization: 'Q8_0', artifactHash: 'c'.repeat(64), configuredContext: 2048 });
  const differentContext = makeEvent({ modelId: 'model-x', quantization: 'Q4_K_M', artifactHash: 'b'.repeat(64), configuredContext: 4096 });
  const passports = derivePassports([base, differentQuant, differentContext]);
  assert.equal(passports.length, 3, 'quant, hash and context are never blended');
  const identities = passports.map(passport => passport.performance_identity);
  assert.equal(new Set(identities).size, 3);
  for (const passport of passports) assert.equal(passport.evidence.sample_size, 1);
});

test('workflow, skill and mode associations are recorded per identity', () => {
  const events = [
    makeEvent({ workflowId: 'harness-baseline-v1', workflowVersion: '1.0', skillIds: ['developer-discipline'], modeId: 'software-engineering', taskClass: 'bug-repair' }),
    makeEvent({ workflowId: 'harness-baseline-v1', workflowVersion: '1.0', skillIds: ['dap-enhancement'], modeId: 'software-engineering', taskClass: 'terminal' }),
    makeEvent({ workflowId: 'harness-baseline-v1', workflowVersion: '1.0', skillIds: ['developer-discipline'], modeId: 'web-production', taskClass: 'bug-repair' })
  ];
  const passport = derivePassport(events);
  assert.ok(passport);
  assert.deepEqual(passport.evidence.skill_ids, ['dap-enhancement', 'developer-discipline']);
  assert.deepEqual(passport.evidence.mode_ids, ['software-engineering', 'web-production']);
  assert.equal(passport.by_task_class.length, 2);
  assert.equal(passport.by_workflow.length, 1);
  assert.equal(passport.by_mode.length, 2);
  const bugRepair = passport.by_task_class.find(entry => entry.task_class === 'bug-repair');
  assert.equal(bugRepair?.sample_size, 2);
});

test('passports persist atomically and survive a re-read', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-passport-'));
  try {
    const ledger = createPerformanceLedger({ root });
    await ledger.append(makeEvent({ modelId: 'model-a' }));
    await ledger.append(makeEvent({ modelId: 'model-b' }));
    const { events } = await ledger.read();
    const passports = derivePassports(events);
    await writePassports(root, passports);
    const reloaded = await readPassports(root);
    assert.equal(reloaded.passports.length, 2);
    assert.deepEqual(reloaded.passports.map(passport => passport.identity.model_id).sort(), ['model-a', 'model-b']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
