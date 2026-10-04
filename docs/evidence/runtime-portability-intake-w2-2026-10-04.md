# W2 Runtime Portability Intake — 2026-10-04

## Status

**Source audit complete. External runtime research intake pending. No additional backend selected.**

This is a read-only architecture audit of the W1 candidate at commit
`1a4b5ebe5ccedef0c93a0ad9c8f758659559793f` on
`feat/runtime-gfx900-compat`. It records current extension boundaries; it does
not qualify gfx900, select another runtime, or authorize contract changes.

Issue #38 was checked before this audit. Its latest visible comment is owner
handoff `5976321663`; no later portability research or Sol correction was
present in the issue comments. No runtime-portability research artifact was
found in this checkout. The vendor/runtime comparison assigned to Cloud Luna
therefore remains unverified here; absence from this checkout and issue does
not establish whether it exists elsewhere.

## Question and answer

> Can another legitimate adapter be added without rewriting canonical model
> identity, qualification, Resource Admission, or Model Manager semantics?

**No, not as an adapter-only addition.** The existing logical model and
artifact identity shapes are reusable. Runtime selection, qualification,
profile binding, admission, and Model Manager projections remain explicitly
constrained to Unsloth plus one llama.cpp recovery path. A third runtime would
need a coordinated, evidence-backed extension across those owners.

## Repository evidence

| Owner | Current evidence | Portability consequence |
|---|---|---|
| Logical identity | `RuntimeModelIdentity` carries model ID, artifact name, SHA-256, and identity evidence. `ModelQualificationBasis` carries source revision, artifact SHA-256, runtime ID, and runtime version. | These identity fields can remain stable; a runtime name must not replace the model or artifact identity. |
| Runtime contract | `RuntimeBackend` is the closed set `UNSLOTH` and `LLAMA_CPP`; runtime status fixes `canonical_backend` to `UNSLOTH`; fallback events use the same closed set. | Adding a third backend changes shared runtime and generated API contracts. |
| Runtime Broker | `RuntimeBroker` owns one required Unsloth canonical adapter and one optional recovery adapter hard-coded to llama.cpp. | Its topology cannot register/select a third operator-selected runtime as an adapter-only change. |
| Runtime composition | `openapi.ts` accepts only `unsloth` or `llama-cpp` from `AIDE_LOCAL_RUNTIME_BACKEND` and constructs the two adapters directly. | A third runtime also changes configuration validation and canonical composition. No automatic selection/fallback is present. |
| Qualification and profiles | Runtime qualification is keyed by backend, runtime version, and artifact SHA. The current accepted passport and bound profile validation are Unsloth-specific. The llama.cpp compatibility path rejects runtime-bound profiles and remains unqualified. | The identity tuple is reusable, but qualification policy, profile schema/validation, and evidence must be runtime-specific; qualification cannot be inherited. |
| Model Manager | The response contract fixes canonical/default runtime IDs to `unsloth` and limits `reported_backend` to the two current values. The view derives configured runtime ID by lowercasing that backend. | Runtime discovery, default/selection semantics, and response projection require an explicit extension. |
| Resource Admission | Generic admission accepts memory, VRAM, and CPU requirements. The separate local-runtime gate requires 6,656 MiB free physical memory, 5,120 MiB free commit, 4,608 MiB free VRAM, and GPU utilization below 50 percent. Its default VRAM and utilization probes use `nvidia-smi`; unavailable required measurements refuse start. | This is a measured Unsloth/Windows/NVIDIA profile gate, not a portable runtime admission policy. On AMD, the current default probes return unknown and the canonical local-runtime gate refuses start. No threshold is bypassed in this audit. |
| Hardware and runtime truth | Hardware contracts can report a ROCm hardware backend and AMD identity. Windows AMD discovery is PNP identity; Linux AMD SMI parsing reports static VRAM size but leaves free VRAM null. Hardware identity does not report a runtime's usable accelerator or capability. | AMD device detection is not AMD runtime qualification or a live admission probe. A real AMD path needs measured live resource telemetry with unknown values remaining fail-closed. |
| Model fit | `fitModel` estimates GGUF file and KV-cache memory from GGUF metadata and a RAM sample. | Useful for GGUF candidates; it is not a universal estimator for runtimes with other artifact formats, offload policies, or memory models. |
| Readiness | First-run readiness reports general service/workspace/model-running/resource state. It does not bind readiness to a backend-specific qualified model route. | It cannot substitute for runtime/model qualification or prove a new adapter's execution path. |

## Safe extension boundary

The existing model/artifact identity and backend/version/hash qualification
basis are suitable foundations. A future concrete runtime should extend them
through the current ownership path, with evidence for:

1. an explicit runtime identity and operator selection policy;
2. adapter lifecycle, cancellation, streaming, ownership, and cleanup;
3. an Authority-saved profile bound to the exact artifact, runtime, and version;
4. runtime- and hardware-specific admission probes and estimates, retaining
   the existing safety floors unless an owner-approved measured policy changes
   them;
5. Model Manager discovery and configured/default runtime projection;
6. qualification and readiness that remain tied to exact runtime, model, and
   artifact evidence.

These are extension requirements, not a proposal to implement all of them
without a selected runtime. In particular, do not add backend enum values,
generic runtime registries, runtime-neutral offload fields, or portability
claims before research identifies a concrete requirement.

## W1 and gfx900 disposition

W1 source, focused verification, and exact-SHA CI are green at the commit above.
That proves the candidate source and hosted gates only. The local host has no
AMD device; it did not run a model because local start floors were below
threshold. The existing Windows ownership-probe red remains open with its
cause not proven. Therefore:

- PR #41 remains **OPEN / DRAFT / NOT MERGE-READY**.
- gfx900/ROCm remains **UNQUALIFIED**.
- Current AMD local start admission remains **REFUSED when required live
  telemetry is unknown**.
- No additional runtime was selected or implemented.

## Next dependency

Receive and verify the assigned primary-source runtime/backend research before
choosing another concrete runtime. Then design only the minimum cross-owner
changes proven necessary for that target. Same-host gfx900 execution and the
preserved Windows ownership-probe investigation remain separate open gates.
