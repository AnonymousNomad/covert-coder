import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';

test('Authority applies workspace Local-Only at prepare and dispatch while preserving local execution', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-local-only-authority-'));
  const preferencePath = path.join(workspace, '.aide', 'routing-preference.json');
  const records: Array<Readonly<Record<string, unknown>>> = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://127.0.0.1:48123';
  try {
    const paired = await authority.pair(authority.control.createPairing(origin), origin);
    const owner = authority.authenticate(paired.token, origin);
    await fs.mkdir(path.dirname(preferencePath), { recursive: true });

    await fs.writeFile(preferencePath, JSON.stringify({ preference: 'local-first' }), 'utf8');
    const external = { workspace, taskId: 'external-on', kind: 'capability.external', args: { body: { provider: 'fixture' } } };
    const prepared = await authority.prepare(owner, external);
    assert.equal(prepared.state, 'pending');
    await authority.decide(owner, prepared.operation_id, 'approve');

    await fs.writeFile(preferencePath, JSON.stringify({ preference: 'local-only' }), 'utf8');
    const dispatchEventsBefore = records.filter(record => record.decision === 'consumed').length;
    let externalEffects = 0;
    await assert.rejects(authority.execute(owner, prepared.operation_id, external, () => { externalEffects += 1; }), { code: 'FORBIDDEN' });
    assert.equal(externalEffects, 0, 'stale external approval cannot dispatch after Local-Only turns on');
    assert.equal(records.filter(record => record.decision === 'consumed').length, dispatchEventsBefore, 'blocked stale approval is rejected before consumption receipt');

    await assert.rejects(authority.prepare(owner, { ...external, taskId: 'external-local-only' }), { code: 'FORBIDDEN' });
    assert.throws(() => authority.assertExternalEgressAllowed(), { code: 'FORBIDDEN' });

    const local = { workspace, taskId: 'local-execute', kind: 'capability.execute', args: { body: { runtime: 'local-fixture' } } };
    const localOp = await authority.prepare(owner, local);
    assert.equal(localOp.state, 'pending');
    await authority.decide(owner, localOp.operation_id, 'approve');
    assert.equal(await authority.execute(owner, localOp.operation_id, local, () => 'local result'), 'local result');
  } finally {
    authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('Authority fails closed when Local-Only preference is malformed or unreadable', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-local-only-invalid-'));
  const preferencePath = path.join(workspace, '.aide', 'routing-preference.json');
  const authority = createExecutionAuthority({ workspace, record: async () => ({ persisted: true }) });
  const origin = 'http://127.0.0.1:48124';
  try {
    const paired = await authority.pair(authority.control.createPairing(origin), origin);
    const owner = authority.authenticate(paired.token, origin);
    await fs.mkdir(path.dirname(preferencePath), { recursive: true });
    await fs.writeFile(preferencePath, '{not-json', 'utf8');
    await assert.rejects(authority.prepare(owner, { workspace, taskId: 'unknown-policy', kind: 'capability.external', args: { body: { provider: 'fixture' } } }), { code: 'NOT_READY' });
    assert.throws(() => authority.assertExternalEgressAllowed(), { code: 'NOT_READY' });
  } finally {
    authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('Authority rechecks Local-Only after consumption persistence and before external execution', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-local-only-consume-race-'));
  const preferencePath = path.join(workspace, '.aide', 'routing-preference.json');
  const records: Array<Readonly<Record<string, unknown>>> = [];
  await fs.mkdir(path.dirname(preferencePath), { recursive: true });
  await fs.writeFile(preferencePath, JSON.stringify({ preference: 'local-first' }), 'utf8');
  const authority = createExecutionAuthority({
    workspace,
    record: async event => {
      records.push(event);
      if (event.decision === 'consumed') {
        await fs.writeFile(preferencePath, JSON.stringify({ preference: 'local-only' }), 'utf8');
      }
      return { persisted: true };
    }
  });
  const origin = 'http://127.0.0.1:48125';
  try {
    const paired = await authority.pair(authority.control.createPairing(origin), origin);
    const owner = authority.authenticate(paired.token, origin);
    const external = { workspace, taskId: 'external-consume-race', kind: 'capability.external', args: { body: { provider: 'fixture' } } };
    const prepared = await authority.prepare(owner, external);
    await authority.decide(owner, prepared.operation_id, 'approve');
    let externalEffects = 0;
    await assert.rejects(authority.execute(owner, prepared.operation_id, external, () => { externalEffects += 1; }), { code: 'FORBIDDEN' });
    assert.equal(externalEffects, 0, 'Local-Only transition during audit persistence prevents executor invocation');
    assert.equal(records.some(record => record.decision === 'consumed'), true, 'consumption attempt remains auditable');
  } finally {
    authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
