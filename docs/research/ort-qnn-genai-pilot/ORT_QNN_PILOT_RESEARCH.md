# ORT GenAI + Qualcomm QNN Pilot Research

**Research date:** 2026-10-04
**Research branch base:** `edbbcf1c4c03af36fedccc0839617c26b70c83dc`
**Scope:** bounded design research only. No Covert runtime code, dependencies, model packages, or device state were changed. No runtime was installed or executed.

## Executive finding

**Recommendation: CONDITIONAL GO for a later one-device engineering pilot; NO-GO for implementation or support claims until the stop conditions below are cleared.** The primary-source documentation establishes an ORT GenAI → QNN plugin → Genie path for Windows ARM64 Snapdragon NPU inference. A plausible package tuple exists: ORT GenAI `0.17.0`, QNN EP plugin `2.6.0`, ORT `1.30.0`, NumPy `2.3.3`, CPython `3.12` ARM64. This exact tuple is metadata-compatible and each native wheel exists, but it is not jointly upstream-tested on a physical device.

The leading model recipe is Microsoft Phi-4-mini-instruct, targeting QNN HTP and Genie. The pinned Olive recipe contains an unresolved target contradiction: its README calls `SC8480XP` validated, while the recipe selected for “X Elite” compiles for `SC8380XP`. Qualcomm's linked primary device table could not be retrieved in this environment. No exact retail OEM SKU can be responsibly selected from this evidence. The model source revision/license and exact conversion output are also unknown. These are blockers, not details to fill by inference.

The pilot should therefore be scoped as: **one named Windows 11 ARM64 device, with independently observed SoC/HTP/driver identity; one exact Olive output tree; one QNN Genie profile; one short text-generation workflow.** Do not generalize to all Snapdragon systems, arbitrary ONNX, all Windows ARM64, or all QNN providers.

## Proposed pilot target and pins

| Layer | Candidate pin / target | Evidence status |
|---|---|---|
| OS / process | Windows 11 ARM64; native ARM64 process | Required for the QNN Genie pathway described by pinned QNN docs. Exact Windows build floor is `UNKNOWN`. |
| SoC | Snapdragon X Elite, recipe target `SC8380XP` / Hamoa | Candidate only. Upstream recipe README says validated `SC8480XP`; target identity must be resolved before hardware procurement or implementation. |
| Retail machine | `UNKNOWN` | Lenovo PSREF and Microsoft hardware pages were blocked by the network tunnel. Do not infer an SKU from a processor marketing name. |
| Python | CPython `3.12`, Windows ARM64 | Exact wheels are published for the selected Python ABI. |
| ORT GenAI | `onnxruntime-genai==0.17.0` | Tag `v0.17.0`, commit `1d67be30e5b1ed0c264f6f41c598f85157e8288b`. Requires ORT `>=1.30.0`. |
| QNN plugin/runtime | `onnxruntime-qnn==2.6.0`, bundled QNN `2.50.40` | Tag `v2.6.0`, peeled commit `7332461750cb7fefc6444a674ebe34ce5c9c0d01`. The exact ARM64 wheel's `build_and_package_info.py` reports `qnn_version='2.50.40'`; the package also contains Genie/QNN libraries and HTP architecture stubs. |
| ORT core | `onnxruntime==1.30.0` | Selected to satisfy GenAI 0.17.0 metadata; QNN 2.6.0 docs say ORT `>=1.24.1` compatible and tested with `1.27.0`. The tuple `1.30.0 + QNN 2.6.0` needs physical integration proof. |
| Numeric dependency | `numpy==2.3.3` | QNN package documents `1.25.2 or >=1.26.4`; the native CPython 3.12 Windows ARM64 wheel was downloaded and its SHA verified. Full dependency lock/install remains untested. |
| Model-preparation recipe | `microsoft/olive-recipes` commit `fe22c43adb56f2e43998dad6e279b7364441eaeb`, Phi-4 QAIRT recipe | Exact files are pinned by hash below. Recipe and source-model revisions are not equivalent to an output artifact hash. |
| QAIRT preparation toolchain | `qairt-dev==0.8.1`; QAIRT SDK `2.45.40` per recipe README | Proprietary/acceptance-gated SDK. The recipe says Ubuntu 22.04 / Python 3.10.12 for preparation. QNN EP 2.6 runtime wheel reports bundled QNN `2.50.40`; the release docs say that build was tested with QAIRT 2.50.40. Compatibility of QAIRT 2.45.40 compiled output with the selected 2.50.40 runtime is unproven. |

