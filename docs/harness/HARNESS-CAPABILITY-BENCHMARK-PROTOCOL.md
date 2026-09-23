# Harness Capability Benchmark Protocol

Status: **METHODOLOGY ONLY — NO RESULT PUBLISHED**

The benchmark measures accepted engineering work, not model confidence or
stylistic quality. It must be run only when the attempt/envelope and battery
integrity contracts can bind all conditions.

## 1. Experimental modes

For the same model, task, acceptance criteria and machine:

```text
MODE 0 — RAW/MINIMAL CONTROL
MODE 1 — STANDARD COVERT HARNESS
MODE 2 — SYNCHRONIZED COVERT HARNESS
```

Mode 2 is optional and is the Harness Sync experiment. Mode 1 must remain
available permanently so calibration gain is measurable.

Primary comparisons:

```text
HARNESS GAIN       = acceptance(Standard) - acceptance(Raw)
CALIBRATION GAIN   = acceptance(Synchronized) - acceptance(Standard)
```

Raw measurements remain available; no single composite score replaces them.

## 2. Controls

Each run must freeze:

```text
same task fixture and starting tree hash
same model fingerprint
same tool/capability set
same nominal context budget
same timeout and retry/repair limits
same acceptance criteria and verifier version
same Authority policy
same resource policy/machine profile
same Skill versions for the compared mode, except the declared treatment
same release/Harness/profile version
```

Run order should be randomized when practical. Every run gets a fresh
worktree/overlay or is reset to a recorded clean hash. An attempt that inherits
another run's mutation is invalid, not a success.

## 3. Task classes

Start with small real repositories/tasks that exercise one primary variable and
one or two secondary obligations:

```text
retrieval with stale context
compound obligation handling
tool selection and schema adherence
unsafe operation refusal
verification failure recognition
restart reconstruction
worker replacement/handoff
bounded implementation and deterministic tests
```

Do not use synthetic prompts that reveal the expected answer or reward a special
Covert phrase.

## 4. Acceptance

Acceptance is binary only at the final evaluator boundary and must be based on
the same requirements for every mode:

```text
functional requirements
architecture constraints
tests and runtime checks
security/Authority constraints
project isolation
Veritas evidence
```

Different valid implementations are accepted equally. Style is not a hidden
criterion.

The evaluator must prove:

```text
requested tests == discovered tests == executed tests
current state matches the attempt's starting/effect scope
evidence belongs to this attempt
no unsupported VERIFIED claim occurred
```

## 5. Measurements

Record raw values for each attempt:

```text
accepted: boolean
attempt count
repair count
successful/failed tool calls
false-success claim: boolean
Authority violation: boolean
verification result
input/output/reasoning tokens when actually reported
provider cost when actually reported
local wall time, CPU/GPU/RAM/VRAM observations
operator interventions
context/Skill/model/profile IDs and hashes
```

Derived metrics:

```text
Accepted Task Rate       = accepted tasks / attempted tasks
Cost Per Accepted Task   = total financial inference cost / accepted tasks
Tokens Per Accepted Task = all measured input+output tokens / accepted tasks
Attempts Per Accepted    = all attempts / accepted tasks
Tool Calls Per Accepted  = all tool calls / accepted tasks
Recovery Rate            = initially failed tasks later accepted / initial failures
False-Success Rate       = unsupported completion claims / attempted tasks
Regression Rate          = accepted outputs later failing regression / accepted outputs
```

For local inference, monetary cost is `NOT_DIRECTLY_RECORDED` unless a declared
cost model exists. Report compute time separately.

## 6. Failure attribution

Before calling a failure model-induced, check in order:

```text
task fixture and reset
context envelope identity/order/truncation
Skill/SOP identity and projection
workflow/obligation projection
model/provider/runtime/template
tool schema and candidate set
Authority decision/result
resource pressure
process/effect observation
verifier/evaluator integrity
```

Record the first divergence and owner. A model's unsupported claim remains a
false-success attempt even when containment prevents mutation.

## 7. Repetition and confidence

One success is not a model capability conclusion. The run plan must pre-register
the task set, repetitions, exclusions and analysis before results are viewed.
Report:

```text
Pass@1
repeated success rate
variance/confidence interval
repair success rate
unrecoverable failure rate
sample count and comparable-task count
```

Use `INSUFFICIENT_EVIDENCE` instead of a role label when comparable observations
are sparse or version boundaries differ.

## 8. Cost and resource accounting

Keep financial cost, token use, latency, operator time and machine resources as
separate dimensions. A recommendation must not call a model cheaper merely
because provider cost was unavailable. Resource Admission remains a safety
gate, not the ranking owner.

## 9. Cross-model phase

Only after same-model Raw/Standard/Synchronized controls are valid should
different model fingerprints be compared. Match task archetype, role, context,
Skill, Harness/profile version, machine envelope and acceptance evaluator.

The first output is an evidence table, not a leaderboard. Role/task fitness,
lineup synergy, failure complementarity and cost efficiency require explicit
sample sizes and version lineage.

## 10. Contamination and privacy controls

- Reset every task to a clean fixture hash.
- Use isolated worktrees/overlays and owned process scopes.
- Hash artifacts and record before/after state; do not copy private project data
  into public reports.
- Do not store chain-of-thought, credentials, unrelated prompts, or personal
  filesystem details.
- Mark provider/external calls non-exactly replayable where appropriate.
- Fail the run if the battery guard detects missing/zero/short test execution.

## 11. Publication rule

No public Harness Gain, Calibration Gain, model ranking, or capability
compression claim may be published until the apparatus, task set, acceptance
contract, versions, and raw results are frozen and independently reviewed.
