# Cross-Model Synthesis

Status: **DESIGN/RESEARCH ONLY — NOT IMPLEMENTED**

Cross-Model Synthesis is analysis of verified Covert history. It is not a
leaderboard, a provider preference, a permission layer, or an autonomous model
swapper.

## Data inputs

The future analysis requires comparable, versioned observations for:

```text
sealed attempt and mission identity
model capability fingerprint
worker role and task archetype
project/workflow/stage class
Context Envelope and Skill/Profile versions
Harness version/profile
model/provider/runtime/configuration
resource/machine profile
attempts, repairs, tool calls, operator interventions
latency, measured tokens, cost where available
Veritas acceptance/rejection and failure taxonomy
```

The current Provenance Ledger does not yet contain this full set. The analysis
must consume its future canonical extensions, not create a parallel history
store.

## Taxonomy

Start coarse and expand only with evidence:

```text
roles: planner, coder, reviewer, debugger, researcher, verification-assistant
task archetypes: implementation, repair, architecture, test, release, security,
  retrieval, migration
dimensions: language/framework, repository maturity, task size, stage, tool
  requirements, context size, security sensitivity, mutation scope
```

Every comparison must show its matching criteria. A model that has only two
TypeScript repair missions must not be presented as the best general coder.

## Evidence and confidence

Recommendations expose:

```text
comparable sample count
accepted/attempted count
acceptance rate and uncertainty
repair rate
false-success rate
cost/accepted task when measurable
latency/resource observations
recency and fingerprint validity
Harness/Profile/Context/Skill versions
```

Use `INSUFFICIENT_EVIDENCE` rather than a subjective role label when samples are
small, task mix differs, or versions cross an invalidation boundary. Statistical
thresholds should be pre-registered with the benchmark family rather than
invented after a result is seen.

## Version and recency handling

A historical observation is valid only for the fingerprint and contract range
it declares. Model artifact, provider revision, runtime, adapter, chat template,
Harness, Context, Skill or Profile changes create explicit comparison strata.
Old evidence remains useful history but cannot silently represent the new
configuration. Recency may be a displayed analysis dimension; it must not erase
the raw lineage.

## Role/task recommendation

The future projection may answer:

```text
Planner → model A
Coder   → model B
Reviewer→ model C
```

only with an explanation such as:

```text
84 comparable verified missions
acceptance 94% (confidence interval shown)
median attempts 1.2
false-success 0.3%
cost/accepted task: reported or NOT_DIRECTLY_RECORDED
current machine/resource compatibility: PASS/UNKNOWN
```

The operator can use the recommendation, choose another model, or lock a
selection. Model Router/Orchestrator consumes the recommendation; Authority
still decides effects and Veritas still decides acceptance.

## Resource and cost awareness

Ranking dimensions remain separate:

```text
acceptance probability
financial cost
tokens
wall time
RAM/VRAM/CPU
repair/operator time
```

Resource Admission determines whether a proposed lineup can run now. It does
not assign quality. A local model with no monetary price is not labelled free;
compute usage and time are reported separately.

## Exploration without feedback-loop bias

Early success must not permanently starve other models. A future policy may use:

```text
high-confidence production recommendation
+ small, bounded, operator-visible exploration allowance
```

Security-sensitive or destructive work must not be randomly routed merely to
collect data. Exploration tasks must use isolated fixtures and the same
acceptance standard. A recommendation must show exploitation versus exploration
status in its evidence.

## Team composition and failure complementarity

Planner→Coder→Reviewer lineups require complete workflow evidence, not the sum
of independent model scores. Required data:

```text
complete workflow acceptance
role-specific failures
handoff/context integrity
repair count and operator time
cost/latency/resource total
```

Synergy is only claimed when the lineup materially exceeds a pre-declared
baseline under matched tasks. Complementary failure modes may explain a gain,
but must be observed rather than assumed.

## Ownership and privacy

The synthesis layer consumes canonical observations and produces explainable
recommendations. It must not store chain-of-thought, private project content, or
credentials. It must distinguish model-intrinsic observations from
machine/runtime-specific observations. Operator override is always explicit.

## Current evidence

PR #31's frozen cross-candidate matrix is already an early example of this
direction: it compares Macaw, Terminal-SFT and Granite by failure class and
assigns recurring failures to model-neutral Covert layers where evidence
supports that conclusion. It is not a production synthesis engine and does not
justify universal model rankings.

## Smallest proof

Do not begin with team synergy. First prove a single-role, single-archetype
comparison across two model fingerprints with:

```text
same frozen tasks
same Standard Harness
same Veritas
same machine/resource envelope
same acceptance criteria
versioned raw outcomes
```

Then add Synchronized mode, and only later role lineups. This keeps model
evidence separate from Harness and calibration effects.
