# Local Model Vertical Resume — 2026-10-08

## State

- Worktree: `E:\covert-local-model-demo-proof-20261007`
- Branch: `feat/local-model-demo-proof-20261007`
- Starting HEAD: `8e34dab7aa118bb83e7b77208c0c02f6997a2067`
- Starting tree: clean
- Current classification: **ACQUISITION PARSER REPAIR VERIFIED; LIVE ACQUISITION AND MODEL EXECUTION BLOCKED / NOT YET PROVEN**
- No Saul workstation/platform branch or canonical convergence worktree was modified.

## Preserved admission refusal

At `2026-10-08T12:31:30.279Z`, the branch's real `createResourceAdmission().admitLocalRuntimeStart()` returned `REFUSE_RESOURCE`:

| Probe | Observed | Required |
|---|---:|---:|
| Free physical memory | 2,494 MiB | 6,656 MiB |
| Free Windows commit | 2,519 MiB | 5,120 MiB |
| Free VRAM | 5,533 MiB | 4,608 MiB |
| GPU utilization | 17% | `<50%` |

The exact refusal reason was that free physical memory and free commit were both below their unchanged local-runtime floors. No model process was started. The earlier manual physical-memory conversion that printed `0 GiB` double-divided the Win32 CIM KiB value and is discarded as an invalid measurement; the canonical admission probe above is the resource evidence for this checkpoint.

An already-running Covert stack was observed on ports 4173/4777/4778/4779. Its health response reported workspace `E:\pip_temp\covert-public-demo-workspace-20261007-luna`, not this branch root. That stack was left untouched and is not used as proof for this lane. A live acquisition and registration must run with this worktree as the configured workspace.

### Fresh host resource snapshot and execution pause

At `2026-10-08T12:50:04.450Z`, a read-only Windows host sample reported:

| Probe | Observed | Required for local model start |
|---|---:|---:|
| Free physical memory | 2,095 MiB | 6,656 MiB |
| Free commit (`Commit Limit - Committed Bytes`) | 685 MiB | 5,120 MiB |
| E: free disk | 73.3 GiB | No additional disk floor in this probe |

This was a host snapshot, not a fresh `admitLocalRuntimeStart()` response. Both measured memory values are materially below the unchanged floors, so no model runtime, inference, or branch-specific Covert stack was started. The prior Covert stack remains on the wrong workspace and untouched. The low commit headroom also makes starting a second multi-process UI/backend stack an unsafe way to pursue acquisition now. No foreign process was stopped, no pagefile setting was changed, and no model collection was modified. Re-measure before any later launch; only a fresh canonical Admission `START` authorizes a model start.

A second host sample at `2026-10-08T13:10:04.648Z` reported 2,039 MiB free physical and 782 MiB free commit (same 6,656/5,120 MiB model floors). No new branch stack was active on its selected ports. This sample also remains below the model-start gate; no model was started.

## Acquisition parser defect

The official Hugging Face `huggingface_hub` API reference shows LFS metadata in `RepoFile.lfs` with `sha256` and `size` fields: <https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api>.

Before repair, `node/src/services/modelhub.mjs` read only `sibling.lfs.oid`. A new test using the documented `lfs.sha256` shape reproduced the defect at `tests/unit/test-m-hub.mjs:157`: observed digest `null`, expected a 64-character SHA-256. The service now accepts a valid 64-hex `lfs.sha256` first and retains the prior valid 64-hex `lfs.oid` compatibility path. Missing or malformed digest data remains `null`; download still requires the inspected immutable revision, expected digest, and positive exact size.

This regression fixture diagnoses field mapping only. It is not a live Hub response, model artifact, artifact validation, or inference evidence.

### Current Hugging Face metadata check (external API, not Covert flow proof)

At approximately `2026-10-08T13:14Z`, read-only requests to Hugging Face's public API (not through the Covert UI/routes) used `/api/models?search=LFM2.5-2.6B-GGUF&filter=gguf&sort=downloads&direction=-1&limit=20` and `/api/models/LiquidAI/LFM2.5-2.6B-GGUF?blobs=true`. Search returned one exact repository match. Inspection reported current revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`, license label `other`, and the selected `LFM2.5-2.6B-Q4_K_M.gguf` entry at `1,674,455,040` bytes with LFS SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`. This matches the pre-existing passport and current external artifact hash. It does not prove Covert's own search, inspection, download, registration, or Authority path; those gates remain open.

## Exact execution profile to preserve

The only existing qualified local profile suitable for this lane is the narrow Unsloth V1 passport. It must not be generalized to other artifacts or runtime versions:

- Source: `LiquidAI/LFM2.5-2.6B-GGUF`
- Immutable revision recorded in prior local evidence: `e7caca5d835a3901a8e0d63e94009429bafafdfc`
- Artifact: `LFM2.5-2.6B-Q4_K_M.gguf`
- Expected bytes: `1,674,455,040`
- Expected SHA-256: `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`
- GGUF architecture: `lfm2` (must be re-read from the acquired file)
- Runtime: canonical Runtime Broker → Unsloth `2026.9.11`, Windows-native Administrator, Vulkan, GTX 1060 Mobile profile
- Request settings: temperature `0`, context request `2,048`, output limit `512`
- Template: current profile path uses the GGUF embedded chat template; stop-token behavior and effective served context remain `UNKNOWN` until live evidence proves them.
- Runtime start remains guarded by canonical Resource Admission: 6,656 MiB free physical, 5,120 MiB free commit, 4,608 MiB free VRAM, GPU utilization below 50%, plus the existing runtime ownership/version and profile-binding checks.

The prior passport is historical exact-artifact qualification, not proof that the artifact is present in this workspace, that the live Hub still reports this revision metadata, or that this branch has completed a new run.

### Current external artifact observation (not acquisition evidence)

The exact artifact was found at the pre-existing user model collection path `E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf`, outside this worktree. A read-only file check and single SHA-256 pass on `2026-10-08` observed `1,674,455,040` bytes and SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`; the file's recorded last-write UTC was `2026-08-30T00:18:53.0946435Z`. The adjacent sidecar binds that digest to `UNSLOTH` `2026.9.11`, context request `2,048`, temperature `0`, and `512` maximum output tokens. The artifact and sidecar were not copied, moved, edited, or registered in the demo workspace.

The canonical `probeGguf()` parser was run read-only against that external file and returned: GGUF v3; architecture `lfm2`; name `Ab00687315Bc1298E9D54E9C4B611Dde9867Ccc2`; size label `2.7B`; `general.file_type=15`; license metadata `other`; model context metadata `131,072`; 30 blocks; embedding length `2,048`; 32 attention heads; 8 KV heads; a 5,443-character embedded chat template; BOS ID `124894`; EOS ID `124900`; `add_bos_token` absent. This verifies current external artifact bytes and parseable metadata only. It does not prove this branch's Hub inspection/download/verification or current-workspace Model Manager registration.

### Isolated app startup failure

At about `2026-10-08T13:04Z`, the canonical `scripts/start.mjs --frontend=vite` launcher was run on previously free ports `4273/4877/4878/4879`, with `AIDE_WORKSPACE` set to this source worktree and the default `30,000 ms` readiness bound unchanged. The exact first failure was:

```text
[start.mjs] TypeScript backend did not become ready at http://127.0.0.1:4878/api/health: fetch failed
```

The legacy daemon logged its start for this workspace. TypeScript stdout and stderr files were empty, and the existing `arch-daemon.log` last-write timestamp predated this attempt. No listener remained on the four selected ports afterward; the pre-existing stack and its workspace were left untouched. The TypeScript child PID and live resource state were not captured during the failed window, so **CAUSE UNKNOWN**. No timeout was increased and no model start was attempted. A source-workspace recursive watcher is a hypothesis only. The failure-specific procedure was updated at `C:\Users\Grey_\.agents\skills\failure-typescript-backend-readiness-intermittent\SKILL.md`; the next controlled start must capture the exact TypeScript child PID, age, CPU/private/working memory, listener state, and logs while using a dedicated empty runtime workspace.

#### Empty-workspace reproduction and current hold

At `2026-10-08T13:56:51Z`, the same launcher was run from this checkout with a newly created, empty `AIDE_WORKSPACE=E:\covert-model-demo-runtime-20261008`; selected ports were again confirmed free before launch. `AIDE_UI_PORT=4273`, `AIDE_FACADE_PORT=4877`, `AIDE_ARCH_PORT=4878`, and `AIDE_LEGACY_PORT=4879` were used, and `AIDE_START_TIMEOUT_MS` was left unset at its default `30,000 ms`. The exact result was the same TypeScript readiness failure:

```text
[start.mjs] TypeScript backend did not become ready at http://127.0.0.1:4878/api/health: fetch failed
```

During the launch, the legacy backend did bind port `4879` (PID `22280` at the sampled instant); no `4878` listener was observed then. TypeScript child stdout/stderr remained empty. The process-tree query completed after the startup attempt had already exited, so the TypeScript child PID, CPU, and memory were not obtained. After launcher cleanup, a later read found none of the four selected listeners. **CAUSE UNKNOWN** remains the only supported disposition. The empty workspace disproves the narrower hypothesis that the source checkout's recursive workspace watcher alone explains the failure; it does not identify the cause. No model runtime was started.

Source inspection shows the TypeScript server awaits DAP manager creation, `createModelRuntime()`/`runtime.load()` (which binds the endpoint from canonical runtime status), and `buildRoutes()` before calling `server.listen()`. Route construction also awaits several workspace stores and the optional embeddings gate. There are no stage timestamps before the listener-ready log. These are candidate boundaries for the next trace, not evidence that any one caused this failure.

At about `2026-10-08T13:56Z` (direct `nvidia-smi` sample), the GTX 1060 reported `5,209 MiB` free VRAM and `1%` utilization. At `2026-10-08T13:59:20Z`, the OS resource sample reported `7,176 MiB` free physical memory and `5,036 MiB` free virtual memory; that was an indicative host sample, not the canonical commit probe. At `2026-10-08T14:05:29Z`, I called the canonical `createResourceAdmission().admitLocalRuntimeStart()` read-only, without the unavailable HTTP route and without starting any model. It returned `REFUSE_RESOURCE`: free physical `6,576 MiB` (< `6,656` by `80 MiB`), free Windows commit `4,299 MiB` (< `5,120` by `821 MiB`), free VRAM `5,229 MiB` (above the `4,608` floor), and GPU utilization `7%` (below `50%`). The load-average probe was marked unknown. This is an exact canonical service refusal, not an app-route or runtime-start proof. The prior `13:54:07Z` pagefile sample remains the latest pagefile-configuration observation; no pagefile change was made.

#### Latest resource and process observation

At `2026-10-08T15:02:24Z`, another read-only call to the canonical admission service returned `REFUSE_RESOURCE`: free physical memory `3,585 MiB`, free commit `null` (the canonical probe could not measure it), free VRAM `5,598 MiB`, and GPU utilization `3%`. At `15:03:27Z`, a separate Windows OS/pagefile snapshot showed `4,184 MiB` free physical, `3,221 MiB` free virtual memory, `30,080 MiB` total virtual memory, and `C:\pagefile.sys` allocated `13,773 MiB` with `11,747 MiB` in use. The free-virtual figure is not substituted for the canonical commit measurement. Both physical samples are below the local runtime floor; no model start or further app launch was attempted.

The selected startup ports still had no listeners. Two Node processes discovered during the host refresh were identified by exact command line as the separate Desktop Commander MCP server (PIDs `25232` and `7152`, parent command processes `25404` and `5716`); they were not children of Covert's launcher and were left untouched. This tool's resource use is not attributed to Covert. `scripts/start.mjs`'s `waitForHttp()` checks `child.exitCode` on each poll and would report `exited before readiness` on an observed early exit. The recorded deadline error ending in `fetch failed` therefore means no early exit was observed during the polling loop; together with the sampled absence of a `4878` listener, this narrows the reproduction to a TypeScript child alive without a listener at the observed sample. It does not identify the blocked initialization stage, and an exit during the final interval is not excluded.

#### Canonical acquisition-to-runtime path reconciliation (source only)

The existing path is suitable in shape and has not been exercised live in this workspace:

1. Model Access search and repository inspection use `/api/modelhub/search` and `/api/modelhub/files`; both are classified `capability.external` operations. Inspection returns a pinned 40-character repository revision, GGUF file size, LFS SHA-256, and repository license label.
2. `/api/modelhub/download` is also `capability.external` and binds repository, filename, quantization label, immutable revision, expected SHA-256, and expected size. The service verifies the received size and SHA-256, parses the `.part` file as GGUF, then publishes the artifact and verification manifest inside the workspace models root. This proves only the implemented contract until a real Covert download completes.
3. `/api/models/register` is a separate `capability.write` operation. The runtime resolves both the bundled repository models root and `<AIDE_WORKSPACE>/models`, validates the artifact and its acquisition manifest, and persists registration in the workspace ingested-model store. Registration is availability/identity metadata; it does not establish qualification or start the runtime.
4. The existing exact LFM2.5 profile path is already rendered in Model Access. After registration and exact artifact verification, `/api/models/profile` must bind SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed` to runtime `UNSLOTH` version `2026.9.11`, with temperature `0`, requested context `2,048`, and maximum output `512`. The GGUF embedded template is the selected source; stop-token behavior and effective served context remain `UNKNOWN` until observed.
5. `/api/models/start` is `capability.execute` and performs canonical Resource Admission before `manager.start`; `BrokerModelRuntime.start` repeats final admission before the runtime load. The accepted Unsloth profile then checks exact artifact hash, runtime version, loopback endpoint ownership, and runtime-reported requested-artifact identity. The real output must be recorded only after those checks pass.

