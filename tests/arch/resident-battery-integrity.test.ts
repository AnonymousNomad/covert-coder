// Resident battery integrity tests (MISSIONS 8/14): benchmark-leakage defense and
// the deterministic failure classifier against known historical failures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTaskMessage } from '../../experiments/resident-orchestration/battery/context.mjs';
import { classifyFailure, TAXONOMY } from '../../experiments/resident-orchestration/battery/classify.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const batteryDir = path.join(repoRoot, 'experiments', 'resident-orchestration', 'battery');

test('leakage defense — task messages never contain evaluation truth', async () => {
  const raw = await fs.readFile(path.join(batteryDir, 'TASKS.json'), 'utf8');
  const battery = JSON.parse(raw);
  // Neutral base: the canonical truth is the Resident's legitimate knowledge;
  // leakage is about the PROMPT/DISCOVERY inputs, so isolate them here.
  const base = '[CANONICAL PROJECT STATE]\n<canonical truth is supplied at runtime>';
  const sop = 'relevant_procedures: <selected deterministically from the prompt>';
  for (const task of battery.tasks) {
    const message = buildTaskMessage(base, sop, task.prompt);
    assert.ok(!message.includes('expect'), `${task.id}: expect field leaked`);
    for (const [key, value] of Object.entries(task.expect)) {
      if (!task.prompt.includes(key)) assert.ok(!message.includes(key), `${task.id}: expect key ${key} leaked`);
      if (typeof value === 'string') assert.ok(!message.includes(value), `${task.id}: expect value leaked`);
      if (Array.isArray(value)) for (const item of value) {
        if (typeof item === 'string' && !task.prompt.includes(item)) assert.ok(!message.includes(item), `${task.id}: expect item ${item} leaked`);
      }
    }
    for (const hint of ['checks', 'scoring', 'expected', 'scoreTask', 'passed:']) {
      if (!task.prompt.includes(hint)) assert.ok(!message.includes(hint), `${task.id}: scorer hint ${hint} leaked`);
    }
  }
  // The battery is frozen and tasks carry the required eight classes.
  assert.equal(battery.frozen, true);
  const classes = new Set(battery.tasks.map((t: { class: string }) => t.class));
  for (const required of ['DISCOVERY RECALL', 'CAPABILITY SELECTION', 'SCHEMA VALIDITY', 'ARGUMENT CORRECTNESS', 'UNNECESSARY CLARIFICATION', 'INVENTED CAPABILITY', 'AUTHORITY COMPLIANCE', 'EVIDENCE INTERPRETATION']) {
    assert.ok(classes.has(required), `missing class ${required}`);
  }
});

test('failure classifier — known historical failures map to the taxonomy', () => {
  assert.equal(TAXONOMY.length, 13);
  const cases = [
    { kind: 'engine-leak', detail: 'llama-server orphan survived stack close; taskkill needed', expect: 'RUNTIME_RESOURCE' },
    { kind: 'ram-guard', detail: 'not enough free RAM to start a model: 1919 MB free', expect: 'RUNTIME_RESOURCE' },
    { kind: 'chat-403', detail: 'capability has no authority policy', expect: 'ADAPTER' },
    { kind: 'stream-parity', detail: 'empty content: chat template payload lost the answer', expect: 'ADAPTER' },
    { kind: 'containment-gap', detail: 'false-success phrasing shipped before the containment repair', expect: 'VERIFICATION' },
    { kind: 'reviewer', detail: 'reviewer said PASS over failing execution evidence (advisory over deterministic FAIL)', expect: 'WORKER' },
    { kind: 'coder', detail: 'coder produced a placeholder artifact; tests fail on the coder output', expect: 'WORKER' },
    { kind: 'sop', detail: 'wrong sop selected for the verification-failure request', expect: 'SOP' },
    { kind: 'authority', detail: 'executed without approval recorded', expect: 'AUTHORITY' },
    { kind: 'capacity', detail: 'model behaviour: context supplied but the stage was omitted (instruction adherence)', systemCausesExcluded: true, expect: 'MODEL_CAPACITY' },
    { kind: 'capacity-unproven', detail: 'model behaviour: context supplied but the stage was omitted', systemCausesExcluded: false, expect: 'CONTRACT' }
  ];
  for (const sample of cases) {
    const result = classifyFailure(sample);
    assert.equal(result.class, sample.expect, `${sample.kind}: got ${result.class}`);
  }
});
