import { z } from 'zod';
import { OPERATION_POLICY } from '../security/operation-policy.mjs';
const id=z.string().min(1).max(160).regex(/^[a-z0-9][a-z0-9._-]*$/).refine(value=>!['__proto__','constructor','prototype'].includes(value));
const ref=z.string().min(1).max(240).regex(/^[A-Za-z0-9._:/@-]+$/);
const text=z.string().max(4000),refs=z.array(ref).max(128),digest=z.string().regex(/^[a-f0-9]{64}$/);
const Component=z.object({
 component_id:id,required:z.boolean(),version:z.string().min(1).max(120).nullable().optional(),
 license_ref:ref.nullable().optional(),artifact_digest:digest.nullable().optional(),
 provenance_ref:ref.nullable().optional(),purpose:text.nullable().optional()
}).strict();
export const CovertPack=z.object({
 schema:z.literal('covert.pack.v1'),pack_id:id,name:z.string().min(1).max(160),version:z.string().min(1).max(120),
 publisher:z.object({id,display_name:z.string().max(160).optional(),signature_ref:ref.nullable().optional()}).strict(),
 platform_range:z.string().min(1).max(120),description:text.optional(),methodology:text.nullable().optional(),
 components:z.array(Component).max(128),skills:refs.optional(),workflows:refs.optional(),
 model_roles:z.record(id,ref).refine(value=>Object.keys(value).length<=32).optional(),
 profile_ref:ref.nullable().optional(),layout_ref:ref.nullable().optional(),
 requested_capabilities:refs.refine(values=>new Set(values).size===values.length&&!values.some(value=>value==='authority.grant'||value.endsWith('.grants')||value.endsWith('.decision'))),
 verification_gates:refs.optional(),dependencies:z.array(id).max(64).optional(),docs:refs.optional()
}).strict().superRefine((value,ctx)=>{
 if(new Set(value.components.map(component=>component.component_id)).size!==value.components.length)ctx.addIssue({code:'custom',message:'duplicate component identity'});
 if(value.dependencies?.includes(value.pack_id))ctx.addIssue({code:'custom',message:'dependency cycle'});
 if(/sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|(?:password|api[_-]?key|token|secret)\s*[:=]/i.test(JSON.stringify(value)))ctx.addIssue({code:'custom',message:'credential-like pack content'});
});
export type CovertPackT=z.infer<typeof CovertPack>;
export interface PackComponentFact {
 version:string;artifact_digest:string|null;qualified:boolean;redistributable:boolean;owner_ref:string;
}
export interface PackInspectionFacts {
 components?:ReadonlyMap<string,PackComponentFact>;
 packs?:ReadonlyMap<string,unknown>;
}
// Pure inspection: no installer, credentials, effect executor, model binding or
// Authority control is accepted by this port. Catalog facts are owner projections.
export function inspectCovertPack(input:unknown,facts:PackInspectionFacts={}) {
 const pack=CovertPack.parse(input);
 const visited=new Set<string>(),active=new Set<string>(),missing=new Set<string>();
 function visit(value:CovertPackT){
  if(active.has(value.pack_id))throw new Error('Pack dependency cycle');
  if(visited.has(value.pack_id))return;
  if(visited.size+active.size>=128)throw new Error('Pack dependency graph exceeds inspection bound');
  active.add(value.pack_id);
  for(const dependency of value.dependencies??[]){
   if(dependency===pack.pack_id)visit(pack);
   else{const source=facts.packs?.get(dependency);if(source===undefined)missing.add(dependency);else{const child=CovertPack.parse(source);if(child.pack_id!==dependency)throw new Error('Pack dependency identity mismatch');visit(child);}}
  }
  active.delete(value.pack_id);visited.add(value.pack_id);
 }
 visit(pack);
 const components=pack.components.map(component=>{
  const fact=facts.components?.get(component.component_id);
  const state=!fact?'MISSING':(component.version&&component.version!==fact.version)||(component.artifact_digest&&component.artifact_digest!==fact.artifact_digest)?'IDENTITY_MISMATCH':!fact.redistributable?'LICENSE_UNCONFIRMED':!fact.qualified?'UNQUALIFIED':'OWNER_QUALIFIED';
  return {...component,state,owner_ref:fact?.owner_ref??null};
 });
 return {
  schema:'covert.pack-inspection.v1' as const,mode:'PREVIEW_ONLY' as const,
  activation:'GATED' as const,authority_granted:false as const,
  pack_id:pack.pack_id,name:pack.name,version:pack.version,
  publisher:pack.publisher,publisher_trust:'UNVERIFIED' as const,
  platform_range:pack.platform_range,platform_compatibility:'UNASSESSED' as const,
  methodology:pack.methodology??null,
  components,skills:pack.skills??[],workflows:pack.workflows??[],model_roles:pack.model_roles??{},
  verification_gates:pack.verification_gates??[],profile_ref:pack.profile_ref??null,layout_ref:pack.layout_ref??null,
  requested_capabilities:pack.requested_capabilities,
  unsupported_capabilities:pack.requested_capabilities.filter(capability=>!Object.hasOwn(OPERATION_POLICY,capability)),
  missing_dependencies:[...missing],
  required_actions:components.filter(component=>component.required&&component.state!=='OWNER_QUALIFIED').map(component=>({component_id:component.component_id,reason:component.state,action:'REQUIRES_GOVERNED_RESOLUTION' as const})),
  effects_started:0 as const
 };
}
