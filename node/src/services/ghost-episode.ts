// Ghost episode assembler (Wave 8). READ-ONLY projection over the existing
// canonical stores — trajectories, verifications, the audit bus, the egress
// journal, worker handoffs, and continuation chains. No new recorder, no new
// identity universe: episodes key on canonical task/session ids, worker claims
// stay claims, verified facts come only from canonical evidence, and every
// projected string passes the secret-redaction boundary.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  GhostEpisode,
  type GhostEpisodeT,
  type GhostEventKindT,
  type GhostEventT
} from '../../../common/contracts/ghost.ts';

// Projection-level redaction. Shares the P5 secret-pattern family by design:
// Ghost must never persist secrets that merely passed through a process.
const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g;
const REDACT_PATTERNS = [
  /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g,
  /\b(?:sk|ghp|gho|ghu|ghs|github_pat|glpat|hf|xoxb|xoxp|xoxa|xoxr)[-_][A-Za-z0-9._-]{8,}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:authorization|auth)\s*[:=]\s*(?:bearer|basic|token)\s+[A-Za-z0-9._~+/=-]{4,}/gi,
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|password|passwd|secret|client[_-]?secret|aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi
];

function redactMatch(match: string): string {
  const separator = match.search(/[:=]/);
  return separator >= 0 ? `${match.slice(0, separator + 1)} [REDACTED]` : '[REDACTED]';
}

export function redactGhostText(value: unknown, max = 600): string {
  let text = String(value ?? '');
  text = text.replace(PRIVATE_KEY_BLOCK, '[REDACTED]');
  for (const pattern of REDACT_PATTERNS) text = text.replace(pattern, redactMatch);
  return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}

function redactData(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth-limit]';
  if (typeof value === 'string') return redactGhostText(value, 400);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(entry => redactData(entry, depth + 1));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 24)) {
      out[key] = redactData(entry, depth + 1);
    }
    return out;
  }
  return '[unserializable]';
}

const WRITE_TOOLS = new Set(['write_file', 'replace_in_file']);
const FILE_PATTERN = /[A-Za-z0-9_\-./\\]+\.(?:ts|tsx|mjs|js|cjs|py|md|json|jsonl|css|html|txt|yml|yaml|toml)/g;

type Trajectory = {
  task?: string; mode?: string; outcome?: string; iterations?: number; mistake_count?: number;
  error?: string | null; started_at?: string; ended_at?: string;
  transcript?: unknown[];
  tool_log?: Array<{ tool?: string; ok?: boolean; skipped?: boolean; output?: string }>;
};
type Verification = {
  outcome?: string;
  execution?: { results?: Array<{ name?: string; passed?: boolean; skipped?: boolean; reason?: string }> };
  verification?: { state?: string; passed?: boolean; checks?: Array<{ name?: string; state?: string; reason?: string }> };
};

async function readJson<T>(target: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(target, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readJsonl(target: string): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await fs.readFile(target, 'utf8');
    if (raw.length > 8 * 1024 * 1024) return [];
    const rows: Array<Record<string, unknown>> = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed !== null && typeof parsed === 'object') rows.push(parsed);
      } catch { /* malformed audit lines are skipped */ }
    }
    return rows;
  } catch {
    return [];
  }
}

