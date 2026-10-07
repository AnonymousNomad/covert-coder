import { z } from 'zod';
// One registered TS capability surface for all principals. No credential,
// permission, delegation or caller-supplied identity fields are accepted.
export const CapabilitySeatRequest=z.object({
 method:z.enum(['GET','POST','PUT','PATCH','DELETE']),
 path:z.string().min(1).max(2048).refine(value=>value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!value.includes('#')),
 task_id:z.string().min(1).max(240),body:z.unknown().optional()
}).strict();
export type CapabilitySeatRequestT=z.infer<typeof CapabilitySeatRequest>;
