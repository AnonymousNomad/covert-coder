import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { atomicWriteJson, withFileMutationLock, type AtomicJsonTestHooks } from './atomic-json.ts';
import {
  CipherLedgerInput, CipherLedgerRecord, CipherLedgerState, CipherLockdown,
  type CipherLedgerInputT, type CipherLedgerRecordT, type CipherLedgerStateT, type CipherLockdownT, type CipherLedgerStatusT
} from '../../../common/contracts/cipher-laptop.ts';

const GENESIS='0'.repeat(64);
const Identity=z.object({schema:z.literal('covert.cipher-ledger-identity.v1'),ledger_id:z.string().uuid(),resident_id:z.string().min(1).max(240),lockdown_hash:z.string().regex(/^[a-f0-9]{64}$/).nullable()}).strict();
const errorCode=(error:unknown)=>typeof error==='object'&&error!==null&&'code' in error ? String(error.code):'UNKNOWN';
export class CipherLedgerError extends Error {
  readonly code:string;
  constructor(code:string){super(code);this.name='CipherLedgerError';this.code=code;}
}
export function canonicalLedgerJson(value:unknown):string {
  if(value===null||typeof value!=='object'){const text=JSON.stringify(value);if(text===undefined)throw new CipherLedgerError('noncanonical ledger value');return text;}
  if(Array.isArray(value))return '['+value.map(canonicalLedgerJson).join(',')+']';
  const object=value as Record<string,unknown>;
  return '{'+Object.keys(object).filter(key=>object[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+canonicalLedgerJson(object[key])).join(',')+'}';
}
function recordHash(record:Omit<CipherLedgerRecordT,'record_hash'>):string {
  return createHash('sha256').update(canonicalLedgerJson(record)).digest('hex');
}
function assertLineage(records:CipherLedgerRecordT[],input:CipherLedgerInputT) {
  const own=records.filter(record=>record.action_id===input.action_id);
  const last=own.at(-1);
  if(input.event_type==='PREPARE'){if(own.length)throw new CipherLedgerError('duplicate action');if(input.result_state!=='PENDING'||input.authority_decision_ref||input.evidence_ref)throw new CipherLedgerError('invalid prepare lineage');return;}
  if(['SECURITY_EVENT','TOMBSTONE'].includes(input.event_type))return;
  if(!own.some(record=>record.event_type==='PREPARE'))throw new CipherLedgerError('missing prepare lineage');
  if(input.event_type==='AUTHORITY_DECISION'&&(!['ALLOWED','DENIED'].includes(input.result_state)||!input.authority_decision_ref))throw new CipherLedgerError('invalid authority lineage');
  if(input.event_type==='AUTHORITY_DECISION'&&(!last||!['PREPARE','AUTHORITY_DECISION'].includes(last.event_type)))throw new CipherLedgerError('invalid authority lineage');
  if(input.event_type==='EFFECT_ATTEMPT'&&(!(last?.event_type==='AUTHORITY_DECISION'&&last.result_state==='ALLOWED')||input.result_state!=='ALLOWED'||!input.effect_generation||input.authority_decision_ref!==last.authority_decision_ref))throw new CipherLedgerError('invalid effect lineage');
  if(input.event_type==='OBSERVATION'&&(last?.event_type!=='EFFECT_ATTEMPT'||!['OBSERVED','FAILED','UNKNOWN_PENDING_RECONCILIATION'].includes(input.result_state)||(input.result_state==='OBSERVED'&&!input.observation_ref)))throw new CipherLedgerError('invalid observation lineage');
  if(input.event_type==='VERIFICATION'&&(!['VERIFIED','FAILED'].includes(input.result_state)||!input.evidence_ref||last?.event_type!=='OBSERVATION'||last.result_state!=='OBSERVED'))throw new CipherLedgerError('missing verification lineage');
}
function verify(state:CipherLedgerStateT,identity:z.infer<typeof Identity>) {
  if(state.ledger_id!==identity.ledger_id||state.resident_id!==identity.resident_id||state.checkpoint_count!==state.records.length)throw new CipherLedgerError('LEDGER_IDENTITY_OR_CHECKPOINT');
  let previous=GENESIS;
  const events=new Set<string>();const validated:CipherLedgerRecordT[]=[];
  for(const record of state.records){
    const {record_hash,...body}=record;
    if(record.ledger_id!==state.ledger_id||record.resident_id!==state.resident_id||record.sequence!==validated.length||record.previous_record_hash!==previous||recordHash(body)!==record_hash||events.has(record.event_id))throw new CipherLedgerError('LEDGER_CHAIN_INVALID');
    assertLineage(validated,record);events.add(record.event_id);validated.push(record);previous=record_hash;
  }
  if(state.checkpoint_root!==previous)throw new CipherLedgerError('LEDGER_CHECKPOINT_INVALID');
}
function unresolved(records:CipherLedgerRecordT[]):string[] {
  const latest=new Map<string,CipherLedgerRecordT>();
  for(const record of records)if(!['SECURITY_EVENT','TOMBSTONE'].includes(record.event_type))latest.set(record.action_id,record);
  return [...latest].filter(([,record])=>!(['OBSERVATION','VERIFICATION'].includes(record.event_type)||record.result_state==='DENIED')).map(([id])=>id);
}
export interface CipherLedgerOptions {storageRoot:string;residentId:string;testHooks?:AtomicJsonTestHooks}
export function createCipherLedger(options:CipherLedgerOptions) {
  const root=path.resolve(options.storageRoot),file=path.join(root,'ledger.json'),identityFile=path.join(root,'identity.json'),lockFile=path.join(root,'lockdown.json');
  let initialized=false;
  let state:CipherLedgerStateT|null=null;
  let identity:z.infer<typeof Identity>|null=null;
  let security:CipherLockdownT={schema:'covert.lockdown-state.v1',state:'NORMAL',generation:0,entered_at:new Date().toISOString(),reasons:[],operator_ack_required:false};
  let integrity:CipherLedgerStatusT['integrity']='UNAVAILABLE';

  async function readJson(target:string):Promise<unknown|null>{
    try {
      const stat=await fs.lstat(target);
      if(!stat.isFile()||stat.isSymbolicLink())throw new CipherLedgerError('LEDGER_STORAGE_UNSAFE');
      return JSON.parse(await fs.readFile(target,'utf8')) as unknown;
    }catch(error){if(errorCode(error)==='ENOENT')return null;throw error;}
  }
  async function safeDirectory(create=false){
    if(create)await fs.mkdir(root,{recursive:true});
    try{
      const actual=await fs.realpath(root);
      const normalize=(value:string)=>process.platform==='win32'?value.toLowerCase():value;
      if(normalize(actual)!==normalize(root)||!(await fs.stat(root)).isDirectory())throw new CipherLedgerError('LEDGER_STORAGE_UNSAFE');
    }catch(error){
      if(errorCode(error)!=='ENOENT')throw error;
      // A missing child under a file is not a clean first use on Windows.
      let ancestor=path.dirname(root);
      while(true){
        try{if(!(await fs.stat(ancestor)).isDirectory())throw new CipherLedgerError('LEDGER_STORAGE_UNSAFE');break;}
        catch(ancestorError){if(errorCode(ancestorError)!=='ENOENT')throw ancestorError;}
        const parent=path.dirname(ancestor);if(parent===ancestor)throw new CipherLedgerError('LEDGER_STORAGE_UNAVAILABLE');ancestor=parent;
      }
    }
  }
  async function setSecurity(code:string,severity:'INFO'|'OPERATIONAL'|'SECURITY_CRITICAL',evidence_ref:string|null=null){
    const next=severity==='SECURITY_CRITICAL'?'LOCKDOWN':severity==='OPERATIONAL'?'RECONCILING':security.state;
    const parsed=CipherLockdown.parse({...security,state:security.state==='LOCKDOWN'?'LOCKDOWN':next,generation:security.generation+1,entered_at:new Date().toISOString(),reasons:[...security.reasons,{code,severity,evidence_ref}].slice(-64),operator_ack_required:severity!=='INFO'||security.operator_ack_required});
    security=parsed;
    await safeDirectory(true);
    await atomicWriteJson(lockFile,parsed,{validate:value=>{CipherLockdown.parse(value);}});
    if(identity!==null){
      identity=Identity.parse({...identity,lockdown_hash:createHash('sha256').update(canonicalLedgerJson(parsed)).digest('hex')});
      await atomicWriteJson(identityFile,identity,{validate:value=>{Identity.parse(value);}});
    }
  }
  async function load(){
    await safeDirectory();
    const rawIdentity=await readJson(identityFile),raw=await readJson(file);
    if(rawIdentity===null&&raw===null){if(identity!==null||state!==null)throw new CipherLedgerError('LEDGER_KNOWN_HISTORY_MISSING');state=null;identity=null;integrity='UNAVAILABLE';return;}
    if(rawIdentity===null||raw===null)throw new CipherLedgerError('LEDGER_KNOWN_HISTORY_MISSING');
    const nextIdentity=Identity.parse(rawIdentity);
    if(identity!==null&&identity.ledger_id!==nextIdentity.ledger_id)throw new CipherLedgerError('LEDGER_IDENTITY_CHANGED');
    identity=nextIdentity;state=CipherLedgerState.parse(raw);
    if(identity.resident_id!==options.residentId)throw new CipherLedgerError('LEDGER_RESIDENT_MISMATCH');
    verify(state,identity);integrity='HASH_CHAIN_VERIFIED';
  }
  async function open(){
    const starting=!initialized;
    try{
      const rawLock=await readJson(lockFile);
      const nextSecurity=rawLock===null?null:CipherLockdown.parse(rawLock);
      await load();
      if(identity?.lockdown_hash&&(nextSecurity===null||identity.lockdown_hash!==createHash('sha256').update(canonicalLedgerJson(nextSecurity)).digest('hex')))throw new CipherLedgerError('LOCKDOWN_HISTORY_MISMATCH');
      if(!starting&&security.state==='LOCKDOWN'&&nextSecurity?.state!=='LOCKDOWN')throw new CipherLedgerError('LOCKDOWN_CANNOT_CLEAR');
      if(nextSecurity!==null)security=nextSecurity;
      if(starting&&security.state!=='LOCKDOWN'&&state&&unresolved(state.records).length){
        await setSecurity('UNKNOWN_PENDING_RECONCILIATION','OPERATIONAL');
      }
    }catch{
      integrity='FAILED';state=null;
      try{await setSecurity('LEDGER_INTEGRITY_OR_STORAGE_FAILED','SECURITY_CRITICAL');}catch{/* in-memory denial remains even if persistent storage failed */}
    }
    initialized=true;
  }
  function statusValue():CipherLedgerStatusT {
    return {...security,ledger_id:identity?.ledger_id??null,resident_id:options.residentId,integrity,signature_state:'SIGNATURE_UNAVAILABLE',checkpoint_root:state?.checkpoint_root??null,record_count:state?.records.length??0,unresolved_actions:state?unresolved(state.records):[],limitations:['Local hash chain is unsigned and unwitnessed; a full rewrite with recomputed hashes is outside this integrity guarantee.','Atomic same-volume replacement is application crash safety, not a power-loss guarantee.','Project identity, domain evidence and permissions remain canonical owner references.']};
  }
  const serialized=<T>(run:()=>Promise<T>)=>withFileMutationLock(file,run);
  return {
    status:()=>serialized(async()=>{await open();return statusValue();}),
    list:(query:{project_id?:string;task_id?:string;limit?:number}={})=>serialized(async()=>{
      await open();
      const limit=Math.max(1,Math.min(200,query.limit??200));
      return (state?.records??[]).filter(record=>(query.project_id===undefined||record.project_id===query.project_id)&&(query.task_id===undefined||record.task_id===query.task_id)).slice(-limit);
    }),
    append:(input:unknown)=>serialized(async()=>{
      const parsed=CipherLedgerInput.safeParse(input);
      if(!parsed.success)throw new CipherLedgerError('invalid ledger metadata');
      await open();
      if(security.state==='LOCKDOWN')throw new CipherLedgerError('LOCKDOWN');
      if(security.state==='RECONCILING'&&parsed.data.event_type==='PREPARE')throw new CipherLedgerError('UNKNOWN_PENDING_RECONCILIATION');
      const records=state?.records??[];
      assertLineage(records,parsed.data);
      if(records.length>=10000)throw new CipherLedgerError('LEDGER_CAPACITY_RECONCILIATION_REQUIRED');
      await safeDirectory(true);
      if(identity===null){
        identity=Identity.parse({schema:'covert.cipher-ledger-identity.v1',ledger_id:randomUUID(),resident_id:options.residentId,lockdown_hash:security.generation===0?null:createHash('sha256').update(canonicalLedgerJson(security)).digest('hex')});
        await atomicWriteJson(identityFile,identity,{validate:value=>{Identity.parse(value);}});
      }
      const body={...parsed.data,schema:'covert.cipher-ledger-record.v1' as const,ledger_id:identity.ledger_id,resident_id:identity.resident_id,sequence:records.length,event_id:randomUUID(),recorded_at:new Date().toISOString(),previous_record_hash:state?.checkpoint_root??GENESIS,signature_state:'SIGNATURE_UNAVAILABLE' as const};
      const record=CipherLedgerRecord.parse({...body,record_hash:recordHash(body)});
      const next=CipherLedgerState.parse({schema:'covert.cipher-ledger.v1',ledger_id:identity.ledger_id,resident_id:identity.resident_id,records:[...records,record],checkpoint_count:records.length+1,checkpoint_root:record.record_hash});
      try{await atomicWriteJson(file,next,{validate:value=>{verify(CipherLedgerState.parse(value),identity!);},...(options.testHooks?{testHooks:options.testHooks}:{})});}
      catch{await setSecurity('LEDGER_WRITE_FAILED','OPERATIONAL').catch(()=>{});throw new CipherLedgerError('ledger persistence failed');}
      state=next;integrity='HASH_CHAIN_VERIFIED';
      return record;
    }),
    reportAnomaly:(code:string,severity:'INFO'|'OPERATIONAL'|'SECURITY_CRITICAL',evidence_ref:string|null=null)=>serialized(async()=>{await open();await setSecurity(code,severity,evidence_ref);return statusValue();})
  };
}
export type CipherLedger=ReturnType<typeof createCipherLedger>;
