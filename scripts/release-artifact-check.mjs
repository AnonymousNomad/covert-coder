// scripts/release-artifact-check.mjs
// Release artifact acceptance — DESKTOP BUNDLE.
//
// Validates a built desktop bundle (installers + staged resources) or a
// directory of downloaded release artifacts BEFORE any certification claim:
//   A. artifact presence (installer / bundle files)
//   B. forbidden content (weights, secrets, local state, logs, caches, VCS)
//   C. version consistency across package metadata, Tauri config, and filenames
//   D. staged resource completeness for the packaged stack
//   E. SHA256 + size manifest for every top-level artifact
//
// Usage:
//   node scripts/release-artifact-check.mjs --bundle=<dir> [--json=<out.json>]
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const bundleArg = args.find(argument => argument.startsWith('--bundle='))?.slice('--bundle='.length);
const jsonArg = args.find(argument => argument.startsWith('--json='))?.slice('--json='.length);

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, result: pass ? 'PASS' : 'FAIL', detail: String(detail ?? '').slice(0, 260) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
function warn(name, detail) {
  checks.push({ name, result: 'WARN', detail: String(detail ?? '').slice(0, 260) });
  console.log(`WARN  ${name}${detail ? ` — ${detail}` : ''}`);
}

const FORBIDDEN = [
  { name: 'model weights', pattern: /\.(gguf|safetensors)$/i },
  { name: 'env file', pattern: /(^|[\\/])\.env(\.|$)/i },
  { name: 'local aide state', pattern: /(^|[\\/])\.aide([\\/]|$)/i },
  { name: 'vcs metadata', pattern: /(^|[\\/])\.git([\\/]|$)/i },
  { name: 'log file', pattern: /\.log$/i },
  { name: 'node_modules payload', pattern: /resources[\\/].*node_modules[\\/]/i },
  { name: 'private key material', pattern: /\.(pem|p12|pfx)$/i },
  { name: 'workspace dump', pattern: /(^|[\\/])(workspace|screenshots?)[\\/]/i }
];

async function sha256(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

async function walk(dir, cap = 60000) {
  const files = [];
  const stack = [dir];
  while (stack.length > 0 && files.length < cap) {
    const current = stack.pop();
    let entries = [];
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  return files;
}

try {
  const bundle = path.resolve(bundleArg ?? path.join(ROOT, 'desktop', 'target', 'release', 'bundle'));
  const stat = await fs.stat(bundle).catch(() => null);
  check('artifact bundle exists', stat !== null && stat.isDirectory(), bundle);
  if (stat === null || !stat.isDirectory()) {
    console.log('\nRELEASE_ARTIFACT_SUMMARY');
    console.log(JSON.stringify({ harness: 'release-artifact-check', bundle, checks, failed: 1 }, null, 2));
    process.exit(1);
  }

  const files = await walk(bundle);
  const installers = files.filter(file => /\.(msi|exe|deb|rpm|appimage|dmg)$/i.test(file) && !/uninstall/i.test(path.basename(file)));
  check('at least one installer/app artifact present', installers.length > 0, installers.map(file => path.basename(file)).join(', ') || 'none');

  const hits = [];
  for (const file of files) {
    const relative = path.relative(bundle, file);
    for (const rule of FORBIDDEN) if (rule.pattern.test(relative)) hits.push(`${rule.name}: ${relative.slice(0, 120)}`);
  }
  check('no forbidden content in the artifact tree', hits.length === 0, hits.slice(0, 4).join(' | ') || `${files.length} file(s) scanned`);

  const packageJson = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const tauriConf = JSON.parse(await fs.readFile(path.join(ROOT, 'desktop', 'tauri.conf.json'), 'utf8'));
  const packageVersion = String(packageJson.version ?? '');
  const tauriVersion = String(tauriConf.version ?? '');
  check('version consistent between package.json and desktop/tauri.conf.json', packageVersion === tauriVersion, `package=${packageVersion} tauri=${tauriVersion}`);
  const versionedInstaller = installers.some(file => path.basename(file).includes(tauriVersion));
  if (versionedInstaller) check('installer filenames carry the product version', true, tauriVersion);
  else warn('installer filenames carry the product version', `no installer filename contains ${tauriVersion}`);

  const requiredResources = ['stack-launcher.mjs'];
  const resourceFiles = files.filter(file => /[\\/]resources[\\/]/i.test(file));
  const missing = requiredResources.filter(name => !resourceFiles.some(file => path.basename(file) === name));
  check('packaged stack launcher staged', missing.length === 0, missing.length === 0 ? `resources tree: ${resourceFiles.length} file(s)` : `missing: ${missing.join(', ')}`);
  const runtimeStaged = resourceFiles.some(file => /[\\/]runtime[\\/].*node(\.exe)?$/i.test(file));
  if (runtimeStaged) check('embedded Node runtime staged', true, 'runtime/node present');
  else warn('embedded Node runtime staged', 'no runtime/node binary found in the resources tree');

  const manifest = [];
  for (const file of installers) {
    const info = await fs.stat(file);
    manifest.push({ file: path.relative(bundle, file), size: info.size, sha256: await sha256(file) });
  }
  check('artifact checksums generated', manifest.length > 0, `${manifest.length} artifact(s)`);

  const failed = checks.filter(entry => entry.result === 'FAIL').length;
  const summary = {
    harness: 'release-artifact-check',
    generated_at: new Date().toISOString(),
    bundle,
    package_version: packageVersion,
    tauri_version: tauriVersion,
    files_scanned: files.length,
    artifacts: manifest,
    checks,
    failed
  };
  if (jsonArg) await fs.writeFile(path.resolve(jsonArg), JSON.stringify(summary, null, 2), 'utf8');
  console.log('\nRELEASE_ARTIFACT_SUMMARY');
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = failed > 0 ? 1 : 0;
} catch (error) {
  check('artifact check completed without harness error', false, String(error?.stack ?? error).slice(0, 400));
  console.log('\nRELEASE_ARTIFACT_SUMMARY');
  console.log(JSON.stringify({ harness: 'release-artifact-check', checks, failed: 1 }, null, 2));
  process.exitCode = 1;
}
