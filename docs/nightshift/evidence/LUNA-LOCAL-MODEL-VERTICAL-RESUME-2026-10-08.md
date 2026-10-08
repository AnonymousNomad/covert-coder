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

Checkpoint the bounded LFS metadata mapping repair, then continue with live Covert search/inspection/download in a process whose `AIDE_WORKSPACE` is this branch root. Re-measure with canonical Resource Admission before any runtime start. Preserve every refusal; do not start or infer while either physical RAM or commit remains below its floor.
