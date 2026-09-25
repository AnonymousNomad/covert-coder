#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const CANDIDATE_SHA = 'dc0d30ee226e7ff822592e3a800f064b4441b7af';

function argument(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find(item => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function fail(message) {
  console.error(`RELEASE_MANIFEST_FAIL: ${message}`);
  process.exit(1);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex').toUpperCase();
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function npmVersion() {
  try {
    if (process.platform === 'win32') {
      return execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm --version'], { encoding: 'utf8' }).trim();
    }
    return execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  }
  catch { return 'UNKNOWN'; }
}

const root = process.cwd();
const sourceSha = argument('source-sha', CANDIDATE_SHA);
const sourceBranch = argument('source-branch', 'audit/wiring-ledger');
const artifactDir = path.resolve(root, argument('artifact-dir', 'release-artifacts'));
const timestamp = argument('timestamp');
const prefix = argument('prefix', 'covert-source-dc0d30ee');

if (sourceSha !== CANDIDATE_SHA) fail(`source SHA must remain ${CANDIDATE_SHA}`);
if (!/^[0-9a-f]{40}$/.test(sourceSha)) fail('source SHA is not a 40-character commit object');
if (!timestamp || Number.isNaN(Date.parse(timestamp))) fail('provide a parseable UTC --timestamp');

let resolved;
try { resolved = git(['rev-parse', `${sourceSha}^{commit}`]); }
catch { fail(`source object is not available: ${sourceSha}`); }
if (resolved !== sourceSha) fail(`source object resolved unexpectedly: ${resolved}`);

mkdirSync(artifactDir, { recursive: true });
const sourceArchive = path.join(artifactDir, `${prefix}.zip`);
const sbom = path.join(artifactDir, `${prefix}.sbom.cdx.json`);
const provenance = path.join(artifactDir, `${prefix}.provenance.json`);
const manifest = path.join(artifactDir, `${prefix}.release-manifest.json`);
const checksums = path.join(artifactDir, 'SHA256SUMS.txt');

for (const file of [sourceArchive, sbom]) {
  try { if (!statSync(file).isFile()) fail(`required artifact is not a file: ${path.basename(file)}`); }
  catch { fail(`required artifact is missing: ${path.basename(file)}`); }
}

let sbomRecord;
try { sbomRecord = JSON.parse(readFileSync(sbom, 'utf8').replace(/^\uFEFF/, '')); }
catch { fail('SBOM is not valid JSON'); }
if (sbomRecord.bomFormat !== 'CycloneDX' || typeof sbomRecord.specVersion !== 'string' || !Array.isArray(sbomRecord.components)) {
  fail('SBOM is not a CycloneDX document with a component list');
}

let lockfile;
try { lockfile = JSON.parse(execFileSync('git', ['show', `${sourceSha}:package-lock.json`], { encoding: 'utf8' })); }
catch { fail('cannot read package-lock.json from the certified source object'); }

const packageVersions = {};
for (const name of ['zod', '@types/node', '@playwright/test', 'playwright', 'playwright-core']) {
  const key = `node_modules/${name}`;
  packageVersions[name] = lockfile.packages?.[key]?.version ?? 'NOT_RECORDED';
}

const lockText = execFileSync('git', ['show', `${sourceSha}:package-lock.json`]);
const lockHash = createHash('sha256').update(lockText).digest('hex').toUpperCase();
const sourceParent = git(['rev-parse', `${sourceSha}^`]);
const ciRun = 35869659152;
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const baseArtifact = file => ({ file: path.basename(file), path: rel(file), bytes: statSync(file).size, sha256: sha256(file) });

const provenanceRecord = {
  schema: 'covert.source-release-provenance.v1',
  generated_at: timestamp,
  source: {
    sha: sourceSha,
    branch: sourceBranch,
    parent: sourceParent,
    repository: 'https://github.com/AnonymousNomad/covert-coder.git',
    archive_method: 'git archive from the exact candidate object'
  },
  certification: {
    status: 'SOURCE_RELEASE_CORE_CERTIFIED',
    certifier_modifications_to_candidate: 0,
    ci_workflow: 'AIDE CI',
    ci_run_id: ciRun,
    ci_url: `https://github.com/AnonymousNomad/covert-coder/actions/runs/${ciRun}`,
    record: 'docs/release/SOURCE-CERTIFICATION-RECORD.json'
  },
  dependency_state: {
    lockfile_sha256: lockHash,
    package_versions: packageVersions,
    sbom_generator: 'npm sbom --package-lock-only --sbom-format=cyclonedx --sbom-type=application',
    sbom_format: `${sbomRecord.bomFormat} ${sbomRecord.specVersion}`,
    sbom_components: sbomRecord.components.length,
    node_version: process.version,
    npm_version: npmVersion()
  },
  release_boundary: {
    permanent_resident: 'WAITING_FOR_RESIDENT',
    packaged_installer: 'NOT_CERTIFIED',
    capability_fabric: 'POST_CANDIDATE',
    delegation: 'POST_CANDIDATE'
  },
  artifacts: {
    source_archive: baseArtifact(sourceArchive),
    sbom: baseArtifact(sbom)
  },
  claims: 'docs/release/RELEASE-CLAIM-MATRIX.md',
  limitations: 'docs/release/KNOWN-LIMITATIONS.md'
};
writeFileSync(provenance, `${JSON.stringify(provenanceRecord, null, 2)}\n`, 'utf8');

const manifestRecord = {
  schema: 'covert.source-release-manifest.v1',
  product: 'Covert Coder',
  version: '0.1.0-preflight',
  release_channel: 'SOURCE_CORE_CERTIFIED_PENDING_RESIDENT',
  generated_at: timestamp,
  source_sha: sourceSha,
  source_branch: sourceBranch,
  build_workflow: 'AIDE CI',
  build_run_id: ciRun,
  platform: 'source archive; platform-neutral',
  architecture: 'source',
  known_limitations: 'docs/release/KNOWN-LIMITATIONS.md',
  artifacts: {
    source_archive: baseArtifact(sourceArchive),
    sbom: baseArtifact(sbom),
    provenance: baseArtifact(provenance)
  },
  verification: {
    certification_record: 'docs/release/SOURCE-CERTIFICATION-RECORD.json',
    dependency_baseline: 'docs/release/DEPENDENCY-BASELINE-CERTIFIED.json',
    checksum_file: 'SHA256SUMS.txt',
    installer_certified: false,
    permanent_resident_accepted: false
  }
};
writeFileSync(manifest, `${JSON.stringify(manifestRecord, null, 2)}\n`, 'utf8');

const checksumEntries = [sourceArchive, sbom, provenance, manifest]
  .map(file => `${sha256(file)}  ${path.basename(file)}`)
  .join('\n');
writeFileSync(checksums, `${checksumEntries}\n`, 'utf8');

console.log(JSON.stringify({
  schema: 'covert.source-release-manifest-result.v1',
  source_sha: sourceSha,
  artifacts: manifestRecord.artifacts,
  checksums: path.basename(checksums),
  checksum_entries: checksumEntries.split('\n').length
}, null, 2));
