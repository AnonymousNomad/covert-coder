# Harness vNext Contract (Design Only)

Status: **PROPOSAL — NOT IMPLEMENTED**

This contract is intentionally small. It does not replace Authority, Workflow,
Context Control, Skills, Resource Admission, Veritas, Provenance, or Helix. It
defines the missing boundary around one admitted attempt.

## 1. Scope

The vNext Harness owns:

- sealing the exact execution conditions selected by upstream owners;
- enforcing the admitted lifecycle and budgets;
- observing tool/process/effect facts;
- preserving uncertainty and partial effects;
- handing independent evidence to Veritas;
- feeding bounded observations to the canonical Provenance Ledger;
- making a safe retry/repair decision mechanically possible.

It does not own:

- natural-language interpretation or Resident identity;
- context construction or Skill selection;
- workflow policy or stage transitions;
- model/provider recommendation;
- permission or approval policy;
- acceptance/verification judgment;
- durable project truth promotion;
- automatic model downloads, delegation, or Capability Fabric runtime.

## 2. Working object: an admitted execution envelope

The repository does not currently have this object. This name is a design label,
not permission to create a competing core schema. The object should reuse
existing IDs and contracts where they exist.

Before any mutation-capable execution, the envelope must immutably bind:

```text
mission/task identity
project/workspace identity
workflow id + stage + revision
attempt id + parent attempt/continuation lineage
objective + acceptance requirements + verification policy reference
Context Envelope id + digest + bounded size/source manifest
Skill/SOP ids + versions + digests + selection manifest
worker role + selected model/provider/runtime fingerprint
actual adapter/template/configuration identity
recommended and admitted budgets
resource decision/reservation reference
Authority operation/decision references
mutation/effect scope and isolation reference
timeout/retry/repair limits
Harness contract/profile version
```

The envelope is a binding record, not a prompt dump. It must not contain private
chain-of-thought or credentials.

## 3. Admission semantics

The exact names may be adapted to existing contracts. The invariant is the
ordering and the absence of an ambiguous mutation state:

```text
PROPOSED
  → VALIDATED
  → RESOURCE_DECISION_RECORDED
  → AUTHORITY_REFERENCES_RECORDED
  → ENVELOPE_SEALED
  → ADMITTED
  → DISPATCHING
  → RUNNING
  → OBSERVING
  → VERIFYING
  → ACCEPTED | REJECTED | FAILED | ABORTED | UNKNOWN
```

Rules:

1. `RESOURCE_DECISION_RECORDED` is not itself a reservation unless the
   Resource Admission contract says so.
2. `AUTHORITY_REFERENCES_RECORDED` is not permission; Authority still decides.
3. `ADMITTED` is the first state from which mutation-capable dispatch may begin.
4. If sealing, authority consumption, dispatch, effect observation, or terminal
   persistence is interrupted, the attempt enters `UNKNOWN/UNRESOLVED` unless a
   trusted observation proves a safer state.
5. `UNKNOWN/UNRESOLVED` blocks blind retry and automatic acceptance.
6. Every retry/repair receives a fresh attempt and fresh mutation permission.

This is not a promise of cross-system ACID. It is a durable safety boundary and
an explicit uncertainty protocol.

## 4. Lifecycle facts

Each lifecycle transition should carry:

```text
attempt id
current state
next state
causal event
actor/owner
timestamp
contract/profile revision
integrity digest
evidence references
```

The record must distinguish:

- model claim;
- requested tool operation;
- Authority decision;
- executor start/finish;
- observed effect;
- independent verification;
- accepted canonical result.

## 5. Budget semantics

Separate the roles:

| Question | Owner |
|---|---|
| What model/reasoning/tool/repair budget is recommended? | Orchestrator/Model Router |
| Can the requested resource envelope run now? | Resource Admission |
| What effects may occur? | Execution Authority |
| What limits are enforced and what was actually consumed? | Harness/runtime adapter |
| What was observed? | Provenance Ledger |
| Did the result cross acceptance? | Veritas |

Budget fields should include, where available:

```text
max turns
max tool calls
max generation tokens
reasoning setting/level
context limit and reserve
wall timeout
retry budget
repair budget
provider cost budget
RAM/VRAM/CPU envelope
```

Unknown usage remains `UNKNOWN`; the Harness must never silently increase a
budget to rescue a failing model.

