# Harness Current Reality

Review base: `dc0d30ee226e7ff822592e3a800f064b4441b7af`.

This document describes the certified source candidate, not the later
`work/astra-crown-jewel` H1/H2 branch and not PR #31.

## Executive finding

Covert currently has several useful Harness-shaped mechanisms, but not one
canonical Harness execution substrate.

The live path is an approval-gated `AgentLoop` composed with the canonical HTTP
Execution Authority. The legacy `harness/` directory is a proposal, patch,
sandbox, and generic Veritas implementation that is tested but not the normal
production mutation path. Resource admission is a deterministic observation
used by readiness/model-start checks, not a reservation bound to an agent
attempt. Provenance and Mission Receipt are append-only observations and
projections, not a complete execution admission record.

The system is therefore strongest at:

- exact operation digest/scope binding at the HTTP Authority boundary;
- explicit operator approval for live agent mutations;
- lexical and real-path file containment for the file tools;
- honest refusal to turn the current live agent path into `VERIFIED` without
  requirement-bound evidence;
- bounded handoff context that labels worker claims as unverified;
- workflow stage and Skill context projections.

It is weakest at joining those facts into one durable identity that answers,
after a crash or retry, exactly what was admitted, what model/context/method
ran, what effects were observed, and whether a retry is safe.

## The actual execution paths

| Path | Entry | What actually runs | Durable output | Truth boundary |
|---|---|---|---|---|
| Legacy Harness | `harness/orchestrator.mjs:createHarness` | reason → build diff → optional patch repair → optional verification runner → generic Veritas | returned proposal/trace only | no production mutation authority; `apply()` throws |
| Legacy sandbox | `harness/sandbox.mjs` | touched-file scratch copy, search/replace, sequential commands, optional real-workspace apply helper | scratch/verification return values | not production-registered; not a full OS/process/network sandbox |
| Live AgentLoop | `POST /api/agent/start` → `node/src/routes/agent.ts` → `agent-loop.mjs` | context providers → model chat → XML tool calls → approval → tool execution | in-memory session, trajectory JSON, verification JSON, audit events, provenance row | live model execution and tool observation; verification remains negative/unavailable on this candidate path |
| Direct agent tool route | `POST /api/agent/tool` | read-only dispatch only; mutation is denied by route policy | response/audit as applicable | separate route, not a universal AgentLoop interceptor |
| Capability routes | typed route families through `node/src/server.ts` | route handler after exact operation authorization | route-specific state/audit | canonical HTTP Authority operation, but not automatically an AgentLoop attempt |
| Model runtime | model start/chat/stop routes and `ModelRouter` | local engine/provider calls | runtime/model state and route result | model/runtime truth; not joined to agent attempt provenance |
| Continuation | continuation routes/service | classify trajectory/verification, retry or create handoff | chain and handoff files | failure policy; side effects can remain `unknown` |

The prior intelligence-spine audit correctly classified the standalone Harness
as shadow relative to production and the AgentLoop as the strongest live
candidate. This review confirms that conclusion against the certified source.

## Live request trace

### 1. Request and context

`AgentStartRequest` accepts task, mode, chat source, role, worker descriptor,
handoff ID, and optional readiness ID (`common/contracts/agent.ts:8-39`). The
readiness ID is documented as enforced only where a production gate wires it;
the candidate's `openapi.ts` resource admission call is instead used by the
readiness service for a model-start check (`node/src/openapi.ts:687-713`).

The live loop seeds a system prompt and user task, then resolves Resident,
memory, index, evidence, Skills, and Workflow providers in parallel. It records
source/status events, but it does not create an immutable Context Envelope ID,
content hash, source manifest, ordering record, exclusion record, or exact
token count for the assembled AgentLoop transcript (`agent-loop.mjs:300-328`).

The separate non-stream chat composer has useful bounded context accounting,
including effective context, scaffold version, approximate prompt tokens,
memory hits, and retrieval degradation (`node/src/services/chat-context.ts:105-203`).
Those fields are a response projection; they are not bound to the AgentLoop
trajectory or a durable execution identity.

### 2. Model selection and invocation

