import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { RuntimeBroker } from '../../node/src/services/runtime-adapter.ts';
import { CredentialStore } from '../../node/src/services/credentials.ts';
import { UNSLOTH_API_KEY_CREDENTIAL_ID, UnslothRuntimeAdapter } from '../../node/src/services/unsloth-runtime-adapter.ts';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { resolveInsideWorkspace } from '../../node/src/services/agent-tools.mjs';
import { classifyStructuredOutput, validateSingleRuntimeToolCall, validateStructuredOutput } from '../../node/src/services/runtime-output-validation.ts';

const installRoot = path.resolve(process.env.COVERT_UNSLOTH_INSTALL_ROOT ?? '');
const qualificationRoot = path.resolve(process.env.COVERT_UNSLOTH_QUALIFICATION_ROOT ?? '');
const credentialWorkspace = path.resolve(process.env.COVERT_UNSLOTH_CREDENTIAL_WORKSPACE ?? qualificationRoot);
const artifactPath = path.resolve(process.env.COVERT_LIQUID_GGUF ?? '');
const outputPath = path.resolve(process.env.COVERT_RUNTIME_EVIDENCE_JSONL ?? '');
const expectedVersion = '2026.9.11';
const expectedSha256 = '02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed';
const expectedBytes = 1_674_455_040;
const port = 18888;
const endpoint = `http://127.0.0.1:${port}`;
const modelId = 'liquid-lfm25-2.6b-q4km';
const fixtureName = 'runtime-v1-harmless-fixture.txt';
const fixtureContents = 'Covert runtime fixture: read-only result 42.\n';
const soakMinutes = Number(process.env.COVERT_RUNTIME_SOAK_MINUTES ?? '30');
const outputHandle = null;
let broker;
let adapter;
let apiKey;
let credentialStore;
let fixturePath;
let authority;
let authorityActor;
let authorityEvents = 0;
let authorityExecutions = 0;
let fetchTiming = null;
const inferenceLatencies = [];
const soakSamples = [];
let phaseFailure = null;

function emit(event, payload = {}) {
  const row = { at: new Date().toISOString(), event, ...payload };
  const line = `${JSON.stringify(row)}\n`;
  process.stdout.write(line);
  return appendFile(outputPath, line, { encoding: 'utf8' });
}

function requireConfigured() {
  for (const [name, value] of [
    ['COVERT_UNSLOTH_INSTALL_ROOT', installRoot],
    ['COVERT_UNSLOTH_QUALIFICATION_ROOT', qualificationRoot],
    ['COVERT_UNSLOTH_CREDENTIAL_WORKSPACE', credentialWorkspace],
    ['COVERT_LIQUID_GGUF', artifactPath],
    ['COVERT_RUNTIME_EVIDENCE_JSONL', outputPath]
  ]) {
    if (!value || value === path.parse(value).root) throw new Error(`${name} is required`);
  }
  if (!Number.isInteger(soakMinutes) || soakMinutes < 30 || soakMinutes > 60) throw new Error('soak duration must be an integer from 30 through 60 minutes');
}

async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function powershellJson(script) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const output = execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', encoded], {
    encoding: 'utf8', windowsHide: true, timeout: 10_000, maxBuffer: 1_000_000
  }).trim();
  return JSON.parse(output);
}

function sampleSystemResources() {
  const ps = [
    "$admin=([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
    "$os=Get-CimInstance Win32_OperatingSystem",
    "$m=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory",
    "$r=@(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('unsloth.exe','llama-server.exe') })",
    "[pscustomobject]@{isAdmin=$admin;commitFreeBytes=[long]($m.CommitLimit-$m.CommittedBytes);commitUsedBytes=[long]$m.CommittedBytes;commitLimitBytes=[long]$m.CommitLimit;runtimeProcessCount=$r.Count}|ConvertTo-Json -Compress"
  ].join(';');
  const windows = powershellJson(ps);
  let gpu = null;
  try {
    const text = execFileSync('nvidia-smi.exe', ['--query-gpu=memory.used,memory.free,utilization.gpu', '--format=csv,noheader,nounits'], {
      encoding: 'utf8', windowsHide: true, timeout: 5000, maxBuffer: 16_384
    }).trim().split(/\r?\n/)[0];
    const values = text.split(',').map(value => Number(value.trim()));
    if (values.length === 3 && values.every(Number.isFinite)) gpu = { used_mib: values[0], free_mib: values[1], utilization_percent: values[2] };
  } catch { /* Preserve unavailable measurements as null. */ }
  return {
    is_admin: windows.isAdmin,
    total_ram_bytes: os.totalmem(),
    free_ram_bytes: os.freemem(),
    commit_free_bytes: windows.commitFreeBytes,
    commit_used_bytes: windows.commitUsedBytes,
    commit_limit_bytes: windows.commitLimitBytes,
    runtime_process_count: windows.runtimeProcessCount,
    gpu
  };
}

