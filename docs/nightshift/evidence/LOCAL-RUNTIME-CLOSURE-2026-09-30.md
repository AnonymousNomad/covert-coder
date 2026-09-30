# Local Runtime Closure — 2026-09-30

## Outcome

**No live local inference was attempted in this closure run.** The canonical Model Access start was refused by Resource Admission because free physical RAM remained below the existing 6.5 GiB floor. The 5.0 GiB free-commit floor, qualified-profile VRAM floor, and GPU-load ceiling passed. A model-server start, generation, cancellation, stop, and restart must wait for a fresh preflight above all floors.

The bounded code work repaired two Covert defects before that preflight:

1. the Authority-bound `/api/models/start` route had no canonical local-runtime admission gate; and
2. a failed or unverifiable canonical model load could leave a Covert-owned Unsloth server running.

No floor was weakened. No foreign or unrelated process was terminated. The local GGUF collection was not changed.

## Repository and checkpoint scope

- Checkout: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- Source base before this bounded change: `c139aaae5695ed8a7e46ee1f34ba9c3eb762c8f4`
- The exact checkpoint SHA is the commit containing this evidence file; its pushed GitHub CI run is the release-loop verification record.
- PR #31 remains frozen.

## Resource and process evidence

### Post-verification host sample

At `2026-09-30T04:21:37Z` (after Veritas completed):

| Measurement | Value |
|---|---:|
| Physical RAM total | 16,306 MiB |
| Physical RAM free | 6,083 MiB |
| Required free physical RAM | 6,656 MiB |
| Commit limit / committed / free | 26,915 / 15,922 / 10,993 MiB |
| Required free commit | 5,120 MiB |
| C: pagefile allocation / current use | 7,664 / 2,782 MiB |
| E: pagefile allocation / current use | 2,944 / 1,670 MiB |
| Automatic pagefile management | Off |

The immediate canonical admission probe at `2026-09-30T04:25:02Z` returned `REFUSE_RESOURCE`:

| Probe | Observed | Required | Decision |
|---|---:|---:|---|
| Free physical RAM | 6,056 MiB | 6,656 MiB | **Fail by 600 MiB** |
| Free commit | 11,001 MiB | 5,120 MiB | Pass |
| Free VRAM | 5,191 MiB | 4,608 MiB | Pass |
| GPU utilization | 7% | <50% | Pass |

Earlier post-test samples also refused on physical RAM alone: at `03:42:39Z`, 6,289 MiB free physical, 11,229 MiB free commit, 5,185 MiB free VRAM, and 12% GPU utilization. At `03:41:39Z`, the host had 6,339 MiB free physical and 11,368 MiB free commit. The trend remained below the unchanged physical start floor.

### Process ownership and cleanup

- No local model-server process was present; ports `18888`, `58697`, `8080`, and `8104` had no listeners.
- No WSL distribution was running. The WSL service itself was about 7 MiB in the earlier process sample.
- No Covert-owned runtime PID ledger (`.aide/model-engines.json`) or runtime event ledger (`.aide/runtime-events.jsonl`) was present. The imported model registry remained intact. The model artifact's `.profile.json` sidecar was absent and was not created or modified.
- The post-Veritas census found no remaining Covert test/debug/model child. The test-runner process tree observed during Veritas exited before the post-run sample. The remaining small Node processes were Codex tool-host children without Covert/test/runtime markers.
- Largest identifiable non-Covert working sets at the `04:21Z` sample were ChatGPT `975 MiB`, interactive OpenCode `777 MiB`, Windows Defender `515 MiB`, Codex `466 MiB`, and TextInputHost `325 MiB`. OpenCode was parented by an interactive `cmd.exe`; these and all other user/OS processes were left untouched.
- A staged Veritas smoke temporarily reported 5,743 MiB free physical while its fixture stack was active. Its own evidence confirms the fixture process and listeners were closed. This was verification overhead, not a persistent Covert runtime leak.

