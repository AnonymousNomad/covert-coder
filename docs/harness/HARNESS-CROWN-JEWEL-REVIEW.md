# Harness Crown-Jewel Review

Review status: **COMPLETE — ARCHITECTURE / RESEARCH / DESIGN ONLY**

Review base: `dc0d30ee226e7ff822592e3a800f064b4441b7af`

Review branch: `review/harness-crown-jewel-vnext`

Certified candidate modified by this review: **0 files / 0 production semantics**

## 1. Executive finding

Covert has trustworthy pieces of a Harness, but the certified source candidate
does not yet have one canonical execution substrate. The live production path
is an approval-gated AgentLoop using the canonical HTTP Execution Authority.
The `harness/` directory is a valuable shadow proposal/sandbox/Veritas path,
not the normal production mutation path. Resource Admission is a probe and
decision, not a durable reservation. Provenance and trajectories are useful
observations, not a sealed execution record.

The central structural gap is:

```text
NO SINGLE DURABLE IDENTITY BINDS
MISSION + PROJECT/WORKFLOW STATE + CONTEXT + SKILLS + MODEL/RUNTIME
+ BUDGET + RESOURCE DECISION + AUTHORITY + EFFECTS + VERIFICATION
```

This gap prevents reliable retry safety, attempt comparison, failure
attribution, replay classification, Harness Sync calibration, and evidence-
backed Cross-Model Synthesis. It is not a reason to make the Harness own
Resident, Context Control, Skills, Workflow, routing, Authority, Veritas, or
Helix.

The correct direction is an incremental, owner-preserving execution boundary:

```text
existing owners
→ immutable execution envelope reference
→ durable attempt/admission/uncertainty journal
→ observed effects and evidence
→ existing Veritas / Provenance / Helix projections
```

## 2. Current Harness reality

The full trace is in `HARNESS-CURRENT-REALITY.md`. The current paths are:

| Path | Current role | Review judgment |
|---|---|---|
| `harness/orchestrator.mjs` | proposal, diff, optional repair, generic verification | useful shadow architecture; not production mutation authority |
| `harness/sandbox.mjs` | scratch copy and bounded file/command verification | not a full OS/process/network sandbox and not default AgentLoop lifecycle |
| `node/src/services/agent-loop.mjs` | live model loop, context providers, XML tools, approval, tool dispatch, trajectory and negative verification | strongest live execution-shaped path; lacks sealed attempt identity |
| `node/src/services/execution-authority.mjs` | exact operation digest/scope/expiry and one-use operation lifecycle | canonical effect permission; not complete attempt admission |
| `node/src/services/resource-admission.ts` | free-memory/VRAM/load probe and START/QUEUE/REFUSE decision | feasibility observation; no durable reservation/settlement |
| Provenance/trajectory/ReplayStore | append-only/metadata observations | not exact replay or complete attempt provenance |
| Continuation/handoff | failure classification and bounded worker context transfer | useful continuity; side-effect uncertainty is not an enforced retry gate |
| Connections/OpenCode | partial local/direct/delegated access projection | reusable product surface; incomplete provider-neutral discovery/fingerprint |

The AgentLoop builds advisory context from Resident, workflow, memory, index,
evidence and Skills. It does not currently persist an immutable Context
Envelope ID/content hash/source ordering/truncation/exclusion manifest. The
default model callback selects a route and returns text without storing the
actual provider/runtime/artifact/template/configuration in the attempt record.

Tool calls can be Authority-gated, but the operation record does not bind the
Context Envelope, Skill manifest, model/runtime, resource decision, budget,
acceptance requirements, effect ledger, or attempt lineage. `done` is not
`verified`; the live AgentLoop intentionally emits a negative/unavailable
verification result when requirement-bound evidence is absent.

## 3. What is already excellent

The candidate has several strong boundaries that should be preserved:

1. Exact operation/body-digest/scope/expiry checking exists at the HTTP
   Authority boundary.
2. AgentLoop mutations request approval and route through the canonical
   Authority handle; model text and Skills do not directly grant permission.
3. File tools enforce lexical and real-path containment and deny top-level
   `.git` access; command output is bounded.
4. The live verification path fails closed instead of promoting a worker claim
   to `VERIFIED` when required evidence is unavailable.