function startResourceGate(sample) {
  const gib = 1024 ** 3;
  return {
    pass: sample.is_admin === true && sample.runtime_process_count === 0 && sample.free_ram_bytes >= 6.5 * gib && sample.commit_free_bytes >= 5 * gib &&
      sample.gpu !== null && sample.gpu.free_mib >= 4608 && sample.gpu.utilization_percent < 50,
    observed: {
      free_ram_gib: sample.free_ram_bytes / gib,
      free_commit_gib: sample.commit_free_bytes / gib,
      free_vram_gib: sample.gpu === null ? null : sample.gpu.free_mib / 1024,
      gpu_utilization_percent: sample.gpu?.utilization_percent ?? null
    }
  };
}

function inRunResourceGate(sample) {
  const gib = 1024 ** 3;
  return sample.free_ram_bytes >= 5.25 * gib && sample.commit_free_bytes >= 2.75 * gib &&
    sample.gpu !== null && sample.gpu.free_mib >= 3072;
}

function makeRuntime() {
  process.env.UNSLOTH_STUDIO_HOME = installRoot;
  delete process.env.AIDE_UNSLOTH_ENDPOINT;
  const cliPath = path.join(installRoot, 'bin', 'unsloth.exe');
  const workspace = qualificationRoot;
  credentialStore = new CredentialStore(credentialWorkspace);
  const fetcher = async (input, init) => {
    const route = new URL(String(input)).pathname;
    const timing = fetchTiming;
    if (timing && route === '/api/inference/load' && timing.loadStartedMs === null) timing.loadStartedMs = performance.now() - timing.startedMs;
    const response = await fetch(input, init);
    if (timing && route === '/api/health' && timing.healthMs === null && response.ok) timing.healthMs = performance.now() - timing.startedMs;
    if (timing && route === '/api/inference/load' && timing.loadDoneMs === null) timing.loadDoneMs = performance.now() - timing.startedMs;
    return response;
  };
  adapter = new UnslothRuntimeAdapter({
    workspace, cliPath, port, fetcher, startupTimeoutMs: 120_000,
    credentialStore
  });
  broker = new RuntimeBroker(adapter, null, workspace);
}

async function checkedArtifact() {
  const stat = await import('node:fs/promises').then(fs => fs.stat(artifactPath));
  const hash = await sha256File(artifactPath);
  if (stat.size !== expectedBytes || hash.toLowerCase() !== expectedSha256) {
    throw new Error('official Liquid artifact identity mismatch; load refused');
  }
  return { sha256: hash.toLowerCase(), bytes: stat.size };
}

async function loadModel(label) {
  const artifact = await checkedArtifact();
  fetchTiming = { startedMs: performance.now(), healthMs: null, loadStartedMs: null, loadDoneMs: null };
  const start = performance.now();
  const identity = await broker.load({ modelId, modelPath: artifactPath, displayName: 'LFM2.5-2.6B-Q4_K_M.gguf' });
  const elapsedMs = performance.now() - start;
  const timing = fetchTiming;
  fetchTiming = null;
  const status = await broker.status();
  if (identity.artifact_sha256?.toLowerCase() !== expectedSha256 || status.loaded_model?.artifact_sha256?.toLowerCase() !== expectedSha256) {
    throw new Error('runtime loaded identity did not retain the verified artifact hash');
  }
  await emit('MODEL_LOAD', {
    label, artifact, total_ms: elapsedMs,
    server_health_ms: timing?.healthMs ?? null,
    api_load_started_ms: timing?.loadStartedMs ?? null,
    api_load_completed_ms: timing?.loadDoneMs ?? null,
    health: status.health, ownership: status.ownership,
    loaded_model_hash: status.loaded_model.artifact_sha256
  });
  return elapsedMs;
}

