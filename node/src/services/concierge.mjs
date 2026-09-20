import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

async function gitSha(root) {
  try {
    const result = await execFile('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true, timeout: 5000 });
    const value = result.stdout.trim();
    return /^[0-9a-f]{7,64}$/i.test(value) ? value : '0000000';
  } catch {
    return '0000000';
  }
}

function emptyManifest(source) {
  return { schema_version: '1', generated_at: new Date().toISOString(), source_sha: source, artifacts: [] };
}

function validArtifact(value) {
  return value && typeof value === 'object' && typeof value.product === 'string' && typeof value.platform === 'string' && typeof value.architecture === 'string' && typeof value.artifact_type === 'string' && typeof value.filename === 'string' && Number.isInteger(value.size_bytes) && /^[0-9a-f]{64}$/i.test(String(value.sha256)) && ['certified', 'uncertified', 'pending'].includes(value.certification_state) && typeof value.reference === 'string';
}

export function createConciergeService({ repoRoot, manifestPath = path.join(repoRoot, 'release-manifest.json') } = {}) {
  const root = path.resolve(repoRoot ?? process.cwd());

  async function manifest() {
    const source = await gitSha(root);
    try {
      const parsed = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      const artifacts = Array.isArray(parsed?.artifacts) ? parsed.artifacts.filter(validArtifact) : [];
      if (parsed?.schema_version === '1' && typeof parsed.generated_at === 'string' && typeof parsed.source_sha === 'string') return { schema_version: '1', generated_at: parsed.generated_at, source_sha: parsed.source_sha, artifacts };
    } catch {}
    return emptyManifest(source);
  }

  async function resolve(input) {
    const current = await manifest();
    const product = input.intent === 'edge' ? 'COVERT EDGE' : 'COVERT WORKSTATION';
    const artifacts = current.artifacts.filter(artifact => artifact.product === product && artifact.platform.toLowerCase() === input.platform.toLowerCase() && artifact.architecture.toLowerCase() === input.architecture.toLowerCase() && artifact.certification_state === 'certified');
    if (artifacts.length === 0) return { matched: false, reason: 'No certified artifact in the machine-readable manifest matches this product, platform, and architecture.', artifacts: [], limitations: ['Only artifacts with explicit certification_state=certified are returned.', 'The manifest is generated from actual artifacts; no package is invented when one is absent.'] };
    return { matched: true, reason: 'Deterministic certified artifact match.', artifacts, limitations: [] };
  }

  return Object.freeze({ manifest, resolve });
}
