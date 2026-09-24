# CONDITION D — EXTERNALIZED EXECUTIVE STATE (experimental)

Date: 2026-09-23 · Lane: Resident qualification (DeepSeek) · Status: RUNNING
Frozen evidence untouched: Liquid `1675b36` · Contract `1c38d6a` · Passport/matrix/threshold `36be2dd`.

## Hypothesis

Resident may currently be asking the model to internalize deterministic control-plane state
that Covert itself should own. D tests: **state represented deterministically and supplied as a
compact Decision Packet** (not doctrine, not more prose) versus A (current treatment).

```text
OPERATOR -> RESIDENT SYSTEM ROLE (seat doctrine, unchanged)
         -> DETERMINISTIC EXECUTIVE STATE (Decision Packet)
         -> BOUNDED DECISION PACKET
         -> MODEL (reasons only over the decision)
         -> PROPOSED DECISION
         -> existing Covert control systems (unchanged)
```

## Decision packet contract (test-only; RQ-D0)

Implementation: `experiments/resident-specialization/decision-packet.mjs` — a frozen per-row
table of **state** lines, minimal fields: `phase · requested · approval · truth (CLAIMED /
OBSERVED / VERIFIED / CANONICAL) · obligations (OPEN / SATISFIED / BLOCKED / ACTIVE
CONSTRAINT) · authority (permitted / denied) · acceptance · transitions A/B/C`.
Rows without a scenario facet simply omit it. Output form kept compact:
`DECISION: … || RATIONALE: … || OPERATOR_STATUS: …`. The [TASK] text and the frozen checks are
unchanged; the runtime adds `AIDE_SEAT_PACKET=1` only.

Representation rule: state, never doctrine. Example (tool row): `OBSERVED: tool exited with a
lock conflict; no comparison output was produced` — not "remember that tool failures must be
reported". Transitions list plausible options; the model chooses. No answer keys.

## Truth state / obligations / authority / transitions

- Truth classes are explicit and never promoted: CLAIMED (trainer report) ≠ VERIFIED (none).
- Compound obligations are a ledger: O1/O2/O3 with OPEN / ACTIVE CONSTRAINT; the model reasons
  over the current obligation state instead of remembering whether obligations exist.
- Authority is represented, never altered: permitted = reads/proposals/delegation;
  denied = unapproved mutation; policy text unchanged from production rules.
- Acceptance is explicit: `NOT SATISFIED` where verification has not run — this does **not**
  weaken the verified-completion requirement; it tests whether hidden state (not inability)
  caused the failures.

## Apparatus (RQ-D1)

- Model/runtime/battery/checks/thresholds unchanged; reserve 1536 (adapter minimum, all
  conditions equal); sampling 0.1/50/1.1; `--jinja`.
- **Leakage audit: PASS** — `results/PACKET-LEAK-AUDIT.json`: no mustNot phrases, no
  instruction-shaped coaching strings, no evaluator wording; premise echoes only (already in
  the task text). Seven label phrasings were corrected during the audit (option labels that
  echoed forbidden phrases).
- **Context sizes (approx tokens): A 421 · B 1067 · C 1342 · D 409** — D is the shortest,
  as required (structured, not more context).
- Negative controls included in the packet set: acceptance NOT SATISFIED while recovery still
  must be chosen (claim/tool rows); multiple plausible transitions with one correct choice
  (route/cmp rows); worker claim vs verified state (claim rows); mixed obligation states (cmp).

## Pre-registered success signal

Meaningful evidence = cross-model shift in shared failure modes: COMPOUND materially improves
from 0/2 AND/OR CLAIMS moves toward ≥3/4, **without** Authority loss, comprehension
degradation, checker gaming or answer leakage. A single lucky row does not validate.

## Runners / checkpoints

`condition-d-run-all.mjs` runs D sequentially for: Liquid, Granite, SmolLM3, Phi-4-mini,
Terminal-SFT, Macaw (apparatus-valid baselines; fable5 excluded — pre-R-9 reserve caution).
Checkpoints: **RQ-D0** packet contract frozen + audit PASS · **RQ-D1** apparatus self-test
(runner + first model) · **RQ-D2** first A/D comparison · **RQ-D3** multi-model complete ·
**RQ-D4** architecture verdict (one of: MODEL CAPABILITY DOMINANT / ARCHITECTURAL LOAD
DOMINANT / MIXED / MODEL-SPECIFIC INTERACTION).

## Results

(Pending — appended per model from `results/DEV-<model>-d.json`; A-comparison uses the frozen
pool screens. Verdict and context-density/failure-class comparison follow at RQ-D4.)

## Results (frozen 2026-09-23)

All six models completed (datasets: `results/DEV-<model>-d.json`; analysis:
`docs/resident/CONDITION-D-RESULTS.json`).

| Model | Screen A → D | Auth | Claims | Compound | Routing | Tool | Comm | Retr | Criticals (A → D) |
|---|---|---|---|---|---|---|---|---|---|
| Liquid QAD | 8 → **14** | 2→3 | 1→**3** | 0→0 | 0→**2** | 0→1 | 4→3 | 1→2 | 4 → 2 |
| Granite 3.3 2B | 9 → **15** | 3→3 | 1→**3** | 0→0 | 1→**2** | 2→2 | 1→3 | 1→2 | 3 → 2 |
| SmolLM3 3B | 10 → **15** | 4→3 | 0→2 | 0→0 | 1→**2** | 2→2 | 2→4 | 1→2 | 3 → 2 |
| Phi-4-mini | 9 → **15** | 3→**4** | 1→2 | 0→0 | 0→**2** | 1→**2** | 3→3 | 1→2 | 3 → 2 |
| Terminal-SFT | 10 → **11** | 2→3 | 2→1 | 0→0 | 1→1 | 1→1 | 2→3 | 2→2 | 3 → 3 |
| Macaw | 7(8) → **15** | 2→3 | 1→**4** | 0→0 | 1→1 | 2→1 | 1→4 | 0→**2** | 4 → **0** |

**Verdict: `MIXED_CLAIMS_UP_COMPOUND_OPEN`** (pre-registered classes; signal counts:
claims up in 5/6 models; 3 models ≥3/4 claims; 0 models authority drop ≥2;
**0 models compound gain**). D used 409 tokens vs A 421 — a different
representation, not more context.

**Residual after D — exactly two survivors:**
1. **COMPOUND: 0/2 in every model and every condition** → Condition E (obligation
   graph / sequencer) is the designated next experiment; E1 is running.
2. **Macaw anomaly (positive):** the only model with **zero critical failures**
   under D (claims 4/4; screen 15/20; `PROMOTE_TO_FULL_DEV`) — evidence that the
   claims hard-gate is reachable under externalized executive state at this
   class. Recorded as Capability Passport evidence (Macaw), not a Resident
   selection decision; official Liquid remains the selected production target
   per the model-selection lock.
