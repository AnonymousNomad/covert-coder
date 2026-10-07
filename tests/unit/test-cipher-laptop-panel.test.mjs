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
const projectId='11111111-1111-4111-8111-111111111111',checkoutId='22222222-2222-4222-8222-222222222222';
const address=()=>({project:{project_id:projectId,created_at:'2026-10-07T01:00:00.000Z'},checkout:{project_id:projectId,checkout_id:checkoutId,root:'C:\\projects\\covert',root_device:'1',root_inode:'2',created_at:'2026-10-07T01:00:00.000Z'},foreground_state:'BOUND_CONFIGURED_CHECKOUT',switching:'GATED_OWNER_REBIND_REQUIRED',resident_seat:'LIVE_ENROLLMENT_GATED',continuity_scope:'CONFIGURED_STORAGE_ROOT'});
const snapshot=(state='NORMAL')=>({records:[{sequence:0,recorded_at:'2026-10-07T01:00:00.000Z',action_id:'action',project_id:projectId,checkout_id:checkoutId,principal_kind:'operator',capability:'workspace.write',event_type:'OBSERVATION',result_state:'OBSERVED'}],status:{state,integrity:'HASH_CHAIN_VERIFIED',resident_id:'covert.resident.cipher',ledger_id:'ledger',signature_state:'SIGNATURE_UNAVAILABLE',record_count:1,unresolved_actions:[],operator_ack_required:state==='LOCKDOWN',reasons:[],limitations:['Unsigned local hash chain.']}});
function harness(provider=async()=>snapshot(),options={}){
 const parent=new Element('section'),timers=new Map();let calls=0,projectCalls=0,notebookCalls=0,writes=0,now=10000,signal;
 const documentEvents=new Map();const document={hidden:false,createElement:tag=>new Element(tag),addEventListener:(name,fn)=>documentEvents.set(name,fn),removeEventListener:(name,fn)=>{if(documentEvents.get(name)===fn)documentEvents.delete(name);}};
 const exports={};const window={setTimeout:fn=>{timers.set('timeout',fn);return 'timeout';},clearTimeout:id=>timers.delete(id),setInterval:fn=>{timers.set('interval',fn);return 'interval';},clearInterval:id=>timers.delete(id)};
 vm.runInNewContext(script,{exports,require:name=>{assert.equal(name,'../services/api.ts');return {api:{projectsCurrent:s=>{projectCalls++;signal=s;return options.project?options.project(s):Promise.resolve(address());},cipherNotebook:async()=>{notebookCalls++;return options.notebook?options.notebook():{resident_id:'covert.resident.cipher',records:[]};},cipherNotebookPut:async()=>{writes++;},cipherNotebookRemove:async()=>{writes++;},cipherLaptopActivity:(s,p)=>{calls++;signal=s;return provider(s,p);}}};},document,window,AbortController,Date:class extends Date {static now(){return now;}}});
 const handle=exports.createCipherLaptopPanel(parent);
 return {parent,handle,timers,pair:()=>documentEvents.get('covert:authority-paired')?.(),get documentEvents(){return documentEvents;},get calls(){return calls;},get projectCalls(){return projectCalls;},get notebookCalls(){return notebookCalls;},get writes(){return writes;},get signal(){return signal;},setTime:value=>{now=value;},click:text=>{const button=all(parent).find(node=>node.tag==='button'&&node.textContent===text);assert.ok(button);button.listeners.get('click')();}};
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
 const h=harness(()=>new Promise(()=>{}));void h.handle.refresh();assert.equal(h.projectCalls,1);await tick();assert.equal(h.calls,1);void h.handle.refresh();assert.equal(h.calls,1);
 h.timers.get('timeout')();assert.equal(h.signal.aborted,true);h.handle.dispose();assert.equal(h.timers.size,0);assert.equal(h.parent.children.length,0);
});
test('last receipt ages without polling owner or manufacturing a live state',async()=>{
 const h=harness();await tick();h.setTime(51000);h.timers.get('interval')();assert.match(textOf(h.parent),/STALE.*41s/);assert.equal(h.calls,1);h.handle.dispose();
});
test('lockdown is owner-derived and presents no self-authorizing recovery button',async()=>{
 const h=harness(async()=>snapshot('LOCKDOWN'));await tick();assert.match(textOf(h.parent),/LOCKDOWN/);
 h.click('INTEGRITY');assert.match(textOf(h.parent),/Effects are held/);
 assert.deepEqual(all(h.parent).filter(n=>n.tag==='button').map(n=>n.textContent),['REFRESH','NOTEBOOK','ACTIVITY','INTEGRITY','MISSIONS · GATED','INBOX · GATED','WATCHES · GATED','SECURITY · GATED','COMMS · NOT CONFIGURED','EVIDENCE · GATED','PERMISSIONS · GATED']);h.handle.dispose();
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

const notebookField=(parent,label)=>all(parent).find(node=>node.attributes.get('aria-label')===label);
test('Laptop visibility refresh preserves a same-checkout unsaved record without issuing a mutation',async()=>{
 const h=harness();await tick();h.click('NOTEBOOK');
 notebookField(h.parent,'Notebook record identity').value='operator-draft';notebookField(h.parent,'Notebook approved content').value='unsaved working preference';notebookField(h.parent,'Notebook retention').value='SESSION';notebookField(h.parent,'I approve retaining this working record').checked=true;
 h.handle.activate();await tick();
 assert.equal(notebookField(h.parent,'Notebook record identity').value,'operator-draft');assert.equal(notebookField(h.parent,'Notebook approved content').value,'unsaved working preference');assert.equal(notebookField(h.parent,'Notebook retention').value,'SESSION');assert.equal(notebookField(h.parent,'I approve retaining this working record').checked,true);assert.equal(h.writes,0);h.handle.dispose();
});
test('Laptop visibility refresh preserves an unsaved correction when the owner record changes',async()=>{
 let revision=1;const h=harness(undefined,{notebook:async()=>({records:[{record_id:'approved-note',content:'owner value '+revision,retention:'RETAIN',revision,source:'USER_PROVIDED',provenance_ref:'operator:explicit'}]})});await tick();h.click('NOTEBOOK');h.click('CORRECT');
 notebookField(h.parent,'Notebook approved content').value='unsaved correction';notebookField(h.parent,'Notebook retention').value='SESSION';revision=2;h.handle.activate();await tick();
 assert.equal(notebookField(h.parent,'Notebook approved content').value,'unsaved correction');assert.equal(notebookField(h.parent,'Notebook retention').value,'SESSION');assert.equal(notebookField(h.parent,'Notebook record identity').disabled,true);assert.equal(h.writes,0);h.handle.dispose();
});
test('a verified checkout change discards its prior Notebook form instead of leaking the old draft',async()=>{
 let changed=false;const h=harness(undefined,{project:async()=>{const next=address();if(changed)next.checkout.checkout_id='44444444-4444-4444-8444-444444444444';return next;}});await tick();h.click('NOTEBOOK');
 notebookField(h.parent,'Notebook record identity').value='old-scope-draft';notebookField(h.parent,'Notebook approved content').value='old-scope-private-content';changed=true;h.handle.activate();await tick();
 assert.equal(notebookField(h.parent,'Notebook record identity').value,'');assert.equal(notebookField(h.parent,'Notebook approved content').value,'');assert.equal(h.writes,0);h.handle.dispose();
});


test('Laptop exposes canonical project and checkout IDs rather than deriving identity from window or path',async()=>{
 const h=harness();await tick();assert.match(textOf(h.parent),new RegExp(projectId));assert.match(textOf(h.parent),new RegExp(checkoutId));
 assert.match(textOf(h.parent),/BOUND_CONFIGURED_CHECKOUT/);assert.match(textOf(h.parent),/GATED_OWNER_REBIND_REQUIRED/);h.handle.dispose();
});
test('activity is addressed at the owner and never presents another checkout or legacy history as this project',async()=>{
 let requested;const h=harness(async(s,p)=>{requested=p;const value=snapshot();value.records.push({...value.records[0],action_id:'foreign-project',project_id:'33333333-3333-4333-8333-333333333333'},{...value.records[0],action_id:'foreign-checkout',checkout_id:'44444444-4444-4444-8444-444444444444'},{...value.records[0],action_id:'legacy-no-address',project_id:null,checkout_id:null});return value;});
 await tick();assert.equal(requested,projectId);assert.doesNotMatch(textOf(h.parent),/foreign-project|foreign-checkout|legacy-no-address/);assert.match(textOf(h.parent),/outside this checkout/);h.handle.dispose();
});
test('unknown project hides project records and disables Notebook while owner Integrity remains inspectable',async()=>{
 const h=harness(undefined,{project:async()=>{throw new Error('owner unavailable');},notebook:async()=>({records:[{record_id:'secret-notebook',content:'private-payload'}]})});
 await tick();assert.match(textOf(h.parent),/PROJECT.*UNAVAILABLE/);assert.doesNotMatch(textOf(h.parent),/private-payload|workspace.write/);assert.equal(h.notebookCalls,0);
 h.click('NOTEBOOK');assert.match(textOf(h.parent),/project binding/);assert.equal(all(h.parent).filter(n=>n.tag==='form').length,0);
 h.click('INTEGRITY');assert.match(textOf(h.parent),/SIGNATURE_UNAVAILABLE/);h.handle.dispose();
});
test('a binding change during owner reads discards the old project payloads instead of retargeting them',async()=>{
 let calls=0;const h=harness(undefined,{project:async()=>{const value=address();if(++calls>1)value.checkout.checkout_id='44444444-4444-4444-8444-444444444444';return value;},notebook:async()=>({records:[{record_id:'old-project-note',content:'old-scope-payload'}]})});
 await tick();assert.match(textOf(h.parent),/binding changed/);assert.doesNotMatch(textOf(h.parent),/old-scope-payload|workspace.write/);h.click('NOTEBOOK');assert.equal(all(h.parent).filter(n=>n.tag==='form').length,0);h.handle.dispose();
});
test('gated sections are descriptive navigation and never imply a mission or Authority approval exists',async()=>{
 const h=harness();await tick();for(const name of ['MISSIONS','INBOX','WATCHES','SECURITY','COMMS','EVIDENCE','PERMISSIONS']){
  const button=all(h.parent).find(n=>n.tag==='button'&&n.textContent.startsWith(name+' · '));assert.ok(button,name+' explicitly gated');button.listeners.get('click')();assert.match(textOf(h.parent),/GATED|NOT CONFIGURED/);
 }
 assert.equal(h.writes,0);assert.doesNotMatch(textOf(h.parent),/AWAITING APPROVAL|MISSION 004/);h.handle.dispose();
});
test('Notebook cannot issue a write after its initiating checkout binding changes',async()=>{
 let calls=0;const h=harness(undefined,{project:async()=>{const value=address();if(++calls>2)value.checkout.checkout_id='44444444-4444-4444-8444-444444444444';return value;}});await tick();h.click('NOTEBOOK');
 const form=all(h.parent).find(n=>n.tag==='form');assert.ok(form);all(form).find(n=>n.attributes.get('aria-label')==='Notebook record identity').value='record';all(form).find(n=>n.attributes.get('aria-label')==='Notebook approved content').value='Approved note';all(form).find(n=>n.type==='checkbox').checked=true;
 form.listeners.get('submit')({preventDefault(){}});await tick();assert.equal(h.writes,0);assert.match(textOf(h.parent),/binding changed/);h.handle.dispose();
});

test('stale Notebook snapshots visibly disable mutations without erasing unsaved input',async()=>{
 const h=harness();await tick();h.click('NOTEBOOK');const form=all(h.parent).find(n=>n.tag==='form');const input=all(form).find(n=>n.attributes.get('aria-label')==='Notebook approved content');input.value='unsaved operator draft';
 h.setTime(51000);h.timers.get('interval')();const save=all(form).find(n=>n.textContent==='SAVE RECORD');assert.equal(save.disabled,true);assert.equal(input.value,'unsaved operator draft');assert.match(textOf(h.parent),/STALE/);h.handle.dispose();
});
test('failed Notebook refresh retains only explicitly stale records and cannot issue a write',async()=>{
 let fail=false;const h=harness(undefined,{notebook:async()=>{if(fail)throw new Error('lost Notebook');return {records:[]};}});await tick();fail=true;await h.handle.refresh();h.click('NOTEBOOK');assert.match(textOf(h.parent),/Notebook owner read failed/);assert.equal(all(h.parent).find(n=>n.textContent==='SAVE RECORD').disabled,true);h.handle.dispose();
});

 test('failed submit-time canonical binding lookup withholds Notebook and blocks retries',async()=>{
 let calls=0;const h=harness(undefined,{project:async()=>{if(++calls>2)throw new Error('binding owner unavailable');return address();},notebook:async()=>({records:[{record_id:'approved-note',content:'withheld-after-binding-failure',revision:1,source:'USER_PROVIDED',retention:'RETAIN',provenance_ref:'operator:explicit'}]})});await tick();h.click('NOTEBOOK');
 const form=all(h.parent).find(n=>n.tag==='form');all(form).find(n=>n.attributes.get('aria-label')==='Notebook record identity').value='new-note';all(form).find(n=>n.attributes.get('aria-label')==='Notebook approved content').value='New note';all(form).find(n=>n.type==='checkbox').checked=true;
 form.listeners.get('submit')({preventDefault(){}});await tick();assert.equal(h.writes,0);assert.match(textOf(h.parent),/PROJECT.*UNAVAILABLE/);assert.doesNotMatch(textOf(h.parent),/withheld-after-binding-failure/);assert.equal(all(h.parent).filter(n=>n.tag==='form').length,0);h.click('INTEGRITY');assert.match(textOf(h.parent),/SIGNATURE_UNAVAILABLE/);h.handle.dispose();
});


test('visible Laptop refreshes failed startup reads after real session pairing without issuing effects',async()=>{
 let paired=false;const h=harness(async()=>{if(!paired)throw new Error('UNAUTHORIZED');return snapshot();});await tick();
 assert.match(textOf(h.parent),/UNAVAILABLE.*record owner request failed/);paired=true;h.pair();await tick();
 assert.match(textOf(h.parent),/SNAPSHOT.*HASH_CHAIN_VERIFIED/);assert.equal(h.calls,2);assert.equal(h.writes,0);
 h.handle.dispose();assert.equal(h.documentEvents.size,0);h.pair();await tick();assert.equal(h.calls,2);
});
test('pairing during an unauthenticated read queues one fresh read rather than losing recovery',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});let reads=0;
 const h=harness(async()=>{if(++reads===1){await pending;throw new Error('UNAUTHORIZED');}return snapshot();});await tick();
 h.pair();h.pair();release();await tick();await tick();
 assert.match(textOf(h.parent),/SNAPSHOT.*HASH_CHAIN_VERIFIED/);assert.equal(h.calls,2);assert.equal(h.writes,0);h.handle.dispose();
});

test('a hidden Laptop waits for restore instead of fetching owner records on pairing',async()=>{
 const h=harness();await tick();h.handle.root.closest=()=>({hidden:true});h.pair();await tick();assert.equal(h.calls,1);
 h.handle.root.closest=()=>null;h.handle.activate();await tick();assert.equal(h.calls,2);assert.equal(h.writes,0);h.handle.dispose();
});

test('a queued pairing recovery is deferred if the Laptop is hidden before the old read settles',async()=>{
 let release;const pending=new Promise(resolve=>{release=resolve;});let reads=0;
 const h=harness(async()=>{if(++reads===1){await pending;throw new Error('UNAUTHORIZED');}return snapshot();});await tick();
 h.pair();h.handle.root.closest=()=>({hidden:true});release();await tick();await tick();assert.equal(h.calls,1);
 h.handle.root.closest=()=>null;h.handle.activate();await tick();assert.match(textOf(h.parent),/HASH_CHAIN_VERIFIED/);assert.equal(h.calls,2);assert.equal(h.writes,0);h.handle.dispose();
});
