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

The prior Runtime Passport qualifies only the exact Unsloth `2026.9.11` / Vulkan / Windows Administrator / GTX 1060 Mobile scope. It records a 0-temperature, 512-token request profile, successful exact-model load and lifecycle, and a bounded 30-minute soak. The effective served context remains unknown. The imported Model Access `context_tokens=32768` is a load request, not proof of effective context. This closure did not repeat the Passport's runtime start or inference.

## Current gate and next action

Current state is **`REFUSE_RESOURCE` / physical RAM only**. Do not call the model unsupported, and do not try a smaller artifact below the same floor. After owner workload is gracefully paused and the immediate canonical admission probe passes, resume the ladder through the approved Authority/Model Access route: exact artifact check → Unsloth identity/health → short generation using the frozen profile → multi-turn → cancellation → stop/resource release → restart and same-artifact generation → role-specific probes. Capture fresh measurements and exact-SHA CI before claiming any new runtime proof.
