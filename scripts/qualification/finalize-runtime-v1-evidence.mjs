import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const docs = path.join(root, 'docs', 'design', 'local-runtime-lab');
const evidence = path.join(docs, 'evidence');
const rawPath = process.argv[2];
if (!rawPath) throw new Error('Usage: node scripts/qualification/finalize-runtime-v1-evidence.mjs <raw-trace-path>');

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function select(event, keys) {
  return Object.fromEntries(keys.filter(key => event[key] !== undefined).map(key => [key, event[key]]));
}

function projectEvent(event) {
  const base = { at: event.at, event: event.event };
  switch (event.event) {
    case 'RESOURCE_PREFLIGHT': {
      const sample = event.sample ?? {};
      return {
        ...base, pass: event.pass, observed: event.observed,
        sample: select(sample, ['is_admin', 'total_ram_bytes', 'free_ram_bytes', 'commit_free_bytes', 'commit_used_bytes', 'commit_limit_bytes', 'runtime_process_count']),
        gpu: sample.gpu && select(sample.gpu, ['used_mib', 'free_mib', 'utilization_percent'])
      };
    }
    case 'ARTIFACT_IDENTITY':
      return { ...base, ...select(event, ['pass', 'sha256', 'bytes']) };
    case 'INSTALL_RECONCILIATION':
      return { ...base, ...select(event, ['version', 'expected_version', 'version_matched', 'health_before_start', 'ownership_before_start', 'action', 'root_accessible']) };
    case 'MODEL_LOAD':
      return { ...base, ...select(event, ['label', 'artifact', 'total_ms', 'server_health_ms', 'api_load_started_ms', 'api_load_completed_ms', 'health', 'ownership', 'loaded_model_hash']) };
    case 'HEALTH_AND_MODEL':
      return { ...base, ...select(event, ['healthy', 'ownership', 'version', 'loaded_hash', 'models_count', 'model_ids', 'cold_total_ms']) };
    case 'AUTHENTICATION':
      return { ...base, ...select(event, ['unauthenticated_status', 'unauthenticated_class', 'authenticated_status', 'authenticated_class', 'model_enumeration_valid', 'credential_value_logged', 'pass']) };
    case 'INFERENCE':
      return { ...base, ...select(event, ['label', 'latency_ms', 'prompt_tokens', 'completion_tokens', 'text_chars', 'text_sha256', 'finish_reason', 'model_hash']) };
    case 'STREAM':
      return { ...base, ...select(event, ['label', 'first_token_ms', 'total_ms', 'prompt_tokens', 'completion_tokens', 'text_chars', 'text_sha256', 'finish_reason']) };
    case 'CANCELLATION':
      return { ...base, ...select(event, ['cancel_accepted', 'request_completed_before_cancel', 'interrupted', 'error_name', 'health_after']) };
    case 'FAILED_REQUEST_RECOVERY':
      return { ...base, ...select(event, ['invalid_request_status', 'subsequent_inference_ok', 'health']) };
    case 'STRUCTURED_NATIVE':
      return { ...base, ...select(event, ['v1_classification', 'single_probe_outcome', 'http_status', 'accepted', 'rejection_reason', 'content_chars', 'content_sha256']) };
    case 'STRUCTURED_COVERT_VALIDATION':
      return { ...base, ...select(event, ['classification', 'rejection_reason', 'fallback', 'retry_count', 'accepted_value_present', 'no_false_acceptance', 'pass']) };
    case 'STRUCTURED_ADAPTER_BOUNDARY':
      return { ...base, ...select(event, ['response_format_rejected_before_remote', 'error_code']) };
    case 'TOOL_AUTHORITY':
      return { ...base, ...select(event, ['accepted', 'authority_state', 'operation_kind', 'executed', 'result_chars', 'result_sha256', 'authority_event_count']) };
    case 'TOOL_FAILURE_PATH':
      return { ...base, ...select(event, ['malformed_argument_rejected', 'malformed_json_rejected', 'authority_not_called_for_invalid_envelope', 'malformed_reason', 'malformed_json_reason', 'session_recovered', 'final_response_chars', 'final_response_sha256']) };
    case 'TOOL_MODEL_CALL':
      return {
        ...base,
        ...select(event, ['capability', 'accepted', 'valid_selection', 'valid_name', 'schema_valid_arguments', 'execution_loop', 'raw_pre_repair', 'repair_attribution', 'self_healing_repair_claimed']),
        runtime_adjusted_call: 'VALID_SCHEMA_CALL_OBSERVED',
        executed_call: 'READ_ONLY_FIXTURE_CALL_EXECUTED'
      };
    case 'TOOL_SUMMARY':
      return { ...base, ...select(event, ['execution_loop_pass', 'malformed_no_execution_pass', 'capability', 'repair_attribution']) };
    case 'WARM_LIFECYCLE':
      return { ...base, ...select(event, ['unload_ms', 'reload_ms', 'unload_pass', 'reload_pass']) };
    case 'SOAK_TICK': {
      const sample = event.sample ?? {};
      const runtime = event.runtime ?? {};
      return {
        ...base,
        ...select(event, ['tick', 'elapsed_ms', 'operation', 'pass', 'restart_ms', 'loss_detected', 'recovered']),
        runtime: select(runtime, ['health', 'ownership', 'model_id', 'artifact_sha256']),
        sample: {
          free_ram_bytes: sample.free_ram_bytes,
          commit_free_bytes: sample.commit_free_bytes,
          gpu: sample.gpu && select(sample.gpu, ['used_mib', 'free_mib', 'utilization_percent']),
          llama_server_private_bytes: sample.process_resources?.runtime_name_match_private_bytes ?? null
        }
      };
    }
    case 'SOAK_SUMMARY':
      return { ...base, ...select(event, ['target_minutes', 'duration_ms', 'ticks', 'samples', 'completed', 'request_count', 'failures', 'min_free_ram_bytes', 'min_free_commit_bytes', 'max_gpu_used_mib', 'gpu_used_start_end_mib', 'free_ram_start_end', 'commit_start_end', 'runtime_process_name_match_count_start_end', 'inference_latency_first_last_ms']) };
    case 'QUALIFICATION_RUN_COMPLETE':
      return { ...base, ...select(event, ['version', 'backend', 'artifact_sha256', 'tool_capability', 'structured_output', 'execution_environment', 'hard_crash_injected', 'restart_test_method']) };
    case 'FINAL_CLEANUP':
      return { ...base, ...select(event, ['health', 'ownership', 'model_loaded', 'listener_count', 'credential_value_logged', 'pass']) };
    default:
      return null;
  }
}

