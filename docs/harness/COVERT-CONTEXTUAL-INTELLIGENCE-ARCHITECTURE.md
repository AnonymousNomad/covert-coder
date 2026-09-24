# Covert Contextual Intelligence Architecture Synthesis

Status: **ARCHITECTURE / RESEARCH ONLY — IMPLEMENTATION NOT AUTHORIZED**

This document evaluates Context Intelligence, Context Aperture, specialization,
Expert Cells, Working Memory, Harness Sync, and Capability Passport proposals
against the repository as it exists on the H3 line. It does not authorize H4,
runtime Working Memory, Expert Cells, a Context Compiler runtime, Harness Sync,
Cross-Model Synthesis, or a four-plane refactor.

## Review identity

| Item | Value |
| --- | --- |
| Repository | E:/aide-sovereign-workbench-harness |
| Branch | feat/harness-vnext-h3 |
| Starting SHA | 6c195e2f82c26ebf4e77d28e4416989f3a8f92c1 |
| H3 behavioral checkpoint | 993df08f09a7ba2bc61b249f88e1df79a8d7e9bd |
| Immutable certified source candidate | dc0d30ee226e7ff822592e3a800f064b4441b7af |
| H3 consolidation | 6c195e2 |
| H3 runtime semantics | FROZEN |
| Model Working Memory | NOT IMPLEMENTED |
| H4 | NOT AUTHORIZED |
| Implementation authorization | NO |

The certified candidate is historical evidence only. This report is documentation
on the post-candidate H3 line and must not be applied to the certified SHA.

## Evidence discipline

This report uses the following distinctions:

- FACT: present in code, contract, test, or accepted review evidence.
- INFERENCE: a conclusion from multiple facts, not a canonical contract.
- RECOMMENDATION: a proposed direction requiring authorization.
- OPEN QUESTION: unresolved; no assumption should fill it.

Disposition labels are:

EXISTS, PARTIAL, MISSING, DUPLICATE, CONFLICT, DEFER,
RESEARCH REQUIRED, and CANDIDATE.

## 1. Executive finding

### FACT

H3 provides a meaningful execution-truth foundation:

~~~text
sealed attempt envelope
durable admission boundary
attempt-local ordered events
cursor-based reads
redaction before persistence
attempt/project attribution
provenance linkage
~~~

The focused H3 battery is 20/20, contract/route coverage is 12/12, and the
handoff repair is 7/7. These are focused slice results, not a green architecture
or release gate. The broader regression remains non-green for the unrelated
baseline failure documented by the H3 consolidation.

### FACT

Covert already has most ingredients of contextual intelligence, distributed
across AgentLoop, Context Control providers, Workflow, Skills, Model Router,
Resource Admission, Authority, handoff, Provenance, and memory recall. It does
not yet have one canonical ContextManifest, one explicit Context Aperture
policy, or complete model/runtime/Skill attribution for every invocation.

### INFERENCE

The primary architectural gap is not a shortage of agents. It is the inability
to prove, in one comparable record, the exact operational world shown to a model
and the exact model/runtime that acted within it. Without that identity,
Resident-awareness experiments, Harness Sync, and Cross-Model Synthesis can
confuse context, adapter, runtime, and evaluator effects with model capability.

### RECOMMENDATION

Treat Context Intelligence as a capability/layer of the existing Context
Control boundary. Context Control should compile a bounded input; Harness should
bind it to an admitted attempt; Provenance should record the observation; Veritas
should judge the result. Do not create a parallel context service now.

If the Liquid experiment produces a verified gain, the smallest likely next
slice is a Context Manifest binding slice on one real path. If the experiment is
negative or inconclusive, preserve H3 and record that result rather than adding
orientation, Situation Frame, or Working Memory because they sound useful.

## 2. Current architecture map

| Area | Status | Repository evidence | Remaining boundary |
| --- | --- | --- | --- |
| Resident / AgentLoop | PARTIAL | node/src/services/agent-loop.mjs accepts task, role, worker, handoff and context providers; runs model/tool iterations. | Resident continuity and model execution are not one complete durable mission object. |
| Context Control | PARTIAL | node/src/services/chat-context.ts, AgentLoop providers, retrieval, memory recall, Workflow and handoff projection. | No first-class manifest for exact source order, exclusion, truncation, freshness and delivered-content identity. |
| orch-context | EXISTS, NARROW | node/src/services/orch-context.mjs reports hardware, engines and activity. | Operational snapshot, not a model-facing Context Compiler or Situation Frame. |
| Skills | EXISTS, PARTIAL | skills-loader.mjs provides bounded stage-aware selection and advisory payloads. | H3 does not yet bind exact Skill versions, hashes, references and rationale. |
| Workflow | EXISTS | common/contracts/workflow.ts defines stages, transitions, artifacts and obligations. | Workflow state is not the full execution envelope. |
| Orchestrator | PARTIAL | AgentLoop sequencing and orch-context coordinate work. | No explicit specialization decision contract or bounded Expert Cell policy. |
| Model Router | EXISTS, PARTIAL | model-router.ts resolves routes, roles, health and effective context fitting. | Runtime, adapter, artifact, configuration, reasoning use and provider result are not fully joined to attempts. |
| Resource Admission | EXISTS, PARTIAL | admission.ts and resource-admission.ts return START, QUEUE or REFUSE from probes. | No durable reservation, owner, expiry, settlement or attempt-bound lease. |
| Authority | EXISTS | Exact operation identity, scope, actor, risk, expiry and approval/consumption lifecycle. | Permits effects; does not select methodology, build context or certify completion. |
| Harness / H3 | EXISTS, PARTIAL | common/contracts/attempt.ts and AttemptJournal provide sealing, ordering, cursor reads and redaction. | Runtime/model/Skill/verification/resource truth remains partial. |
| Veritas | PARTIAL | Verification state and evidence references exist; live candidate path fails closed without requirement-bound proof. | Not every event, test count and Mission Receipt field is joined. |
| Provenance | EXISTS, PARTIAL | common/contracts/provenance.ts and the ledger record runs, evidence, trajectories and H3 stream references. | History/projection, not a replacement for the attempt journal or Passport database. |
| Helix | PARTIAL / designated owner | Project docs designate verified durable truth and memory/verification paths. | Exact promotion from every observation through Veritas is not one complete H3 contract. |
| Worker handoff | EXISTS, BOUNDED | worker-handoff.ts separates claims, verified facts, assumptions, questions, artifacts and evidence. | Continuity projection, not general Working Memory or admission. |
| Working Memory | PARTIAL INGREDIENTS | Memory recall, memory blocks, trajectory and bounded handoff context. | No first-class attempt-scoped explicit operational state with write attribution and retention. |
| Ghost / replay | PARTIAL | Trajectory/tool observations and metadata replay records. | Exact stochastic replay absent; semantic/observation replay incomplete. |
| Harness Sync / Passport | DESIGN ONLY | Existing docs and schemas define fingerprints, observations and derived profiles. | No runtime calibration, Passport store, profile derivation or synthesis pipeline. |

The detailed current trace is in HARNESS-CURRENT-REALITY.md. H3 evidence and
limitations are in HARNESS-H3-CONSOLIDATION.md.

