// Harness Lab — Battery v1 evaluator.
//
// Pure and deterministic: a task definition plus a model response evaluates to
// the same checks every time. Verification is OBJECTIVE — fixture regexes,
// structural expectations, and real executions of the candidate artifact (a
// corrected module is run against the fixture's check, and a model-authored
// regression test must pass on the fixed module and FAIL on the buggy one).
// The model never grades itself.
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LAB_DIR = path.dirname(fileURLToPath(import.meta.url));

export class BatteryDefinitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BatteryDefinitionError';
  }
}

const KNOWN_CHECK_TYPES = new Set([
  'contains_all',
  'not_contains',
  'regex',
  'first_line_regex',
  'sop_sections',
  'exec_fenced_file',
  'exec_regression_test'
]);

export async function loadBattery({ file = path.join(LAB_DIR, 'tasks.json') } = {}) {
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) throw new BatteryDefinitionError('battery has no tasks');
  const ids = new Set();
  for (const task of raw.tasks) {
    if (typeof task.id !== 'string' || !task.id) throw new BatteryDefinitionError('task id missing');
    if (ids.has(task.id)) throw new BatteryDefinitionError(`duplicate task id ${task.id}`);
    ids.add(task.id);
    if (task.executor !== 'chat') throw new BatteryDefinitionError(`task ${task.id}: unsupported executor ${task.executor}`);
    if (typeof task.prompt !== 'string' || !task.prompt) throw new BatteryDefinitionError(`task ${task.id}: prompt missing`);
    if (!Array.isArray(task.checks) || task.checks.length === 0) throw new BatteryDefinitionError(`task ${task.id}: checks missing`);
    for (const check of task.checks) {
      if (!KNOWN_CHECK_TYPES.has(check.type)) throw new BatteryDefinitionError(`task ${task.id}: unknown check type ${check.type}`);
    }
  }
  return raw;
}

export function extractFenced(text, marker, language) {
  const index = text.indexOf(marker);
  if (index < 0) return null;
  const after = text.slice(index);
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match;
  while ((match = fence.exec(after)) !== null) {
    const lang = (match[1] ?? '').trim().toLowerCase();
    const body = match[2] ?? '';
    if (body.trim().length === 0) continue;
    if (language === undefined || language === null || lang === '' || lang === language) return body;
  }
  return null;
}

