# RESIDENT SYSTEM GAP ANALYSIS

Framework per the marathon directive §30: for every requirement a candidate
fails, decide which layer SHOULD carry it. The Resident model carries only the
intelligence that genuinely requires a model; everything deterministic moves to
its correct Covert layer. Completed with per-candidate results as they land.

## Layer responsibility map
| Requirement | Correct layer | Status in Covert |
|---|---|---|
| Project truth, history, supersession | **Helix** | ACCEPT (frozen) |
| What enters the working context | **Context Control** | ACCEPT (frozen, bounded) |
| Permission (who may do what) | **Authority** (canonical policy + exact operations) | ACCEPT (enforced; hard denial of un-enrolled mutations) |
| Execution | **Harness** (approved operations only) | ACCEPT |
| Proof / verified state | **Veritas** (deterministic checks) | ACCEPT (advisory model opinion can never override) |
| Workflow structure and stage gates | **Workflow kernel** | ACCEPT (evidence-gated) |
| Methodology | **Skills/SOPs** (bounded discovery) | ACCEPT (rev 6; ≤3 candidates / ≤2 bodies) |
| Bounded capability surface | **Arsenal projection** | ACCEPT |
| Worker delegation contract | **Worker bridge** (proposal-only) | ACCEPT |
| Protected-claim fail-closed | **Containment** (deterministic) | ACCEPT (13/13; stream parity) |
| Generation admission / engine lifecycle | **Runtime adapter** | ACCEPT (closure wave) |
| **Task understanding, reasoning, summarization, routing judgment, truthful reporting in natural language** | **THE MODEL** | this is the only layer a candidate must own |

## Classification of the known failure classes (from the rejected baseline)
| Failure class | Verdict | Rationale |
|---|---|---|
| Authority-policy application inconsistency | **SHOULD BE DETERMINISTIC (already is) + model communication** | The canonical policy is deterministic; the model only needs to *communicate* the canonical state. Where a task asks the model to infer the policy from prose, that is an exam artifact; the architecture law says Authority decides. The qualification screen therefore grades the model's communication of supplied canonical state, not policy invention. |
| Compound-instruction omissions | **SHOULD BE WORKFLOW/SKILL** | Where the workflow already knows the required obligations, the orchestrator can project an explicit obligation list; the model then satisfies/routes each item. Bounded, model-neutral; never a candidate-specific hint. |
| Protected-claim violations | **SHOULD BE VERITAS/CONTAINMENT (already is)** | Verified state is established by canonical evidence only; the model must not contradict it in what it ships. Containment fails closed on unsupported protected claims. |
| Retrieval failures | **SHOULD BE HELIX/CONTEXT (already is) + model discipline** | Retrieval is system-side; the model must recognize retrievability and not invent. |
| Tool-call format | **SHOULD BE MODEL ADAPTER** | Model-native syntax normalizes to the canonical proposal before Authority; never into general Covert semantics. |

## Per-candidate outcomes (filled as results land)
| Candidate | Screen | Fast-reject criticals | Promoted | Classification |
|---|---|---|---|---|
| LFM2.5-2.6B-QAD (baseline) | 2/6 parity · DEV n/a | authority inconsistency (parity) | no | REJECTED (model-behaviour) |
| Macaw Q4_K_M | pending | pending | pending | pending |
| LFM2.5-2.6B-Terminal-SFT Q4_K_M | pending | pending | pending | pending |
| Granite 3.3 2B Instruct | pending | pending | pending | pending |
| SmolLM3 3B | pending | pending | pending | pending |
| Phi-4-mini Instruct | pending | pending | pending | pending |
