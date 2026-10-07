import { api } from '../services/api.ts';
import type { CipherNotebookRecordT } from '../../../common/contracts/cipher-notebook.ts';
import type { CipherLedgerListResponseT } from '../../../common/contracts/cipher-laptop.ts';

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
 toolbar.append(el('h2','','CIPHER / LAPTOP'),refresh);
 const status=el('div','cipher-laptop-status','UNAVAILABLE · awaiting canonical record owner');
 status.setAttribute('role','status');
 const tabs=el('nav','cipher-laptop-tabs');tabs.setAttribute('aria-label','Laptop records');
 const activityButton=document.createElement('button');activityButton.type='button';activityButton.textContent='ACTIVITY';
 const securityButton=document.createElement('button');securityButton.type='button';securityButton.textContent='INTEGRITY';
 const notebookButton=document.createElement('button');notebookButton.type='button';notebookButton.textContent='NOTEBOOK';
 tabs.append(activityButton,securityButton,notebookButton);
 const content=el('div','cipher-laptop-content');
 const note=el('p','cipher-laptop-note','Shared platform, separate principals. Authority, tasks, projects and verification retain their own truth.');
 root.append(toolbar,status,tabs,content,note);parent.appendChild(root);
 let alive=true,inFlight=false,failed=false,receivedAt=0;
 let projection:CipherLedgerListResponseT|null=null;
 let selected:'activity'|'security'|'notebook'='activity';
 let memories:CipherNotebookRecordT[]|null=null,notebookFailed=false,editing:CipherNotebookRecordT|null=null,writing=false;
 let writeMessage='';
 let request:AbortController|null=null;
 let requestTimeout:number|null=null;
 function paintStatus(){
  if(!projection){status.textContent=failed?'UNAVAILABLE · record owner request failed':'UNAVAILABLE · awaiting canonical record owner';return;}
  const age=Math.max(0,Math.floor((Date.now()-receivedAt)/1000));
  status.textContent=`${failed||age>30?'STALE':'SNAPSHOT'} · ${projection.status.state} · ${projection.status.integrity} · receipt ${age}s ago${inFlight?' · refresh pending':''}`;
 }
 function paint(){
  if(!alive)return;paintStatus();content.innerHTML='';
  activityButton.setAttribute('aria-pressed',String(selected==='activity'));
  securityButton.setAttribute('aria-pressed',String(selected==='security'));
  notebookButton.setAttribute('aria-pressed',String(selected==='notebook'));
  if(selected==='notebook'){paintNotebook();return;}
  if(!projection){content.append(el('p','','No owner records available. No action history has been manufactured.'));return;}
  const state=projection.status;
  if(selected==='security'){
   const details=el('dl','cipher-laptop-security');
   for(const [name,value] of [['RESIDENT',state.resident_id],['LEDGER',state.ledger_id??'UNAVAILABLE'],['INTEGRITY',state.integrity],['SIGNATURE',state.signature_state],['PENDING',String(state.unresolved_actions.length)],['OPERATOR ACK',state.operator_ack_required?'REQUIRED':'NOT REQUIRED']]){
    details.append(el('dt','',name!),el('dd','',value!));
   }
   content.append(details);
   for(const reason of state.reasons)content.append(el('p','',`${reason.severity} / ${reason.code}`));
   for(const limit of state.limitations)content.append(el('p','cipher-laptop-note',limit));
   if(state.state!=='NORMAL')content.append(el('p','','Effects are held. Recovery is not a reset button; evidence and operator access remain available.'));
   return;
  }
  const table=el('table','cipher-laptop-table');table.setAttribute('aria-label','Durable Cipher action chronology');
  const head=el('thead',''),columns=el('tr','');for(const name of ['SEQ / TIME','ACTION / OWNER','STAGE','RESULT'])columns.append(el('th','',name));
  head.append(columns);const body=el('tbody','');
  for(const record of [...projection.records].reverse()){
   const row=el('tr','');row.append(el('td','',`${record.sequence} / ${record.recorded_at}`),el('td','',`${record.action_id} / ${record.principal_kind} / ${record.capability}`),el('td','',record.event_type),el('td','',record.result_state));
   body.append(row);
  }
  table.append(head,body);content.append(table);
  if(!projection.records.length)content.append(el('p','','No durable action records in this scope.'));
  content.append(el('p','cipher-laptop-note',`Showing ${projection.records.length} of ${state.record_count} records. OBSERVED is not VERIFIED. Domain payloads and credentials are not copied here.`));
 }

 async function write(effect:()=>Promise<unknown>){
  if(writing||!alive)return;writing=true;writeMessage='Awaiting canonical Authority / effect result';paint();
  try{await effect();writeMessage='Observed save/removal. This does not grant Cipher authority.';editing=null;if(alive)await read();}
  catch{writeMessage='Operation did not return a confirmed result. Inspect activity and current records before any new attempt.';}
  finally{writing=false;if(alive)paint();}
 }
 function paintNotebook(){
  content.append(el('p','cipher-laptop-note','Operator-approved records. No automatic memory capture or model-context access. Removal is logical; backups and storage remnants are not erased.'));
  if(notebookFailed)content.append(el('p','','STALE / UNAVAILABLE · Notebook owner read failed'));
  if(memories===null){content.append(el('p','','Notebook owner unavailable.'));return;}
  if(writeMessage)content.append(el('p','',writeMessage));
  for(const record of memories){
   const item=el('section','cipher-notebook-record');item.append(el('h3','',record.record_id),el('p','',record.content),el('p','cipher-laptop-note',record.source+' / '+record.retention+' / revision '+record.revision+' / '+record.provenance_ref));
   const edit=document.createElement('button');edit.type='button';edit.textContent='CORRECT';edit.disabled=writing;
   edit.addEventListener('click',()=>{editing=record;paint();});
   const remove=document.createElement('button');remove.type='button';remove.textContent='REMOVE';remove.disabled=writing;
   remove.addEventListener('click',()=>{if(window.confirm('Logically remove this approved record? Canonical Authority still decides.'))void write(()=>api.cipherNotebookRemove({record_id:record.record_id,expected_revision:record.revision}));});
   item.append(edit,remove);content.append(item);
  }
  const form=document.createElement('form');form.className='cipher-notebook-form';
  const id=document.createElement('input');id.value=editing?.record_id??'';id.required=true;id.maxLength=240;id.disabled=editing!==null||writing;id.setAttribute('aria-label','Notebook record identity');
  const text=document.createElement('textarea');text.value=editing?.content??'';text.required=true;text.maxLength=4000;text.disabled=writing;text.setAttribute('aria-label','Notebook approved content');
  const retention=document.createElement('select');retention.setAttribute('aria-label','Notebook retention');retention.disabled=writing;
  for(const value of ['RETAIN','SESSION']){const option=document.createElement('option');option.value=value;option.textContent=value;retention.append(option);}retention.value=editing?.retention??'RETAIN';
  const confirm=document.createElement('input');confirm.type='checkbox';confirm.required=true;confirm.disabled=writing;confirm.setAttribute('aria-label','I approve retaining this working record');
  const label=document.createElement('label');label.append(confirm,el('span','','I approve retaining this working record. Never enter credentials.'));
  const save=document.createElement('button');save.type='submit';save.textContent=editing?'SAVE CORRECTION':'SAVE RECORD';save.disabled=writing;
  const idLabel=document.createElement('label');idLabel.append(el('span','','RECORD ID'),id);
  const textLabel=document.createElement('label');textLabel.append(el('span','','APPROVED WORKING RECORD'),text);
  const retentionLabel=document.createElement('label');retentionLabel.append(el('span','','RETENTION'),retention);
  form.append(idLabel,textLabel,retentionLabel,label,save);
  form.addEventListener('submit',event=>{
   event.preventDefault();if(!confirm.checked||writing)return;
   const body={record_id:id.value.trim(),expected_revision:editing?.revision??0,category:'OPERATOR_NOTE' as const,content:text.value,source:'USER_PROVIDED' as const,provenance_ref:'operator:explicit',confidence:null,retention:retention.value==='SESSION'?'SESSION' as const:'RETAIN' as const,approved_memory:true,expires_at:null};
   void write(()=>api.cipherNotebookPut(body));
  });
  if(editing){const cancel=document.createElement('button');cancel.type='button';cancel.textContent='CANCEL';cancel.disabled=writing;cancel.addEventListener('click',()=>{editing=null;paint();});form.append(cancel);}
  content.append(form);
 }
 async function read():Promise<void>{
  if(!alive)return;paintStatus();if(inFlight)return;
  inFlight=true;refresh.disabled=true;root.setAttribute('aria-busy','true');
  request=new AbortController();const current=request;
  const timeout=window.setTimeout(()=>current.abort(),8000);requestTimeout=timeout;
  try{const [activity,notebook]=await Promise.allSettled([api.cipherLaptopActivity(current.signal),api.cipherNotebook(current.signal)]);if(alive){if(activity.status==='fulfilled'){projection=activity.value;receivedAt=Date.now();failed=false;}else failed=true;if(notebook.status==='fulfilled'){memories=notebook.value.records;notebookFailed=false;}else notebookFailed=true;}}
  catch{if(alive)failed=true;}
  finally{window.clearTimeout(timeout);requestTimeout=null;request=null;inFlight=false;if(alive){refresh.disabled=false;root.setAttribute('aria-busy','false');paint();}}
 }
 refresh.addEventListener('click',()=>{void read();});
 activityButton.addEventListener('click',()=>{selected='activity';paint();});
 securityButton.addEventListener('click',()=>{selected='security';paint();});
 notebookButton.addEventListener('click',()=>{selected='notebook';paint();});
 paint();void read();
 const timer=window.setInterval(()=>{if(alive&&!document.hidden&&root.isConnected&&!root.closest('[hidden]'))paintStatus();},5000);
 return {root,refresh:read,activate:()=>{void read();},dispose(){alive=false;request?.abort();if(requestTimeout!==null)window.clearTimeout(requestTimeout);window.clearInterval(timer);parent.innerHTML='';}};
}