`ModelRouter` can expose local/cloud route identity, provider type, model string,
context length, chat template label, role list, health, and route timing
(`node/src/services/model-router.ts:21-53`, `76-143`). It fits history against
the effective served context and calls the local runtime/provider
(`model-router.ts:225-270`).

The default AgentLoop callback selects a role route and returns only
`result.text` (`node/src/openapi.ts:551-562`). The selected route, provider,
runtime version, actual model artifact hash, sampling parameters, token usage,
and timing are not persisted into the AgentLoop trajectory or provenance row.
The model identity passed to provenance is the caller-supplied worker descriptor,
not independently captured adapter/runtime evidence.

### 3. Tool proposal, Authority, and execution

The AgentLoop parses XML calls, checks tool registry and parameters, computes
risk, and requests approval for non-read-only or risky calls
(`agent-loop.mjs:438-482`). Mutations execute through the exact Authority handle;
read-only tools execute directly. The HTTP server also requires an exact
operation for non-read requests and wraps route execution in Authority
(`node/src/server.ts:122-201`).

This is a real security boundary, but it is an operation boundary rather than a
full attempt boundary. The operation contains actor, workspace, task, method,
path, body digest, risk and expiry (`common/contracts/authority.ts:6-21`). It
does not contain the Context Envelope, Skill manifest, model/runtime fingerprint,
resource decision, acceptance requirements, attempt lineage, or effect ledger.

### 4. Effects and process ownership

File tools perform lexical and real-path containment and deny top-level `.git`;
`run_command` spawns with `cwd` and inherited `process.env`, caps output, and
on timeout calls `child.kill()` and Windows `taskkill` without waiting for or
proving exact descendant cleanup (`agent-tools.mjs:232-279`). Cwd is not an OS
jail. Network-looking tokens generate risk/egress observations but are not a
complete network enforcement boundary for arbitrary interpreters.

The candidate has terminal-session and model-runtime ownership code in separate
services. The AgentLoop does not bind every child process, port, temporary file,
environment mutation, or descendant to a durable attempt record. Two attempts
can therefore be compared only if the caller separately establishes clean
workspace/process conditions.

### 5. Completion, verification, and persistence

`attempt_completion` calls `finishDone` immediately when found in a model reply
(`agent-loop.mjs:387-400`). The live loop's `buildExecution` treats successful
tool returns as execution evidence but explicitly marks required artifact and
required test checks unavailable because no requirement-bound verifier is
configured (`agent-loop.mjs:623-638`). `emitVerificationOutcome` persists the
trajectory and a verification report but forces the persisted/published
verification result to `passed: false` (`agent-loop.mjs:641-684`). This is
truthful fail-closed behavior, not proof that the path can accept a mission.

The trajectory contains task, mode, outcome, iterations, mistake count,
transcript, and tool log (`agent-loop.mjs:613-620`). The strict provenance row
contains run/task IDs, worker hint, result, verification state, evidence and
trajectory paths, iterations, and timestamps (`common/contracts/provenance.ts:14-30`).
It does not contain a sealed execution envelope.

## Authority lifecycle and its boundary

`execution-authority.mjs` keeps actors, operations, pairings, and ephemeral
execution handles in process memory. It persists audit events before moving
through proposed/approved/consuming/executing/succeeded or failed states
(`execution-authority.mjs:226-315`). This prevents replay of a consumed exact
operation during a healthy process, and it refuses to claim success when outcome
persistence fails.

It does not make the underlying mutation and its durable outcome one atomic
transaction. A process crash can occur after `consuming` or after an executor
has caused an effect but before durable terminal observation. The candidate has
no live AdmissionLedger to reconcile that uncertainty.

## Resource Admission reality

The canonical admission contract contains only kind (`resident`, `model_start`,
`worker`), resource requirements, disposable flag, decision, reason, probe
evidence and timestamp (`common/contracts/admission.ts:3-35`). The implementation
probes free memory, optional VRAM, and load and returns START/QUEUE/REFUSE
(`resource-admission.ts:56-99`). It does not reserve capacity, issue an
admission ID, bind to a worker attempt, or close a reservation when execution
ends. The only visible production composition uses it for readiness's model
memory check (`openapi.ts:687-713`).

## Workflow, Skills, and handoff reality

