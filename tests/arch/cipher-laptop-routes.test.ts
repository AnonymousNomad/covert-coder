import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes } from '../../node/src/openapi.ts';
import { pairFixture } from './authority-fixture.ts';
import { CipherLedgerListResponse, CipherLedgerStatus } from '../../common/contracts/cipher-laptop.ts';

async function fixture(run:(context:{root:string;arch:ArchServer;base:string;owner:Awaited<ReturnType<typeof pairFixture>>})=>Promise<void>){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'covert-laptop-http-'));
 const arch=new ArchServer(root,path.join(root,'arch.log'));
 for(const route of await buildRoutes(root,'test',{authority:arch.authority,events:arch.events}))arch.route(route);
 const server=await arch.listen(0);const address=server.address();assert.ok(address&&typeof address==='object');
 const base='http://127.0.0.1:'+address.port;const owner=await pairFixture(arch,base);
 try{await run({root,arch,base,owner});}
 finally{arch.events.close();arch.authority.control.close();await arch.logger.flush();await new Promise<void>(resolve=>server.close(()=>resolve()));await fs.rm(root,{recursive:true,force:true});}
}
test('Laptop reads real Authority-correlated file effect through existing production routes',()=>fixture(async({root,owner})=>{
 const initial=await owner.request('/api/cipher/laptop/status');assert.equal(initial.status,200);
 const initialBody=await initial.json();assert.equal(CipherLedgerStatus.parse(initialBody.data).integrity,'UNAVAILABLE');
 const body={path:'real.txt',content:'HTTP_REAL_LAPTOP',approved:true};
 const headers=await owner.approve('POST','/api/file/write',body,'laptop-file');
 const effect=await owner.request('/api/file/write',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(effect.status,200);
 assert.equal(await fs.readFile(path.join(root,'real.txt'),'utf8'),'HTTP_REAL_LAPTOP');
 const response=await owner.request('/api/cipher/laptop/activity');assert.equal(response.status,200);
 const projection=CipherLedgerListResponse.parse((await response.json()).data);
 assert.deepEqual(projection.records.map(record=>record.event_type),['PREPARE','AUTHORITY_DECISION','EFFECT_ATTEMPT','OBSERVATION']);
 assert.equal(projection.status.integrity,'HASH_CHAIN_VERIFIED');
 assert.ok(projection.records.every(record=>record.signature_state==='SIGNATURE_UNAVAILABLE'));
 assert.equal(projection.records.at(-1)?.result_state,'OBSERVED');
}));
test('Laptop is operator-only and does not expose history to anonymous/worker principals',()=>fixture(async({arch,base,owner})=>{
 const anonymous=await fetch(base+'/api/cipher/laptop/activity');assert.equal(anonymous.status,403);
 const operator=arch.authority.authenticate(owner.headers.Authorization.slice(7),owner.headers.Origin);
 const agent=arch.authority.control.delegate(operator,'agent',['capability.read']);
 const route=arch.getRoutes().find(candidate=>candidate.path==='/api/cipher/laptop/activity');assert.ok(route);
 await assert.rejects(()=>Promise.resolve(route.handler({query:{},body:null,actor:agent})),{code:'FORBIDDEN'});
}));
test('tamper lockdown is visible, revokes pending permits, blocks HTTP effects, and keeps operator files readable',()=>fixture(async({root,arch,owner})=>{
 const body={path:'real.txt',content:'PRESERVE_OPERATOR_FILE',approved:true};
 const headers=await owner.approve('POST','/api/file/write',body,'before-tamper');
 assert.equal((await owner.request('/api/file/write',{method:'POST',headers,body:JSON.stringify(body)})).status,200);
 const actor=arch.authority.authenticate(owner.headers.Authorization.slice(7),owner.headers.Origin);
 const pending=await arch.authority.prepare(actor,{workspace:root,taskId:'pending-lockdown',kind:'workspace.write',args:{body:{path:'pending.txt',content:'NEVER'}}});
 await arch.authority.decide(actor,pending.operation_id,'approve');
 const ledgerFile=path.join(root,'.aide','cipher-laptop','ledger.json');
 const state=JSON.parse(await fs.readFile(ledgerFile,'utf8'));state.records[1].principal_id='attacker';
 const preserved=JSON.stringify(state);await fs.writeFile(ledgerFile,preserved);
 const status=await owner.request('/api/cipher/laptop/status');assert.equal(status.status,200);
 assert.equal(CipherLedgerStatus.parse((await status.json()).data).state,'LOCKDOWN');
 assert.equal(arch.authority.inspect(actor,pending.operation_id).state,'revoked');
 const proposed=await owner.request('/api/authority/prepare',{method:'POST',body:JSON.stringify({adapter:'ts',method:'POST',path:'/api/file/write',task_id:'locked-write',body:{path:'blocked.txt',content:'BLOCK',approved:true}})});
 assert.equal(proposed.status,409);
 assert.equal((await proposed.json()).error.code,'NOT_READY');
 await assert.rejects(()=>fs.access(path.join(root,'blocked.txt')));
 const file=await owner.request('/api/file?path=real.txt');assert.equal(file.status,200);
 assert.equal(await fs.readFile(path.join(root,'real.txt'),'utf8'),'PRESERVE_OPERATOR_FILE');
 assert.equal(await fs.readFile(ledgerFile,'utf8'),preserved);
}));

test('operator Notebook uses canonical governed writes, preserves provenance, corrects and logically removes personal content',()=>fixture(async({root,owner})=>{
 const body={record_id:'operator.style',expected_revision:0,category:'PREFERENCE',content:'Challenge weak assumptions.',source:'USER_PROVIDED',provenance_ref:'operator:explicit',confidence:null,retention:'RETAIN',approved_memory:true,expires_at:null};
 const unapproved=await owner.request('/api/cipher/laptop/notebook',{method:'POST',body:JSON.stringify(body)});assert.equal(unapproved.status,409);
 const headers=await owner.approve('POST','/api/cipher/laptop/notebook',body,'notebook-save');
 assert.equal((await owner.request('/api/cipher/laptop/notebook',{method:'POST',headers,body:JSON.stringify(body)})).status,200);
 const listed=await owner.request('/api/cipher/laptop/notebook');assert.equal(listed.status,200);
 assert.equal((await listed.json()).data.records[0].source,'USER_PROVIDED');
 const correction={...body,expected_revision:1,content:'Prefer concise evidence.'};
 const correctionHeaders=await owner.approve('POST','/api/cipher/laptop/notebook',correction,'correct');
 assert.equal((await owner.request('/api/cipher/laptop/notebook',{method:'POST',headers:correctionHeaders,body:JSON.stringify(correction)})).status,200);
 const removal={record_id:body.record_id,expected_revision:2};
 const removalHeaders=await owner.approve('POST','/api/cipher/laptop/notebook/remove',removal,'remove');
 assert.equal((await owner.request('/api/cipher/laptop/notebook/remove',{method:'POST',headers:removalHeaders,body:JSON.stringify(removal)})).status,200);
 assert.deepEqual((await (await owner.request('/api/cipher/laptop/notebook')).json()).data.records,[]);
 const disk=await fs.readFile(path.join(root,'.aide','cipher-laptop','notebook.json'),'utf8');
 assert.equal(disk.includes(body.content),false);assert.equal(disk.includes(correction.content),false);
 const activity=(await (await owner.request('/api/cipher/laptop/activity')).json()).data.records;
 assert.equal(activity.filter((r:{event_type:string})=>r.event_type==='OBSERVATION').length,3);
}));

test('private Laptop state cannot be read or rewritten through generic project file capabilities',()=>fixture(async({root,arch,owner})=>{
 const note={record_id:'operator.private',expected_revision:0,category:'OPERATOR_NOTE',content:'PRIVATE_NOTEBOOK_CANARY',source:'USER_PROVIDED',provenance_ref:'operator:explicit',confidence:null,retention:'RETAIN',approved_memory:true,expires_at:null};
 const headers=await owner.approve('POST','/api/cipher/laptop/notebook',note,'private-note');
 assert.equal((await owner.request('/api/cipher/laptop/notebook',{method:'POST',headers,body:JSON.stringify(note)})).status,200);
 const operator=arch.authority.authenticate(owner.headers.Authorization.slice(7),owner.headers.Origin),worker=arch.authority.control.delegate(operator,'agent',['workspace.read']);
 const seat=arch.capabilityPort(worker);
 await assert.rejects(()=>seat.invoke({method:'GET',path:'/api/file?path=.aide/cipher-laptop/notebook.json',task_id:'private-read'}),{code:'FORBIDDEN'});
 const before=await fs.readFile(path.join(root,'.aide','cipher-laptop','notebook.json'),'utf8'),body={path:'.aide/cipher-laptop/notebook.json',content:'REPLACE_PRIVATE',approved:true};
 const approved=await owner.approve('POST','/api/file/write',body,'private-write');
 assert.equal((await owner.request('/api/file/write',{method:'POST',headers:approved,body:JSON.stringify(body)})).status,403);
 assert.equal(await fs.readFile(path.join(root,'.aide','cipher-laptop','notebook.json'),'utf8'),before);
 assert.equal((await owner.request('/api/cipher/laptop/notebook')).status,200);
}));

test('real-path aliases cannot expose private Laptop content through file, search or agent tools',()=>fixture(async({root,owner})=>{
 const privateRoot=path.join(root,'.aide','cipher-laptop');await fs.mkdir(privateRoot,{recursive:true});
 const raw=path.join(privateRoot,'alias-canary.txt');await fs.writeFile(raw,'PRIVATE_ALIAS_CANARY');
 const alias=path.join(root,'public-alias');await fs.symlink(privateRoot,alias,process.platform==='win32'?'junction':'dir');
 assert.equal((await owner.request('/api/file?path=public-alias/alias-canary.txt')).status,403);
 const fileAlias=path.join(root,'visible-alias.txt');await fs.symlink(raw,fileAlias,process.platform==='win32'?'file':'file');
 const searched=await owner.request('/api/search?q=PRIVATE_ALIAS_CANARY');assert.equal(searched.status,200);
 assert.equal((await searched.json()).data.total,0);
 const {ensureRealInsideWorkspace}=await import('../../node/src/services/agent-tools.mjs');
 await assert.rejects(()=>ensureRealInsideWorkspace(root,path.join(alias,'alias-canary.txt')),{code:'DENIED'});
}));
