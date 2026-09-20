import assert from 'node:assert/strict';
import test from 'node:test';
import { EdgeSnapshot } from '../../common/contracts/mobile.ts';
import { createRemoteBridgeService } from '../../node/src/services/remote-bridge.mjs';

const workspacePath = 'E:\\private\\covert-workstation';
const helixPath = 'E:\\private\\helix\\raw-store.db';
const providerSecret = 'provider-secret-sentinel';
const ptySentinel = 'pty-command-sentinel';
const workerAuthority = 'direct-worker-authority-sentinel';

test('Edge projection strips raw execution, storage, and credential authority', async () => {
  const bridge = createRemoteBridgeService({
    workspace: workspacePath,
    resident: {
      summary: async () => ({
        status: 'ready',
        recommendation: 'Resident is ready.',
        helix_path: helixPath,
        provider_token: providerSecret
      })
    },
    workflow: {
      load: async () => ({ workflow_id: 'wf-edge', stage: 'verify', updated_at: new Date(1700000000000).toISOString(), command: ptySentinel })
    },
    tasks: {
      status: async () => ({
        jobs: [{ job_id: 'job-edge', label: 'bounded job', status: 'done', startedAt: 1700000000000, endedAt: 1700000001000, pty: ptySentinel, filesystem_root: workspacePath }]
      })
    },
    notifications: { list: () => ({ notifications: [] }) },
    modelRuntime: {
      status: async () => ({
        models: [{
          id: 'model-edge',
          status: 'ready',
          provider: 'local',
          name: 'cipher',
          api_key: providerSecret,
          authority: workerAuthority,
          command: ptySentinel,
          filesystem_root: workspacePath,
          helix_path: helixPath
        }]
      })
    },
    clock: () => 1700000002000
  });

  const snapshot = await bridge.snapshot();
  assert.equal(EdgeSnapshot.safeParse(snapshot).success, true, 'projection must satisfy the strict Edge snapshot contract');
  assert.deepEqual(Object.keys(bridge).sort(), ['capabilities', 'command', 'snapshot']);
  assert.deepEqual(Object.keys(snapshot.workers[0] ?? {}).sort(), ['id', 'model', 'provider', 'role', 'status']);
  assert.deepEqual(Object.keys(snapshot.jobs[0] ?? {}).sort(), ['ended_at', 'id', 'label', 'started_at', 'status']);

  const serialized = JSON.stringify(snapshot);
  for (const sentinel of [workspacePath, helixPath, providerSecret, ptySentinel, workerAuthority]) {
    assert.equal(serialized.includes(sentinel), false, `Edge projection leaked ${sentinel}`);
  }

  const confirmedMutation = await bridge.command({ command: 'workflow.start', confirmation: true });
  assert.equal(confirmedMutation.accepted, false);
  assert.equal(confirmedMutation.requires_confirmation, true);
  assert.match(confirmedMutation.reason, /not connected|no mutation/i);
});
