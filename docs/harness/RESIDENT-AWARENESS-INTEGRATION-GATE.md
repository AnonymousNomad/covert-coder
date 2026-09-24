# Resident Awareness Integration Gate

Status: **WAITING FOR LIQUID RESIDENT EVIDENCE**

This is a decision gate for the Resident operational-awareness experiment. It
is not an implementation plan and does not authorize H4, a Situation Frame,
Capability Surface, or Model Working Memory / Attempt Sandbox runtime work.

## Evidence rule

The Liquid experiment must provide reproducible, task-level evidence rather
than a single compelling transcript. The result must identify:

```text
model/runtime fingerprint
experiment and probe version
control condition
treatment condition
same task data and acceptance criteria
workflow/role
context and capability inputs
observed outcome
verification/evidence state
sample count and failures
resource/latency conditions
limitations
```

The current observed process/log state is not a final result. Partial probe
output, model self-description, or a changed response without independent
acceptance is insufficient to activate an architecture change.

## Decision outcomes

### Outcome A — operational orientation materially improves performance

If a stable operating doctrine, ownership map, or explicit orientation block
improves verified outcomes while task/acceptance conditions remain equal,
evaluate a canonical contract for:

```text
stable Resident operating doctrine
dynamic capability surface
truth-state projection
role/subsystem ownership map
version and hash of the orientation projection
```

Decision questions:

```text
Is the content already owned by Context Control, Workflow, Skills or Helix?
Does the projection contain facts or merely advice?
Can it be attached to the sealed Context Envelope without Harness building it?
Does it improve acceptance, not only subjective fluency?
Does it increase stale-context or prompt-injection risk?
```

Default ownership remains Context Control for selection/projection and the
canonical owners for their facts. Harness may bind and record the resulting
hash; it does not become the orientation author.

### Outcome B — Situation Frame materially improves performance

If a bounded current-state frame improves verified outcomes, define before
implementation:

```text
constructor: Context Control / canonical state owners
schema owner: explicit contract owner, not Harness by convenience
validator: strict schema and freshness checks
identity: content hash plus version
attempt binding: immutable reference in the execution envelope
provenance: attributable source/reference, not a transcript dump
refresh: explicit new frame or new attempt when material
staleness: visible UNKNOWN/STALE state, never silent replacement
```

The frame must distinguish verified facts, observations, hypotheses and
unknowns. A frame cannot advance Workflow, grant Authority or create Helix
truth merely because it is present in context.

### Outcome C — scoped working memory is necessary

If controlled evidence shows that explicit, bounded operational state is
needed beyond the Context Envelope and structured handoff, activate the
already-reviewed Model Working Memory / Attempt Sandbox design.

The first design gate remains:

```text
explicit operational state only
attempt/project/mission isolation
attributable writes
bounded size and retention
secret rejection/redaction
least-privilege handoff projection
no private chain-of-thought capture
no direct Veritas or Helix promotion
```

The smallest candidate slice would be one sealed-attempt typed state contract,
not a global memory system. It must wait for operator authorization after the
Liquid evidence review.

### Outcome D — no meaningful improvement

Do not implement orientation, Situation Frame, Capability Surface or working
memory solely because the concepts are architecturally attractive. Preserve
the negative result, record the tested conditions and leave H3 frozen.

A negative result is useful evidence that the limiting factor may instead be
model capability, provider/runtime behavior, task formulation, evaluator
quality or another upstream subsystem.

### Insufficient or mixed result

If samples are too small, conditions differ, or gains appear only in fluency
without acceptance improvement, classify the result:

```text
INCONCLUSIVE — NO ARCHITECTURE CHANGE
```

Request a narrower experiment rather than implementing several overlapping
contracts at once.

## Ownership boundary to preserve

```text
Helix
  canonical verified durable truth

Workflow
  stage, obligations and transitions

Skills / Skill Intelligence
  applicable methodology and bounded projection

Context Control
  relevance selection and model-facing Context Envelope/Situation Frame

Resident
  operator continuity and interpretation over governed inputs

Harness
  immutable attempt binding, lifecycle enforcement and observations

Provenance
  attributable history

Veritas
  independent acceptance and evidence judgment
```

No result should move context construction into Harness by default. If the
experiment demonstrates that this boundary is wrong, document the evidence and
the ownership conflict before changing code.

## Integration decision record template

Complete this section only after the Liquid experiment has a final evidence
package:

```text
EXPERIMENT RESULT:

WHAT WAS PROVEN:

WHAT WAS NOT PROVEN:

CONTROL/TREATMENT:

MODEL/RUNTIME FINGERPRINT:

VERIFIED OUTCOME DELTA:

CONTEXT/RESIDENT ASSUMPTION CHANGED:

WORKING MEMORY JUSTIFIED:
YES / NO / INCONCLUSIVE

SITUATION FRAME JUSTIFIED:
YES / NO / INCONCLUSIVE

CAPABILITY SURFACE JUSTIFIED:
YES / NO / INCONCLUSIVE

HARNESS SYNC IMPACT:

SMALLEST COHERENT SLICE:

KNOWN RISKS:

IMPLEMENTATION AUTHORIZED:
NO
```

Until that record is completed and separately authorized, H3 remains the
execution-truth foundation and no working-memory persistence is created.