Workflow owns stage/revision/artifact progression and has an Authority-protected
mutation route. Stage is projected into the worker context and used to bias
Skill retrieval (`openapi.ts:483-509`, `551-583`). The Skill payload is advisory
text; AgentLoop events record source/status only, not Skill IDs, versions,
hashes, selection rationale, or loaded references.

Worker handoff is materially stronger: the envelope carries project/task/workflow/
stage, worker descriptors, objective, worker claims, verified facts, constraints,
artifacts, evidence and failure context, while explicitly keeping authority out
of the context (`common/contracts/worker-handoff.ts:39-69`). It is a continuity
record, not an execution admission. Continuation creates a new handoff but
currently records side effects as `unknown` when switching workers and uses the
failed session ID as the task identity (`continuation-manager.ts:190-215`).

## Ghost Code and replay reality

The candidate has `.aide/trajectories` with transcript/tool observations and a
metadata-only ReplayStore. `ReplayRecord` contains task class, model string,
status, checks and created time only (`common/contracts/replays.ts:3-32`;
`daemon/replay-store.mjs:4-15`). This is not exact replay. A trajectory can
support observation replay of a prior conversation/tool log, but it does not
bind the exact model/runtime/context/Skill/Authority/resource/effect state.

The correct replay classification today is:

| Replay class | Current status | Honest meaning |
|---|---|---|
| Exact replay | Absent | no guarantee of same stochastic model response or same external state |
| Semantic replay | Partial | task/tool transcript can be inspected, but environment and input manifest are incomplete |
| Observation replay | Partial/available | persisted trajectory, verification JSON, audit and provenance can be reviewed |
| Non-replayable | Common | remote/provider calls, mutable workspaces, unrecorded runtime state |

## Current execution object: fragmented, not canonical

The candidate has these partial identities:

| Fact | Current carrier | Missing binding |
|---|---|---|
| user task/session | Agent session and trajectory | durable attempt identity and project/workflow revision |
| exact route/permission | Authority operation | model/context/resource/acceptance binding |
| resource observation | Admission response | reservation/owner/expiry/settlement |
| workflow state | Workflow service/audit | immutable revision attached to tool effects |
| methodology | Skill text in prompt | ID/version/hash/selection reason/content digest |
| model hint | Worker descriptor/provenance field | independently observed provider/runtime/artifact/config |
| effects | tool log, route state, filesystem | before/after effect ledger and uncertain-effect fence |
| verification | verification JSON/Veritas projection | requirement-bound independent verifier and attempt-scoped evidence |
| retry/handoff | continuation chain/handoff | fresh attempt identity and effect certainty gate |

No current object uniquely binds all required fields from the review brief.

## Historical H1/H2 reconstruction

### H1 execution transaction

The historical `f2136f8` contract introduced a rich transaction topology with
task/workspace/attempt/transaction IDs, context binding, methodology binding,
worker selection, authority resolution/consumption, resource budget,
checkpoint, effect certainty, evidence, quiescence, retry lineage and terminal
states. Its module comment explicitly says it is inert: it does not execute,
authenticate, talk to Authority, persist state, or decide Veritas. Commits
`503c813` and `13f2388` added scope/retry/evidence invariants and tests.

Those are valuable design/test evidence, but `git merge-base --is-ancestor`
shows the H1 commits are not ancestors of the certified candidate. The candidate
does not contain their files. H1 was therefore a contract experiment, not
shipped Harness behavior.

### H2 ownership and AdmissionLedger

Historical `5abb1e0` introduced process/tool ownership, generation proofs,
admission reservations, an in-memory `AdmissionLedger`, quiescence observations,
handoff and provider-generation evidence. `11b5dec` hardened trusted tokens,
mutexes, generation provenance, admission cutoffs and quiescence against
partial/forged ownership facts.

The H2 tests show the failure condition directly: reservation, authority
consumption, commit, dispatch-start, terminal observation, and quiescence are
separate facts. Fault modes deliberately exercise fact/commit failure and
unresolved ownership. The later hardening improves fail-closed behavior, but it
still lives only on `work/astra-crown-jewel`; its ledger is in-memory and is not
the candidate's live production ledger.

## H1/H2 failure analysis