function baseRequest(content, maxTokens = 512) {
  return {
    modelId,
    messages: [{ role: 'user', content }],
    maxTokens,
    temperature: 0
  };
}

async function normalInference(label, prompt = 'Reply with one short sentence confirming the local runtime is available.') {
  const start = performance.now();
  const result = await broker.infer(baseRequest(prompt, 512), AbortSignal.timeout(90_000));
  const latencyMs = performance.now() - start;
  inferenceLatencies.push(latencyMs);
  await emit('INFERENCE', {
    label, latency_ms: latencyMs,
    prompt_tokens: result.promptTokens, completion_tokens: result.completionTokens,
    text_chars: result.text.length, text_sha256: createHash('sha256').update(result.text).digest('hex'),
    finish_reason: result.finishReason, model_hash: result.model.artifact_sha256
  });
  return result;
}

async function streamInference(label) {
  let text = '';
  let firstTokenMs = null;
  const start = performance.now();
  const result = await broker.stream(baseRequest('In one short sentence, explain a local runtime health check.', 512), delta => {
    if (firstTokenMs === null) firstTokenMs = performance.now() - start;
    text += delta;
  }, AbortSignal.timeout(90_000));
  const elapsedMs = performance.now() - start;
  await emit('STREAM', {
    label, first_token_ms: firstTokenMs, total_ms: elapsedMs,
    prompt_tokens: result.promptTokens, completion_tokens: result.completionTokens,
    text_chars: text.length, text_sha256: createHash('sha256').update(text).digest('hex'),
    finish_reason: result.finishReason
  });
  return result;
}

async function testCancellation() {
  const pending = broker.infer(baseRequest('Write a long multi-section explanation of local runtime qualification and continue until stopped.', 512), AbortSignal.timeout(90_000))
    .then(result => ({ completed: true, result }), error => ({ completed: false, error }));
  await new Promise(resolve => setTimeout(resolve, 1200));
  const cancelAccepted = await broker.cancel();
  const outcome = await pending;
  const health = await broker.health();
  await emit('CANCELLATION', {
    cancel_accepted: cancelAccepted,
    request_completed_before_cancel: outcome.completed,
    interrupted: !outcome.completed,
    error_name: outcome.completed ? null : outcome.error?.name ?? 'unknown',
    health_after: health
  });
  if (outcome.completed) return false;
  return (await normalInference('cancel-recovery')).text.length > 0 && await broker.health() === 'HEALTHY';
}

async function strictStructuredOutputCheck(schema) {
  const state = await broker.status();
  if (state.ownership !== 'COVERT_OWNED' || state.health !== 'HEALTHY') throw new Error('structured output probe requires verified owned local runtime');
  let response;
  try {
    response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(90_000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        model: 'default',
        messages: [{ role: 'user', content: 'For integers 7, 2, and 9 return minimum 2, maximum 9, status ok.' }],
        max_tokens: 512, temperature: 0,
        response_format: { type: 'json_schema', json_schema: {
          name: 'liquid_range', strict: true,
          schema: { type: 'object', properties: {
            minimum: { type: 'integer' }, maximum: { type: 'integer' }, status: { type: 'string', enum: ['ok', 'needs_review'] }
          }, required: ['minimum', 'maximum', 'status'], additionalProperties: false }
        } }
      })
    });
  } catch {
    await emit('STRUCTURED_NATIVE', { classification: 'NOT_SUPPORTED — COVERT VALIDATION REQUIRED', http_status: null, accepted: false, reason: 'ENDPOINT_ERROR' });
    return { accepted: false, reason: 'ENDPOINT_ERROR' };
  }
  const body = await response.json().catch(() => null);
  const content = typeof body?.choices?.[0]?.message?.content === 'string' ? body.choices[0].message.content : '';
  const checked = validateStructuredOutput(content, schema);
  const accepted = response.ok && checked.accepted;
  await emit('STRUCTURED_NATIVE', {
    v1_classification: 'NOT_SUPPORTED — COVERT VALIDATION REQUIRED',
    single_probe_outcome: accepted ? 'ONE_FROZEN_SCHEMA_VALID' : 'ONE_FROZEN_SCHEMA_INVALID',
    http_status: response.status, accepted,
    rejection_reason: checked.accepted ? null : checked.reason,
    content_chars: content.length,
    content_sha256: createHash('sha256').update(content).digest('hex')
  });
  if (!accepted) {
    await emit('STRUCTURED_FALLBACK', {
      path: 'deterministic reject and route to NEEDS_REVIEW',
      accepted: false,
      disposition: 'NEEDS_REVIEW',
      inference_repeated: false,
      no_false_acceptance: true
    });
    return { accepted: false, reason: checked.accepted ? 'HTTP_FAILURE' : checked.reason, fallbackDisposition: 'NEEDS_REVIEW' };
  }
  return { accepted: true };
}

