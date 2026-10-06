// MI-1 demonstration: ingests a completed harness-battery run into a durable
// Model Atlas record through the canonical services, then proves the Harness
// Sync state and the read contract. This is evidence tooling, not product code.
//
// Usage: node scripts/model-atlas-mi1-demo.mjs --run <runner.json> --workspace <dir> --record-out <path>

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createModelAtlas } from '../node/src/services/model-atlas.ts';
import { createHarnessSync } from '../node/src/services/harness-sync.ts';
import { createModelAtlasRead } from '../node/src/services/model-atlas-read.ts';

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) throw new Error('missing argument: ' + name);
  return process.argv[index + 1];
}

const repoRoot = path.resolve(import.meta.dirname, '..');
const runPath = path.resolve(arg('--run'));
const workspace = path.resolve(arg('--workspace'));
const recordOut = path.resolve(arg('--record-out'));
const run = JSON.parse(await fs.readFile(runPath, 'utf8'));
if (run.completion_status !== 'complete') throw new Error('runner did not complete; refusing to record');
const sha256 = value => createHash('sha256').update(value).digest('hex');

function aggregate(arm, rows) {
  const results = rows.map(row => row.arms[arm]).filter(Boolean);
  const graded = results.filter(result => result.pass !== null);
  const passed = graded.filter(result => result.pass === true).length;
  const wallTotal = results.reduce((sum, result) => sum + (Number.isFinite(result.wall_ms) ? result.wall_ms : 0), 0);
  const latencyCount = results.filter(result => Number.isFinite(result.wall_ms)).length;
  const tokenTotal = results.reduce((sum, result) => sum + (Number.isInteger(result.usage?.completion_tokens) ? result.usage.completion_tokens : 0), 0);
  const tokenCount = results.filter(result => Number.isInteger(result.usage?.completion_tokens)).length;
  const failureCounts = new Map();
  for (const result of results) {
    for (const code of result.failure_codes ?? []) failureCounts.set(code, (failureCounts.get(code) ?? 0) + 1);
  }
  const outcome = graded.length === results.length ? 'COMPLETED' : graded.length > 0 ? 'PARTIAL' : 'FAILED';
  return {
    condition: arm === 'off' ? 'NATIVE' : 'HARNESSED',
    outcome,
    score: { passed, total: results.length, ratio: results.length === 0 ? 0 : passed / results.length },
    latency: latencyCount > 0 ? { total_ms: wallTotal, mean_ms: wallTotal / latencyCount } : null,
    tokens: tokenCount > 0 ? { total: tokenTotal, mean: tokenTotal / tokenCount } : null,
    failures: [...failureCounts.entries()].map(([code, count]) => ({ code: String(code).slice(0, 240), count })),
    categories: rows.map(row => ({
      id: String(row.task_id ?? row.id ?? 'task').slice(0, 240),
      passed: row.arms[arm]?.pass === true ? 1 : 0,
      total: 1
    })),
    evidence_refs: [path.relative(repoRoot, runPath).split(path.sep).join('/')]
  };
}

const rows = run.rows ?? [];
const native = aggregate('off', rows);
const harnessed = aggregate('on', rows);
const sampling = run.request?.sampling ?? null;
const environment = run.environment ?? {};
const executionNode = 'local-windows';
const modelId = 'local:' + String(run.model.requested_id);
const fingerprint = {
  model_id: modelId,
  source_revision: run.request?.source_revision ?? null,
  artifact_sha256: run.model.weights_sha256 ?? null,
  quantization: run.model.quantization ?? null,
  runtime_id: run.model.runtime ?? null,
  runtime_version: run.model.runtime_version ?? null,
  harness_version: run.fingerprints?.scaffold_version ?? null,
  benchmark_id: run.suite?.id ?? null,
  benchmark_version: run.suite?.version ?? null,
  grader_version: run.suite?.grader_version ?? null,
  inference_config_digest: sampling === null ? null : sha256(JSON.stringify(sampling)),
  machine_profile_digest: sha256(JSON.stringify(environment)),
  execution_node: executionNode,
  chat_template: 'present'
};