5. Worker handoff distinguishes claims from verified facts and keeps Authority
   out of transferable context.
6. Workflow stage and Skill projections already provide useful methodology
   inputs even though their exact manifests are not yet bound to attempts.
7. The OpenCode bridge deliberately uses documented server surfaces and does
   not read/copy OpenCode credential files.
8. Direct credentials use the existing Windows DPAPI-backed store; unsupported
   secure storage is not silently represented as safe plaintext storage.
9. The candidate has a meaningful local-first connection view and egress
   journal, which gives the next product slice a real starting point.

These strengths make an incremental Harness boundary credible. They do not
prove that the complete Harness contract already exists.

## 4. What remains structurally weak

### Execution truth

- no canonical durable attempt/admission object;
- no atomic boundary between admission facts and mutation-capable dispatch;
- Authority state and external side effects can diverge after a crash;
- Resource Admission has no reservation owner, expiry, or settlement;
- child processes, descendants, ports, temporary files and environment are not
  uniformly bound to an AgentLoop attempt;
- checkpoint start is not a proven awaited before-state;
- direct-child termination is not proof of descendant quiescence;
- continuation can record `side_effects: unknown` without a durable retry fence.

### Attribution and measurement

- exact context bytes/order/truncation are missing from AgentLoop provenance;
- Skills are advisory text without ID/version/hash/selection rationale;
- caller worker hints are not independently observed model fingerprints;
- budget policy, enforcement, actual usage and cost are split across services;
- current replay data cannot reproduce an environment or prove clean comparison;
- Veritas lacks a live requirement-bound acceptance manifest on this candidate.

### Product access

The candidate has direct provider definitions, a partial Connections view,
secure direct credentials, local runtime detection, and a narrow OpenCode
bridge. It does not yet provide a complete provider-neutral contract for
delegated credential ownership, dynamic model/capability discovery, rich auth
and rate-limit states, exact model revisions/hashes, catalog license gates, or
connection-to-attempt fingerprint binding.

## 5. Major obsolete assumptions

The full register is `HARNESS-ASSUMPTION-REGISTER.md`. The most consequential
invalidated assumptions are:

```text
harness/ is the production Harness
operation Authority is the complete execution admission
Resource START means a reservation exists
session ID is a durable attempt identity
checkpoint start proves a before-state
cwd + path checks are an OS sandbox
child kill proves process cleanup
handoff text saying “do not replay” enforces retry safety
trajectory JSON is replay
context source/status events prove model input
caller worker descriptor proves model identity
completion prose is safe to treat as done
historical H1/H2 commits are shipped because they exist in Git
models sharing a chat interface are behaviorally interchangeable
one calibration represents a model forever
provider connection equals model readiness
credential presence equals healthy provider
catalog download equals execution permission
ChatGPT, OpenAI API, Codex, GitHub repository and Copilot access are one entitlement
```

H1/H2 are historical evidence, not candidate behavior. The relevant commits
are not ancestors of the review base.

## 6. Missing truth boundaries

The candidate needs a future canonical join, not a god object. The missing
facts are:

```text
mission/project/workflow/stage revision
attempt and parent-attempt lineage
objective and acceptance/verification requirements
immutable Context Envelope identity/content digest
Skill/SOP IDs, versions, hashes, references and selection rationale
resolved and observed worker/model/provider/runtime/template/configuration
reasoning/token/time/retry/repair/resource budgets
Resource Admission decision and settlement
Authority operation references and permit consumption
isolation scope and process/effect observations
verification evidence references and final Veritas result
unknown/partial/uncertain effect state
replay class and reproducibility limits
```

Unknown is a valid value. Missing truth must not be filled with a model claim,
a PID, a successful process exit, a stored credential, or a stale cache.

## 7. Duplicated responsibilities

