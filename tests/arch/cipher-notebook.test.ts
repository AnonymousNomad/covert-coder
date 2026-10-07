import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';import os from 'node:os';
import { createCipherNotebook } from '../../node/src/services/cipher-notebook.ts';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
const note=(overrides={})=>({record_id:'operator.preference',expected_revision:0,category:'PREFERENCE',content:'Challenge assumptions and attach evidence.',source:'USER_PROVIDED',provenance_ref:'operator:explicit',confidence:null,retention:'RETAIN',approved_memory:true,expires_at:null,...overrides});
async function fixture(run:(ctx:any)=>Promise<void>){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'covert-notebook-'));
 const authority=createExecutionAuthority({workspace:root,record:async()=>({persisted:true})});
 const origin='http://127.0.0.1:4174';const paired=await authority.pair(authority.control.createPairing(origin),origin);const operator=authority.authenticate(paired.token,origin);
 const notebook=createCipherNotebook({storageRoot:path.join(root,'laptop'),authority,residentId:'covert.resident.cipher'});
 const apply=async(body:unknown)=>{
  const input={workspace:root,taskId:'notebook-write',kind:'capability.write',args:{method:'POST',path:'/api/cipher/laptop/notebook',body}};
  const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');
  return authority.execute(operator,op.operation_id,input,(_d,execution)=>notebook.put(body,execution));
 };
 try{await run({root,authority,operator,notebook,apply});}finally{authority.control.close();await fs.rm(root,{recursive:true,force:true});}
}
test('Operator Notebook retains structured provenance across restart',()=>fixture(async({root,authority,notebook,apply})=>{
 await apply(note());const record=(await notebook.list())[0];assert.equal(record.source,'USER_PROVIDED');assert.equal(record.revision,1);
 const reopened=createCipherNotebook({storageRoot:path.join(root,'laptop'),authority,residentId:'covert.resident.cipher'});
 assert.equal((await reopened.list())[0]?.content,note().content);
}));
test('Notebook correction binds expected revision and cannot overwrite newer operator work',()=>fixture(async({notebook,apply})=>{
 await apply(note());await apply(note({expected_revision:1,content:'Keep it concise.'}));
 await assert.rejects(()=>apply(note({expected_revision:1,content:'stale'})),/revision/);
 assert.equal((await notebook.list())[0]?.content,'Keep it concise.');
}));
test('Notebook rejects ambient calls, workers, unknown authority fields and credential-like content',()=>fixture(async({root,authority,operator,notebook,apply})=>{
 await assert.rejects(()=>notebook.put(note(),{operation_id:'forged'}),/execution/);
 await assert.rejects(()=>apply({...note(),grants:['workspace.write']}));await assert.rejects(()=>apply(note({content:'api_key=SECRET_CANARY'})));
 const worker=authority.control.delegate(operator,'agent',['capability.write']),body=note();
 const input={workspace:root,taskId:'worker',kind:'capability.write',args:{method:'POST',path:'/api/cipher/laptop/notebook',body}};const op=await authority.prepare(worker,input);await authority.decide(operator,op.operation_id,'approve');
 await assert.rejects(()=>authority.execute(worker,op.operation_id,input,(_d:any,execution:any)=>notebook.put(body,execution)),/operator/);
 assert.equal((await notebook.list()).length,0);
}));
test('inferred memories require provenance/confidence and operator confirmation; observation grants nothing',()=>fixture(async({notebook,apply})=>{
 await assert.rejects(()=>apply(note({source:'INFERRED',category:'INFERENCE',confidence:null})));
 await assert.rejects(()=>apply(note({source:'INFERRED',category:'INFERENCE',confidence:0.6,approved_memory:false})));
 await apply(note({source:'INFERRED',category:'INFERENCE',confidence:0.6}));
 assert.equal((await notebook.list())[0]?.source,'INFERRED');assert.equal('grants' in (await notebook.list())[0],false);
}));
test('do-not-retain cannot persist and session-only records do not survive owner restart',()=>fixture(async({root,authority,notebook,apply})=>{
 await assert.rejects(()=>apply(note({retention:'DO_NOT_RETAIN'})));
 await apply(note({retention:'SESSION'}));assert.equal((await notebook.list()).length,1);
 const reopened=createCipherNotebook({storageRoot:path.join(root,'laptop'),authority,residentId:'covert.resident.cipher'});
 assert.equal((await reopened.list()).length,0);
}));
test('logical removal persists a content-free tombstone rather than an old personal payload',()=>fixture(async({root,authority,operator,notebook,apply})=>{
 await apply(note());const body={record_id:note().record_id,expected_revision:1};
 const input={workspace:root,taskId:'remove',kind:'capability.write',args:{method:'POST',path:'/api/cipher/laptop/notebook/remove',body}};const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');
 await authority.execute(operator,op.operation_id,input,(_d:any,execution:any)=>notebook.remove(body,execution));
 assert.equal((await notebook.list()).length,0);
 const disk=await fs.readFile(path.join(root,'laptop','notebook.json'),'utf8');assert.equal(disk.includes(note().content),false);assert.match(disk,/TOMBSTONE/);
}));
test('Notebook refuses a permit for another canonical owner even when capability and body match',()=>fixture(async({root,authority,operator,notebook})=>{
 const body=note(),input={workspace:root,taskId:'confused-owner',kind:'capability.write',args:{method:'POST',path:'/api/settings',body}};
 const op=await authority.prepare(operator,input);await authority.decide(operator,op.operation_id,'approve');
 await assert.rejects(()=>authority.execute(operator,op.operation_id,input,(_d:any,execution:any)=>notebook.put(body,execution)),/Notebook route/);
 assert.equal((await notebook.list()).length,0);
}));
test('Notebook reload refuses unapproved or session-only durable records and returns detached records',()=>fixture(async({root,notebook,apply})=>{
 await apply(note());const projected=(await notebook.list())[0];projected.content='MUTATED';assert.equal((await notebook.list())[0].content,note().content);
 const file=path.join(root,'laptop','notebook.json'),value=JSON.parse(await fs.readFile(file,'utf8'));
 value.records[0].approved_memory=false;await fs.writeFile(file,JSON.stringify(value));await assert.rejects(()=>notebook.list());
 value.records[0].approved_memory=true;value.records[0].retention='SESSION';await fs.writeFile(file,JSON.stringify(value));await assert.rejects(()=>notebook.list());
}));
test('Notebook reserves a removable identity before accepting personal content at historical capacity',()=>fixture(async({root,notebook,apply})=>{
 await fs.mkdir(path.join(root,'laptop'),{recursive:true});
 const state={schema:'covert.cipher-notebook.v1',resident_id:'covert.resident.cipher',records:[],tombstones:Array.from({length:500},(_,i)=>({record_id:'removed.'+i,revision:2,state:'TOMBSTONE',removed_at:new Date().toISOString()}))};
 await fs.writeFile(path.join(root,'laptop','notebook.json'),JSON.stringify(state));
 await assert.rejects(()=>apply(note({record_id:'new.personal'})),/limit/);
 assert.equal((await notebook.list()).length,0);
 // A known identity can still be explicitly recreated/corrected at its revision.
 await apply(note({record_id:'removed.0',expected_revision:2}));assert.equal((await notebook.list())[0].revision,3);
}));