const atlas = createModelAtlas({ workspace });
const qualification = atlas.deriveQualification({ native, harnessed });
const record = {
  schema: 'covert.model-atlas.evaluation.v1',
  evaluation_id: randomUUID(),
  model_id: modelId,
  display_name: 'SmolLM2 360M Instruct (Q8_0)',
  fingerprint,
  hardware_profile: {
    cpu: environment.cpu_model ?? null,
    ram_bytes: environment.total_memory_bytes ?? null,
    gpu: null,
    vram_bytes: null,
    backend: 'cpu',
    digest: sha256(JSON.stringify(environment)),
    execution_node: executionNode,
    execution_domain: 'WORKSPACE'
  },
  native,
  harnessed,
  comparison: {
    basis: 'scaffold-ablation',
    delta_score: harnessed.score.ratio - native.score.ratio,
    delta_latency_ms: harnessed.latency === null || native.latency === null ? null : harnessed.latency.total_ms - native.latency.total_ms,
    delta_tokens: harnessed.tokens === null || native.tokens === null ? null : harnessed.tokens.total - native.tokens.total,
    categories: rows.map(row => ({
      id: String(row.task_id ?? row.id ?? 'task').slice(0, 240),
      native_passed: row.arms.off?.pass === true ? 1 : 0,
      harnessed_passed: row.arms.on?.pass === true ? 1 : 0,
      total: 1
    }))
  },
  qualification: {
    state: qualification.state,
    basis: {
      source_revision: fingerprint.source_revision,
      artifact_sha256: fingerprint.artifact_sha256,
      runtime_id: fingerprint.runtime_id,
      runtime_version: fingerprint.runtime_version
    },
    stale_reasons: qualification.stale_reasons
  },
  recommended_roles: [],
  known_failures: [...native.failures.map(failure => ({ code: failure.code, detail: `native: ${failure.count} task(s)` })),
    ...harnessed.failures.map(failure => ({ code: failure.code, detail: `harnessed: ${failure.count} task(s)` }))],
  known_limitations: [
    '360M-parameter model; 0/10 native and 2/10 harnessed is below any assistant role threshold',
    'single execution node (local-windows, CPU) and single machine profile',
    'descriptive pilot only; no broad effectiveness claim'
  ],
  evidence_refs: [path.relative(repoRoot, runPath).split(path.sep).join('/')],
  evaluated_at: run.finished_at ?? new Date().toISOString(),
  completed_at: run.finished_at ?? new Date().toISOString(),
  receipt: {
    native_attempted: true,
    harnessed_attempted: true,
    executed: true,
    notes: [
      `llama.cpp ${run.model.runtime_version} served the artifact on ${executionNode} (CPU, -ngl 0); compatibility proven by execution`,
      'native = scaffold OFF control arm; harnessed = scaffold ON treatment arm; same 10-task suite and seeds'
    ]
  }
};

const stored = await atlas.recordEvaluation(record);
await fs.mkdir(path.dirname(recordOut), { recursive: true });
await fs.writeFile(recordOut, JSON.stringify(stored, null, 2) + '\n', 'utf8');

const currentBasis = {
  source_revision: fingerprint.source_revision,
  artifact_sha256: fingerprint.artifact_sha256,
  quantization: fingerprint.quantization,
  runtime_id: fingerprint.runtime_id,
  runtime_version: fingerprint.runtime_version,
  harness_version: fingerprint.harness_version,
  benchmark_id: fingerprint.benchmark_id,
  benchmark_version: fingerprint.benchmark_version,
  grader_version: fingerprint.grader_version,
  inference_config_digest: fingerprint.inference_config_digest,
  machine_profile_digest: fingerprint.machine_profile_digest,
  execution_node: executionNode
};
const sync = createHarnessSync({
  atlas,
  getModel: async () => ({
    model_id: modelId,
    display_name: 'SmolLM2 360M Instruct (Q8_0)',
    artifact_sha256: fingerprint.artifact_sha256,
    source_revision: fingerprint.source_revision,
    quantization: fingerprint.quantization,
    chat_template: 'present'
  }),
  currentBasis: () => currentBasis,
  harnessVersion: fingerprint.harness_version,
  benchmark: { id: fingerprint.benchmark_id, version: fingerprint.benchmark_version, grader_version: fingerprint.grader_version }
});

const current = await sync.inspect(modelId);
const staleSync = createHarnessSync({
  atlas,
  getModel: async () => ({
    model_id: modelId,
    display_name: 'SmolLM2 360M Instruct (Q8_0)',
    artifact_sha256: fingerprint.artifact_sha256,
    source_revision: fingerprint.source_revision,
    quantization: fingerprint.quantization,
    chat_template: 'present'
  }),
  currentBasis: () => ({ ...currentBasis, execution_node: 'wsl:ubuntu' }),
  harnessVersion: fingerprint.harness_version,
  benchmark: { id: fingerprint.benchmark_id, version: fingerprint.benchmark_version, grader_version: fingerprint.grader_version }
});
const stale = await staleSync.sync(modelId);

const read = createModelAtlasRead({ atlas });
const models = await read.modelsResponse([{
  model_id: modelId,
  display_name: 'SmolLM2 360M Instruct (Q8_0)',
  artifact_sha256: fingerprint.artifact_sha256,
  basis: currentBasis
}]);

console.log('MODEL_ID=' + modelId);
console.log('EVALUATION_ID=' + stored.evaluation_id);
console.log('NATIVE=' + stored.native.score.passed + '/' + stored.native.score.total);
console.log('HARNESSED=' + stored.harnessed.score.passed + '/' + stored.harnessed.score.total);
console.log('DELTA=' + stored.comparison.delta_score);
console.log('QUALIFICATION=' + stored.qualification.state);
console.log('SYNC_CURRENT=' + current.status);
console.log('SYNC_STALE=' + stale.status + ' reason=' + (stale.reason ?? '') + ' stale_reasons=' + JSON.stringify(stale.stale_reasons ?? []));
console.log('READ_STATE=' + models.models[0].evaluation_state + ' qualification=' + models.models[0].qualification_state);
console.log('RECORD_OUT=' + recordOut);
