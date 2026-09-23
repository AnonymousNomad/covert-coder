// First-run readiness battery. Controls:
// - deterministic items with code/explanation/repair/blocking;
// - UNKNOWN probes never block; BLOCKED blocking items do;
// - non-git workspace is READY (truthful), not an error;
// - golden mission readiness requires a running model + admissible resources.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadinessService } from '../../node/src/services/readiness.ts';

function sources(overrides: Record<string, unknown> = {}) {
  return {
    healthSnapshot: async () => ({ state: 'HEALTHY', components: [{ component: 'backend', state: 'HEALTHY' }] }),
    modelsStatus: async () => ({ models: [{ id: 'local-1', status: 'running' }] }),
    rgAvailable: () => true,
    workspaceWritable: async () => true,
    gitRepo: async () => ({ git_repo: true }),
    memoryAdmit: async () => ({ decision: 'START', reason: 'admitted' }),
    ...overrides
  } as Parameters<typeof createReadinessService>[0];
}

test('healthy environment: ready and golden ready', async () => {
  const snapshot = await createReadinessService(sources()).snapshot();
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.ready_for_golden_mission, true);
  assert.ok(snapshot.items.every(item => item.code.length > 0));
});

test('non-git workspace is READY with an honest code (not an error)', async () => {
  const snapshot = await createReadinessService(sources({ gitRepo: async () => ({ git_repo: false }) })).snapshot();
  const git = snapshot.items.find(item => item.id === 'git');
  assert.equal(git?.state, 'READY');
  assert.equal(git?.code, 'NON_GIT_WORKSPACE');
  assert.equal(snapshot.ready, true);
});

test('no running model: DEGRADED, non-blocking, golden NOT ready', async () => {
  const snapshot = await createReadinessService(sources({ modelsStatus: async () => ({ models: [{ id: 'local-1', status: 'stopped' }] }) })).snapshot();
  const models = snapshot.items.find(item => item.id === 'models');
  assert.equal(models?.state, 'DEGRADED');
  assert.equal(models?.blocking, false);
  assert.equal(snapshot.ready, true);
  assert.equal(snapshot.ready_for_golden_mission, false);
});

test('memory refusal: BLOCKED blocking item and ready false', async () => {
  const snapshot = await createReadinessService(sources({ memoryAdmit: async () => ({ decision: 'REFUSE_RESOURCE', reason: 'below safety floor' }) })).snapshot();
  const resources = snapshot.items.find(item => item.id === 'resources');
  assert.equal(resources?.state, 'BLOCKED');
  assert.equal(resources?.blocking, true);
  assert.equal(resources?.code, 'INSUFFICIENT_MEMORY');
  assert.equal(snapshot.ready, false);
});

test('queued resources: DEGRADED but golden ready not required to block', async () => {
  const snapshot = await createReadinessService(sources({ memoryAdmit: async () => ({ decision: 'QUEUE', reason: 'tight' }) })).snapshot();
  const resources = snapshot.items.find(item => item.id === 'resources');
  assert.equal(resources?.state, 'DEGRADED');
  assert.equal(snapshot.ready, true);
});

test('failing probes are UNKNOWN and never block', async () => {
  const broken = sources({
    healthSnapshot: async () => { throw new Error('down'); },
    modelsStatus: async () => { throw new Error('down'); },
    workspaceWritable: async () => { throw new Error('down'); },
    gitRepo: async () => { throw new Error('down'); },
    memoryAdmit: async () => { throw new Error('down'); }
  });
  const snapshot = await createReadinessService(broken).snapshot();
  for (const id of ['git', 'models', 'resources']) {
    assert.equal(snapshot.items.find(item => item.id === id)?.state, 'UNKNOWN');
  }
  // core and workspace map probe failure to BLOCKED (fail closed), everything else stays unknown.
  assert.equal(snapshot.ready, false);
  assert.equal(snapshot.items.find(item => item.id === 'core')?.state, 'BLOCKED');
  assert.equal(snapshot.items.find(item => item.id === 'workspace')?.state, 'BLOCKED');
});

test('unhealthy core: BLOCKED with repair guidance', async () => {
  const snapshot = await createReadinessService(sources({ healthSnapshot: async () => ({ state: 'UNHEALTHY', components: [] }) })).snapshot();
  const core = snapshot.items.find(item => item.id === 'core');
  assert.equal(core?.state, 'BLOCKED');
  assert.equal(core?.code, 'CORE_UNHEALTHY');
  assert.ok((core?.repair ?? '').length > 0);
  assert.equal(snapshot.ready, false);
});