async function toolLoop(toolSchema) {
  fixturePath = path.join(qualificationRoot, fixtureName);
  await writeFile(fixturePath, fixtureContents, { encoding: 'utf8', flag: 'wx' });
  const auditPath = path.join(qualificationRoot, 'runtime-v1-authority-events.jsonl');
  await rm(auditPath, { force: true });
  authority = createExecutionAuthority({
    workspace: qualificationRoot,
    record: async event => {
      authorityEvents += 1;
      await appendFile(auditPath, `${JSON.stringify(event)}\n`, { encoding: 'utf8' });
      return { persisted: true };
    }
  });
  const origin = endpoint;
  const proof = authority.control.createPairing(origin);
  const paired = await authority.pair(proof, origin);
  authorityActor = authority.authenticate(paired.token, origin);
  const prompt = `Call workspace.read exactly once with path ${fixtureName}. Do not write files or perform other actions.`;
  const toolDefinition = [{
    type: 'function', function: {
      name: 'workspace.read', description: 'Read the named harmless qualification fixture.',
      parameters: { type: 'object', properties: { path: { type: 'string', enum: [fixtureName] } }, required: ['path'], additionalProperties: false }
    }
  }];
  const generated = await broker.infer({ ...baseRequest(prompt, 512), tools: toolDefinition }, AbortSignal.timeout(90_000));
  const validated = validateSingleRuntimeToolCall(generated.toolCalls, 'workspace.read', toolSchema);
  if (!validated.accepted) {
    await emit('TOOL_MODEL_CALL', {
      capability: 'PARTIAL', accepted: false, reason: validated.reason,
      tool_count: generated.toolCalls.length,
      raw_pre_repair: 'UNAVAILABLE', repair_attribution: 'UNKNOWN'
    });
    return { loopPassed: false, malformedRejected: false };
  }
  const input = { workspace: qualificationRoot, taskId: 'runtime-v1-harmless-tool', kind: 'workspace.read', args: validated.arguments };
  const approved = await authority.prepare(authorityActor, input);
  let toolResult;
  try {
    toolResult = await authority.execute(authorityActor, approved.operation_id, input, async operation => {
      authorityExecutions += 1;
      const absolute = resolveInsideWorkspace(qualificationRoot, operation.args.path);
      return await readFile(absolute, 'utf8');
    });
  } catch (error) {
    await emit('TOOL_AUTHORITY', { accepted: false, authority_state: approved.state, error_code: error?.code ?? 'TOOL_EXECUTION_FAILED' });
    return { loopPassed: false, malformedRejected: false };
  }
  await emit('TOOL_AUTHORITY', {
    accepted: true, authority_state: approved.state,
    operation_kind: 'workspace.read', executed: authorityExecutions === 1,
    result_chars: toolResult.length,
    result_sha256: createHash('sha256').update(toolResult).digest('hex'),
    authority_event_count: authorityEvents
  });
  const call = generated.toolCalls[0];
  const callId = validated.callId ?? 'covert-runtime-v1-fixture-call';
  const final = await broker.infer({
    modelId,
    messages: [
      { role: 'user', content: prompt },
      { role: 'assistant', content: '', tool_calls: [{ ...call, id: callId }] },
      { role: 'tool', tool_call_id: callId, content: toolResult },
      { role: 'user', content: 'Now summarize the read-only tool result in one short sentence.' }
    ], maxTokens: 512, temperature: 0
  }, AbortSignal.timeout(90_000));
  const malformed = validateSingleRuntimeToolCall([{
    type: 'function', function: { name: 'workspace.read', arguments: '{"path":"../outside.txt"}' }
  }], 'workspace.read', toolSchema);
  const malformedJson = validateSingleRuntimeToolCall([{
    type: 'function', function: { name: 'workspace.read', arguments: '{"path":' }
  }], 'workspace.read', toolSchema);
  const noExecutionAfterReject = malformed.accepted === false && malformedJson.accepted === false && authorityExecutions === 1;
  await emit('TOOL_FAILURE_PATH', {
    malformed_argument_rejected: malformed.accepted === false,
    malformed_json_rejected: malformedJson.accepted === false,
    authority_not_called_for_invalid_envelope: noExecutionAfterReject,
    malformed_reason: malformed.accepted ? null : malformed.reason,
    malformed_json_reason: malformedJson.accepted ? null : malformedJson.reason,
    session_recovered: final.text.length > 0,
    final_response_chars: final.text.length,
    final_response_sha256: createHash('sha256').update(final.text).digest('hex')
  });
  await emit('TOOL_MODEL_CALL', {
    capability: 'PARTIAL', accepted: true,
    valid_selection: true, valid_name: validated.name,
    schema_valid_arguments: true, execution_loop: final.text.length > 0,
    raw_pre_repair: 'UNAVAILABLE',
    runtime_adjusted_call: generated.toolCalls,
    executed_call: { name: validated.name, arguments: validated.arguments, result_sha256: createHash('sha256').update(toolResult).digest('hex') },
    repair_attribution: 'UNKNOWN', self_healing_repair_claimed: false
  });
  return { loopPassed: final.text.length > 0, malformedRejected: noExecutionAfterReject };
}

