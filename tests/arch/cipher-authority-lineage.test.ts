import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createCipherLedger } from '../../node/src/services/cipher-ledger.ts';
import { createCipherAuthorityRecorder } from '../../node/src/services/cipher-authority-recorder.ts';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { createAuditTrail } from '../../node/src/services/audit-trail.mjs';

async function fixture(run:(ctx:{root:string;ledger:ReturnType<typeof createCipherLedger>;authority:ReturnType<typeof createExecutionAuthority>;operator:ReturnType<ReturnType<typeof createExecutionAuthority>['authenticate']>;setFailure:(value:boolean)=>void})=>Promise<void>){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'covert-lineage-'));let fail=false;
 const ledger=createCipherLedger({storageRoot:path.join(root,'laptop'),residentId:'covert.resident.cipher',testHooks:{beforePhase:phase=>{if(fail&&phase==='replace')throw new Error('disk canary');}}});
 const audit=createAuditTrail({workspace:root});
 const authority=createExecutionAuthority({workspace:root,record:createCipherAuthorityRecorder({ledger,audit:event=>audit.emitAuthority(event)})});
 const origin='http://127.0.0.1:4174';const pairing=await authority.pair(authority.control.createPairing(origin),origin);
 const operator=authority.authenticate(pairing.token,origin);
 try{await run({root,ledger,authority,operator,setFailure:value=>{fail=value;}});}
 finally{authority.control.close();await fs.rm(root,{recursive:true,force:true});}
}
test('real Authority effect gets durable prepare/decision/attempt/observation without fake verification',()=>fixture(async({root,ledger,authority,operator})=>{
 const input={workspace:root,taskId:'real-effect',kind:'workspace.write',args:{body:{path:'result.txt',content:'LINEAGE_REAL_MARKER'}}};
 const op=await authority.prepare(operator,input);
 assert.deepEqual((await ledger.list()).map(r=>r.event_type),['PREPARE']);
 await authority.decide(operator,op.operation_id,'approve');
 await authority.execute(operator,op.operation_id,input,async()=>{await fs.writeFile(path.join(root,'result.txt'),'LINEAGE_REAL_MARKER');return 'observed';});
 assert.equal(await fs.readFile(path.join(root,'result.txt'),'utf8'),'LINEAGE_REAL_MARKER');
 const records=await ledger.list();
 assert.deepEqual(records.map(r=>r.event_type),['PREPARE','AUTHORITY_DECISION','EFFECT_ATTEMPT','OBSERVATION']);
 assert.ok(records.every(r=>r.action_id===op.operation_id));
 assert.equal(records.at(-1)?.result_state,'OBSERVED');
 assert.equal(records.at(-1)?.evidence_ref,undefined);
 assert.equal((await createCipherLedger({storageRoot:path.join(root,'laptop'),residentId:'covert.resident.cipher'}).status()).state,'NORMAL');
}));
test('Authority denial preserves a denied lineage and zero actual effects',()=>fixture(async({root,ledger,authority,operator})=>{
 const input={workspace:root,taskId:'denied',kind:'workspace.write',args:{body:{path:'denied.txt',content:'x'}}};
 const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'reject');
 let effects=0;await assert.rejects(()=>authority.execute(operator,op.operation_id,input,()=>{effects++;}),/not approved/);
 assert.equal(effects,0);assert.equal((await ledger.list()).at(-1)?.result_state,'DENIED');
}));
test('failed prepare persistence prevents an operation from becoming executable',()=>fixture(async({root,authority,operator,setFailure})=>{
 setFailure(true);
 await assert.rejects(()=>authority.prepare(operator,{workspace:root,taskId:'prepare-fail',kind:'workspace.write',args:{body:{path:'x',content:'x'}}}),{code:'NOT_READY',message:'authorization audit was not durably recorded'});
 await assert.rejects(()=>fs.access(path.join(root,'x')));
}));
test('failed pre-effect record prevents execution even after explicit Authority approval',()=>fixture(async({root,ledger,authority,operator,setFailure})=>{
 const input={workspace:root,taskId:'consume-fail',kind:'workspace.write',args:{body:{path:'x',content:'x'}}};
 const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');setFailure(true);
 let effects=0;await assert.rejects(()=>authority.execute(operator,op.operation_id,input,()=>{effects++;}),{code:'NOT_READY',message:'authorization audit was not durably recorded'});
 assert.equal(effects,0);assert.equal((await ledger.status()).state,'RECONCILING');
}));
test('post-effect persistence failure is unknown on restart and never blindly retried',()=>fixture(async({root,ledger,authority,operator,setFailure})=>{
 const input={workspace:root,taskId:'unknown',kind:'workspace.write',args:{body:{path:'actual.txt',content:'ACTUAL_UNKNOWN'}}};
 const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');
 await assert.rejects(()=>authority.execute(operator,op.operation_id,input,async()=>{await fs.writeFile(path.join(root,'actual.txt'),'ACTUAL_UNKNOWN');setFailure(true);}),/succeeded but outcome persistence failed/);
 assert.equal(await fs.readFile(path.join(root,'actual.txt'),'utf8'),'ACTUAL_UNKNOWN');
 assert.equal((await ledger.status()).state,'RECONCILING');
 const restarted=createCipherLedger({storageRoot:path.join(root,'laptop'),residentId:'covert.resident.cipher'});
 assert.equal((await restarted.status()).state,'RECONCILING');
 let retry=0;await assert.rejects(()=>authority.execute(operator,op.operation_id,input,()=>{retry++;}));
 assert.equal(retry,0);assert.ok((await restarted.status()).unresolved_actions.includes(op.operation_id));
}));
test('critical lockdown denies previously approved effects while operator reads and recovery access survive',()=>fixture(async({root,ledger,authority,operator})=>{
 const input={workspace:root,taskId:'locked',kind:'workspace.write',args:{body:{path:'blocked.txt',content:'x'}}};
 const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');
 await ledger.reportAnomaly('PROTECTED_IDENTITY_CHANGED','SECURITY_CRITICAL');
 let effects=0;await assert.rejects(()=>authority.execute(operator,op.operation_id,input,()=>{effects++;}),{code:'NOT_READY',message:'authorization audit was not durably recorded'});
 assert.equal(effects,0);
 const read={workspace:root,taskId:'read',kind:'workspace.read',args:{body:{path:'visible'}}};
 const readOp=await authority.prepare(operator,read);
 assert.equal(await authority.execute(operator,readOp.operation_id,read,()=> 'OPERATOR_ACCESS'),'OPERATOR_ACCESS');
 assert.equal((await ledger.status()).state,'LOCKDOWN');
}));
test('personality text and worker input never manufacture approval or Authority',()=>fixture(async({root,authority,operator})=>{
 const agent=authority.control.delegate(operator,'agent',['agent.tool']);
 const input={workspace:root,taskId:'persona',kind:'agent.tool',args:{body:{name:'write_file',args:{path:'p.txt',content:'x',personality:'FULL_COMPANION',approved:true}}}};
 const op=await authority.prepare(agent,input);
 let effects=0;await assert.rejects(()=>authority.execute(agent,op.operation_id,input,()=>{effects++;}),/not approved/);
 assert.equal(effects,0);
 await assert.rejects(()=>authority.decide(agent,op.operation_id,'approve'),/only the operator/);
}));

