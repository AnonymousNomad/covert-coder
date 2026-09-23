# HARNESS EXECUTION ENVELOPE (vNext H3)

Status: IMPLEMENTED (this slice). Schema: `covert.attempt.v1` (`common/contracts/attempt.ts`).
Owner of this document: DeepSeek #1 (implementation); Luna owns independent certification.

## Purpose

One admitted attempt = one immutable envelope that binds, durably, exactly what
was admitted to execute. It answers: WHAT EXACTLY WAS ADMITTED? WHO/WHAT WAS
ALLOWED TO EXECUTE IT? WHICH MODEL RECEIVED WHICH CONTEXT AND METHODS? WHAT
BUDGET? WHAT ACTUALLY RAN? WHAT CHANGED? WHAT FAILED? WHAT CAN SAFELY BE
RETRIED? WHAT EVIDENCE BELONGS TO THIS ATTEMPT?

## Ownership boundaries (unchanged by this slice)

| Concern | Owner |
|---|---|
| Permission for effects | **Authority** (the envelope consumes references; it never grants) |
| Context construction | Context Control (the envelope records the sha256 of what entered) |
| Skill selection | Skill Intelligence (the envelope records that it was bound into context) |
| Model/provider selection | Model Router / Orchestrator (the envelope records the resolved request descriptor; observed model stays `NOT_RECORDED` until independently observed) |
| Resource feasibility | Resource Admission (the envelope records the decision verbatim) |
| Acceptance judgment | **Veritas** (the envelope records `verification_state`; it never judges) |
| Execution history | Provenance (the envelope feeds it via `attempt_id`) |
| Attempt lifecycle / limits / observation | Harness (this slice) |

## Immutability law

Once canonically ADMITTED (see journal doc for the durable definition), the
envelope is immutable. A material change (model, context, Skill, budget,
Authority scope, tool/capability set, objective, acceptance criteria) is a
**new attempt with a new identity** — never a mutation of historical admission
truth. `bindContext` records the first context sha256 into the envelope; a later
different hash is journaled as `CONTEXT_DRIFT` and the envelope is NOT changed.

## Fields (where unavailable, markers are explicit)

`UNKNOWN` / `NOT_RECORDED` / `NOT_APPLICABLE` are first-class values. This slice
never invents truth it cannot populate: `observed_model`, `runtime_profile`,
`adapter_identity`, `workflow_id`, `stage_id`, `acceptance_criteria`,
`timeout_ms` and skill identities start as markers where the runtime cannot
supply them yet.

## Atomicity (precise, not claimed beyond implementation)

"Sealed" means the envelope file exists at
`.aide/admission/attempts/<attempt_id>.json` with `sealed: true`, written via
temp-file + rename on the same volume. This is filesystem atomicity, not a
database transaction. Durable ADMISSION additionally requires the journal
`ATTEMPT_ADMITTED` record (see journal doc); a crash between the two leaves
`RECOVERED_INCOMPLETE_ADMISSION` (not admitted).

## Failure semantics

The envelope carries a `failure_class` from the bounded taxonomy:
`ADMISSION_FAILURE`, `RESOURCE_FAILURE`, `AUTHORITY_FAILURE`,
`EXECUTION_FAILURE`, `TOOL_FAILURE`, `VERIFICATION_FAILURE`, `RUNTIME_FAILURE`,
`UNKNOWN`. Failed worker output is never automatically labeled a model failure;
execution/tool failure is the default attribution for loop errors.

## Veritas relationship

`EXECUTED ≠ VERIFIED`. The envelope records `verification_state` and `accepted`
(from the canonical verification pipeline) but makes no acceptance claim of its
own. The live loop's negative verification (evidence unavailable ⇒ not
verified) flows through unchanged.
