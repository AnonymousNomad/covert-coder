# RESIDENT-ORCHESTRATION-MAP

The Resident is the persistent intelligence between the operator and the governed
machine. It is NOT the orchestrator, NOT the execution authority, and NOT the
strongest model. This map names every surface the Resident lane consumes and the
boundary of each subsystem. All surfaces below are canonical (committed or the
Resident lane's own untracked modules); no new production service was created.

## The loop
```
OPERATOR (natural goal)
   ↓
RESIDENT            /api/chat (governed: awareness envelope + containment)
   ↓  understand objective
RECONSTRUCTION      GET /api/workflow/state · GET /api/git/status · GET /api/workspace/tree
   ↓                + .aide/orch/continuity.jsonl (lane continuity store)
METHODOLOGY         resident-sops.mjs discovery + awareness-provider deterministic selection
   ↓                (same functions the live provider uses; SOP bodies capped at 2)
WORKER SELECTION    resident-arsenal.mjs projection + resident-worker-bridge selectWorker
   ↓                (MODEL descriptors: availability + roles)
ASSIGNMENT          resident-worker-bridge buildWorkerAssignment (bounded; proposal-only)
   ↓
ORCHESTRATOR        the mission runner sequences stages; canonical workflow kernel
   ↓                (workflow-service: DISCOVERY→…→DEPLOYMENT, evidence-gated transitions)
EXECUTION AUTHORITY /api/authority prepare+decision (exact operations; no authority by wording)
   ↓
HARNESS             POST /api/terminal/run (approved) · POST /api/file/write (approved)
   ↓
WORKER              real engines served by the model runtime (registered + started via the API)
   ↓
EVIDENCE            execution results (exit codes, stdout) + artifact sha256
   ↓
VERITAS             harness/veritas.mjs evaluateExecution (deterministic)
   ↓
RESIDENT            interpretation via /api/chat (governed; no optimistic summarization)
   ↓
CONTINUITY          .aide/orch/continuity.jsonl + PROJECT_STATE.md
   ↓
REPORT / CONTINUE / ESCALATE
```

## Boundaries (who owns what)
| Concern | Owner | Surface |
|---|---|---|
| Understanding, remembering, reasoning, recommending, delegating, interpreting, explaining | **Resident model** (Liquid merged) | `/api/chat` with awareness envelope |
| Sequencing, state transitions, routing execution, control flow | **Mission runner + workflow kernel** | `workflow-service.ts`, `/api/workflow/*`, runner stages |
| Permission | **Execution Authority** | `/api/authority/prepare|decision`; single-use exact operations |
| Execution | **Harness / product routes** | approved `/api/terminal/run`, `/api/file/write` |
| Truth / evidence | **Veritas + deterministic gate** | `harness/veritas.mjs`; execution checks |
| Memory (structured) | **Helix (canonical)** | `harness/memory-spine|helix-join|helix-retention.mjs`; `/api/memory/*` |
| Project state | **Workflow store** | `.aide/workflow/state.json` |
| Worker capability truth | **Arsenal projection** | `resident-arsenal.mjs` over the model runtime |

## Authority preservation (Program 30)
- Every mutation in the missions went through an approved exact operation
  (`X-AIDE-Operation`), never through prompt wording.
- The coder is proposal-only: the artifact is applied by the caller to an
  explicitly authorized target (`src/version.mjs` in the disposable project).
- A push/deploy intent in a mission would require its own approved operation; the
  Resident cannot mint authority by asking.

## Known wiring gaps (recorded, not built around)
- **Local→cloud provider handoff**: the governed provider bridge exists
  (`routes/connections.ts`, BYOK) but no approved cloud provider is configured in
  this workspace; provider-switch missions are recorded as
  `BLOCKED_BY_PRODUCTION_WIRING` (DeepSeek-owned wiring) rather than duplicated here.
- **Canonical workflow artifact vocabulary** is the experience pipeline
  (EXPERIENCE_BRIEF…); a generic code mission cannot yet advance stages through the
  canonical gate without matching artifacts. Mission continuity therefore uses the
  lane's `.aide/orch/continuity.jsonl` alongside the canonical workflow state.
- **Helix corrections** (poisoning, stale override, provenance) are DeepSeek-owned;
  this lane consumes the memory contract as-is and records what it observed.