| Concern | Current duplication or blur | Correct boundary |
|---|---|---|
| execution | legacy Harness and live AgentLoop | keep legacy path visibly shadow; make live attempt lifecycle canonical later |
| context | chat composer and AgentLoop providers | Context Control constructs; Harness records immutable input binding |
| permission | Authority plus Harness documentation claiming permissions | Authority alone permits effects; Harness consumes references |
| verification | generic Harness Veritas and live negative gate | Veritas owns acceptance; generic checks are helpers/evidence producers |
| model identity | route metadata, worker hint, provider result | Router selects; adapter/runtime observes; Harness binds actual fingerprint |
| provenance | trajectories, provenance rows, ReplayStore, handoff | existing Provenance owner should receive joined observations; no second ledger |
| provider access | direct ProviderService, BYOK, Connections view, OpenCode bridge | one projection over existing owners; no second registry/credential store |
| calibration | proposed Passport/Profile versus mission history | Passport stores observations; Profile is derived policy; Synthesis analyzes history |

## 8. Capability-extraction diagnosis

The thesis is valid only if “extract capability” means **make admitted model
work more reliably observable, bounded, recoverable and verifiable**. It does
not mean lowering acceptance, hiding model failure, or putting every intelligent
responsibility in Harness.

The tested ownership split is:

```text
Resident            continuity / interpretation
Context Control     governed context construction
Skill Intelligence  methodology selection
Workflow            stage and obligations
Orchestrator        decomposition / sequencing / coordination
Model Router        model/provider selection and recommendation
Resource Admission  feasibility and resource policy
Authority           permission for effects
Harness             attempt lifecycle, limits, isolation, observation, capture
Veritas             independent acceptance/evidence judgment
Provenance          canonical observations/history
Helix               verified durable project truth
```

The live AgentLoop currently combines several of these responsibilities, so
separation should be gradual and evidence-led. Harness must not become another
Orchestrator, Workflow engine, Context builder, Skill selector, Authority,
Veritas, Helix, provider gateway, or prompt dump.

## 9. Ghost Code / replay maturity

Current status:

| Class | Status | Meaning |
|---|---|---|
| Exact replay | **ABSENT** | no guarantee of same stochastic call or external state |
| Semantic replay | **PARTIAL** | task/tool transcript can be inspected, but input/effect/environment manifests are incomplete |
| Observation replay | **PARTIAL / AVAILABLE** | trajectory, verification JSON, audit and provenance can be reviewed |
| Non-replayable | **COMMON** | remote calls, mutable workspaces and unrecorded runtime state |

Ghost Code should reconstruct bounded observations, not private chain-of-thought.
The minimum useful capture is admission/envelope identity, model/runtime,
Skills, tool requests, Authority decisions, observed effects, verification
commands/results, resource/timing facts and result classification. Remote
stochastic calls may remain non-exact while their request/effect/evidence trail
is observation-replayable.

## 10. AdmissionLedger verdict

**PARTIALLY — historical proof shape, not certified-candidate authority.**

The historical H2 AdmissionLedger correctly exposes why reservation, Authority
consumption, commit, dispatch, terminal observation and quiescence must not be
collapsed. It is not present in the certified candidate and its historical
implementation is not a license to import a second in-memory truth store.

The certified candidate's current Resource Admission is a probe/decision; the
Authority operation is an exact permission record. Neither alone proves the
whole thing that entered execution.

If an AdmissionLedger-like boundary is implemented later, it must prove before
mutation-capable dispatch:

```text
exact envelope/attempt identity
project/workflow/stage revision
resolved model/runtime/context/Skill/budget facts
resource decision and expiry
Authority operation reference and scope
isolation/ownership plan
```

After interruption, uncertain effect, or missing settlement it must enter an
honest unresolved state that blocks blind retry. A retry/repair is a new attempt
with fresh evidence and, for mutation, fresh Authority—not a mutation of the
historical attempt.

## 11. Veritas boundary verdict

The boundary is conceptually correct and partially enforced:

```text
MODEL CLAIM ≠ EXECUTION FACT ≠ VERIFIED ACCEPTANCE
```

The live AgentLoop's negative/unavailable verification is an important fail-
closed behavior. The remaining weakness is not that Harness should verify more
on its own; it is that the future attempt must supply Veritas with exact,
attempt-scoped evidence and acceptance requirements. Veritas must independently
check those requirements, reject stale/wrong-project/wrong-attempt evidence,
and never accept a worker's completion prose as proof.

## 12. Failure-attribution maturity

**PARTIAL.** The repository has continuation failure classes and useful system
diagnostics, but not the first-divergence observability needed to separate:

