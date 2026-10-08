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

The current mutable Hugging Face model page labels the repository license `lfm1.0`, reports the GGUF architecture as `lfm2`, and lists the Q4_K_M artifact at about 1.67 GB. Its llama.cpp example uses temperature `0.1`, top-k `50`, and repeat penalty `1.1`. This page is not the pinned revision record and does not override the existing Covert-tested profile. The pinned license/revision/file metadata must be reconfirmed through Covert inspection; the downloaded GGUF template and stop behavior must be inspected before runtime claims. No configuration was inferred from the filename or copied from that mutable page.

## Verification on this branch

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
| Product UI live search and inspect on this branch/workspace | OPEN |
| Immutable Hub revision + exact LFS SHA/size observed through Covert | OPEN |
| Real artifact download + bytes/SHA-256/GGUF validation | OPEN |
| Canonical Model Manager registration in this workspace | OPEN |
| Resource Admission | **REFUSED** at the sample above |
| Runtime ownership/version/profile check | OPEN |
| Real local inference output | OPEN |
| Stop/restart and post-run cleanup | OPEN |
| Baseline load/TTFT/prompt/decode/RAM/VRAM metrics | DEFERRED until a real inference passes and resources permit |
| Exact-SHA CI | OPEN for the parser repair commit |

## Next action

The LFS metadata mapping repair and external artifact identity/profile reconciliation are committed at this checkpoint. With free physical memory at 2,039 MiB and free commit at 782 MiB, do not launch another app stack now. When headroom permits a monitored app-only launch, use a fresh dedicated workspace (not the source checkout or existing user model collection), retain the default startup deadline, and capture TypeScript process state during readiness. Then complete real HF search → immutable-revision inspection → exact-size/LFS/SHA download and GGUF validation → Authority-governed Model Manager registration. Take a fresh canonical Resource Admission sample before runtime start. Preserve every refusal; do not start or infer while any required floor is below threshold.
