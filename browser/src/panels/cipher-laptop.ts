import { api } from '../services/api.ts';
import type { CipherNotebookRecordT } from '../../../common/contracts/cipher-notebook.ts';
import type { CipherLedgerListResponseT } from '../../../common/contracts/cipher-laptop.ts';
import type { CurrentProjectResponseT } from '../../../common/contracts/project.ts';

const GATED_SECTIONS = [
 ['MISSIONS','GATED','Mission/task owner projection has not been integrated into this Laptop. No active mission is implied.'],
 ['INBOX','GATED','A durable inbox owner is not integrated. No incoming requests are implied.'],
 ['WATCHES','GATED','Watch registration and governed scheduling are not integrated.'],
 ['SECURITY','GATED','Cross-owner security controls are not integrated here. INTEGRITY shows the real ledger owner.'],
 ['COMMS','NOT CONFIGURED','No remote communication channel is activated.'],
 ['EVIDENCE','GATED','Dedicated verifier/evidence projection is not integrated. Activity may show actual evidence references.'],
 ['PERMISSIONS','GATED','Live Resident enrollment, context leases and a current grant projection are not integrated.']
] as const;
type Section = 'ACTIVITY'|'INTEGRITY'|'NOTEBOOK'|typeof GATED_SECTIONS[number][0];
function sameAddress(left:CurrentProjectResponseT,right:CurrentProjectResponseT):boolean {
 return left.project.project_id===right.project.project_id&&left.checkout.checkout_id===right.checkout.checkout_id;
}

