import path from 'node:path';
import { promises as fs } from 'node:fs';
import { CipherNotebookPut,CipherNotebookRemove,CipherNotebookRecord,CipherNotebookState,type CipherNotebookStateT,type CipherNotebookRecordT } from '../../../common/contracts/cipher-notebook.ts';
import { atomicWriteJson,withFileMutationLock,type AtomicJsonTestHooks } from './atomic-json.ts';
import { AuthorityError,type ExecutionAuthority,type ExecutionHandle } from './execution-authority.mjs';
export function createCipherNotebook(options:{storageRoot:string;residentId:string;authority:ExecutionAuthority;testHooks?:AtomicJsonTestHooks}){
 const root=path.resolve(options.storageRoot),file=path.join(root,'notebook.json');
 const session=new Map<string,CipherNotebookRecordT>();let known=false;
 async function directory(create=false){
  if(create)await fs.mkdir(root,{recursive:true});
  const actual=await fs.realpath(root);
  if((process.platform==='win32'?actual.toLowerCase():actual)!==(process.platform==='win32'?root.toLowerCase():root))throw new Error('Notebook storage is not an owned real directory');
 }
 async function load():Promise<CipherNotebookStateT>{
  try{
   await directory();const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Notebook storage unsafe');
   const value=CipherNotebookState.parse(JSON.parse(await fs.readFile(file,'utf8')));
   if(value.resident_id!==options.residentId)throw new Error('Notebook Resident identity mismatch');
   known=true;return value;
  }catch(error){
   if((error as NodeJS.ErrnoException).code!=='ENOENT'||known)throw error;
   // Do not interpret a file in an ancestor position as a fresh notebook.
   let ancestor=path.dirname(root);
   while(true){try{if(!(await fs.stat(ancestor)).isDirectory())throw new Error('Notebook storage unsafe');break;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}const parent=path.dirname(ancestor);if(parent===ancestor)throw new Error('Notebook storage unavailable');ancestor=parent;}
   return {schema:'covert.cipher-notebook.v1',resident_id:options.residentId,records:[],tombstones:[]};
  }
 }
 function permit(body:unknown,execution:ExecutionHandle,route:string){
  const verified=options.authority.assertExecution(execution,'capability.write',body),actor=verified.actor;
  const args=verified.operation.args;
  if(typeof args!=='object'||args===null||!('method' in args)||!('path' in args)||args.method!=='POST'||args.path!==route)throw new AuthorityError('FORBIDDEN','Notebook route owner mismatch');
  if(actor.kind!=='operator')throw new AuthorityError('FORBIDDEN','only the operator can approve personal working memories');
  return actor;
 }
 const visible=(record:CipherNotebookRecordT)=>record.expires_at===null||Date.parse(record.expires_at)>Date.now();
 async function save(value:CipherNotebookStateT){
  await directory(true);
  await atomicWriteJson(file,value,{validate:input=>{CipherNotebookState.parse(input);},...(options.testHooks?{testHooks:options.testHooks}:{})});known=true;
 }
 return {
  list:()=>withFileMutationLock(file,async()=>{const value=await load();return structuredClone([...value.records.filter(record=>!session.has(record.record_id)),...session.values()].filter(visible));}),
  put:(body:unknown,execution:ExecutionHandle)=>withFileMutationLock(file,async()=>{
   const actor=permit(body,execution,'/api/cipher/laptop/notebook'),input=CipherNotebookPut.parse(body),value=await load();
   const existing=session.get(input.record_id)??value.records.find(record=>record.record_id===input.record_id);
   const tombstone=value.tombstones.find(record=>record.record_id===input.record_id);
   if(input.expected_revision!==(existing?.revision??tombstone?.revision??0))throw new AuthorityError('CONFLICT','Notebook revision changed');
   const reservedIds=new Set([...value.records.map(record=>record.record_id),...value.tombstones.map(record=>record.record_id),...session.keys()]);
   // Reserve revision/removal space before accepting new personal content.
   if(!reservedIds.has(input.record_id)&&reservedIds.size>=500)throw new AuthorityError('CONFLICT','Notebook record limit reached');
   const now=new Date().toISOString();const {expected_revision,...fields}=input;
   const record=CipherNotebookRecord.parse({...fields,revision:expected_revision+1,resident_id:options.residentId,operator_principal_id:actor.id,created_at:existing?.created_at??now,updated_at:now});
   const records=value.records.filter(record=>record.record_id!==input.record_id),tombstones=value.tombstones.filter(record=>record.record_id!==input.record_id);
   if(input.retention==='SESSION'){
    // A retention correction cannot leave the old durable value behind.
    if(existing?.retention==='RETAIN')await save({...value,records,tombstones:[...tombstones,{record_id:input.record_id,revision:record.revision,state:'TOMBSTONE',removed_at:now}]});
    session.set(input.record_id,record);
   }else{await save({...value,records:[...records,record],tombstones});session.delete(input.record_id);}
   return structuredClone(record);
  }),
  remove:(body:unknown,execution:ExecutionHandle)=>withFileMutationLock(file,async()=>{
   permit(body,execution,'/api/cipher/laptop/notebook/remove');const input=CipherNotebookRemove.parse(body),value=await load();
   const existing=session.get(input.record_id)??value.records.find(record=>record.record_id===input.record_id);
   if(!existing||existing.revision!==input.expected_revision)throw new AuthorityError('CONFLICT','Notebook revision changed');
   const next={...value,records:value.records.filter(record=>record.record_id!==input.record_id),tombstones:[...value.tombstones.filter(record=>record.record_id!==input.record_id),{record_id:input.record_id,revision:existing.revision+1,state:'TOMBSTONE' as const,removed_at:new Date().toISOString()}]};
   await save(next);session.delete(input.record_id);return {record_id:input.record_id,revision:existing.revision+1,removed:true as const};
  })
 };
}
export type CipherNotebook=ReturnType<typeof createCipherNotebook>;