# COMPOUND OBLIGATION RESOLUTION — RESEARCH NOTE

Date: 2026-09-23 · Lane: Resident qualification (DeepSeek) · Status: E frozen; F running
Sources: `CONDITION-E-RESULTS.json`, `CONDITION-E-HELDOUT-RESULTS.json`,
`CONDITION-D-RESULTS.json`, `heldout.jsonl`, chain logs. Evidence SHAs in the lane log.

## Problem

Compound work (holding 2–3 interacting obligations in one episode) has been the single
unresolved Resident failure class: 0/2 on the frozen screen for every model, family and
condition, before and after the Condition D externalization. The question: is compound
failure model capability, relation representation, sequencing, or a model×treatment
interaction?

## Prior Resident evidence

- **COVERT FACT — Condition D** (`068c936`, `MIXED_CLAIMS_UP_COMPOUND_OPEN`): externalized
  executive state (Decision Packet, 409 tokens < baseline 421) lifted every family +5–6 rows
  on the frozen screen (Liquid 8→14, Granite 9→15, SmolLM3 10→15, Phi-4 9→15, Macaw 7→15,
  Terminal-SFT 10→11), claims up in 5/6 models, **compound still 0/2 everywhere**.
- **COVERT FACT — the claims tail moved under D** (3 models reached ≥3/4; Macaw 4/4 with zero
  criticals), proving the claims hard-gate is reachable at this class via representation.

## External research (EXTERNAL FACT / HYPOTHESIS)

- Small-model instruction-following degrades with multi-constraint prompts (instruction
  dilution — IFScale-style evidence; also the earlier in-repo smollm2-360M battery, negative
  score on prose scaffolding).
- Covert's own accepted lesson: **more scaffolding is not inherently better**; adaptation may
  require removing interventions.
- HYPOTHESIS tested here: if obligations are atomized, typed, related and (E2) sequenced with
  system-owned completion, the bookkeeping burden leaves the model and only judgment remains.

## Condition E design (COVERT FACT — pre-registered)

E1 = D packet + obligation graph (ACTION/PRESERVE/VERIFY/REPORT/PROHIBITION/FORALL, REQUIRES
relations, system-owned completion rule). E2 = graph + deterministic sequencer (READY-only
projection, persistent invariants, system-tracked remainder, evidence-backed transitions,
terminal completion impossible while required work is unresolved). Held-out battery: 8 new
compound rows (generic treatment compiler; no per-row hardcoding; leakage audit PASS).

## E1 result (COVERT FACT)

Verdict **MODEL_SPECIFIC_INTERACTION**: compound-passing families = **1 of 6** (Macaw cmp-02
only). Screens: Liquid 14→13, Granite 15→14, SmolLM3 15→13, Phi-4 15→15, Terminal-SFT 11→15
(+4), Macaw 15→14; minor control regressions (1–4/model). The graph representation alone does
not solve compound cross-family.

## E2 result (COVERT FACT)

Verdict per frozen rule: **SEQUENCING not dominant either** — families with a compound pass
under the sequencer = **2 of 6** (SmolLM3 cmp-02, Macaw cmp-02; Macaw passed both treatments).
Screens: Liquid 13→15 (claims 4/4), Terminal 15→14, others flat.

## Held-out result (COVERT FACT — decisive instrument)

Treatment E2, 8 rows × 6 models:

| Model | Held-out | Critical | Apparatus |
|---|---|---|---|
| Liquid QAD | 1/8 | h-cmp-01 | — |
| Granite | 4/8 | — | — |
| SmolLM3 | 4/8 | h-cmp-01 | — |
| Phi-4-mini | 7/8 | h-cmp-01 | — |
| Terminal-SFT | 5/8 | — | h-cmp-04 |
| Macaw | 4/8 | — | h-cmp-03 |

Recurring critical: **h-cmp-01 (ACTION+VERIFY — "what makes the repair accepted")** fails as
terminal-completion/acceptance discipline in 3 models. No model cleared the battery cleanly;
pass rates vary 1–7/8. Compared with the 0/2 screen baseline this is *partial improvement*, but
the pre-registered cross-family bar (≥3 families materially) and the no-terminal-violation bar
are **not met**.

## Condition E freeze (COVERT FACT)

```text
E ACCEPTED: NO
SKILL EXTRACTED: NO (held-out did not cleanly pass; do not manufacture a skill from an
unresolved experiment)
cross-family verdict: MODEL_SPECIFIC_INTERACTION
control regressions: present (1-4/model)
terminal-completion violations: h-cmp-01 critical in 3 models
0c/apparatus exclusions: preserved per standing rule (no selective rescoring)
```

## Architectural implications (INFERENCE)

1. Compound is **not** a single missing representation. Atomization helps *some* rows for
   *some* models (held-out 4–7/8 vs 0/2 screen), but the shared failure now concentrates in
   **acceptance/terminal discipline** (h-cmp-01): telling "what makes it accepted" from state.
2. The D treatment remains the strongest validated intervention (broad +5–6 gains at less
   context). E's additions carry a small control cost and no reliable compound gain; **do not
   wire E into production ahead of D** without a cleaner held-out pass.
3. For the production candidate (official Liquid Q4_K_M), Condition F should carry **D as the
   base treatment** and treat the E additions as optional; the final gate still requires
   COMPOUND ≥1/2 on the frozen screen and zero hard failures — where h-cmp-01-style acceptance
   discipline will be the exact pressure point.

## Remaining uncertainty (UNVALIDATED HYPOTHESIS / OPEN)

- Whether acceptance discipline ("what makes this accepted") is best solved by the existing
  **Veritas/evidence projection** rather than any obligation representation — not yet tested.
- Whether a stronger artifact (official Liquid vs QAD/derivatives) changes the compound
  picture — Condition F (running) will provide the first evidence.
- Whether the 0c signature on compound rows is purely budget (F2's preregistered 1536→2048
  diagnosis) or template/extraction — F2/F3 will classify.