These are code-path findings, not live search, download, registration, admission, launch, or inference evidence. No alternate server, direct import, or admission bypass was used.

The current mutable Hugging Face model page labels the repository license `lfm1.0`, reports the GGUF architecture as `lfm2`, and lists the Q4_K_M artifact at about 1.67 GB. Its llama.cpp example uses temperature `0.1`, top-k `50`, and repeat penalty `1.1`. This page is not the pinned revision record and does not override the existing Covert-tested profile. The pinned license/revision/file metadata must be reconfirmed through Covert inspection; the downloaded GGUF template and stop behavior must be inspected before runtime claims. No configuration was inferred from the filename or copied from that mutable page.

### Pinned license metadata repair and latest gate refresh (2026-10-08 15:17Z)

The official Hugging Face API was queried read-only outside Covert at `https://huggingface.co/api/models/LiquidAI/LFM2.5-2.6B-GGUF?blobs=true`. It returned revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`, `cardData.license="other"`, `cardData.license_name="lfm1.0"`, and `cardData.license_link="LICENSE"`. The pinned [repository README](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/e7caca5d835a3901a8e0d63e94009429bafafdfc/README.md) confirms those metadata fields and the llama.cpp example settings `temp 0.1`, `top-k 50`, and `repeat-penalty 1.1`. A read-only request for that revision's `LICENSE` returned HTTP 200 and identified `LFM Open License v1.0`; the official [Liquid AI license page](https://www.liquid.ai/lfm-license) describes the commercial-use threshold as annual entity revenue below USD 10 million, with separate licensing required at or above the threshold. This is license metadata and source research, not legal approval or Covert acquisition evidence.

The prior local GGUF parse reported its embedded `general.license` as `other`; that artifact field and the repository card's custom `license_name` are distinct metadata sources. Neither a model's embedded metadata nor the public repository label by itself establishes legal approval.

Root cause of the metadata defect: `createHubService().listRepoFiles()` read only `cardData.license`, so the real custom-license response was surfaced in Model Access and acquisition manifests as generic `other`. A regression using the observed `license` / `license_name` / `license_link` shape first failed (`actual: other`, expected `lfm1.0`). The bounded repair prefers a non-empty `license_name` and falls back to `license` for standard repositories. The existing contract and field name remain unchanged. The unit test also retains coverage for a repository that supplies only `license`.

Focused verification after repair:

```text
node --test --test-concurrency=1 tests/unit/test-m-hub.mjs
exit 0; 13 passed; 0 failed; 0 skipped; 0 cancelled