Commit headroom remains above 10 GiB, pagefiles are active, and the committed-bytes probe succeeds. No pagefile resizing was indicated by measured commit pressure. The remaining physical shortfall is attributable to current user/OS workload; no safe Covert-owned cleanup target was found. The owner must gracefully close or pause enough interactive workload and request a new immediate admission sample before a model start.

## Repairs and regression evidence

### Admission repair

- `POST /api/models/start` now receives the same shared Resource Admission service used by the rest of the application.
- It verifies the registered local model and numeric loopback endpoint, checks the exact local-runtime profile floors, returns the measured structured refusal, and only then calls `manager.start`.
- The Windows probes measure free commit through `Get-Counter` and GPU utilization through `nvidia-smi`. Unknown commit, VRAM, or utilization truth fails closed. Generic worker/resident admission policy remains separate and unchanged.
- The ModelRuntime legacy direct-start floor also now enforces 6.5 GiB as defense in depth.
- Tests cover exact-floor admission, physical and commit shortfalls, unknown probes, busy GPU, Authority ordering, structured refusal evidence, no spawn below floor, and preservation of unknown-model behavior.

### Failed-start cleanup repair

- `BrokerModelRuntime.start` now handles a model-load error or failed post-load identity confirmation by refreshing ownership.
- It shuts down only a freshly confirmed `COVERT_OWNED` runtime. It never shuts down `USER_OWNED`, `FOREIGN`, or `UNKNOWN` state.
- If ownership/status or shutdown cannot be confirmed, the start returns a cleanup-specific failure and leaves the unresolved runtime status visible for recovery; it does not report success.
- Regression cases cover Covert-owned load failure, user-owned load failure, post-load identity mismatch, and owned cleanup failure.

### Test gates

- Focused Broker, Resource Admission, Model Access route, and lifecycle suite: **47 total, 43 passed, 0 failed, 4 skipped**.
- Final `npm run check`: TypeScript builds passed; ESLint **0 errors / 62 existing warnings**; architecture suite **843 total, 832 passed, 0 failed, 11 skipped**. Skips are the existing unbundled-GGUF and migration-waiver cases.
- `npm run veritas`: **passed**, score `1.0` vs. `0.9` threshold. `path-boundary`, `secret-scan`, `manifest-validation`, `compile`, `tests`, and `git-diff` all passed.
- The full Veritas run also recorded a fresh 9/9 generic Desktop Control battery result; Office COM acceptance was not run.
- These are local source/fixture gates. They do not claim a local model was started.

### Final regression and host recheck — 2026-09-30T05:07Z

- The final `npm run check` completed with **843 tests total, 832 passed, 0 failed, 11 skipped**; TypeScript passed; ESLint had **0 errors / 62 existing warnings**. The 11 skips are the existing unbundled-GGUF and migration-waiver cases.
- The final `npm run veritas` completed with **all six checks passed** (`path-boundary`, `secret-scan`, `manifest-validation`, `compile`, `tests`, `git-diff`), score **1.0** against a **0.9** threshold. Its fresh Desktop Control battery was **9/9** at `2026-09-30T05:04:16Z`; Office COM acceptance was not run.
- At `2026-09-30T05:05:18Z`, Windows reported **16,307 MiB total / 4,207 MiB free physical**; commit limit/committed/free were **26,915 / 17,828 / 9,087 MiB**. `Win32_OperatingSystem.FreePhysicalMemory` and the runtime's Node `os.freemem()` differed by 392 MiB in this sample; both were below the start floor. The runtime's direct canonical probe at `05:07:00Z` used `os.freemem()` and returned `REFUSE_RESOURCE`: **4,599 MiB free physical vs. 6,656 MiB required** (2,057 MiB short), **9,155 MiB free commit vs. 5,120 required**, **5,198 MiB free VRAM vs. 4,608 required**, and **6% GPU utilization vs. <50% required**. Physical RAM alone refused.
- Pagefiles remained active: `C:\pagefile.sys` allocation/current/peak **7,664 / 2,879 / 3,518 MiB**; `E:\pagefile.sys` **2,944 / 1,690 / 2,459 MiB**. Automatic pagefile management remains off. Commit headroom is about 4 GiB above its floor, so the observed blocker is not commit pressure and gives no evidence for a pagefile change.
- After Veritas exited, no command line matched the Covert checkout; no model-runtime listeners remained on `18888`, `58697`, `8080`, or `8104`; and `wsl --list --running` reported no running distributions. The Veritas/test process tree had exited. No Covert-owned model, browser, test, DAP/debug, or fixture process was found to clean up.
- The largest observed ongoing process working sets were ChatGPT **1,003 MiB**, interactive OpenCode **806 MiB**, Windows Defender **527 MiB**, Codex **467 MiB**, TextInputHost **326 MiB**, another ChatGPT process **301 MiB**, and Edge **232 MiB**. OpenCode had an interactive `cmd.exe` parent and no Covert checkout marker. These are user/OS processes and were left untouched; process working sets are not additive physical-memory attribution.

