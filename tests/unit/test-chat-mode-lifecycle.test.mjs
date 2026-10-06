import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { DEFAULT_CIPHER_MODE, resolveCipherDispatch } from '../../browser/src/cockpit/interaction-mode.ts';
const source=await readFile(new URL('../../browser/src/chat/chat.ts',import.meta.url),'utf8');
const script=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
class Element {
 constructor(tag='div') { this.tagName=tag; this.children=[]; this.listeners={}; this.dataset={}; this.value=''; this.disabled=false; this.className=''; this.classList={add(){},remove(){},toggle(){}}; }
 set textContent(value) { this.text=value; this.children=[]; } get textContent(){ return this.text??''; }
 set innerHTML(_value){} append(...nodes){ this.children.push(...nodes); } appendChild(node){this.children.push(node);return node;}
 addEventListener(type,listener){this.listeners[type]=listener;} setAttribute(){} click(){ if(!this.disabled)this.listeners.click?.({}); }
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const emptyResponse=()=>({body:{getReader:()=>({read:async()=>({done:true})})}});
function harness({saved=true,slowHistory=false}={}){
 const ids=new Map(['#chat-model','#chat-messages','#chat-input','#chat-send','#chat-stop','#chat-banner','#chat-meter','.chat-mode-description','.chat-model-binding','[data-chat-governed-status]'].map(id=>[id,new Element()]));
 const modes=['ask','plan','act'].map(mode=>{const e=new Element('button');e.dataset.mode=mode;return e;});
 const container={set innerHTML(_v){},querySelector:s=>ids.get(s)??null,querySelectorAll:()=>modes};
 const calls=[],governed=[];const stream=deferred(),history=deferred();
 const conversation={id:'conversation',modelId:'local:fixture',messages:[{role:'user',content:'original question'},{role:'assistant',content:'original answer'}]};
 const api={routes:async()=>({routes:[{id:'local:fixture',displayName:'Fixture',status:'ready',contextLength:1000}]}),chatHistory:()=>slowHistory?history.promise:Promise.resolve({conversations:saved?[conversation]:[]}),connections:async()=>({routed_roles:{coder:'local'}}),fit:async()=>({estimatedTokens:1}),chatHistorySave:async()=>({id:'conversation'}),chatStream:(_model,messages)=>{calls.push({model:_model,messages:messages.map(m=>({...m}))});return stream.promise;}};
 const ports={'../services/api.ts':{api},'../services/model-access-events.ts':{MODEL_ACCESS_CHANGED_EVENT:'changed'},'./model-selection.ts':{initialConversationRouteId:()=> 'local:fixture',restoreConversationRouteId:id=>id},'../cockpit/interaction-mode.ts':{DEFAULT_CIPHER_MODE,resolveCipherDispatch}};
 const exports={};vm.runInNewContext(script,{exports,require:name=>{assert.ok(Object.hasOwn(ports,name),name);return ports[name];},Error,AbortController,TextDecoder,document:{createElement:tag=>new Element(tag)},window:{addEventListener(){},removeEventListener(){}}});
 const panel=exports.createChatPanel(container,{onGovernedSubmit:async(mode,task)=>governed.push({mode,task})});
 const messages=ids.get('#chat-messages');
 const find=(root,cls)=>{for(const child of root.children){if(child.className===cls)return child;const nested=find(child,cls);if(nested)return nested;}return null;};
 return{panel,calls,governed,stream,history,conversation,ids,modes,messages,reask:()=>find(messages,'chat-reask'),rows:()=>messages.children};
}
for(const selected of ['ask','plan','act'])test(`ASK re-ask in ${selected} uses only its pinned conversation and preserves the unrelated composer draft`,async()=>{
 const h=harness();await tick();h.modes.find(mode=>mode.dataset.mode===selected).click();h.ids.get('#chat-input').value='unrelated draft';h.reask().click();await tick();
 assert.equal(h.governed.length,0);assert.equal(h.calls.length,1);assert.equal(h.calls[0].model,'local:fixture');
 assert.ok(h.calls[0].messages.some(message=>message.content==='original question'));
 assert.ok(h.calls[0].messages.every(message=>message.content!=='unrelated draft'));
 assert.equal(h.ids.get('#chat-input').value,'unrelated draft');h.stream.resolve(emptyResponse());await tick();h.panel.dispose();
});
for(const result of ['empty','error','abort'])test(`interleaved governed evidence survives ${result} ASK cleanup without a phantom assistant`,async()=>{
 const h=harness({saved:false});await tick();h.ids.get('#chat-input').value='question';h.ids.get('#chat-send').click();await tick();
 h.panel.appendAgentEvent({event:'error',error:'retained governed evidence'});
 if(result==='empty')h.stream.resolve(emptyResponse());else{const error=new Error('request failed');if(result==='abort')error.name='AbortError';h.stream.reject(error);}await tick();
 assert.equal(h.rows().filter(row=>row.className==='chat-timeline-event').length,1);
 assert.equal(h.rows().filter(row=>row.className==='chat-message assistant').length,0);h.panel.dispose();
});
test('direct governed submission cannot bypass the streaming composer guard',async()=>{
 const h=harness({saved:false});await tick();h.ids.get('#chat-input').value='question';h.ids.get('#chat-send').click();await tick();await h.panel.submitGoverned('act','other task');
 assert.equal(h.governed.length,0);h.stream.resolve(emptyResponse());await tick();h.panel.dispose();
});
test('slow conversation restoration preserves governed events received during initialization',async()=>{
 const h=harness({slowHistory:true});await tick();h.panel.appendAgentEvent({event:'error',error:'early governed evidence'});h.history.resolve({conversations:[h.conversation]});await tick();
 assert.equal(h.rows().filter(row=>row.className==='chat-timeline-event').length,1);assert.equal(h.rows().filter(row=>row.className==='chat-message assistant').length,1);h.panel.dispose();
});