function el(tag:string,cls:string,text?:string):HTMLElement {
 const node=document.createElement(tag);node.className=cls;
 if(text!==undefined)node.textContent=text;return node;
}
export function createCipherLaptopPanel(parent:HTMLElement) {
 parent.innerHTML='';
 const root=el('section','cipher-laptop');
 const toolbar=el('header','cipher-laptop-toolbar');
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='REFRESH';
 refresh.setAttribute('aria-label','Refresh Cipher Laptop');
 toolbar.append(el('h2',"","CIPHER'S LAPTOP"),refresh);
 const projectStatus=el('div','cipher-laptop-project','PROJECT · UNAVAILABLE · awaiting canonical Project owner');
 projectStatus.setAttribute('role','status');
 const status=el('div','cipher-laptop-status','UNAVAILABLE · awaiting canonical record owner');
 status.setAttribute('role','status');
 const tabs=el('nav','cipher-laptop-tabs');tabs.setAttribute('aria-label','Laptop records');
 const activityButton=document.createElement('button');activityButton.type='button';activityButton.textContent='ACTIVITY';
 const securityButton=document.createElement('button');securityButton.type='button';securityButton.textContent='INTEGRITY';
 const notebookButton=document.createElement('button');notebookButton.type='button';notebookButton.textContent='NOTEBOOK';
 const sectionButtons=new Map<Section,HTMLButtonElement>([['ACTIVITY',activityButton],['INTEGRITY',securityButton],['NOTEBOOK',notebookButton]]);
 tabs.append(notebookButton,activityButton,securityButton);
 for(const [name,state] of GATED_SECTIONS){
  const button=document.createElement('button');button.type='button';button.textContent=`${name} · ${state}`;
  button.setAttribute('aria-label',`${name}, ${state}`);sectionButtons.set(name,button);tabs.append(button);
 }
 const content=el('div','cipher-laptop-content');
 const note=el('p','cipher-laptop-note','Shared platform, separate principals. Authority, tasks, projects and verification retain their own truth.');
 const desk=el('div','cipher-laptop-desk');desk.append(tabs,content);
 root.append(toolbar,projectStatus,status,desk,note);parent.appendChild(root);
 let alive=true,inFlight=false,failed=false,receivedAt=0,refreshAfterPair=false;
 let projection:CipherLedgerListResponseT|null=null;
 let selected:Section='ACTIVITY';
 let project:CurrentProjectResponseT|null=null,scopeError='',projectReceivedAt=0;
 let memories:CipherNotebookRecordT[]|null=null,notebookFailed=false,editing:CipherNotebookRecordT|null=null,writing=false;
 let writeMessage='';
 let request:AbortController|null=null;
 let requestTimeout:number|null=null;
 let notebookControls:Array<{node:HTMLButtonElement|HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;locked:boolean}>=[];
 let notebookDraft:{id:string;content:string;retention:string;approved:boolean}|null=null;
 let notebookForm:{project:CurrentProjectResponseT;id:HTMLInputElement;content:HTMLTextAreaElement;retention:HTMLSelectElement;approved:HTMLInputElement}|null=null;
 function clearNotebookDraft(){notebookDraft=null;notebookForm=null;}
 function captureNotebookDraft(){
  if(notebookForm&&project&&!scopeError&&sameAddress(notebookForm.project,project)){
   notebookDraft={id:notebookForm.id.value,content:notebookForm.content.value,retention:notebookForm.retention.value,approved:notebookForm.approved.checked};
  }
 }
 function invalidateProject(reason:string){
  project=null;scopeError=reason;memories=null;editing=null;clearNotebookDraft();
 }
 function canWrite():boolean {
  return Date.now()-projectReceivedAt<=30000&&Date.now()-receivedAt<=30000&&project!==null&&!scopeError&&memories!==null&&!notebookFailed&&projection!==null&&!failed&&projection.status.state==='NORMAL'&&!inFlight&&!writing;
 }
 function paintStatus(){
  for(const {node,locked} of notebookControls)node.disabled=locked||!canWrite();
  if(project){
   const age=Math.max(0,Math.floor((Date.now()-projectReceivedAt)/1000));
   projectStatus.textContent=`PROJECT · ${age>30?'STALE':'SNAPSHOT'} · ${project.project.project_id} / CHECKOUT ${project.checkout.checkout_id} · ${project.foreground_state} · ${project.switching} · receipt ${age}s ago`;
  }else projectStatus.textContent=`PROJECT · UNAVAILABLE · ${scopeError||'awaiting canonical Project owner'}`;
  if(!projection){status.textContent=failed?'UNAVAILABLE · record owner request failed':'UNAVAILABLE · awaiting canonical record owner';return;}
  const age=Math.max(0,Math.floor((Date.now()-receivedAt)/1000));
  status.textContent=`${failed||age>30?'STALE':'SNAPSHOT'} · ${projection.status.state} · ${projection.status.integrity} · receipt ${age}s ago${inFlight?' · refresh pending':''}`;
 }
 function paint(){
  if(!alive)return;captureNotebookDraft();notebookForm=null;paintStatus();content.innerHTML='';notebookControls=[];
  for(const [name,button] of sectionButtons)button.setAttribute('aria-pressed',String(selected===name));
  const gated=GATED_SECTIONS.find(([name])=>name===selected);
  if(gated){content.append(el('h3','cipher-laptop-section-title',`${gated[0]} · ${gated[1]}`),el('p','',gated[2]));return;}
  if(selected==='NOTEBOOK'){paintNotebook();return;}
  if(!projection){content.append(el('p','','No owner records available. No action history has been manufactured.'));return;}
  const state=projection.status;
  if(selected==='INTEGRITY'){
   const details=el('dl','cipher-laptop-security');
   for(const [name,value] of [['RESIDENT',state.resident_id],['LEDGER',state.ledger_id??'UNAVAILABLE'],['INTEGRITY',state.integrity],['SIGNATURE',state.signature_state],['UNRESOLVED ACTIONS',String(state.unresolved_actions.length)],['OPERATOR ACK',state.operator_ack_required?'REQUIRED':'NOT REQUIRED']]){
    details.append(el('dt','',name!),el('dd','',value!));
   }
   content.append(details);
   for(const reason of state.reasons)content.append(el('p','',`${reason.severity} / ${reason.code}`));
   for(const limit of state.limitations)content.append(el('p','cipher-laptop-note',limit));
   if(state.state!=='NORMAL')content.append(el('p','','Effects are held. Recovery is not a reset button; evidence and operator access remain available.'));
   return;
  }
  if(!project){content.append(el('p','','Canonical project binding unavailable. Project action rows are withheld; INTEGRITY remains inspectable.'));return;}
  const records=projection.records.filter(record=>record.project_id===project!.project.project_id&&record.checkout_id===project!.checkout.checkout_id);
  const table=el('table','cipher-laptop-table');table.setAttribute('aria-label','Durable Cipher action chronology');
  const head=el('thead',''),columns=el('tr','');for(const name of ['SEQ / TIME','ACTION / OWNER','STAGE','RESULT'])columns.append(el('th','',name));
  head.append(columns);const body=el('tbody','');
  for(const record of [...records].reverse()){
   const row=el('tr','');row.append(el('td','',`${record.sequence} / ${record.recorded_at}`),el('td','',`${record.action_id} / ${record.principal_kind} / ${record.capability}`),el('td','',record.event_type),el('td','',record.result_state));
   body.append(row);
  }
  table.append(head,body);content.append(table);
  if(!records.length)content.append(el('p','','No durable action records in this checkout.'));
  content.append(el('p','cipher-laptop-note',`Showing ${records.length} matching records from this owner page; ${projection.records.length-records.length} outside this checkout are withheld, including legacy records without an address. Ledger total: ${state.record_count}. OBSERVED is not VERIFIED. Domain payloads and credentials are not copied here.`));
 }

 async function write(effect:()=>Promise<unknown>){
  if(!alive||!canWrite()||!project)return;
  const initiating=project;writing=true;refresh.disabled=true;writeMessage='Request in flight. Canonical Authority decides execution.';paint();
  try{
   let current:CurrentProjectResponseT;
   try{current=await api.projectsCurrent();}
   catch{if(alive)invalidateProject('canonical project binding unavailable; refresh required');throw new Error('PROJECT_BINDING_UNAVAILABLE');}
   if(!alive)return;
   if(!sameAddress(initiating,current)){invalidateProject('project binding changed; refresh before another request');throw new Error('PROJECT_SCOPE_MISMATCH');}
   await effect();writeMessage='Observed save/removal. This does not grant Cipher authority.';editing=null;clearNotebookDraft();if(alive)await read();
  }
  catch{writeMessage='Operation did not return a confirmed result. Inspect activity and current records before any new attempt.';}
  finally{writing=false;if(alive){refresh.disabled=inFlight;paint();}}
 }
 function paintNotebook(){
  content.append(el('p','cipher-laptop-note','Operator-approved records. No automatic memory capture or model-context access. Removal is logical; backups and storage remnants are not erased.'));
  if(!project){content.append(el('p','','Canonical project binding unavailable. Notebook content and mutations are withheld.'));return;}
  content.append(el('p','cipher-laptop-note',`Notebook owner: ${project.continuity_scope}. Individual records do not carry project grants; installation-wide continuity is not implied.`));
  if(notebookFailed)content.append(el('p','','STALE / UNAVAILABLE · Notebook owner read failed'));
  if(memories===null){content.append(el('p','','Notebook owner unavailable.'));return;}
  if(writeMessage)content.append(el('p','',writeMessage));
  for(const record of memories){
   const item=el('section','cipher-notebook-record');item.append(el('h3','',record.record_id),el('p','',record.content),el('p','cipher-laptop-note',record.source+' / '+record.retention+' / revision '+record.revision+' / '+record.provenance_ref));
   const edit=document.createElement('button');edit.type='button';edit.textContent='CORRECT';edit.disabled=writing;
   edit.disabled=!canWrite();edit.addEventListener('click',()=>{if(!canWrite())return;clearNotebookDraft();editing=record;paint();});
   const remove=document.createElement('button');remove.type='button';remove.textContent='REMOVE';remove.disabled=writing;
   remove.disabled=!canWrite();remove.addEventListener('click',()=>{if(canWrite()&&window.confirm('Logically remove this approved record? Canonical Authority still decides.'))void write(()=>api.cipherNotebookRemove({record_id:record.record_id,expected_revision:record.revision}));});
   notebookControls.push({node:edit,locked:false},{node:remove,locked:false});
   item.append(edit,remove);content.append(item);
  }
  const form=document.createElement('form');form.className='cipher-notebook-form';
  const id=document.createElement('input');id.value=notebookDraft?.id??editing?.record_id??'';id.required=true;id.maxLength=240;id.disabled=editing!==null||!canWrite();id.setAttribute('aria-label','Notebook record identity');
  const text=document.createElement('textarea');text.value=notebookDraft?.content??editing?.content??'';text.required=true;text.maxLength=4000;text.disabled=!canWrite();text.setAttribute('aria-label','Notebook approved content');
  const retention=document.createElement('select');retention.setAttribute('aria-label','Notebook retention');retention.disabled=!canWrite();
  for(const value of ['RETAIN','SESSION']){const option=document.createElement('option');option.value=value;option.textContent=value;retention.append(option);}retention.value=notebookDraft?.retention??editing?.retention??'RETAIN';
  const confirm=document.createElement('input');confirm.type='checkbox';confirm.required=true;confirm.disabled=!canWrite();confirm.setAttribute('aria-label','I approve retaining this working record');
  confirm.checked=notebookDraft?.approved??false;
  notebookForm={project,id,content:text,retention,approved:confirm};
  const label=document.createElement('label');label.append(confirm,el('span','','I approve retaining this working record. Never enter credentials.'));
  const save=document.createElement('button');save.type='submit';save.textContent=editing?'SAVE CORRECTION':'SAVE RECORD';save.disabled=!canWrite();
  const idLabel=document.createElement('label');idLabel.append(el('span','','RECORD ID'),id);
  const textLabel=document.createElement('label');textLabel.append(el('span','','APPROVED WORKING RECORD'),text);
  const retentionLabel=document.createElement('label');retentionLabel.append(el('span','','RETENTION'),retention);
  form.append(idLabel,textLabel,retentionLabel,label,save);
  form.addEventListener('submit',event=>{
   event.preventDefault();if(!confirm.checked||!canWrite())return;
   const body={record_id:id.value.trim(),expected_revision:editing?.revision??0,category:'OPERATOR_NOTE' as const,content:text.value,source:'USER_PROVIDED' as const,provenance_ref:'operator:explicit',confidence:null,retention:retention.value==='SESSION'?'SESSION' as const:'RETAIN' as const,approved_memory:true,expires_at:null};
   void write(()=>api.cipherNotebookPut(body));
  });
  if(editing){const cancel=document.createElement('button');cancel.type='button';cancel.textContent='CANCEL';cancel.disabled=writing;cancel.addEventListener('click',()=>{clearNotebookDraft();editing=null;paint();});form.append(cancel);}
  if(!canWrite())content.append(el('p','','Notebook is read-only while owner freshness, project binding or integrity is unresolved. This UI check does not replace Authority.'));
  notebookControls.push(...[id,text,retention,confirm,save].map(node=>({node,locked:node===id&&editing!==null})));
  content.append(form);
 }
 async function read():Promise<void>{
  if(!alive)return;paintStatus();if(inFlight)return;
  inFlight=true;refresh.disabled=true;root.setAttribute('aria-busy','true');paintStatus();
  request=new AbortController();const current=request;
  const timeout=window.setTimeout(()=>current.abort(),8000);requestTimeout=timeout;
  try{
   let initiating:CurrentProjectResponseT|null=null;
   try{initiating=await api.projectsCurrent(current.signal);}catch{if(alive)invalidateProject('canonical project binding unavailable');}
   if(!alive)return;
   if(initiating&&project&&!sameAddress(project,initiating)){memories=null;editing=null;projection=null;clearNotebookDraft();}
   const [activity,notebook]=await Promise.allSettled([
    api.cipherLaptopActivity(current.signal,initiating?.project.project_id),
    initiating?api.cipherNotebook(current.signal):Promise.resolve(null)
   ]);
   if(!alive)return;
   // Integrity is owner-readable even when the project binding is unavailable.
   if(activity.status==='fulfilled'){projection=activity.value;receivedAt=Date.now();failed=false;}else failed=true;
   if(initiating){
    const observed=await api.projectsCurrent(current.signal);
    if(!alive)return;
    if(!sameAddress(initiating,observed)){invalidateProject('project binding changed during owner reads; refresh required');return;}
    project=observed;projectReceivedAt=Date.now();scopeError='';
    if(notebook.status==='fulfilled'&&notebook.value){memories=notebook.value.records;notebookFailed=false;}else notebookFailed=true;
   }
  }
  catch{if(alive){invalidateProject('canonical project binding unavailable');failed=true;}}
  finally{window.clearTimeout(timeout);requestTimeout=null;request=null;inFlight=false;if(alive){refresh.disabled=writing;root.setAttribute('aria-busy','false');paint();if(refreshAfterPair){refreshAfterPair=false;void read();}}}
 }
 // Pairing changes credential availability, not authority. Recover only owner
 // reads; never replay Notebook writes or any platform effect.
 const paired=():void=>{
  if(!alive||!root.isConnected||root.closest('[hidden]'))return;
  if(inFlight){refreshAfterPair=true;return;}
  void read();
 };
 document.addEventListener('covert:authority-paired',paired);
 refresh.addEventListener('click',()=>{void read();});
 for(const [name,button] of sectionButtons)button.addEventListener('click',()=>{selected=name;paint();});
 paint();void read();
 const timer=window.setInterval(()=>{if(alive&&!document.hidden&&root.isConnected&&!root.closest('[hidden]'))paintStatus();},5000);
 return {root,refresh:read,activate:()=>{void read();},dispose(){alive=false;refreshAfterPair=false;document.removeEventListener('covert:authority-paired',paired);clearNotebookDraft();request?.abort();if(requestTimeout!==null)window.clearTimeout(requestTimeout);window.clearInterval(timer);parent.innerHTML='';}};
}