async function testAuthentication() {
  const state = await broker.status();
  if (state.ownership !== 'COVERT_OWNED' || state.health !== 'HEALTHY') throw new Error('authentication probe requires verified owned local runtime');
  const unauth = await fetch(`${endpoint}/v1/models`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  const authorized = await fetch(`${endpoint}/v1/models`, {
    redirect: 'manual', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }
  });
  const payload = await authorized.json().catch(() => null);
  const unauthClass = unauth.status === 401 ? 'AUTH_REQUIRED_401' : unauth.status === 403 ? 'AUTH_FORBIDDEN_403' : 'UNEXPECTED_STATUS';
  const authenticatedClass = authorized.status === 401 ? 'AUTH_REQUIRED_401' : authorized.status === 403 ? 'AUTH_FORBIDDEN_403' : authorized.ok ? 'AUTHENTICATED' : 'OTHER_HTTP_FAILURE';
  const pass = (unauth.status === 401 || unauth.status === 403) && authorized.ok && Array.isArray(payload?.data);
  await emit('AUTHENTICATION', {
    unauthenticated_status: unauth.status,
    unauthenticated_class: unauthClass,
    authenticated_status: authorized.status,
    authenticated_class: authenticatedClass,
    model_enumeration_valid: Array.isArray(payload?.data),
    credential_value_logged: false,
    pass
  });
  return pass;
}

