# RESIDENT PATH ISOLATION MATRIX (compound-failure localization)

Specimen: `The parser tests are failing. Give me the workflow stage, the governing
procedure, and the role that owns the fix.` (frozen compound row dev-cmp-01).
Obligations: A) stage = IMPLEMENTATION · B) SOP = resident.handle-verification-failure · C) role = coder.
Same models, prompt, sampling (t=0.1, top_k 50, rep 1.1), reserve 1024, containment.

## Layer ladder (Granite 3.3 2B, compound specimen)
| Layer | What the model received | Score | Behavior change |
|---|---|---|---|
| RAW MODEL (direct engine) | the task only | **1/3** | rambling "structured approach"; guessed "Development" |
| ADAPTER (runtime path, harness:false) | the task only | **0/3** | same ramble; no obligations |
| COVERT PATH (scaffold + awareness) | +harness scaffold/envelope | **1/3** | unchanged |
| + SEAT SYSTEM | +seat doctrine (no facts) | **0/3** | invented "DEV-PROC-001", "QA team" |
| + PROJECTIONS (obligations only) | +required-obligations block | **0/3** | invented "Test Execution" procedure |
| + CANONICAL FACTS | +stage/SOP ids/workers/authority | **0/2 rows** | fabricated against the premise ("all tests are green") |
| + FACTS + PROJECTIONS | everything deterministic | **0/2 rows** | still contradicts the premise; still no enumeration |

## Terminal-SFT (Liquid derivative)
| Layer | Score | Note |
|---|---|---|
| RAW MODEL | **0/3** | empty content at reserve 1024 (thinking block consumed the budget; the documented Liquid-family behavior) |
| Seat Screen (with facts) | compound 0/2 | same class |

## First failing transition
**The RAW MODEL itself.** With zero Covert layers the compound task is already
failed; every added deterministic layer (facts, obligations, doctrine) leaves it
failed or worse. The previously suspected "Covert-induced degradation" is
**disproven** — and a real harness gap *was* found and fixed (the screen omitted
the canonical facts; after supplying them the failure persisted).

## Classifications (§19 taxonomy)
| Observation | Classification |
|---|---|
| Granite/Terminal fail the compound rows at every layer incl. RAW | **MODEL_FAILURE** (instruction adherence / premise holding at the 2–3B class tested) |
| Screen omitted machine-known canonical facts (stage/SOP/roles/authority) from the working context | **CONTEXT_CONTROL_FAILURE → REPAIRED (generic)**: run-dev now composes the canonical context block (same as the battery/parity runners); model-neutral |
| Obligation projection without facts → confident hallucination ("DEV-PROC-001", "Test Execution") | **PROMPT_ARCHITECTURE** — obligations alone are insufficient; per §8 the projection hypothesis for compound is **UNSUPPORTED/INCOMPLETE**; kept behind `AIDE_SEAT_PROJECTIONS` (not declared the fix) |
| Granite's premise inversion ("all tests are green" while the task states failing) | **MODEL_FAILURE** (truth discipline) — candidate containment hardening noted ("tests are green" paraphrase not yet in the FABRICATION family; recorded, not patched, per the freeze on further patching) |

## Consequence
- The recurring compound 0/2 across Macaw, Terminal-SFT and Granite is **model
  behavior**, not a Covert defect; the pool continues to be screened against the
  frozen contract with the repaired canonical-context screen.
- Covert's legitimate transfers stand: canonical **facts** (now supplied),
  permission/reasoning separation (Archived Authority), and containment of
  unsupported claims. Obligation *solving* remains the model's job.
- Per §22, resume the pool (SmolLM3 → Phi-4 → fable5) with the repaired screen;
  promote any survivor through tool roundtrip → resource → frozen qualification.