The rejected H2 shape was not wrong because partial states were represented. It
was rejected because the boundary between “some admission facts exist” and
“the external mutation may begin” was not one durable, atomic authority.

| Question | Evidence-backed answer on the certified candidate |
|---|---|
| What changed before admission was authoritative? | Authority operation state can move to `consuming` before persistence completes; resource admission is only a probe; AgentLoop can create trajectory/evidence without a canonical attempt admission. |
| Could execution begin while canonical admission was incomplete? | Yes in the live path: no candidate AdmissionLedger binds Resource Admission to AgentLoop tool execution. Operation Authority is necessary for mutation but is not full execution admission. |
| Could retry duplicate an uncertain mutation? | It cannot be proven safe. Continuation records `side_effects: unknown` and says not to replay effects, but lacks a durable effect ledger/attempt gate that enforces this across restart. |
| Could evidence exist for never-fully-admitted execution? | Yes. Trajectory, verification JSON, audit and provenance are session-driven and can exist without a sealed attempt/admission record. |
| Could persisted admission diverge from execution? | Yes. Audit persistence can record Authority transitions while executor side effects and child processes are not atomically coupled to that record. |
| What atomicity boundary is missing? | A durable, immutable execution envelope plus an admission/settlement journal that must be authoritative before mutation and must enter `UNKNOWN/UNRESOLVED` after interruption, blocking blind retry. |

The correct lesson is not “make every subsystem one transaction.” It is “make
the exact mutation-capable attempt and its uncertainty boundary one canonical
record,” while keeping Authority, Resource Admission, Veritas and Provenance
as separate owners with explicit references.

## Capability extraction diagnosis

The proposed division is mostly correct when read as ownership, not as current
implementation:

| Responsibility | Repository reality | Review disposition |
|---|---|---|
| Resident | deterministic advisory/context service; not the live tool authority | preserve as continuity/interpretation owner |
| Context Control | chat composer plus AgentLoop providers; no immutable envelope | retain owner, add binding later |
| Skill Intelligence | stage-aware loader and advisory payload | retain owner, add methodology manifest later |
| Workflow | durable stage/revision/artifact state | retain owner, bind revision to attempt |
| Orchestrator | AgentLoop currently combines loop, prompt, tool dispatch and terminal evidence | separate seams gradually; do not create a second orchestrator |
| Model Router | route/provider choice and fit | owns recommendation; Harness records actual selection |
| Resource Admission | probe/decision only | owns admission policy; future reservation must remain distinct |
| Execution Authority | exact operation permission/consumption | remains sole permission owner |
| Harness | currently split between legacy harness and live AgentLoop mechanics | future attempt lifecycle/observation owner, not policy owner |
| Veritas | generic score plus candidate live negative gate | acceptance owner; must consume attempt-scoped evidence |
| Provenance | append-only run observations/receipt projection | canonical history owner; must receive Harness facts |
| Helix | durable project truth/memory | receives only verified projections |

The Harness should maximize reliable extraction by making an admitted attempt
bounded, observable, and recoverable. It should not select Skills, invent
context, approve effects, decide acceptance, or rank models by itself.

## Reasoning budget and context

The code currently exposes context length and some chat options, but the live
AgentLoop does not persist a complete budget record. The clean future split is:

```text
Orchestrator / Model Router: recommend model and reasoning budget
Resource Admission: admit the requested resource envelope
Execution Authority: permit effects, never cognition
Harness: enforce/stop the admitted limits and record actual usage
Provenance: persist the observations
Veritas: judge acceptance
```

The Harness should consume a bounded Context Envelope rather than build one.
The certified candidate has bounded projections but no candidate Context Envelope
contract. This gap is important: it prevents diagnosing whether a model failed
because of model behavior or because the system supplied wrong, excessive, or
badly ordered context.

## Resident cross-model case study

PR #31 was not merged. Its read-only frozen matrix reports recurring compound
failures across Macaw, Terminal-SFT, and Granite, while the system-gap analysis
assigns compound obligation projection to Workflow/Orchestrator, retrieval to
Helix/Context, protected claims to Veritas/containment, and policy truth to the
canonical Authority projection. Granite also had containment escapes that were
repaired and re-tested; the matrix records containment as passing while the
model seat still failed.

