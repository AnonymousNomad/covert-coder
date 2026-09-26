import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  evaluateBrandingAssets,
  evaluateVersionConsistency,
  generateArtifactManifest,
  inspectIdentity,
  verifyArtifactManifest
} from './lib/qualification.mjs';
import { runStartupProbe } from './startup-probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
const fixture = path.join(root, 'scripts/packaging/fixtures/startup-target.mjs');
const pass = [];
const invalid = [];
let tempRoot;

test.before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'covert-packaging-qualification-'));
});
test.after(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

test('identity fixture reports aligned package identity and versions', async () => {
  const repo = path.join(tempRoot, 'identity');
  await mkdir(path.join(repo, 'desktop/icons'), { recursive: true });
  await writeFile(path.join(repo, 'package.json'), JSON.stringify({ name: 'fixture-app', version: '1.2.3' }));
  await writeFile(path.join(repo, 'desktop/Cargo.toml'), '[package]\nname = "fixture-app"\nversion = "1.2.3"\n');
  await writeFile(path.join(repo, 'desktop/tauri.conf.json'), JSON.stringify({
    productName: 'Fixture App',
    version: '1.2.3',
    identifier: 'org.example.fixture',
    app: { windows: [{ title: 'Fixture App' }] },
    bundle: { active: true, targets: ['nsis'], icon: ['icons/icon.ico'] }
  }));
  await writeFile(path.join(repo, 'desktop/icons/icon.ico'), Buffer.from([0, 1, 2, 3]));
  const identity = await inspectIdentity(repo);
  assert.equal(identity.product_name.value, 'Fixture App');
  assert.equal(identity.window_title.value, 'Fixture App');
  assert.equal(identity.main_binary.value, 'fixture-app.exe');
  assert.equal(identity.versions.values_agree, 'YES');
  assert.equal(identity.icons[0].exists, true);
  pass.push('consistent package identity');
});

test('version gate blocks unresolved ownership and rejects mismatch when owner is supplied', () => {
  const blocked = evaluateVersionConsistency({ sources: { app: '1.0.0', cargo: '1.0.0' }, canonical_source: null });
  assert.equal(blocked.status, 'BLOCKED — VERSION OWNER UNRESOLVED');
  const mismatch = evaluateVersionConsistency({
    sources: { app: '1.0.0', cargo: '0.9.0' },
    canonical_source: 'app',
    source_policy: {
      app: { relationship: 'canonical' },
      cargo: { relationship: 'derived', rule: 'exact' }
    }
  });
  assert.equal(mismatch.status, 'FAIL — VERSION MISMATCH');
  assert.equal(mismatch.mismatches[0].source, 'cargo');
  const independent = evaluateVersionConsistency({
    sources: { app: '1.0.0', cargo: '0.9.0' },
    canonical_source: 'app',
    source_policy: {
      app: { relationship: 'canonical' },
      cargo: { relationship: 'independent', rationale: 'Rust crate version is separately managed.' }
    }
  });
  assert.equal(independent.status, 'PASS');
  assert.deepEqual(independent.independent_sources, ['cargo']);
  const cli = spawnSync(process.execPath, [path.join(root, 'scripts/packaging/qualification.mjs'), 'version', '--root', root], {
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(cli.status, 1);
  assert.equal(JSON.parse(cli.stdout).status, 'BLOCKED — VERSION OWNER UNRESOLVED');
  pass.push('unresolved version owner fail-closed', 'version mismatch rejected', 'independent version mapping accepted', 'blocked version CLI exits nonzero');
});

test('branding gate detects missing and stale identity assets', () => {
  const stale = evaluateBrandingAssets([{ path: 'icon.ico', exists: true, sha256: '039151F0685069DC7120FACC26AAF8EF3CE2A7C554F7319171E384143E54FF61' }]);
  assert.equal(stale.status, 'FAIL — STALE AIDE ASSET');
  const missing = evaluateBrandingAssets([{ path: 'missing.ico', exists: false, sha256: null }]);
  assert.equal(missing.status, 'FAIL — MISSING ASSET');
  const conflict = evaluateBrandingAssets([
    { path: 'first.svg', surface: 'window icon', exists: true, sha256: 'A'.repeat(64) },
    { path: 'second.svg', surface: 'window icon', exists: true, sha256: 'B'.repeat(64) }
  ]);
  assert.equal(conflict.status, 'FAIL — CONFLICTING SURFACE ASSET');
  const cli = spawnSync(process.execPath, [path.join(root, 'scripts/packaging/qualification.mjs'), 'branding', '--root', root], {
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(cli.status, 1);
  assert.equal(JSON.parse(cli.stdout).status, 'FAIL — STALE AIDE ASSET');
  pass.push('known stale AIDE icon', 'missing icon', 'conflicting identity surface', 'stale branding CLI exits nonzero');
});

test('artifact manifest verifies and detects a tampered hash', async () => {
  const artifacts = path.join(tempRoot, 'artifacts');
  await mkdir(artifacts, { recursive: true });
  await writeFile(path.join(artifacts, 'Covert.msi'), Buffer.from('fixture-msi'));
  const manifest = await generateArtifactManifest({ directory: artifacts, sourceSha: 'abc123', buildVersion: '1.0.0' });
  assert.equal(manifest.artifacts[0].bundle_type, 'MSI');
  assert.equal((await verifyArtifactManifest(manifest, artifacts)).status, 'PASS');
  await writeFile(path.join(artifacts, 'Covert.msi'), Buffer.from('tampered-msi'));
  const tampered = await verifyArtifactManifest(manifest, artifacts);
  assert.equal(tampered.status, 'FAIL — ARTIFACT MISMATCH');
  assert.match(tampered.failures[0].reason, /mismatch/);
  pass.push('valid manifest', 'tampered artifact hash');
});

async function choosePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function inspectPort(port) {
  const script = path.join(root, 'scripts/packaging/port-preflight.ps1');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Ports', String(port), '-RepositoryRoot', root], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout).results[0];
}

test('port probe distinguishes a listening fixture and a free port', { skip: process.platform !== 'win32' }, async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const occupiedPort = server.address().port;
  const occupied = await inspectPort(occupiedPort);
  assert.equal(occupied.listening, true);
  assert.equal(occupied.listeners[0].pid, process.pid);
  await new Promise(resolve => server.close(resolve));
  const free = await inspectPort(await choosePort());
  assert.equal(free.listening, false);
  pass.push('occupied port', 'free port');
});

test('startup harness captures normal exit and fast crash', async () => {
  const normal = await runStartupProbe({ executable: process.execPath, args: [fixture, 'normal'], cwd: root, timeoutMs: 2000 });
  assert.equal(normal.timeout, false);
  assert.equal(normal.exit_code, 0);
  const crash = await runStartupProbe({ executable: process.execPath, args: [fixture, 'crash'], cwd: root, timeoutMs: 2000 });
  assert.equal(crash.timeout, false);
  assert.equal(crash.exit_code, 23);
  assert.equal(crash.unexpected_exit, true);
  pass.push('normal process start/exit', 'fast crash');
});

test('startup harness bounds a hang and preserves a foreign same-name process', async t => {
  const pidFile = path.join(tempRoot, 'foreign.pid');
  const foreign = spawn(process.execPath, [fixture, 'child-hang', pidFile], { cwd: root, stdio: 'ignore', windowsHide: true });
  t.after(async () => {
    if (foreign.exitCode === null && foreign.signalCode === null) foreign.kill();
    await Promise.race([once(foreign, 'close'), new Promise(resolve => setTimeout(resolve, 1000))]);
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { await readFile(pidFile, 'utf8'); break; } catch { await new Promise(resolve => setTimeout(resolve, 20)); }
  }
  const result = await runStartupProbe({ executable: process.execPath, args: [fixture, 'hang'], cwd: root, timeoutMs: 500, observeMs: 150 });
  assert.equal(result.timeout, true);
  assert.ok(foreign.exitCode === null && foreign.signalCode === null);
  pass.push('hung fixture', 'foreign same-name process survival');
  if (process.platform !== 'win32') invalid.push('owned process-tree cleanup unavailable outside Windows; root PID was terminated directly');
});

test('owned child fixture is identified and exact process-tree cleanup is verified on Windows', { skip: process.platform !== 'win32' }, async () => {
  const pidFile = path.join(tempRoot, 'owned-child.pid');
  const result = await runStartupProbe({ executable: process.execPath, args: [fixture, 'tree-hang', pidFile], cwd: root, timeoutMs: 1200, observeMs: 300 });
  assert.equal(result.timeout, true);
  assert.ok(result.owned_children.some(item => item.depth === 1));
  assert.equal(result.cleanup, 'EXACT OWNED PROCESS TREE CLEANED AND VERIFIED');
  const childPid = Number((await readFile(pidFile, 'utf8')).trim());
  const childAlive = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "if (Get-Process -Id " + childPid + " -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"], { windowsHide: true });
  assert.equal(childAlive.status, 1, 'owned fixture child survived cleanup');
  pass.push('owned child process cleanup');
});

test('fixture suite records deterministic pass and invalid counts', async () => {
  const qualificationPath = path.join(root, 'docs/v1/packaging/COVERT-PACKAGING-QUALIFICATION.json');
  const qualification = JSON.parse(await readFile(qualificationPath, 'utf8'));
  assert.equal(qualification.schema_version, 1);
  for (const document of qualification.documents) {
    await readFile(path.join(root, document), 'utf8');
  }
  pass.push('qualification JSON and referenced documents');
  assert.equal(qualification.qualification_apparatus.fixture_battery.pass, pass.length);
  const report = {
    schema_version: 1,
    status: invalid.length ? 'INVALID' : 'PASS',
    counts: { pass: pass.length, fail: 0, invalid: invalid.length },
    cases: pass,
    invalid
  };
  const reportPath = process.env.COVERT_PACKAGING_FIXTURE_REPORT || path.join(tempRoot, 'fixture-results.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  assert.ok(report.counts.pass >= 10);
  assert.equal(report.counts.fail, 0);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
});
