import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectCovertPack } from '../../common/platform/covert-pack.ts';
const pack=(id='covert.web')=>({schema:'covert.pack.v1',pack_id:id,name:'Web Product',version:'1.0.0',publisher:{id:'covert.first-party',signature_ref:'signature:claimed'},platform_range:'covert.platform.v1',methodology:'requirements -> visual contract -> implementation -> accessibility -> evidence',components:[{component_id:'covert.editor',required:true,version:'1.0.0',artifact_digest:'a'.repeat(64)}],skills:['developer-way'],workflows:['web-product'],model_roles:{reviewer:'project-reviewer'},verification_gates:['tests','visual-evidence'],requested_capabilities:['workspace.read','workspace.write']});
test('Pack preview is declarative and cannot grant, install, download, bind a model or execute',()=>{
 const result=inspectCovertPack(pack());
 assert.equal(result.mode,'PREVIEW_ONLY');assert.equal(result.activation,'GATED');
 assert.equal(result.publisher_trust,'UNVERIFIED');assert.equal(result.components[0]?.state,'MISSING');
 assert.equal(result.authority_granted,false);assert.equal(result.required_actions.length,1);
 assert.equal(result.methodology,pack().methodology);
});
for(const [name,mutate] of [
 ['credentials',(p:ReturnType<typeof pack>)=>({...p,credentials:{token:'PRIVATE'}})],
 ['grants',(p:ReturnType<typeof pack>)=>({...p,grants:['workspace.write']})],
 ['install script',(p:ReturnType<typeof pack>)=>({...p,install_script:'execute arbitrary code'})],
 ['component script',(p:ReturnType<typeof pack>)=>({...p,components:[{...p.components[0],install_script:'run'}]})],
 ['self authority',(p:ReturnType<typeof pack>)=>({...p,requested_capabilities:['authority.grant']})]
] as const)test('Pack rejects '+name,()=>assert.throws(()=>inspectCovertPack(mutate(pack()))));
test('dependency cycles cannot yield an install plan',()=>{
 const a={...pack('covert.a'),dependencies:['covert.b']},b={...pack('covert.b'),dependencies:['covert.a']};
 assert.throws(()=>inspectCovertPack(a,{packs:new Map([[b.pack_id,b]])}),/cycle/);
});
test('declared artifact digest is not verified merely because a component is installed',()=>{
 const result=inspectCovertPack(pack(),{components:new Map([['covert.editor',{version:'1.0.0',artifact_digest:'b'.repeat(64),qualified:true,redistributable:true,owner_ref:'catalog:editor'}]])});
 assert.equal(result.components[0]?.state,'IDENTITY_MISMATCH');assert.equal(result.activation,'GATED');
});
test('unknown capabilities and absent dependency stay explicit and never silently install',()=>{
 const result=inspectCovertPack({...pack(),dependencies:['missing.pack'],requested_capabilities:['unknown.capability']});
 assert.deepEqual(result.missing_dependencies,['missing.pack']);assert.deepEqual(result.unsupported_capabilities,['unknown.capability']);assert.equal(result.authority_granted,false);
});