## 3. Current execution reality

### Context

FACT: AgentLoop resolves Resident, memory, index, evidence, Skills and Workflow
providers in parallel and injects bounded advisory blocks. chat-context.ts has
separate context accounting and degradation fields. These are real controls, but
they are separate projections rather than one immutable model-input contract.

FACT: H3 binds a context identity/hash and block names before admission. The H3
review correctly marks context hash satisfied for the exercised path while
marking exact Skill provenance, runtime identity and complete verification
linkage partial or deferred.

### Models and routing

FACT: ModelRouter exposes local/cloud route identity, provider type, model
string, context length, chat-template label, roles, capabilities, health and
fitting behavior. The AgentLoop callback commonly consumes the result as text.
Actual adapter/runtime/configuration evidence is therefore not a complete Passport
observation.

### Resources

FACT: Resource Admission probes memory/VRAM/load and returns a decision. H3
records that decision, but no durable capacity reservation or settlement exists.
START is not proof that the worker stayed resource-admitted for the attempt.

### Permission, execution and acceptance

FACT: Authority decides whether an operation is permitted. Tool execution
observes effects. Veritas evaluates evidence. A model claim, Authority grant,
process exit code and Veritas verdict remain different facts.

## 4. Disposition of proposed concepts

| Concept | Disposition | Finding |
| --- | --- | --- |
| Context Intelligence | CANDIDATE / PARTIAL | Capability of Context Control, not a new authority or execution service. |
| Context Compiler | CANDIDATE / RESEARCH REQUIRED | A named Context Control layer may clarify ownership; a separate service is not justified. |
| ContextManifest | CANDIDATE | Most coherent missing input-binding contract, subject to Liquid evidence and owner review. |
| Context Aperture | CANDIDATE / PARTIAL | Selection policy and manifest section, not necessarily an independent subsystem. |
| Specialization Resolver | MISSING / CANDIDATE | Bounded Orchestrator policy is missing; model proposals remain untrusted data. |
| Expert Cell | DEFER / CANDIDATE | Future ephemeral attempt profile, not a new permission or execution engine. |
| Expert Profile Library | DEFER | No evidence justifies a new library before specialization is proven. |
| Model Working Memory | DEFER / REVIEW ONLY | Existing ingredients are partial; runtime waits for Liquid evidence and authorization. |
| Harness Sync | DESIGN ONLY / DEFER | Requires complete attempt, model and context evidence first. |
| Model Capability Passport | DESIGN ONLY / CANDIDATE | Evidence projection over canonical history, not a second provenance store or Helix truth. |
| Cross-Model Synthesis | DESIGN ONLY / DEFER | Comparable sealed attempts and Veritas outcomes are not yet complete. |
| Four-plane architecture | USEFUL LENS | Explains ownership; does not justify code reorganization. |
| Autonomous model/team routing | DEFER | Requires verified history, resource feasibility and explicit policy constraints. |

## 5. Ownership and boundary analysis

The following verbs must remain distinct:

~~~text
Context Control       COMPILES / SELECTS
Workflow              OWNS STAGE AND OBLIGATIONS
Skill Intelligence    SELECTS METHOD
Orchestrator          ASSIGNS AND DECOMPOSES
Model Router          RESOLVES A WORKER/RUNTIME CANDIDATE
Resource Admission    ADMITS RESOURCE FEASIBILITY
Authority             PERMITS EFFECTS
Harness               BINDS, EXECUTES, OBSERVES, RECORDS
Provenance            RECORDS ATTRIBUTABLE HISTORY
Veritas               ACCEPTS OR REJECTS AGAINST EVIDENCE
Helix                 PRESERVES VERIFIED DURABLE TRUTH
Resident              MAINTAINS OPERATOR CONTINUITY AND INTERPRETATION
~~~

### Context Control versus Harness

FACT: H3 binds a context hash but does not construct context. Existing
providers and chat-context.ts already own much of the selection/projection work.

RECOMMENDATION: A Context Compiler, if named, should be a Context Control
component or layer. It emits a ContextManifest before sealing. Harness binds its
identity and references and rejects material drift; it does not retrieve more
project truth or widen the aperture after sealing.

### Orchestrator versus specialization

RECOMMENDATION: The specialization decision belongs at the Orchestrator
boundary. It decides whether the objective needs a Skill, retrieval,
deterministic tool, Workflow, existing Worker or ephemeral Expert Cell.
Context Control informs it; Model Router and Resource Admission constrain it.

The model, Resident or worker may propose specialization, but that proposal
cannot create a process, grant a capability or bypass Authority.

### Resource Admission versus quality

Resource Admission answers whether a selected configuration can run safely now.
It must not decide which model is most capable. Passport/Synthesis may inform
selection; Resource Admission still checks machine and provider feasibility.

### Authority versus aperture

An aperture may list relevant tool/capability descriptions. It must not grant
them. Visibility is not permission.

### Veritas versus Harness

Harness records what was admitted, requested, executed and observed. Veritas
decides whether evidence satisfies acceptance. Neither a sealed attempt nor an
event stream is a verification verdict.

## 6. Context Intelligence and ContextManifest

### Status: PARTIAL / CANDIDATE

Naming Context Intelligence is useful only if it clarifies that existing
Context Control inputs are compiled into a bounded, attributable package. It
must not become a retrieval engine, memory store, Workflow, Skill selector or
Helix truth owner.

### Minimal ContextManifest candidate

This is design-only; it is not a runtime schema.

| Group | Candidate contents | Classification |
| --- | --- | --- |
| Identity | schema version, manifest ID, project/mission/workflow/stage refs, created time, freshness/expiry | REQUIRED where canonical owners provide values |
| Invocation | worker role, selected model fingerprint, objective ref, attempt ref when binding | REQUIRED for attribution; UNKNOWN is valid before resolution |
| Situation | verified facts, retrieved artifact/fact refs, observations, hypotheses, unknowns, stale markers | CANDIDATE |
| Method | Workflow obligations, Skill IDs/versions/hashes, projection depth and rationale | REQUIRED for future Skill experiments; currently PARTIAL |
| Aperture | included sources, reasons, sensitivity/egress class, ordering, truncation and exclusion summary | REQUIRED for reproducibility |
| Capability surface | relevant tool/capability descriptors and candidate limit, without grants/secrets | CANDIDATE |
| Authority surface | operation/decision references, never credentials or substitute permits | REFERENCE ONLY |
| Resource view | resource/admission reference and machine profile where relevant | REFERENCE ONLY |
| Acceptance | acceptance and verification requirement references | REQUIRED before claims are judged |
| Evidence/provenance | artifact, evidence and canonical history refs | REFERENCE ONLY |
| Accounting | context estimate/actual where available, degradation state and hash | DERIVED / REQUIRED when measured |

Prefer references and digests over copying files, secrets, transcripts or private
chain-of-thought. UNKNOWN, NOT_RECORDED and STALE are valid states.

### Candidate lifecycle

~~~text
canonical owners expose facts
        ↓
Context Control selects relevant sources and applies an aperture
        ↓
Context Control emits a versioned ContextManifest
        ↓
Model Router / Orchestrator resolve the invocation
        ↓
