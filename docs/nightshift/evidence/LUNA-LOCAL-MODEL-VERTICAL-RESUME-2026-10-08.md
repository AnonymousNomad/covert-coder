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