## 6. Context and methodology relationship

Context Control constructs the bounded immutable envelope. The Harness consumes
its identity and digest. It may enforce the admitted token/context limit and
record truncation or delivery failure, but it must not select or rewrite context.

Skill Intelligence selects methodology. The Harness records exact Skill/SOP
references and content digests. A Skill cannot grant permission or declare
verification.

## 7. Model/runtime relationship

The Model Router/Orchestrator selects a worker/runtime. The Harness records both
the requested selection and the observed invocation. A fallback, runtime
recycle, provider change, template change, or model artifact change must be a
new provenance event and may require a new attempt depending on policy.

Minimum observed fingerprint:

```text
provider
model id/version
local artifact SHA256 when applicable
quantization
runtime + runtime version
adapter version
chat template
reasoning mode
sampling/configuration
served context
```

## 8. Isolation contract

Comparative attempts must have explicit isolation. The contract must identify:

```text
workspace/worktree or overlay
process owner/generation
ports
environment policy
temporary directory
network policy
before-state digest
after-state/effect observations
cleanup/quiescence evidence
```

If isolation is not available, the attempt must be marked non-comparable rather
than silently treated as a clean control.

## 9. Evidence and Veritas handoff

Harness evidence is observational. It may include:

```text
tool request/result
Authority reference and consumption
process start/exit/generation
filesystem before/after hashes
Git state/diff/commit
test command identity + requested/discovered/executed counts
resource observations
timing/usage/cost when available
uncertainty/failure facts
```

Veritas independently evaluates whether those facts satisfy the acceptance
requirements. A Harness result, model claim, exit code, or evidence-file
existence is never by itself `VERIFIED`.

## 10. Provenance and replay

Harness events feed the existing Provenance Ledger through approved contract
extensions. No `Harness Provenance v2` store is created.

Replay classes:

| Class | Contract |
|---|---|
| Exact | same deterministic inputs/environment and same deterministic tool effects; stochastic model output is excluded unless reproducibly seeded and supported |
| Semantic | same task/envelope/procedure can be re-run with a new model response; original effects remain isolated |
| Observation | original requests, effects, tests, evidence and verdict can be inspected |
| Non-replayable | missing/secret/stochastic/external state is explicitly marked |

Ghost Code should prefer observation/semantic replay over pretending exact replay
exists.

## 11. Recovery semantics

```text
RETRY       same intended work only when effect state is NONE and a fresh envelope is issued
REPAIR      new bounded attempt against observed partial state
CONTINUE    new attempt advances canonical mission state without replaying effects
HANDOFF     context/evidence transfer; never permission transfer
REPLAY      analysis/verification reconstruction; never implicit mutation
```

The Orchestrator/Workflow decides the strategic recovery. Harness enforces fresh
attempt mechanics, uncertainty gates, and evidence capture.

## 12. Security invariants

```text
NO EXECUTION WITHOUT CANONICAL ADMISSION
NO MUTATION WITHOUT EXECUTION AUTHORITY
NO RETRY OF UNKNOWN EFFECT
NO CROSS-ATTEMPT EVIDENCE
NO ACCEPTANCE WITHOUT INDEPENDENT VERITAS EVIDENCE
NO MODEL/SKILL/PROFILE DATA GRANTS PERMISSION
NO PROFILE LOWERS SECURITY OR ACCEPTANCE REQUIREMENTS
NO FOREIGN PROCESS TERMINATION
NO SECRET OR PRIVATE CHAIN-OF-THOUGHT CAPTURE
```

## 13. Anti-goals

The vNext Harness must not become:

- another Orchestrator, Workflow engine, Context builder, Skill selector,
  Authority system, Veritas, Helix, or global provider abstraction;
- a prompt-template dumping ground;
- an unbounded transcript/chain-of-thought recorder;
- a benchmark-specific optimizer;
- an autonomous model marketplace or model-swapping policy.

## 14. Candidate next-slice boundary

The smallest coherent implementation slice suggested by this review is:

> Seal one immutable execution envelope and durable attempt/admission journal for
> the live AgentLoop mutation path, binding existing Workflow, Authority,
> Resource, Context, Skill, model, and budget references without moving their
> ownership.

Acceptance and adversarial tests are specified in the review artifacts. This
slice is a proposal only; implementation is explicitly unauthorized.
