import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCipherLedger } from '../../node/src/services/cipher-ledger.ts';

const residentId = 'covert.resident.cipher';
async function fixture(run: (root: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-cipher-ledger-'));
  try { await run(root); } finally { await fs.rm(root, { recursive: true, force: true }); }
}
const prepare = (id: string) => ({
  action_id: id, event_type: 'PREPARE' as const, principal_id: 'operator-fixture',
  principal_kind: 'operator' as const, origin_channel: 'workstation',
  project_id: null, task_id: 'task-fixture', capability: 'agent.tool',
  target_ref: 'authority-operation:' + id, target_digest: 'a'.repeat(64),
  result_state: 'PENDING' as const
});
test('ledger persists stable identity and monotonic concurrent append with honest unsigned integrity', () => fixture(async root => {
  const owner = createCipherLedger({ storageRoot: root, residentId });
  await Promise.all(Array.from({length: 8}, (_, i) => owner.append(prepare('action-' + i))));
  const records = await owner.list();
  assert.deepEqual(records.map(r => r.sequence), [0,1,2,3,4,5,6,7]);
  assert.ok(records.every(r => r.signature_state === 'SIGNATURE_UNAVAILABLE'));
  const reopened = createCipherLedger({ storageRoot: root, residentId });
  assert.equal((await reopened.status()).ledger_id, (await owner.status()).ledger_id);
  assert.equal((await reopened.status()).state, 'RECONCILING');
  assert.equal((await reopened.status()).unresolved_actions.length, 8);
  assert.equal((await reopened.list()).length, 8);
}));
for (const tamper of ['middle', 'remove', 'reorder', 'tail'] as const) {
  test('startup detects ' + tamper + ' ledger tampering and preserves corrupt evidence', () => fixture(async root => {
    const owner = createCipherLedger({ storageRoot: root, residentId });
    for (let i=0;i<3;i++) await owner.append(prepare('action-' + i));
    const file = path.join(root, 'ledger.json');
    const state = JSON.parse(await fs.readFile(file, 'utf8'));
    if (tamper === 'middle') state.records[1].principal_id = 'attacker';
    if (tamper === 'remove') state.records.splice(1,1);
    if (tamper === 'tail') state.records.pop();
    if (tamper === 'reorder') state.records.reverse();
    const bytes=JSON.stringify(state);
    await fs.writeFile(file, bytes);
    const reopened = createCipherLedger({ storageRoot: root, residentId });
    assert.equal((await reopened.status()).state, 'LOCKDOWN');
    await assert.rejects(() => reopened.append(prepare('new-action')), /LOCKDOWN/);
    assert.equal(await fs.readFile(file,'utf8'), bytes);
    assert.equal((await createCipherLedger({storageRoot:root,residentId}).status()).state, 'LOCKDOWN');
  }));
}
test('known ledger disappearance is not silently treated as first use', () => fixture(async root => {
  const owner=createCipherLedger({storageRoot:root,residentId});
  await owner.append(prepare('action'));
  await fs.unlink(path.join(root,'ledger.json'));
  assert.equal((await createCipherLedger({storageRoot:root,residentId}).status()).state,'LOCKDOWN');
}));
test('strict metadata rejects plaintext/unknown credential fields and signature claims', () => fixture(async root => {
  const owner=createCipherLedger({storageRoot:root,residentId});
  await assert.rejects(()=>owner.append({...prepare('action'),token:'CANARY_PRIVATE_TOKEN'}),/invalid ledger metadata/);
  await assert.rejects(()=>owner.append({...prepare('action'),target_ref:'sk-CANARY_PRIVATE_TOKEN'}),/invalid ledger metadata/);
  await assert.rejects(()=>owner.append({...prepare('action'),signature_state:'SIGNATURE_VERIFIED'}),/invalid ledger metadata/);
  assert.equal((await owner.list()).length,0);
}));
test('duplicate action prepare is refused rather than rewritten or blindly retried', () => fixture(async root => {
  const owner=createCipherLedger({storageRoot:root,residentId});
  await owner.append(prepare('same'));
  await assert.rejects(()=>owner.append(prepare('same')),/duplicate action/);
  assert.equal((await owner.list()).length,1);
}));
test('authority decision and attempt require real prepare lineage; no fabricated completion', () => fixture(async root => {
  const owner=createCipherLedger({storageRoot:root,residentId});
  await assert.rejects(()=>owner.append({...prepare('absent'),event_type:'EFFECT_ATTEMPT',result_state:'ALLOWED'}),/lineage/);
  await owner.append(prepare('action'));
  await owner.append({...prepare('action'),event_type:'AUTHORITY_DECISION',result_state:'DENIED',authority_decision_ref:'authority:action:reject'});
  await assert.rejects(()=>owner.append({...prepare('action'),event_type:'EFFECT_ATTEMPT',result_state:'ALLOWED'}),/lineage/);
  assert.equal((await owner.list()).length,2);
}));
test('durable prepare write failure prevents effect admission and does not append success', () => fixture(async root => {
  const owner=createCipherLedger({storageRoot:root,residentId,testHooks:{beforePhase:phase=>{if(phase==='replace')throw new Error('disk unavailable');}}});
  let effects=0;
  await assert.rejects(async()=>{await owner.append(prepare('action'));effects++;},/persistence/);
  assert.equal(effects,0);
}));
test('project addressed query is exact and does not merge another project or global records', () => fixture(async root => {
  const owner=createCipherLedger({storageRoot:root,residentId});
  await owner.append({...prepare('a'),project_id:'project-a'});
  await owner.append({...prepare('b'),project_id:'project-b'});
  await owner.append(prepare('global'));
  assert.deepEqual((await owner.list({project_id:'project-a'})).map(r=>r.action_id),['a']);
}));
test('informational external observation does not grant authority or force lockdown', () => fixture(async root => {
  const owner=createCipherLedger({storageRoot:root,residentId});
  await owner.reportAnomaly('EXTERNAL_OR_UNATTRIBUTED','INFO');
  assert.equal((await owner.status()).state,'NORMAL');
  await owner.reportAnomaly('OWNED_EFFECT_UNRESOLVED','OPERATIONAL');
  assert.equal((await owner.status()).state,'RECONCILING');
  await owner.reportAnomaly('PROTECTED_IDENTITY_CHANGED','SECURITY_CRITICAL');
  assert.equal((await owner.status()).state,'LOCKDOWN');
  assert.equal((await createCipherLedger({storageRoot:root,residentId}).status()).state,'LOCKDOWN');
}));

test('observation cannot manufacture VERIFIED or APPLIED without verifier lineage',()=>fixture(async root=>{
 const owner=createCipherLedger({storageRoot:root,residentId});
 await owner.append(prepare('action'));
 await owner.append({...prepare('action'),event_type:'AUTHORITY_DECISION',result_state:'ALLOWED',authority_decision_ref:'authority:action:approve'});
 await owner.append({...prepare('action'),event_type:'EFFECT_ATTEMPT',result_state:'ALLOWED',effect_generation:'action:1',authority_decision_ref:'authority:action:approve'});
 await assert.rejects(()=>owner.append({...prepare('action'),event_type:'OBSERVATION',result_state:'VERIFIED'}),/lineage/);
}));
test('removing persisted lockdown does not clear it on restart',()=>fixture(async root=>{
 const owner=createCipherLedger({storageRoot:root,residentId});
 await owner.append(prepare('action'));
 await owner.reportAnomaly('PROTECTED_IDENTITY_CHANGED','SECURITY_CRITICAL');
 await fs.unlink(path.join(root,'lockdown.json'));
 const reopened=createCipherLedger({storageRoot:root,residentId});
 assert.equal((await reopened.status()).state,'LOCKDOWN');
}));
test('known live owner detects deletion of both ledger and identity',()=>fixture(async root=>{
 const owner=createCipherLedger({storageRoot:root,residentId});
 await owner.append(prepare('action'));
 await fs.unlink(path.join(root,'ledger.json'));
 await fs.unlink(path.join(root,'identity.json'));
 assert.equal((await owner.status()).state,'LOCKDOWN');
}));
test('malformed storage and unsupported schema cannot become an empty notebook',()=>fixture(async root=>{
 await fs.writeFile(path.join(root,'blocked'),'not a directory');
 const owner=createCipherLedger({storageRoot:path.join(root,'blocked','child'),residentId});
 assert.equal((await owner.status()).state,'LOCKDOWN');
 await assert.rejects(()=>owner.append(prepare('action')),/LOCKDOWN/);
}));

test('unknown observation remains unresolved across restart and cannot be replayed',()=>fixture(async root=>{
 const owner=createCipherLedger({storageRoot:root,residentId});
 await owner.append(prepare('unknown'));
 await owner.append({...prepare('unknown'),event_type:'AUTHORITY_DECISION',result_state:'ALLOWED',authority_decision_ref:'authority:unknown:approve'});
 await owner.append({...prepare('unknown'),event_type:'EFFECT_ATTEMPT',result_state:'ALLOWED',effect_generation:'unknown:1',authority_decision_ref:'authority:unknown:approve'});
 await owner.append({...prepare('unknown'),event_type:'OBSERVATION',result_state:'UNKNOWN_PENDING_RECONCILIATION',observation_ref:'authority:unknown:failure'});
 assert.deepEqual((await owner.status()).unresolved_actions,['unknown']);
 const restarted=createCipherLedger({storageRoot:root,residentId});
 assert.equal((await restarted.status()).state,'RECONCILING');
 await assert.rejects(()=>restarted.append(prepare('retry')),/RECONCILIATION/);
}));