async function soak() {
  const start = Date.now();
  const stopAt = start + soakMinutes * 60_000;
  let tick = 0;
  while (Date.now() < stopAt) {
    const before = sampleSystemResources();
    if (!inRunResourceGate(before)) {
      await emit('SOAK_GUARD_STOP', { tick, reason: 'in-run resource envelope crossed', sample: before });
      break;
    }
    soakSamples.push({ at: new Date().toISOString(), sample: before });
    let result = { operation: 'inference', pass: false };
    if (tick > 0 && tick % 20 === 0) {
      const beforeStatus = await broker.status();
      if (beforeStatus.ownership !== 'COVERT_OWNED' || beforeStatus.health !== 'HEALTHY') throw new Error('runtime interruption requires verified Covert ownership and healthy state');
      await broker.unload(modelId);
      await broker.shutdown();
      await new Promise(resolve => setTimeout(resolve, 500));
      const stopped = await broker.status();
      const lossDetected = stopped.health !== 'HEALTHY' && stopped.pid === null && stopped.ownership === 'UNKNOWN';
      if (!lossDetected) throw new Error('owned runtime stop did not produce an explicit non-healthy stopped state');
      const restartMs = await loadModel(`soak-restart-${tick}`);
      const recovered = await broker.health() === 'HEALTHY' && (await normalInference(`soak-recovery-${tick}`)).text.length > 0;
      result = { operation: 'owned-runtime-interruption-restart', pass: lossDetected && restartMs > 0 && recovered, restart_ms: restartMs, loss_detected: lossDetected, recovered };
    } else if (tick > 0 && tick % 10 === 0) {
      const identity = (await broker.status()).loaded_model;
      if (identity?.model_id !== modelId) throw new Error('soak reload found an unexpected loaded model identity');
      await broker.unload(modelId);
      const afterUnload = await broker.status();
      const reloadMs = await loadModel(`soak-reload-${tick}`);
      result = { operation: 'unload-reload', pass: afterUnload.loaded_model === null && reloadMs > 0, reload_ms: reloadMs };
    } else if (tick > 0 && tick % 8 === 6) {
      result = { operation: 'cancellation', pass: await testCancellation() };
    } else if (tick % 4 === 1) {
      const streamed = await streamInference(`soak-${tick}`);
      result = { operation: 'stream', pass: streamed.text.length > 0 };
    } else {
      const inferred = await normalInference(`soak-${tick}`);
      result = { operation: 'inference', pass: inferred.text.length > 0 };
    }
    const after = sampleSystemResources();
    soakSamples.push({ at: new Date().toISOString(), sample: after });
    await emit('SOAK_TICK', { tick, elapsed_ms: Date.now() - start, ...result, sample: after });
    if (!result.pass) throw new Error(`soak operation failed at tick ${tick}`);
    if (!inRunResourceGate(after)) {
      await emit('SOAK_GUARD_STOP', { tick, reason: 'post-operation in-run resource envelope crossed', sample: after });
      break;
    }
    tick += 1;
    await new Promise(resolve => setTimeout(resolve, Math.min(60_000, Math.max(0, stopAt - Date.now()))));
  }
  const durationMs = Date.now() - start;
  const first = soakSamples[0]?.sample ?? null;
  const last = soakSamples.at(-1)?.sample ?? null;
  const minFreeRam = Math.min(...soakSamples.map(item => item.sample.free_ram_bytes));
  const minFreeCommit = Math.min(...soakSamples.map(item => item.sample.commit_free_bytes));
  const gpuUsed = soakSamples.flatMap(item => item.sample.gpu ? [item.sample.gpu.used_mib] : []);
  const maxGpuUsed = Math.max(...gpuUsed);
  const completed = durationMs >= soakMinutes * 60_000 && tick > 0;
  await emit('SOAK_SUMMARY', {
    target_minutes: soakMinutes, duration_ms: durationMs, ticks: tick,
    samples: soakSamples.length, completed,
    request_count: inferenceLatencies.length,
    failures: 0,
    min_free_ram_bytes: Number.isFinite(minFreeRam) ? minFreeRam : null,
    min_free_commit_bytes: Number.isFinite(minFreeCommit) ? minFreeCommit : null,
    max_gpu_used_mib: Number.isFinite(maxGpuUsed) ? maxGpuUsed : null,
    gpu_used_start_end_mib: first?.gpu && last?.gpu ? [first.gpu.used_mib, last.gpu.used_mib] : null,
    free_ram_start_end: first && last ? [first.free_ram_bytes, last.free_ram_bytes] : null,
    commit_start_end: first && last ? [first.commit_free_bytes, last.commit_free_bytes] : null,
    runtime_process_count_start_end: first && last ? [first.runtime_process_count, last.runtime_process_count] : null,
    inference_latency_first_last_ms: inferenceLatencies.length > 0 ? [inferenceLatencies[0], inferenceLatencies.at(-1)] : null
  });
  if (!completed) throw new Error('bounded soak did not reach its requested duration');
}

