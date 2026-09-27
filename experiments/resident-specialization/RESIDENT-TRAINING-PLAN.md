# RESIDENT TRAINING PLAN (Liquid specialization)

Goal: determine whether targeted post-training can produce a Covert-specific
Liquid Resident that satisfies the EXISTING frozen Resident contract. The contract,
batteries and scoring do not move; the model must earn the seat.

## Pipeline (bounded stages, each gated)
```
official native checkpoint (LiquidAI/LFM2.5-2.6B)
  -> LoRA SFT on TRAIN (dataset/build-dataset.mjs, hash-locked)
  -> DEV evaluation per checkpoint (run-dev.mjs)      [tuning decisions only]
  -> LoRA-DPO where justified (near-miss pairs)
  -> merge -> GGUF conversion -> Q4_K_M / Q5_K_M
  -> quantization parity on DEV
  -> FROZEN QUALIFICATION: 6-task parity + 12-task/8-class + authority/claim/
     compound checks + tool roundtrip + containment + runtime/resource
  -> ACCEPT only if: 0 false-success escapes, 0 protected-claim violations,
     0 critical Authority inconsistencies, 0 process leaks, 0 unresolved
     system-side defects, compound adherence meets the contract, tool roundtrip
     passes, resource coexistence passes.
```

## Frozen system record (recorded 2026-09-23; does not move for the candidate)
| Item | Value |
|---|---|
| Covert HEAD | `ccbe5539968780130793ecf9b628ded13b610ef6` (branch covert-production) |
| model-runtime.ts (repairs: admission, --jinja, recycle, timeout 600s) | `29655bf7b38f9d2b` |
| model-router.ts (repairs: fit mutilation, probe auto-recovery) | `7673cd522d468b5a` |
| resident-containment.mjs | `468011f0ed8dcd92` |
| Liquid runtime profile | `e3de9a591aa088ed` |
| Liquid model sidecar (samplers ngl) | `afa1f7c3a16f7bf9` |
| Resident SOP catalog (rev 6) | `6145b3394d38c67a` |
| Resident contract | `RESIDENT-CONTRACT.md` (frozen 2026-09-22) |
| Frozen batteries | parity-suite.mjs (6 tasks) + battery/TASKS.json (12 tasks / 8 classes) |
| Chat template / parsers / context / Helix / authority context / retrieval | frozen as recorded in `LIQUID-ADAPTER-CONTRACT.md` + `RESIDENT-SPEC.md` |
| Dataset hashes | see `dataset/PROVENANCE.json` (train `4d7d14fd…`, dev `6ea59bae…`) |

Only legitimate model-specific runtime metadata may change where documented model
behavior requires it (e.g., a new profile sidecar for a new artifact).

## Baselines preserved (original rejected candidate — measurement baseline)
- Artifact: `LFM2.5-2.6B-QAD-Q4_0.gguf` sha256 `a247afd6414918eac8e520a9e6137dc271235461ecbe1180462221d5b8d40b03`
- Runtime profile + closure report + batteries: `LIQUID-CLOSURE-WAVE-REPORT.md`,
  `RESIDENT-CONTEXT-ROOT-CAUSE-REPORT.md`, `results/LIQUID-PARITY-BATTERY.json`.

## Counters
- **CONTROL (1.2B Instruct)** — §19 bounded control, live result recorded in
  `RESIDENT-DEV-RESULTS.json`. No primary budget invested.
- **UNCENSORED control** — §20: not started; only permitted as an experimental
  control after a primary candidate exists; if it proves more compliant with
  incorrect framing or less willing to abstain, it is rejected immediately.
- **GRPO** — §18: not started; permitted only if SFT and DPO improve behavior but
  specific machine-checkable failure classes remain. Reward spec to be written
  before any training.

## HARDWARE REALITY (recorded 2026-09-23 — the current blocker)
| Gate | State | Evidence |
|---|---|---|
| Native 2.6B checkpoint | **NOT ON DISK** | `E:\models\lfm2.5-2.6b-qad-q4_0\` holds only the Q4 GGUF; no safetensors anywhere for 2.6B (search logged) |
| Training stack | **BROKEN** | `E:\models\house-model\training-venv` (5.1 GB): `import torch` fails; `site-packages/~orch` remnant = aborted pip operation; no peft/transformers |
| GPU training path | **OUT OF DEVICE CLASS** | GTX 1060 6 GB, CC 6.1, FP32-only (no Tensor Cores); project's measured ceiling: ~150M params (`model-scaling`), 4-bit QLoRA path not supported on this class; a 2.6B adaptation is not trainable here |
| Disk | tight | C: 9.7 GB free (pip/torch would need ~4-6 GB + cache), E: 224 GB free (models/checkpoints OK) |
| Network | unreliable | 5.2 GB native download at observed 1.09 MB/s best-case with multi-minute stalls (session evidence) |

Per the directive this is a **genuine hardware/training blocker**: valid work
stops at the training gate, and the following were completed instead — dataset,
DEV harness, control evaluation, manifests, provenance, exact resume steps.

## Resume steps (on a machine with ≥16 GB VRAM and a working CUDA/PEFT stack)
1. Fetch `LiquidAI/LFM2.5-2.6B` native (post-trained) checkpoint; record sha256.
2. Rebuild the venv: python 3.10 + torch (cu121+), transformers, peft, datasets,
   accelerate, bitsandbytes (verify 4-bit support on the target GPU), trl.
3. `node experiments/resident-specialization/dataset/build-dataset.mjs`
   (verify the recorded hashes match `PROVENANCE.json`).
4. Run SFT per `RESIDENT-TRAIN-MANIFEST.json` (LoRA first, resumable, checkpoints
   preserved); after each meaningful checkpoint run `run-dev.mjs`.
5. DPO where the DEV results show preference-level errors; then merge, convert to
   GGUF (record converter version + hashes), quantize Q4_K_M/Q5_K_M, run
   quantization parity, then the FROZEN qualification (no tuning after inspecting
   individual frozen failures unless the candidate is formally retired).
6. ACCEPT/REJECT per §26/§28; family rejection requires: system correctness proven,
   training pipeline correctness proven, SFT completed, DPO completed where
   justified, DEV improved or plateaued, frozen battery still failing on
   model behavior/capacity rather than infrastructure.