```text
context / Skill / workflow / adapter / runtime / orchestration failure
from
model behavior failure
from
Authority / resource / execution / tool / verification / Harness failure
```

PR #31's unmerged cross-candidate evidence is a concrete case: Macaw,
Terminal-SFT and Granite showed recurring compound failures; the system-gap
analysis assigns compound obligation projection, retrieval, protected claims,
and Authority truth to model-neutral layers where evidence supports it. Granite
also had containment escapes that were repaired and retested. The current
candidate could show source/status events and a trajectory, but could not prove
the exact context, Skill, Authority projection, model/runtime/template, tool set
and evaluator for comparable attribution.

The correct future classifier records the first divergence and owner only after
upstream context, contract, adapter, runtime and evaluator causes are checked.

## 13. Benchmark readiness

**METHODOLOGY READY / EXECUTION NOT READY FOR PUBLIC CLAIMS.**

`HARNESS-CAPABILITY-BENCHMARK-PROTOCOL.md` defines:

```text
RAW/MINIMAL
STANDARD COVERT
SYNCHRONIZED COVERT
```

with same model/task/acceptance/tools/timeout/context budget/evaluator,
fresh isolated task state, repeated runs, contamination controls, acceptance
equality, cost/resource separation, false-success measurement and system-before-
model attribution.

Metrics include accepted-task rate, cost/tokens/attempts/tool calls per accepted
task, recovery, regression, operator time, false-success, Harness-induced and
model-induced failure rates. A single green run or a model label cannot support
a ranking.

Harness Gain is defined as Standard minus Raw; Calibration Gain as Synchronized
minus Standard. Raw measurements remain available; neither is a release badge.

## 14. Security and Authority findings

The core invariant remains:

```text
INTELLIGENCE MAY PROPOSE
AUTHORITY PERMITS
HARNESS OBSERVES/ENFORCES ATTEMPT MECHANICS
VERITAS ACCEPTS
```

The current AgentLoop does not let a Skill or model directly manufacture the
HTTP Authority operation. However, the process boundary is weaker than the
operation boundary: inherited environment, descendants, ports, arbitrary
interpreters, timeout cleanup, and uncertain effects need future sealing.

The connection addendum adds a product security requirement, not a new
authority system. The existing candidate already has a partial Connections
view, direct provider adapters, DPAPI credential storage, egress journaling and
an OpenCode bridge that avoids credential-file scraping. The bounded required
product slice is documented in:

```text
MODEL-CONNECTION-PROVIDER-MATRIX.md
MODEL-CONNECTION-CONTRACT.md
MODEL-CONNECTION-UX.md
MODEL-CONNECTION-SECRET-THREAT-MODEL.md
MODEL-CONNECTION-IMPLEMENTATION-HANDOFF.md
```

Provider research conclusions are:

- OpenCode is a practical first delegated broker because its documented server
  exposes health/provider/auth/session surfaces and the candidate already has a
  narrow bridge.
- OpenAI API keys, ChatGPT/Codex account access, GitHub repository access and
  GitHub Copilot access are separate connection scopes.
- Hugging Face and ModelScope are primarily catalog/download sources in this
  design; acquisition must preserve revision, hash, license and attribution.
- Ollama is a local OpenAI-compatible runtime, not proof that every local model
  supports tools or reasoning controls.
- Anthropic API access is distinct from Claude subscription access. Unofficial
  subscription credential reuse is prohibited from this design; the current
  OpenCode provider documentation itself warns that Anthropic prohibits
  third-party plugins using Claude Pro/Max models.

The connection layer never stores raw secrets in Harness Sync evidence,
Provenance, Helix, Mission Receipts, logs, screenshots or support bundles.

## 15. Architecture recommendation

Use a sequence of narrow, owner-preserving boundaries:

### Slice A — sealed live attempt/admission

Create one immutable execution-envelope reference and durable attempt/admission
journal for the live AgentLoop mutation path. Do not implement a second
orchestrator or replace Authority. Bind existing Context Control, Skills,
Workflow, Model Router, Resource Admission and Authority references; record
effects/uncertainty; feed existing Provenance and Veritas.

### Slice B — Connection Center hardening

DeepSeek #1 should implement the documented Connection Center slice:

```text
existing connection projection
→ provider status
→ OpenCode delegated access
→ local runtime access
→ opaque credential ownership/reference
→ dynamic model discovery
→ user-facing Connections surface
→ Standard vs optional Harness Sync choice
→ resource-aware availability
```

This is an intended product requirement, not a speculative marketplace. It can
ship incrementally by connection class, but must use one provider-neutral
resolved worker contract and must not modify Authority/Harness semantics in the
same patch.

### Slice C — calibration proof

Only once Slice A can bind exact execution evidence:

```text
fingerprint one model/runtime
→ 8–10 fixed high-information probes
→ Capability Passport with unknowns
→ evidence-linked Synchronized Profile
→ frozen Standard runs
→ frozen Synchronized runs
→ identical Veritas acceptance comparison
```

### Slice D — synthesis analysis

Only after comparable verified history exists, add explainable analysis over the
canonical Provenance Ledger. It may project Planner/Coder/Reviewer evidence,
resource/cost dimensions, sample size, confidence, recency, and operator
override. It must not become a leaderboard, permission system, or autonomous
model swapper.

## 16. Risks of doing nothing

```text
uncertain mutations may be retried unsafely
crash recovery cannot prove what entered execution
model/system failures are misattributed
Skill and Harness improvements cannot be measured fairly
provider access stays expert-only and status can be misleading
Harness Sync would generate scientifically weak evidence
Cross-Model recommendations would confuse model quality with system/context changes
```

## 17. Risks of over-redesigning

```text
duplicating Authority or Veritas
turning Harness into a god object
importing historical H1/H2 as unreviewed production semantics
breaking the certified source candidate
forcing calibration before basic model use
scraping provider credentials or violating subscription terms
making cloud connectivity mandatory
creating a second provider registry/provenance ledger
lowering acceptance to make weaker models appear successful
building a marketplace before the execution truth boundary exists
```

## 18. Smallest coherent next slice

### Primary crown-jewel slice

**Seal one immutable execution envelope and durable attempt/admission journal
around the live AgentLoop mutation path.**

### Why this slice

It solves the highest-risk demonstrated gap and is a prerequisite for truthful
retry, failure attribution, Ghost Code observation replay, benchmark
comparability, Harness Sync, and Cross-Model Synthesis. It preserves accepted
P0/P1 boundaries by referencing existing owners rather than replacing them.

### Explicit acceptance criteria

```text
no mutation-capable dispatch without a sealed admission record
Authority operation references exact attempt/envelope
context/Skill/model/runtime/budget/resource facts are immutable for attempt
unknown effect blocks blind retry
retry/repair creates fresh attempt and fresh mutation permission
wrong-project/wrong-attempt evidence is rejected
standard and synchronized modes can share acceptance/evaluator
restart reconstructs the attempt state or marks it unresolved
append-only observations feed existing Provenance without a second ledger
adversarial tests cover partial admission, crash, duplicate, stale permit,
uncertain mutation, contamination and false-green test execution
```

### Rollback and risk

The slice should be behind an explicit integration boundary and be revertible
without changing existing Authority semantics. Its main risk is duplicate
truth if it introduces a second ledger; the design must therefore name the
existing canonical owner before implementation and migrate one live path at a
time.

### Connection productization slice

In parallel only after DeepSeek #1 accepts the handoff, the smallest connection
slice is the existing projection hardened with provider-neutral classes,
OpenCode delegated status, local runtime discovery, opaque credential owner
references, exact model discovery and resource-aware UI. It is not authorized
for implementation in this review; this document is the handoff.

## Addendum answers: Harness Sync and Cross-Model Synthesis

### Is Harness Sync justified?

Yes, as an optional operational calibration capability. It is practical only
after exact model/runtime/connection and sealed attempt/evidence identity exist.
It must never be mandatory for basic use or lower acceptance.

### Can it be short enough?

Likely. An 8–15 probe shape, with an initial ten-probe hypothesis, can provide
high information density if probes have fixed fixtures and independent
observers. It is a research starting point, not a promise of statistical
sufficiency for every model.

### Where do Passports and Profiles live?

Passport observations belong with the canonical model/provenance owner. A
Synchronized Harness Profile is a versioned derived projection with references
to Passport evidence. Neither belongs as a second Harness truth store.

### How are profiles invalidated?

