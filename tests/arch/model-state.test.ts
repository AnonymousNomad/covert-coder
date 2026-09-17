import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelDisplayState } from '../../common/model-state.ts';

const evidence = { runtime_available: true, artifact_available: true };

test('model display state keeps startable, running, and route-ready distinct', () => {
  assert.equal(modelDisplayState({ ...evidence, status: 'ready' }), 'STARTABLE');
  assert.equal(modelDisplayState({ ...evidence, status: 'running' }), 'RUNNING');
  assert.equal(modelDisplayState({ ...evidence, status: 'running' }, 'ready'), 'READY');
  assert.equal(modelDisplayState({ ...evidence, status: 'starting' }), 'STARTING');
  assert.equal(modelDisplayState({ ...evidence, status: 'stopped' }), 'STOPPED');
  assert.equal(modelDisplayState({ ...evidence, status: 'error' }), 'FAILED');
  assert.equal(modelDisplayState({ ...evidence, status: 'pending' }), 'AVAILABLE');
});

test('missing runtime or artifact is degraded and never active', () => {
  assert.equal(modelDisplayState({ status: 'ready', runtime_available: false, artifact_available: true }), 'DEGRADED');
  assert.equal(modelDisplayState({ status: 'running', runtime_available: false, artifact_available: true }), 'DEGRADED');
  assert.equal(modelDisplayState({ status: 'pending', runtime_available: true, artifact_available: false }), 'DEGRADED');
});

test('terminal runtime states are not masked by stale route evidence', () => {
  assert.equal(modelDisplayState({ ...evidence, status: 'stopped' }, 'ready'), 'STOPPED');
  assert.equal(modelDisplayState({ ...evidence, status: 'error' }, 'ready'), 'FAILED');
});

test('artifact and runtime evidence never create a verified-ready state', () => {
  assert.equal(modelDisplayState({ ...evidence, status: 'ready' }), 'STARTABLE');
  assert.equal(modelDisplayState({ ...evidence, status: 'running' }), 'RUNNING');
  assert.equal(modelDisplayState({ ...evidence, status: 'running' }, 'unverified'), 'RUNNING');
});
