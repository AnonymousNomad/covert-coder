import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { APP_REGISTRY } from '../../browser/src/desktop/app-registry.ts';
import { MAX_INSTANCES_PER_APP, windowInstanceId } from '../../browser/src/desktop/types.ts';
import { windowPixelBounds } from '../../browser/src/desktop/layout.ts';
const source=await readFile(new URL('../../browser/src/desktop/window-manager-view.ts',import.meta.url),'utf8');
const script=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.listeners=new Map();this.attributes=new Map();this.dataset={};this.style={setProperty(){}};this.clientWidth=1200;this.clientHeight=760;this.textContent='';this.className='';this.parentElement=null;this.classList={toggle:()=>{},add:()=>{},remove:()=>{}};}
 append(...nodes){for(const node of nodes)this.appendChild(node);}
 appendChild(node){node.remove();this.children.push(node);node.parentElement=this;return node;}
 remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}}
 replaceChildren(...nodes){for(const node of [...this.children])node.remove();this.append(...nodes);}
 setAttribute(key,value){this.attributes.set(key,value);}
 addEventListener(key,handler){this.listeners.set(key,handler);}
 querySelector(selector){return all(this).find(node=>selector.startsWith('.')?node.className.split(' ').includes(selector.slice(1)):selector==='[data-action="new-terminal"]'&&node.dataset.action==='new-terminal')??null;}
}
const all=root=>[root,...root.children.flatMap(all)];
const textOf=root=>all(root).map(node=>node.textContent).join(' ');
function harness({left=true,windows=[]}={}){
 const dock=new Element('footer'),launcherHost=new Element('aside'),layer=new Element('main'),paletteHost=new Element('div');
 const state={windows,selectedLayout:'CODING'},calls=[],events=[];let changed=()=>{};
 const manager={snapshot:()=>state,subscribe:fn=>{changed=fn;return()=>{};},open:id=>calls.push(['open',id]),close:id=>calls.push(['close',id]),restore:id=>calls.push(['restore',id]),focus:()=>{},stopSession:()=>{throw new Error('presentation must not stop sessions');}};
 const document={createElement:tag=>new Element(tag),addEventListener(){},removeEventListener(){}},window={addEventListener(){},removeEventListener(){}},exports={};
 vm.runInNewContext(script,{exports,document,window,HTMLElement:Element,require:name=>{
  if(name==='./app-registry.ts')return {APP_REGISTRY};
  if(name==='./types.ts')return {MAX_INSTANCES_PER_APP,windowInstanceId};
  if(name==='./layout.ts')return {windowPixelBounds};
  if(name==='./window-interactions.ts')return {bindWindowInteractions:()=>()=>{}};
  throw new Error('unexpected view dependency '+name);
 }});
 const view=new exports.WindowManagerView({dock,layer,paletteHost,manager,onAttach(app,content,id){events.push(['attach',app,id,content.parentElement.parentElement===layer]);},onVisibility(app,visible,id){events.push(['visibility',app,visible,id]);},...(left?{launcherHost}:{})});
 return {view,dock,launcherHost,layer,calls,events,render:windows=>{state.windows=windows;changed(state);}};
}
test('desktop launcher is mounted in its left host with readable application labels; taskbar is separate',()=>{
 const h=harness();assert.ok(h.launcherHost.querySelector('.desktop-launcher'));
 assert.equal(h.dock.querySelector('.desktop-launcher'),null);
 assert.match(textOf(h.launcherHost),/Cipher Laptop/);assert.match(textOf(h.launcherHost),/Resource Monitor/);
 const disabled=all(h.launcherHost).find(node=>node.dataset.appId==='extensions');assert.equal(disabled.disabled,true);
 const open=all(h.launcherHost).find(node=>node.dataset.appId==='cipher-laptop');open.listeners.get('click')();assert.deepEqual(h.calls,[['open','cipher-laptop']]);
 h.view.dispose();assert.equal(h.launcherHost.children.length,0);assert.equal(h.dock.children.length,0);
});

const resourceWindow=(minimized=false)=>({appId:'resources',instanceId:'resources',zIndex:1,minimized,snap:'none',bounds:{x:0.1,y:0.1,width:0.5,height:0.5}});
test('a restored minimized utility defers owner mounting until it becomes visible and attached',()=>{
 const h=harness({windows:[resourceWindow(true)]});assert.deepEqual(h.events,[]);
 h.render([resourceWindow(false)]);assert.deepEqual(h.events,[['attach','resources','resources',true],['visibility','resources',true,'resources']]);
 h.view.dispose();
});
test('utility visibility follows minimize, restore and close without repeated mounts or geometry-triggered activation',()=>{
 const h=harness({windows:[resourceWindow()]});assert.deepEqual(h.events,[['attach','resources','resources',true],['visibility','resources',true,'resources']]);
 h.events.length=0;h.render([{...resourceWindow(),bounds:{x:0.2,y:0.2,width:0.5,height:0.5}}]);assert.deepEqual(h.events,[]);
 h.render([resourceWindow(true)]);h.render([resourceWindow(false)]);h.render([]);
 assert.deepEqual(h.events,[['visibility','resources',false,'resources'],['visibility','resources',true,'resources'],['visibility','resources',false,'resources']]);
 assert.deepEqual(h.calls,[]);h.view.dispose();
});
test('the existing optional-host composition remains functional while callers migrate',()=>{
 const h=harness({left:false});assert.ok(h.dock.querySelector('.desktop-launcher'));h.view.dispose();
});
test('taskbar captions identify separate terminal windows and closing presentation never stops a PTY',()=>{
 const h=harness({windows:[{appId:'terminal',instanceId:'terminal:2',zIndex:1,minimized:false,snap:'none',bounds:{x:0.1,y:0.1,width:0.5,height:0.5}}]});
 const task=h.dock.querySelector('.desktop-window-task');assert.ok(task);assert.match(textOf(task),/Terminal 02/);
 task.listeners.get('click')();assert.deepEqual(h.calls,[['restore','terminal:2']]);
 const close=all(h.layer).find(node=>node.attributes.get('aria-label')==='Close window');close.listeners.get('click')({stopPropagation(){}});
 assert.deepEqual(h.calls,[['restore','terminal:2'],['close','terminal:2']]);h.view.dispose();
});