The QNN EP 2.6.0 wheel has SHA-256 `c8b9e43d131d2a00c3062aaf9e6e5f13c6028707ee103fb3f13bec1d7395a0bf` (59,225,752 bytes); it contains the plugin, `Genie.dll`, QNN user-mode DLLs and HTP architecture stubs. The ORT GenAI 0.17.0 Windows ARM64 CPython 3.12 wheel has SHA-256 `3953c5ec530084b76af91b12d6fea56d9522d9c16d573af0a90d703274976321` (4,064,122 bytes). The ORT 1.30.0 Windows ARM64 CPython 3.12 wheel has SHA-256 `dc4c706f1935ebb62356e6a095b047859badd854482c40560888e95c328ed262` (14,175,072 bytes). These are observed registry file hashes, not an approved redistribution set.

There is a QNN documentation/metadata discrepancy to retain: the v2.6.0 source README lists Python 3.11.x, while PyPI publishes the exact CPython 3.12 ARM64 wheel used in this candidate. The QNN wheel's `Requires-Dist` says ORT `>=1.24.2`, while the source doc says `>=1.24.1` compatibility. The selected ORT 1.30.0 satisfies both; neither discrepancy proves the combined runtime tuple works.

### Target identity red — mandatory stop

At Olive Recipes commit `fe22c43adb56f2e43998dad6e279b7364441eaeb`:

1. `microsoft-Phi-4-mini-instruct/QAIRT/README.md` states “Validated target configuration: HTP backend on SC8480XP.”
2. The same README tells users “For X Elite” to run `htp_sc8380xp.json`.
3. That JSON sets `soc_details` to `chipset:SC8380XP`.
4. The QNN source tree contains QDC labels `Hamoa SC8380XP` and `Glymur SC8480XP`, but the Qualcomm supported-device document linked by QNN was inaccessible here.

Reproduction is the direct read of those pinned files; no model conversion was run. Root cause is **CAUSE_UNKNOWN**. A typo is plausible but unproved. Stop before choosing a retail unit, preparing a production package, or calling either SoC qualified. Resolve this from Qualcomm's primary mapping and Microsoft/Qualcomm recipe ownership, or obtain a corrected recipe commit and independently verify the target on physical hardware.

## Model candidates

### Primary: `microsoft/Phi-4-mini-instruct`

Use the exact Olive recipe `microsoft-Phi-4-mini-instruct/QAIRT/htp_sc8380xp.json` as a **candidate input**, not as a validated package. It declares QNN HTP, `chipset:SC8380XP`, `hvx_threads=8`, `vtcm_size_in_mb=8`, `sequence_lengths=[1,128]`, `native_kv=false`, and `multi_graph=true`. Encapsulation sets `n_threads=3`, HTP CPU mask `0xe0`, shared-buffer memory, weight sharing, and `reused_io_limit_mb=100`. The preparation script sets the model context length to 4096 and uses `trust_remote_code=true`.

The recipe output path is `models/phi4-mini-instruct-hamoa`. Olive Recipes says the result is an ORT GenAI-compatible directory. The exact file tree, artifact sizes, generated model configuration, and hashes do not exist in this research workspace because conversion was not run. Source model revision and license are `UNKNOWN`: Hugging Face metadata/Git access returned CONNECT 403. Before preparation, fetch source metadata through an authorized official route, pin the immutable source revision and every source file hash, review any remote code, and establish license/usage terms. Do not execute `trust_remote_code` from an unpinned revision.

### Fallback candidate: `microsoft/Phi-3.5-mini-instruct`

Olive Recipes has a QNN recipe at `microsoft-Phi-3.5-mini-instruct/QNN/x_elite_config.json`. It is a **separate conversion/compatibility track**, not a drop-in runtime fallback: the recipe documents legacy QNN preparation and an older `onnxruntime-qnn==1.23.2` environment from a nightly feed. It does not establish that its output works with the QNN 2.6 plugin + Genie path. Use it only if the primary model is blocked by an identified model/license/quality issue and after independently pinning and qualifying the legacy artifact route. Its source revision/license are likewise `UNKNOWN` in this environment.

No model is ready to distribute. A fallback designation never permits runtime fallback without an explicit operator selection and its own passport.

