#!/usr/bin/env node
// Canonical battery guard (release-critical test integrity).
//
// Proven defect this guards against: `node --test <files>` silently SKIPS a
// nonexistent explicit file argument when other valid files are present, so
// "fail 0" alone does not prove the intended battery ran.
//
// Invariant enforced: REQUESTED == DISCOVERED == EXECUTED
//   - every requested test file must exist on disk
//   - the runner must report >= 1 test (and >= --expect-tests when given)
//   - fail must be 0 and skipped must be 0 unless --allow-skip is given
//
// Usage:
//   node scripts/battery-guard.mjs --id <battery-id> [--expect-tests N] [--allow-skip] file1.test.ts file2.test.ts ...
//   node scripts/battery-guard.mjs --selftest
//
// Emits a machine-readable manifest on stdout and writes it to
// .aide/batteries/<battery-id>.json. Exits nonzero unless verdict=PASS.
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function runBattery({ id, files, expectTests, allowSkip }) {
  const manifest = {
    battery_id: id,
    started_at: new Date().toISOString(),
    requested_files: files,
    file_exists: [],
    observed_tests: null,
    pass: null,
    fail: null,
    skip: null,
    exit_code: null,
    expected_tests: expectTests ?? null,
    verdict: 'FAIL',
    failure_reasons: []
  };
  for (const file of files) {
    const absolute = path.isAbsolute(file) ? file : path.join(ROOT, file);
    const exists = await fs.access(absolute).then(() => true, () => false);
    manifest.file_exists.push({ file, exists });
    if (!exists) manifest.failure_reasons.push(`requested test file absent: ${file}`);
  }
  if (manifest.failure_reasons.length > 0) return manifest;

  const args = ['--experimental-strip-types', '--no-warnings', '--import', './scripts/http-close-shim.mjs', '--test', '--test-timeout=600000', ...files];
  const result = await new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); });
    child.stderr.on('data', chunk => { output += String(chunk); });
    child.once('error', error => resolve({ code: -1, output: `${output}\nspawn error: ${String(error?.message ?? error)}` }));
    child.once('close', code => resolve({ code, output }));
  });
  manifest.exit_code = result.code;
  const numberAfter = marker => {
    const match = result.output.match(new RegExp(`${marker}\\s+(\\d+)`));
    return match === null ? null : Number(match[1]);
  };
  manifest.observed_tests = numberAfter('tests');
  manifest.pass = numberAfter('pass');
  manifest.fail = numberAfter('fail');
  manifest.skip = numberAfter('skipped');

  if (manifest.observed_tests === null) manifest.failure_reasons.push('runner output did not report a test count');
  if (manifest.observed_tests === 0) manifest.failure_reasons.push('runner executed zero tests');
  if (expectTests !== undefined && manifest.observed_tests !== null && manifest.observed_tests < expectTests) {
    manifest.failure_reasons.push(`observed tests ${manifest.observed_tests} < expected ${expectTests}`);
  }
  if (manifest.fail !== 0) manifest.failure_reasons.push(`fail=${String(manifest.fail)}`);
  if (allowSkip !== true && manifest.skip !== 0) manifest.failure_reasons.push(`skipped=${String(manifest.skip)} (use --allow-skip to permit)`);
  if (result.code !== 0 && manifest.failure_reasons.length === 0) manifest.failure_reasons.push(`exit code ${String(result.code)}`);

  manifest.verdict = manifest.failure_reasons.length === 0 ? 'PASS' : 'FAIL';
  manifest.output_tail = result.output.split('\n').filter(Boolean).slice(-12).join('\n').slice(0, 2000);
  return manifest;
}

async function runSelftest() {
  const controls = [];
  const real = 'tests/arch/contracts.test.ts';
  const missing = 'tests/arch/THIS-FILE-DOES-NOT-EXIST.test.ts';
  // Control 1: real file + nonexistent requested file -> must FAIL (file absent).
  const c1 = await runBattery({ id: 'selftest-missing-file', files: [real, missing] });
  controls.push({ name: 'missing requested file -> FAIL', verdict: c1.verdict, expected: 'FAIL', ok: c1.verdict === 'FAIL' && c1.failure_reasons.some(reason => /absent/.test(reason)) });
  // Control 2: impossible expected count -> must FAIL.
  const c2 = await runBattery({ id: 'selftest-count', files: [real], expectTests: 9999 });
  controls.push({ name: 'observed < expected -> FAIL', verdict: c2.verdict, expected: 'FAIL', ok: c2.verdict === 'FAIL' && c2.failure_reasons.some(reason => /expected 9999/.test(reason)) });
  // Control 3: valid battery -> must PASS (count observed, fail 0).
  const c3 = await runBattery({ id: 'selftest-positive', files: [real] });
  controls.push({ name: 'valid battery -> PASS', verdict: c3.verdict, expected: 'PASS', ok: c3.verdict === 'PASS' && (c3.observed_tests ?? 0) > 0 });
  const allOk = controls.every(control => control.ok);
  console.log(JSON.stringify({ selftest: allOk ? 'PASS' : 'FAIL', controls }, null, 2));
  process.exitCode = allOk ? 0 : 1;
}

if (process.argv.includes('--selftest')) {
  await runSelftest();
} else {
  const id = argValue('--id') ?? `battery-${randomUUID().slice(0, 8)}`;
  const expectTests = argValue('--expect-tests') !== undefined ? Number(argValue('--expect-tests')) : undefined;
  const allowSkip = process.argv.includes('--allow-skip');
  const files = process.argv.slice(2).filter(argument => !argument.startsWith('--') && argument !== id && argument !== String(expectTests));
  if (files.length === 0) {
    console.error('battery-guard: no test files requested');
    process.exitCode = 2;
  } else {
    const manifest = await runBattery({ id, files, expectTests, allowSkip });
    const dir = path.join(ROOT, '.aide', 'batteries');
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(manifest, null, 2), 'utf8').catch(() => {});
    console.log(JSON.stringify(manifest, null, 2));
    process.exitCode = manifest.verdict === 'PASS' ? 0 : 1;
  }
}
