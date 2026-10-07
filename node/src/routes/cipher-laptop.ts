import { z } from 'zod';
import { RouteError, type Route, type RouteContext } from '../server.ts';
import { CipherLedgerStatus, CipherLedgerListResponse } from '../../../common/contracts/cipher-laptop.ts';
import type { CipherLedger } from '../services/cipher-ledger.ts';

const Query=z.object({project_id:z.string().min(1).max(240).optional(),task_id:z.string().min(1).max(240).optional(),limit:z.coerce.number().int().min(1).max(200).optional()}).strict();
function operator(ctx:RouteContext,ledger:CipherLedger|undefined):CipherLedger {
 if(ctx.actor?.kind!=='operator')throw new RouteError('FORBIDDEN','Cipher Laptop history is operator-only');
 if(!ledger)throw new RouteError('NOT_READY','canonical Cipher Laptop owner is unavailable');
 return ledger;
}
export function routesForCipherLaptop(ledger:CipherLedger|undefined):Route[]{
 return [
  {method:'GET',path:'/api/cipher/laptop/status',response:CipherLedgerStatus,handler:async ctx=>operator(ctx,ledger).status()},
  {method:'GET',path:'/api/cipher/laptop/activity',query:Query,response:CipherLedgerListResponse,handler:async ctx=>{
   const owner=operator(ctx,ledger);const query=Query.parse(ctx.query);
   return {records:await owner.list({
    ...(query.project_id!==undefined?{project_id:query.project_id}:{}),
    ...(query.task_id!==undefined?{task_id:query.task_id}:{}),
    ...(query.limit!==undefined?{limit:query.limit}:{})
   }),status:await owner.status()};
  }}
 ];
}
