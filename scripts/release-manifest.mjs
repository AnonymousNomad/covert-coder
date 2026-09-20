import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const outputPath = outputArg ? path.resolve(repoRoot, outputArg.slice('--output='.length)) : path.join(repoRoot, 'release-manifest.json');

async function sourceSha() {
  try {
    const result = await exec('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, windowsHide: true, timeout: 5000 });
    const value = result.stdout.trim();
    if (/^[0-9a-f]{7,64}$/i.test(value)) return value;
  } catch {}
  throw new Error('cannot generate a release manifest without a verified Git source SHA');
}

async function walk(root) {
  const result = [];
  const visit = async current => {
    let entries;
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (['.git', 'node_modules', '.aide', 'dist', 'out'].includes(entry.name)) continue;
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (['APP', 'XCARCHIVE'].includes(artifactType(candidate))) result.push(candidate);
        else await visit(candidate);
      }
      else if (entry.isFile()) result.push(candidate);
    }
  };
  await visit(root);
  return result;
}

function artifactType(file) {
  const extension = path.extname(file).toLowerCase();
  const map = new Map([
    ['.exe', 'NSIS'], ['.msi', 'MSI'], ['.appimage', 'AppImage'], ['.deb', 'deb'], ['.rpm', 'rpm'],
    ['.apk', 'APK'], ['.aab', 'AAB'], ['.app', 'APP'], ['.ipa', 'IPA']
  ]);
  if (map.has(extension)) return map.get(extension);
  if (file.toLowerCase().endsWith('.xcarchive')) return 'XCARCHIVE';
  return null;
}

function productFor(artifactType) {
  return ['APK', 'AAB', 'APP', 'IPA', 'XCARCHIVE'].includes(artifactType) ? 'COVERT EDGE' : 'COVERT WORKSTATION';
}

function platformFor(artifactType) {
  if (artifactType === 'APK' || artifactType === 'AAB') return 'android';
  if (artifactType === 'APP' || artifactType === 'IPA' || artifactType === 'XCARCHIVE') return 'ios';
  if (artifactType === 'NSIS' || artifactType === 'MSI') return 'windows';
  if (artifactType === 'AppImage' || artifactType === 'deb' || artifactType === 'rpm') return 'linux';
  return 'unknown';
}

function architectureFor(file) {
  const lower = file.toLowerCase();
  if (lower.includes('arm64') || lower.includes('aarch64')) return 'arm64';
  if (lower.includes('x64') || lower.includes('amd64')) return 'x64';
  if (lower.includes('x86')) return 'x86';
  return 'unknown';
}

async function makeArtifact(file) {
  const stat = await fs.stat(file);
  const digest = crypto.createHash('sha256');
  let sizeBytes = stat.size;
  if (stat.isDirectory()) {
    sizeBytes = 0;
    const contents = [];
    const visit = async current => {
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const candidate = path.join(current, entry.name);
        if (entry.isDirectory()) await visit(candidate);
        else if (entry.isFile()) contents.push(candidate);
      }
    };
    await visit(file);
    contents.sort();
    for (const content of contents) {
      digest.update(path.relative(file, content).split(path.sep).join('/'));
      const bytes = await fs.readFile(content);
      digest.update(bytes);
      sizeBytes += bytes.byteLength;
    }
  } else {
    digest.update(await fs.readFile(file));
  }
  const hash = digest.digest('hex');
  const type = artifactType(file);
  const relative = path.relative(repoRoot, file).split(path.sep).join('/');
  return {
    product: productFor(type),
    version: 'unknown',
    platform: platformFor(type),
    architecture: architectureFor(file),
    artifact_type: type,
    filename: path.basename(file),
    size_bytes: sizeBytes,
    sha256: hash,
    signing_state: 'unknown',
    certification_state: 'uncertified',
    minimum_requirements: [],
    reference: relative,
    limitations: ['Certification and signing were not inferred from file presence.']
  };
}

const source = await sourceSha();
const files = (await walk(repoRoot)).filter(file => artifactType(file) !== null);
const manifest = { schema_version: '1', generated_at: new Date().toISOString(), source_sha: source, artifacts: await Promise.all(files.map(file => makeArtifact(file))) };
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: path.relative(repoRoot, outputPath), source_sha: source, artifacts: manifest.artifacts.length }));