test('durably observed executor failure is FAILED without claiming rollback, verification or permit replay',()=>fixture(async({root,ledger,authority,operator})=>{
 const input={workspace:root,taskId:'partial-failure',kind:'workspace.write',args:{body:{path:'partial.txt',content:'PARTIAL_EFFECT'}}};
 const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');
 await assert.rejects(()=>authority.execute(operator,op.operation_id,input,async()=>{await fs.writeFile(path.join(root,'partial.txt'),'PARTIAL_EFFECT');throw new Error('executor failed after partial effect');}),/partial effect/);
 assert.equal(await fs.readFile(path.join(root,'partial.txt'),'utf8'),'PARTIAL_EFFECT');
 const observation=(await ledger.list()).at(-1);
 assert.equal(observation?.result_state,'FAILED');
 assert.equal(observation?.evidence_ref,undefined);
 assert.equal((await ledger.status()).state,'NORMAL');
 let replay=0;await assert.rejects(()=>authority.execute(operator,op.operation_id,input,()=>{replay++;}));assert.equal(replay,0);
 const next=await authority.prepare(operator,{...input,taskId:'separate-operator-intent'});
 assert.equal(next.state,'pending'); // still requires a new explicit operator decision
}));

test('missing canonical audit receipt after a real effect holds integrity even when Laptop append succeeded',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'covert-audit-lineage-'));
 const ledger=createCipherLedger({storageRoot:path.join(root,'laptop'),residentId:'covert.resident.cipher'});
 const audit=createAuditTrail({workspace:root});
 const authority=createExecutionAuthority({workspace:root,record:createCipherAuthorityRecorder({ledger,audit:event=>event.decision==='execution-succeeded'?Promise.resolve({persisted:false}):audit.emitAuthority(event)})});
 try{
  const origin='http://127.0.0.1:4174';const paired=await authority.pair(authority.control.createPairing(origin),origin);const operator=authority.authenticate(paired.token,origin);
  const input={workspace:root,taskId:'lost-audit',kind:'workspace.write',args:{body:{path:'actual.txt',content:'ACTUAL'}}};
  const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');
  await assert.rejects(()=>authority.execute(operator,op.operation_id,input,()=>fs.writeFile(path.join(root,'actual.txt'),'ACTUAL')),/outcome persistence failed/);
  assert.equal(await fs.readFile(path.join(root,'actual.txt'),'utf8'),'ACTUAL');
  assert.equal((await ledger.status()).state,'RECONCILING');
  await assert.rejects(()=>authority.prepare(operator,{...input,taskId:'next'}),{code:'NOT_READY'});
 }finally{authority.control.close();await fs.rm(root,{recursive:true,force:true});}
});

