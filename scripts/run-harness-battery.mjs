// Paired local-model scaffold ablation. This measures the versioned prompt
// scaffold only, not the complete agent/tool/Authority/Veritas harness.
// Usage: node scripts/run-harness-battery.mjs --model <backend-id> --url http://127.0.0.1:8087/v1 --context-tokens 8192 --weights-sha256 <64-hex> --runtime <name> --runtime-version <version>
import { createHash, randomUUID } from 'node:crypto';
import { cpus, arch, platform, release, freemem, totalmem } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeScaffold, injectScaffold, HARNESS_VERSION } from '../harness/scaffold.mjs';
import { assertLockedTaskSet, gradeTask, GRADER_VERSION, SUITE_ID, SUITE_VERSION, TASKS } from '../benchmarks/context-ablation-v1.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER_PATH = fileURLToPath(import.meta.url);
const ALLOWED_FLAGS = new Set([
  '--model', '--url', '--context-tokens', '--model-context-tokens', '--weights-sha256', '--quantization',
  '--runtime', '--runtime-version', '--accelerator', '--source-revision',
  '--temperature', '--top-p', '--top-k', '--repeat-penalty', '--sampling-seed', '--order-seed',
  '--resource-snapshot', '--repeats', '--timeout-ms', '--output', '--api-key-env'
]);

function parseFlags(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!ALLOWED_FLAGS.has(flag)) throw new Error('unknown argument: ' + flag);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error('missing value for ' + flag);
    if (Object.hasOwn(result, flag)) throw new Error('argument repeated: ' + flag);
    result[flag] = value;
    index += 1;
  }
  return result;
}

function required(flags, name) {
  const value = flags[name]?.trim();
  if (!value) throw new Error('required argument missing: ' + name);
  return value;
}

function integerFlag(flags, name, fallback, min, max) {
  const raw = flags[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(name + ' must be an integer from ' + min + ' to ' + max);
  }
  return value;
}