**Updated blocker:** repeatable host admission still refuses on physical RAM alone. No Covert-side process or lifecycle leak remained after the full regression run. The owner can pause enough interactive workload, then request a fresh immediate preflight; no model start should occur before that probe passes all floors.

## Candidate identity and safe profile

The selected exact artifact for any future retry is the existing Passport artifact, `LFM2.5-2.6B-Q4_K_M.gguf`; no larger candidate is substituted. Local SHA, metadata, exact current upstream file/revision match, license, embedded template markers, and the prior bounded runtime profile are recorded in [its model card](MODEL-CARD-LFM2.5-2.6B-Q4_K_M.md).

The host also contains smaller files, including the optional SmolLM2 360M manifest artifact. Its exact bytes and GGUF header match the checked-in manifest, and its embedded template passes the import-format check; this establishes artifact identity and parser compatibility only. The active Runtime Broker decision pins Unsloth, while the accepted Runtime Passport binds the exact Liquid LFM2.5 artifact. SmolLM2 therefore is not a valid substitute for proving this canonical adapter/lifecycle path without a separately governed runtime profile and qualification. Direct llama.cpp remains reference/recovery only in the accepted architecture. For the current canonical path, the LFM2.5 artifact is the smallest candidate with exact-scope successful Runtime Passport evidence; no default-launch failure is being attributed to the model itself.

The prior Runtime Passport qualifies only the exact Unsloth `2026.9.11` / Vulkan / Windows Administrator / GTX 1060 Mobile scope. It records a 0-temperature, 512-token request profile, successful exact-model load and lifecycle, and a bounded 30-minute soak. The effective served context remains unknown. The imported Model Access `context_tokens=32768` is a load request, not proof of effective context. This closure did not repeat the Passport's runtime start or inference.

## Current gate and next action

Current state is **`REFUSE_RESOURCE` / physical RAM only**. Do not call the model unsupported, and do not try a smaller artifact below the same floor. The canonical start path also now requires a current Authority-saved, exact-artifact/runtime-bound profile. After owner workload is gracefully paused, the profile is saved through `/api/models/profile`, and the immediate canonical admission probe passes, resume the ladder through the approved Authority/Model Access route: exact artifact check → Unsloth identity/health → short generation using the frozen profile → multi-turn → cancellation → stop/resource release → restart and same-artifact generation → role-specific probes. Capture fresh measurements and exact-SHA CI before claiming any new runtime proof.

## Canonical model-profile integration follow-up — 2026-09-30