Harness binds manifest digest and references before admission
        ↓
model receives the bounded projection
~~~

If model selection changes material context, create a new manifest/attempt
rather than silently changing a sealed one. A two-pass route (coarse selection,
then exact model-aware compilation) is an open question, not a reason to add a
second router now.

## 7. Context Aperture model

### Status: CANDIDATE / PARTIAL

The aperture is best treated as a policy attached to the ContextManifest. It
records why a category is visible, how much can enter, how fresh it must be, and
whether it may cross an egress boundary.

~~~text
ContextBlockCandidate {
  category: FACT | ARTIFACT | WORKFLOW | SKILL | CAPABILITY | AUTHORITY_REF |
           MEMORY_REF | EVIDENCE_REF | UNKNOWN
  source_ref
  content_or_digest
  inclusion_reason
  freshness
  sensitivity
  egress_class
  budget_cost
  order
  truncation
  excluded_reason
}
~~~

Conceptual rules:

1. Possession by Covert is not a reason for inclusion.
2. Every included source has an owner and reason.
3. Facts, observations, hypotheses and unknowns remain distinct.
4. Skills and capability descriptions are bounded projections, not trust grants.
5. Authority information is a permission-state reference, not a hidden token.
6. Material context change produces a new bound input/attempt.
7. Exclusion, truncation and degradation are observable.
8. Egress classification is preserved before remote execution.
9. The aperture cannot promote memory, worker claims or model output into Helix.

The aperture must not solve pressure through indiscriminate summarization.
Selection, ordering, freshness and explicit unknowns matter as much as token
count.

## 8. Specialization Resolver and Expert Cells

### Specialization Resolver: MISSING / CANDIDATE

No current contract decides among procedural expertise, retrieval,
deterministic tooling, Workflow, an existing Worker or a new narrow reasoning
attempt. That choice is distributed across prompts, AgentLoop, routing and
handoff.

The future resolver should be a bounded Orchestrator policy using this decision
aid, not a mandatory cascade:

~~~text
known method                 → Skill
missing fact                 → Context retrieval
exact repeatable operation   → Tool
known multi-stage obligation → Workflow
independent narrow reasoning → Expert Cell candidate
long-lived responsibility    → Worker candidate
risky side effect            → Authority request
claim of correctness         → Veritas evaluation
~~~

It must reject “create another agent” when a Skill, fact, tool or Workflow is
sufficient and should record why a cell was not selected.

### Expert Cell: DEFER / CANDIDATE

An Expert Cell is more coherently an ephemeral narrow specialization contract
executed through the existing Worker/Attempt path, not a permanent identity or
second execution engine.

Candidate contract:

~~~text
ExpertContract {
  contract_id
  parent_mission_id
  parent_attempt_id or workflow_ref
  purpose_and_independent_question
  role
  model/runtime selection or constraint
  context_aperture_ref/hash
  Skill/SOP refs and versions
  capability descriptors
  resource budget and expiry
  Authority scope reference
  acceptance contract and return schema
  lineage: proposed_by / approved_by / created_attempt_id
  result/evidence references
  non_canonical: true
}
~~~

The contract is proposed as data, validated by the Orchestrator, checked by
Resource Admission, compiled by Context Control, permitted by Authority where
needed, sealed by Harness, and judged by Veritas. A cell returns a structured
result rather than raw history by default.

| Concept | Distinction |
| --- | --- |
| Skill | Reusable methodology; no independent model execution. |
| Workflow | Stateful stages and obligations; not one specialist attempt. |
| Worker | Execution participant/identity; a cell is narrower and disposable. |
| Handoff | Bounded continuity; does not create a specialist or permission. |
| Tool | Deterministic operation; does not independently reason. |
| Expert Cell | Narrow isolated reasoning attempt reusing existing execution truth. |

An Expert Profile Library is future metadata, not an authority-bearing agent zoo.

## 9. Working Memory and H3 event truth

### Status: PARTIAL INGREDIENTS / NOT IMPLEMENTED

Memory recall, memory blocks, AgentLoop trajectory, Worker handoff and
Provenance references are useful ingredients. They do not form a canonical
Model Working Memory / Attempt Sandbox.

The separation is:

~~~text
Working Memory  = explicit temporary operational state / hypotheses
Provenance      = attributable history
Event Stream    = ordered runtime facts
Veritas         = independent acceptance
Helix           = verified durable project truth
~~~

H3 can support future memory without making it canonical through stable
attempt/mission/project identity, ordered observations and evidence references:

~~~text
mission → attempt → action/observation → artifact/evidence
        → verification → claim eligibility
~~~

No new memory store or event vocabulary should be added in this review. If
later justified, memory should be an attempt-scoped state artifact referenced by
events, not large state embedded in scalar event payloads.

### Later ownership candidate

~~~text
Context Control  selects and projects working state
Harness          owns attempt-scoped lifecycle/isolation enforcement
Provenance        records writer/reference and time
Veritas           may evaluate it as evidence, never automatic truth
Helix             receives only normal verified promotion
Resident          interprets it; does not canonize it
~~~

Non-promotion invariants:

- Persistence never turns a model hypothesis into a verified fact.
- Memory cannot grant Authority, advance Workflow or change acceptance.
- A worker cannot inherit another worker's raw sandbox without a bounded handoff.
- Context refresh is visible and versioned inside a mission.
- Secrets and hidden reasoning are rejected or redacted.
- Cleanup and retention are deterministic and scoped.

## 10. Harness Sync and Capability Passport

### Status: DESIGN ONLY / CANDIDATE

HARNESS-SYNC-ARCHITECTURE.md, the Passport schema, the Profile schema and
CROSS-MODEL-SYNTHESIS.md already establish a coherent conceptual split:

~~~text
Passport  = attributable empirical observations
Profile   = derived policy projection with lineage
~~~

Neither is implemented in the current runtime.

Future observations need:

~~~text
model/provider/revision
artifact hash where local
runtime/version/adapter/chat template
machine/resource class
Harness and profile versions
ContextManifest/Aperture version and hash
Skill versions/hashes and projection depth
tool/capability set
task/role/archetype/workflow stage
attempt and mission IDs
acceptance/verification contract
raw outcome and failure classification
sample/confidence/limitations
~~~

Model-intrinsic behavior must be separated from machine/runtime behavior.
Unknown token, cost or reasoning data remains unknown.

A Synchronized Profile may recommend context density, Skill projection, tool
candidate limits, decomposition, reasoning budget or bounded repair. It may not
change Authority, isolation, acceptance, Veritas, evidence requirements or the
false-success policy. Every policy field needs an observation reference and
derivation version.

### Current instrumentation gaps

| Signal | Current status | Classification |
| --- | --- | --- |
| Model/runtime fingerprint | Requested fields exist; runtime/artifact/adapter capture incomplete | NEEDED LATER |
| Context identity | H3 hash/block identity exists; source/order/truncation manifest incomplete | NEEDED LATER |
| Skill identity | Bounded selection exists; exact runtime attribution incomplete | NEEDED LATER |
| Capability aperture | Tool registry exists; per-attempt exposure incomplete | NEEDED LATER |
| Reasoning/budget | Iteration/context bounds exist; provider reasoning/cost partial | NEEDED LATER |
| Independent acceptance | Veritas/evidence path exists but live acceptance limited/negative | NEEDED LATER |
| Attempt isolation | H3 attempt/project checks exist; process/temp/port isolation partial | NEEDED LATER |
| Resource/cost | Probe and timing exist; reservation/comparable cost partial | NEEDED LATER |
| Passport persistence | Conceptual schema only | ABSENT |
| Profile derivation | Conceptual schema only | ABSENT |

