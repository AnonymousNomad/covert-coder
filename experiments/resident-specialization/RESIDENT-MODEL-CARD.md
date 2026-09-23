# FSI COVERT RESIDENT — MODEL CARD

Status: **SEAT VACANT (specialization blocked on training hardware).**
Date: 2026-09-23.

## Lineage
```
FSI Covert Resident (planned)
Derived from LiquidAI/LFM2.5-2.6B
Covert Resident specialization (LoRA SFT -> DEV -> DPO where justified -> merge
-> GGUF Q4_K_M/Q5_K_M -> quantization parity -> frozen qualification)
```
Liquid attribution is explicit and must remain so in any public-facing statement.

## Current artifacts
| Artifact | Identity | State |
|---|---|---|
| Baseline candidate (preserved, §30) | `LFM2.5-2.6B-QAD-Q4_0.gguf` sha256 `a247afd6414918eac8e520a9e6137dc271235461ecbe1180462221d5b8d40b03` | **REJECTED for the permanent seat** (model-behaviour failures named in `LIQUID-CLOSURE-WAVE-REPORT.md`); preserved as the measurement baseline |
| Specialization dataset | train `4d7d14fd…` (147 rows) · dev `6ea59bae…` (14 rows) | READY (leak-guarded, provenance-complete) |
| 1.2B Instruct control | `RESIDENT-DEV-RESULTS.json` | 5/14 DEV — generic instruct tuning insufficient |
| Specialized candidate | — | NOT TRAINED (hardware blocker) |

## Known behavior of the preserved baseline (the gap specialization must close)
1. Unreliable authority-policy application (`requires_approval` varied across
   identical runs).
2. Compound-instruction adherence failures (required obligations omitted).
3. Recurring protected-claim violations requiring containment fail-closed.

## System context (frozen, proven)
Covert HEAD `ccbe553…` with the repaired adapter chain (prompt-fit mutilation,
generation cap, `--jinja`, sampling, abort wedge, retrieval vocabulary, authority
context, probe auto-recovery, 600 s timeout). Helix, Context Control, generation
admission, containment (13/13) and the runtime battery (11/11) are accepted and do
not move for a candidate.

## Intended use
The SEAT only: understanding, reconstruction, retrieval discipline, capability
discovery, delegation, evidence interpretation, continuity. NOT a coding workhorse
(one Resident, many replaceable workers).

## Limitations (current)
- No trained candidate exists; the seat remains vacant.
- CPU-only serving on the current box (no GPU inference build); 5–10 tok/s at
  2.6B-class, coexistence envelope 1.8–3.7 GB free RAM.
- The completed specialization requires a machine with a supported training stack
  (see `RESIDENT-TRAINING-PLAN.md`).

## Licensing note
The specialization derives from LiquidAI LFM2.5 weights: the resulting model card
must carry the upstream license and attribution. The dataset in this repository is
original, authored in-repo, with no external corpus copied.