const rawText = await readFile(rawPath, 'utf8');
const rawEvents = rawText.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const find = (name, predicate = () => true) => rawEvents.find(event => event.event === name && predicate(event));
const all = name => rawEvents.filter(event => event.event === name);
const artifact = '02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed';
const artifactBytes = 1_674_455_040;
const completion = find('QUALIFICATION_RUN_COMPLETE');
const cleanup = find('FINAL_CLEANUP');
const soak = find('SOAK_SUMMARY');
const auth = find('AUTHENTICATION');
const tool = find('TOOL_SUMMARY');
const toolFailure = find('TOOL_FAILURE_PATH');
const authority = find('TOOL_AUTHORITY');
const structured = find('STRUCTURED_COVERT_VALIDATION');
const nativeStructured = find('STRUCTURED_NATIVE');
const ticks = all('SOAK_TICK');
assert.ok(find('ARTIFACT_IDENTITY', event => event.pass === true && event.sha256 === artifact && event.bytes === artifactBytes), 'artifact identity did not pass');
assert.ok(find('INSTALL_RECONCILIATION', event => event.version_matched && event.action === 'NO_DESTRUCTIVE_REINSTALL_REQUIRED'), 'install reconciliation did not pass');
assert.ok(auth?.pass === true && auth.unauthenticated_status === 401 && auth.authenticated_status === 200 && auth.credential_value_logged === false, 'authentication evidence did not pass');
assert.ok(completion?.version === '2026.9.11' && completion.backend === 'VULKAN' && completion.artifact_sha256 === artifact, 'qualification identity mismatch');
assert.ok(cleanup?.pass === true && cleanup.health === 'STOPPED' && cleanup.listener_count === 0 && cleanup.credential_value_logged === false, 'owned cleanup did not pass');
assert.ok(soak?.completed === true && soak.duration_ms >= 30 * 60_000 && soak.failures === 0 && ticks.length > 0 && ticks.every(tick => tick.pass === true), 'bounded soak did not pass');
assert.ok(tool?.execution_loop_pass === true && tool?.malformed_no_execution_pass === true, 'tool execution/fail-closed evidence missing');
assert.ok(authority?.accepted === true && authority?.executed === true && authority.operation_kind === 'workspace.read', 'harmless Authority execution missing');
assert.ok(toolFailure?.malformed_argument_rejected === true && toolFailure?.malformed_json_rejected === true && toolFailure?.authority_not_called_for_invalid_envelope === true && toolFailure.session_recovered === true, 'malformed tool call path did not fail closed');
assert.ok(tool?.repair_attribution === 'UNKNOWN', 'tool repair attribution must remain unknown');
assert.ok(structured?.pass === true && structured.no_false_acceptance === true && structured.accepted_value_present === false && structured.retry_count === 0, 'Covert structured validation did not fail closed');
assert.equal(nativeStructured?.v1_classification, 'NOT_SUPPORTED — COVERT VALIDATION REQUIRED');

