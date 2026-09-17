import { z } from 'zod';

// ---------------------------------------------------------------------------
// Legacy one-shot terminal (unchanged slice): the allowlisted execFile path.
// Kept exactly as-is during the real-PTY slice; do not collapse it into the
// session path yet.
// ---------------------------------------------------------------------------

export const TerminalRunRequest = z
  .object({
    program: z.string().min(1),
    args: z.array(z.string()),
    approved: z.boolean()
  })
  .strict();

export const TerminalRunResponse = z
  .object({
    code: z.number(),
    stdout: z.string(),
    stderr: z.string()
  })
  .strict();

export type TerminalRunResponseT = z.infer<typeof TerminalRunResponse>;

// ---------------------------------------------------------------------------
// Runtime providers. Discovery must be truthful: a provider is `available`
// only when its engine resolves AND a shell exists; `requires-setup` names a
// concrete missing prerequisite; `unhealthy` means present but not usable;
// `unsupported` means this host cannot host the provider at all.
// ---------------------------------------------------------------------------

export const TerminalProviderState = z.enum(['available', 'requires-setup', 'unhealthy', 'unsupported']);
export type TerminalProviderStateT = z.infer<typeof TerminalProviderState>;

export const TerminalShellDescriptor = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    path: z.string().min(1)
  })
  .strict();
export type TerminalShellDescriptorT = z.infer<typeof TerminalShellDescriptor>;

export const TerminalProviderInfo = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    state: TerminalProviderState,
    detail: z.string(),
    shells: z.array(TerminalShellDescriptor)
  })
  .strict();
export type TerminalProviderInfoT = z.infer<typeof TerminalProviderInfo>;

export const TerminalProviderListResponse = z
  .object({ providers: z.array(TerminalProviderInfo) })
  .strict();
export type TerminalProviderListResponseT = z.infer<typeof TerminalProviderListResponse>;

// ---------------------------------------------------------------------------
// Interactive sessions. The session is created by an approved
// `terminal.session.start` operation and is bound to the operator actor id
// (server-derived, never client-supplied). Session ids are opaque identifiers,
// NOT authority: every control message is re-checked against ownership.
// ---------------------------------------------------------------------------

export const TerminalSessionState = z.enum(['starting', 'running', 'stopping', 'stopped', 'disposed']);
export type TerminalSessionStateT = z.infer<typeof TerminalSessionState>;

export const TerminalSessionCleanup = z.enum(['clean', 'uncertain', 'pending']);
export type TerminalSessionCleanupT = z.infer<typeof TerminalSessionCleanup>;

export const TerminalSessionOpenRequest = z
  .object({
    provider: z.string().min(1),
    shell: z.string().min(1).nullable().default(null),
    cwd: z.string().min(1).nullable().default(null),
    cols: z.number().int().min(20).max(400).default(120),
    rows: z.number().int().min(5).max(200).default(40)
  })
  .strict();
export type TerminalSessionOpenRequestT = z.infer<typeof TerminalSessionOpenRequest>;

export const TerminalSessionInfo = z
  .object({
    sessionId: z.string().min(1),
    owner: z.string().min(1),
    provider: z.string().min(1),
    shell: z.string().min(1),
    cwd: z.string().min(1),
    cols: z.number().int(),
    rows: z.number().int(),
    state: TerminalSessionState,
    createdAt: z.number(),
    exitCode: z.number().nullable(),
    cleanup: TerminalSessionCleanup
  })
  .strict();
export type TerminalSessionInfoT = z.infer<typeof TerminalSessionInfo>;

export const TerminalSessionOpenResponse = z
  .object({
    session: TerminalSessionInfo
  })
  .strict();
export type TerminalSessionOpenResponseT = z.infer<typeof TerminalSessionOpenResponse>;

export const TerminalSessionListResponse = z
  .object({ sessions: z.array(TerminalSessionInfo) })
  .strict();
export type TerminalSessionListResponseT = z.infer<typeof TerminalSessionListResponse>;

export const TerminalSessionStopRequest = z
  .object({ sessionId: z.string().min(1) })
  .strict();
export type TerminalSessionStopRequestT = z.infer<typeof TerminalSessionStopRequest>;

export const TerminalSessionStopResponse = z
  .object({
    sessionId: z.string().min(1),
    state: TerminalSessionState,
    cleanup: TerminalSessionCleanup
  })
  .strict();
export type TerminalSessionStopResponseT = z.infer<typeof TerminalSessionStopResponse>;

// ---------------------------------------------------------------------------
// WebSocket control protocol (client -> daemon) and event protocol
// (daemon -> client).
//
// Control messages carry NO actor identity: the daemon derives the acting
// actor from the authenticated socket and verifies it equals the session
// owner on EVERY message. Input is activity inside the already-admitted
// session, not a new authority operation (no per-keystroke receipts).
// Payloads stay small because the transport caps a frame at 8 KiB.
// ---------------------------------------------------------------------------

export const TerminalControlInputLimit = 2048;

export const TerminalControlMessage = z.discriminatedUnion('action', [
  z
    .object({
      type: z.literal('terminal'),
      sessionId: z.string().min(1),
      action: z.literal('input'),
      data: z.string().min(1).max(TerminalControlInputLimit)
    })
    .strict(),
  z
    .object({
      type: z.literal('terminal'),
      sessionId: z.string().min(1),
      action: z.literal('resize'),
      cols: z.number().int().min(20).max(400),
      rows: z.number().int().min(5).max(200)
    })
    .strict(),
  z
    .object({
      type: z.literal('terminal'),
      sessionId: z.string().min(1),
      action: z.literal('close')
    })
    .strict()
]);
export type TerminalControlMessageT = z.infer<typeof TerminalControlMessage>;

export const TerminalEvent = z.discriminatedUnion('kind', [
  z.object({ sessionId: z.string().min(1), kind: z.literal('output'), data: z.string() }).strict(),
  z
    .object({
      sessionId: z.string().min(1),
      kind: z.literal('state'),
      state: TerminalSessionState,
      exitCode: z.number().nullable()
    })
    .strict(),
  z
    .object({
      sessionId: z.string().min(1),
      kind: z.literal('exit'),
      exitCode: z.number(),
      cleanup: TerminalSessionCleanup
    })
    .strict(),
  z.object({ sessionId: z.string().min(1), kind: z.literal('error'), message: z.string() }).strict()
]);
export type TerminalEventT = z.infer<typeof TerminalEvent>;