## Model preparation and artifact lineage

The upstream-recommended flow is an x64 Linux preparation machine (recipe-validated host: Ubuntu 22.04, Python 3.10.12) with pinned Olive, `qairt-dev==0.8.1`, and QAIRT SDK `2.45.40`; fetch QAIRT through `qairt-vm`, record the downloaded SDK identity and license acceptance, then invoke Olive with the pinned recipe. The target runtime is a separate native Windows ARM64 Python 3.12 environment. Do not prepare or compile on the target in this pilot unless a later documented path specifically requires it.

Lineage must form an immutable directed chain:

`HF repo + commit + source file hashes + model license` → `reviewed remote-code files` → `Olive Recipes commit + recipe/config/script/requirements hashes` → `Olive commit` → `qairt-dev + QAIRT SDK + host image/tool versions + all conversion options + calibration inputs` → `generated package manifest and per-file hashes` → `runtime wheel/plugin/provider asset hashes + device/driver identity` → `qualification passport`.

Exact recipe input hashes observed:

| Input | SHA-256 |
|---|---|
| `htp_sc8380xp.json` | `a6aa30ba71da7c2a53e0daaaff6f18de6159822de9dc9efe29ea75dde3037e2b` |
| `phi4_mini_script.py` | `18d2bf9190b8f16eb0bf45656f18f4123514452aea161946e3402987f5a35dce` |
| `QAIRT/requirements.txt` | `d7cc2b49cb3c39e53be1f2fb44e6697a4954d07441a8b1f87a97e1ce840808e6` |

The output must be treated as a new derived artifact. It may be quantized, transformed, and compiled; source hashes must not stand in for compiled package hashes. The recipe is not sufficient evidence to claim which output filenames exist. Minimum runtime expectations from ORT GenAI/QNN docs are an ORT GenAI-readable model directory, `genai_config.json`, tokenizer assets, an ONNX graph with QNN `EPContext` metadata, and the referenced Genie-prepared DLC. The actual converter output tree is **UNKNOWN until a successful run**. Create a Covert manifest only after enumerating and hashing that exact tree. The QNN EP wheel is a separate runtime dependency, not silently part of the model identity.

## Capability boundary

- **Generation and streaming:** ORT GenAI's Python `Generator` exposes iterative token generation and token decoding. This establishes API shape, not successful QNN execution or streaming latency on the target.
- **Cancellation:** the inspected Python `Generator` surface does not expose a cancellation call. ORT GenAI has a separate Engine/Request API with cancellation, but the QNN Genie recipe's compatibility with that path is not established. For the bounded pilot, isolate inference in a Covert-owned child and test cooperative stop/forced termination, process-tree cleanup, NPU recovery, and restart. Until proven, cancellation is `UNKNOWN` and the profile is not ready for user work.
- **Tool calling:** this is model-format/prompt behavior, not an Authority API. Parse a tested model response into a proposed tool request and pass it through Covert Authority. Never let model output invoke a tool directly. Whether this exact converted Phi profile preserves expected tool-call tokens is untested.
- **Structured output:** ORT GenAI documents constrained decoding (JSON schema/grammar/regex); exact Python binding + QNN/Genie support for the selected profile must be exercised. It does not establish semantic validity; Covert must validate output independently.
- **Context/KV cache:** Olive script sets a 4096 context candidate; recipe `sequence_lengths=[1,128]` are compilation settings and are not a maximum-context proof. QNN Genie has an internal KV-cache and documents `kvcache_rewind` for its QNN EP path. OGA's usage of that option and live context occupancy reporting are not established. Report prompt/generation token counts measured by Covert and distinguish them from provider-reported allocation (currently `UNKNOWN`).
- **Embeddings/multimodal:** not in scope and not established for this text-generation profile. Do not surface these capabilities.
- **Resource reporting:** Windows may expose process memory and OS shared/committed memory; exact NPU memory, VTCM use, thermals, tokens/sec, and HTP utilization APIs for this hardware/profile are `UNKNOWN` until measured. Never label shared RAM as dedicated VRAM.
- **Offline/egress:** model inference can be locally packaged, but official ORT GenAI packages enable telemetry by default. Set `ORT_DISABLE_TELEMETRY=1` before process initialization, verify no egress, and keep acquisition separate from inference. The weight host/license/auth path remains an acquisition phase and can be networked only by explicit product policy.

