import { z } from 'zod';
import { OPERATION_POLICY } from '../security/operation-policy.mjs';
import { CIPHER_RESIDENT_ID } from '../contracts/cipher-laptop.ts';
const Ref=z.string().min(1).max(240).regex(/^[A-Za-z0-9._:/@-]+$/);
const Personality=z.object({
 directness:z.number().min(0).max(1),challenge:z.number().min(0).max(1),
 humor:z.number().min(0).max(1),warmth:z.number().min(0).max(1),
 verbosity:z.number().min(0).max(1),formality:z.number().min(0).max(1)
}).strict();
export const ResidentPresentation=z.object({
 schema:z.literal('covert.resident-presentation.v1'),resident_id:z.literal(CIPHER_RESIDENT_ID),
 mode:z.enum(['STANDARD','BUDDY']),chassis:z.enum(['Scout','Rook','Mutt','Tinker']).nullable(),
 personality_ref:Ref.nullable(),personality:Personality.optional(),voice_ref:Ref.nullable(),
 voice_mode:z.enum(['DISABLED','PUSH_TO_TALK','ACTIVE_CONVERSATION','CONTINUOUS_PRESENCE'])
}).strict();
const CapabilityPreference=z.object({
 policy:z.enum(['DENY','ASK','ALLOW_IF_GRANTED']),scope_refs:z.array(Ref).max(64).optional(),
 destination_refs:z.array(Ref).max(64).optional(),notes:z.string().max(1000).optional()
}).strict();
export const ResidentAutonomyPolicy=z.object({
 schema:z.literal('covert.resident-autonomy-policy.v1'),policy_id:Ref,resident_id:z.literal(CIPHER_RESIDENT_ID),
 profile_name:z.string().max(160).optional(),
 proactivity:z.enum(['SILENT','CRITICAL_ONLY','IMPORTANT_ONLY','WORKFLOW_ASSIST','PROACTIVE','FULL_COMPANION']),
 default_effect_policy:z.enum(['DENY','ASK','ALLOW_IF_ALREADY_GRANTED']),
 capabilities:z.record(Ref,CapabilityPreference).refine(value=>Object.keys(value).length<=128),
 cannot_self_grant:z.literal(true)
}).strict();
export type ResidentAutonomyPolicyT=z.infer<typeof ResidentAutonomyPolicy>;
export type ResidentPresentationT=z.infer<typeof ResidentPresentation>;
// Advisory policy restricts or requests. It never issues a permit or evaluates
// a stale grant cache. Canonical Authority and Admission decide actual effects.
export function evaluateResidentInitiative(policy:ResidentAutonomyPolicyT,capability:string){
 const checked=ResidentAutonomyPolicy.parse(policy);
 if(!Object.hasOwn(OPERATION_POLICY,capability)||capability==='authority.grant'||capability.endsWith('.grants')||capability.endsWith('.decision'))return 'DENY' as const;
 const preference=checked.capabilities[capability]?.policy??checked.default_effect_policy;
 if(preference==='DENY')return 'DENY' as const;
 if(preference==='ASK')return 'ASK_OPERATOR' as const;
 return 'REQUEST_CANONICAL_AUTHORITY' as const;
}
// Visibility/preferences are separate from installation, authentication and
// permission. A surface reference contains no credential and grants no access.
export const ResidentSurfaceReference=z.object({
 resource_id:Ref,resource_type:z.enum(['INSTALLED_APPLICATION','CONNECTED_APPLICATION','MODEL','SKILL','WORKFLOW','PROJECT','EVIDENCE','TASK']),
 owner_ref:Ref,visibility:z.enum(['OPERATOR','CIPHER','BOTH'])
}).strict();
