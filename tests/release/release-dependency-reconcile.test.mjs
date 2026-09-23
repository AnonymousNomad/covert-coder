import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const script = path.resolve('scripts/release-dependency-reconcile.mjs');
const tracked = [
  ['zod', '^4.6.5', '4.6.5', 'runtime'],
  ['@types/node', '^26.6.1', '26.6.1', 'development'],
  ['@playwright/test', '^1.63.0', '1.63.0', 'development'],
  ['playwright', null, '1.63.0', 'transitive'],
  ['playwright-core', null, '1.63.0', 'transitive'],
];

async function fixture(root, versions = {}) {
  const dependencies = { zod: versions.zodSpec ?? '^4.6.5' };
  const devDependencies = {
    '@types/node': versions.nodeSpec ?? '^26.6.1',
    '@playwright/test': versions.playwrightSpec ?? '^1.63.0',
  };
  const packages = {
    '': { dependencies, devDependencies },
  };
  for (const [name, spec, resolved] of tracked) {
    const key = `node_modules/${name}`;
    const actual = versions[name] ?? resolved;
    packages[key] = { version: actual };
    if (spec) {
      const root = name === 'zod' ? dependencies : devDependencies;
      root[name] = name === 'zod' ? (versions.zodSpec ?? spec) : name === '@types/node' ? (versions.nodeSpec ?? spec) : (versions.playwrightSpec ?? spec);
      packages[''].dependencies = dependencies;
      packages[''].devDependencies = devDependencies;
    }
  }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', dependencies, devDependencies }, null, 2));
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ name: 'fixture', lockfileVersion: 3, packages }, null, 2));
}

async function run(production, candidate) {
  try {
    return await exec(process.execPath, [script, '--production', production, '--candidate', candidate, '--json']);
  } catch (error) {
    return error;
  }
}

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'covert-dependency-reconcile-'));
  const production = path.join(root, 'production');
  const candidate = path.join(root, 'candidate');
  await mkdir(production);
  await mkdir(candidate);
  await fixture(production);
  await fixture(candidate);
  return { root, production, candidate };
}

function parsed(result) {
  return JSON.parse(result.stdout ?? result.stdout?.toString?.() ?? '{}');
}

test('accepts an identical production dependency baseline', async () => {
  const env = await setup();
  try {
    const result = await run(env.production, env.candidate);
    assert.equal(result.code, undefined);
    assert.equal(parsed(result).status, 'PASS');
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});

test('fails closed on an older candidate dependency', async () => {
  const env = await setup();
  try {
    await fixture(env.candidate, { zod: '4.6.4', zodSpec: '^4.6.4' });
    const result = await run(env.production, env.candidate);
    assert.equal(result.code, 2);
    assert.ok(parsed(result).issues.some((issue) => issue.code === 'OLDER_DEPENDENCY' && issue.package === 'zod'));
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});

test('fails closed on a missing production merge', async () => {
  const env = await setup();
  try {
    await fixture(env.candidate, { '@playwright/test': undefined });
    const candidate = JSON.parse(await readFile(path.join(env.candidate, 'package.json'), 'utf8'));
    delete candidate.devDependencies['@playwright/test'];
    await writeFile(path.join(env.candidate, 'package.json'), JSON.stringify(candidate));
    const result = await run(env.production, env.candidate);
    assert.equal(result.code, 2);
    assert.ok(parsed(result).issues.some((issue) => issue.code === 'MISSING_PRODUCTION_MERGE' && issue.package === '@playwright/test'));
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});

test('flags a newer candidate version for explicit review', async () => {
  const env = await setup();
  try {
    await fixture(env.candidate, { zod: '4.7.0', zodSpec: '^4.7.0' });
    const result = await run(env.production, env.candidate);
    assert.equal(result.code, 2);
    assert.ok(parsed(result).issues.some((issue) => issue.code === 'UNEXPECTED_VERSION' && issue.package === 'zod'));
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});

test('fails closed on a package manifest and lockfile root mismatch', async () => {
  const env = await setup();
  try {
    const lock = JSON.parse(await readFile(path.join(env.candidate, 'package-lock.json'), 'utf8'));
    lock.packages[''].devDependencies['@playwright/test'] = '^1.62.0';
    await writeFile(path.join(env.candidate, 'package-lock.json'), JSON.stringify(lock));
    const result = await run(env.production, env.candidate);
    assert.equal(result.code, 2);
    assert.ok(parsed(result).issues.some((issue) => issue.code === 'LOCKFILE_DIVERGENCE' && issue.package === '@playwright/test'));
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});