This is direct evidence that a model result alone cannot identify the cause.
The current Harness could show context-source status and a trajectory, but could
not answer with durable, comparable evidence:

- which exact context projection each model saw;
- which Skill/SOP version and size was loaded;
- which Authority projection was present;
- which model/runtime/template/configuration produced the output;
- whether the same acceptance evaluator and tool set were used;
- whether the model was degraded by context/adapter/runtime before being
  classified as a model failure.

That missing observability is the core research value of a future Harness, not
permission to weaken the acceptance standard.

## Current unanswered questions

After a live AgentLoop attempt, the candidate cannot reliably answer all of:

1. What exact context bytes/messages entered the model?
2. Which Skills and versions affected the prompt?
3. Which provider/runtime/template/configuration actually executed?
4. What resource decision and budget were admitted?
5. Which operation/approval belongs to which attempt?
6. What exact files/processes/ports changed, including uncertain effects?
7. Which tests actually ran and against which state?
8. Why was a retry safe, or why was it forbidden?
9. Which evidence justified the final acceptance?
10. Could another model reproduce the same observation without inheriting state?

These are the signals the next architecture slice must make answerable.

## Model access and connection reality

The candidate already has a useful but incomplete connection surface. It is not
accurate to describe model access as absent:

| Existing path | Current evidence | Current truth |
|---|---|---|
| Unified connection view | `common/contracts/connections.ts`, `node/src/services/provider-connections.mjs`, `routes/connections.ts` | Aggregates local runtime, built-in API-key providers, subscription-runtime presence, and Hugging Face catalog-token state. |
| Direct providers | `node/src/services/providers.ts` | Built-in OpenAI, Anthropic, Google, Mistral, Groq and OpenRouter definitions; host allowlist, probe, chat and secure credential store. Catalog/model data is partly static and not a complete discovery contract. |
| Credential storage | `node/src/services/credentials.ts` | Windows DPAPI-backed provider store; unsupported secure storage is unavailable rather than silently plaintext. |
| OpenCode bridge | `node/src/services/opencode-bridge.ts`, `openapi.ts` | Health/provider/auth discovery and delegated task execution through an OpenCode server. The bridge deliberately does not read OpenCode credentials and records delegated identity only when OpenCode returns it. |
| Local runtime | `model-runtime.ts`, `provider-connections.mjs` | Ready local models can be projected as a local connection, but connected/readiness/resource state is not a complete model acquisition or capability passport. |
| Egress | `egress-journal.mjs`, provider/BYOK routes | Egress can be consented and journaled with safe host/provider metadata; this is not yet a complete connection/mission fingerprint. |

The product requirement is therefore a **connection-center hardening and
integration slice**, not a greenfield provider system. The current surface still
needs a provider-neutral connection class model, richer truthful status
(`AUTH_EXPIRED`, `RATE_LIMITED`, `UNKNOWN`), dynamic model/capability discovery,
credential-owner references, model revision/hash/licence metadata, and a clean
join to the sealed attempt/provenance contract proposed by this review.

### OpenCode and direct-provider boundary

OpenCode is a viable initial delegated broker because the candidate already has
a narrow bridge that uses documented server endpoints for health, providers,
authentication methods, sessions and delegated model identity. It must remain a
broker, not a second Covert provider registry or credential store. Direct API
adapters must remain possible behind the same resolved worker/runtime contract.

The provider research addendum is recorded in:

```text
docs/harness/MODEL-CONNECTION-PROVIDER-MATRIX.md
docs/harness/MODEL-CONNECTION-CONTRACT.md
docs/harness/MODEL-CONNECTION-UX.md
docs/harness/MODEL-CONNECTION-SECRET-THREAT-MODEL.md
docs/harness/MODEL-CONNECTION-IMPLEMENTATION-HANDOFF.md
```

### Connection and Harness Sync boundary

New model access must default to Standard Harness. Optional Harness Sync may be
offered only after the connection returns an exact model/runtime fingerprint.
Connection state does not become a Passport observation, and Passport evidence
does not become permission. Resource Admission decides feasibility, Authority
decides effects, Harness records the resolved execution conditions, and Veritas
keeps the same acceptance standard.
