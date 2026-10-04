# ORT GenAI + QNN Qualification Plan

**Status:** design for a later implementation/physical-device lane. No qualification was run here.
**Current candidate:** ORT GenAI 0.17.0 + QNN EP 2.6.0 + ORT 1.30.0 on native Windows ARM64, Phi-4-mini QAIRT/Genie package.
**Gate:** resolve the recipe SoC conflict, source/license identities, and exact device before starting.

## Qualification claim boundary

A passport qualifies only one immutable tuple: a runtime build + provider/plugin build + OS/process profile + physical device/driver + exact derived model package + exact context/quantization/options + tested capabilities. A passport for one QNN/HTP/SoC profile must not qualify another Snapdragon SKU, a different HTP architecture, another Windows build, ORT/QNN version, model conversion, context shape, or provider. `UNKNOWN` is a blocking value for any admission-critical field.

State progression must remain distinct:

`DISCOVERED → AVAILABLE → COMPATIBLE → QUALIFIED → SELECTED → RUNNING`.

`COMPATIBLE` means static requirements match; it is not runtime evidence. `QUALIFIED` requires this plan's evidence. `SELECTED` is explicit operator choice. `RUNNING` requires this process/request to be healthy and attributed to QNN/Genie. Failure, identity drift, provider change, package change, or stale passport returns the profile to an unqualified/degraded state.

## Exact passport fields

### Runtime and process

- Covert adapter/profile ID, adapter schema version, Covert build SHA.
- OS edition/version/build, native architecture, process architecture, Python implementation/version/ABI.
- ORT GenAI version, wheel filename/hash, native DLL hashes and build identity.
- ORT core version, wheel filename/hash, build info.
- QNN EP package version, wheel filename/hash, plugin path/hash, every QNN/Genie DLL hash and version, plugin registration identity.
- QAIRT/QNN API and SDK versions used in conversion and present in runtime package; any compatibility declaration; runtime-loaded library paths/hashes.
- Provider options, performance mode, model/provider config digests; telemetry opt-out setting and egress-test evidence.
- Covert-owned child PID/start time/job identity, parent ownership, IPC protocol version, exit code/stop reason, process-tree cleanup result.

### Device and admission

- OEM/machine SKU and device firmware; SoC marketing name plus raw SoC ID; HTP architecture ID; NPU device/provider ID; driver and firmware versions, source/provenance and timestamp.
- CPU model/architecture/features/core counts; physical RAM, available RAM, commit limit/available commit, process private/working-set peak, memory-pressure signal.
- Any supported HTP/NPU utilization, VTCM/DRAM/shared-memory allocation, thermal/power/throttle metrics with source and sample timestamps. Unsupported fields remain `UNKNOWN`, not zero.
- Provider enumeration, selected provider/device, graph partition/fallback attribution, provider execution log evidence; which operators/graphs executed on HTP versus CPU if available.

### Model/artifact

- Source model repo, immutable revision, source-tree digest, each source weight/config/tokenizer/remote-code file hash and license disposition.
- Converter repo/revision, Olive commit, recipe path/hash, script and requirements hashes, QAIRT dev/SDK versions, host image and Python versions, calibration/representative data identity, all conversion options and canonical options digest.
- Derived output file list, sizes, per-file SHA-256, tree digest, ONNX/EPContext/DLC linkage, tokenizer/config hashes, context profile, quantization details and any model-quality acceptance evidence.
- Runtime-lock digest and provider asset manifest digest. Model package identity and runtime identity remain separate.

### Capability evidence and invalidation

- Context/sequence profile; measured prompt and generated token counts; context-window limit source; KV rewind/reset behavior; streaming and cancellation results; tool proposal parsing/Authority test; structured-output schema test; throughput and latency; error and recovery behavior.
- Test suite version/commit, command/device, start/end timestamps, raw logs/hashes, first-red references, observed result and reviewer.
- Invalidate on any change to runtime/plugin/provider hash or version, OS/build/architecture, SoC/HTP/driver/firmware, model tree, converter/options/quantization, context profile, or capability code unless an explicitly reviewed equivalence rule has independent evidence.

## Test stages and acceptance matrix

