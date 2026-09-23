# Harness Failure Taxonomy

This taxonomy is for attribution, not blame. A model response is not classified
as a model failure until upstream context, adapter, workflow, Authority,
execution, and evaluator causes have been excluded.

## Classification table

`Current evidence` is `PROVEN`, `PARTIAL`, or `DESIGN GAP` against the review
base.

| Failure | First detector | Responsible owner | Safe retry? | Repair/continuation | Verification effect | Canonical truth effect | Current evidence |
|---|---|---|---|---|---|---|---|
| `DISCOVERY_FAILURE` | Skill/context selection result | Skill Intelligence / Context Control | Only if no mutation | reselect with a fresh attempt | no acceptance | no fact promotion | Partial |
| `CONTEXT_FAILURE` | provider failure, missing envelope, wrong projection | Context Control | Only before model mutation | rebuild envelope; new attempt | invalidate dependent evidence | no promotion | Partial |
| `CONTRACT_FAILURE` | schema parser/route validator | owning contract boundary | Usually yes if no effect | correct input; new request | no acceptance | no promotion | Proven at route shapes; not unified |
| `SOP_FAILURE` | required method/stop condition omitted | Skill Intelligence / Workflow | No if effect uncertain | new worker/attempt with explicit method | prior attempt rejected | claims remain unverified | Partial |
| `SCHEMA_FAILURE` | XML/Zod/structured-output parser | adapter/parser | Yes only before effect | normalize or request structured retry | no acceptance | no promotion | Proven for parser errors |
| `WORKFLOW_FAILURE` | illegal/stale stage transition | Workflow | Only without mutation | reconcile stage/revision | blocks acceptance | workflow remains prior truth | Partial |
| `ORCHESTRATION_FAILURE` | wrong sequencing/worker routing | Orchestrator/Model Router | Only before effect | replan; fresh attempt | prior evidence scoped | no automatic truth change | Partial |
| `MODEL_FAILURE` | model behavior after system controls pass | selected model | Only if effect certainty is none | bounded retry/switch | failed attempt retained | no promotion | Demonstrated in PR #31 only after system analysis |
| `ADAPTER_FAILURE` | malformed transport/template/runtime mapping | provider/model adapter | Only if no effect or adapter proves no dispatch | adapter recovery; new attempt | invalidate output | no promotion | Proven historically in Liquid report; candidate instrumentation incomplete |
| `AUTHORITY_FAILURE` | denied, expired, replayed, wrong-scope operation | Execution Authority | No replay of mutation | request fresh exact operation | no acceptance | no effect should be claimed | Proven for route operations |
| `RESOURCE_FAILURE` | refusal/queue/pressure | Resource Admission | Only if no attempt started | wait/re-admit fresh envelope | no acceptance | no promotion | Probe/refusal proven; reservation absent |
| `EXECUTION_FAILURE` | executor error after authorization | Harness/tool owner | Only if no effect or known reversible | repair/rollback per effect certainty | reject or retain partial | mark uncertain/partial | Partial |
| `TOOL_FAILURE` | tool nonzero/error/timeout | tool adapter/Harness | Only when side effect is known none | repair or handoff | evidence failed | no success claim | Partial; timeout cleanup not proven |
| `VERIFICATION_FAILURE` | deterministic requirement/test fail | Veritas/evaluator | Never blindly replay mutation | repair or new attempt | reject | prior claims remain unverified | Proven as fail-closed path |
| `HARNESS_FAILURE` | missing lifecycle/evidence/cleanup fact | Harness | No if state is ambiguous | reconcile before any retry | force unknown/unresolved | block promotion | Design gap exposed by missing attempt record |
| `EVALUATOR_FAILURE` | stale/wrong/incomplete verifier | Veritas/evaluator owner | No reuse of suspect evidence | rerun independent verifier | invalidate result | no promotion | Partial |
| `RUNTIME_FAILURE` | engine/process/port crash | runtime/process owner | Only after exact generation/effect check | restart/re-admit | scope prior evidence | state may be unknown | Partial |

## System-induced model degradation

The following are not Model Failures by default:

| Symptom | Required exclusion before model attribution |
|---|---|
| omitted compound obligation | confirm the obligation was present, ordered, and within the model's actual context |
| authority answer varies | confirm canonical policy projection, adapter serialization, and identical task/context |
| retrieval miss | confirm correct index state, source revision, query, and retrieval result were delivered |
| empty/fragment output | confirm served context, prompt fit, chat template, generation reserve, and runtime health |
| unsupported completion | confirm acceptance requirements and current verification evidence were visible, while still rejecting the claim |
| tool misuse | confirm tool schema, candidate set, result projection, and Authority rejection/approval evidence |

The PR #31 cross-candidate evidence is a concrete example: recurring compound
failures across model families led the Resident system-gap analysis to assign
the obligation projection to Workflow/Orchestrator, retrieval to Helix/Context,
protected claims to Veritas/containment, and policy truth to canonical
Authority. The same acceptance threshold remains in force.

## Effect-certainty rules

| Effect state | Meaning | Retry rule |
|---|---|---|
| `NONE` | no mutation-capable dispatch or authoritative observation proves no effect | a fresh attempt may be considered |
| `KNOWN_COMPLETE` | requested effect completed and bounded observation exists | do not repeat automatically; verify/continue |
| `KNOWN_PARTIAL` | some effect is known, but scope/result is incomplete | repair or inspect; no blind retry |
| `UNKNOWN` | dispatch/effect cannot be ruled in or out | freeze retry; reconcile externally |
| `DIVERGED` | attempted restoration does not match expected state | manual/explicit recovery; no automatic acceptance |

The certified candidate's continuation service can carry an `unknown` side-effect
message, but it does not yet enforce this table through a durable attempt gate.
