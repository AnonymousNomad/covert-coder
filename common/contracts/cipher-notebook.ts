import { z } from 'zod';
const Ref=z.string().min(1).max(240).regex(/^[A-Za-z0-9._:/@-]+$/);
const Content=z.string().min(1).max(4000).refine(value=>!/sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|(?:password|api[_-]?key|token|secret)\s*[:=]/i.test(value),'credential-like content is not a memory');
const NotebookFields=z.object({
 record_id:Ref,expected_revision:z.number().int().nonnegative(),
 category:z.enum(['OPERATOR_NOTE','PROJECT_FACT','PREFERENCE','INFERENCE','TEMPORARY']),
 content:Content,source:z.enum(['USER_PROVIDED','OBSERVED','INFERRED']),
 provenance_ref:Ref,confidence:z.number().min(0).max(1).nullable(),
 retention:z.enum(['RETAIN','SESSION','DO_NOT_RETAIN']),approved_memory:z.boolean(),
 expires_at:z.string().datetime().nullable()
}).strict();
function memoryPolicy(value:{approved_memory:boolean;source:string;confidence:number|null;category:string;retention:string},ctx:z.RefinementCtx){
 if(!value.approved_memory)ctx.addIssue({code:'custom',message:'operator confirmation required'});
 if(value.source==='INFERRED'&&(value.confidence===null||value.category!=='INFERENCE'))ctx.addIssue({code:'custom',message:'inference provenance/confidence required'});
 if(value.retention==='DO_NOT_RETAIN')ctx.addIssue({code:'custom',message:'do-not-retain is not a persistence request'});
}
export const CipherNotebookPut=NotebookFields.superRefine(memoryPolicy);
export const CipherNotebookRemove=z.object({record_id:Ref,expected_revision:z.number().int().positive()}).strict();
export const CipherNotebookRecord=NotebookFields.omit({expected_revision:true}).extend({
 revision:z.number().int().positive(),resident_id:Ref,operator_principal_id:Ref,
 created_at:z.string().datetime(),updated_at:z.string().datetime()
}).strict().superRefine(memoryPolicy);
export const CipherNotebookTombstone=z.object({record_id:Ref,revision:z.number().int().positive(),state:z.literal('TOMBSTONE'),removed_at:z.string().datetime()}).strict();
export const CipherNotebookState=z.object({
 schema:z.literal('covert.cipher-notebook.v1'),resident_id:Ref,
 records:z.array(CipherNotebookRecord).max(500),tombstones:z.array(CipherNotebookTombstone).max(500)
}).strict().superRefine((value,ctx)=>{
 if(value.records.some(record=>record.retention!=='RETAIN'))ctx.addIssue({code:'custom',message:'session records cannot be durable'});
 const ids=[...value.records,...value.tombstones].map(record=>record.record_id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'duplicate Notebook identity'});
});
export type CipherNotebookRecordT=z.infer<typeof CipherNotebookRecord>;
export type CipherNotebookStateT=z.infer<typeof CipherNotebookState>;

export const CipherNotebookListResponse=z.object({resident_id:Ref,records:z.array(CipherNotebookRecord).max(500)}).strict();
export const CipherNotebookRemoveResponse=z.object({record_id:Ref,revision:z.number().int().positive(),removed:z.literal(true)}).strict();
export type CipherNotebookPutT=z.infer<typeof CipherNotebookPut>;
export type CipherNotebookRemoveT=z.infer<typeof CipherNotebookRemove>;
export type CipherNotebookListResponseT=z.infer<typeof CipherNotebookListResponse>;