The first scientific comparison should use the same model, frozen task,
acceptance, and machine: Standard versus Synchronized. Raw/minimal is a
separate arm. No unsealed or unverified history should feed recommendations.

## 11. Four-plane architecture evaluation

The four-plane view is useful as a lens, not a code reorganization.

| Plane | Maps cleanly | Boundary warning |
| --- | --- | --- |
| Intelligence | Resident, workers, Model Router, future cells | Resident also communicates context and workflow; it is not isolated from control. |
| Context | Context providers, chat-context, Skills, Workflow projections | Memory, Helix and Provenance references have different truth classes. |
| Control | Workflow, Orchestrator, Resource Admission, Authority | Current Orchestrator ownership is distributed; Resource Admission is a probe, not a full control plane. |
| Execution / Truth | H3, tools/runtime, Provenance, Veritas, Receipt, Helix | These are deliberately different boundaries and must not become one truth object. |

## 12. Capability extraction diagnosis

FACT: Covert already has bounded Skills, Workflow stages, role routing,
Authority, Resource Admission and H3 attempts. It can extract more reliable work
without making every task multi-agent.

INFERENCE: It currently lacks a decision point that asks whether the missing
ingredient is a method, fact, deterministic action, independent reasoning path,
or persistent worker responsibility.

RECOMMENDATION: Optimize for the least machinery that crosses the same
acceptance boundary:

~~~text
objective
→ classify missing support
→ compile only justified context/capabilities
→ select existing worker or narrow cell only if independent reasoning helps
→ admit resources
→ permit effects
→ seal attempt
→ observe
→ verify
~~~

Maximum scaffolding is not maximum capability.

## 13. Liquid Resident experiment dependency

### Status: IN PROGRESS / NO FINAL EVIDENCE

The Resident-awareness experiment was still active during this review. Partial
process/log output is not a result and is not used to justify architecture
change. RESIDENT-AWARENESS-INTEGRATION-GATE.md remains authoritative.

The final evidence package must compare the same model/runtime and task conditions
with and without treatment and report:

~~~text
verified task success
false-success behavior
tool-selection quality and unnecessary use
context confusion and repeated rediscovery
operator intervention
iteration count
token/context use
handoff quality
unsupported claims
recovery behavior
sample count, failures and limitations
~~~

### Conditional gate

| Result | Disposition |
| --- | --- |
| Operational orientation improves verified outcomes | Evaluate a versioned orientation/capability projection owned by Context Control and bound by H3. Do not add Working Memory automatically. |
| Situation Frame improves verified outcomes | Define constructor, schema owner, validator, freshness, hash and attempt binding before implementation. |
| Scoped Working Memory adds value beyond frame/envelope | Activate the review-only Attempt Working State design; start with one typed bounded contract. |
| No meaningful improvement | Preserve H3; do not implement these mechanisms. |
| Mixed/inconclusive | INCONCLUSIVE — NO ARCHITECTURE CHANGE; seek a narrower experiment only if authorized. |

The result must establish acceptance improvement, not fluency or model
self-description.

## 14. Benchmark readiness

### Status: PARTIAL / NOT READY FOR PUBLIC CLAIMS

The existing benchmark protocol is directionally correct, but the repository
does not yet provide all controls for a defensible Raw/Standard/Synchronized
experiment.

Remaining controls:

1. Exact model/runtime/artifact/template capture.
2. Immutable ContextManifest/Aperture identity, including exclusions and
   degradation.
3. Exact Skill and capability projection identity.
4. Clean attempt/worktree/process/temp/port isolation.
5. One acceptance evaluator with evidence linkage.
6. Battery integrity proving requested tests were discovered and executed.
7. Comparable token, latency, cost and resource observations.
8. Repair, handoff, restart and uncertain-mutation lineage.
9. Pre-registered taxonomy, repeats, confidence and exploration policy.
10. Long-horizon and failure-injection fixtures reset to one repository state.

H3 is necessary substrate, not proof that these controls are complete.

## 15. Risk analysis

### Risk of doing nothing

- Model failures remain confounded with context, adapter, runtime and evaluator failures.
- Context pollution or missing facts cannot be measured precisely.
- Harness Sync and model recommendations become folklore.
- Resident awareness cannot be tied to exact inputs.
- Expert Cell work could start without isolation or lineage.

### Risk of over-redesigning

- A Context Compiler becomes a second Context Control Engine.
- Harness becomes a god-object that builds prompts, chooses models, grants permission and verifies itself.
- Expert Cells create unbounded fan-out and resource starvation.
- Working Memory becomes shadow Helix or a private transcript store.
- Passport/Synthesis becomes a version-blind leaderboard.
- More scaffolding reduces model performance.
- Parallel event/provenance stores disagree.

Security invariants remain:

~~~text
intelligence proposes; Authority permits
context visibility is not permission
memory persistence is not truth
event observation is not acceptance
acceptance is not automatic Helix promotion
cell creation is not arbitrary process creation
Passport evidence contains no credentials or hidden reasoning
remote context follows egress policy
~~~

## 16. Explicitly deferred

~~~text
Context Compiler runtime or separate service
Context Aperture runtime policy
Model Working Memory / Attempt Sandbox runtime
Expert Cell runtime and unrestricted specialization
Expert Profile Library
Harness Sync runner
Model Capability Passport persistence
Synchronized Profile derivation
Cross-Model Synthesis service
automatic role/team recommendations
model packs and autonomous swapping
Capability Fabric runtime
delegation runtime
full Live Execution frontend
four-plane code reorganization
~~~

Existing design documents remain research artifacts; this synthesis does not
promote them to implemented contracts.

## 17. Recommended next slice after Liquid

### Preferred conditional slice: Context Manifest Binding

If Liquid produces a reproducible verified benefit from situation/operational
projection, the smallest coherent implementation slice is:

~~~text
one Context Control producer
→ one versioned bounded ContextManifest
→ one real AgentLoop path
→ existing H3 envelope binds manifest hash/references
→ event/provenance projection records the binding
→ same-mission treated/untreated acceptance comparison
~~~

It must not include Expert Cells, Working Memory persistence, new Authority or
Veritas semantics, model-router replacement, or a full Context Compiler service.

### Conditional alternative: Attempt Working State

Only if Liquid shows scoped explicit state is necessary beyond the manifest and
handoff, the smallest alternative is one attempt-scoped typed state contract
with bounded size/retention, attributable writes, redaction, isolation,
read-only Context Control projection, and no automatic Veritas/Helix promotion.

### Negative or inconclusive

No new slice should start solely from the hypothesis. Preserve H3, record the
result, and identify the next experiment.

## 18. Evidence required before authorization

1. Final Liquid package with fixed conditions, fingerprint, tasks, acceptance,
   sample count, raw outcomes and limitations.