node --test --test-concurrency=1 tests/arch/model-access.test.ts
exit 0; 15 passed; 0 failed; 0 skipped; 0 cancelled
```

The affected `tests/arch/modelhub-routes.test.ts` run produced a preserved red: `12 failed, 0 passed`. The first test aborted at approximately its 5-second local HTTP deadline; subsequent tests reported the same `TimeoutError` family much sooner. A deliberate single-test isolation with TAP reporting then classified the failure as `hookFailed`: the test body never started because module `before()` failed while pairing. The default fixture timeout was `5,000 ms` (`AIDE_FIXTURE_TIMEOUT_MS` was unset). The exact test-owned log at `E:\pip_temp\aide-m-arch-kRbHUa\arch-m.log` records the pairing POST completing after `8,708 ms` at `15:13:43.130Z`, above that bound; log SHA-256 `2DF2E4EED6AF18B5BD052E3568647E811C3D54CF00EFF3307EA989B09592AFBE`. Source inspection shows `ExecutionAuthority.pair()` awaits required durable audit persistence, and `createStateBus.append()` does `mkdir → open → writeFile → sync → close`. This is the likely latency path, but no internal timings prove which sub-operation consumed the 8.7 seconds. The suite did not reach its Model Hub assertions. The 15:13 fixture workspace was verified as created by this run and removed after recording its log; an older directory with the same prefix, created on September 20, was preserved. The route-test fixture has since been updated to the real custom-license metadata and expects `lfm1.0`; that updated route assertion remains unverified. Do not increase fixture deadlines or treat the red as unrelated. A post-suite host sample at `15:14:53Z` reported 3,161 MiB free physical memory and 2,774 MiB free commit; this could contribute but does not prove causality. A second targeted run failed at the same default hook bound, then exited. No rerun is planned under the lower host headroom.

##### Follow-up persistence latency samples (2026-10-08 15:23–15:30Z)

One direct `createStateBus(workspace).append()` in a fresh E: temporary workspace returned `{ persisted: true }` for a 105-byte record in `3,499.73 ms`. A subsequent single-stage measurement of the same `mkdir/open/writeFile/sync/close` sequence returned `1.32 / 1.51 / 1.24 / 145.41 / 1.54 ms` respectively (`151.03 ms` total). The code path and stage order are confirmed, but the samples vary by over 20×; they do not prove `sync()` caused the earlier 8.708-second pairing request. The stage-timing command itself took over a minute to return from the execution tool while its internal `performance.now()` total was 151.03 ms, so tool/process observation latency must not be conflated with measured file latency. Both unique probe workspaces were removed after verifying their exact paths and contents. **Authority-pair latency cause remains UNKNOWN**; no product change or timeout adjustment was made.

At `2026-10-08T15:10:12.564Z`, the canonical read-only `createResourceAdmission().admitLocalRuntimeStart()` returned `REFUSE_RESOURCE`: free physical memory `3,625 MiB` (< `6,656`), free commit `2,948 MiB` (< `5,120`), free VRAM `5,561 MiB` (above `4,608`), GPU utilization `23%` (below `50%`), and load average unknown. No new app or model was started in response to that measurement. A separate already-running Covert process tree owned ports `4173/4778/4779/4777` and was left untouched; its launcher command used `E:\covert-sovereign-workstation-shell` with workspace `E:\pip_temp\covert-public-demo-workspace-20261007-luna`, so it is not this local-model demo workspace. The ambiguous AES LedgerPro `ollama.exe` and unrelated host processes were also left untouched. The common ports are therefore not available for an isolated start at this observation.

Issue #38 was rechecked after the resource and regression results; GitHub displayed no activity/comments. This branch remains local-only: `origin` has no `feat/local-model-demo-proof-20261007` ref and the branch has no upstream. Do not push the unresolved route red or claim this lane's exact-SHA CI.

## Verification on this branch

The recorded `55 passed` affected-suite line below has no attached raw log or run timestamp. This evidence file separately preserves a Model Hub route-suite run with `12 failed` because Authority pairing exceeded the unchanged fixture deadline before the test bodies ran. Treat the route gate as **UNRESOLVED** until a newly timestamped run passes; neither line erases the other.

Pre-repair bounded suite at the unchanged starting HEAD:

```text
node --test --test-concurrency=1 tests/unit/test-m-hub.mjs tests/unit/test-modelhub-containment.mjs tests/arch/modelhub-routes.test.ts tests/arch/model-access.test.ts tests/arch/model-register-profile.test.ts tests/arch/resource-admission.test.ts tests/arch/gguf.test.ts tests/arch/api-client.test.ts
exit 0; 101 passed; 0 failed; 1 skipped; 0 cancelled
```

The skip was the repository GGUF metadata test because no `models/*.gguf` artifact is committed in this checkout. This is not model evidence.

The new regression first failed as expected, then passed after the parser repair. Post-repair affected suite:

```text
node --test --test-concurrency=1 tests/unit/test-m-hub.mjs tests/unit/test-modelhub-containment.mjs tests/arch/modelhub-routes.test.ts tests/arch/model-access.test.ts
exit 0; 55 passed; 0 failed; 0 skipped; 0 cancelled
```

`git diff --check` passed. Targeted ESLint was attempted with `node_modules/.bin/eslint.cmd` on both changed files, then on `node/src/services/modelhub.mjs` alone. The Node lint process stayed silent at low CPU (about 1 CPU second and 110 MiB private memory after roughly 60 seconds on the single-file attempt); both exact invocations were interrupted with Ctrl-C and exit 1. Lint status is **INCOMPLETE**, not pass and not a reported lint finding. No retry of the project-wide lint graph was started.

## Gates still open

| Gate | State |
|---|---|
| Product UI live search and inspect on this branch/workspace | BLOCKED by TypeScript backend startup failure |
| Immutable Hub revision + exact LFS SHA/size observed through Covert | OPEN |
| Real artifact download + bytes/SHA-256/GGUF validation | OPEN |
| Canonical Model Manager registration in this workspace | OPEN |
| Resource Admission | `REFUSE_RESOURCE` at `2026-10-08T15:10:12.564Z`; physical `3,625 MiB`, commit `2,948 MiB` |
| Custom repository license name in Model Access | Unit parser proof passes; an un-timestamped 55/55 affected-suite pass is recorded; latest 12-failure setup red remains preserved |
| Model Hub route architecture suite | UNRESOLVED: recorded 55/55 pass lacks raw log/timestamp; separately captured run has `12 failed / 0 passed` at Authority pairing, `8,708 ms` > `5,000 ms`; cause UNKNOWN |
| Runtime ownership/version/profile check | OPEN |
| Real local inference output | OPEN |
| Stop/restart and post-run cleanup | OPEN |
| Baseline load/TTFT/prompt/decode/RAM/VRAM metrics | DEFERRED until a real inference passes and resources permit |
| Exact-SHA CI | OPEN; this branch is local-only and the latest repair is not pushed |

## Next action

This turn's `license_name` repair has focused unit and Model Access coverage. The Model Hub route suite's immediate failure boundary is now localized to slow durable Authority pairing in its `before` hook; the internal I/O sub-stage and host contribution remain **UNKNOWN**. In the `12 failed` run, the updated route assertion was not reached; the separate recorded 55/55 result has no raw log or timestamp. Keep the red open and do not push the candidate. The live startup failure also remains unresolved. The latest canonical admission result is `REFUSE_RESOURCE` at `2026-10-08T15:10:12.564Z`, and the common ports are occupied by a separate Covert stack. Do not start another app stack or any local model in this state. The next action is to reproduce Authority pairing under a safe resource window with the default fixture bound unchanged and capture the pairing/audit timing; then repair only a proven cause and rerun the affected suite. For the startup lane, capture the exact TypeScript child PID/tree, age, CPU, private/working memory, listener state and startup logs during one safe controlled reproduction. After those gates close, use the existing Model Access → Model Hub → workspace models → Model Manager path. A real model start still requires a fresh canonical `admitLocalRuntimeStart()` result of `START` and exact runtime identity before accepting inference output.

## GGUF metadata buffering follow-up (2026-10-08T15:40Z)

The current `probeGguf()` implementation discarded its 64 KiB read window after each skipped string-array value. The real LFM2.5 GGUF contains a large tokenizer string array. A read-only metadata attempt remained active at 34 seconds with Node CPU time `18.75 s` and working set `80.3 MiB`; its process exited before a scoped stop request, and that attempt's stdout was not retained. I therefore do not use it as a metadata result. The code path explained the repeated reads, and a deterministic synthetic regression reproduced it: parsing 128 token strings made `129` separate file reads in `337.6 ms`, exceeding the new buffered-read assertion.

The bounded repair makes `skip()` consume bytes already buffered and clears the read window only when the skipped value extends past it. No parse rules, GGUF limits, metadata fields, model validation, runtime settings, or qualification states changed. The new regression passed after repair.

On the actual existing host artifact, the repaired parser completed a metadata-only read in `222.63 ms` using `119` file reads. It returned GGUF v3, architecture `lfm2`, `general.file_type=15`, model context metadata `131072`, 30 blocks, embedding length `2048`, and 32 attention heads. Embedded `tokenizer.chat_template` measured `5,443` bytes with SHA-256 `ea663864491de7ade391839479860ca95541f892f72665c73251fbd4643b1bef`; the observed template included system/user/assistant markers, BOS placeholder, thinking tags, and tool-call markers. Tokenizer metadata reported BOS ID `124894`, EOS ID `124900`, and no explicit `add_bos_token` value. This matches the existing model card's recorded template hash. The sidecar was read-only and still binds the artifact hash to Unsloth `2026.9.11`, context request `2048`, temperature `0`, and maximum output `512`. This turn did not recompute the full 1.67 GB artifact SHA or start any model.

Verification:

```text
node --test --test-concurrency=1 tests/unit/test-gguf-metadata-buffering.mjs tests/unit/test-m-hub.mjs
exit 0; 14 passed; 0 failed; 0 skipped; 0 cancelled

node --test --test-concurrency=1 tests/arch/gguf.test.ts
exit 0; 3 passed; 0 failed; 1 skipped; 0 cancelled
```

The architecture-test skip remains because no `.gguf` is committed under this checkout's `models/` directory. `git diff --check` passed before this evidence update; final diff hygiene remains to be repeated. No full TypeScript check, lint, full architecture suite, or exact-SHA CI was run. Existing Model Hub route and TypeScript startup blockers remain open. A fresh Windows OS snapshot showed `3,416 MiB` free physical and `4,274 MiB` free virtual memory; the latter is not the canonical commit probe. The separate stack still owns ports `4173/4777/4778/4779`; it was not touched, and neither a new app stack nor model runtime was launched.

Issue #38 was checked after this material regression change. Its latest update is `2026-10-07T10:47:38Z`; no newer Sol correction was present. The isolated feature branch remains local-only with no upstream; do not push while the Model Hub route red and startup failure remain unresolved. The next release-critical action is to reproduce the Authority pairing delay with per-stage audit timing at safe host headroom, then resume the canonical launcher diagnostic and live Model Access path.

## Canonical admission refresh and runtime-profile preparation (2026-10-08T15:52Z)

The canonical read-only `createResourceAdmission().admitLocalRuntimeStart()` probe returned `REFUSE_RESOURCE` at `2026-10-08T15:52:13.840Z`:

| Probe | Observed | Required | Result |
|---|---:|---:|---|
| Free physical memory | 7,697 MiB | 6,656 MiB | Pass |
| Free Windows commit | 4,423 MiB | 5,120 MiB | **Refuse; short by 697 MiB** |
| Free VRAM | 5,574 MiB | 4,608 MiB | Pass |
| GPU utilization | 37% | `<50%` | Pass |

The local model was not started. A Windows CIM snapshot immediately beforehand reported 7,858 MiB free physical and 4,539 MiB free commit; the canonical admission sample is authoritative for this decision. It also observed `C:\pagefile.sys` allocated/current/peak at 14,220 MiB. No pagefile modification is justified by these samples, and no threshold was changed. The already-running Covert stack continues to own ports 4173, 4777, 4778, and 4779 under a different workspace; no listener or process was stopped.

The E: volume is healthy fixed NTFS, 878,859,776,000 bytes total with 76,129,738,752 bytes free. Current `Get-Partition`, `Get-Disk`, physical-disk, substitution, and SMB-mapping observations did not establish its physical-device mapping. Therefore the earlier slow `sync()` timing is not attributed to a disk device or media type; the Authority-pair cause remains **UNKNOWN**.

### Exact profile and later measurement rules

The only applicable execution profile remains the narrow existing Unsloth V1 passport; it is a profile reference, not proof for the new acquisition path:

- Artifact identity: `LiquidAI/LFM2.5-2.6B-GGUF`, immutable revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`, `LFM2.5-2.6B-Q4_K_M.gguf`, exactly 1,674,455,040 bytes and SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`.
- Runtime: canonical Broker → Unsloth 2026.9.11, Windows-native Administrator, Vulkan, GTX 1060 Mobile, loopback `127.0.0.1:18888`; no silent runtime fallback.
- Authority-saved sidecar must bind this exact artifact digest to `UNSLOTH` `2026.9.11`; request profile is context 2,048, temperature 0, maximum output 512. Prefer the artifact's embedded template; the current profile has no template override. Effective served context remains unknown unless observed.
- For the new vertical, only the artifact downloaded into this lane through the canonical Model Hub path can proceed to registration. Search and inspect must record the immutable revision and expected LFS SHA/size; download then independently validates the actual bytes, hash, and GGUF structure. The existing model under `E:\models` and historical passport do not substitute for those steps.
- After fresh canonical Admission returns `START`, record timestamps for admission, load request, and exact-model health. Measure request-to-first non-empty streamed delta as TTFT. Record prompt/completion token counts only when the runtime returns them. Native prompt/decode rates remain UNKNOWN without phase-specific timing; any client-derived rate must be labeled end-to-end/stream-observed and must not be presented as native throughput. Sample physical RAM, commit, VRAM, and GPU use before, during, and after the real inference. Do not begin optimization.

At the latest observation, standard ports are occupied by the unrelated-workspace stack, and free commit remains below the fixed floor. Therefore the isolated app stack, live Covert Model Hub acquisition, registration, and runtime sequence remain deferred. Issue #38 was rechecked; latest comment is still `6036313587`, with no newer corrective comment. The pairing setup red, startup failure, and route suite remain unresolved; this evidence does not close or waive them.

## Model Hub setup-red source reconciliation (2026-10-08T15:56Z)

Read-only inspection of the failing route fixture and the canonical call chain confirmed:

- `tests/arch/modelhub-routes.test.ts` calls `pairFixture()` in its module `before()` hook. That reaches the real in-process `/api/authority/pair` route before any Model Hub assertion. The preserved failure therefore did not exercise the updated license assertion or the download route.
- The same fixture injects `fakeFetch` and a small synthetic GGUF payload. It is contract/route coverage, not live Hugging Face search/inspection/download proof.
- `ExecutionAuthority.pair()` consumes the one-use pairing proof, then awaits required durable audit persistence. `ArchServer` wires the audit recorder through `createAuditTrail.emitAuthority()` to `harness/cipher-state.mjs`; `append()` performs `mkdir → open → writeFile → sync → close` on `.aide/cipher-state.jsonl`.
- The test creates its temporary fixture workspace through `os.tmpdir()`, which currently resolves to `E:\pip_temp`. The physical-device mapping of E: is not established. These facts narrow the slow request to the durable audit append path but do not prove which append stage caused the 8,708 ms pairing response or why one direct service sample spent 1,748 ms in `sync()`. **Cause remains UNKNOWN.**

When host conditions are safe for the unchanged focused route test, leave `AIDE_FIXTURE_TIMEOUT_MS` unset and source/deadlines unchanged. Preserve the first new result and capture the pair request, append stage timings, resource snapshot, workspace volume, and any child/log evidence. A controlled C:-scratch comparison can test whether timing varies by temp volume, but a faster result alone cannot close the original cause. Do not relax durability or increase the fixture bound.

The startup launcher source supports isolated workspace and port values through `AIDE_WORKSPACE`, `AIDE_UI_PORT`, `AIDE_FACADE_PORT`, `AIDE_ARCH_PORT`, and `AIDE_LEGACY_PORT`. It retains the 30,000 ms default readiness bound and writes child stdout/stderr under the selected workspace's `.aide/logs`. A later startup reproduction should use a fresh workspace and currently verified free alternate ports, while capturing child PID/tree and logs before cleanup. This source inspection does not resolve the earlier TypeScript readiness failure.

No test, Covert stack, model, or product code was started or modified during this source reconciliation. The real acquisition/registration/runtime path remains open.

## Existing Model Access path map (2026-10-08T16:00Z)

Read-only inspection found the canonical UI already connects the required stages; no parallel acquisition path is needed:

| Stage | Existing owner and Authority class | Binding / truth boundary |
|---|---|---|
| Search | `browser/src/panels/models.ts` → `/api/modelhub/search`; `capability.external` | Search query is exact-bound and requires approval before external Hugging Face contact. |
| Inspect | Model Access → `/api/modelhub/files`; `capability.external` | Exact repository ID; response supplies immutable revision, file size, and LFS SHA-256. |
| Download | Model Access → `/api/modelhub/download`; `capability.external` | Single approved body binds repository, filename, quant label, revision, expected SHA-256, and exact size. Service writes under the configured workspace `models/` root and verifies bytes and GGUF before reporting `done`. |
| Register | `/api/models/register`; `capability.write` | Enabled by the UI only after verified download completion. UI explicitly describes registration as local availability, not start or qualification. |
| Profile | `/api/models/profile`; `capability.write` | Authority-saved profile binds the artifact digest to the canonical runtime/version and request settings. |
| Start | `/api/models/start`; `capability.execute` | Route runs canonical Resource Admission; manager independently checks artifact/profile identity and takes its fresh Admission before the broker load. |
| Exercise / recovery | Model Manager’s canonical runtime/chat/stream/stop path | Must prove exact served identity, real output, cancellation, stop, restart and owned cleanup from the isolated workspace. |

This source map does not establish that the live UI, external requests, download, registration, admission, runtime, or inference works in this branch. No UI action or test ran while Admission remained closed. The route fixture's fake Hugging Face fetch remains only contract coverage. The user-facing evidence should follow the table's existing path and preserve `downloaded ≠ trusted`, `available ≠ qualified`, and `registered ≠ executing`.

## Fresh resource and port check (2026-10-08T16:02Z)

Canonical `createResourceAdmission().admitLocalRuntimeStart()` returned `REFUSE_RESOURCE` at `2026-10-08T16:02:00.418Z`:

| Probe | Observed | Required | Result |
|---|---:|---:|---|
| Free physical memory | 7,438 MiB | 6,656 MiB | Pass |
| Free Windows commit | 4,202 MiB | 5,120 MiB | **Refuse; short by 918 MiB** |
| Free VRAM | 5,559 MiB | 4,608 MiB | Pass |
| GPU utilization | 38% | `<50%` | Pass |

A Windows sample three seconds later read 7,345 MiB free physical and 4,250 MiB free commit; these time-separated probes vary and do not assign a cause. The model and branch app were not started. The existing other-workspace Covert stack still owned ports 4173/4777/4778/4779 (PIDs 24692/25004/2664/7400). Ports 5173/5183/4877/4878/4879/18888 were free in this one check only. The protected stack was not stopped.

Issue #38 remains unchanged at latest owner comment `6036313587` (2026-10-07T10:47:38Z). Full `git worktree list` inspection did not return after repeated waits and was interrupted; branch/status/log were read before that subcommand, and no worktree mutation occurred. No test ran under the still-refused Admission state.

## Active-listener workspace identity (read-only, 2026-10-08T16:03Z)

A GET to the already-running facade health endpoint at `127.0.0.1:4777` reported workspace `E:\pip_temp\covert-public-demo-workspace-20261007-luna`. Therefore this process tree is not the local-model demo workspace and cannot prove its live acquisition path. The listeners are PID 24692 (launcher), 2664 (TypeScript backend), 25004 (facade), and 7400 (legacy backend); they were created 2026-10-07 around 14:48 local time. I did not terminate, mutate, or otherwise operate this stack.

Older logs under this checkout's `.aide/logs` show historical legacy daemon messages for workspace `E:\covert-local-model-demo-proof-20261007` on ports 4779 and 4879. Those file timestamps/messages are not evidence of current ownership. At the 16:02Z port sample, 5173/5183/4877/4878/4879/18888 had no listeners; all ports must be rechecked before any later launch. The current resource refusal remains the reason no second stack/model was started.

## Read-only host process shortlist (2026-10-08T16:10Z)

Canonical Admission at 16:07:42Z still refused on commit: 4,171 MiB free against 5,120 MiB. A separate Windows counter sample at 16:10:10Z reported 4,033 MiB free commit (limit 30,527 MiB; committed 26,494 MiB). The samples are time-separated and no process attribution is inferred from the difference.

The largest candidates that may be considered for normal owner-directed closure were:

| Application/process group | Observed tree | Private / working set | Relevance and normal shutdown |
|---|---|---:|---|
| Microsoft PC Manager | `MSPCManager.exe` PID 12396, parent Explorer PID 10524, with six embedded WebView2 children | 424 / 229 MiB | Close from PC Manager’s own window or exit control. Potentially recoverable private memory is below the current gap by itself. |
| Phone Link / Your Phone | `PhoneExperienceHost.exe` PID 15992, child `YourPhoneAppProxyHost.exe` PID 7004 | 326 / 102 MiB | Close the Phone Link app normally. Potentially recoverable private memory is below the current gap by itself. |
| Visual Studio Installer background download | `BackgroundDownload.exe` PID 11532, launched under Task Scheduler service PID 1372 | 322 / 215 MiB | Only cancel/exit through Visual Studio Installer if no installation/update is active; current activity is unknown and interruption could affect software maintenance. |

PC Manager plus Phone Link total about 750 MiB private, below both the 949 MiB canonical shortfall and the later 1,087 MiB host-counter shortfall. Adding the installer process brings the rough private-byte sum to 1,072 MiB, still below the later gap and not equivalent to guaranteed free-commit recovery. These are options for owner selection, not termination instructions.

OneDrive Sync Service PID 4632 was 137 MiB private / 38 MiB working, but its recorded parent PID 12144 was absent, so its process group was not established; active sync status is unknown. It was excluded from the clear-candidate shortlist. Windows Terminal, protected apps, ambiguous model servers, OS services, and the other-workspace Covert stack were also excluded. No process was stopped and no command lines or credentials were read.

## Resume source reconciliation and exact profile design (2026-10-08)

### Worktree source truth

The user supplied `8e34dab7aa118bb83e7b77208c0c02f6997a2067` as the clean resume base. That commit exists and is an ancestor of the actual current branch tip, `ddd590ca791c7a3dc90182c17559293ed0069c9e`, with 16 later commits on the local-model branch. The later work includes the GGUF parser-buffer repair and successive evidence checkpoints. Preserve that lineage; no reset or checkout was performed. The active branch is `feat/local-model-demo-proof-20261007`, with no upstream configured. At resume, the only dirty files were this evidence note and `AGENT_NOTES.md`.

The first attempt to sample canonical Admission with `node --import tsx` exited before any resource probes with `ERR_MODULE_NOT_FOUND: tsx`; this checkout does not depend on `tsx`. After loading the existing `failure-arch-tests-native-ts` skill, the same read-only service call was executed through Node 26's native TypeScript stripping path. No dependency, source, or test change was made for the failed invocation.

### Fresh admission and host shortlist

At `2026-10-08T16:17:11.553Z`, the canonical `createResourceAdmission().admitLocalRuntimeStart()` returned `REFUSE_RESOURCE`:

| Probe | Observed | Required | Result |
|---|---:|---:|---|
| Free physical RAM | 7,090 MiB | 6,656 MiB | PASS |
| Free Windows commit | 4,299 MiB | 5,120 MiB | **REFUSE; 821 MiB short** |
| Free VRAM | 5,441 MiB | 4,608 MiB | PASS |
| GPU utilization | 15% | `<50%` | PASS |

A read-only candidate-app census immediately afterward measured:

| Application/process group | Observed tree | Private / working set | Normal closure / limitation |
|---|---|---:|---|
| Microsoft PC Manager | PID 12396 plus six WebView2 descendants | 387 / 231 MiB | Close from PC Manager's own UI. This estimate alone does not cover the current commit gap. |
| Phone Link / Your Phone | PID 15992 with child PID 7004 | 326 / 108 MiB | Close the app normally. This estimate alone does not cover the current commit gap. |
| Visual Studio Installer background download | PID 11532; parent Task Scheduler service PID 1372 | 339 / 191 MiB | Activity is unknown; closing/canceling may interrupt an install or update. Do not close without owner selection and installer-state confirmation. |

PC Manager plus Phone Link account for about 713 MiB private bytes, less than the 821 MiB gap. Including the installer yields about 1,052 MiB private bytes, but private-byte totals do not guarantee free-commit recovery. No one has established a safe sufficient closure. The processes were not terminated. Protected apps, OS processes, ambiguous model servers, the active terminal, and the other-workspace Covert stack remain excluded. The earlier 16:10Z list is retained above as historical evidence; process memory varies between samples.

### Acquisition workspace and source identity

`node/src/openapi.ts` sets the ModelHub destination to `path.join(workspace, 'models')`; `scripts/start.mjs` resolves that workspace from `AIDE_WORKSPACE` or defaults it to the repository root. The repository's `models/` currently contains only `BUNDLE.md`, `manifest.json`, and `PACKS.md`, no GGUF. A direct source checkout-root launch would place a large downloaded model in the Git checkout. The real run must set a fresh, isolated `AIDE_WORKSPACE` outside this repository and verify its path and free disk space before launch.

The already documented candidate is `LiquidAI/LFM2.5-2.6B-GGUF`, immutable revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`, file `LFM2.5-2.6B-Q4_K_M.gguf`, expected size `1,674,455,040` bytes, and expected LFS/SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`. The same-sized file is present in the separate existing model collection at `E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf`; this turn did not rehash it. The live ModelHub inspect response in the isolated product session must independently return the same repo, immutable revision, file, size, LFS hash, and custom license before an exact approved download can begin. The prior license record is `lfm1.0` / LFM Open License v1.0, not Apache-2.0; this is local execution evidence, not redistribution clearance.

### Canonical runtime-profile design

The existing BrokerModelRuntime is the profile owner. Its bound Unsloth profile accepts only `samplers.temperature`, `runtime.context_tokens`, and `runtime.max_tokens`; it requires all three values and binds the sidecar to artifact SHA-256, runtime id, and observed runtime version. The reference profile for the exact pinned artifact is:

| Setting | Planned value | Evidence limit |
|---|---:|---|
| Runtime | `UNSLOTH`, expected version `2026.9.11` | Confirm the live installed version and ownership before profile save/start; version mismatch refuses. |
| Sampler temperature | `0` | Existing exact-artifact profile value; no model-role qualification is implied. |
| Context request | `2,048` tokens | Prior request profile only; effective served context remains UNKNOWN. Do not substitute the 32,768 catalog value. |
| Maximum output | `512` tokens | Bounded request limit, not measured performance. |
| Chat template | Embedded GGUF `tokenizer.chat_template`; `chat_template_override: null` | Actual downloaded GGUF metadata must be parsed; retain model-specific template source and do not add generic stops. |
| Stop behavior | UNKNOWN | No explicit Covert stop list or live token-level stop proof. |
| Backend/device details | Prior Windows/Vulkan/GTX 1060 passport is the reference scope | Verify current runtime/backend/device observations; requested Vulkan placement is not proof of actual offload. |

The profile must be saved through `/api/models/profile` after registration so the canonical sidecar is bound to the acquired file and actual runtime version. Registration is availability only. The Model start route and the Broker manager each perform canonical Resource Admission; both must pass. Neither this profile plan nor the older Unsloth Passport permits bypassing the current 6,656 MiB physical / 5,120 MiB commit / 4,608 MiB VRAM / `<50%` GPU floors.

A final read-only readback of the existing sidecar at `E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf.profile.json` confirmed schema version 1, binding SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`, runtime `UNSLOTH` version `2026.9.11`, custom preset, temperature `0`, context `2048`, and max output `512`. The GGUF was not rehashed or loaded. This sidecar is outside the fresh acquisition workspace and cannot register, start, or qualify a newly downloaded copy.

### Prepared proof sequence

After a fresh passing Admission and isolated-stack preflight:

1. In Model Access, search Hugging Face and inspect the chosen exact repo; retain the actual returned metadata and Authority receipts.
2. Approve the exact download body, pinning repo, filename, quantization label, revision, LFS SHA-256, and exact size. Wait for the canonical service's byte, hash, and GGUF validation; independently read back the manifest and file hash.
3. Register the downloaded file through Model Manager, record the returned model id, and save the digest/runtime/version-bound profile above.
4. Recheck current resources; approve canonical `/api/models/start`; require exact-model health and a real local response. If current thresholds close, stop and preserve that refusal.
5. Only after the first real inference, capture load time, request-to-first-delta TTFT, and simultaneous physical RAM / commit / VRAM / GPU samples. Record native prompt/decode tok/s only if the serving backend reports phase timings and token counts; otherwise retain `UNKNOWN` rather than deriving throughput from wall time.
6. If resources remain safe, exercise cancellation, stop, restart, exact identity, and a second generation; verify owned child/session cleanup.

No live ModelHub request, app start, download, model start, inference, or test ran in this checkpoint. Existing route coverage under `tests/arch/modelhub-routes.test.ts` uses a fake Hugging Face response; it cannot be cited as live acquisition. Preserve the known suite red: pairing the test Authority fixture at `/api/authority/pair` exceeded its unchanged 5,000 ms deadline (8,708 ms), so the 12 route assertions did not run. Cause remains UNKNOWN; no retries, deadline changes, or assertion changes were made. The only completed runtime verification in this section is the canonical resource sample, which refused the start.

## Subsequent resource/pagefile refresh (2026-10-08)

At `2026-10-08T16:24:03.660Z`, canonical `createResourceAdmission().admitLocalRuntimeStart()` again returned `REFUSE_RESOURCE`: free physical RAM `7,248/6,656 MiB`, free commit `4,593/5,120 MiB` (**527 MiB short**), free VRAM `5,427/4,608 MiB`, GPU utilization `14%/<50%`. No application or model was started.

A separate Windows `Get-Counter` sample at `16:25:16.161Z` reported commit limit `30,527 MiB`, committed `25,784 MiB`, and free commit `4,742 MiB`. This is 149 MiB above the canonical sample; both values remain below the required floor. Keep the canonical Admission result as the start decision and retain the variance as evidence.

Read-only Windows pagefile state was `AutomaticManagedPagefile=False`, with `C:\pagefile.sys` allocated `14,220 MiB`, current usage `14,208 MiB`, and peak usage `14,220 MiB`. The pagefile is nearly fully used, but these measurements alone do not prove an objectively broken/undersized configuration, a Covert-side commit leak, or that changing the pagefile would resolve the underlying pressure. No OS/pagefile setting was changed.

One fresh selected-app census found PC Manager PID 12396 plus six WebView2 descendants at `402 MiB` private / `241 MiB` working, and Phone Link PID 15992 plus child PID 7004 at `327 / 113 MiB`. Their private bytes sum to `729 MiB`, greater than the canonical `527 MiB` gap, but this is only a rough potential recovery figure; private bytes do not guarantee free-commit recovery. The earlier Visual Studio Installer BackgroundDownload process was absent from this selected-name sample; installation state remains unknown. No candidate was stopped. Owner-controlled normal closure of these apps is the only currently identified reversible user-app option; a new canonical Admission sample is required afterward.

## Pinned Hugging Face source re-check and current hold (2026-10-08)

At approximately `2026-10-08T16:37Z`, a read-only request to Hugging Face's official model API for the exact repository revision `e7caca5d835a3901a8e0d63e94009429bafafdfc` returned that exact resolved SHA, `cardData.license=other`, `license_name=lfm1.0`, `license_link=LICENSE`, and the selected `LFM2.5-2.6B-Q4_K_M.gguf` with size `1,674,455,040` bytes and `lfs.sha256=02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`. The API response had no `lfs.oid`; the canonical parser's `lfs.sha256` handling is therefore required for this observed upstream shape. The exact-revision README remains available and identifies `lfm1.0`; its llama.cpp example uses temperature `0.1`, top-k `50`, and repeat penalty `1.1`. These are external source observations only. They do not prove Covert Model Access search/inspect/download, legal clearance, or a changed runtime profile; the profile remains bound to the previously accepted exact-artifact Unsloth evidence.

The source implementation was re-read without running tests. `GET /api/modelhub/search` and `/api/modelhub/files` are `capability.external` operations, and the download approval binds repository, file, quantization label, immutable revision, expected SHA-256, and exact size. The service resolves the download URL using the pinned revision, then verifies received byte count, SHA-256, and GGUF structure before publication. Registration and profile saving remain separate operations. `POST /api/models/start` and the Broker both enforce canonical Resource Admission; no direct runtime path is introduced. These are source-contract observations, not a live product-flow result.

At `2026-10-08T16:35:36.100Z`, the canonical `createResourceAdmission().admitLocalRuntimeStart()` returned `REFUSE_RESOURCE`: free physical RAM `7,095/6,656 MiB`, free commit `4,653/5,120 MiB` (**467 MiB short**), free VRAM `5,458/4,608 MiB`, GPU utilization `14%/<50%`, load average unknown. No model or app was started. A read-only disk sample at `16:38:28Z` showed `E:` free `75,982,409,728` bytes and `C:` free `224,018,432` bytes. The model download destination must remain on `E:` in an isolated `AIDE_WORKSPACE`; avoid staging model data on `C:`. This does not change the Admission refusal or authorize a product test under the existing hold.

The separate model collection artifact still exists at `E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf` with the previously recorded expected size. It was not rehashed this turn and is not the acquired artifact for this lane. No Covert Model Access request, download, registration, profile save, model start, or inference was performed. The next runtime prerequisite is still a fresh canonical `START` decision with at least `6,656 MiB` free physical RAM, `5,120 MiB` free commit, `4,608 MiB` free VRAM, and GPU utilization below `50%`; continue source/test preparation while it refuses.

## Refreshed owner-selectable app census and admission (2026-10-08)

At approximately `16:40Z`, a read-only process-tree census found two clearly identified, normally closable user applications:

| Application | Current process tree | Private bytes | Working set | Normal shutdown |
|---|---|---:|---:|---|
| Phone Link | `PhoneExperienceHost.exe` PID `15992` → `YourPhoneAppProxyHost.exe` PID `7004` | `328.2 MiB` | `140.4 MiB` | Close Phone Link through its normal app UI. |
| Microsoft PC Manager | `MSPCManager.exe` PID `12396` → six `msedgewebview2.exe` descendants (PIDs `19448`, `22136`, `3008`, `21876`, `21436`, `23512`) | `421.0 MiB` | `185.1 MiB` | Close PC Manager through its own UI. |

Combined private memory is about `749.2 MiB`; current free commit is `1,182 MiB` below the Admission floor. That difference is only a screening estimate: private bytes do not predict how much commit normal app closure would release. At this `16:40Z` census, neither application had yet been closed. No protected, ambiguous, model-server, OS, or unrelated process was inspected for termination.

At `2026-10-08T16:40:30.949Z`, canonical `createResourceAdmission().admitLocalRuntimeStart()` again returned `REFUSE_RESOURCE`: free physical RAM `7,468/6,656 MiB` (pass), free commit `3,938/5,120 MiB` (**1,182 MiB short**), free VRAM `5,384/4,608 MiB` (pass), GPU utilization `3%/<50%` (pass), and load average unknown. Compared with `16:35:36.100Z`, free physical RAM rose `373 MiB` while free commit fell `715 MiB`; the cause of that divergence is **UNKNOWN** and is not attributed to either candidate app or Covert. No app, product test, download, or model runtime was started.

## Owner-authorized normal-close attempt and post-action gate (2026-10-08)

After the owner authorized normal closure of non-protected apps while keeping Edge, OpenCode, and Codex open, I verified `MSPCManager.exe` PID `12396` and its six WebView descendants by PID/name/parent tree, with a nonzero main-window handle. Canonical Admission immediately before the close request at `2026-10-08T16:43:58.483Z` returned `REFUSE_RESOURCE`: physical RAM `7,176/6,656 MiB`, free commit `4,105/5,120 MiB` (**1,015 MiB short**), free VRAM `5,330/4,608 MiB`, GPU utilization `24%/<50%`.

The normal `CloseMainWindow()` request returned `true`. The first 10-second observation still found the PC Manager root and all six WebView processes alive; a later read before the post-action admission found the root alone, with no main window, and all six recorded descendants absent. The root remained at about `101 MiB` private memory. No force-termination was used. At `2026-10-08T16:44:36.353Z`, canonical Admission remained `REFUSE_RESOURCE`: physical RAM `6,901/6,656 MiB`, free commit `4,063/5,120 MiB` (**1,057 MiB short**), free VRAM `5,386/4,608 MiB`, GPU utilization `14%/<50%`. The observed values do not show commit recovery from the close request; causal effect is not established.

The later Phone Link process read found `PhoneExperienceHost.exe` PID `15992` and child `YourPhoneAppProxyHost.exe` PID `7004`, about `324.2 MiB` combined private / `153.7 MiB` working set, but both had `MainWindowHandle=0`. No normal window-close path was available to this session, so neither was stopped. The residual hidden PC Manager root was about `101 MiB` private in the preceding read; together those two remaining process groups total roughly `425 MiB` private across nearby samples, well below the current `1,057 MiB` commit gap. This is only a screening estimate, not predicted commit recovery. Neither has a visible normal close window now. No additional visible, non-protected user app above `100 MiB` private was observed in the restricted census. Ambiguous model servers, Edge, OpenCode, Codex, OS components, and the other-workspace Covert stack remain untouched. No product test, download, model start, or inference ran.

## Owner-authorized Phone Link stop and final resource gate (2026-10-08)

The owner then clarified that other apps may be closed while Edge, OpenCode, and Codex stay open. At `16:53Z`, canonical Admission returned `REFUSE_RESOURCE`: free physical RAM `7,250/6,656 MiB`, free commit `4,623/5,120 MiB` (**497 MiB short**), free VRAM `5,461/4,608 MiB`, and GPU utilization `4%/<50%`.

I verified Phone Link as the current user's `PhoneExperienceHost.exe` PID `15992` with child `YourPhoneAppProxyHost.exe` PID `7004`; their executable paths were within the Microsoft Your Phone package. The parent PID `1624` was the SYSTEM `svchost.exe -k DcomLaunch` and was not touched. Because both app processes had no main window, I stopped only PIDs `7004` and `15992` under the owner's app-closure instruction. A subsequent process census found neither PID nor the earlier PC Manager PID `12396`; no protected app, OS service, other Covert runtime, or model server was stopped.

The first canonical Admission read following the Phone Link stop request, at `2026-10-08T16:54:35.904Z` while process exit was still being confirmed, returned `REFUSE_RESOURCE` because free Windows commit was unavailable (`free_commit_mb: null`); the other observed values were physical RAM `7,327 MiB`, VRAM `5,304 MiB`, and GPU utilization `6%`. **Cause of this single probe failure is UNKNOWN.** Source inspection shows the commit probe runs Windows PowerShell `Get-Counter` for `\\Memory\\Commit Limit` and `\\Memory\\Committed Bytes` with a 5,000 ms timeout; its callback collapses any process error or invalid output to `null`, so this execution retained no underlying error detail. This explains the refusal behavior, not why the probe failed once.

At `2026-10-08T16:55:32.957Z`, a later canonical Admission sample measured commit again and still returned `REFUSE_RESOURCE`: free physical RAM `7,342/6,656 MiB`, free commit `5,047/5,120 MiB` (**73 MiB short**), free VRAM `5,446/4,608 MiB`, GPU utilization `3%/<50%`. Free commit was `424 MiB` higher than the last numeric pre-stop sample (`4,623 MiB`), but the intervening unavailable sample and host variation mean the app-stop effect is **not isolated or proven causal**. No further non-protected user app with a safe, sufficient closure path was identified: the remaining large visible processes were Windows Input Experience (`TextInputHost.exe`, OS component), Explorer (Windows shell), and Windows Terminal. The Terminal process tree contains OpenCode and Codex sessions, so it was left open; the NVIDIA overlay was about `23 MiB` private and could not safely resolve a `73 MiB` gap by itself. No additional OS, protected application, or ambiguous process was touched.

The current gate remains `REFUSE_RESOURCE`; do not start Covert for the local-model proof, download/register a model, or start a runtime until a fresh canonical Admission returns `START`. No product test, model acquisition, model start, or inference ran during this resource investigation. The one null commit measurement remains a preserved regression signal with **CAUSE UNKNOWN**.

## Prepared verification ladder (read-only test inspection, 2026-10-08)

The repository's current focused commands and evidence limits are:

| Command, to run only after the current product-test hold is lifted | What it covers | What it does not prove |
|---|---|---|
| `node --test tests/unit/test-m-hub.mjs` | ModelHub service behavior with fixture fetch, including immutable revision, file size/license mapping, `lfs.sha256` metadata, hash/GGUF rejection, partial resume, and cancellation. | Live Hugging Face or route/Authority operation; actual selected revision bytes; Model Manager registration or runtime inference. |
| `node --test tests/unit/test-modelhub-containment.mjs` | ModelHub file/manifest containment, symlink/junction/hardlink refusal, cancellation cleanup, and synthetic GGUF handling with fixture fetch. | Live Hugging Face metadata, actual model bytes, LFS/SHA for the selected revision, or Model Manager runtime readiness. |
| `node --experimental-strip-types --test tests/arch/resource-admission.test.ts` | Configured floor boundary behavior, unknown commit refusal, GPU/VRAM refusal, and the generic admission route test. | Current live host admission beyond a separate fresh canonical `admitLocalRuntimeStart()` sample. |
| `node --experimental-strip-types --test tests/arch/modelhub-routes.test.ts` | Authority/egress bindings, exact approved download request handling, policy checks, and mocked download lifecycle using fake fetch and a synthesized GGUF. | Actual Hugging Face search/inspect/download or the selected immutable artifact's validation. |

The ModelHub route test's fixture starts an in-process server and calls `pairFixture` in its `before` hook. A prior run recorded the pairing operation at `8,708 ms` against the unchanged `5,000 ms` fixture deadline, before 12 route assertions ran. That first red remains open; preserve it if the focused suite is later run, diagnose the delay, and do not inflate the deadline or rerun to green without a cause.

Source/test reconciliation found that `tests/unit/test-m-hub.mjs` already has a focused positive test for Hugging Face RepoFile `lfs.sha256` metadata and a separate immutable-revision/size/license mapping test. No new hash-parser implementation or duplicate test was added. The coverage uses fixture fetch and does not prove the live selected revision through Model Access; this command has not been run in the current checkpoint.

After a fresh canonical Admission returns `START`, the live proof still has to use the isolated `AIDE_WORKSPACE` on `E:` and Covert's real Model Access path: search, inspect the immutable selected revision, approve the exact repo/file/revision/LFS-SHA/size operation, download and independently verify bytes/hash/GGUF/manifest, register through Model Manager, save the identity-bound canonical profile, recheck Admission, then start through Runtime Broker and capture exact-model health plus real inference output. Tests above are preparatory regression gates only. None were run for this checkpoint; the current `REFUSE_RESOURCE` hold remains in force.

## Commit/pagefile and off-lane process follow-up (2026-10-08)

At `2026-10-08T16:59:57.103Z`, a read-only WMI snapshot showed `16,307 MiB` total physical RAM, `6,608 MiB` free physical, `30,527 MiB` total virtual memory, and `4,703 MiB` free virtual memory. Runtime pagefile state was `C:\pagefile.sys`, allocated base `14,220 MiB`, current usage `13,554 MiB`, peak usage `14,220 MiB`; the separate per-file setting reported `InitialSize=0`, `MaximumSize=0`, while `Win32_ComputerSystem.AutomaticManagedPagefile=false`. At approximately `17:09Z`, disk reads showed `C:` free `458,641,408` bytes (~`437 MiB`) and `E:` free `77,687,717,888` bytes (~`72.4 GiB`). These are configuration/runtime observations, not proof that the pagefile alone caused the commit shortage. No pagefile, OS, or disk settings were changed.

The measurement classes are not interchangeable: Microsoft documents `Win32_PageFileSetting` as startup settings and `Win32_PageFileUsage` as runtime state, and documents the `Win32_OperatingSystem.FreeVirtualMemory` value separately from system-wide commit headroom. The Covert Admission path continues to use `Memory\\Commit Limit - Memory\\Committed Bytes`; no WMI-value fallback was added. References: [Win32_PageFileSetting](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-pagefilesetting), [Win32_PageFileUsage](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-pagefileusage), [Win32_ComputerSystem](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-computersystem), [Win32_OperatingSystem](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-operatingsystem), and [MEMORYSTATUSEX](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/ns-sysinfoapi-memorystatusex). Microsoft identifies system-wide available commit as `CommitLimit - CommitTotal`; `ullAvailPageFile` can be process-specific and smaller.

A top-private-bytes read identified one clear non-Covert user-owned process group: Python PID `19596`, executable `E:\Python310\python.exe`, running Nuitka `__main__.py` from `E:\felon_workspace\venv_py310`, owner `NEURO-MIRROR\Grey_`, private bytes `1,781.5 MiB`, working set `1.7 MiB`, CPU `992.4 s`, start time `2026-10-08 09:02`. Its immediate parent PID `22976` was the project's virtual-environment Python launcher (`0.7 MiB` private). Under the owner's authorization to close non-protected apps, I stopped PID `19596`; a later exact process query found PIDs `19596` and `22976` absent. This was an off-lane Python/Nuitka process, not a Covert process. The direct private-byte total is a commit-consumer clue, not an exact prediction of commit recovery.

After that stop, a direct diagnostic `Get-Counter` call returned a `31,541,141,504`-byte commit limit, `24,728,993,792` committed bytes, and `6,496 MiB` free commit in `2,064 ms`. The same helper's child-process form had separately timed out at its existing `5,000 ms` limit with no stderr; the underlying timeout cause is still **UNKNOWN**. Canonical Admission at `2026-10-08T17:05:55.120Z` returned `START` with physical `6,661/6,656 MiB` (only `5 MiB` margin), commit `6,248/5,120 MiB`, VRAM `5,483/4,608 MiB`, GPU `17%/<50%`. This is consistent with resource recovery after the Python process stopped, but the precise causal contribution is not isolated.

The next canonical sample, at `2026-10-08T17:09:59.241Z`, returned `REFUSE_RESOURCE`: physical RAM `6,428/6,656 MiB` (**228 MiB short**), free commit `6,354/5,120 MiB`, VRAM `5,490/4,608 MiB`, GPU `6%/<50%`. Thus the commit floor passed while the physical floor closed again. No Covert app/model server was started. The workstation now has demonstrated intermittent floor closure after a brief `START`; the safest next runtime opportunity requires a new canonical `START` immediately before launch. Node listeners were present on `4173` (PID `24692`), `4777` (PID `25004`), and `4778` (PID `2664`); their worktree ownership was not resolved, so they were left untouched. Candidate ports `4973`, `4977`, `4978`, and `4979` were free during preflight. The old runtime workspace and its log files were preserved; a separate run workspace path was only checked for nonexistence and was not created.

A follow-up process census found `BackgroundDownload.exe` PID `28148`, owned by the current user and located under the Microsoft Visual Studio Installer ServiceHub tree, with parent PID `1372`, no main window, private bytes `205.9 MiB`, and working set `26.9 MiB`. Its current installer/download activity is **UNKNOWN**. It was not stopped because no normal UI close path was available and termination could interrupt installer work; its observed resident set is far below the current `228 MiB` physical-RAM deficit. The remaining larger processes are Edge/OpenCode/Codex/ChatGPT sessions or Windows components and remain protected.

The preserved runtime workspace `E:\covert-model-demo-runtime-20261008` contains only its prior `.aide/logs` and `plugins` entries. Its `legacy-out.log` says the daemon listened on `4879` for that workspace; `arch-out.log`, `arch-err.log`, and `legacy-err.log` are empty. These logs do not establish why the earlier TypeScript backend readiness probe failed. The isolated run workspace `E:\covert-local-model-proof-runtime-20261008` was confirmed absent and was not created. No current product startup was attempted while Admission refused.

## Fresh resource refusal and protected process ownership (2026-10-08)

At `2026-10-08T17:15:36.886Z`, canonical Admission returned `REFUSE_RESOURCE`: free physical RAM `5,937/6,656 MiB` (**719 MiB short**), free commit unavailable (`null`), VRAM `5,448/4,608 MiB`, GPU utilization `13%/<50%`. A separate WMI read at `17:15:48.332Z` measured free physical `5,816 MiB`, free virtual `5,407 MiB`, total virtual `30,080 MiB`; runtime pagefile allocation was `13,773 MiB` with `11,721 MiB` current use and `14,220 MiB` peak. `C:` had `487,841,792` bytes free and `E:` had `77,678,686,208` bytes free. These WMI values do not replace canonical Admission's missing commit reading.

The top resident process groups were Edge, OpenCode, the Codex desktop package, and Windows components. Process-path inspection identified the `ChatGPT.exe` processes as part of package `OpenAI.Codex_26.930.7945.0_x64__2p2nqsd0c76g0`; they remain protected as Codex. Edge, OpenCode, Codex, and OS components were not closed. The remaining Visual Studio Installer `BackgroundDownload.exe` PID `28148` was still around `203 MiB` private / `27 MiB` working set, with no window and activity **UNKNOWN**; it remains untouched. No safe non-protected user application with enough observed resident memory to clear the current physical deficit was identified. No Covert startup, product test, acquisition, or local model start occurred.

## ModelHub completion-order source reconciliation (2026-10-08)

The suspected `done`-before-manifest race was checked against the current source at HEAD `ce61c29b1e9cd0ecc3fbdc8721bb2c790ff830dc`. In `node/src/services/modelhub.mjs`, the service checks the downloaded file size (`partialStat.size` against `expected_size_bytes`), compares the observed SHA-256 against the approved digest, parses the GGUF, verifies the contained destination, renames the artifact, awaits `persistManifest()`, then sets `job.status = 'done'` and emits the `done` event. `persistManifest()` atomically publishes the sidecar before it returns. `GET /api/modelhub/downloads` projects that service-owned status, and the Model Access UI enables registration only when it reads `status === 'done'`.

The canonical Model Manager registration path independently reopens the artifact and sidecar, checks containment and regular-file identity, validates manifest size and GGUF architecture, rehashes the artifact (or uses the existing metadata-bound hash cache), and requires both the sidecar SHA and Hugging Face expected LFS digest to match the actual bytes. It also rejects an explicitly supplied repository that conflicts with the sidecar. This source trace disproves the suspected completion-order race; it is not live ModelHub or runtime proof. The route test's former comment incorrectly said `done` preceded manifest publication; that comment was corrected without changing the test behavior.

At `2026-10-08T17:21:38.326Z`, a fresh read-only call to the canonical `createResourceAdmission().admitLocalRuntimeStart()` returned `REFUSE_RESOURCE`: free physical RAM `5,261/6,656 MiB` (**1,395 MiB short**), free commit `4,818/5,120 MiB` (**302 MiB short**), free VRAM `5,447/4,608 MiB`, GPU utilization `4%/<50%`, and load average unknown. No Covert app, product test, ModelHub request, download, model start, or inference was run. The resource gate remains the controlling blocker. The prepared test ladder and earlier pairing-timeout red are unchanged and remain unrun/unresolved.

## Follow-up admission and process ownership census (2026-10-08)

At `2026-10-08T17:24:54.595Z`, a fresh serial call to canonical `createResourceAdmission().admitLocalRuntimeStart()` again returned `REFUSE_RESOURCE`: free physical RAM `4,616/6,656 MiB` (**2,040 MiB short**), free commit `4,339/5,120 MiB` (**781 MiB short**), VRAM `5,475/4,608 MiB`, GPU utilization `22%/<50%`, and load average unknown. Relative to the `17:21:38.326Z` sample, physical headroom fell `645 MiB` and free commit fell `479 MiB`; the cause remains **UNKNOWN**.

A read-only process census immediately afterward found the largest protected trees still belonged to OpenCode, Edge, and the Codex desktop package. A Windows `TextInputHost.exe` process was about `710.5 MiB` private / `325.0 MiB` working set and was left untouched as an OS component. The active AES LedgerPro/Nuitka packaging tree (PIDs `27560`, `14980`, `21684`, `21940`, `26228`) totaled about `407.9 MiB` private / `439.8 MiB` working set while building `Ledger_Server.exe`; it is active user work and was not stopped. An active Codex-owned `npm ci` tree (PIDs `24384`, `26860` plus its console host) totaled about `414.3 MiB` private / `483.3 MiB` working set; it was not stopped because it is an in-progress tool-managed install. These are observed consumers, not proven causes of the resource change. Neither tree alone nor together can recover the `2,040 MiB` physical gap based on their measured working sets, and interrupting them risks unrelated work. No safe, clearly owned, normally closable application with sufficient observed headroom was identified. No process was terminated.

Source-only compatibility review confirmed `lfm2` is accepted by both the ModelHub GGUF verifier and Model Manager registration architecture allowlist. This does not prove the pinned bytes were acquired or executed by Covert. Issue #38 was checked through the authenticated GitHub connector; its latest accessible comment was the UI0 R6 browser checkpoint, with no new instruction specific to this local-model lane. No issue comment was posted because this branch has no upstream and no pushed checkpoint. No Covert startup, product test, ModelHub request/download, model start, or inference occurred; the resource refusal remains in force.

## Pinned model card and license research (2026-10-08)

Read Liquid AI's `README.md` at the pinned revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`. The revision labels the repository `license: other`, `license_name: lfm1.0`, and points to `LICENSE`. Its GGUF instructions explicitly show `llama.cpp` commands and a generation example using temperature `0.1`, top-k `50`, and repeat penalty `1.1`; the page separately lists Unsloth Desktop but does not document Covert's Unsloth V1 adapter. Preserve the existing exact-artifact Unsloth V1 qualification and profile values; the llama.cpp sample is not evidence that those settings should be transplanted to Unsloth. Any new runtime/version or profile still requires its own exact identity and qualification evidence.

Liquid AI's official LFM Open License v1.0 page describes commercial use rights as conditional on the user's legal entity remaining below the USD $10 million annual-revenue threshold; commercial use at or above that threshold is outside the free license, and redistribution requires providing the license and retaining applicable notices. The model's metadata and this upstream license text are not legal clearance for Covert. The applicable legal entity/revenue condition and any distribution plan remain **UNKNOWN**; do not bundle or redistribute this model until the owner resolves that applicability or obtains the required license. This does not block local qualification testing once canonical Admission allows it.

## Resource and active-build recheck (2026-10-08)

At `2026-10-08T17:34:26.957Z`, canonical `createResourceAdmission().admitLocalRuntimeStart()` returned `REFUSE_RESOURCE`: free physical RAM `4,884/6,656 MiB` (**1,772 MiB short**), free commit `4,115/5,120 MiB` (**1,005 MiB short**), VRAM `5,458/4,608 MiB`, GPU utilization `26%/<50%`, and load average unknown. The current process census found the active Ledger Server Nuitka build's main Python worker (PID `26228`, parent `21940`, start time `12:15:24 PM`) at `1,053.9 MiB` private / `1,057.0 MiB` working set. It is an active user build, not a Covert runtime.

After a 20-second wait, a strict timestamp-equality query returned an ambiguous “absent or identity changed” result. A separate exact-PID query then confirmed PID `26228` was still the same Nuitka process (same parent, start time, executable, and command classification), at `980.4 MiB` private / `986.7 MiB` working set. The follow-up canonical admission at `2026-10-08T17:35:48.402Z` remained `REFUSE_RESOURCE`: free physical RAM `4,750/6,656 MiB` (**1,906 MiB short**), free commit `4,108/5,120 MiB` (**1,012 MiB short**), VRAM `5,433/4,608 MiB`, GPU utilization `20%/<50%`. The worker's memory fluctuated, but the machine did not approach either floor; causal attribution remains **UNKNOWN**. The active build was not interrupted.

Issue #38 was checked again through the authenticated GitHub connector; its latest accessible comment remains `6036313587` (UI0 R6 read-only browser checkpoint), with no new instruction for this lane. No safe, normally closable, clearly owned user application sufficient to recover the remaining physical headroom was identified; Edge, OpenCode, Codex, the OS, and unrelated active work remain untouched. No Covert startup, product test, ModelHub request/download, or model runtime was started.

Sources: [pinned LiquidAI model card](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/e7caca5d835a3901a8e0d63e94009429bafafdfc/README.md), [Liquid AI LFM Open License v1.0](https://www.liquid.ai/lfm-license). This is external source research only, not Covert's live ModelHub inspect/download proof.

## Embedded GGUF template and behavior follow-up (2026-10-08)

At `2026-10-08T17:39Z`, I ran this read-only command against the already-observed external artifact:

```powershell
node --experimental-strip-types --input-type=module -e "import { probeGguf } from './node/src/services/gguf.ts'; const p = await probeGguf('E:/models/house-model/lfm25_gguf/LFM2.5-2.6B-Q4_K_M.gguf'); console.log(JSON.stringify(p, null, 2));"
```

It exited `0`. `probeGguf()` reads the bounded GGUF metadata header (64 KiB chunks, 16 MiB maximum header position); it does not load model weights or start inference. The prior exact-artifact observation in this record hashed this same external path to the selected LFS SHA-256 and exact byte size. It remains outside this worktree, was not copied or registered, and is not evidence of Covert acquisition.

The parser returned GGUF v3, `lfm2`, `2.7B` size label, context metadata `131072`, 30 blocks, embedding length `2048`, 32 attention heads, BOS ID `124894`, EOS ID `124900`, no `tokenizer.ggml.add_bos_token` value, and a `5,443`-character embedded `tokenizer.chat_template`. Direct inspection of that embedded template showed:

- It begins with `bos_token`; the upstream template itself therefore emits BOS. Whether the selected Unsloth adapter independently adds another BOS remains **UNKNOWN** until the prepared-input/runtime behavior is captured. Do not add a template override based on assumption.
- A system message is rendered only when supplied as the first message. The embedded template does not inject the model-card example's default system text.
- User and assistant messages use `<|im_start|>{role}` and end with `<|im_end|>`. With `add_generation_prompt`, it opens the assistant turn with `<think>`.
- Reasoning content is handled through `thinking`/`reasoning` fields and `preserve_thinking`; this is formatting behavior, not proof Covert preserves or interprets those fields.
- The template serializes tool declarations into a system prompt and formats assistant tool calls as Pythonic calls inside `<|tool_call_start|>...<|tool_call_end|>`. This does not qualify Covert tool-call parsing, authorization, or execution.

The pinned GGUF README documents the llama.cpp sample (`temperature 0.1`, `top-k 50`, repeat penalty `1.1`). Liquid AI's base-model README at its own initial revision `dca1825886789bd40b94368f53b1d9ada4c94598` describes the same ChatML-like pattern and tool syntax. However, the pinned GGUF metadata identifies only the base repository name, not that base-model revision. Use those pages as upstream corroboration; the embedded template from the byte-matched GGUF is the artifact-specific template evidence.

The base model README also cautions that this model is not recommended for agentic coding and knowledge-heavy tasks. This candidate can still prove a local inference path, but no coding-worker capability claim follows. Keep the existing exact-artifact Unsloth V1 profile (`temperature 0`, requested context `2048`, output limit `512`) unchanged; the llama.cpp example does not authorize transferring sampling values across adapters or runtimes.

Remaining template/profile unknowns: the exact tokenizer-file revision tied to the GGUF is not identified in GGUF metadata; the GGUF reports EOS ID `124900`, while the base model's current `tokenizer_config.json` maps EOS to `<|im_end|>` only as current-main corroboration; the server's actual stop-token handling, duplicate-BOS behavior, tool call generation/parsing, and effective context remain unproven. Resolve these through exact bound-source/profile evidence and the canonical runtime path when resource Admission permits. No model start, runtime test, inference, acquisition, registration, or product test ran for this research step.

Sources: [pinned GGUF README](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/e7caca5d835a3901a8e0d63e94009429bafafdfc/README.md), [base model README at its initial revision](https://huggingface.co/LiquidAI/LFM2.5-2.6B/blob/dca1825886789bd40b94368f53b1d9ada4c94598/README.md), [base tokenizer configuration at current main](https://huggingface.co/LiquidAI/LFM2.5-2.6B/blob/main/tokenizer_config.json).

### Canonical Unsloth template/profile source cross-check (static only)

At source HEAD `ce9040446f9ca554d650f8741c223f14471ee2dd`, `UnslothRuntimeAdapter.load()` sends `chat_template_override: null` to `/api/inference/load`; its comment says this clears stale same-model `--chat-template-file` state and delegates template selection to the model/runtime defaults. `BrokerModelRuntime.boundRuntimeProfile()` requires the saved sidecar to match the exact artifact SHA, runtime ID `UNSLOTH`, and qualified runtime version, and accepts only the profile's supported `temperature`, `context_tokens`, and `max_tokens` fields. The adapter's `getEffectiveContext()` returns `null`, and `refreshServedContext()` does not claim a served window.

`tests/arch/runtime-broker.test.ts` contains a fixture assertion that the load payload's override is null, but that test was not run for this note and is not live Unsloth proof. Static source therefore supports the intended use of the GGUF/runtime default and the exact-profile binding; it does not prove which template Unsloth actually applied, exact tokenized request bytes, effective served context, or live stop handling. No runtime profile was changed.

## Refusal refresh and focused ModelHub service regression (2026-10-08)

At `2026-10-08T17:44:13.541Z`, a fresh direct call to canonical `createResourceAdmission().admitLocalRuntimeStart()` returned `REFUSE_RESOURCE`: free physical RAM `4,853/6,656 MiB` (**1,803 MiB short**), free Windows commit `4,308/5,120 MiB` (**812 MiB short**), free VRAM `5,482/4,608 MiB`, GPU utilization `14%/<50%`, load average unknown. The admission implementation is read-only and does not start, stop, or mutate processes. No Covert stack or model runtime was started.

I ran `node --test tests/unit/test-m-hub.mjs` at approximately `17:44Z`. Result: **13 passed, 0 failed, 0 skipped, 0 cancelled; exit 0; 1,531.5 ms**. The tests use an injectable fetcher and local fixture servers. They cover immutable metadata mapping including `lfs.sha256`, digest/GGUF refusal, fixture download/resume, timeout, cancellation cleanup, and import behavior. This is service-level regression evidence only: it does not prove live Hugging Face search/inspection/download, Covert UI/Authority operation, the selected artifact's registration, runtime start, or inference. No external request or model execution occurred.

The next actual acquisition/execution attempt remains gated on a fresh canonical Admission returning `START`; no resource floor, timeout, assertion, or authority path was changed.