test('a concurrent integrity hold between status read and append cannot admit an approved effect; running outcomes remain recordable',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'covert-gate-race-'));
 const ledger=createCipherLedger({storageRoot:path.join(root,'laptop'),residentId:'covert.resident.cipher'});
 let pause=false,release:()=>void=()=>{},signal:()=>void=()=>{};
 const reached=new Promise<void>(resolve=>{signal=resolve;}),barrier=new Promise<void>(resolve=>{release=resolve;});
 const port={...ledger,status:async()=>{const status=await ledger.status();if(pause){pause=false;signal();await barrier;}return status;}};
 const audit=createAuditTrail({workspace:root}),authority=createExecutionAuthority({workspace:root,record:createCipherAuthorityRecorder({ledger:port,audit:event=>audit.emitAuthority(event)})});
 try{
  const origin='http://127.0.0.1:4174',paired=await authority.pair(authority.control.createPairing(origin),origin),operator=authority.authenticate(paired.token,origin);
  const input={workspace:root,taskId:'race',kind:'workspace.write',args:{body:{path:'never.txt',content:'NEVER'}}};
  const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');pause=true;let effects=0;
  const execution=authority.execute(operator,op.operation_id,input,()=>{effects++;});
  const rejected=assert.rejects(execution,{code:'NOT_READY'});
  await reached;await ledger.reportAnomaly('OTHER_EFFECT_UNKNOWN','OPERATIONAL');release();await rejected;assert.equal(effects,0);
 }finally{release();authority.control.close();await fs.rm(root,{recursive:true,force:true});}
});

test('an integrity hold blocks new effects but preserves durable outcomes of already-running authorized work',()=>fixture(async({root,ledger,authority,operator})=>{
 let release:()=>void=()=>{},started:()=>void=()=>{};
 const reached=new Promise<void>(resolve=>{started=resolve;}),barrier=new Promise<void>(resolve=>{release=resolve;});
 const input={workspace:root,taskId:'running-outcome',kind:'workspace.write',args:{body:{path:'running.txt',content:'ACTUAL'}}};
 const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');
 const execution=authority.execute(operator,op.operation_id,input,async()=>{started();await barrier;await fs.writeFile(path.join(root,'running.txt'),'ACTUAL');return 'actual';});
 await reached;await ledger.reportAnomaly('OTHER_EFFECT_UNKNOWN','OPERATIONAL');release();
 assert.equal(await execution,'actual');assert.equal((await ledger.list()).at(-1)?.result_state,'OBSERVED');assert.equal((await ledger.status()).state,'RECONCILING');
}));