2. Verified acceptance delta, not subjective fluency or model self-report.
3. Explicit owner for every field and decision.
4. Schema review proving no duplicate truth store and no silent H3 change.
5. Adversarial tests for project leakage, stale context, drift, secrets,
   prompt-injection data, wrong-attempt evidence, Authority bypass and failed
   verification.
6. One real-mission proof using canonical facts, not a synthetic event fixture.
7. Rollback that leaves H3 and existing Context Control intact.
8. Measurement plan for context cost, latency, resource impact and attribution.
9. Explicit UNKNOWN, NOT_RECORDED, STALE and INSUFFICIENT_EVIDENCE states.
10. Independent review by the affected canonical-lane owner.

## 19. Required question answers

1. **What already exists?** Bounded context providers, Workflow stages, Skills,
   routing, resource probes, Authority, H3 events, Provenance, handoff and
   partial memory/replay.
2. **What is partial?** Context identity/content accounting, Skill provenance,
   model/runtime fingerprinting, resource reservation, evidence joining,
   failure attribution, replay and all Passport/Sync behavior.
3. **What is missing?** A canonical ContextManifest/Aperture contract, explicit
   specialization decision record, complete observed invocation identity,
   empirical Passport pipeline and comparable outcome bridge.
4. **What duplicates current systems?** A separate Context Compiler would
   duplicate Context Control; broad Working Memory would duplicate recall,
   handoff and trajectory; Passport as history would duplicate Provenance;
   Expert Cell as an engine would duplicate Worker/Attempt.
5. **What conflicts?** Harness building project context, cells granting
   permission, Passport becoming Helix truth, model output creating Authority,
   or Veritas embedded in the worker.
6. **Where should Context Intelligence live?** As a Context Control
   capability/layer, with canonical fact owners retained.
7. **Component, service, layer or capability?** Current evidence supports a
   Context Control component/layer, not a separate service.
8. **Minimal ContextManifest?** Versioned identity/hash, scope, objective,
   truth-classed situation, source refs, Workflow obligations, Skill identity,
   aperture, acceptance/verification refs, freshness/degradation, accounting.
9. **How should Aperture interact?** It selects bounded views; Skills provide
   method; tools provide descriptions; Helix provides eligible verified facts;
   memory is future projection; Authority and Veritas remain separate.
10. **Where is Specialization Resolver?** Orchestrator boundary, constrained by
    Workflow, Skills, Model Router, Resource Admission and Authority.
11. **How do Expert Cells differ?** Ephemeral narrow evidence-producing attempts
    with isolated aperture and return contract; not Skills, Workers, Authority or
    Veritas.
12. **How can H3 support memory?** Stable IDs, ordered observations and
    references; future memory is typed state, not event truth.
13. **What supports Passports?** Fingerprint, context/Skill/tool/Harness
    versions, sealed attempt, task/role/archetype, raw metrics, Veritas result,
    failure class, resource/cost and confidence.
14. **What instrumentation is missing?** Runtime/config capture, manifest
    source/order/exclusion identity, Skill/capability identity, test counts,
    process isolation, repair lineage, reservations and cost.
15. **What is deferred?** Everything in section 16, especially Working Memory,
    Expert Cells, Context Compiler service, Sync and Synthesis.
16. **Smallest next slice?** Conditionally, one Context Manifest producer bound
    to H3 and proven on one real mission; otherwise no slice.
17. **What evidence is required?** Final Liquid result, verified delta,
    ownership/schema review, adversarial tests, real-mission proof, measurement,
    rollback and independent lane review.
18. **Final disposition?**

~~~text
MODEL WORKING MEMORY: NOT IMPLEMENTED
H4: NOT AUTHORIZED
IMPLEMENTATION AUTHORIZED: NO
~~~

## 20. Evidence inspected

Architecture and accepted review artifacts:

~~~text
docs/harness/HARNESS-CURRENT-REALITY.md
docs/harness/HARNESS-H3-CONSOLIDATION.md
docs/harness/HARNESS-VNEXT-CONTRACT.md
docs/harness/HARNESS-RESPONSIBILITY-MATRIX.md
docs/harness/HARNESS-GAP-MATRIX.json
docs/harness/HARNESS-TRACE-MATRIX.json
docs/harness/HARNESS-ASSUMPTION-REGISTER.md
docs/harness/HARNESS-CROWN-JEWEL-REVIEW.md
docs/harness/RESIDENT-AWARENESS-INTEGRATION-GATE.md
docs/harness/HARNESS-SYNC-ARCHITECTURE.md
docs/harness/CROSS-MODEL-SYNTHESIS.md
docs/harness/MODEL-CAPABILITY-PASSPORT.schema.json
docs/harness/SYNCHRONIZED-HARNESS-PROFILE.schema.json
docs/harness/HARNESS-CAPABILITY-BENCHMARK-PROTOCOL.md
docs/harness/LIVE-EXECUTION-OBSERVABILITY.md
docs/harness/LIVE-EXECUTION-UX.md
~~~

Implementation and contract evidence:

~~~text
common/contracts/attempt.ts
common/contracts/admission.ts
common/contracts/authority.ts
common/contracts/provenance.ts
common/contracts/workflow.ts
common/contracts/worker-handoff.ts
common/contracts/agent.ts
node/src/services/agent-loop.mjs
node/src/services/attempt-journal.ts
node/src/services/chat-context.ts
node/src/services/orch-context.mjs
node/src/services/model-router.ts
node/src/services/resource-admission.ts
node/src/services/worker-handoff.ts
node/src/services/skills-loader.mjs
node/src/services/execution-authority.mjs
node/src/routes/agent.ts
node/src/openapi.ts
~~~

These references support findings; they do not claim that future contracts exist.

## Final disposition

~~~text
ARCHITECTURE SYNTHESIS: COMPLETE
H3 SEMANTICS CHANGED: NO
MODEL WORKING MEMORY: NOT IMPLEMENTED
LIQUID AWARENESS: IN PROGRESS / FINAL EVIDENCE NOT AVAILABLE
H4: NOT AUTHORIZED
IMPLEMENTATION AUTHORIZED: NO
~~~

## 21. Final research-integration addendum

This addendum incorporates the final research findings without changing the
prior ownership decisions or authorizing implementation.

### 21.1 Specification Acquisition

#### FACT

The repository has several sources of task-local correctness information:

- Workflow stages, artifacts and obligations in common/contracts/workflow.ts.
- Agent objective/task and acceptance/verification placeholders in
  common/contracts/agent.ts and common/contracts/attempt.ts.
- Skill/SOP descriptions and stage-aware selection in skills-loader.mjs.
- Bounded handoff fields for verified facts, claims, assumptions, constraints,
  open questions, artifacts and evidence in worker-handoff.ts.
- Authority operation scope and risk rules.
- Veritas and failure-taxonomy documentation.
- Project retrieval, memory and evidence providers in AgentLoop and
  chat-context.ts.

These are not one unified specification acquisition contract. In particular,
repository conventions, negative requirements, completeness conditions and
local architecture invariants may be present in Skills, Workflow artifacts or
documentation without being versioned as one attempt-bound specification.

