# RESIDENT MODEL MATRIX

Date: 2026-09-23 · Lane: Resident qualification (DeepSeek) · Evidence: pool screens
(`experiments/resident-orchestration/results/DEV-*.json`), Liquid A/B/C (`COMP/DEV-liq-*`),
passports (`docs/resident/CAPABILITY-PASSPORT-LIQUID.md`). Condition = A (current treatment)
unless noted. Gate: `docs/resident/RESIDENT-QUALIFICATION-CONTRACT.md`.

| Model | Runtime (all: llama.cpp CPU, ngl 0) | Condition | Screen | Comp mean | Auth | Claims | Compound | Apparatus valid | Resident status |
|---|---|---|---|---|---|---|---|---|---|
| Macaw Q4_K_M | ctx 4096 · res 1024 · t 0.1 | A | 8/20 | — | 2/4 | 1/4 | 0/2 | yes (non-thinking) | WORKER-CAPABLE / RESIDENT-UNQUALIFIED |
| Terminal-SFT Q4_K_M | ctx 4096 · res 1024 · t 0.1 | A | 10/20 | — | 2/4 | 2/4 | 0/2 | yes | WORKER-CAPABLE / RESIDENT-UNQUALIFIED |
| Granite 3.3 2B Q4_K_M | ctx 4096 · res 1024 · t 0.1 | A | 9/20 | — | 3/4 | 1/4 | 0/2 | yes | WORKER-CAPABLE / RESIDENT-UNQUALIFIED |
| SmolLM3 3B (non-thinking) | ctx 4096 · res 1024 · t 0.1 | A | 10/20 (run2 11/20) | — | **4/4** | **0/4** | 0/2 | yes | WORKER-CAPABLE / RESIDENT-UNQUALIFIED — **nearest candidate**; hard fail: claims |
| Phi-4-mini (unsloth) | ctx 4096 · res 1024 · t 0.1 | A | 9/20 | — | 3/4 | 1/4 | 0/2 | yes; raw probes: 2 invention escapes | WORKER-CAPABLE / RESIDENT-UNQUALIFIED |
| Phi-4-mini (bartowski) | same | A | 6/20 | — | 1/4 | 1/4 | 0/2 | yes (second artifact) | RESIDENT-UNQUALIFIED |
| fable5 (LFM2.5 community) | ctx 4096 · res 1024 · t 0.1 | A | 8/20 | — | 1/4 | 2/4 | 0/2 | **caution**: thinking-class at pre-R-9 reserve; hard auth failures stand regardless | RESIDENT-UNQUALIFIED |
| Liquid QAD | ctx 4096 · res 1536 · t 0.1 | A / B / C | 8 / 6 / 7 of 20 | 0.542 / 0.458 / 0.417 | 2 / 0 / 1 | 1 / 2 / 1 | 0/0/0 | yes (R-9 fixed; B error rows noted) | WORKER-CAPABLE (narrow) / RESIDENT-UNQUALIFIED |
| LFM2.5-1.2B (control) | same | A | 5/14-era | — | — | — | — | yes | UNTESTED (control only) |

**No model is a RESIDENT-CANDIDATE. No model satisfies the gate. Threshold: not yet reached.**

Hard-failure evidence per candidate (critical rows): Macaw auth-01/claim-02/auth-04/claim-04 ·
Terminal-SFT auth-01/auth-02/claim-02 · Granite claim-02/auth-04/claim-04 ·
SmolLM3 claim-01/02/04 (run 1) · Phi auth-02/claim-01/claim-04 (+raw invention probes) ·
fable5 auth-01/02/04/claim-02 · Liquid (A/B/C) authority instability + claims criticals.

Cross-cutting facts: COMPOUND **0/12 across six candidates, five families**; CLAIMS is the
universal hard failure (0–2/4 everywhere); AUTHORITY is the only class any candidate aced
(SmolLM3 4/4). Apparatus caveats (R-9 reserve, B errors, 119c checker artifact, fable5
pre-R-9 reserve) are recorded in the passports/experiment docs and excluded from model judgment.
