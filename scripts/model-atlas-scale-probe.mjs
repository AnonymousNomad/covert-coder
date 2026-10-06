// Synthetic scale probe for the Model Atlas store. No model inference.
// Usage: node scripts/model-atlas-scale-probe.mjs --workspace <dir> --count <n> [--models <m>] --report <path>

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createModelAtlas } from '../node/src/services/model-atlas.ts';

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) throw new Error('missing argument: ' + name);
  return process.argv[index + 1];
}

const workspace = path.resolve(arg('--workspace'));
const count = Number(arg('--count'));
const modelCount = Number(arg('--models') ?? '10');
const reportPath = path.resolve(arg('--report'));
if (!Number.isInteger(count) || count < 1 || count > 5000) throw new Error('count must be 1..5000');
if (!Number.isInteger(modelCount) || modelCount < 1) throw new Error('models must be >= 1');

const HASH_A = 'a'.repeat(64);
const HASH_D = 'd'.repeat(64);
const atlas = createModelAtlas({ workspace });
const now = Date.now();

function condition(conditionName, passed, total) {
  return {
    condition: conditionName,
    outcome: 'COMPLETED',
    score: { passed, total, ratio: passed / total },
    latency: { total_ms: 1000, mean_ms: 100 },
    tokens: { total: 500, mean: 50 },
    failures: [],
    categories: [{ id: 'C01', passed, total }],
    evidence_refs: []
  };
}

function record(index) {
  const modelId = 'local:scale-' + (index % modelCount);
  return {
    schema: 'covert.model-atlas.evaluation.v1',
    evaluation_id: randomUUID(),
    model_id: modelId,
    display_name: 'Scale Model ' + (index % modelCount),
    fingerprint: {
      model_id: modelId,
      source_revision: 'rev1',
      artifact_sha256: HASH_A,
      quantization: 'Q8_0',
      runtime_id: 'llama.cpp',
      runtime_version: '9940',
      harness_version: '2.1.0',
      benchmark_id: 'covert-scaffold-context-ablation',
      benchmark_version: '1.0.0',
      grader_version: '1.0.0',
      inference_config_digest: null,
      machine_profile_digest: HASH_D,
      execution_node: 'local-windows',
      chat_template: 'present'
    },
    hardware_profile: { cpu: 'test', ram_bytes: 1024, gpu: null, vram_bytes: null, backend: 'cpu', digest: HASH_D, execution_node: 'local-windows', execution_domain: 'WORKSPACE' },
    native: condition('NATIVE', 0, 10),
    harnessed: condition('HARNESSED', 2, 10),
    comparison: { basis: 'scaffold-ablation', delta_score: 0.2, delta_latency_ms: null, delta_tokens: null, categories: [] },
    qualification: {
      state: 'TESTED',
      basis: { source_revision: 'rev1', artifact_sha256: HASH_A, runtime_id: 'llama.cpp', runtime_version: '9940' },
      stale_reasons: []
    },
    recommended_roles: [],
    known_failures: [],
    known_limitations: [],
    evidence_refs: ['docs/evidence/synthetic.json'],
    evaluated_at: new Date(now + index * 1000).toISOString(),
    completed_at: new Date(now + index * 1000).toISOString(),
    receipt: { native_attempted: true, harnessed_attempted: true, executed: true, notes: [] }
  };
}

function basisFor(modelId) {
  return {
    source_revision: 'rev1', artifact_sha256: HASH_A, quantization: 'Q8_0', runtime_id: 'llama.cpp',
    runtime_version: '9940', harness_version: '2.1.0', benchmark_id: 'covert-scaffold-context-ablation',
    benchmark_version: '1.0.0', grader_version: '1.0.0', inference_config_digest: null,
    machine_profile_digest: HASH_D, execution_node: 'local-windows'
  };
}

async function directorySize(dir) {
  let total = 0;
  const walk = async current => {
    let entries;
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) total += await fs.stat(full).then(stat => stat.size).catch(() => 0);
    }
  };
  await walk(dir);
  return total;
}

const writeStart = Date.now();
for (let index = 0; index < count; index += 1) await atlas.recordEvaluation(record(index));
const writeTotalMs = Date.now() - writeStart;

const listStart = Date.now();
let listed = 0;
for (let index = 0; index < modelCount; index += 1) {
  const state = await atlas.stateFor('local:scale-' + index, basisFor('local:scale-' + index));
  listed += state.latest === null ? 0 : 1;
}
const listTotalMs = Date.now() - listStart;

const historyStart = Date.now();
const history = await atlas.historyFor('local:scale-0');
const historyMs = Date.now() - historyStart;

const latestStart = Date.now();
await atlas.latestFor('local:scale-0');
const latestMs = Date.now() - latestStart;

const auditStart = Date.now();
const audit = await atlas.audit();
const auditMs = Date.now() - auditStart;

const storeDir = path.join(workspace, '.aide', 'atlas');
const sizeBytes = await directorySize(storeDir);
const rss = process.memoryUsage().rss;

const report = {
  probe: 'covert.model-atlas.scale.v1',
  generated_at: new Date().toISOString(),
  platform: os.platform(),
  tiers: { records: count, models: modelCount },
  timings_ms: {
    write_total: writeTotalMs,
    write_per_record: Math.round((writeTotalMs / count) * 100) / 100,
    list_all_models_total: listTotalMs,
    history_lookup: historyMs,
    latest_lookup: latestMs,
    audit: auditMs
  },
  history_entries_model0: history.length,
  listed_models: listed,
  audit_healthy: audit.healthy,
  audit_totals: audit.totals,
  storage_bytes: sizeBytes,
  storage_bytes_per_record: Math.round(sizeBytes / count),
  rss_bytes: rss
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log('SCALE_PROBE records=' + count + ' write_ms=' + writeTotalMs + ' per_record_ms=' + report.timings_ms.write_per_record +
  ' list_ms=' + listTotalMs + ' history_ms=' + historyMs + ' audit_ms=' + auditMs + ' storage_mb=' + (sizeBytes / 1048576).toFixed(1) +
  ' rss_mb=' + Math.round(rss / 1048576) + ' healthy=' + audit.healthy);
console.log('report=' + reportPath);