#### INFERENCE

Content acquisition and specification acquisition are different operations:

~text
CONTENT ACQUISITION
Which files, facts, artifacts and observations are relevant?

SPECIFICATION ACQUISITION
Which local rules determine what correct means here?
~

A complete file set does not prove that the model has the local acceptance rules.
A specification may also constrain what must not be changed, not merely what
should be produced.

#### RECOMMENDATION

Add a bounded Local Specification section to a future ContextManifest rather
than creating a persistent specification service. The section should contain
references and digests where possible:

~text
LocalSpecification {
  identity/version/hash
  source references and source revisions
  architectural invariants
  repository conventions
  format and compatibility requirements
  completeness conditions
  negative requirements and forbidden mutations
  behavioral obligations
  acceptance/verification references
  unknown or unresolved specification items
}
~

Context Control compiles the section from canonical owners. It does not invent
rules from model preference. Workflow owns stage obligations, Skills own
methodology, Authority owns permitted effects, Veritas owns acceptance, and
project/Helix sources own eligible verified facts.

#### STATUS TABLE

| Candidate concern | Existing source | Disposition |
| --- | --- | --- |
| Objective | Agent task and H3 envelope objective | EXISTS, but mission-level identity can remain partial |
| Workflow obligations | Workflow contract and stage projection | EXISTS / PARTIAL projection |
| Acceptance requirements | Attempt marker and Veritas/failure contracts | PARTIAL |
| Repository conventions | Skills, project retrieval and documentation | PARTIAL, no unified digest |
| Architectural invariants | Doctrine/Skills/docs and selected contracts | PARTIAL, not attempt-bound |
| Negative requirements | Authority/tool restrictions and Skill stop conditions | PARTIAL |
| Completeness conditions | Veritas/evidence policy where configured | PARTIAL |
| LocalSpecification identity/hash | No current manifest field | MISSING / CANDIDATE |
| Separate specification service | No evidence of need | DUPLICATE / DEFER |

An explicit field is preferable to hiding normative rules inside verified_facts.
Facts describe the world; a LocalSpecification describes the rules by which the
world and result are judged. The two may reference the same source but must not
be conflated.

### 21.2 System Uncertainty

#### FACT

Current contracts already represent several uncertainty forms:

- UNKNOWN, NOT_RECORDED and NOT_APPLICABLE markers in attempt.ts.
- CONTEXT_DRIFT and RECOVERY_CLASSIFIED H3 events.
- UNKNOWN effect certainty and RECOVERED_UNCERTAIN /
  RECOVERED_MUTATED_UNVERIFIED attempt states.
- failure taxonomy entries for missing lifecycle/evidence/cleanup facts.
- handoff assumptions, open questions and unknown side effects.
- provider/resource/verification states that can be unavailable or incomplete.

There is no single aggregate system uncertainty state that explains why current
knowledge is unsafe to rely upon.

#### INFERENCE

Worker-reported confidence is not an authoritative uncertainty signal. A
worker can be confident while the system has stale context, contradictory test
evidence, missing provenance, or an unknown side effect. Conversely, a worker's
uncertainty can be useful evidence without being a system verdict.

#### RECOMMENDATION

A future ContextManifest/Situation Frame may contain a non-canonical
Uncertainty State, derived from observable conditions:

~text
UncertaintyState {
  status: CLEAR | QUALIFIED | BLOCKING | UNKNOWN
  dimensions:
    - unverified_assumption
    - contradictory_evidence
    - missing_provenance
    - verification_disagreement
    - failed_recovery
    - dependency_unknown
    - specification_incomplete
    - resource_uncertainty
    - stale_context
    - effect_uncertainty
  source references
  freshness
  blocking reasons
}
~

This is a knowledge-state projection, not a confidence score and not an
acceptance verdict. Each source retains authority over its own fact. Harness
can record observed uncertainty; Context Control can project it; Orchestrator
can use it to pause or request a new attempt; Veritas can refuse to accept
insufficient evidence. No uncertainty state can promote or demote Helix truth
by itself.

The aggregate must not hide the dimension that caused it. A single HIGH number
would be insufficient for recovery and would invite false precision.

### 21.3 Early epistemic-failure signals

#### FACT

H3 already records facts that can support early divergence analysis:

~text
CONTEXT_BOUND / CONTEXT_DRIFT
MODEL_REQUEST_STARTED / MODEL_RESPONSE_RECEIVED
ACTION and TOOL request/permit/start/observation events
FILE_READ / FILE_MUTATION_OBSERVED / EFFECT_UNCERTAIN
COMMAND_STARTED / COMMAND_OBSERVED
VERIFICATION_STARTED / VERIFICATION_RESULT
RECOVERY_CLASSIFIED
~

The existing failure taxonomy also explicitly requires upstream context,
adapter, workflow, Authority, execution and evaluator causes to be excluded
before assigning a model failure.

#### INFERENCE

The current stream is sufficient as raw evidence for some deterministic
signals, but not sufficient to prove a worker's hidden belief state. “Ignored
tool output” and “reasoned from an assumption” are not directly observable
unless the relevant claim/action and evidence references are captured.

#### RECOMMENDATION

Begin with a derived diagnostic analyzer over canonical events and observable
claims, not another continuously running reviewer agent. Candidate signals:

| Signal | Evidence pattern | Safe interpretation |
| --- | --- | --- |
| Contradictory evidence followed by continued mutation | failing/contradictory observation followed by mutation without a new accepted attempt or explicit repair | DIVERGENCE_SUSPECTED |
| Repeated identical recovery | same failure class, hypothesis/reference and action shape across a bounded chain | RECOVERY_LOOP_SUSPECTED |
| Claim/file mismatch | attributable claim conflicts with current canonical file/effect observation | CLAIM_OBSERVATION_MISMATCH |
| Stale context use | CONTEXT_DRIFT or expired source used after refresh boundary | STALE_CONTEXT_RISK |
| Missing specification | attempt reaches acceptance with unresolved required specification items | SPECIFICATION_GAP |
| Tool-result ambiguity | tool started but terminal effect/result is unknown | EFFECT_UNCERTAINTY |

These are diagnostic observations. They must not emit ATTEMPT_ACCEPTED, a Veritas
verdict or Helix truth.

Ownership should remain layered:

- Harness telemetry derives signals from event/effect facts.
- Orchestrator consumes signals when selecting recovery.
- Context Control may refresh or rebuild a manifest when a typed signal says it
  is stale or incomplete.
- Veritas uses relevant signals as preconditions/evidence quality, not as a
  substitute for verification.

The first implementation, if ever authorized, should be deterministic event
analysis with explicit false-positive handling. No model-generated reviewer is
required by this finding.

### 21.4 Diagnosis-specific recovery

#### FACT

The proposed classes substantially overlap existing repository contracts. The
canonical HARNESS-FAILURE-TAXONOMY.md already includes DISCOVERY_FAILURE,
CONTEXT_FAILURE, CONTRACT_FAILURE, SOP_FAILURE, SCHEMA_FAILURE,
WORKFLOW_FAILURE, ORCHESTRATION_FAILURE, MODEL_FAILURE, ADAPTER_FAILURE,
AUTHORITY_FAILURE, RESOURCE_FAILURE, EXECUTION_FAILURE, TOOL_FAILURE,
VERIFICATION_FAILURE, HARNESS_FAILURE, EVALUATOR_FAILURE and RUNTIME_FAILURE.
common/contracts/continuation.ts separately includes transport, provider,
runtime, timeout, output, context, handoff, verification, authority and
operator failure classes.