| Stage | Test | Pass evidence | Stop/failure disposition |
|---|---|---|---|
| T0 — Source gates | Resolve exact SoC target mapping; inspect source model revision/license/remote code; Qualcomm binary redistribution review | Official pinned source records; reviewed decision; exact device SKU/SoC mapping | Stop before device purchase, conversion or implementation while any identity/license is unknown. |
| T1 — Reproducible preparation | Run pinned Olive/QAIRT recipe twice in fresh identical environments | Inputs/toolchain/options captured; complete output tree hashes; reproducibility comparison and any nondeterminism explained | Preserve first failure/output; no overwrite/rerun-as-green. Do not call reproducible unless bytes or documented deterministic subset match. |
| T2 — Install/runtime lock | Install pinned ARM64 CPython 3.12 wheels from verified source; capture dependency graph/asset hashes | Exact wheel hashes; import/version checks; native architecture; no unresolved dependency drift | Fail closed on x64 emulation, ABI mismatch, missing DLL, unpinned dependency or license denial. |
| T3 — Device/provider discovery | Enumerate SoC/HTP/NPU, driver/firmware, QNN plugin/provider, model target support | Raw values + provenance; QNN EP device selected; compiled SoC/context metadata matches exact device | No fallback. Unknown/mismatch means `AVAILABLE` or `COMPATIBLE` at most; not `QUALIFIED`. |
| T4 — Model load and attribution | Load exact package, collect logs, prove model uses Genie/HTP | Hash verification, explicit QNN registration, Genie detection, observed HTP path/graph attribution | Plugin registration alone is insufficient. Any CPU fallback or ambiguous placement blocks. |
| T5 — Governed inference | Real Resident task, streaming, response-observed identity, constrained output, Authority-gated tool proposal | User task/response pair, token stream, exact runtime/model/provider identity, tool request denied/approved through Authority as designed | No simulated response; no tool side effect before Authority. No readiness from synthetic smoke alone. |
| T6 — Cancel/error | Cancel during prompt evaluation and token generation; kill child/job; induce provider/device loss and malformed IPC/package cases | Bounded stop latency, all owned processes gone, no orphan; driver/NPU recovers; retry returns same exact profile or remains blocked | Cancellation API behavior is unproven; forced kill without hardware recovery is a failure, not success. Preserve logs and stop advancement. |
| T7 — Resources/thermal | Cold load, short 4K request, sustained task batch, repeat under low available memory/thermal condition | Peak host/commit/process memory; NPU attribution; latency/token rate; temperature/throttling where source exists; admission threshold derived from measurements | Never infer resource capacity from VTCM recipe field or system RAM alone. Unsupported critical signal requires conservative scope or stop. |
| T8 — Restart/persistence | Normal shutdown/restart; child crash; app restart; model rediscovery and new task | No leaked process/port/provider handle; package and runtime hashes rechecked; fresh provider probe; readiness only after new inference proof | Stale persisted “ready” state is a failure. No silent fallback or automatic retry changing runtime. |
| T9 — Offline/governance | Run with network blocked after package staging; inspect DNS/socket/effect logs; audit telemetry setting | No unapproved egress; ORT telemetry disabled before init; acquisition distinct from inference; Authority/local-only policies unchanged | Any telemetry/upload or non-local endpoint in Local-Only mode blocks. |

### Physical device matrix

Initial physical coverage is exactly one device that reports and maps to the resolved SoC/HTP tuple. Record the retail SKU, firmware, Windows build, driver package and all raw device IDs. If the recipe is confirmed for SC8380XP, test that exact target first; do not count SC8480XP or any other Snapdragon generation as covered. Add a second device only as a separate passport and only if needed to test transferability.

Required physical runs:

1. Cold boot and clean process start; hardware/provider discovery with NPU online.
2. Provider absent/disabled or model target mismatch; verify explicit unavailable and no CPU/alternate fallback.
3. Exact model load, first token, 128-token output, then context-profile boundary test based on actual emitted config; do not assume 4K is accepted until observed.
4. Structured-output request and model tool-call proposal; verify schema and Covert Authority boundary.
5. Cancel during prefill and generation, forced child termination, and repeated restart; check the Windows process tree, NPU availability and recovery.
6. Sustained generation under realistic Resident/Workbench load and low available system memory; sample resource/thermal provenance and run admission behavior.
7. Network disconnected inference, telemetry/egress capture, normal shutdown and crash recovery.

Emulation, Windows x64 QNN AOT compilation, Linux ARM64 docs, a mocked EP, or successful HTTP/API calls are not physical Windows ARM64 NPU acceptance.

## Test task and result provenance

Use one deterministic coding task with a known answer and no external side effects, then one representative task through the canonical Resident UI/API requiring code inspection plus a proposed edit. Preserve Resident's independent model binding and record the explicit selected role; do not substitute a Planner/Coder/Reviewer assignment for Resident. Capture task input, project snapshot digest, prompt/model config identity, first/last token timestamps, generated token count, raw provider logs, output, response-observed provider/model identity, Authority decision, and any verification result. Redact secrets and user data. Do not claim “AI work through Covert” from a unit test or standalone OGA sample.

## Admission policy proposal

No numeric RAM/storage minimum can be sourced reliably before the real artifact exists. Make thresholds empirical and profile-specific:

- Package staging: require available disk to exceed measured package size plus measured temporary conversion/import space and an explicit recovery margin; record volumes and free bytes.
- The currently resolved 11-wheel runtime download set is 94,965,668 compressed bytes; the QNN wheel alone expands to 160,127,612 bytes. These figures exclude the model, Python environment overhead and recovery margin, so they are only a lower-bound observation, not a fixed storage requirement.
- Host memory: require physical/available/commit and process peak from measured cold load plus the tested context profile; apply a reviewed safety margin; reject unknown/low-pressure states.
- NPU memory: use reported shared-memory and provider allocations only when the driver exposes their semantics; do not report a dedicated VRAM number for shared system memory.
- Context: cap at the exact compiled profile verified under memory/thermal conditions; 4096 in the recipe script is a build setting, not an admission guarantee.
- Thermal: use vendor/OS telemetry only when its units/source are validated; when unavailable, bound sustained generation by measured test duration and report “not reported,” not “safe.”
- Throughput: no minimum is assumed. Measure and publish percentile latency/tokens/sec with sample size, device, warm/cold state, context, power mode and thermal state.

## Qualification status vocabulary

- `NOT_DISCOVERED`: required identity not observed.
- `DISCOVERED`: hardware/runtime facts observed, no compatibility conclusion.
- `AVAILABLE`: package/process can be found or installed.
- `COMPATIBLE`: package metadata and exact target contract match, but physical evidence incomplete.
- `QUALIFIED`: every required stage passed for exact passport scope.
- `SELECTED`: operator chose the qualified exact profile.
- `RUNNING`: current owned process has loaded and executed the selected model/provider.
- `DEGRADED`, `BLOCKED`, `FAILED`, `STOPPED`: distinct operational outcomes with evidence. Never map unknown to healthy.

## Current status

`RESEARCHED / NOT QUALIFIED / BLOCKED ON TARGET IDENTITY, MODEL LICENSE/REVISION, AND PHYSICAL DEVICE EVIDENCE.` The current package pins are a candidate lock, not a release or beta readiness claim. No implementation, test, or hardware qualification was performed in this lane.