- `BrokerModelRuntime.saveProfile` now persists profiles through the existing `/api/models/profile` service path using atomic JSON replacement and per-file mutation serialization. The sidecar binds `schema_version=1`, exact artifact SHA-256, `runtime_id=UNSLOTH`, and the accepted backend version. The route remains Authority-governed; profile state is not written by a launch script or alternate manager.
- The Unsloth profile accepts only the settings currently supported by the adapter contract: requested `context_tokens`, generation `temperature`, and `max_tokens`. Unsupported samplers/presets, malformed profiles, profile/hash drift, and runtime-version drift fail closed. Bound profiles are not reinterpreted by the legacy llama.cpp path. The adapter carries defaults for each load, allows explicit per-request overrides, and clears defaults on unload, shutdown, unexpected process exit, and before a reload.
- The single-sample local chat route no longer sends the generic `0.2` temperature when the caller omits it; the bound model profile can now take effect. External chat keeps its existing default, and an explicit local chat temperature still overrides the saved default.
- The model-card request remains context `32768`, temperature `0`, and maximum output `512`, drawn from the imported record and historical Runtime Passport. `32768` remains only a requested load context; effective served context is still unknown. The model's embedded GGUF template remains authoritative and receives no generic override. No stop-string, thread, batch, mmap/mlock, or GPU-layer values were invented.
- The actual user artifact sidecar was still absent after this source/test slice. It was not created or modified directly. The existing frozen Passport values must be persisted via the Authority endpoint before a later start; no runtime was started as part of this follow-up.
- Focused Node 26 architecture set: **35/35 passed**, including Broker profile binding/load/reload, Unsloth default/override/reset, Authority profile-route behavior, and local-chat temperature forwarding. Tests used isolated temporary fixture artifacts; they are not model execution evidence.

### Fresh host/process sample — 2026-09-30T05:50:38Z

- Node `os.freemem()` reported **4,889 MiB free physical RAM**; Windows WMI reported **4,931 MiB**. Both are below the **6,656 MiB** admission floor by at least **1,725 MiB**.
- Windows commit limit / committed / free: **26,915 / 17,736 / 9,179 MiB**. Commit remains above its **5,120 MiB** floor. Pagefile allocations/usages were C: **7,664 / 2,976 MiB** and E: **2,944 / 1,724 MiB**; pagefiles are enabled and no change was justified by commit pressure.
- The exact Covert checkout process scan, local model/Unsloth process scan, and runtime listeners on `18888`, `58697`, `8080`, and `8104` were empty. WSL reported no running distributions. The focused test process exited; no Covert test/debug child was left running.
- The largest visible working sets were ChatGPT **1,024 MiB**, interactive OpenCode **844 MiB**, Windows Defender **524 MiB**, Codex **469 MiB**, and TextInputHost **326 MiB**. OpenCode's parent was an interactive `cmd.exe` and its command line had no Covert checkout marker. These processes were left untouched; working-set sums are not a physical-RAM attribution model.

This follow-up did not clear the physical admission blocker. It did close a Covert-side profile wiring gap while preserving the floor and the existing artifact collection.

## Model-profile readiness alignment and final validation — 2026-09-30

- Passive Broker status now uses the same artifact/runtime-bound profile validation as start. An absent, malformed, unsupported, stale, or incomplete profile reports `pending` with `setup_required=true`; it cannot appear ready while canonical start will refuse it. Status inspection does not mutate the Model Manager context. A validated context is applied only when the canonical start path proceeds, after artifact and profile checks and immediately before Resource Admission/load.
- Regression coverage proves an artifact with only a legacy unbound llama.cpp profile remains pending, the Authority-save path binds only supported Unsloth settings, passive status leaves context unchanged, and start/restart apply the saved context and generation defaults. No direct write was made to the user's artifact.
- The first Veritas attempt after the status change passed `npm run check` but failed the broader `npm test` battery at Telegram offset acknowledgement. Root cause: the test's polling predicate accepted any existing `offset.txt`, so it could return the previous value `12` before the final expected acknowledgement `13` was persisted. The wait now requires exactly `13`; the focused Telegram battery passed **5/5**. A later Veritas attempt with default fixture timing reported its embedded compile/check stage failed without preserving a specific test failure in the wrapper output. The full check was then captured with the repository's documented `AIDE_FIXTURE_TIMEOUT_MS=15000` setting and passed **843 total / 832 passed / 0 failed / 11 skipped**; Node and browser TypeScript passed, ESLint reported **0 errors / 62 warnings**. Final `npm run veritas` with that same setting passed all six checks (`path-boundary`, `secret-scan`, `manifest-validation`, `compile`, `tests`, `git-diff`), score **1.0** against **0.9**, evidence level `sufficient`.

