import { createHash } from 'node:crypto';
import { OPERATION_POLICY } from '../../../common/security/operation-policy.mjs';
import { CipherLedgerInput, type CipherLedgerInputT } from '../../../common/contracts/cipher-laptop.ts';
import type { ExecutionAuthority } from './execution-authority.mjs';
import type { CipherLedger } from './cipher-ledger.ts';

// Composition-root registration only; not an HTTP/model port.
const owners=new WeakMap<ExecutionAuthority,CipherLedger>();
export function bindCipherLedger(authority:ExecutionAuthority,ledger:CipherLedger):void {
  if(owners.has(authority))throw new Error('Cipher ledger already bound to this Authority');
  owners.set(authority,ledger);
}
export function cipherLedgerForAuthority(authority:ExecutionAuthority):CipherLedger|undefined{return owners.get(authority);}
type Receipt={persisted:boolean;error?:string|null};
const stopCapabilities=new Set(['terminal.session.stop','tasks.stop','telegram.disconnect','desktop.panic','agent.cancel']);
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const stages=new Set(['proposed','approve','reject','consumed','execution-succeeded','execution-failed']);
export function createCipherAuthorityRecorder(options:{
 ledger:CipherLedger;audit:(event:Readonly<Record<string,unknown>>)=>Promise<Receipt>
}):(event:Readonly<Record<string,unknown>>)=>Promise<Receipt>{
 return async event=>{
  const operationId=typeof event.operation_id==='string'?event.operation_id:null;
  const capability=typeof event.kind==='string'?event.kind:null;
  const decision=typeof event.decision==='string'?event.decision:null;
  const risk=capability?(OPERATION_POLICY as Readonly<Record<string,string>>)[capability]:undefined;
  // Reads, exact stop/revoke controls and pairing remain available during
  // lockdown; their existing Authority/audit requirements are unchanged.
  if(!operationId||!capability||!decision||!stages.has(decision)||risk==='read'||risk==='revoke'||stopCapabilities.has(capability))return options.audit(event);
  try{
   const status=await options.ledger.status();
   if(status.state==='LOCKDOWN'||status.state==='RECONCILING'||status.state==='DEGRADED')return {persisted:false,error:'Cipher integrity gate holds new effects'};
   const base={
    action_id:operationId,event_type:'PREPARE' as const,
    principal_id:event.actor_id,principal_kind:event.actor_kind,
    origin_channel:'authority',project_id:null,
    task_id:typeof event.task_id==='string'?'task-ref:'+hash(event.task_id):null,
    capability,target_ref:'authority-operation:'+operationId,target_digest:event.digest,
    result_state:'PENDING' as const
   };
   let input:CipherLedgerInputT;
   if(decision==='proposed')input=CipherLedgerInput.parse(base);
   else if(decision==='approve'||decision==='reject')input=CipherLedgerInput.parse({...base,event_type:'AUTHORITY_DECISION',result_state:decision==='approve'?'ALLOWED':'DENIED',authority_decision_ref:'authority:'+operationId+':'+decision});
   else if(decision==='consumed')input=CipherLedgerInput.parse({...base,event_type:'EFFECT_ATTEMPT',result_state:'ALLOWED',effect_generation:'authority:'+operationId+':1',authority_decision_ref:'authority:'+operationId+':approve'});
   else input=CipherLedgerInput.parse({...base,event_type:'OBSERVATION',result_state:decision==='execution-succeeded'?'OBSERVED':'FAILED',observation_ref:'authority:'+operationId+':'+decision});
   // Required before canonical Authority consumption can enter the executor.
   // No prompt/args/command body or credential values enter these records.
   await options.ledger.append(input);
   // A durably observed invocation failure does not assert rollback or zero
   // effects. Missing outcome persistence, unlike FAILED, remains unresolved.
   const receipt=await options.audit(event);
   if(!receipt.persisted)await options.ledger.reportAnomaly('CANONICAL_AUTHORITY_RECEIPT_MISSING','OPERATIONAL','authority-operation:'+operationId);
   return receipt;
  }catch{
   // Append/storage already raises deterministic integrity state as needed.
   // Preserve real Authority's fail-closed persistence error; no fake receipt.
   await options.ledger.reportAnomaly('AUTHORITY_LINEAGE_RECORD_FAILED','OPERATIONAL','authority-operation:'+operationId).catch(()=>{});
   return {persisted:false,error:'Cipher action lineage persistence unavailable'};
  }
 };
}