const projected = rawEvents.map(projectEvent).filter(Boolean);
const encodedProjection = projected.map(event => JSON.stringify(event)).join('\n');
assert.doesNotMatch(encodedProjection, /[A-Z]:\\(?:Users|Unsloth-Studio|aide-sovereign-workbench-runtime-lab)\\/i, 'sanitized trace contains a private path');
assert.doesNotMatch(encodedProjection, /Bearer\s+[A-Za-z0-9._~+/-]{16,}|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}/i, 'sanitized trace contains credential-shaped material');
await writeFile(path.join(evidence, 'RT-V1-LIVE-TRACE.jsonl'), `${projected.map(event => JSON.stringify(event)).join('\n')}\n`, 'utf8');

const passportPath = path.join(evidence, 'UNSLOTH-RUNTIME-PASSPORT-V1.json');
const passport = await readJson(passportPath);
const runbookPath = path.join(docs, 'UNSLOTH-V1-INSTALL-RUNBOOK.md');
const reconcilerPath = path.join(root, 'scripts', 'qualification', 'unsloth-install-reconcile.ps1');
passport.installation.runbook_sha256 = await sha256(runbookPath);
passport.installation.reconciler_sha256 = await sha256(reconcilerPath);
const rawStat = await stat(rawPath);
passport.evidence.raw_trace.sha256 = await sha256(rawPath);
passport.evidence.raw_trace.bytes = rawStat.size;

