import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const source=await readFile(new URL('../../browser/src/cockpit/SystemTelemetry.ts',import.meta.url),'utf8');
const script=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.textContent='';this.attributes=new Map();this.listeners=new Map();this.style={};this.isConnected=true;this.hidden=false;}
 append(...nodes){this.children.push(...nodes);}appendChild(node){this.children.push(node);return node;}
 set innerHTML(value){this.children=[];this.textContent=value;}setAttribute(key,value){this.attributes.set(key,value);}
 addEventListener(key,fn){this.listeners.set(key,fn);}closest(){return this.hidden?this:null;}
}
const all=root=>[root,...root.children.flatMap(all)],textOf=root=>all(root).map(node=>node.textContent).join(' ');
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const sample=()=>({detectedAt:10000,totalRamBytes:16*1024**3,freeRamBytes:8*1024**3,vramSource:'none',freeVramKnown:false,vramBytes:0,freeVramBytes:0,logicalCpus:12,tier:'test',backend:'cpu'});
function harness(read){
 const parent=new Element('section'),timers=new Map(),signals=[],document={hidden:false,createElement:tag=>new Element(tag)},exports={};let calls=0,now=10000;
 const window={setTimeout:fn=>{const id=Symbol('timeout');timers.set(id,{fn,kind:'timeout'});return id;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{const id=Symbol('interval');timers.set(id,{fn,kind:'interval'});return id;},clearInterval:id=>timers.delete(id)};
 vm.runInNewContext(script,{exports,document,window,AbortController,Date:class extends Date{static now(){return now;}},require:name=>{assert.equal(name,'../services/api.ts');return{api:{hardwareProfile:signal=>{calls++;signals.push(signal);return read(signal,calls);}}};}});
 const handle=exports.createSystemTelemetry(parent,{});
 return{parent,handle,document,timers,signals,get calls(){return calls;},setTime:value=>{now=value;},fire:kind=>{const timer=[...timers.values()].find(timer=>timer.kind===kind);assert.ok(timer,'expected '+kind+' timer');timer.fn();},clickRefresh:()=>all(parent).find(node=>node.textContent==='REFRESH').listeners.get('click')()};
}
test('stalled hardware read aborts by deadline, releases controls and ignores late data after retry',async()=>{
 let resolveOld;const h=harness((signal,call)=>call===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(sample()));
 assert.ok(h.signals[0]);h.fire('timeout');await tick();assert.equal(h.signals[0].aborted,true);
 const button=all(h.parent).find(node=>node.textContent==='REFRESH');assert.equal(button.disabled,false);assert.match(textOf(h.parent),/UNAVAILABLE/);
 h.clickRefresh();await tick();assert.equal(h.calls,2);assert.match(textOf(h.parent),/8.0 \/ 16.0 GB/);
 resolveOld({...sample(),freeRamBytes:0});await tick();assert.match(textOf(h.parent),/8.0 \/ 16.0 GB/);h.handle.dispose();
});
test('disposing Resource Monitor aborts its pending owner read and removes all timers',async()=>{
 const h=harness(()=>new Promise(()=>{}));assert.ok(h.signals[0]);h.handle.dispose();await tick();
 assert.equal(h.signals[0].aborted,true);assert.equal(h.timers.size,0);assert.equal(h.parent.children.length,0);
});
test('hidden and detached windows do not poll, and owner sample age remains truthful',async()=>{
 const h=harness(async()=>sample());await tick();h.handle.root.hidden=true;h.setTime(61000);h.fire('interval');await tick();assert.equal(h.calls,1);
 h.handle.root.hidden=false;h.handle.root.isConnected=false;h.fire('interval');await tick();assert.equal(h.calls,1);
 h.handle.root.isConnected=true;h.document.hidden=true;h.fire('interval');await tick();assert.equal(h.calls,1);
 h.document.hidden=false;h.handle.activate();await tick();assert.equal(h.calls,2);assert.match(textOf(h.parent),/STALE.*51s/);
 assert.match(textOf(h.parent),/CPU UNAVAILABLE/);assert.match(textOf(h.parent),/GPU UNAVAILABLE/);h.handle.dispose();
});
test('failed refresh retains only explicitly stale observations and coalesces parallel reads',async()=>{
 let fail=false;const h=harness(async()=>{if(fail)throw Error('hardware owner offline');return sample();});await tick();fail=true;
 const first=h.handle.refresh(),second=h.handle.refresh();await Promise.all([first,second]);assert.equal(h.calls,2);
 assert.match(textOf(h.parent),/STALE.*refresh unavailable/);assert.match(textOf(h.parent),/8.0 \/ 16.0 GB/);h.handle.dispose();
});
