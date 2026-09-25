import { z } from 'zod';

export const DesktopGrants = z
  .object({
    apps: z.array(z.string().min(1)).max(32),
    roots: z.array(z.string().min(2)).max(16),
    window_titles: z.array(z.string().min(1)).max(32)
  })
  .strict();

export const DesktopGrantsManifest = z
  .object({
    version: z.literal(1),
    enabled: z.boolean(),
    grants: DesktopGrants,
    session_started_at: z.string(),
    ttl_minutes: z.number().int().positive().max(720),
    approved_by: z.literal('operator-wizard')
  })
  .strict();

export const DesktopActionRequest = z
  .object({
    op: z.enum(['launch_app', 'open_path', 'list_windows', 'focus_window', 'uia_action', 'move_file', 'outlook_create_draft', 'excel_generate_report']),
    target: z.string().max(500).optional(),
    args: z.array(z.string().max(4096)).max(24).optional(),
    show_window: z.boolean().optional(),
    destination: z.string().max(500).optional(),
    approved: z.boolean(),
    // Optional reasoning captured into the training trajectory (DC-b).
    // Operator actions carry intent; agent-loop actions carry Thought text.
    note: z.string().max(300).optional()
  })
  .strict();

export const DesktopActionReceipt = z
  .object({
    action_id: z.string().uuid(),
    attempt_id: z.string().min(1).max(120),
    target_application: z.string().min(1).max(260),
    process_id: z.number().int().positive(),
    window_handle: z.number().int().positive(),
    lease_id: z.string().uuid(),
    ownership_state: z.literal('ATTEMPT_OWNED'),
    requested_operation: z.enum(['inspect', 'focus', 'invoke', 'scroll', 'type_text', 'replace_text', 'press_key', 'click', 'screenshot', 'select_file']),
    target_element: z.string().max(64).nullable(),
    precondition: z.string().min(1).max(160),
    result: z.enum(['SUCCESS', 'FAILURE', 'BLOCKED']),
    postcondition: z.string().min(1).max(160),
    evidence_refs: z.array(z.string().max(500)).max(8),
    failure_classification: z.string().max(100).optional()
  })
  .strict();

export const DesktopActionResult = z
  .object({
    ok: z.boolean(),
    decision: z.enum(['executed', 'refused', 'expired', 'panic']),
    reason: z.string().optional(),
    output: z.string().optional(),
    latency_ms: z.number().int().nonnegative(),
    // Per-op auto-assertion: { pass: boolean, check: string } e.g. {pass:true,check:'process_alive:notepad.exe'}
    // Recorded into training trajectories; surfaced in the result for the model
    // and the operator to verify the action took real effect.
    assertion: z.object({ pass: z.boolean(), check: z.string() }).optional(),
    receipt: DesktopActionReceipt.optional()
  })
  .strict();

export const PanicResult = z
  .object({
    ok: z.boolean(),
    children_killed: z.number().int().nonnegative(),
    unowned_handlers: z.number().int().nonnegative(),
    outcomes: z.array(z.object({ id: z.string(), pid: z.number().nullable(), status: z.enum(['unowned', 'exited', 'failed', 'unconfirmed', 'terminated']),
      killed: z.boolean(), error: z.string().optional(), exit: z.object({ code: z.number().nullable(), signal: z.string().nullable(), error: z.string().nullable() }).optional() }).strict()),
    revoked_at: z.string(),
    latency_ms: z.number().int().nonnegative()
  })
  .strict();

export const DesktopStatusResponse = z
  .object({
    enabled: z.boolean(),
    ttl_minutes: z.number().int().positive().nullable(),
    session_started_at: z.string().nullable(),
    grants: DesktopGrants,
    tracked_children: z.number().int().nonnegative(),
    panicked: z.boolean()
  })
  .strict();

export const DesktopGrantsSetResponse = DesktopStatusResponse;

export const DesktopPendingSubmit = z
  .object({
    action_raw: z.string().min(1).max(300),
    class: z.enum(['READ', 'WRITE', 'OPEN', 'DESTRUCTIVE', 'FORBIDDEN']),
    session_id: z.string().max(120).optional()
  })
  .strict();

export const DesktopPendingEntry = z
  .object({
    approval_id: z.string(),
    action_raw: z.string(),
    class: z.string(),
    session_id: z.string(),
    created_at: z.string()
  })
  .strict();

export const DesktopVerdictResult = z
  .object({ verdict: z.enum(['approved', 'rejected', 'timeout']) })
  .strict();

export const ResolveBody = z
  .object({ decision: z.enum(['approve', 'reject']) })
  .strict();

export type DesktopActionRequestT = z.infer<typeof DesktopActionRequest>;