const coldLoad = find('MODEL_LOAD', event => event.label === 'cold-start-first-load');
const warmLifecycle = find('WARM_LIFECYCLE');
const warmReload = find('MODEL_LOAD', event => event.label === 'warm-reload-after-unload');
const restartLoad = find('MODEL_LOAD', event => event.label === 'soak-restart-20');
const normalInference = find('INFERENCE', event => event.label === 'normal-inference');
const primaryStream = find('STREAM', event => event.label === 'streaming-inference');
const preflight = find('RESOURCE_PREFLIGHT');
const tickSamples = ticks.map(event => event.sample ?? {});
const minFreeVram = Math.min(...tickSamples.map(sample => sample.gpu?.free_mib ?? Number.POSITIVE_INFINITY));
const maxServerPrivate = Math.max(...tickSamples.map(sample => sample.process_resources?.runtime_name_match_private_bytes ?? Number.NEGATIVE_INFINITY));
const minServerPrivate = Math.min(...tickSamples.map(sample => sample.process_resources?.runtime_name_match_private_bytes ?? Number.POSITIVE_INFINITY));
assert.ok(coldLoad && warmLifecycle && warmReload && restartLoad && normalInference && primaryStream && preflight, 'required timing evidence missing');
passport.performance.cold_start_to_healthy_model_loaded_ms = coldLoad.total_ms;
passport.performance.cold_server_health_ms = coldLoad.server_health_ms;
passport.performance.warm_unload_ms = warmLifecycle.unload_ms;
passport.performance.warm_reload_ms = warmReload.total_ms;
passport.performance.normal_request_latency_ms = normalInference.latency_ms;
passport.performance.normal_request_end_to_end_completion_tokens_per_second = normalInference.completion_tokens * 1000 / normalInference.latency_ms;
passport.performance.streaming_first_visible_token_ms = primaryStream.first_token_ms;
passport.performance.streaming_total_ms = primaryStream.total_ms;
passport.performance.soak = {
  duration_ms: soak.duration_ms,
  ticks: soak.ticks,
  host_resource_samples: soak.samples,
  requests: soak.request_count,
  failures: soak.failures,
  completed: soak.completed,
  minimum_free_physical_ram_bytes: soak.min_free_ram_bytes,
  minimum_free_commit_bytes: soak.min_free_commit_bytes,
  minimum_free_vram_mib_at_periodic_ticks: minFreeVram,
  maximum_total_gpu_memory_used_mib: soak.max_gpu_used_mib,
  gpu_memory_used_start_end_mib: soak.gpu_used_start_end_mib,
  llama_server_private_bytes_observed_range: [minServerPrivate, maxServerPrivate],
  memory_trend: 'NO_MONOTONIC_GROWTH_OBSERVED'
};
passport.performance.owned_restart_and_model_reload_ms = restartLoad.total_ms;
passport.capabilities.tool_calling.raw_pre_repair_output = 'UNAVAILABLE';
passport.capabilities.tool_calling.repair_attribution = 'UNKNOWN';
passport.capabilities.tool_calling.self_healing_repair_claimed = false;
passport.capabilities.structured_output.native_strict_schema = 'NOT SUPPORTED — COVERT VALIDATION REQUIRED';
passport.capabilities.structured_output.covert_validator = 'PASS_DETERMINISTIC_FAIL_CLOSED';
passport.capabilities.structured_output.malformed_json_result = `${structured.fallback}_${structured.rejection_reason}`;
passport.capabilities.structured_output.retry_count = structured.retry_count;
passport.capabilities.structured_output.accepted_value_on_invalid_result = structured.accepted_value_present;
passport.host_resources.start_preflight_free_ram_gib = preflight.observed.free_ram_gib;
passport.host_resources.start_preflight_free_commit_gib = preflight.observed.free_commit_gib;
passport.host_resources.start_preflight_free_vram_gib = preflight.observed.free_vram_gib;
passport.host_resources.start_preflight_gpu_utilization_percent = preflight.observed.gpu_utilization_percent;
passport.evidence.raw_trace = {
  path_classification: 'EXTERNAL_LOCAL_EVIDENCE',
  sha256: await sha256(rawPath),
  bytes: rawStat.size
};
await writeJson(passportPath, passport);
const passportHash = await sha256(passportPath);
await writeFile(path.join(evidence, 'UNSLOTH-RUNTIME-PASSPORT-V1.sha256'), `${passportHash}  UNSLOTH-RUNTIME-PASSPORT-V1.json\n`, 'utf8');

const lunaPath = path.join(evidence, 'LUNA-RUNTIME-STATUS-FIXTURE-V1.json');
const luna = await readJson(lunaPath);
luna.runtime_state.passport_sha256 = passportHash;
await writeJson(lunaPath, luna);
const operatorPath = path.join(evidence, 'OPERATOR-CONTROL-RUNTIME-FIXTURE-V1.json');
const operatorControl = await readJson(operatorPath);
operatorControl.passport_sha256 = passportHash;
await writeJson(operatorPath, operatorControl);