export async function assembleEpisode(options: { workspace: string; episodeId: string }): Promise<GhostEpisodeT> {
  const workspace = options.workspace;
  const episodeId = options.episodeId;
  const aide = path.join(workspace, '.aide');
  const limitations: string[] = [];
  const events: GhostEventT[] = [];
  const workers = new Set<string>();
  const handoffs = new Set<string>();
  const chains = new Set<string>();
  const files = new Set<string>();
  const artifacts = new Map<string, string | null>();
  const claims: string[] = [];
  const verifiedFacts: string[] = [];
  const failures: Array<{ classification: string; summary: string; at: string }> = [];
  const egressEntries: Array<{ action: string; provider_id: string | null; role: string | null; at: string }> = [];

  const trajectory = await readJson<Trajectory>(path.join(aide, 'trajectories', `${episodeId}.traj.json`));
  const verification = await readJson<Verification>(path.join(aide, 'verifications', `${episodeId}.verification.json`));
  if (trajectory === null) limitations.push('no agent trajectory found for this episode id');
  if (verification === null) limitations.push('no verification evidence found for this episode id');

  const startedAt = typeof trajectory?.started_at === 'string' ? trajectory.started_at : null;
  const endedAt = typeof trajectory?.ended_at === 'string' ? trajectory.ended_at : null;

  const push = (kind: GhostEventKindT, source: GhostEventT['source'], at: string, summary: string, data: Record<string, unknown>, causal?: Partial<GhostEventT['causal']>): string => {
    const eventId = `${source}:${events.length}`;
    events.push({
      event_id: eventId,
      kind,
      at: at.slice(0, 40),
      source,
      task_id: episodeId,
      session_id: episodeId,
      worker: null,
      causal: {
        parent_event_id: causal?.parent_event_id ?? null,
        operation_id: causal?.operation_id ?? null,
        handoff_id: causal?.handoff_id ?? null,
        verification_id: causal?.verification_id ?? null
      },
      summary: redactGhostText(summary, 600),
      data: redactData(data) as Record<string, unknown>
    });
    return eventId;
  };

  // --- Trajectory: session lifecycle, tool chain, worker claims ---
  let lastToolEvent: string | null = null;
  if (trajectory !== null) {
    push('session.started', 'trajectory', startedAt ?? '', `session started (${String(trajectory.mode ?? 'act')} mode)`, { mode: trajectory.mode ?? null });
    for (const entry of (trajectory.tool_log ?? []).slice(0, 200)) {
      const tool = String(entry.tool ?? 'unknown');
      const ok = entry.ok === true;
      const skipped = entry.skipped === true;
      const kind: GhostEventKindT = ok ? 'tool.result' : 'tool.failed';
      const excerpt = redactGhostText(entry.output ?? '', 200);
      lastToolEvent = push(kind, 'trajectory', endedAt ?? startedAt ?? '', `${tool}: ${ok ? 'ok' : skipped ? 'rejected' : 'failed'}`, { tool, ok, skipped, output_excerpt: excerpt }, { parent_event_id: lastToolEvent });
      if (ok && WRITE_TOOLS.has(tool)) {
        for (const match of (entry.output ?? '').matchAll(FILE_PATTERN)) {
          const candidate = match[0].replace(/\\/g, '/');
          if (!candidate.startsWith('.aide/') && candidate.length < 300) files.add(candidate);
        }
      }
    }
    const outcome = String(trajectory.outcome ?? 'unknown');
    const terminalKind: GhostEventKindT = outcome === 'done' ? 'session.done' : outcome === 'aborted' ? 'session.aborted' : 'session.error';
    push(terminalKind, 'trajectory', endedAt ?? '', `session ${outcome}`, { outcome, iterations: trajectory.iterations ?? 0, mistakes: trajectory.mistake_count ?? 0 }, { parent_event_id: lastToolEvent });
    claims.push(`outcome: ${outcome}`);
    claims.push(`iterations: ${String(trajectory.iterations ?? 0)}`);
    if (typeof trajectory.error === 'string' && trajectory.error.length > 0) claims.push(`error: ${redactGhostText(trajectory.error, 500)}`);
    if (trajectory.transcript !== undefined) {
      limitations.push('raw transcript is deliberately NOT copied into the episode (worker claims only)');
    }
  }

  // --- Verification evidence: facts derive ONLY from canonical passed steps ---
  let verificationState: string | null = null;
  let verificationPassed: boolean | null = null;
  let verificationChecks: Array<{ name: string; state: string; reason: string }> = [];
  if (verification !== null) {
    verificationState = typeof verification.verification?.state === 'string' ? verification.verification.state : null;
    verificationPassed = verification.verification?.passed === true;
    verificationChecks = (verification.verification?.checks ?? []).slice(0, 32).map(check => ({
      name: redactGhostText(check.name ?? 'check', 120),
      state: redactGhostText(check.state ?? 'unknown', 60),
      reason: redactGhostText(check.reason ?? '', 400)
    }));
    const results = verification.execution?.results ?? [];
    for (const result of results) {
      if (result.passed === true) verifiedFacts.push(`step ${String(result.name ?? '?')}: passed`);
      if (verifiedFacts.length >= 32) break;
    }
    const producedId = push('verification.produced', 'verification', endedAt ?? startedAt ?? '', `verification ${verificationState ?? 'unknown'}`, { state: verificationState, passed: verificationPassed, checks: verificationChecks.length, steps_passed: verifiedFacts.length }, { parent_event_id: lastToolEvent });
    const factKind: GhostEventKindT = verificationState === 'failed' ? 'verification.failed' : verificationState === 'incomplete' ? 'verification.incomplete' : verificationState === 'unavailable' ? 'verification.incomplete' : 'verification.produced';
    if (factKind !== 'verification.produced') push(factKind, 'verification', endedAt ?? '', `verification state: ${String(verificationState)}`, { state: verificationState });
    void producedId;
  }

  // --- Audit bus: worker start + authority rows correlated by session id ---
  const auditRows = await readJsonl(path.join(aide, 'cipher-state.jsonl'));
  // Session-scoped authority rows carry the session id in `task_id` (tool and
  // read operations), while approval rows carry it in `session_id`. Both are
  // canonical correlations for this episode.
  const sessionRows = auditRows.filter(row => row.session_id === episodeId || row.sessionId === episodeId || row.task_id === episodeId || (row.extra as Record<string, unknown> | undefined)?.session_id === episodeId);
  for (const row of sessionRows.slice(0, 400)) {
    const type = String(row.type ?? '');
    const at = String(row.ts ?? row.at ?? '');
    if (type === 'agent' || type === 'agent.start') {
      const chatSource = String(row.chatSource ?? row.chat_source ?? (row.extra as Record<string, unknown> | undefined)?.chat_source ?? 'agent-loop');
      const worker = `agent-loop:${chatSource}`;
      workers.add(worker);
      push('worker.started', 'audit', at, `worker started (${chatSource})`, { chat_source: chatSource, mode: row.mode ?? null });
    } else if (type === 'approval' || type === 'authority') {
      const decision = String((row.decision ?? (row.extra as Record<string, unknown> | undefined)?.decision ?? 'requested'));
      // Lifecycle completions (execution-succeeded) are not authority state
      // transitions; they are skipped rather than mislabeled.
      if (decision === 'execution-succeeded') continue;
      const kind: GhostEventKindT = decision === 'approved' || decision === 'approve' ? 'authority.granted'
        : decision === 'denied' || decision === 'reject' ? 'authority.denied'
          : decision === 'consumed' ? 'authority.consumed' : 'authority.requested';
      push(kind, 'audit', at, `authority ${decision}`, { decision, tool: row.tool ?? null, kind: row.kind ?? null, digest: typeof row.digest === 'string' ? row.digest : null });
    }
  }
  if (sessionRows.length === 0) limitations.push('no audit rows correlated to this episode (authority linkage may be incomplete)');

  // --- Worker handoffs: lifecycle events + descriptors + artifact refs ---
  const handoffDir = path.join(aide, 'worker-handoffs');
  for (const entry of await fs.readdir(handoffDir).catch(() => [] as string[])) {
    if (!entry.endsWith('.json')) continue;
    const envelope = await readJson<Record<string, unknown>>(path.join(handoffDir, entry));
    if (envelope === null) continue;
    if (envelope.task_id !== episodeId) continue;
    const handoffId = String(envelope.handoff_id ?? entry.slice(0, -5));
    handoffs.add(handoffId);
    const from = envelope.from as Record<string, string> | undefined;
    const to = envelope.to as Record<string, string> | undefined;
    if (from?.worker) workers.add(String(from.worker));
    if (to?.worker) workers.add(String(to.worker));
    const causal = { handoff_id: handoffId };
    push('handoff.created', 'handoff', String(envelope.created_at ?? ''), `handoff created ${String(from?.role ?? '?')} -> ${String(to?.role ?? '?')}`, { from, to, objective: envelope.objective ?? null }, causal);
    if (typeof envelope.accepted_at === 'string') push('handoff.accepted', 'handoff', envelope.accepted_at, 'handoff accepted', { to }, causal);
    if (typeof envelope.consumed_at === 'string') push('handoff.consumed', 'handoff', envelope.consumed_at, 'handoff consumed', {}, causal);
    const state = String(envelope.state ?? '');
    if (state === 'FAILED') push('handoff.failed', 'handoff', String(envelope.consumed_at ?? envelope.accepted_at ?? envelope.created_at ?? ''), 'handoff failed', {}, causal);
    if (state === 'CANCELLED') push('handoff.cancelled', 'handoff', String(envelope.created_at ?? ''), 'handoff cancelled', {}, causal);
    for (const artifact of (envelope.artifacts as Array<Record<string, unknown>> | undefined) ?? []) {
      const ref = String(artifact.path ?? '');
      if (ref.length > 0) artifacts.set(ref, typeof artifact.sha256 === 'string' ? artifact.sha256 : null);
    }
  }

  // --- Continuation chains: failures + decisions + replacement workers ---
  const chainsDir = path.join(aide, 'continuations', 'chains');
  for (const entry of await fs.readdir(chainsDir).catch(() => [] as string[])) {
    if (!entry.endsWith('.json')) continue;
    const chain = await readJson<Record<string, unknown>>(path.join(chainsDir, entry));
    if (chain === null) continue;
    const attempts = (chain.attempts as Array<Record<string, unknown>> | undefined) ?? [];
    const belongs = chain.root_task_id === episodeId || attempts.some(attempt => attempt.session_id === episodeId);
    if (!belongs) continue;
    chains.add(String(chain.chain_id ?? entry.slice(0, -5)));
    for (const attempt of attempts) {
      const worker = attempt.worker as Record<string, string> | undefined;
      if (worker?.worker) workers.add(String(worker.worker));
      const classification = String(attempt.failure_class ?? '');
      failures.push({ classification, summary: redactGhostText(attempt.error_summary ?? '', 400), at: String(attempt.failed_at ?? '') });
      push('failure.classified', 'continuation', String(attempt.failed_at ?? ''), `failure: ${classification}`, { classification, worker: worker?.worker ?? null });
    }
    if (typeof chain.last_decision === 'string') {
      push('continuation.decided', 'continuation', String(chain.updated_at ?? ''), `continuation decision: ${chain.last_decision}`, { decision: chain.last_decision, terminal_reason: chain.terminal_reason ?? null, replacement_count: chain.replacement_count ?? 0 });
    }
  }

  // --- Egress journal: window-correlated (documented; never causal) ---
  const egressRows = await readJsonl(path.join(aide, 'egress', 'journal.jsonl'));
  if (egressRows.length > 0) {
    if (startedAt === null || endedAt === null) {
      limitations.push('egress window unknown (no trajectory timestamps); egress entries not attributed');
    } else {
      for (const row of egressRows.slice(0, 500)) {
        const at = String(row.ts ?? '');
        if (at < startedAt || at > endedAt) continue;
        const action = String(row.action ?? 'unknown');
        const provider = typeof row.provider_id === 'string' ? row.provider_id : null;
        const role = typeof row.role === 'string' ? row.role : null;
        egressEntries.push({ action, provider_id: provider, role, at });
        push('egress.observed', 'egress', at, `egress: ${action}${provider ? ` (${provider})` : ''}`, { action, provider_id: provider, role });
      }
      limitations.push('egress entries are time-window correlated, not causally linked');
    }
  }

  // Sort by time (stable), then relabel ids deterministically.
  events.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? -1 : 1));
  events.forEach((event, index) => { event.event_id = `${event.source}:${index}`; });

  const episode: GhostEpisodeT = {
    episode_id: episodeId,
    workspace,
    task: typeof trajectory?.task === 'string' ? redactGhostText(trajectory.task, 2000) : null,
    outcome: typeof trajectory?.outcome === 'string' ? trajectory.outcome : null,
    started_at: startedAt,
    ended_at: endedAt,
    events: events.slice(0, 4000),
    workers: [...workers].slice(0, 32),
    handoffs: [...handoffs].slice(0, 64),
    continuation_chains: [...chains].slice(0, 32),
    egress: egressEntries.slice(0, 200),
    files: [...files].slice(0, 200),
    artifacts: [...artifacts.entries()].slice(0, 64).map(([ref, sha256]) => ({ ref, sha256 })),
    verification: verification === null ? null : { state: verificationState, passed: verificationPassed, checks: verificationChecks },
    failures: failures.slice(0, 16),
    claims: claims.slice(0, 32),
    verified_facts: verifiedFacts.slice(0, 32),
    limitations: [...new Set(limitations)].slice(0, 24)
  };
  return GhostEpisode.parse(episode);
}
