// Local fixture verification for the paired scaffold-ablation runner.
// This intentionally does not load a model or write into repository evidence.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GRADER_VERSION, TASKS } from '../benchmarks/context-ablation-v1.mjs';

const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
const script = path.join(repoRoot, 'scripts', 'run-harness-battery.mjs');
const evidenceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-harness-fixture-'));
const reportPath = path.join(evidenceDir, 'fixture-evidence.json');
const resourceSnapshotPath = path.join(evidenceDir, 'resource-snapshot.json');
const fixtureResourceSnapshot = {
  sampled_at: '2026-09-27T14:20:00.000Z',
  source: 'synthetic fixture resource sample',
  free_ram_bytes: 8 * 1024 ** 3,
  total_ram_bytes: 16 * 1024 ** 3,
  free_commit_bytes: 7 * 1024 ** 3,
  commit_used_bytes: 9 * 1024 ** 3,
  commit_limit_bytes: 16 * 1024 ** 3,
  gpu: {
    name: 'fixture GPU',
    vram_total_bytes: 8 * 1024 ** 3,
    vram_used_bytes: 2 * 1024 ** 3,
    vram_free_bytes: 6 * 1024 ** 3,
    utilization_percent: 0,
    temperature_c: 20,
    power_w: null
  }
};
await fs.writeFile(resourceSnapshotPath, JSON.stringify(fixtureResourceSnapshot));
const seen = new Map(TASKS.map(task => [task.id, { on: 0, off: 0, prompts: new Set() }]));
let requests = 0;

const server = createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      assert.equal(req.method, 'POST');
      assert.equal(req.url, '/v1/chat/completions');
      const payload = JSON.parse(body);
      assert.equal(payload.model, 'fixture');
      assert.equal(payload.temperature, 0);
      assert.equal(payload.top_p, 1);
      assert.equal(payload.top_k, 0);
      assert.equal(payload.repeat_penalty, 1);
      assert.equal(payload.seed, 4242);
      assert.equal(payload.stream, false);
      assert.ok(Array.isArray(payload.messages));
      const prompt = payload.messages.at(-1)?.content;
      const task = TASKS.find(candidate => candidate.prompt === prompt);
      assert.ok(task, 'request must use a locked task prompt');
      const containsScaffold = JSON.stringify(payload.messages).includes('[AIDE harness ');
      const arm = containsScaffold ? 'on' : 'off';
      const record = seen.get(task.id);
      record[arm] += 1;
      record.prompts.add(prompt);
      requests += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        model: 'fixture',
        choices: [{ message: { role: 'assistant', content: 'fixture response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 }
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: String(error?.message ?? error) } }));
    }
  });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');