#### RECOMMENDATION

Do not create a second top-level failure enum. Extend the existing taxonomy
through evidence-bearing subreason/diagnostic dimensions if a later contract
requires the new distinctions:

| Research label | Existing owner/classification |
| --- | --- |
| MISSING_CONTEXT | CONTEXT_FAILURE or DISCOVERY_FAILURE |
| MISSING_SPECIFICATION | CONTEXT_FAILURE / SOP_FAILURE / VERIFICATION precondition; candidate subreason |
| INVALID_ACTION | AUTHORITY_FAILURE, TOOL_FAILURE or EXECUTION_FAILURE |
| TOOL_FAILURE | Existing TOOL_FAILURE |
| RESOURCE_FAILURE | Existing RESOURCE_FAILURE |
| AUTHORITY_DENIAL | Existing AUTHORITY_FAILURE |
| FAILED_ASSUMPTION | Context/Workflow/Orchestration/SOP; model only after exclusions |
| FORMAT_VIOLATION | SCHEMA_FAILURE or INVALID_OUTPUT |
| VERIFICATION_FAILURE | Existing VERIFICATION_FAILURE |
| DEPENDENCY_FAILURE | CONTRACT, RUNTIME, RESOURCE or provider-specific cause |
| HANDOFF_FAILURE | Existing HANDOFF_FAILURE / continuation contract |
| CONTEXT_STALENESS | CONTEXT_FAILURE plus CONTEXT_DRIFT evidence |
| CAPABILITY_MISMATCH | Discovery, routing, tool or resource subreason |

Recovery should be selected by diagnosis and effect certainty:

| Diagnosis | Possible bounded response | Forbidden default |
| --- | --- | --- |
| Missing context | rebuild a narrower/new manifest and new attempt | automatically widen the aperture |
| Missing specification | acquire or resolve the local rule source, then new attempt | ask the model to guess the rule |
| Invalid/denied action | issue a new exact Authority request if appropriate | replay or bypass the denied operation |
| Tool/execution failure | inspect effect certainty; repair or handoff | blind retry after UNKNOWN effect |
| Resource failure | wait or re-admit a fresh envelope | treat a prior probe as a reservation |
| Failed assumption | expose contradiction, revise hypothesis, new attempt | silently preserve stale hypothesis |
| Verification failure | repair against evidence or reject | convert model claim into success |
| Handoff failure | reconstruct from bounded canonical refs | transfer raw private reasoning |

Recovery ownership remains:

~text
Harness         classifies lifecycle/effect safety and enforces attempt boundaries
Orchestrator    chooses a bounded recovery strategy
Context Control  compiles changed context/specification only when justified
Resource        re-admits resource conditions
Authority       evaluates fresh effects/permits
Veritas         evaluates the repaired result
~

Diagnosis must be proportional. More context, higher reasoning, more agents and
more retries are different treatments, not interchangeable remedies.

### 21.5 Causal Harness Sync

#### FACT

Harness Sync, Passport and Synthesis are currently design-only. Existing docs
record fingerprints, treatment versions, outcomes, confidence and evidence
references, but do not establish causal support.

#### INFERENCE

“Profile X was present during successful runs” is an association. It becomes
causally supported only when the treatment was varied under matched conditions
and the result survives independent evaluation and held-out comparison.

#### RECOMMENDATION

Future Passport observations should distinguish evidence strength:

~~~text
ASSOCIATIONAL
CAUSALLY_SUPPORTED
INSUFFICIENT_EVIDENCE
INVALID_COMPARISON
~~~

A causal-support record would need, at minimum:

- exact model/runtime/provider fingerprint;
- frozen task, starting repository and acceptance contract;
- control and treatment IDs;
- one declared changed treatment dimension;
- Context/Skill/tool/profile/Harness versions;
- attempt isolation and execution order;
- resource, token, latency and cost conditions;
- independent Veritas outcome and failure class;
- sample count, variance/confidence and limitations;
- held-out tasks or perturbation strata;
- treatment application and removal/ablation evidence.

Candidate experimental families:

~~~text
standard versus synchronized profile
compact versus verbose Skill projection
three versus six tool candidates
context treatment variation
delegation versus no delegation
recovery-policy variation
orientation/frame treatment variation
~~~

Counterfactual replay is limited for stochastic model calls. Exact replay may
be unavailable; controlled reruns, treatment ablation and observation replay
must not be described as exact reconstruction of hidden reasoning.

The Passport should preserve raw observations and label causal support. A
derived Profile may consume causally supported evidence preferentially, but
Authority, Veritas, acceptance and project isolation remain invariant.

### 21.6 Offline Harness Evolution

#### STATUS: RESEARCH ONLY / DEFERRED

The proposed loop belongs under Harness Sync and the benchmark/research lane,
not inside the live Harness:

~~~text
verified failure corpus
        ↓
failure clustering
        ↓
candidate deterministic treatment
        ↓
offline experiment
        ↓
Raw / Standard / Synchronized comparison
        ↓
held-out regression suite
        ↓
operator review
        ↓
new versioned profile or runtime rule
~~~

The live system must never rewrite its own critical prompt, routing,
acceptance, Authority or recovery policy from one mission. Every candidate
treatment must have:

- an immutable identifier and version;
- source failure/evidence references;
- declared intended mechanism;
- declared scope and non-goals;
- reproducible control/treatment experiment;
- held-out regression results;
- security and privacy review;
- rollback path;
- operator approval before production use.

A production Harness may consume an approved versioned treatment. It must not
generate or activate one implicitly during execution.

### 21.7 Benchmark anti-overfitting

#### FACT

The existing benchmark protocol already requires matched model, task,
acceptance, tool budget, timeout, context budget and evaluator. It also requires
repeated runs, isolation and failure-injection families as future controls.

#### RECOMMENDATION

Add validity-preserving perturbation strata before using benchmark results to
claim general Harness advantage:

~~~text
equivalent context ordering
non-semantic file-name changes
tool-description phrasing changes
irrelevant directory noise
equivalent acceptance wording
equivalent repository layouts
Skill advertisement ordering
tool ordering
restart/interruption
provider swap
model swap
~~~

The model/provider swap strata change the fingerprint and must be analyzed as
separate comparison groups, not pooled as if identical. Every perturbation needs
a semantic-equivalence check and a frozen acceptance evaluator.

Anti-overfitting requirements:

1. Keep task content, treatment assignment and evaluator versions hidden from
   the treatment generator where practical.
2. Separate calibration/development, validation and held-out task sets.
3. Randomize task and arm order where environment permits.
4. Reset repository, process, resource and evidence state for every run.
5. Report both aggregate and per-perturbation outcomes.
6. Preserve raw results and negative results.
7. Prohibit benchmark-specific trigger strings, Skill selection hacks or
   treatment rules keyed to fixture names.