Artifact/revision/hash, chat template, provider revision, adapter, Harness,
Context or Skill contract changes create explicit full/major/targeted
invalidation strata. Machine changes primarily invalidate resource/latency
observations. Old evidence remains versioned history and cannot silently
represent a new fingerprint.

### Can verified mission history refine them?

Yes, only when the mission is sealed, comparable, independently Veritas-
classified, versioned, and attributable to the same fingerprint/contract. One
mission cannot silently rewrite a profile. Proposed changes must show sample
count, uncertainty, recency and evidence.

### Where does Cross-Model Synthesis live?

As an analysis/projection layer over canonical Provenance and Veritas outcomes.
It is consumed by Model Router/Orchestrator as an explainable recommendation;
it is not Harness, Authority, Resource Admission, or Veritas.

### Can role recommendations be evidence-backed?

Yes, if they show comparable sample counts, accepted/attempted results,
confidence/variance, task archetype, Harness/Profile/Context/Skill versions,
resource compatibility, cost/latency and operator override. Otherwise the
answer is `INSUFFICIENT_EVIDENCE`.

### How do resource and cost constraints enter?

Keep acceptance, money, tokens, wall time, RAM/VRAM/CPU, repairs and operator
time as separate dimensions. Resource Admission decides safe feasibility;
analysis recommends among feasible choices. Local compute is not mislabeled as
zero cost.

### How is feedback-loop bias prevented?

Use high-confidence exploitation plus a bounded, operator-visible exploration
allowance on isolated low-risk tasks. Do not randomly route destructive or
security-sensitive work merely to collect data.

### Can Standard and Synchronized remain comparable?

Yes, if the task fixtures, model fingerprint, acceptance criteria, evaluator,
tool budget, timeout, isolation, and measurement contract are frozen. Only the
allowed Harness presentation/profile variables may differ.

### Smallest Sync proof

After the sealed-attempt slice: fingerprint one model, run a fixed 8–10 probe
battery, create an observation-only Passport, derive an evidence-linked Profile,
then compare frozen Standard and Synchronized runs under identical Veritas.
No automatic routing or team synthesis is required for the first proof.

## Required artifacts produced by this review

```text
HARNESS-REVIEW-BASE.md
HARNESS-CURRENT-REALITY.md
HARNESS-RESPONSIBILITY-MATRIX.md
HARNESS-ASSUMPTION-REGISTER.md
HARNESS-FAILURE-TAXONOMY.md
HARNESS-TRACE-MATRIX.json
HARNESS-ADVERSARIAL-SCENARIOS.json
HARNESS-GAP-MATRIX.json
HARNESS-VNEXT-CONTRACT.md
HARNESS-CAPABILITY-BENCHMARK-PROTOCOL.md
HARNESS-SYNC-ARCHITECTURE.md
CROSS-MODEL-SYNTHESIS.md
MODEL-CAPABILITY-PASSPORT.schema.json
SYNCHRONIZED-HARNESS-PROFILE.schema.json
MODEL-CONNECTION-PROVIDER-MATRIX.md
MODEL-CONNECTION-CONTRACT.md
MODEL-CONNECTION-UX.md
MODEL-CONNECTION-SECRET-THREAT-MODEL.md
MODEL-CONNECTION-IMPLEMENTATION-HANDOFF.md
```

## Final disposition

```text
HARNESS REVIEW: COMPLETE
CURRENT ARCHITECTURE: split; live AgentLoop + Authority with shadow Harness helpers
ADMISSIONLEDGER: PARTIALLY — historical shape, absent as certified authority
TOP STRUCTURAL GAP: no sealed durable execution-envelope/attempt boundary
CAPABILITY EXTRACTION: feasible through governed observation, not god-object behavior
GHOST CODE / REPLAY: observation replay partial; exact replay absent
BENCHMARK READINESS: methodology ready; execution/public claims not ready
CONNECTION CENTER: partial existing foundation; intended product slice handed off
HARNESS SYNC: architecturally justified; implementation depends on sealed evidence
CROSS-MODEL SYNTHESIS: coherent future analysis layer; no runtime implemented
IMPLEMENTATION AUTHORIZED: NO
```

## Addendum: Live Execution Observatory

### Product disposition