async function cleanup() {
  if (broker && adapter) {
    try {
      const status = await broker.status();
      if (status.ownership === 'COVERT_OWNED') {
        if (status.loaded_model?.model_id === modelId) await broker.unload(modelId);
        await broker.shutdown();
      }
      const final = await broker.status();
      const listenerCheck = powershellJson(`$l=@(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue); [pscustomobject]@{listeners=$l.Count}|ConvertTo-Json -Compress`);
      await emit('FINAL_CLEANUP', {
        health: final.health, ownership: final.ownership,
        model_loaded: final.loaded_model !== null,
        listener_count: listenerCheck.listeners,
        credential_value_logged: false,
        pass: final.health === 'STOPPED' && final.loaded_model === null && listenerCheck.listeners === 0
      });
    } catch (error) {
      await emit('FINAL_CLEANUP', { pass: false, error_code: error?.code ?? 'CLEANUP_FAILED', details_redacted: true });
      phaseFailure ??= 'CLEANUP_FAILED';
    }
  }
  if (authority) authority.control.close();
  if (fixturePath) await rm(fixturePath, { force: true }).catch(() => {});
}

async function main() {
  requireConfigured();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(qualificationRoot, { recursive: true });
  const initialResources = sampleSystemResources();
  const gate = startResourceGate(initialResources);
  await emit('RESOURCE_PREFLIGHT', { ...gate, sample: initialResources });
  if (!gate.pass) throw new Error('machine did not meet the conservative runtime start guardrail');
  const artifact = await checkedArtifact();
  await emit('ARTIFACT_IDENTITY', { pass: true, ...artifact });
  makeRuntime();
  await broker.discover();
  const before = await broker.status();
  await emit('INSTALL_RECONCILIATION', {
    installation: before.version ? 'INSTALLED_VERSION_MATCHED_RUNTIME_STOPPED' : 'NOT_RECOGNIZED',
    version: before.version,
    expected_version: expectedVersion,
    version_matched: before.version === expectedVersion,
    health_before_start: before.health,
    ownership_before_start: before.ownership,
    action: 'NO_DESTRUCTIVE_REINSTALL_REQUIRED',
    root_accessible: true
  });
  if (before.version !== expectedVersion || before.health !== 'STOPPED' || before.ownership !== 'UNKNOWN' || before.port !== port) {
    throw new Error('install identity, current runtime state, or dedicated port preflight failed');
  }
  apiKey = await credentialStore.get(UNSLOTH_API_KEY_CREDENTIAL_ID);
  if (!apiKey || apiKey.trim().length === 0) throw new Error('DPAPI-backed local API credential unavailable');
  const coldLoadMs = await loadModel('cold-start-first-load');
  const healthyStatus = await broker.status();
  const models = await broker.models();
  await emit('HEALTH_AND_MODEL', {
    healthy: healthyStatus.health === 'HEALTHY',
    ownership: healthyStatus.ownership,
    version: healthyStatus.version,
    loaded_hash: healthyStatus.loaded_model?.artifact_sha256,
    models_count: models.length,
    model_ids: models.map(model => model.model_id),
    cold_total_ms: coldLoadMs
  });
  if (healthyStatus.health !== 'HEALTHY' || healthyStatus.ownership !== 'COVERT_OWNED' || healthyStatus.loaded_model?.artifact_sha256?.toLowerCase() !== expectedSha256) throw new Error('post-load health or artifact identity failed');
  if (models.length === 0) throw new Error('Unsloth model enumeration returned no model after successful load');
  const authPass = await testAuthentication();
  if (!authPass) throw new Error('local bearer authentication verification failed');
  const first = await normalInference('normal-inference');
  if (first.text.length === 0) throw new Error('normal inference returned empty output');
  const streamed = await streamInference('streaming-inference');
  if (streamed.text.length === 0) throw new Error('streaming returned no text');
  const cancelled = await testCancellation();
  if (!cancelled) throw new Error('runtime cancellation or post-cancel recovery failed');
  const bad = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: '{}'
  });
  const recovered = await normalInference('failed-request-recovery');
  await emit('FAILED_REQUEST_RECOVERY', { invalid_request_status: bad.status, subsequent_inference_ok: recovered.text.length > 0, health: await broker.health() });
  if (bad.status < 400 || !recovered.text.length || await broker.health() !== 'HEALTHY') throw new Error('failed request recovery failed');

  const rangeSchema = z.object({ minimum: z.number().int(), maximum: z.number().int(), status: z.enum(['ok', 'needs_review']) }).strict();
  const nativeStructured = await strictStructuredOutputCheck(rangeSchema);
  const rejectedStructured = classifyStructuredOutput('{"minimum":2,"maximum":9,"status":"ok"} trailing prose', rangeSchema);
  const failClosed = rejectedStructured.disposition === 'NEEDS_REVIEW' && rejectedStructured.fallback === 'NEEDS_REVIEW' && rejectedStructured.retry_count === 0 && !('value' in rejectedStructured);
  await emit('STRUCTURED_COVERT_VALIDATION', {
    classification: rejectedStructured.disposition,
    rejection_reason: rejectedStructured.disposition === 'NEEDS_REVIEW' ? rejectedStructured.reason : null,
    fallback: rejectedStructured.fallback,
    retry_count: rejectedStructured.retry_count,
    accepted_value_present: 'value' in rejectedStructured,
    no_false_acceptance: rejectedStructured.disposition !== 'ACCEPTED',
    pass: failClosed
  });
  if (!failClosed) throw new Error('Covert structured-output validation accepted a malformed result or lacked deterministic fallback');
  const adapterStructured = await broker.infer({ ...baseRequest('Return JSON only.', 512), responseFormat: { type: 'json_schema', json_schema: { strict: true } } })
    .then(() => ({ rejected: false, code: null }), error => ({ rejected: error?.code === 'CAPABILITY_UNKNOWN', code: error?.code ?? null }));
  await emit('STRUCTURED_ADAPTER_BOUNDARY', { response_format_rejected_before_remote: adapterStructured.rejected, error_code: adapterStructured.code });
  if (!nativeStructured.accepted && !adapterStructured.rejected) throw new Error('structured output did not fail closed at the broker boundary');

  const toolSchema = z.object({ path: z.literal(fixtureName) }).strict();
  const tool = await toolLoop(toolSchema);
  await emit('TOOL_SUMMARY', { execution_loop_pass: tool.loopPassed, malformed_no_execution_pass: tool.malformedRejected, capability: 'PARTIAL', repair_attribution: 'UNKNOWN' });
  if (!tool.loopPassed || !tool.malformedRejected) throw new Error('harmless runtime tool loop or malformed-call rejection failed');

  const warmUnloadStart = performance.now();
  await broker.unload(modelId);
  const unloaded = await broker.status();
  const unloadMs = performance.now() - warmUnloadStart;
  if (unloaded.loaded_model !== null) throw new Error('model unload did not clear broker identity');
  const warmReloadMs = await loadModel('warm-reload-after-unload');
  await emit('WARM_LIFECYCLE', { unload_ms: unloadMs, reload_ms: warmReloadMs, unload_pass: true, reload_pass: warmReloadMs > 0 });

  await soak();
  await emit('QUALIFICATION_RUN_COMPLETE', {
    version: expectedVersion,
    backend: 'VULKAN',
    artifact_sha256: expectedSha256,
    tool_capability: 'PARTIAL',
    structured_output: 'NOT_SUPPORTED — COVERT VALIDATION REQUIRED',
    execution_environment: 'WINDOWS_NATIVE_ADMINISTRATOR',
    hard_crash_injected: false,
    restart_test_method: 'adapter-owned runtime stop and restart'
  });
}

try {
  await main();
} catch (error) {
  phaseFailure = error?.code ?? error?.message ?? 'QUALIFICATION_FAILED';
  await emit('QUALIFICATION_FAILURE', { code: error?.code ?? null, details_redacted: true });
  process.exitCode = 1;
} finally {
  await cleanup();
}