The full capability matrix is in [`ORT_QNN_CAPABILITY_MATRIX.csv`](ORT_QNN_CAPABILITY_MATRIX.csv).

## Hardware truth and resource admission

At minimum, the future hardware snapshot must preserve provenance, timestamp, and `UNKNOWN` for each field:

- OS product/version/build, native process architecture, WOW/emulation state, device model/OEM and firmware source.
- SoC marketing string and raw SoC/device identifier; QNN HTP architecture (for example V73); NPU vendor/device; driver and firmware versions; device/runtime discovery source and status.
- CPU architecture/core counts and current load; physical RAM, available RAM, commit limit/available commit, process private bytes, system memory pressure.
- HTP/NPU availability and provider/device enumeration; QNN/QAIRT runtime version, `onnxruntime_qnn` plugin version/hash, ORT and GenAI versions/builds; actual selected EP/device and graph placement evidence.
- Model package tree root digest, all component file hashes, model context profile, quantization/recipe identity, runtime options, request token counts, generation throughput, cancellation and exit reason.

Admission thresholds cannot be responsibly set from the available sources. The model is approximately 4B-class by product description but no exact source revision or artifact size was retrieved. NPU memory is shared with system RAM. The recipe's 8 MB VTCM and 100 MB I/O reuse cap are tuning values, not total runtime working-set bounds. Do not set a universal “32 GB required” or use those recipe values as a RAM floor. Before admission is implemented, measure clean startup and sustained generation on the exact device at the selected 4K profile; record peak process/private/commit/shared memory, available-memory low watermark, NPU/HTP attribution, latency/tokens-per-second, temperature/power if supported, and throttling/error signals. If any safety or memory field is unsupported, use an evidence-backed conservative model allowlist or fail closed; do not convert `UNKNOWN` to adequate.

## Covert ownership and governance design

1. Covert starts the pinned native ARM64 Python child under a Windows Job Object with kill-on-close. The child is the sole owner of the model, tokenizer, ORT sessions, QNN plugin registration and provider resources. No arbitrary third-party HTTP endpoint is accepted for this pilot.
2. Pass requests and streamed tokens over a local authenticated IPC channel with bounded messages. Do not pass credentials to the child. Disable ORT telemetry before importing/initializing ORT GenAI. Verify loopback/network isolation with an egress test.
3. Child verifies package tree hashes, runtime-lock hashes, device/SoC/provider availability, and the selected passport before loading. Register `QNNExecutionProvider` through the QNN package helper before loading the model. Require explicit QNN/Genie attribution; an EP registered but not used is not NPU success. No silent CPU or alternate-provider fallback.
4. Covert Authority remains the only tool/side-effect gate. The model receives only allowed task context. A generated tool-call-like response is an untrusted proposal and is schema-validated, authorized and audited before execution.
5. On stop, dispose generator/tokenizer/model/session objects, unregister the provider library after dependent objects are gone, call documented OGA shutdown only after all OGA objects are destroyed, close IPC, and exit. Parent confirms the child and job process tree are gone.
6. On crash, forced cancellation, device loss, or failed teardown, record the request boundary, package/passport, exit code, logs and cleanup result; mark runtime unavailable/degraded. Do not auto-switch model/provider. Restart requires a fresh device/provider check, package-hash verification and a clean short inference before returning to `QUALIFIED`/`RUNNING` state.

This pilot qualifies a runtime/profile and model package; it does not create or merge a Resident model binding or assign Planner/Coder/Reviewer roles. If the owner later assigns this package to Resident, that binding remains a separate explicit, qualified state. A real beta claim must exercise the canonical Resident path and must not substitute a worker model for Resident.

## License and distribution gate

- ORT GenAI, ORT core, QNN EP source/package metadata, Olive, and Olive Recipes declare MIT licenses in the inspected pinned source/package metadata. NumPy 2.3.3 declares BSD licensing and includes additional bundled-library notices. Preserve each wheel's license/notices and generate a complete SBOM/license inventory from the final target dependency lock; the transitive set is not fully resolved in this research lane.
- QNN wheel includes `Qualcomm_LICENSE.pdf`, which is Qualcomm's AI Stack License. Its grant allows use/copy for app development and object-code redistribution only when incorporated in an application; it explicitly does not grant standalone redistribution. It also includes export, use-case, termination, and other obligations. Legal review is required before Covert bundles or mirrors the QNN runtime/provider assets. Do not infer that a public PyPI wheel is freely redistributable as a standalone Covert download.
- `qairt-dev` is marked proprietary; QAIRT SDK download/access and model preparation require applicable Qualcomm terms/acceptance. Do not ship the preparation SDK in Covert.
- Model source licenses for both candidates are `UNKNOWN` because Hugging Face source pages/API were inaccessible. No download, conversion, or distribution until the exact pinned model revision's license and any remote-code/license obligations are reviewed. Quantization/conversion does not remove those obligations.
- Olive and recipe source are upstream repositories; their license and transitive dependency inventory must be recorded in the actual build record before using their tooling in a redistributable service.

