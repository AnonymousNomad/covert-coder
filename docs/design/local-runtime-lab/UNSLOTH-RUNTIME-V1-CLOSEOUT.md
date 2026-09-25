# Covert Local Runtime V1 Closeout

Status: **COVERT LOCAL RUNTIME V1 CLOSED** for the exact qualified profile below. Runtime-selection research remains closed; Unsloth is canonical.

## Frozen V1 support profile

| Field | Qualified value |
|---|---|
| OS | Native Windows 11 Home Insider Preview, build 26220 |
| Execution context | Administrator, explicitly authorized by the operator |
| Runtime | External Unsloth `2026.9.11` |
| GGUF backend | Vulkan through the Unsloth-managed llama-server path |
| GPU | ASUS ROG Strix GL703GM, NVIDIA GTX 1060 Mobile 6 GB, compute capability 6.1, driver 582.28 |
| Artifact | `LFM2.5-2.6B-Q4_K_M.gguf`, 1,674,455,040 bytes |
| Artifact SHA-256 | `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed` |
| API binding | Loopback `127.0.0.1:18888`; bearer authentication verified |

Final Runtime Passport SHA-256: `921af21011ac194cf84ae11751de0f32018a7646fe857555a6ca167e6bdf8b4c`.

Only this configuration is qualified. Standard-user Windows, AUTO, CUDA, CPU, WSL, other OSes, GPUs, artifacts, and runtime versions remain outside V1 scope.

## Operational result

- The existing installation reconciled as current and accessible: Unsloth `2026.9.11`, GGUF/no-Torch profile, runtime stopped before start, no destructive reinstall required.
- Cold model load completed in 48.35 s. Health returned healthy and model discovery reported the expected Liquid model identity and exact verified artifact hash.
- Authentication returned HTTP 401 without the bearer credential and HTTP 200 with the DPAPI-backed credential. The credential value was never logged.
- Normal inference, streaming, cancellation, invalid-request recovery, unload/reload, restart/reload, and clean shutdown passed. The final cleanup reported `STOPPED`, no model loaded, zero listeners, and no credential-value disclosure.
- No direct llama.cpp fallback occurred. A fallback remains an explicit operator action and must be recorded.

## Capability decisions

- **Tool calling: PARTIAL.** One frozen harmless `workspace.read` call passed schema validation, was accepted by Covert Execution Authority, executed against a read-only fixture, returned its result, and completed the model turn. A malformed argument and malformed JSON were rejected before Authority execution; the session recovered. Raw pre-repair output was unavailable, so repair attribution is `UNKNOWN`. No Unsloth self-healing claim is made.
- **Native strict structured output: NOT SUPPORTED — COVERT VALIDATION REQUIRED.** One probe produced a valid value, but that does not qualify deterministic native schema enforcement. The malformed JSON case was rejected as `NEEDS_REVIEW` / `INVALID_JSON`, with zero retries, no accepted value, and no false acceptance.
- **Streaming: PASS for the tested profile.** First visible token 7.72 s; total stream 8.45 s. This result is profile-specific.
- **Cancellation/recovery: PASS.** The active request was interrupted; health stayed healthy and follow-up inference succeeded.
- Tool repair attribution remains `UNKNOWN`; native prompt-processing and generation token rates are unavailable from the returned API evidence. End-to-end request timings are reported without presenting them as native decode throughput.

## Thirty-minute stability run

The exact artifact ran for 1,807,502 ms (30 min 7.5 s), with 23 interval ticks, 46 host-resource samples, 19 requests, and zero failures. The run included repeated inference, streaming, cancellation/recovery, unload/reload, and an adapter-owned runtime interruption/restart/reload. Every recorded tick passed; the model hash and ownership were reverified after restart.

Observed during the soak:

- Minimum free physical RAM: 5,984,075,776 bytes (5.57 GiB); in-run stop floor: 5.25 GiB.
- Minimum free Windows commit: 13,827,072,000 bytes (12.88 GiB); in-run stop floor: 2.75 GiB.
- Lowest periodic tick snapshot free VRAM: 3,589 MiB; the runner's in-run guard passed at all 46 resource samples against the 3,072 MiB stop floor.
- Peak total GPU memory use: 2,444 MiB; start/end samples were 2,378/2,440 MiB.
- llama-server private bytes remained about 2.13–2.18 GiB at sampled ticks, with no increasing trend. The managed launcher remained a child in the verified owned runtime tree.
- No failure, orphan process, ownership loss, port leak, or degrading latency trend was recorded.

This bounded soak supports this profile only; it does not claim indefinite stability.

## Host resource diagnosis and resolution

At the earlier blocked preflight (`2026-09-25T13:39:43Z`), free RAM was 5.404 GiB and free commit 4.301 GiB, below the unchanged start requirements of 6.5 and 5 GiB. The diagnosis found two evidenced contributors:

1. An abandoned OpenCode process was confirmed abandoned by the operator and revalidated by exact PID before it was stopped. The recorded release was 0.418 GiB working set, 0.961 GiB private memory, and 0.957 GiB commit. No image-wide termination was used.
2. The C-only pagefile configuration was not providing safe commit headroom: its 14.679 GiB allocation was using 14.535 GiB while C: had roughly 0.12 GiB free. A system-managed `E:\pagefile.sys` entry was added while preserving the existing C entry; the required reboot was performed. Afterward, active pagefiles were observed on C: and E:, and free commit rose substantially. This increased commit capacity and is not represented as a fix for a runtime leak.

The later diagnosis found no WSL distribution running, no Unsloth/llama-server process, and no listener on port 18888. The final 16:59 preflight passed with 7.12 GiB free RAM, 16.62 GiB free commit, 5,423 MiB free VRAM, 26% GPU utilization, and zero runtime process matches. The final soak also passed its lower in-run stop floors. No Resident or foreign runtime was adopted or terminated.

The host-specific post-shutdown baseline is frozen in `evidence/RT-V1-HOST-IDLE-BASELINE-20260925T173910Z.json`. It records the operator desktop session with the model runtime stopped; it is not a universal hardware threshold.

## Installation, update, removal, and license boundary

- The qualified installation is external/user-managed at the observed E: location. The canonical runbook is `UNSLOTH-V1-INSTALL-RUNBOOK.md`; its SHA-256 and the read-only reconciler SHA-256 are pinned by the final Passport.
- The exact successful historical bootstrap bytes were not retained. The runbook records `UNKNOWN_NOT_RETAINED`; the hash of the failed earlier installer is explicitly not attributed to the successful installation. No destructive reinstall was performed just to reconstruct that historical hash.
- Reconciliation recognized the current version and profile and returned `NO_DESTRUCTIVE_REINSTALL_REQUIRED`; this proves idempotent detection of the current healthy installation, not a clean-room reinstall.
- Automatic upgrade is disabled/not used. Any runtime version, backend, driver, artifact hash, or material configuration change stales the Passport and requires requalification.
- Covert does not bundle or redistribute Unsloth Studio, CLI source, or binaries in V1. The recorded source boundary is Unsloth core Apache-2.0 versus Studio/optional CLI AGPLv3; the external installation is user-managed. This is a limited observed license boundary, not a broader legal opinion.
- Removal uses the version-matched upstream uninstaller only after reviewing its target scope. Preserve model artifacts, Covert evidence, and the separate DPAPI credential slot. Verify the runtime root/process/listener state after removal. When Unsloth is absent, Covert reports it unavailable; it does not silently select another engine.

## Frozen artifacts and handoffs

- Support contract: `UNSLOTH-V1-SUPPORT-CONTRACT.md`.
- Installation/reconciliation procedure: `UNSLOTH-V1-INSTALL-RUNBOOK.md` and `scripts/qualification/unsloth-install-reconcile.ps1`.
- Configuration-specific Runtime Passport and SHA-256 sidecar: `evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json` and `.sha256`.
- Sanitized live trace: `evidence/RT-V1-LIVE-TRACE.jsonl`.
- Raw trace, prior failed traces, and artifact identities are inventoried by hash/size/provenance in `evidence/RT-RUNTIME-EVIDENCE-MANIFEST.json`; raw operational traces remain outside the repository.
- Read-only Model Manager contract fixture: `evidence/LUNA-RUNTIME-STATUS-FIXTURE-V1.json`.
- Read-only Operator Control fixture: `evidence/OPERATOR-CONTROL-RUNTIME-FIXTURE-V1.json`.
- `scripts/qualification/validate-runtime-v1-closeout.mjs` validates the Passport, fixtures, evidence manifest, trace gates, and owned cleanup.

## Deterministic verification

- Focused runtime, Execution Authority, output-validation, and evidence-helper suite: **46/46 passed**.
- Expanded runtime and architecture suite: **59 passed, 6 skipped, 0 failed**. The six skips require bundled GGUF files that are intentionally absent from this checkout; they are reported as skips, not passes.
- Node TypeScript check: **PASS**.
- RuntimeStatusResponse schema and all evidence JSON parsing: **PASS**.
- Final closeout validator: **PASS**, validating 30 manifest entries (19 repository artifacts and 11 external evidence artifacts), including raw runtime and Authority traces, the Passport hash, installation runbook/reconciler hashes, sanitized handoffs, live tool/structured-output evidence, soak floors, and final cleanup.
- The original 16/16 runtime test baseline and earlier 37/37 targeted baseline remain preserved; this closeout did not weaken or replace those tests.

The handoffs distinguish installation, version match, current health, model availability, loaded state, runtime qualification, and exact artifact qualification. They contain no credentials or private machine paths. No Model Manager or Operator Control implementation was changed in this lane.

## Protected scope

Resident, Model Manager implementation, Public Ops, Harness Sync, Authority semantics, Veritas, H3, and H4 were not modified. The runtime adapter boundary remains open for future developer adapters; Unsloth is the V1 canonical backend and direct llama.cpp remains explicit recovery/reference only.

## Final verdict

**COVERT LOCAL RUNTIME V1 CLOSED** for native Windows 11 Administrator + Unsloth 2026.9.11 + Vulkan + GTX 1060 Mobile 6 GB + the exact official Liquid Q4_K_M artifact above.
