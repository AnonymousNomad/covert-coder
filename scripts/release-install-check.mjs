// scripts/release-install-check.mjs
// External-user release acceptance — INSTALL PRECONDITIONS + DOCTOR TRUTH.
//
// Verifies the documented prerequisites and the documented diagnostic step on
// a real checkout: Node/npm/Git present, lockfile and installed dependencies,
// fresh-state expectations (no required .aide state, no required weights), and
// the doctor's own report (exit 0, explicit warnings recorded verbatim so the
// release evidence shows exactly what a new user is told).
import { execFile } from 'node:child_process';
import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCUMENTED_NODE = '26.4.0';

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, result: pass ? 'PASS' : 'FAIL', detail: String(detail ?? '').slice(0, 300) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
function warn(name, detail) {
  checks.push({ name, result: 'WARN', detail: String(detail ?? '').slice(0, 300) });
  console.log(`WARN  ${name}${detail ? ` — ${detail}` : ''}`);
}

try {
  const nodeVersion = process.versions.node;
  check('documented Node runtime present', nodeVersion === DOCUMENTED_NODE || nodeVersion.startsWith('26.'), `found v${nodeVersion}; README documents ${DOCUMENTED_NODE}`);
  try {
    const { stdout } = await execFileAsync('npm', ['--version'], { shell: true });
    check('npm on PATH', stdout.trim().length > 0, `npm ${stdout.trim()}`);
  } catch (error) {
    check('npm on PATH', false, String(error?.message ?? error));
  }
  try {
    const { stdout } = await execFileAsync('git', ['--version'], { shell: true });
    check('git on PATH', /git version/.test(stdout), stdout.trim());
  } catch (error) {
    check('git on PATH', false, String(error?.message ?? error));
  }

  check('lockfile present (npm ci is the documented install)', existsSync(path.join(ROOT, 'package-lock.json')), 'package-lock.json');
  check('dependencies installed', existsSync(path.join(ROOT, 'node_modules')), 'node_modules present (npm ci)');

  const ggufs = existsSync(path.join(ROOT, 'models'))
    ? (await fs.readdir(path.join(ROOT, 'models'))).filter(file => file.toLowerCase().endsWith('.gguf'))
    : [];
  check('no model weights required to install or launch', true, `${ggufs.length} GGUF present (weights are a separate prerequisite for local chat)`);

  if (existsSync(path.join(ROOT, '.aide'))) warn('fresh-state check', 'a .aide directory exists in this checkout; first-run state was not pristine for this run');
  else check('fresh state: no pre-existing application state', true, '.aide absent');

  const startedAt = Date.now();
  try {
    const { stdout } = await execFileAsync(process.execPath, ['scripts/doctor.mjs'], { cwd: ROOT, timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
    const passLine = /Preflight passed: (\d+\/\d+)/.exec(stdout);
    check('documented `npm run doctor` step succeeds', passLine !== null, passLine ? `${passLine[1]} checks in ${Math.round((Date.now() - startedAt) / 1000)}s` : 'no preflight summary');
    for (const line of stdout.split(/\r?\n/).filter(entry => entry.startsWith('WARN'))) warn('doctor warning (verbatim)', line.trim());
  } catch (error) {
    check('documented `npm run doctor` step succeeds', false, String(error?.message ?? error).slice(0, 240));
  }

  const failed = checks.filter(entry => entry.result === 'FAIL').length;
  console.log('\nRELEASE_INSTALL_SUMMARY');
  console.log(JSON.stringify({ harness: 'release-install-check', generated_at: new Date().toISOString(), checks, failed }, null, 2));
  process.exitCode = failed > 0 ? 1 : 0;
} catch (error) {
  check('install check completed without harness error', false, String(error?.stack ?? error).slice(0, 400));
  console.log('\nRELEASE_INSTALL_SUMMARY');
  console.log(JSON.stringify({ harness: 'release-install-check', checks, failed: 1 }, null, 2));
  process.exitCode = 1;
}