8. Record all Context, Skill, tool, profile and Harness versions.
9. Require generalization to at least one unseen but semantically equivalent
   presentation before calling a treatment causal.
10. Keep acceptance, Authority and false-success policy identical across arms.

The purpose is to distinguish general advantage from optimization for one frozen
benchmark presentation.

### 21.8 Revised ContextManifest assessment

The prior candidate remains valid as a shape, but LocalSpecification and
UncertaintyState refine it. They do not change Context Intelligence ownership.

| Candidate field | Repository evidence | Disposition |
| --- | --- | --- |
| identity | H3 attempt identity and context hash; no manifest identity | PARTIAL |
| doctrine | AgentLoop doctrine/scaffold and Skills | PARTIAL |
| role | AgentStart role and worker descriptor | PARTIAL |
| objective | Agent task and H3 envelope objective | EXISTS / scope may be partial |
| situation_frame | provider projections, handoff and workflow context; no schema | PARTIAL |
| verified_facts | handoff verified_facts and evidence/Helix references | PARTIAL |
| retrieved_facts | index, memory and evidence providers | PARTIAL |
| unknowns | attempt markers, handoff questions and effect states | PARTIAL |
| local_specification | Workflow/Skills/acceptance fragments, no unified digest | MISSING / CANDIDATE |
| uncertainty_state | distributed UNKNOWN/drift/effect/failure signals, no aggregate | PARTIAL / CANDIDATE |
| relevant_artifacts | Workflow artifacts, handoff artifact refs and project retrieval | PARTIAL |
| skill_projection | bounded Skills selection and H3 metadata | PARTIAL |
| capability_aperture | registry/capability fields, no complete per-attempt aperture | PARTIAL |
| working_memory_projection | memory recall/handoff only; runtime WMS absent | DEFER |
| workflow_obligations | Workflow stages and obligations | PARTIAL projection |
| authority_surface | Authority operation/permit references | PARTIAL |
| resource_surface | Resource decision and hardware snapshot | PARTIAL |
| acceptance_contract | attempt verification marker and Veritas policy | PARTIAL |
| evidence_refs | Provenance, handoff and verification references | PARTIAL |
| provenance_refs | H3 event-stream and ledger references | PARTIAL |
| context_hash | H3 bound hash/block identity | EXISTS for current H3 binding; not proof of manifest completeness |

No field above authorizes a new runtime owner. The manifest remains a Context
Control product bound and recorded by Harness.

### 21.9 Revised conceptual feedback loop

The research loop is architecturally compatible when interpreted as ownership,
not as one new controller:

~~~text
UNDERSTAND
  Resident / Orchestrator / Context Control

ACQUIRE CONTENT AND LOCAL SPECIFICATION
  Context Control from canonical owners

COMPILE SITUATION AND SYSTEM UNCERTAINTY
  Context Control projection; source owners retain authority

EXPOSE MINIMUM SUFFICIENT CAPABILITY
  Context Control / Skill Intelligence; Authority still separate

SELECT INTELLIGENCE
  Orchestrator / Model Router

SPECIALIZE ONLY IF REQUIRED
  Orchestrator decision; future Expert Cell contract

ADMIT RESOURCES
  Resource Admission

AUTHORIZE EFFECTS
  Authority

EXECUTE SEALED ATTEMPT
  Harness

RECORD EVENTS
  Harness / Provenance relationship

DETECT EARLY DIVERGENCE
  derived Harness telemetry from canonical observations

CLASSIFY AND RECOVER
  existing failure taxonomy; Orchestrator policy; fresh attempt

ACCEPT
  Veritas

PRESERVE VERIFIED TRUTH
  Helix promotion rules

UPDATE EMPIRICAL EVIDENCE
  Provenance/Passport research projection
~~~

The current implementation satisfies the Workflow, Skills, Authority, H3
sealing/event and fail-closed verification portions only partially or on the
exercised path. Specification acquisition, aggregate uncertainty, diagnosis
signals, causal evidence and empirical update remain future design work.

### 21.10 Duplications and conflicts introduced by the research

| Proposal | Risk | Disposition |
| --- | --- | --- |
| Persistent LocalSpecification service | duplicates Workflow, Skills, project facts and Veritas | Keep only as a ContextManifest section |
| Model confidence as routing truth | conflicts with system-level evidence and fail-closed policy | Reject |
| Continuous epistemic reviewer agent | duplicates Veritas and adds orchestration/context cost | Defer; derive deterministic signals first |
| New failure enum | duplicates HARNESS-FAILURE-TAXONOMY.md and continuation.ts | Extend existing taxonomy by subreason/evidence if needed |
| Passport as history store | duplicates Provenance | Reject |
| Live self-modifying Harness | violates reviewability, rollback and H3 stability | Reject |
| Benchmark-specific treatment | invalidates causal/general claims | Reject |
| System Uncertainty projection | no conflict if non-canonical and source-attributed | Candidate |
| LocalSpecification manifest section | no conflict if source-owned and hashed | Candidate |
| Causal treatment metadata | no conflict if stored as research evidence, not runtime authority | Defer / Candidate |

### 21.11 Explicitly deferred

The following remain deferred while Liquid is unresolved:

~~~text
LocalSpecification runtime field and producer
System Uncertainty runtime aggregate
early-divergence detector runtime
diagnosis-specific recovery implementation
causal Passport fields/runtime
offline Harness Evolution tooling
benchmark perturbation runner
ContextManifest implementation
Context Aperture implementation
Working Memory / Attempt Sandbox
Expert Cells
Harness Sync
Capability Passport persistence
Cross-Model Synthesis
H4
~~~

Documentation may describe these concepts. No runtime code or production schema
is authorized by this addendum.

### 21.12 Next-slice disposition

The conditional next slice remains **Context Manifest Binding after Liquid
evidence**. The recommendation is refined, not replaced:

- If Liquid demonstrates a verified benefit from operational orientation or a
  Situation Frame, bind a minimal manifest on one real AgentLoop path.
- If LocalSpecification is shown to be the missing variable, include only a
  source-attributed, bounded specification section.
- If system uncertainty is needed to keep the attempt honest, bind its
  evidence references and blocking reasons, not a model confidence score.
- Do not include Working Memory, Expert Cells, causal Sync, live self-evolution
  or a broad recovery engine in that slice.
- If Liquid is negative or inconclusive, do not start the slice.

Before authorization, require the evidence list in section 18 plus a held-out
semantic-perturbation comparison for any claim that a treatment generalizes.

## Updated final disposition

~~~text
RESEARCH INTEGRATION: COMPLETE
H3 SEMANTICS CHANGED: NO
CONTEXT INTELLIGENCE OWNERSHIP CHANGED: NO
CONTEXTMANIFEST CANDIDATE: REFINED, NOT IMPLEMENTED
RECOMMENDED NEXT SLICE: UNCHANGED — CONTEXT MANIFEST BINDING AFTER LIQUID EVIDENCE
LIQUID AWARENESS: IN PROGRESS / FINAL EVIDENCE NOT AVAILABLE
MODEL WORKING MEMORY: NOT IMPLEMENTED
H4: NOT AUTHORIZED
IMPLEMENTATION AUTHORIZED: NO
~~~