**Live Execution is an intended Covert product requirement.** The Resident is
the conversational front door, but the operator must be able to watch governed
engineering work as it occurs. This is not a UI activity-theater layer. It is a
canonical execution-event projection.

```text
Resident
→ mission
→ sealed attempt
→ canonical Harness/Authority/Resource/Veritas events
→ editor + terminal + workers + verification
→ Mission Receipt
```

The UI must show work without showing private chain-of-thought, hidden
reasoning tokens, credentials, authorization headers, unsafe prompts, or
unredacted sensitive environment data.

### Current reality

The candidate has AgentLoop source/status events, tool logs, trajectories,
Authority audit events, verification JSON and Provenance rows. They are useful
ingredients but not one ordered, mission/attempt-scoped, reconnectable event
stream. A frontend cannot currently prove that a displayed command, file
mutation, worker, model, test count or Veritas result is the canonical fact.

Therefore the current candidate does not support a truthful full Live Execution
surface without the sealed attempt/event boundary. The UI must not infer state
from random processes, spinners, timestamps, model claims or cached `RUNNING`
status.

### Canonical event ownership

The proposed event source is:

```text
Context / Skills / Workflow / Router facts
→ sealed execution envelope
→ Harness / Authority / Resource observations
→ Provenance/event projection
→ Live Execution UI
```

The event stream is a projection of canonical subsystem facts, not a second
ledger. Each event needs event ID/schema, mission/project/workflow/stage,
attempt lineage, monotonic sequence, timestamps, source owner, event kind, safe
payload, causal/evidence/Authority references and redaction status.

The UI may cache a snapshot and reconnect cursor. It may not write canonical
execution state.

### Required observable facts

The first-class projection must support, when actually observed:

```text
mission/stage and concurrency
worker role and actual model/provider/runtime
Standard vs Synchronized Harness/profile
Skill/SOP selection
resource decision and queue reason
file reads, writes, diffs and effect uncertainty
terminal command, cwd, bounded output, exit and duration
Authority request/result/consumption/denial
handoff, retry and repair lineage
test requested/discovered/executed counts
Veritas evidence and verdict
egress placement and credential owner reference
Mission Receipt readiness
```

Every visible fact must be traceable to canonical evidence. `COMPLETE` and
`VERIFIED` remain separate. A worker claim, exit code, process existence or
event count cannot create a green result.

### Pause and cancel

Pause/cancel are not frontend-owned process kills. They are governed requests
with explicit semantics for pending admission, active model calls, active
tools, partial mutations, verification and quiescence. If effect state becomes
uncertain, the attempt becomes `UNKNOWN` and blind continuation/retry is
blocked. No button should ship as operational until this contract is proven.

### Ghost Code and Mission Receipt

Live Execution and Ghost Code consume the same bounded execution facts. The
timeline supports observation/semantic replay where available; it never
promises deterministic replay of stochastic model reasoning or silently
re-executes mutations. A `MISSION_RECEIPT_READY` event must reference the same
attempt/evidence IDs shown in the timeline. A receipt and timeline that tell
different stories is a release defect.

### Performance and privacy

The transport needs snapshot-plus-cursor recovery, batching, backpressure,
bounded terminal output, diff virtualization, and separate durable evidence
from ephemeral rendering. Redaction happens before stream delivery and
persistence. A disconnected UI labels the last snapshot `STALE`/`UNKNOWN` and
never presents cached activity as current.

### Smallest observability proof

After the sealed attempt boundary exists, implement one real mission with:

```text
mission start
→ worker/model selected
→ Skill visible
→ actual file read/write and diff
→ actual terminal command/output
→ Authority result
→ test event with executed count
→ Veritas result
→ Mission Receipt
```

Acceptance is equality between each displayed fact and the canonical observed
fact. The required result is:

```text
SHADOW EXECUTION SEMANTICS: 0
```

The complete observability contracts are in:

```text
docs/harness/LIVE-EXECUTION-OBSERVABILITY.md
docs/harness/LIVE-EXECUTION-UX.md
```

The first implementation owner remains DeepSeek #1 for backend event emission,
streaming, redaction, Provenance/Authority/Veritas integration and lifecycle
semantics. Luna owns the UX contract, event requirements and independent
certification. No implementation was performed in this review.
