import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const source=await readFile(new URL('../../browser/src/panels/cipher-laptop.ts',import.meta.url),'utf8');
const script=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.listeners=new Map();this.attributes=new Map();this.isConnected=true;}
 set innerHTML(value){this.children=[];this.textContent=value;}
 append(...values){this.children.push(...values);}appendChild(value){this.children.push(value);return value;}
 setAttribute(key,value){this.attributes.set(key,value);}addEventListener(key,value){this.listeners.set(key,value);}closest(){return null;}
}
const all=root=>[root,...root.children.flatMap(all)];
const textOf=root=>all(root).map(value=>value.textContent).join(' ');
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const snapshot=(state='NORMAL')=>({records:[{sequence:0,recorded_at:'2026-10-07T01:00:00.000Z',action_id:'action',principal_kind:'operator',capability:'workspace.write',event_type:'OBSERVATION',result_state:'OBSERVED'}],status:{state,integrity:'HASH_CHAIN_VERIFIED',resident_id:'covert.resident.cipher',ledger_id:'ledger',signature_state:'SIGNATURE_UNAVAILABLE',record_count:1,unresolved_actions:[],operator_ack_required:state==='LOCKDOWN',reasons:[],limitations:['Unsigned local hash chain.']}});
function harness(provider=async()=>snapshot()){
 const parent=new Element('section'),timers=new Map();let calls=0,now=10000,signal;
 const exports={};const window={setTimeout:fn=>{timers.set('timeout',fn);return 'timeout';},clearTimeout:id=>timers.delete(id),setInterval:fn=>{timers.set('interval',fn);return 'interval';},clearInterval:id=>timers.delete(id)};
 vm.runInNewContext(script,{exports,require:name=>{assert.equal(name,'../services/api.ts');return {api:{cipherNotebook:async()=>({resident_id:'covert.resident.cipher',records:[]}),cipherLaptopActivity:s=>{calls++;signal=s;return provider(s);}}};},document:{hidden:false,createElement:tag=>new Element(tag)},window,AbortController,Date:class extends Date {static now(){return now;}}});
 const handle=exports.createCipherLaptopPanel(parent);
 return {parent,handle,timers,get calls(){return calls;},get signal(){return signal;},setTime:value=>{now=value;},click:text=>{const button=all(parent).find(node=>node.tag==='button'&&node.textContent===text);assert.ok(button);button.listeners.get('click')();}};
}
test('Laptop projects OBSERVED distinctly from verification and signature trust',async()=>{
 const h=harness();await tick();assert.match(textOf(h.parent),/OBSERVED is not VERIFIED/);
 h.click('INTEGRITY');assert.match(textOf(h.parent),/SIGNATURE_UNAVAILABLE/);assert.match(textOf(h.parent),/HASH_CHAIN_VERIFIED/);h.handle.dispose();
});
test('failed owner requests retain records only under an explicit stale label',async()=>{
 let fail=false;const h=harness(async()=>{if(fail)throw new Error('lost owner');return snapshot();});await tick();
 fail=true;await h.handle.refresh();assert.match(textOf(h.parent),/STALE/);assert.match(textOf(h.parent),/workspace.write/);h.handle.dispose();
});
test('timeouts and disposal abort pending reads; coalescing prevents parallel history requests',async()=>{
 const h=harness(()=>new Promise(()=>{}));void h.handle.refresh();assert.equal(h.calls,1);
 h.timers.get('timeout')();assert.equal(h.signal.aborted,true);h.handle.dispose();assert.equal(h.timers.size,0);assert.equal(h.parent.children.length,0);
});
test('last receipt ages without polling owner or manufacturing a live state',async()=>{
 const h=harness();await tick();h.setTime(51000);h.timers.get('interval')();assert.match(textOf(h.parent),/STALE.*41s/);assert.equal(h.calls,1);h.handle.dispose();
});
test('lockdown is owner-derived and presents no self-authorizing recovery button',async()=>{
 const h=harness(async()=>snapshot('LOCKDOWN'));await tick();assert.match(textOf(h.parent),/LOCKDOWN/);
 h.click('INTEGRITY');assert.match(textOf(h.parent),/Effects are held/);
 assert.deepEqual(all(h.parent).filter(n=>n.tag==='button').map(n=>n.textContent),['REFRESH','ACTIVITY','INTEGRITY','NOTEBOOK']);h.handle.dispose();
});

test('real read-only Laptop application is launchable and restores its window without replacing record ownership',async()=>{
 const {WindowManager}=await import('../../browser/src/desktop/window-manager.ts');
 const {createDefaultLayoutState,decodeLayoutState}=await import('../../browser/src/desktop/layout.ts');
 const manager=new WindowManager(createDefaultLayoutState());
 assert.equal(manager.open('cipher-laptop'),true);
 manager.open('cipher-laptop');assert.equal(manager.snapshot().windows.filter(w=>w.appId==='cipher-laptop').length,1);
 assert.ok(decodeLayoutState(manager.snapshot()));
 assert.equal(manager.open('extensions'),false,'unimplemented executable extensions stay disabled');
});

test('Notebook offers explicit approval and visible record/retention labels without claiming automatic capture',async()=>{const h=harness();await tick();h.click('NOTEBOOK');assert.match(textOf(h.parent),/No automatic memory capture/);assert.match(textOf(h.parent),/RECORD ID/);assert.match(textOf(h.parent),/RETENTION/);h.handle.dispose();});