function decimalFlag(flags, name, fallback, min, max) {
  const raw = flags[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(name + ' must be a number from ' + min + ' to ' + max);
  }
  return value;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function loadResourceSnapshot(snapshotPath) {
  let snapshot;
  try {
    snapshot = JSON.parse(readFileSync(path.resolve(snapshotPath), 'utf8'));
  } catch (error) {
    throw new Error('--resource-snapshot could not be read as JSON: ' + String(error?.message ?? error));
  }
  const numberFields = ['free_ram_bytes', 'total_ram_bytes', 'free_commit_bytes', 'commit_used_bytes', 'commit_limit_bytes'];
  const validNumber = value => Number.isSafeInteger(value) && value >= 0;
  if (!snapshot || typeof snapshot !== 'object' ||
      typeof snapshot.sampled_at !== 'string' || !Number.isFinite(Date.parse(snapshot.sampled_at)) ||
      typeof snapshot.source !== 'string' || snapshot.source.trim() === '' ||
      numberFields.some(key => !validNumber(snapshot[key])) ||
      !snapshot.gpu || typeof snapshot.gpu.name !== 'string' || snapshot.gpu.name.trim() === '' ||
      ['vram_total_bytes', 'vram_used_bytes', 'vram_free_bytes'].some(key => !validNumber(snapshot.gpu[key])) ||
      !Number.isFinite(snapshot.gpu.utilization_percent) || snapshot.gpu.utilization_percent < 0 ||
      !Number.isFinite(snapshot.gpu.temperature_c) || snapshot.gpu.temperature_c < 0 ||
      !(snapshot.gpu.power_w === null || (Number.isFinite(snapshot.gpu.power_w) && snapshot.gpu.power_w >= 0))) {
    throw new Error('--resource-snapshot is missing valid timestamp, RAM/commit, or GPU fields');
  }
  if (snapshot.free_ram_bytes > snapshot.total_ram_bytes ||
      snapshot.free_commit_bytes > snapshot.commit_limit_bytes ||
      snapshot.gpu.vram_free_bytes > snapshot.gpu.vram_total_bytes) {
    throw new Error('--resource-snapshot contains inconsistent capacity values');
  }
  return snapshot;
}

function safeLocalEndpoint(raw) {
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('--url must be an absolute loopback URL'); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isLoopback = host === 'localhost' || host === '::1' || host === '127.0.0.1';
  if (!['http:', 'https:'].includes(url.protocol) || !isLoopback || url.username || url.password || url.search || url.hash) {
    throw new Error('benchmark endpoint must be a loopback URL without embedded credentials, query, or fragment');
  }
  let pathname = url.pathname.replace(/\/+$/, '');
  if (pathname.endsWith('/chat/completions')) {
    // A full completion endpoint is accepted for local OpenAI-compatible servers.
  } else if (pathname.endsWith('/v1')) {
    pathname += '/chat/completions';
  } else {
    pathname += '/v1/chat/completions';
  }
  const endpoint = url.origin + (pathname.startsWith('/') ? pathname : '/' + pathname);
  return { endpoint, display: url.origin + url.pathname.replace(/\/+$/, '') };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function scaffoldFingerprint() {
  const hash = createHash('sha256');
  for (const relative of ['harness/scaffold.mjs', 'common/harness/credocore.md']) {
    hash.update(relative);
    hash.update('\0');
    hash.update(readFileSync(path.join(ROOT, relative)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function baseMessages(task) {
  const messages = [];
  if (typeof task.system === 'string') messages.push({ role: 'system', content: task.system });
  messages.push({ role: 'user', content: task.prompt });
  return messages;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callModel({ endpoint, apiKey, model, messages, maxTokens, timeoutMs, sampling }) {
  const started = performance.now();
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature: sampling.temperature,
        top_p: sampling.top_p,
        top_k: sampling.top_k,
        repeat_penalty: sampling.repeat_penalty,
        seed: sampling.seed,
        max_tokens: maxTokens,
        stream: false
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
    const bodyText = await response.text();
    const bodyBytes = Buffer.byteLength(bodyText, 'utf8');
    const responseMeta = {
      raw_response_body: bodyBytes <= 2_000_000 ? bodyText : null,
      raw_response_body_sha256: sha256(bodyText),
      response_body_bytes: bodyBytes
    };
    if (!response.ok) {
      let detail = 'HTTP ' + response.status;
      try {
        const body = JSON.parse(bodyText);
        detail = String(body?.error?.message ?? body?.error ?? detail);
      } catch {}
      return { ...responseMeta, valid: false, status: 'http_error', error: detail.slice(0, 240), wall_ms: elapsedMs };
    }
    if (bodyBytes > 2_000_000) {
      return { ...responseMeta, valid: false, status: 'oversized_response', error: 'response exceeded 2 MiB', wall_ms: elapsedMs };
    }
    let body;
    try { body = JSON.parse(bodyText); }
    catch { return { ...responseMeta, valid: false, status: 'invalid_json', error: 'response was not JSON', wall_ms: elapsedMs }; }
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      return { ...responseMeta, valid: false, status: 'invalid_response', error: 'completion content was not a string', wall_ms: elapsedMs };
    }
    return {
      ...responseMeta,
      valid: true,
      status: 'ok',
      text,
      response_model: typeof body.model === 'string' ? body.model : null,
      finish_reason: typeof body.choices?.[0]?.finish_reason === 'string' ? body.choices[0].finish_reason : null,
      usage: {
        prompt_tokens: Number.isInteger(body.usage?.prompt_tokens) ? body.usage.prompt_tokens : null,
        completion_tokens: Number.isInteger(body.usage?.completion_tokens) ? body.usage.completion_tokens : null,
        total_tokens: Number.isInteger(body.usage?.total_tokens) ? body.usage.total_tokens : null
      },
      response_bytes: Buffer.byteLength(text, 'utf8'),
      wall_ms: elapsedMs
    };
  } catch (error) {
    const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
    const message = String(error?.message ?? error);
    const isTimeout = error?.name === 'TimeoutError' || /timed out/i.test(message);
    return { valid: false, status: isTimeout ? 'timeout' : 'request_error', error: message.slice(0, 240), wall_ms: elapsedMs };
  }
}

function armSummary(pairs, arm) {
  const results = pairs.map(pair => pair.arms[arm]).filter(Boolean);
  const passed = results.filter(result => result.pass === true).length;
  const valid = results.filter(result => result.valid).length;
  return {
    expected: pairs.length,
    passed,
    valid,
    invalid: pairs.length - valid,
    pass_rate: pairs.length === 0 ? null : passed / pairs.length,
    valid_response_pass_rate: valid === 0 ? null : passed / valid
  };
}

function sampleVariance(values) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

const MALFORMED_FAILURE_CODES = new Set([
  'empty_or_oversized_code', 'invalid_function_code', 'format_not_plain_code',
  'invalid_json', 'wrong_json_value_or_shape', 'format_not_json_only', 'unknown_task_kind'
]);

function summarize(pairs) {
  const treatment = armSummary(pairs, 'on');
  const baseline = armSummary(pairs, 'off');
  const validPairs = pairs.filter(pair => pair.arms.on?.valid && pair.arms.off?.valid);
  const treatmentWins = validPairs.filter(pair => pair.arms.on.pass && !pair.arms.off.pass).length;
  const baselineWins = validPairs.filter(pair => !pair.arms.on.pass && pair.arms.off.pass).length;
  const ties = validPairs.length - treatmentWins - baselineWins;
  const allResults = pairs.flatMap(pair => [pair.arms.off, pair.arms.on]).filter(Boolean);
  const failureCategories = {};
  for (const result of allResults) {
    for (const code of result.failure_codes ?? []) failureCategories[code] = (failureCategories[code] ?? 0) + 1;
  }
  const malformedCount = allResults.filter(result =>
    (result.failure_codes ?? []).some(code => MALFORMED_FAILURE_CODES.has(code))).length;
  const timeoutCount = allResults.filter(result => result.status === 'timeout').length;
  const errorCount = allResults.filter(result => result.status !== 'ok' && result.status !== 'timeout').length;
  const perTask = TASKS.map(task => {
    const taskPairs = pairs.filter(pair => pair.task_id === task.id);
    const taskTreatment = armSummary(taskPairs, 'on');
    const taskBaseline = armSummary(taskPairs, 'off');
    const taskValidPairs = taskPairs.filter(pair => pair.arms.on?.valid && pair.arms.off?.valid);
    const treatmentOutcomes = taskValidPairs.map(pair => Number(pair.arms.on.pass === true));
    const baselineOutcomes = taskValidPairs.map(pair => Number(pair.arms.off.pass === true));
    const wins = taskValidPairs.filter(pair => pair.arms.on.pass && !pair.arms.off.pass).length;
    const losses = taskValidPairs.filter(pair => !pair.arms.on.pass && pair.arms.off.pass).length;
    return {
      task_id: task.id,
      expected_trials: taskPairs.length,
      baseline_pass_rate: taskBaseline.pass_rate,
      treatment_pass_rate: taskTreatment.pass_rate,
      absolute_delta: taskBaseline.pass_rate === null || taskTreatment.pass_rate === null
        ? null : taskTreatment.pass_rate - taskBaseline.pass_rate,
      paired: {
        expected: taskPairs.length,
        valid: taskValidPairs.length,
        invalid: taskPairs.length - taskValidPairs.length,
        treatment_wins: wins,
        treatment_losses: losses,
        ties: taskValidPairs.length - wins - losses
      },
      trial_variance: {
        baseline: sampleVariance(baselineOutcomes),
        treatment: sampleVariance(treatmentOutcomes),
        valid_paired_trials: taskValidPairs.length
      },
      trials: taskPairs.map(pair => ({
        trial: pair.trial,
        baseline_pass: pair.arms.off?.valid ? pair.arms.off.pass : null,
        treatment_pass: pair.arms.on?.valid ? pair.arms.on.pass : null
      }))
    };
  });
  const absoluteDelta = baseline.pass_rate === null || treatment.pass_rate === null
    ? null : treatment.pass_rate - baseline.pass_rate;
  return {
    baseline,
    treatment,
    absolute_delta: absoluteDelta,
    relative_delta: baseline.pass_rate === null || baseline.pass_rate === 0 || absoluteDelta === null
      ? null : absoluteDelta / baseline.pass_rate,
    paired: {
      expected: pairs.length,
      valid: validPairs.length,
      invalid: pairs.length - validPairs.length,
      treatment_wins: treatmentWins,
      treatment_losses: baselineWins,
      ties,
      net_wins: treatmentWins - baselineWins
    },
    per_task: perTask,
    failures: {
      categories: failureCategories,
      malformed_output: {
        count: malformedCount,
        denominator: allResults.length,
        rate: allResults.length === 0 ? null : malformedCount / allResults.length
      },
      timeout: {
        count: timeoutCount,
        denominator: allResults.length,
        rate: allResults.length === 0 ? null : timeoutCount / allResults.length
      },
      other_error: {
        count: errorCount,
        denominator: allResults.length,
        rate: allResults.length === 0 ? null : errorCount / allResults.length
      },
      timeout_or_error: {
        count: timeoutCount + errorCount,
        denominator: allResults.length,
        rate: allResults.length === 0 ? null : (timeoutCount + errorCount) / allResults.length
      }
    },
    inference: 'descriptive pilot only; repeated trials are clustered within 10 task prompts and do not establish general model quality or statistical significance'
  };
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  assertLockedTaskSet();
  const model = required(flags, '--model');
  const local = safeLocalEndpoint(required(flags, '--url'));
  const contextTokens = integerFlag(flags, '--context-tokens', 0, 1, 2_000_000);
  const modelContextTokens = integerFlag(flags, '--model-context-tokens', 0, 1, 2_000_000);
  const weightsSha256 = required(flags, '--weights-sha256').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(weightsSha256)) throw new Error('--weights-sha256 must be exactly 64 hexadecimal characters');
  const quantization = required(flags, '--quantization');
  const runtime = required(flags, '--runtime');
  const runtimeVersion = required(flags, '--runtime-version');
  const sourceRevision = required(flags, '--source-revision');
  if (!/^[a-f0-9]{40}$/i.test(sourceRevision)) {
    throw new Error('--source-revision must be the full 40-character Git commit ID');
  }
  const resourceSnapshot = loadResourceSnapshot(required(flags, '--resource-snapshot'));
  const sampling = {
    temperature: decimalFlag(flags, '--temperature', 0, 0, 2),
    top_p: decimalFlag(flags, '--top-p', 1, 0.000001, 1),
    top_k: integerFlag(flags, '--top-k', 0, 0, 1_000_000),
    repeat_penalty: decimalFlag(flags, '--repeat-penalty', 1, 0.1, 5),
    seed: integerFlag(flags, '--sampling-seed', 0, 0, 2_147_483_647)
  };
  const orderSeed = integerFlag(flags, '--order-seed', 0, 0, 2_147_483_647);
  const orderRandom = seededRandom(orderSeed);
  const repeats = integerFlag(flags, '--repeats', 3, 1, 50);
  const timeoutMs = integerFlag(flags, '--timeout-ms', 90_000, 1000, 600_000);
  const apiKeyEnv = flags['--api-key-env'] ?? '';
  const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : '';
  if (apiKeyEnv && !apiKey) throw new Error('the named local API key environment variable is empty or unset');

  const context = composeScaffold({ effectiveContextTokens: contextTokens, taskFamily: 'coding' });
  const runId = randomUUID();
  const generatedAt = new Date().toISOString();
  const rows = [];
  let requestOrderIndex = 0;

  for (let trial = 1; trial <= repeats; trial += 1) {
    const tasksInOrder = shuffle(TASKS, orderRandom);
    const firstArms = shuffle([
      ...Array(TASKS.length / 2).fill('on'),
      ...Array(TASKS.length / 2).fill('off')
    ], orderRandom);
    for (let taskIndex = 0; taskIndex < tasksInOrder.length; taskIndex += 1) {
      const task = tasksInOrder[taskIndex];
      const baseline = baseMessages(task);
      const onMessages = injectScaffold(baseline, { system: context.system });
      const order = firstArms[taskIndex] === 'on' ? ['on', 'off'] : ['off', 'on'];
      const pair = {
        task_id: task.id,
        trial,
        task_order_index: taskIndex + 1,
        task_max_tokens: task.max_tokens,
        order,
        baseline_messages_sha256: sha256(JSON.stringify(baseline)),
        arms: {}
      };

      for (const arm of order) {
        const messages = arm === 'on' ? onMessages : baseline;
        const messageDigest = sha256(JSON.stringify(messages));
        const requestStartedAt = new Date().toISOString();
        const resourceBefore = { sampled_at: requestStartedAt, free_ram_bytes: freemem(), total_ram_bytes: totalmem() };
        const result = await callModel({
          endpoint: local.endpoint,
          apiKey,
          model,
          messages,
          maxTokens: task.max_tokens,
          timeoutMs,
          sampling
        });
        requestOrderIndex += 1;
        const requestCompletedAt = new Date().toISOString();
        const resourceAfter = { sampled_at: requestCompletedAt, free_ram_bytes: freemem(), total_ram_bytes: totalmem() };
        const armResult = {
          ...result,
          condition: arm === 'on' ? 'treatment' : 'control',
          max_tokens: task.max_tokens,
          request_order_index: requestOrderIndex,
          request_started_at: requestStartedAt,
          request_completed_at: requestCompletedAt,
          raw_input_messages: messages,
          input_messages_sha256: messageDigest,
          raw_output: result.valid ? result.text : null,
          output_sha256: result.valid ? sha256(result.text) : null,
          resource_ram_before: resourceBefore,
          resource_ram_after: resourceAfter,
          scaffold_present: JSON.stringify(messages).includes('[AIDE harness ' + HARNESS_VERSION + ' |')
        };
        if (result.valid) {
          const score = gradeTask(task, result.text);
          armResult.pass = score.pass;
          armResult.functional_pass = score.functional_pass;
          armResult.format_pass = score.format_pass;
          armResult.failure_codes = score.failure_codes;
          armResult.test_cases = score.test_cases;
        } else {
          armResult.pass = null;
          armResult.failure_codes = ['infrastructure_' + result.status];
        }
        if (arm === 'on' && !armResult.scaffold_present) {
          armResult.valid = false;
          armResult.status = 'harness_composition_error';
          armResult.error = 'ON arm did not contain the pinned scaffold';
          armResult.pass = null;
        }
        if (arm === 'off' && armResult.scaffold_present) {
          armResult.valid = false;
          armResult.status = 'harness_composition_error';
          armResult.error = 'OFF arm unexpectedly contained the pinned scaffold';
          armResult.pass = null;
        }
        pair.arms[arm] = armResult;
        await delay(250);
      }
      rows.push(pair);
      console.log(task.id + ' trial ' + trial + ' ON=' +
        (pair.arms.on.pass === true ? 'PASS' : pair.arms.on.pass === false ? 'FAIL' : 'INVALID') +
        ' OFF=' +
        (pair.arms.off.pass === true ? 'PASS' : pair.arms.off.pass === false ? 'FAIL' : 'INVALID'));
    }
  }

  const finishedAt = new Date().toISOString();
  const outputPath = flags['--output']
    ? path.resolve(process.cwd(), flags['--output'])
    : path.join(ROOT, 'docs', 'evidence', 'harness-battery-' + generatedAt.replace(/[:.]/g, '-') + '-' + runId.slice(0, 8) + '.json');
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const host = {
    platform: platform(),
    arch: arch(),
    release: release(),
    cpu_model: cpus()[0]?.model ?? null,
    logical_cpus: cpus().length,
    total_memory_bytes: totalmem(),
    accelerator_label: flags['--accelerator'] ?? null
  };
  const evidence = {
    run_id: runId,
    generated_at: generatedAt,
    started_at: generatedAt,
    finished_at: finishedAt,
    completion_status: 'complete',
    suite: { id: SUITE_ID, version: SUITE_VERSION, grader_version: GRADER_VERSION, task_count: TASKS.length, unique_prompts: true },
    scope: {
      on: 'harness/scaffold.mjs composeScaffold + injectScaffold',
      off: 'same prompt/messages without that scaffold',
      excluded: ['agent tool use', 'Execution Authority', 'Veritas', 'workspace retrieval', 'memory/advisory providers', 'other harness products'],
      endpoint_type: 'loopback OpenAI-compatible completion endpoint',
      order_policy: 'seeded Fisher-Yates task order and randomized 5/5 ON-first/OFF-first assignment per trial; no retries',
      order_seed: orderSeed
    },
    model: {
      requested_id: model,
      weights_sha256: weightsSha256,
      quantization,
      model_context_tokens: modelContextTokens,
      response_ids: [...new Set(rows.flatMap(row => [row.arms.on.response_model, row.arms.off.response_model]).filter(Boolean))],
      runtime,
      runtime_version: runtimeVersion
    },
    environment: host,
    request: {
      endpoint: local.display,
      scaffold_budget_tokens: contextTokens,
      model_context_tokens: modelContextTokens,
      sampling,
      sampling_seed_policy: 'fixed seed sent with every completion; determinism is not assumed from the seed alone',
      completions_per_arm: 1,
      task_specific_max_tokens: true,
      repeats_per_task: repeats,
      timeout_ms: timeoutMs,
      api_key_configured: Boolean(apiKey),
      source_revision: sourceRevision
    },
    resource_observations: {
      preflight: resourceSnapshot,
      preflight_sha256: sha256(JSON.stringify(resourceSnapshot)),
      per_completion_ram: 'free and total RAM sampled immediately before and after each request',
      commit_and_gpu: 'captured in the timestamped preflight snapshot'
    },
    fingerprints: {
      runner_sha256: sha256(readFileSync(RUNNER_PATH)),
      task_set_sha256: sha256(JSON.stringify(TASKS)),
      scaffold_sources_sha256: scaffoldFingerprint(),
      scaffold_system_sha256: sha256(context.system),
      scaffold_version: HARNESS_VERSION,
      scaffold_tier: context.tier,
      scaffold_bytes: context.bytes,
      scaffold_budget: context.budget,
      source_revision: sourceRevision
    },
    rows,
    summary: summarize(rows)
  };
  const serialized = JSON.stringify(evidence, null, 2) + '\n';
  try {
    writeFileSync(outputPath, serialized, { flag: 'wx' });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('refusing to overwrite existing evidence file: ' + outputPath);
    throw error;
  }
  const summary = evidence.summary;
  console.log('Baseline ' + summary.baseline.passed + '/' + summary.baseline.expected + ' passed | Treatment ' +
    summary.treatment.passed + '/' + summary.treatment.expected + ' passed');
  console.log('paired valid ' + summary.paired.valid + '/' + summary.paired.expected +
    ' | treatment wins ' + summary.paired.treatment_wins + ' | treatment losses ' + summary.paired.treatment_losses +
    ' | ties ' + summary.paired.ties + ' | absolute delta ' + (summary.absolute_delta ?? 'unavailable'));
  console.log('Interpretation: descriptive pilot only; no broad effectiveness claim.');
  console.log('Saved evidence: ' + outputPath);
}

main().catch(error => {
  console.error('Harness battery stopped: ' + String(error?.message ?? error));
  process.exitCode = 1;
});
