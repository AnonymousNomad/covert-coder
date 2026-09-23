#!/usr/bin/env node

/**
 * Compare a candidate's npm dependency resolution with the immutable
 * production baseline. This is intentionally read-only: it reports drift and
 * never rewrites package.json, package-lock.json, or the candidate tree.
 */

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REQUIRED = [
  { name: 'zod', kind: 'runtime' },
  { name: '@types/node', kind: 'development' },
  { name: '@playwright/test', kind: 'development' },
  { name: 'playwright', kind: 'transitive' },
  { name: 'playwright-core', kind: 'transitive' },
];

const ISSUE_CODES = new Set([
  'MISSING_PRODUCTION_MERGE',
  'OLDER_DEPENDENCY',
  'LOCKFILE_DIVERGENCE',
  'UNEXPECTED_VERSION',
]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === 'json') {
      args.json = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
    args[key] = value;
    index += 1;
  }
  return args;
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read JSON ${file}: ${error.message}`);
  }
}

function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(value ?? '').trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? '' };
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return null;
  for (const field of ['major', 'minor', 'patch']) {
    if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1;
  }
  if (!a.pre && !b.pre) return 0;
  if (!a.pre) return 1;
  if (!b.pre) return -1;
  return a.pre === b.pre ? 0 : a.pre < b.pre ? -1 : 1;
}

function rangeAllows(range, resolved) {
  const value = versionParts(resolved);
  const spec = String(range ?? '').trim();
  if (!value || !spec || spec === '*' || spec === 'latest') return spec === '*' || spec === 'latest' ? true : null;
  const exact = versionParts(spec);
  if (exact) return compareVersions(resolved, spec) === 0;

  const caret = /^\^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(spec);
  if (caret) {
    const base = `${Number(caret[1])}.${Number(caret[2] ?? 0)}.${Number(caret[3] ?? 0)}`;
    if (compareVersions(resolved, base) < 0) return false;
    const upper = Number(caret[1]) === 0
      ? Number(caret[2] ?? 0) === 0
        ? `0.0.${Number(caret[3] ?? 0) + 1}`
        : `0.${Number(caret[2]) + 1}.0`
      : `${Number(caret[1]) + 1}.0.0`;
    return compareVersions(resolved, upper) < 0;
  }

  const tilde = /^~\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(spec);
  if (tilde) {
    const base = `${Number(tilde[1])}.${Number(tilde[2] ?? 0)}.${Number(tilde[3] ?? 0)}`;
    const upper = `${Number(tilde[1])}.${Number(tilde[2] ?? 0) + 1}.0`;
    return compareVersions(resolved, base) >= 0 && compareVersions(resolved, upper) < 0;
  }

  const comparator = /^(>=|>|<=|<)\s*(\d+\.\d+\.\d+)$/.exec(spec);
  if (comparator) {
    const result = compareVersions(resolved, comparator[2]);
    if (result === null) return null;
    return comparator[1] === '>=' ? result >= 0
      : comparator[1] === '>' ? result > 0
        : comparator[1] === '<=' ? result <= 0
          : result < 0;
  }

  return null;
}

function gitValue(root, args) {
  try {
    if (args) return args;
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function gitBranch(root) {
  try {
    return execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function declared(packageJson, name) {
  return packageJson.dependencies?.[name]
    ?? packageJson.devDependencies?.[name]
    ?? packageJson.optionalDependencies?.[name]
    ?? null;
}

function lockEntry(lock, name) {
  return lock.packages?.[`node_modules/${name}`] ?? null;
}

function rootLockDeclared(lock, packageJson, name) {
  return lock.packages?.['']?.dependencies?.[name]
    ?? lock.packages?.['']?.devDependencies?.[name]
    ?? lock.packages?.['']?.optionalDependencies?.[name]
    ?? declared(packageJson, name);
}

async function loadTree(root, label) {
  const absolute = path.resolve(root);
  const packageJson = await readJson(path.join(absolute, 'package.json'));
  const lock = await readJson(path.join(absolute, 'package-lock.json'));
  return { label, root: absolute, packageJson, lock };
}

function addIssue(issues, code, packageName, detail) {
  if (!ISSUE_CODES.has(code)) throw new Error(`unknown issue code ${code}`);
  issues.push({ code, package: packageName, ...detail });
}

function compareTrees(production, candidate) {
  const issues = [];
  const comparisons = [];

  for (const required of REQUIRED) {
    const productionDeclared = declared(production.packageJson, required.name);
    const candidateDeclared = declared(candidate.packageJson, required.name);
    const productionResolved = lockEntry(production.lock, required.name)?.version ?? null;
    const candidateResolved = lockEntry(candidate.lock, required.name)?.version ?? null;
    const candidateRootSpec = rootLockDeclared(candidate.lock, candidate.packageJson, required.name);

    if (!productionResolved) {
      addIssue(issues, 'LOCKFILE_DIVERGENCE', required.name, { side: 'production', reason: 'baseline package is absent from package-lock.json' });
    }
    if (!candidateDeclared && required.kind !== 'transitive') {
      addIssue(issues, 'MISSING_PRODUCTION_MERGE', required.name, { reason: 'candidate package manifest does not declare the production dependency' });
    }
    if (!candidateResolved) {
      addIssue(issues, required.kind === 'transitive' ? 'LOCKFILE_DIVERGENCE' : 'MISSING_PRODUCTION_MERGE', required.name, {
        reason: 'candidate package-lock.json does not resolve the production dependency',
      });
    }

    if (productionDeclared && candidateDeclared && productionDeclared !== candidateDeclared) {
      const productionSpecVersion = versionParts(productionDeclared);
      const candidateSpecVersion = versionParts(candidateDeclared);
      if (productionSpecVersion && candidateSpecVersion && compareVersions(candidateDeclared, productionDeclared) < 0) {
        addIssue(issues, 'MISSING_PRODUCTION_MERGE', required.name, {
          reason: 'candidate manifest constraint is older than the production constraint',
          productionDeclared,
          candidateDeclared,
        });
      }
    }

    if (productionResolved && candidateResolved) {
      const order = compareVersions(candidateResolved, productionResolved);
      if (order === null) {
        addIssue(issues, 'LOCKFILE_DIVERGENCE', required.name, { reason: 'one or both resolved versions are not strict semver', productionResolved, candidateResolved });
      } else if (order < 0) {
        addIssue(issues, 'OLDER_DEPENDENCY', required.name, { productionResolved, candidateResolved });
      } else if (order > 0) {
        addIssue(issues, 'UNEXPECTED_VERSION', required.name, { productionResolved, candidateResolved, reason: 'candidate is newer than the frozen production baseline; require explicit justification' });
      }
    }

    if (candidateResolved && candidateDeclared) {
      const allowed = rangeAllows(candidateDeclared, candidateResolved);
      if (allowed === false) {
        addIssue(issues, 'LOCKFILE_DIVERGENCE', required.name, { reason: 'candidate lock resolution does not satisfy its package manifest range', candidateDeclared, candidateResolved });
      }
    }
    if (candidateDeclared && candidateRootSpec && candidateDeclared !== candidateRootSpec) {
      addIssue(issues, 'LOCKFILE_DIVERGENCE', required.name, { reason: 'candidate package.json and package-lock root dependency specs differ', packageDeclared: candidateDeclared, lockDeclared: candidateRootSpec });
    }

    comparisons.push({
      package: required.name,
      kind: required.kind,
      production: { declared: productionDeclared, resolved: productionResolved },
      candidate: { declared: candidateDeclared, resolved: candidateResolved, lockRoot: candidateRootSpec },
    });
  }

  return { issues, comparisons };
}

function summarize(result) {
  const lines = [
    `DEPENDENCY RECONCILIATION: ${result.status}`,
    `PRODUCTION SHA: ${result.production.sha ?? 'UNKNOWN'}`,
    `CANDIDATE SHA: ${result.candidate.sha ?? 'UNKNOWN'}`,
    `ISSUES: ${result.issues.length}`,
  ];
  for (const issue of result.issues) lines.push(`- ${issue.code}: ${issue.package} (${issue.reason ?? 'version drift'})`);
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.production || !args.candidate) {
    throw new Error('usage: node scripts/release-dependency-reconcile.mjs --production <worktree> --candidate <worktree> [--json] [--json-out <file>]');
  }

  const [production, candidate] = await Promise.all([
    loadTree(args.production, 'production'),
    loadTree(args.candidate, 'candidate'),
  ]);
  const comparison = compareTrees(production, candidate);
  const result = {
    schema: 'covert.release-dependency-reconciliation.v1',
    checked_at: new Date().toISOString(),
    status: comparison.issues.length ? 'FAIL' : 'PASS',
    production: {
      root: production.root,
      sha: gitValue(production.root, args['production-sha']),
      branch: gitBranch(production.root),
    },
    candidate: {
      root: candidate.root,
      sha: gitValue(candidate.root, args['candidate-sha']),
      branch: gitBranch(candidate.root),
    },
    issues: comparison.issues,
    comparisons: comparison.comparisons,
    read_only: true,
  };

  if (args['json-out']) await writeFile(path.resolve(args['json-out']), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${summarize(result)}\n`);
  return result.status === 'PASS' ? 0 : 2;
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  process.stderr.write(`DEPENDENCY RECONCILIATION ERROR: ${error.message}\n`);
  process.exitCode = 1;
});