### Final idle host and process sample — 2026-09-30T08:02Z

- Canonical Resource Admission at `2026-09-30T08:02:04.822Z` returned **`REFUSE_RESOURCE`**: free physical RAM **5,302 MiB / 6,656 MiB floor** (short **1,354 MiB**). Free Windows commit was **9,028 / 5,120 MiB**, free VRAM **5,176 / 4,608 MiB**, and GPU utilization **24% / below 50%**; physical RAM alone refused.
- At `08:02:04Z`, Windows WMI measured **5,324 MiB** free of **16,307 MiB** physical, commit limit/used/free **26,915 / 17,764 / 9,151 MiB**. Active pagefiles were C: **7,664 MiB allocated / 3,291 MiB used** and E: **2,944 / 1,785 MiB**. Commit remained well above its floor, so no pagefile change was indicated.
- After Veritas exited, the Covert checkout, model-runtime, Unsloth/llama/Ollama, debug, and Node inspector process scan was empty; listeners `18888`, `58697`, `8080`, `8104`, and `9229` were absent; WSL had no running distributions. No Covert-owned runtime/test child or process-backed runtime lease remained to clean up.
- Largest working sets included ChatGPT **1,145 MiB**, interactive OpenCode **756 MiB** (parent was an interactive command shell, with no Covert checkout marker), Defender **536 MiB**, Codex **472 MiB**, and TextInputHost **326 MiB**. These unrelated processes were left untouched; working-set values are observations, not an additive attribution of physical use.
- The user's model artifact still has no adjacent `.profile.json`; no actual model start, generation, cancellation, stop, or restart was attempted. The candidate remains **configuration-required / runtime-unverified**, not rejected or qualified. The safe executable path for local inference remains closed until the owner workload releases at least the measured **1,354 MiB** physical-memory shortfall and the exact profile is saved through the Authority-governed `/api/models/profile` route.

## Exact-SHA source verification — 2026-09-30

- Source checkpoint `14fd1309a832d05cf682ec28dcb3bc189ada999b` passed exact-SHA AIDE CI run [36687590764](https://github.com/AnonymousNomad/covert-coder/actions/runs/36687590764). The workflow completed successfully, including frontend build, backend/integration tests, type checks/lint, bounded architecture tests, all six Veritas gates, generated-file/worktree checks, and cleanup.
- CI verifies the pushed source/profile integration and its fixtures. It does not change the host admission result or prove a real model start. No live inference was attempted.
- The model-card documentation checkpoint `d51494563602bf42bad497c3d08ac8de90fb3aad` passed exact-SHA AIDE CI run [36688849438](https://github.com/AnonymousNomad/covert-coder/actions/runs/36688849438). Its workflow completed successfully, including build, integration tests, type checks/lint, bounded architecture tests, Veritas, generated-file/worktree checks, and cleanup.
- A further model-card addendum is currently local WIP and is not included in CI `36688849438`: it pins the separately reviewed base-card snapshot, records per-model resource projection as unknown, and reflects the adapter's absence of explicit template/stop overrides. Effective Unsloth template and stop behavior remain **UNKNOWN** until the installed runtime path is independently verified. This addendum will receive its own exact-SHA check after push.