## Explicit stop conditions

Stop the pilot and preserve the first red if any occurs:

- SC8380XP/SC8480XP target conflict is unresolved or device identifier cannot be read and tied to a primary mapping.
- Exact model revision/license/remote code is unpinned or cannot be reviewed.
- QAIRT recipe output/runtime compatibility with pinned ORT GenAI/QNN package tuple is not demonstrated.
- Provider is registered but the model graph is not proven to run through Genie/HTP; any CPU fallback or unreported graph partition is observed.
- Output files differ from the signed manifest, any hash/provider asset is missing, or model/compiled artifacts have ambiguous lineage.
- Resource floor, cancellation, device reset, cleanup, or restart behavior is unknown or fails; child/job process leaks; driver remains wedged.
- ORT telemetry or other unapproved egress occurs in Local-Only mode.
- Qualcomm/model terms do not permit the planned packaging/distribution.
- A readiness state would need to be inferred from installation, compatibility, or a successful load without a real governed task and response-observed identity.

## Decisions on the requested questions

1. **Smallest adapter set:** first qualify the existing local paths (Unsloth and llama.cpp profiles), then add this one ORT GenAI + QNN/Genie profile for Qualcomm Windows ARM64. This is not a claim that these three cover all hardware; Intel/Apple/AMD profiles need their own evidence. ORT GenAI plus provider packages may reduce runtime count for selected Windows provider profiles, but each provider/model still requires a separate passport.
2. **Universal llama.cpp?** No. It is broad and remains a strong compatibility family, but this QNN Genie/QAIRT path provides a specifically prepared Windows Snapdragon NPU route. The audited docs do not establish equivalent Qualcomm NPU execution by the Covert llama.cpp profile; CPU/GPU/Vulkan support is not a substitute for NPU attribution, power, or vendor-compiled model paths.
3. **Where llama.cpp stops:** where target NPU execution, vendor compiler output, or runtime features are not proven for its exact adapter/device build. Do not interpret ONNX/QNN artifacts as GGUF or call CPU fallback equivalent.
4. **Does vLLM add workstation value?** It may add Linux high-throughput/concurrent serving, but does not close this Windows ARM64 QNN gap. Defer until a real multi-request workload and measured advantage justify its lifecycle and packaging cost.
5. **SGLang?** No distinct need established for this pilot. Defer beside vLLM unless its workload or supported model/hardware matrix offers a measured capability vLLM and llama.cpp lack.
6. **Apple Silicon:** begin with a separately qualified llama.cpp Metal profile; test MLX as a benchmarked candidate later. Neither path establishes the QNN profile.
7. **Intel:** keep runtime/provider combinations separate: llama.cpp SYCL or OpenVINO for Intel CPU/Arc/NPU after physical tests; vLLM XPU is a Linux server/workstation candidate. Do not force one Intel path across all OS/device classes.
8. **Windows generic GPU:** no universal Windows GPU claim. Prefer exact, tested provider/model profile; keep CPU as an explicitly selected, admission-qualified fallback. DirectML is not automatically a GenAI runtime.
9. **DirectML:** an execution provider alone does not prove useful autoregressive LLM, KV-cache, tokenizer, cancellation, or model-package support. No first-pilot evidence supports adopting it as universal generative compatibility.
10. **Snapdragon NPU:** this ORT GenAI + QNN/Genie pilot is a plausible sovereign path, but only for the compiled model and mapped hardware profile. Resolve SoC identity, provider/license/runtime details, and physical acceptance first.
11. **ONNX identity:** ONNX may be a first-class *derived package format*, not a universal source-model identity. Store its graph plus external data, config/tokenizer, provider context/DLC and manifest as a package tree with independent hashes and parent source lineage.
12. **Conversion creates identity:** this QAIRT path quantizes/transforms/compiles; it produces a separate derived identity. TensorRT, MLC, OpenVINO/IR and MLX conversions likewise need independent package hashes and passports.
13. **Broker:** current “canonical + one recovery backend” should not gain a special third slot. A small explicit registry/profile selection mechanism is needed before a third materially distinct runtime, with no automatic cross-profile fallback.
14. **Qualification:** exact passport key should bind runtime + plugin/runtime version/build/hash, OS/build/process arch, SoC/HTP/driver/firmware, model source and derived package lineage, provider/options, context/quantization, measured capability results, resource admission data, and evidence timestamps. A changed identity invalidates qualification unless an explicit reviewed compatibility rule exists.
15. **Blocking contracts:** see the previous runtime audit's architecture gap map; in particular backend enums/two-slot composition, hardware truth and resource admission, Model Manager presentation, and qualification key must support separate runtime/provider/device profiles before this implementation.
16. **Fix before backend:** establish target identity; add versioned runtime profile/passport/package-manifest fields; add nullable/provenanced ARM/NPU discovery and provider execution proof; add owned process cancellation/restart semantics; settle license and artifact acquisition.
17. **Next after llama.cpp:** ORT GenAI + QNN/Genie, but only as the conditional one-device pilot described here. It reaches Windows ARM64 Qualcomm NPU, a profile llama.cpp is not proven to cover.
18. **Defer/reject:** defer vLLM, SGLang, standalone TensorRT-LLM, MLC, MLX, OpenVINO and general Windows ML until a specific stranded hardware/workload is demonstrated. Reject a “universal DirectML/ONNX provider” claim, arbitrary ONNX import as a qualified generative model, and any silent provider/model fallback.