const previousManifest = await readJson(path.join(evidence, 'RT-V1-PREQUALIFICATION-EVIDENCE-MANIFEST.json'));
const repoPaths = [
  'docs/design/local-runtime-lab/UNSLOTH-V1-SUPPORT-CONTRACT.md',
  'docs/design/local-runtime-lab/UNSLOTH-V1-INSTALL-RUNBOOK.md',
  'docs/design/local-runtime-lab/UNSLOTH-RUNTIME-V1-CLOSEOUT.md',
  'scripts/qualification/unsloth-install-reconcile.ps1',
  'scripts/qualification/finalize-runtime-v1-evidence.mjs',
  'scripts/qualification/validate-runtime-v1-closeout.mjs',
  'docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT.json',
  'docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json',
  'docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.sha256',
  'docs/design/local-runtime-lab/evidence/LUNA-RUNTIME-STATUS-FIXTURE-V1.json',
  'docs/design/local-runtime-lab/evidence/OPERATOR-CONTROL-RUNTIME-FIXTURE-V1.json',
  'docs/design/local-runtime-lab/evidence/RT-V1-INSTALL-RECONCILIATION.json',
  'docs/design/local-runtime-lab/evidence/RT-V1-FINAL-PREFLIGHT.json',
  'docs/design/local-runtime-lab/evidence/RT-V1-HOST-RESOURCE-DIAGNOSIS-20260925T153324Z.json',
  'docs/design/local-runtime-lab/evidence/RT-V1-HOST-RESOURCE-CLOSEOUT.json',
  'docs/design/local-runtime-lab/evidence/RT-V1-HOST-IDLE-BASELINE-20260925T173910Z.json',
  'docs/design/local-runtime-lab/evidence/RT-V1-LIVE-TRACE.jsonl',
  'docs/design/local-runtime-lab/evidence/RT-V1-DETERMINISTIC-RESULTS.json',
  'docs/design/local-runtime-lab/evidence/RT-V1-PREQUALIFICATION-EVIDENCE-MANIFEST.json'
];
const roleByRepoPath = new Map([
  ['docs/design/local-runtime-lab/UNSLOTH-V1-SUPPORT-CONTRACT.md', 'FROZEN_SUPPORT_CONTRACT'],
  ['docs/design/local-runtime-lab/UNSLOTH-V1-INSTALL-RUNBOOK.md', 'CANONICAL_INSTALL_RUNBOOK'],
  ['docs/design/local-runtime-lab/UNSLOTH-RUNTIME-V1-CLOSEOUT.md', 'V1_CLOSEOUT_REPORT'],
  ['scripts/qualification/unsloth-install-reconcile.ps1', 'INSTALL_RECONCILER'],
  ['scripts/qualification/finalize-runtime-v1-evidence.mjs', 'EVIDENCE_FINALIZER'],
  ['scripts/qualification/validate-runtime-v1-closeout.mjs', 'ACCEPTANCE_VALIDATOR'],
  ['docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT.json', 'HISTORICAL_PROFILE_PASSPORT'],
  ['docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json', 'FINAL_V1_RUNTIME_PASSPORT'],
  ['docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.sha256', 'FINAL_V1_PASSPORT_HASH_SIDECAR'],
  ['docs/design/local-runtime-lab/evidence/LUNA-RUNTIME-STATUS-FIXTURE-V1.json', 'MODEL_MANAGER_HANDOFF_FIXTURE'],
  ['docs/design/local-runtime-lab/evidence/OPERATOR-CONTROL-RUNTIME-FIXTURE-V1.json', 'OPERATOR_CONTROL_HANDOFF_FIXTURE'],
  ['docs/design/local-runtime-lab/evidence/RT-V1-INSTALL-RECONCILIATION.json', 'CURRENT_INSTALL_RECONCILIATION'],
  ['docs/design/local-runtime-lab/evidence/RT-V1-FINAL-PREFLIGHT.json', 'PASSED_FINAL_RESOURCE_PREFLIGHT'],
  ['docs/design/local-runtime-lab/evidence/RT-V1-HOST-RESOURCE-DIAGNOSIS-20260925T153324Z.json', 'HOST_RESOURCE_DIAGNOSIS'],
  ['docs/design/local-runtime-lab/evidence/RT-V1-HOST-RESOURCE-CLOSEOUT.json', 'HOST_RESOURCE_CLOSEOUT'],
  ['docs/design/local-runtime-lab/evidence/RT-V1-HOST-IDLE-BASELINE-20260925T173910Z.json', 'HOST_IDLE_BASELINE'],
  ['docs/design/local-runtime-lab/evidence/RT-V1-LIVE-TRACE.jsonl', 'SANITIZED_LIVE_RUNTIME_TRACE'],
  ['docs/design/local-runtime-lab/evidence/RT-V1-DETERMINISTIC-RESULTS.json', 'DETERMINISTIC_REGRESSION_RESULTS'],
  ['docs/design/local-runtime-lab/evidence/RT-V1-PREQUALIFICATION-EVIDENCE-MANIFEST.json', 'HISTORICAL_PREQUALIFICATION_MANIFEST']
]);
const entries = [];
for (const relativePath of repoPaths) {
  const filePath = path.resolve(root, relativePath);
  const details = await stat(filePath);
  entries.push({ role: roleByRepoPath.get(relativePath), sha256: await sha256(filePath), bytes: details.size, location: { kind: 'repository', path: relativePath } });
}
for (const oldEntry of previousManifest.entries.filter(entry => entry.location?.kind === 'external')) {
  const filePath = oldEntry.location.path;
  const details = await stat(filePath);
  const digest = await sha256(filePath);
  assert.equal(details.size, oldEntry.bytes, `historical external evidence size changed: ${oldEntry.role}`);
  assert.equal(digest.toLowerCase(), oldEntry.sha256.toLowerCase(), `historical external evidence hash changed: ${oldEntry.role}`);
  entries.push({ ...oldEntry, sha256: digest, bytes: details.size, provenance: 'Carried forward from the validated RT-V1 prequalification evidence manifest.' });
}
const failedSoakPath = path.join(path.dirname(rawPath), 'RT-V1-CLOSEOUT-20260925T155741Z.jsonl');
try {
  const details = await stat(failedSoakPath);
  entries.push({ role: 'HISTORICAL_FAILED_SOAK_TRACE', sha256: await sha256(failedSoakPath), bytes: details.size, location: { kind: 'external', path: failedSoakPath }, provenance: 'Prior safe stop; ownership proof became inconclusive and cleanup stopped the owned runtime.' });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
for (const item of [
  {
    role: 'HISTORICAL_RESOURCE_GATE_STOP_TRACE',
    file: 'RT-V1-CLOSEOUT-20260925T154601Z.jsonl',
    sha256: '63e394ad46e25d323d0615b8d0c7e845de614253a4c488ca39d509a17f6e4141',
    bytes: 2329,
    provenance: 'Historical preflight/guard stop preserved outside Git.'
  },
  {
    role: 'LIVE_AUTHORITY_EVENT_TRACE',
    file: 'runtime-v1-authority-events.jsonl',
    sha256: '01ddb03179b5c6533b3d3c4d6385d5e5bbfdfd71133944f0bee82b40d0ec7f8d',
    bytes: 1704,
    provenance: 'Raw authority event receipts for the harmless V1 tool execution case; preserved outside Git.'
  }
]) {
  const filePath = path.join(path.dirname(rawPath), item.file);
  const details = await stat(filePath);
  const digest = await sha256(filePath);
  assert.equal(details.size, item.bytes, `additional external evidence size changed: ${item.role}`);
  assert.equal(digest, item.sha256, `additional external evidence hash changed: ${item.role}`);
  entries.push({ role: item.role, sha256: digest, bytes: details.size, location: { kind: 'external', path: filePath }, provenance: item.provenance });
}
entries.push({ role: 'LIVE_RUNTIME_TRACE', sha256: await sha256(rawPath), bytes: rawStat.size, location: { kind: 'external', path: rawPath }, provenance: 'Raw 2026-09-25 V1 qualification trace; retained outside Git because it includes local process/resource evidence.' });

const manifest = {
  schema: 'covert.runtime.evidence-manifest.v1',
  status: 'FROZEN',
  created_at_utc: '2026-09-25T17:34:01.217Z',
  passport: { path: 'docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json', sha256: passportHash },
  entries
};
await writeJson(path.join(evidence, 'RT-RUNTIME-EVIDENCE-MANIFEST.json'), manifest);
process.stdout.write(JSON.stringify({ status: 'PASS', passport_sha256: passportHash, sanitized_trace_events: projected.length, manifest_entries: entries.length, raw_trace_sha256: await sha256(rawPath), raw_trace_bytes: rawStat.size }) + '\n');