async function defaultRunNode(entry, cwd, timeoutMs) {
  return new Promise(resolve => {
    execFile(process.execPath, [entry], { cwd, timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error === null ? 0 : typeof error.code === 'number' ? error.code : 1;
      resolve({ code, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
  });
}

function checkContains(response, values, mode) {
  for (const value of values) {
    const present = mode === 'not_contains'
      ? response.toLowerCase().includes(String(value).toLowerCase())
      : response.includes(value);
    if (mode === 'not_contains' && present) return { passed: false, detail: `forbidden content present: ${JSON.stringify(value)}` };
    if (mode === 'contains_all' && !present) return { passed: false, detail: `missing required content: ${JSON.stringify(value)}` };
  }
  return { passed: true, detail: `${values.length} value(s) checked` };
}

function sectionBody(response, header) {
  const lines = response.split(/\r?\n/);
  let start = -1;
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trim() === header.trim()) { start = index + 1; break; }
  }
  if (start < 0) return null;
  const body = [];
  for (let index = start; index < lines.length; index++) {
    if (/^##\s/.test(lines[index].trim())) break;
    body.push(lines[index]);
  }
  return body;
}

function evaluateSop(response, spec) {
  if (spec.forbid_fences === true && response.includes('```')) return { passed: false, detail: 'code fences present' };
  for (const section of spec.sections ?? []) {
    const body = sectionBody(response, section.header);
    if (body === null) return { passed: false, detail: `section missing: ${section.header}` };
    const numbered = body.filter(line => /^\s*\d+[.)]\s+/.test(line)).length;
    const bullets = body.filter(line => /^\s*[-*]\s+/.test(line)).length;
    const sentences = body.filter(line => line.trim().length > 0 && !/^\s*(\d+[.)]|[-*])\s+/.test(line)).length;
    if (section.numbered !== undefined && numbered !== section.numbered) return { passed: false, detail: `${section.header}: expected ${section.numbered} numbered item(s), found ${numbered}` };
    if (section.bullets !== undefined && bullets !== section.bullets) return { passed: false, detail: `${section.header}: expected ${section.bullets} bullet(s), found ${bullets}` };
    if (section.sentences !== undefined && sentences !== section.sentences) return { passed: false, detail: `${section.header}: expected ${section.sentences} sentence(s), found ${sentences}` };
  }
  return { passed: true, detail: 'SOP structure matched' };
}

async function evaluateExecFencedFile({ check, response, scratchDir, fixturesDir, runNode }) {
  const body = extractFenced(response, check.marker, check.language);
  if (body === null) return { passed: false, detail: `extraction: no ${check.language} block after marker ${check.marker}`, executed: 0, tests_passed: 0, tests_failed: 0 };
  if (Buffer.byteLength(body) > (check.max_bytes ?? 20000)) return { passed: false, detail: 'extraction: candidate exceeds size cap', executed: 0, tests_passed: 0, tests_failed: 0 };
  const target = path.join(scratchDir, check.file_name);
  const fixtureEntry = path.join(fixturesDir, check.fixture, check.entry);
  await fs.mkdir(scratchDir, { recursive: true });
  await fs.writeFile(target, body, 'utf8');
  await fs.copyFile(fixtureEntry, path.join(scratchDir, check.entry));
  const run = await runNode(check.entry, scratchDir, check.timeout_ms ?? 20000);
  const stderrLine = String(run.stderr).split(/\r?\n/).find(line => line.trim().length > 0) ?? '';
  if (run.code === 0) return { passed: true, detail: `${check.entry} exited 0`, executed: 1, tests_passed: 1, tests_failed: 0 };
  return { passed: false, detail: `${check.entry} exited ${run.code}: ${stderrLine.slice(0, 160)}`, executed: 1, tests_passed: 0, tests_failed: 1 };
}

async function evaluateExecRegression({ check, response, scratchDir, fixturesDir, runNode }) {
  const body = extractFenced(response, check.marker, check.language);
  if (body === null) return { passed: false, detail: `extraction: no ${check.language} block after marker ${check.marker}`, executed: 0, tests_passed: 0, tests_failed: 0 };
  if (Buffer.byteLength(body) > (check.max_bytes ?? 20000)) return { passed: false, detail: 'extraction: candidate exceeds size cap', executed: 0, tests_passed: 0, tests_failed: 0 };
  const fixedDir = path.join(scratchDir, 'fixed');
  const buggyDir = path.join(scratchDir, 'buggy');
  await fs.mkdir(fixedDir, { recursive: true });
  await fs.mkdir(buggyDir, { recursive: true });
  await fs.writeFile(path.join(fixedDir, check.entry), body, 'utf8');
  await fs.writeFile(path.join(buggyDir, check.entry), body, 'utf8');
  await fs.copyFile(path.join(fixturesDir, check.fixture_fixed), path.join(fixedDir, check.module_name));
  await fs.copyFile(path.join(fixturesDir, check.fixture_buggy), path.join(buggyDir, check.module_name));
  const fixedRun = await runNode(check.entry, fixedDir, check.timeout_ms ?? 20000);
  const buggyRun = await runNode(check.entry, buggyDir, check.timeout_ms ?? 20000);
  const fixedOk = fixedRun.code === 0;
  const buggyCaught = buggyRun.code !== 0;
  const testsPassed = (fixedOk ? 1 : 0) + (buggyCaught ? 1 : 0);
  const testsFailed = (fixedOk ? 0 : 1) + (buggyCaught ? 0 : 1);
  if (!fixedOk) {
    const stderrLine = String(fixedRun.stderr).split(/\r?\n/).find(line => line.trim().length > 0) ?? '';
    return { passed: false, detail: `test failed against the fixed module (exit ${fixedRun.code}): ${stderrLine.slice(0, 140)}`, executed: 2, tests_passed: testsPassed, tests_failed: testsFailed };
  }
  if (!buggyCaught) return { passed: false, detail: 'test does not discriminate: it also passes against the buggy module', executed: 2, tests_passed: testsPassed, tests_failed: testsFailed };
  return { passed: true, detail: 'test passed on fixed and failed on buggy (discriminates)', executed: 2, tests_passed: testsPassed, tests_failed: testsFailed };
}

export async function evaluateTask({ task, responseText, scratchDir, runNode = defaultRunNode, fixturesDir = path.join(LAB_DIR, 'fixtures') }) {
  const response = String(responseText ?? '');
  const checks = [];
  let executedCommands = 0;
  let testsPassed = 0;
  let testsFailed = 0;
  let extractionFailed = false;

  for (const check of task.checks) {
    let outcome;
    switch (check.type) {
      case 'contains_all':
      case 'not_contains':
        outcome = checkContains(response, check.values ?? [], check.type);
        break;
      case 'regex': {
        const match = new RegExp(check.pattern, check.flags ?? '').exec(response);
        outcome = { passed: match !== null, detail: match !== null ? `matched /${check.pattern}/` : `no match for /${check.pattern}/` };
        break;
      }
      case 'first_line_regex': {
        const firstLine = response.split(/\r?\n/).find(line => line.trim().length > 0) ?? '';
        const match = new RegExp(check.pattern, check.flags ?? '').exec(firstLine.trim());
        outcome = { passed: match !== null, detail: `first line: ${JSON.stringify(firstLine.trim().slice(0, 60))}` };
        break;
      }
      case 'sop_sections':
        outcome = evaluateSop(response, check);
        break;
      case 'exec_fenced_file': {
        const exec = await evaluateExecFencedFile({ check, response, scratchDir, fixturesDir, runNode });
        executedCommands += exec.executed;
        testsPassed += exec.tests_passed;
        testsFailed += exec.tests_failed;
        if (exec.detail.startsWith('extraction:')) extractionFailed = true;
        outcome = { passed: exec.passed, detail: exec.detail };
        break;
      }
      case 'exec_regression_test': {
        const exec = await evaluateExecRegression({ check, response, scratchDir, fixturesDir, runNode });
        executedCommands += exec.executed;
        testsPassed += exec.tests_passed;
        testsFailed += exec.tests_failed;
        if (exec.detail.startsWith('extraction:')) extractionFailed = true;
        outcome = { passed: exec.passed, detail: exec.detail };
        break;
      }
      default:
        throw new BatteryDefinitionError(`unknown check type ${check.type}`);
    }
    checks.push({ name: `${check.type}${check.pattern ? `:${check.pattern}` : ''}`, type: check.type, passed: outcome.passed, detail: outcome.detail });
  }

  const checksPassed = checks.filter(check => check.passed).length;
  const checksFailed = checks.length - checksPassed;
  const passed = checksFailed === 0;
  const failureClass = passed ? null : response.trim().length === 0 ? 'no_completion' : extractionFailed ? 'no_completion' : 'verification_failed';
  return {
    task_id: task.id,
    task_class: task.class,
    passed,
    checks,
    checks_passed: checksPassed,
    checks_failed: checksFailed,
    executed_commands: executedCommands,
    tests_passed: testsPassed,
    tests_failed: testsFailed,
    failure_class: failureClass
  };
}
