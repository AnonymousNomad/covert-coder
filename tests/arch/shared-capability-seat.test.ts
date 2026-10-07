import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';import os from 'node:os';import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { buildRoutes } from '../../node/src/openapi.ts';
import { pairFixture } from './authority-fixture.ts';
async function fixture(run:(context:any)=>Promise<void>){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'covert-shared-seat-'));
 const arch=new ArchServer(root,path.join(root,'arch.log'));for(const route of await buildRoutes(root,'test',{authority:arch.authority,events:arch.events}))arch.route(route);
 const listener=await arch.listen(0);const address=listener.address();assert.ok(address&&typeof address==='object');
 const owner=await pairFixture(arch,'http://127.0.0.1:'+address.port);
 const operator=arch.authority.authenticate(owner.headers.Authorization.slice(7),owner.headers.Origin);
 try{await run({root,arch,owner,operator});}finally{arch.events.close();arch.authority.control.close();await arch.logger.flush();await new Promise<void>(resolve=>listener.close(()=>resolve()));await fs.rm(root,{recursive:true,force:true});}
}
test('operator HTTP and scoped Resident seat use the same canonical file capability with separate attribution',()=>fixture(async({root,arch,owner,operator})=>{
 const resident=arch.authority.control.delegate(operator,'service',['workspace.read','workspace.write']);
 const seat=arch.capabilityPort(resident);
 const humanBody={path:'shared.txt',content:'HUMAN',approved:true};
 const headers=await owner.approve('POST','/api/file/write',humanBody,'human-write');
 assert.equal((await owner.request('/api/file/write',{method:'POST',headers,body:JSON.stringify(humanBody)})).status,200);
 const request={method:'POST',path:'/api/file/write',task_id:'cipher-write',body:{path:'shared.txt',content:'RESIDENT',approved:true}};
 const operation=await seat.prepare(request);
 let requests=0;await assert.rejects(()=>seat.invoke(request,operation.operation_id),/not approved/);assert.equal(requests,0);
 await arch.authority.decide(operator,operation.operation_id,'approve');
 await seat.invoke(request,operation.operation_id);requests++;
 assert.equal(await fs.readFile(path.join(root,'shared.txt'),'utf8'),'RESIDENT');
 const actors=new Set((await arch.cipherLedger.list()).map((record:any)=>record.principal_id));
 assert.ok(actors.has(operator.id));assert.ok(actors.has(resident.id));assert.notEqual(operator.id,resident.id);
 const read=await seat.invoke({method:'GET',path:'/api/file?path=shared.txt',task_id:'cipher-read'});
 assert.equal(read.content,'RESIDENT');assert.equal('control' in seat,false);assert.equal('decide' in seat,false);
}));
test('Resident seat refuses scope widening, Authority control routes, forged principals and changed intent',()=>fixture(async({arch,operator})=>{
 const resident=arch.authority.control.delegate(operator,'service',['workspace.read']);
 const seat=arch.capabilityPort(resident);
 await assert.rejects(()=>seat.prepare({method:'POST',path:'/api/file/write',task_id:'widen',body:{path:'forbidden.txt',content:'X',approved:true}}),{code:'FORBIDDEN'});
 await assert.rejects(()=>seat.prepare({method:'POST',path:'/api/authority/decision',task_id:'self',body:{operation_id:'fake',decision:'approve'}}),{code:'FORBIDDEN'});
 assert.throws(()=>arch.capabilityPort({id:resident.id,kind:'service'}),{code:'FORBIDDEN'});
 const writer=arch.authority.control.delegate(operator,'service',['workspace.write']);
 const writable=arch.capabilityPort(writer),request={method:'POST',path:'/api/file/write',task_id:'exact',body:{path:'never.txt',content:'approved',approved:true}};
 const op=await writable.prepare(request);await arch.authority.decide(operator,op.operation_id,'approve');
 await assert.rejects(()=>writable.invoke({...request,body:{...request.body,content:'changed'}},op.operation_id),{code:'CONFLICT'});
 arch.authority.control.revoke(writer);await assert.rejects(()=>writable.invoke(request,op.operation_id),{code:'FORBIDDEN'});
}));