## Dependabot triage — exact GitHub alert remains blocked

The default branch is `covert-production` at `81aff88b924db05c689dc734aa3e67605f4b18ce` as observed during this audit. GitHub's research-branch push response identified the default-branch finding as alert `#1`, severity `moderate`, with link `https://github.com/AnonymousNomad/covert-coder/security/dependabot/1`. A read-only request to the alert-specific API returned HTTP `403 Forbidden`; an anonymous GET of the alert page returned `404`, and `gh auth status` reported the configured token could not authenticate. Therefore the alert number/severity are known, but its dependency/advisory details remain inaccessible. Do not send or request credentials through chat.

Independent registry audit of the exact default-branch root `package.json` and `package-lock.json` found:

- `brace-expansion@5.0.9`, lock entry `dev: true`, reached through `minimatch@10.2.6`, also `dev: true`; `minimatch` is a transitive development dependency of ESLint/config-array/typescript-eslint. The moderate advisory candidate is GHSA-q2hr-2g5m-vwhr / CVE-2026-102277, affected `<5.0.12`, fixed at `5.0.12`. The aggregate npm audit for this package also returned two high advisories, so it does **not** uniquely match GitHub's reported “one moderate.”
- No direct source import of `minimatch` or `brace-expansion` was found in the checked-out default tree. Production-only npm audit did not include `brace-expansion`; source does not establish an attacker-controlled brace-pattern path in Covert's production runtime. Developer/build tooling does include the transitive package, so describe production reachability as “not found; dev-tool dependency is present,” not “impossible to reach.”
- The same audit found `dompurify@3.4.13` as a production dependency via Monaco with a low advisory; this is not a moderate alert match.
- `npm audit --json` reported 0 moderate, 1 high, 1 low; this does not match the earlier GitHub alert count. No dependency was changed.

**Triage status: BLOCKED for exact dependency/advisory identity; GitHub identified alert #1 as moderate.** If GitHub confirms the moderate is the brace-expansion advisory above, remediation appears routine at the lockfile/dependency level, but the package's additional high advisories should be addressed in the normal dependency lane. This report does not close, dismiss, or update any alert.

See [`ORT_QNN_RESEARCH_EVIDENCE.md`](ORT_QNN_RESEARCH_EVIDENCE.md) for pinned source links, dates, checksums and access-denial records; [`ORT_QNN_ARTIFACT_PACKAGE.md`](ORT_QNN_ARTIFACT_PACKAGE.md) for the proposed immutable package layout; and [`ORT_QNN_QUALIFICATION_PLAN.md`](ORT_QNN_QUALIFICATION_PLAN.md) for the later physical-device gate.