try {
  const child = spawn(process.execPath, [
    script,
    '--model', 'fixture',
    '--url', 'http://127.0.0.1:' + address.port + '/v1',
    '--context-tokens', '8192',
    '--model-context-tokens', '8192',
    '--weights-sha256', '0'.repeat(64),
    '--quantization', 'Q4_K_M',
    '--runtime', 'fixture-runtime',
    '--runtime-version', '1.0.0',
    '--source-revision', 'c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3',
    '--temperature', '0',
    '--top-p', '1',
    '--top-k', '0',
    '--repeat-penalty', '1',
    '--sampling-seed', '4242',
    '--order-seed', '20260927',
    '--resource-snapshot', resourceSnapshotPath,
    '--repeats', '1',
    '--output', reportPath
  ], {
    cwd: repoRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('exit', resolve);
    child.once('error', reject);
  });

  assert.equal(exitCode, 0, stderr.slice(-1500));
  assert.equal(requests, 20, 'one ON and one OFF model request per locked task');
  for (const task of TASKS) {
    const record = seen.get(task.id);
    assert.equal(record.on, 1, task.id + ' ON count');
    assert.equal(record.off, 1, task.id + ' OFF count');
    assert.equal(record.prompts.size, 1, task.id + ' prompt must stay identical');
  }
  const evidence = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  assert.equal(evidence.rows.length, 10);
  assert.equal(new Set(evidence.rows.map(row => row.task_id)).size, 10);
  assert.notDeepEqual(evidence.rows.map(row => row.task_id), TASKS.map(task => task.id), 'task request order is seeded-randomized');
  assert.equal(evidence.rows.filter(row => row.order[0] === 'on').length, 5, 'ON-first order is balanced');
  assert.equal(evidence.rows.filter(row => row.order[0] === 'off').length, 5, 'OFF-first order is balanced');
  const requestOrder = evidence.rows.flatMap(row => row.order.map(arm => row.arms[arm].request_order_index)).sort((a, b) => a - b);
  assert.deepEqual(requestOrder, Array.from({ length: 20 }, (_, index) => index + 1));
  for (const row of evidence.rows) {
    assert.equal(row.arms.on.raw_input_messages.at(-1).content, row.arms.off.raw_input_messages.at(-1).content);
    for (const arm of ['on', 'off']) {
      const result = row.arms[arm];
      assert.equal(result.condition, arm === 'on' ? 'treatment' : 'control');
      assert.equal(result.max_tokens, row.task_max_tokens);
      assert.equal(result.input_messages_sha256, createHash('sha256').update(JSON.stringify(result.raw_input_messages)).digest('hex'));
      assert.equal(result.raw_output, 'fixture response');
      assert.equal(result.output_sha256, createHash('sha256').update('fixture response').digest('hex'));
      assert.equal(JSON.parse(result.raw_response_body).choices[0].message.content, result.raw_output);
      assert.equal(result.raw_response_body_sha256, createHash('sha256').update(result.raw_response_body).digest('hex'));
      assert.ok(result.resource_ram_before.free_ram_bytes > 0);
      assert.ok(result.resource_ram_after.free_ram_bytes > 0);
    }
  }
  assert.equal(evidence.model.quantization, 'Q4_K_M');
  assert.equal(evidence.model.model_context_tokens, 8192);
  assert.equal(evidence.request.scaffold_budget_tokens, 8192);
  assert.deepEqual(evidence.request.sampling, { temperature: 0, top_p: 1, top_k: 0, repeat_penalty: 1, seed: 4242 });
  assert.equal(evidence.scope.order_seed, 20260927);
  assert.equal(evidence.suite.grader_version, GRADER_VERSION);
  assert.deepEqual(evidence.resource_observations.preflight, fixtureResourceSnapshot);
  assert.equal(evidence.fingerprints.source_revision, 'c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3');
  assert.equal(evidence.summary.baseline.valid, 10);
  assert.equal(evidence.summary.treatment.valid, 10);
  assert.equal(evidence.summary.baseline.passed, 1, 'fixture response only passes the canary non-disclosure check');
  assert.equal(evidence.summary.treatment.passed, 1);
  assert.equal(evidence.summary.baseline.pass_rate, 0.1);
  assert.equal(evidence.summary.treatment.pass_rate, 0.1);
  assert.equal(evidence.summary.paired.valid, 10);
  assert.equal(evidence.summary.paired.treatment_wins, 0);
  assert.equal(evidence.summary.paired.treatment_losses, 0);
  assert.equal(evidence.summary.paired.ties, 10);
  assert.equal(evidence.summary.per_task.length, 10);
  assert.equal(evidence.summary.failures.malformed_output.count, 18);
  assert.equal(evidence.summary.failures.timeout.count, 0);
  assert.equal(evidence.summary.failures.other_error.count, 0);
  assert.equal(evidence.fingerprints.scaffold_version, '2.1.0');
  assert.match(stdout, /descriptive pilot only/);
  assert.doesNotMatch(stdout, /VERDICT:.*improves/i);
  assert.doesNotMatch(stdout, /\/20/);
  console.log('PASS: 10 unique randomized tasks, 20 paired local calls, frozen sampling/provenance, raw evidence hashes, resource observations, and honest score accounting');
} finally {
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(resolve));
  await fs.rm(evidenceDir, { recursive: true, force: true });
}
