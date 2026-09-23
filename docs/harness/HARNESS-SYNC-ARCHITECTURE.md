# Harness Sync Architecture

Status: **DESIGN/RESEARCH ONLY — NOT IMPLEMENTED**

Harness Sync is an optional calibration process for learning how to present and
budget work for one exact model/runtime. It does not train or modify a model.
It does not change Authority, security, Veritas, project isolation, or the
acceptance threshold.

## Purpose

For a newly detected model, Covert may offer:

```text
NEW MODEL DETECTED
Harness Sync is recommended.

Run a short calibration to learn how this model handles context, tools,
compound obligations, Skills, recovery, reasoning depth, and verification claims.

[Run Harness Sync] [Use Standard Harness]
```

The Standard Harness is always available. Calibration is optional and is never a
prerequisite for basic use.

## Non-goals

- no model training, fine-tuning, or weight mutation;
- no automatic downloads or provider marketplace;
- no mandatory calibration;
- no lower acceptance threshold for a weak model;
- no model-specific Authority or security policy;
- no private chain-of-thought capture;
- no opaque global ranking or autonomous model swapping.

## Current repository status

The certified candidate has model routing, context fitting, runtime profile
fields, a partial Connections surface, and experimental cross-model evidence,
but no Passport, calibration runner, synchronized profile, or synthesis service.
The live AgentLoop also does not currently persist the exact
route/runtime/configuration that would make calibration observations
attributable. Harness Sync is an **intended product capability**, not a
speculative post-v1 concept; its implementation must follow the sealed
execution-envelope/provenance slice and the Connection Center contract. It is
not a replacement for either.

## Fingerprint

Calibration attaches to a fingerprint, not a display name:

```text
provider
model identifier and revision
local artifact SHA256 when applicable
quantization
runtime and runtime version
adapter version
chat template
relevant inference configuration
machine/resource profile for resource observations
```

Validity classes:

| Change | Invalidation |
|---|---|
| model artifact/hash, provider model revision, chat template | full or major resync |
| adapter or runtime behavior change | targeted/full resync depending on affected dimensions |
| sampling/reasoning configuration | invalidate only observations dependent on it; preserve intrinsic observations with lineage |
| GPU/CPU/RAM machine change | refresh resource/latency observations, not necessarily behavioral observations |
| Harness/context/Skill contract version change | invalidate affected comparisons; retain old evidence as versioned history |

No evidence silently crosses a fingerprint or contract boundary.

## Short probe strategy

The goal is information density. A first operational battery should target
roughly 8–15 probes, selected by the capabilities Covert can actually use.
The following ten-probe shape is a starting hypothesis, not an acceptance gate:

| Probe | Dimensions observed |
|---|---|
| single explicit task | instruction adherence, output contract |
| compound obligation list | explicit/implicit obligations, decomposition |
| same facts in compact vs dense context | context-density tolerance |
| reordered equivalent context | context-order sensitivity |
| long-context retrieval | degradation and retrieval-state comprehension |
| compact Skill vs verbose Skill | Skill benefit/overload |
| three vs six tool candidates | tool selection/candidate-set tolerance |
| structured state transition | state comprehension, schema adherence |
| induced tool failure | recovery/repair behavior |
| unsupported completion opportunity | verification-claim discipline |

Each probe has a fixed task, acceptance observer, starting fixture, budget,
tool set, and evidence contract. A probe may produce multiple observations but
must not infer more than its evidence supports.

## Model Capability Passport

The Passport stores attributable observations, not instructions. It must carry:

```text
model fingerprint
calibration version/date/environment
probe and task identities
observed dimensions and raw evidence references
sample counts and confidence
limitations/unknowns
Harness/context/Skill versions
```

An observation may say `UNKNOWN`, `NOT_TESTED`, or `INSUFFICIENT_EVIDENCE`.
The conceptual machine-readable shape is in
`MODEL-CAPABILITY-PASSPORT.schema.json`.

## Synchronized Harness Profile

The Profile is a derived policy projection, separate from the Passport:

```text
context density
obligation projection
decomposition preference
tool candidate limit
Skill projection depth
retrieval-state presentation
reasoning budget recommendation
repair budget recommendation
structured-output mode
```

Every meaningful profile field must reference the Passport observations and
derivation version that produced it. A profile may recommend a presentation or
budget; it cannot grant permission, remove verification, change isolation, or
declare success. The conceptual shape is in
`SYNCHRONIZED-HARNESS-PROFILE.schema.json`.

## Continuous verified learning

Harness Sync is only an initial baseline. Real missions can add evidence when
they are bound to a fingerprint, sealed attempt, and independent Veritas result.

```text
optional Sync → initial Passport → derived Profile
→ real governed missions → Veritas
→ versioned verified observations → explainable refinement
```

Failed/unverified missions remain evidence with the correct classification; they
do not become positive capability facts. One mission cannot silently rewrite a
profile. Refinement must show comparable sample count, acceptance, variance,
recency, and the exact policy change proposed.

## Integrations and ownership

| Concern | Future owner |
|---|---|
| probe execution and facts | Harness + existing Authority/Resource boundaries |
| Passport storage | canonical model/provenance owner, not a second Harness store |
| Profile derivation | analysis/policy projection with versioned lineage |
| acceptance | Veritas unchanged |
| permission | Execution Authority unchanged |
| resource feasibility | Resource Admission unchanged |
| worker selection | Model Router/Orchestrator may consume recommendations |
| durable mission evidence | Provenance Ledger |
| verified project truth | Helix only after normal truth promotion |

## Connection Center integration

Model access is the entry point for Sync, but it does not own calibration:

```text
Connection Center
→ exact model/runtime/provider fingerprint
→ Standard Harness or optional Harness Sync
→ sealed attempt/evidence record
→ Passport observations
→ derived Profile
```

The connection layer owns authentication/status/discovery and the credential
boundary. Harness Sync consumes its resolved fingerprint. OpenCode delegated
credentials remain owned by OpenCode; direct API credentials remain in the
existing secure store. A model catalog entry without a stable identity is not
eligible for Sync.

## Security and privacy

Calibration uses the same untrusted-model and Authority rules as production.
Probes cannot grant themselves tools, access private projects, or alter
acceptance. Store bounded task metadata, result/evidence references, costs and
resource observations; do not store private prompts, secrets, unrelated paths,
or chain-of-thought.

## Smallest proof experiment

After a sealed attempt/evidence boundary exists, the smallest useful experiment
is:

```text
fingerprint one model/runtime
→ run a fixed 8–10 probe battery
→ produce Passport with unknowns preserved
→ derive Profile with evidence references
→ run frozen tasks Standard
→ run the same tasks Synchronized
→ compare identical Veritas acceptance and raw cost/latency/repair metrics
```

No automatic routing or cross-model recommendation is needed to prove the
concept. Harness Sync is not selected as the first implementation slice until
the attempt/evidence boundary can make this experiment scientifically valid.
