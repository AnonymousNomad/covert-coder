# RESIDENT SFT REPORT

Status: **NOT_STARTED — BLOCKED (genuine hardware/training blocker).**
Date: 2026-09-23. Lane: DeepSeek #2 (Resident subsystem).

## What was completed (everything that does not require the training hardware)
- **Training plan + frozen system record** — `RESIDENT-TRAINING-PLAN.md` (Covert HEAD
  `ccbe553…`, repaired adapter/router/containment hashes, contract + profile frozen).
- **TRAIN/DEV dataset** — `dataset/train.jsonl` (147 rows / 73 authored items, 7
  behavior classes, 12 domains) + `dataset/dev.jsonl` (14 rows), with provenance
  (`dataset/PROVENANCE.json`), best-effort 8-gram leak guard against the frozen
  parity + battery prompts (PASS), near-duplicate rejection (Jaccard < 0.85), no
  filler/CoT in targets. Hashes: train `4d7d14fd…`, dev `6ea59bae…`, seat system
  `3df29812…`.
- **Training manifest** — `RESIDENT-TRAIN-MANIFEST.json` (LoRA SFT config, DPO
  preconditions, quantization + qualification records, acceptance standard).
- **DEV harness (model-neutral)** — `run-dev.mjs` (drives a candidate through the
  governed Covert chat with the seat system message and per-item deterministic
  checks).
- **1.2B Instruct CONTROL (§19)** — live result `RESIDENT-DEV-RESULTS.json`:
  **5/14** (AUTHORITY 1/3 · CLAIM 0/3 · COMPOUND 0/2 · ROUTING 1/2 · TOOL 1/2 ·
  COMMUNICATION 2/2). The control's failures are genuine seat failures — including
  a **bare false authorization** ("The patch has been reviewed and authorized for
  release." with no approval recorded). Generic instruction tuning does not supply
  the Resident seat behaviors; the specialization premise is supported.
- **Resource profile** — `RESIDENT-RESOURCE-REPORT.json` (2.6B coexistence
  envelope measured; CPU-only generation 5–10 tok/s; no GPU build on disk).
- **Baseline preserved (§30)** — original rejected candidate hash, profile, closure
  and root-cause reports, parity/battery outputs untouched.

## Why SFT did not start (the blocker, verified not assumed)
| Gate | State |
|---|---|
| Official native `LiquidAI/LFM2.5-2.6B` post-trained checkpoint | **not on disk** (only the Q4 GGUF baseline); ~5.2 GB fetch over a link measured at 1.09 MB/s best-case with stalls |
| Training stack | `E:\models\house-model\training-venv` (5.1 GB) holds a **half-removed torch** (`site-packages/~orch` = aborted pip operation); `import torch` fails; no peft/transformers/datasets |
| GPU training class | GTX 1060 6 GB, CC 6.1, FP32-only; the project's own measured ceiling is ~150M trainable params; the 4-bit path required for a 2.6B LoRA is not available on this class |
| Disk | C: 9.7 GB free (torch + deps + cache ≈ 4–6 GB) |

Per the directive, this is a **genuine hardware/training blocker**: no SFT step can
run on this machine. No training was attempted; nothing was faked; the dataset and
manifests are ready so the first valid step on capable hardware is a single command
bulk (see `RESIDENT-TRAINING-PLAN.md` → Resume steps).

## Classification
SFT: **BLOCKED** · DPO: **NOT_REQUIRED_YET** · GRPO: **NOT_STARTED**
Family disposition (§28): **UNRESOLVED — no training attempt was possible; the
2.6B family cannot be rejected or accepted from untrained evidence.**
