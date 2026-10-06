# Desktop Dogfood checkpoint — 2026-10-06

## Status

**PARTIAL — Windows NSIS build and installed package were exercised; terminal close behavior in the Codex packaged host and the full operator journey remain open.** Earlier sections preserve checkpoint-time evidence. The latest ordered build and installed-runtime results are in “Full package build and installed exercise” below.

## Candidate identity

- Integration worktree: `E:\covert-desktop-dogfood-20261006`
- Branch: `codex/desktop-dogfood-integrated-20261006`
- HEAD: `12b999d329b59fd7dd480504ce84670b0de521f5`
- Worktree: dirty with six modified files and two untracked files; base SHA is not a commit containing those changes.
- Modified paths: `desktop/prepare.mjs`, `desktop/src/main.rs`, `desktop/stack-launcher.mjs`, `desktop/tauri.conf.json`, `desktop/verify-prepare.mjs`, `tests/unit/test-desktop-lifecycle-contract.mjs`.
- Untracked paths: `desktop/STORAGE.md`, `docs/evidence/desktop-dogfood-2026-10-06.md`.
- Tracked diff stat at checkpoint: **6 files changed, 236 insertions, 63 deletions**. No commit was created.
- The checkout initially had a `locked: initializing` worktree marker. Its index was present, Git status worked, and no Git process owned the checkout. The marker was removed with `git worktree unlock`; `git worktree list` then showed the expected path, HEAD, and branch without a lock.

## Changes in this candidate

- Set the Tauri bundle target to NSIS.
- Removed optional model-weight and llama.cpp runtime staging from desktop preparation. The verifier recursively rejects model weights and model runtime binaries under immutable resources.
- Added `node-pty` to the staged runtime package set and required the platform native prebuild plus Windows ConPTY/WinPTY support files in the verifier.
- Route the backend workspace to Tauri's per-user local application data directory. On Windows with E: present, model storage defaults to `E:\CovertData\CovertCoder\models`; runtime files stay external to application resources. Absolute path overrides remain available.
- Added `desktop/STORAGE.md` documenting those paths and the current single-workspace limitation.
- Added a focused source contract test for the package target and storage/resource boundaries.

The backend still exposes one `AIDE_WORKSPACE` root for workspace files and `.aide` state. This candidate does not register or mount an existing project at its real path and does not fully separate project files from Covert state.

## Verification performed

- `node --check desktop/prepare.mjs` — PASS.
- `node --check desktop/verify-prepare.mjs` — PASS.
- `node --check desktop/stack-launcher.mjs` — PASS.
- `node --check tests/unit/test-desktop-lifecycle-contract.mjs` — PASS.
- `node --test tests/unit/test-desktop-lifecycle-contract.mjs` — final result **4 passed, 0 failed, 0 skipped**.
- `git diff --check` — PASS.
- `npm ci --cache E:\pip_temp\covert-dogfood-1r-npm-cache-20261006` — exit **0**, reported **129 packages added**, **130 audited**, completed in about **6 minutes**. No package versions or lockfile entries changed.
- Both install-created paths were absent before the install. After it, `node_modules` contained **6,460 files / 293,629,167 bytes**; the selected npm cache contained **290 files / 73,006,125 bytes**. Combined logical file size added: **366,635,292 bytes (349.6 MiB)**. A volume snapshot during the install showed C: **8.12 GiB** free and E: **83.25 GiB** free; the latest post-install snapshot showed C: **8.08 GiB** and E: **82.83 GiB**. The first volume sample was taken after npm had already started, so it is not a full install delta and may include concurrent activity.
- npm reported **1 low and 2 high vulnerabilities**. It also left `node-pty@1.1.0` install/postinstall scripts pending under the configured npm script allowlist. No script approval was added and no dependency script was run. The lock-pinned Windows x64 package already contains `conpty.node`, `pty.node`, `winpty-agent.exe`, `winpty.dll`, `conpty.dll`, and `OpenConsole.exe`; staging and verifier checks use these prebuilt assets.

The first focused test run had **3 passed, 1 failed**. Its new assertion rejected the intentionally bundled Node runtime because it matched any `runtime` path. The assertion was narrowed to permit Node while rejecting a packaged llama.cpp runtime. The rerun is the 4/4 result above; the initial failure was a test-contract defect, not product verification.

`cargo fmt --manifest-path desktop/Cargo.toml -- --check` still returns exit 1. Its remaining diffs are in code already present at the committed baseline. The task-owned `DataRoots` helpers and the added `app_data_root` call were formatted; no unrelated whole-file formatting was applied. Disposition: **BASELINE_FORMAT_DEBT**. Rust typechecking and native tests were not run.

## Build and runtime boundary

- After `npm ci`, `node_modules` exists. `desktop/resources` and `desktop/target` remain absent. No frontend, prepare, verify, or Tauri build command was run; `desktop/prepare.mjs` recursively replaces `desktop/resources`.
- `makensis` was not found on PATH or in the checked standard NSIS install paths. The canonical Tauri NSIS build has not yet been run, so the actual bundler prerequisite state remains untested.
- The latest machine sample showed **1.20 GiB free RAM**, below the directive's 3 GiB build/runtime minimum. At that sample, PID **13116** had a 1.13 GiB working set, PID **24024** 2.06 GiB, and operator-owned PID **9548** 0.84 GiB. No model or native build was started.
- Process ownership investigation: PID **13116** (`llama-server.exe`, created 2026-10-06 09:02:35) and PID **24024** (same executable, created 09:09:31) both load the same model hash from `E:\aide-sovereign-workbench\aes-ledgerpro\runtime\ai_assistant_models\blobs\sha256-5ee4f07cdb9beadbbb293e85803c569b01bd37ed059d2715faa7bb405f31caa6`. Their executable is under that separate tree's `runtime\ollama_bundle\lib\ollama`. They listen on `127.0.0.1:54007` and `127.0.0.1:65347`; both `/health` requests returned **200** and no established client connections were observed. Their direct parent PIDs **24732** and **17816** have exited; cwd and earlier parent command lines were not recoverable. The `E:\aide-sovereign-workbench` path is the bare repository entry, and neither server is part of this desktop candidate. Classification: **UNKNOWN / possible operator-owned Covert runtime**; not proven stale and not stopped.
- PID **9548** (`opencode.exe`, created 06:59:57) runs from the operator's E: Node installation. Its live ancestry includes `cmd.exe` PID **20740** and Windows Terminal PID **16688**. Classification: **OWNED_BY_OPERATOR**; left running.
- Sysmon process logging was unavailable, and no matching Security process-creation event was returned for the two server PIDs. No app/runtime shutdown mechanism could be tied to their exited parents.
- Pairing is wired in source to an explicit “Pair browser session” click and the native `authority_pairing` command. No packaged UI was launched and no operator pairing was performed.
- No Hugging Face request or model download was made. The inspected committed MI1 (`c4896ecab0c4eadfbc536136373d8a67fa76f565`) and MI1b (`ac86d0dcafc54c93f2efdf206f15d09c9442fdc1`) candidates have no Atlas-gated worker availability/dispatch path, so neither qualifies a downloaded worker through the amended architecture.
- The inspected Main Luna baseline is `12b999d329b59fd7dd480504ce84670b0de521f5`; its owner worktree remains dirty and was not copied into this candidate. No committed candidate was found for a distinct Cipher Computer surface, AgentLoop task restoration after full restart, or canonical multi-project mount/registration. Treat the role of the existing Resident Console as Cipher's Computer as **UNKNOWN** until its owner confirms it.
- The E1 checkpoint remains on `E:\covert-ecosystem-expansion-luna2`, branch `codex/covert-ecosystem-expansion-luna2`, HEAD `bccf9bef932a2ebe51a0e7628c10df12b8967857`, dirty. Its owner changes were preserved; E1 verification was not run in this checkpoint.

## Acceptance still open

The requested native journey has not been demonstrated: frontend/resource preparation, Tauri/NSIS build, install/launch, persistent Cipher UI and task recovery, operator pairing, Hugging Face acquire/register/Atlas qualification, worker delegation with evidence, real-project mount, terminal operation, restart/recovery, and owned-process cleanup. This candidate is not an installed-product or release acceptance receipt.

## Next action at the previous checkpoint (superseded)

At the previous checkpoint, ownership/shutdown for the two model servers was still under investigation. The current directive does not require stopping those servers; their unknown ownership is preserved, and the resource gate is the measured physical RAM floor. The independent Main Luna and DeepSeek dependencies remain separate from packaging.

## Packaging/resource continuation — 2026-10-06

### Preserved candidate state

- Starting point remained branch `codex/desktop-dogfood-integrated-20261006`, HEAD `12b999d329b59fd7dd480504ce84670b0de521f5`; no commit, reset, clean, stash, or push was performed.
- Current tracked changes remain the six desktop/source paths listed above. Current untracked paths remain `desktop/STORAGE.md` and this evidence file. Current tracked diff is **6 files changed, 297 insertions, 60 deletions**; the evidence and storage documents are untracked and excluded from that statistic.
- No unexpected path appeared. `desktop/resources`, `browser/dist`, and `desktop/target` were not generated during this continuation.
- The prior 3/1 focused-test failure is retained above. It was the overly broad test assertion, and the corrected suite remains green; it is not erased by later runs.

### Serial resource readings and process ownership

Measurements were taken serially. The required 3 GiB floor is **3,221,225,472 bytes**.

| Time (CDT) | Win32 OS free physical | PerfOS available physical | Total physical | Committed | Commit limit | Free commit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 10:21:11.983 | 1,034,612,736 B | 991,289,344 B | 17,099,075,584 B | 21,820,989,440 B | 26,827,939,840 B | 5,006,950,400 B |
| 10:29:12.537 | 1,184,231,424 B | 1,121,771,520 B | 17,099,075,584 B | 21,878,902,784 B | 26,827,939,840 B | 4,949,037,056 B |
| 10:35:50.077 | 1,348,079,616 B | 1,363,116,032 B | 17,099,075,584 B | 21,460,414,464 B | 26,827,939,840 B | 5,367,525,376 B |

At 10:29, even the higher Win32 OS free-physical reading was **2,036,994,048 bytes below** the launch/build floor; PerfOS available physical was **2,099,453,952 bytes below** it. Both measures fail admission. `C:\pagefile.sys` reported allocated base size **9,278 MiB**, current use **3,409 MiB**, peak use **3,436 MiB**, and `TempPageFile=False`. The pagefile was not changed.

At the final 10:35 reading, Win32 OS free physical was **1,348,079,616 B** and PerfOS available physical was **1,363,116,032 B**; both remain below the 3 GiB floor by **1,873,145,856 B** and **1,858,109,440 B** respectively. Committed memory was **21,460,414,464 B**, leaving **5,367,525,376 B** free commit. The pagefile remained unchanged at allocated base **9,278 MiB**, current use **3,443 MiB**, peak use **3,465 MiB**, `TempPageFile=False`.

The 10:29 top working sets were PID 24024 `llama-server` **2,208,591,872 B**, PID 21384 `opencode` **1,049,042,944 B**, PID 9548 `opencode` **891,666,432 B**, PID 13116 `llama-server` **889,331,712 B**, PID 17164 `msedge` **764,551,168 B**, and PID 10156 `ChatGPT` **753,086,464 B**. PIDs 13116 and 24024 remained `UNKNOWN` ownership, listened only on `127.0.0.1:54007` and `127.0.0.1:65347` respectively, and both local `/health` reads returned HTTP 200. Their exited parents do not establish ownership; neither process was stopped. PID 9548 remains `OWNED_BY_OPERATOR` and was left running. No process was terminated.

At 10:35, top working sets remained PID 24024 **2,208,591,872 B**, PID 21384 **1,045,655,552 B**, PID 9548 **921,849,856 B**, PID 13116 **889,331,712 B**, PID 17164 **798,130,176 B**, PID 10156 **634,511,360 B**, PID 4320 `TextInputHost` **598,396,928 B**, and PID 23592 `ChatGPT` **490,147,840 B**. Ownership classifications and no-termination decision were unchanged.

### Cheap verification after source edits

- `node --check desktop/prepare.mjs`, `node --check desktop/verify-prepare.mjs`, `node --check desktop/stack-launcher.mjs`, and `node --check tests/unit/test-desktop-lifecycle-contract.mjs` — all exit **0**.
- `node --test tests/unit/test-desktop-lifecycle-contract.mjs` — **4 passed, 0 failed, 0 skipped**, final run after the storage and resource-staging edits.
- `git diff --check` — exit **0**.
- `cargo fmt --manifest-path desktop/Cargo.toml -- --check` — exit **1**, with output limited to previously committed formatting debt in `desktop/src/main.rs` (including the existing pairing/startup formatting). It reported no diff for the task-owned `DataRoots`/model-path code. Classification remains **BASELINE_FORMAT_DEBT**. Rust typecheck/native tests were not run because the resource floor was not met.

### npm audit classification

Read-only `npm audit --json` exited **1** and reported **1 low / 2 high** vulnerable packages. All three are transitive (`isDirect=false`); no dependency or lockfile was changed and no audit fix was run.

| Package and installed version | Dependency path / class | Desktop reachability | Available fix |
| --- | --- | --- | --- |
| `brace-expansion@5.0.9`, high | `minimatch@10.2.6` under ESLint / TypeScript ESLint tooling; dev-only | Not in `npm ls --omit=dev`; not among staged runtime packages | `5.0.12` resolves the currently reported advisories: [nested-recursion](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [parseCommaParts recursion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p), and [quadratic rewrite](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr). |
| `source-map-js@1.2.1`, high | `postcss@8.5.28` → Vite; dev-only | Not in `npm ls --omit=dev`; not among staged runtime packages | `1.2.2`, per [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). |
| `dompurify@3.4.13`, low | Overridden dependency of production `monaco-editor@0.56.0`; root override pins `3.4.13` | Monaco is imported by `browser/src/main.ts` in the production browser dependency graph. Runtime shipping is expected but has not been verified in a built frontend; exact sanitizer call-path/precondition reachability is also unproven, so the finding remains open. | `3.4.16` fixes both [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p) and [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2). The first requires `IN_PLACE` sanitization with node-removing after-sanitize hooks; this app’s use of those conditions is unverified. |

`npm explain` confirmed the paths above; `npm ls --omit=dev brace-expansion dompurify source-map-js --all` retained only DOMPurify under Monaco. Updating the brace-expansion and source-map-js ranges would change the lockfile. Updating DOMPurify also requires changing the explicit root override and lockfile. Those compatibility edits were not made in this packaging slice; the production-tree DOMPurify finding remains an open security item.

### node-pty staging contract

- Current Node reported `win32`, `x64`, version `v26.4.0`; installed `node-pty` package is `1.1.0`.
- The package’s existing `prebuilds/win32-x64` directory contains `pty.node`, `conpty.node`, `winpty-agent.exe`, `winpty.dll`, `conpty/conpty.dll`, and `conpty/OpenConsole.exe`; this matches the verifier’s Windows x64 requirements. The copied source assets are present in `node_modules`; staging into `desktop/resources` has not run.
- `npm config get allow-scripts` returned only `opencode-ai`; npm left `node-pty@1.1.0` install/postinstall scripts pending. No approval or script execution was performed.
- Source staging now chooses `${process.platform}-${process.arch}`, fails when the package/prebuild directory is absent, and stages only `package.json`, runtime `lib` files, and that platform’s prebuilds. Conventional test files, source maps, PDBs, node-pty scripts, C++ sources, deps, and third-party sources are excluded or rejected by the verifier. Root packaged source trees also exclude conventional test/debug files. This source contract is implemented, not yet demonstrated by running prepare/verify.

### Storage source contract

- Tauri 2.11.5 resolves `app_local_data_dir()` as `dirs::data_local_dir()/org.ferrellsyntheticintelligence.aide`. On the current Windows account `LOCALAPPDATA` is `C:\Users\Grey_\AppData\Local`, so source-derived expected paths are:
  - Covert app-local base: `C:\Users\Grey_\AppData\Local\org.ferrellsyntheticintelligence.aide`
  - Workspace, `.aide` state, and logs root: `C:\Users\Grey_\AppData\Local\org.ferrellsyntheticintelligence.aide\workspace`; logs are below `.aide\logs`.
  - DPAPI credential file: `C:\Users\Grey_\AppData\Local\org.ferrellsyntheticintelligence.aide\workspace\.aide\credentials.dpapi`.
  - With E: present and `AIDE_MODEL_DIR` unset in the sampled shell: models at `E:\CovertData\CovertCoder\models`, runtime at `E:\CovertData\CovertCoder\models\runtime`, default executable at `E:\CovertData\CovertCoder\models\runtime\llama-server.exe`.
- The source now returns an explicit startup error instructing the operator to set an absolute `AIDE_MODEL_DIR` if E: is unavailable. It no longer silently defaults model storage to app-local data on C:. Absolute model/runtime/server overrides remain source-supported; Rust `Command` arguments and environment values are passed without shell splitting. The wrapper creates chosen directories, canonicalizes existing paths, and rejects overlap with immutable resources.
- These are source-derived expected paths only. No installed launch, path persistence/restart, path-with-spaces, create-failure, permission-failure, or external storage behavior was run. The backend still has one `AIDE_WORKSPACE` for both project files and `.aide` state and still lacks canonical arbitrary-project mounting.

### Build and acceptance boundary

- No frontend build, prepare, resource verification, Rust typecheck, native build, Tauri build, canonical NSIS attempt, installer, installed launch, pairing, terminal, or shutdown journey ran. The canonical NSIS toolchain classification remains **UNKNOWN**; the earlier manual `makensis` probe is not a canonical Tauri build result.
- The source-level fallback and development-resource changes have focused static/unit coverage, but preparation and storage runtime behavior remain **UNVERIFIED**.
- **DESKTOP-PACKAGING-1R = PARTIAL**: physical RAM is below the required floor, so frontend/native build, preparation, app launch, and installer exercise remain gated; the DOMPurify production dependency advisory is also unresolved.
- **DESKTOP-DOGFOOD-1R = PARTIAL**: packaging has not passed, and Cipher, real project mount, pairing, acquisition/configuration, Atlas qualification/dispatch, terminal journey, recovery, and shutdown remain unexercised or unresolved.
- Final `git status --short`: `M desktop/prepare.mjs`, `M desktop/src/main.rs`, `M desktop/stack-launcher.mjs`, `M desktop/tauri.conf.json`, `M desktop/verify-prepare.mjs`, `M tests/unit/test-desktop-lifecycle-contract.mjs`, `?? desktop/STORAGE.md`, and `?? docs/evidence/desktop-dogfood-2026-10-06.md`. HEAD remains `12b999d329b59fd7dd480504ce84670b0de521f5`.
- No commit was created at this checkpoint. The later section below records the resource gate clearing and the ordered build/install sequence.

## Full package build and installed exercise — 2026-10-06

This continuation supersedes the earlier “no build” boundary and RAM-recovery next action. The initial below-floor result remains preserved above. No pagefile configuration command was run, and PIDs 13116 and 24024 were not terminated.

### Resource gate and ordered validation

- The required floor is **3,221,225,472 bytes (3 GiB)** of available physical memory. At 11:02:04.765 CDT, Win32 OS free physical memory was **572,870,656 B** and PerfOS available physical was **595,521,536 B**; the expensive sequence remained blocked.
- At 11:03:50.428 CDT, a fresh serial sample measured **5,606,608,896 B OS free** and **5,642,022,912 B available physical**, above the floor. Committed memory was **22,458,163,200 B / 26,827,939,840 B**. The pagefile sample at 11:02 reported `C:\pagefile.sys` allocated **9,278 MiB**, current **3,485 MiB**, peak **3,539 MiB**, `TempPageFile=False`.
- Before `cargo check` at 11:07:04.705, available physical was **9,755,295,744 B**. Before the canonical Tauri build at 11:14:17.519, it was **8,834,211,840 B**. During release compilation it measured **6,841,491,456 B** at 11:17:23 and **8,403,845,120 B** at 11:19:36. Before install at 11:25:35.840 it was **7,188,586,496 B**; before first launch at 11:28:05.412 it was **7,488,286,720 B**. Each admitted build/install/launch sample was above the required floor.
- At 11:34:20, CIM reported pagefile allocated size **10,238 MiB**, current **8,915 MiB**, peak **10,211 MiB**, with `TempPageFile=False`; this differed from the earlier 9,278 MiB allocation. No pagefile configuration change was made by this work. The cause of the reported size delta is **UNKNOWN**.

The ordered steps completed as follows:

1. `npm run build:frontend` — exit **0**; Vite **8.3.0**, **1,432 modules**, completed in **38.05 s**. The main JS chunk was **4,682.37 kB** (gzip **1,209.21 kB**). The standalone build output had no warning.
2. `node desktop/prepare.mjs` — exit **0**; staged `zod@4.6.5`, `ws@8.21.3`, `typescript@5.9.3`, `typescript-language-server@5.3.0`, and `node-pty@1.1.0 (win32-x64)`.
3. `node desktop/verify-prepare.mjs` — exit **0**. A controlled negative probe temporarily moved required `academy/courses/python-foundations.json`; verification exited **1** with `ENOENT`, and the required file was restored in `finally`.
4. Rust/native checks: first `cargo check --manifest-path desktop/Cargo.toml` exited **0** in **2m48s**, with one unused-parameter warning for `app_data_root` on Windows. The cause was the parameter being used only in the non-Windows cfg branch. It was renamed `_app_data_root` without behavior change; the repeat check exited **0** in **4.01 s** with no warnings. `cargo test --manifest-path desktop/Cargo.toml` exited **0**: **16 passed, 0 failed, 0 ignored**, test profile build **2m37s**, test execution **6.71 s**.
5–6. `npm run desktop:build` — exit **0**, using the canonical Tauri config with the NSIS target. Its `beforeBuildCommand` repeated the frontend build and prepare. That Vite run completed in **3.65 s** and emitted the chunk-size warning for the same 4,682.37 kB main chunk plus plugin timing diagnostics. The optimized Windows release compile completed in **6m35s** and produced `desktop/target/release/aide-sovereign-workbench.exe` (**11,761,152 B**). Tauri downloaded NSIS **3.11** and `nsis_tauri_utils` **0.5.3**, validated both hashes, and ran `makensis` from the project-local Tauri tool directory. One NSIS bundle completed at `desktop/target/release/bundle/nsis/Covert Coder_0.1.0_x64-setup.exe`.
- `node scripts/desktop-artifact-smoke.mjs` — PASS; found the non-empty Windows installer.
- `node --check` for `desktop/prepare.mjs`, `desktop/verify-prepare.mjs`, `desktop/stack-launcher.mjs`, and `tests/unit/test-desktop-lifecycle-contract.mjs` — all exit **0**. `node --test tests/unit/test-desktop-lifecycle-contract.mjs` — **4 passed, 0 failed, 0 skipped**. `git diff --check` — exit **0**.
- `cargo fmt --manifest-path desktop/Cargo.toml -- --check` — exit **1**, still showing formatting differences in pre-existing `desktop/src/main.rs` sections (pairing/startup code and the existing `resource_dir` expression). It reported no formatting change in the task-owned `DataRoots` block. Classification: **BASELINE_FORMAT_DEBT**; no whole-file reformat was applied.

### Prepared-resource evidence

- The prepared `desktop/resources` tree contained **1,231 files / 170,397,874 B** at install. The only `node-pty` prebuild directory was `win32-x64`; its seven staged files totaled **2,571,840 B**: `conpty_console_list.node`, `conpty.node`, `pty.node`, `winpty-agent.exe`, `winpty.dll`, `conpty/conpty.dll`, and `conpty/OpenConsole.exe`.
- The prepare command stages `node-pty/package.json`, runtime `lib` files, and `${process.platform}-${process.arch}` prebuilds. The verifier passed with the host tree and statically rejects node-pty files outside `package.json`, `lib`, and the selected architecture directory; it also rejects `.map`, `.pdb`, conventional test files, model weights, and llama/ggml runtime binaries. No model weight or model server binary was present in immutable resources.
- The required-file negative probe above demonstrated fail-closed behavior. A separate synthetic unexpected-architecture probe was blocked by the tool policy before execution; it made no filesystem change. Rejection of an unexpected architecture is therefore supported by verifier inspection and the observed sole `win32-x64` stage, but was not dynamically fault-injected.

### Installer identity and installation

- Installer: `Covert Coder_0.1.0_x64-setup.exe`, **36,840,968 B**, SHA-256 `94255C6BA9A74B537BAD03DB9186E3A68F0275CF880B313A4454606C7AB65CA0`.
- Built from dirty worktree `E:\covert-desktop-dogfood-20261006`, branch `codex/desktop-dogfood-integrated-20261006`, base/source HEAD `12b999d329b59fd7dd480504ce84670b0de521f5`; it was not produced from a clean commit. No source HEAD change occurred before the build.
- The generated NSIS script specifies `currentUser` mode and defaults to `%LOCALAPPDATA%\Covert Coder`. That target and the Covert Coder uninstall registration were absent before install. `Start-Process ... -ArgumentList /S -Wait` completed with installer exit **0**. Installed tree: **1,233 files / 182,246,961 B**.
- A relative-path/size/last-write metadata manifest of the install directory had SHA-256 `8D22D3CEA395E4F7437B46818BF85F2142AB240AE37E4C88B2E315D4CBCBE8D2` after install and the same value after both app runs and final shutdown. File count and total size were unchanged. This found no unexpected install-directory writes.

### Installed runtime and storage

- First installed launch started PID **9220** at 11:28:08.149 CDT from `C:\Users\Grey_\AppData\Local\Covert Coder\aide-sovereign-workbench.exe`. Its main window title was `Covert Coder`, with a nonzero window handle and `Responding=True`.
- The public facade health route returned HTTP **200**. At 11:29:51 it reported API version `dev`, workspace `C:\Users\Grey_\AppData\Local\org.ferrellsyntheticintelligence.aide\workspace`, and state **DEGRADED**: backend **HEALTHY**, facade **UNKNOWN**, model_engines **STOPPED**, resident **UNKNOWN**, workers **UNKNOWN**, remote_bridge **UNKNOWN**. `/api/models/status` returned **403** while unpaired. No READY state was reported.
- Before first launch, the workspace directory and `E:\CovertData\CovertCoder\models` were absent, and the credential file was absent. After launch, the per-user workspace and `.aide\logs` existed; three logs were created (`arch-daemon.log`, `desktop-facade-out.log`, `desktop-legacy-out.log`). The external E: model and `runtime` directories existed with **0 model files**. `AIDE_MODEL_DIR` was unset. No pairing, model download, or model-weight write occurred.
- The main executable path remained under the NSIS installation. The runtime process image and resource paths resolved under `E:\WpSystem\...\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Covert Coder\resources` in this Codex packaged-app host, not under the source checkout. The logical install resource tree and this resolved tree both contained **1,231 files / 170,397,874 B**; SHA-256 matched for `stack-launcher.mjs`, `runtime/node.exe`, `node-pty/package.json`, and `node-pty/prebuilds/win32-x64/pty.node`. No running command line referenced `E:\covert-desktop-dogfood-20261006`. This supports installed-artifact provenance in the observed host, while the WpSystem path is an environment-specific resource mapping.
- The first app process was absent by 11:33:51; its three backend listeners were gone, and no matching Application Error or Windows Error Reporting event was returned by a narrow 10-minute query. The exit cause is **UNKNOWN** (no exit code was captured, and operator window-close versus another exit cause could not be distinguished). No protected process was affected.
- A second controlled launch started PID **10300** at 11:36:08 from the same installed executable. It returned HTTP 200 / **DEGRADED**, showed a responsive `Covert Coder` window, and spawned the installed-resource Node processes. `CloseMainWindow()` returned true; the app exited within **15 s**. Its runtime children and listeners on 4777–4779 were absent afterward. The .NET wrapper did not expose an exit code after wait, so the exit code is **UNKNOWN**. This is the positive graceful-close observation.

### Installed node-pty result and boundary

- The bundled installed Node **v26.4.0** loaded `node-pty` from the resolved installed-resource tree. A ConPTY `cmd.exe` session emitted `COVERT_INSTALLED_PTY_OK` and raised an exit event with exit code **0**. This proves native module load and terminal command initialization on the installed files.
- The first short-lived probe process stayed alive after the shell exit because the probe did not close the PTY handle. Its exact command line was checked; the task-owned probe PID **20744** was stopped, and it had no remaining child. This was probe cleanup, not an app process. A follow-up probe tried `term.dispose()`, which failed with `TypeError: term.dispose is not a function`; `node-pty@1.1.0` does not expose that method.
- A live-shell shutdown probe called the supported `term.kill()`. The terminal emitted the marker and an exit event, and no shell child remained, but node-pty's ConPTY console-list helper wrote `AttachConsole failed` from `conpty_console_list_agent.js`; the child exit code was **-1073741510** and the Node probe process exited **0**. The failure occurs in this Codex packaged-app host. Whether this is an AppContainer restriction or a node-pty integration defect is **CAUSE UNKNOWN**. The exact integrated app terminal UI journey was not run because operator pairing was not performed. Packaging terminal cleanup is therefore not fully qualified outside natural shell exit.

### Updated dependency classification

Read-only `npm audit --json` exited **1**, summary **2 low / 2 high**. `brace-expansion@5.0.9` (high) and `source-map-js@1.2.1` (high) are dev-tree findings; `dompurify@3.4.13` (low) is present from the root override. npm also reports a direct `monaco-editor` low row with range `>=0.57.0-rc.2`, while the installed version is **0.56.0**, so that exact advisory range does not match the installed Monaco version. No `npm audit fix`, dependency change, or node-pty script approval was made.

Static inspection of the installed package shows `monaco-editor/esm/vs/base/browser/domSanitize.js` imports its vendored `./dompurify/dompurify.js`, whose banner identifies DOMPurify **3.4.8**. Therefore the root npm override to 3.4.13 does not update Monaco's embedded copy. Microsoft's [0.57.0 changelog](https://github.com/microsoft/monaco-editor/blob/v0.57.0/CHANGELOG.md) says that release updates its bundled DOMPurify from 3.4.8 to 3.4.15; the maintainer [issue #5454](https://github.com/microsoft/monaco-editor/issues/5454) explains that the sanitizer is shipped inside Monaco artifacts. Current [GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p) and [GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2) affect DOMPurify versions through 3.4.15. The embedded 3.4.8 security status against its applicable advisories remains open; the audit graph and runtime exploitability were not treated as equivalent.

### Current verdicts and handoff

- **DESKTOP-PACKAGING-1R = PARTIAL.** Frontend, prepare/verify, Rust checks/tests, canonical Windows Tauri release, NSIS artifact, install, installed launch, external storage, health truth, package-path resolution, and controlled app close were observed. The node-pty module and terminal command initialize, but `AttachConsole failed` during explicit ConPTY termination under the Codex packaged host remains unresolved, and the first visible app exit cause was not captured. Re-run terminal termination from a normal user desktop context with process ownership and exit evidence before claiming full packaging acceptance.
- **DESKTOP-DOGFOOD-1R = PARTIAL.** Operator pairing, real project mount, model acquisition/configuration, Atlas qualification, worker dispatch, integrated terminal journey, verifier/evidence journey, and recovery/shutdown across the complete Cipher workflow remain open. Main Luna and DeepSeek/Atlas contract dependencies remain independent blockers.
- PIDs **13116** and **24024** remained live only on `127.0.0.1:54007` and `127.0.0.1:65347`, respectively, at the final read; both stayed untouched. Final installed app PID and its Node children were absent, and 4777–4779 had no listeners.
- This packaging behavior has now been exercised beyond focused tests. A bounded commit is justified after recording the remaining environmental/runtime limitation; no commit or push has yet been made in this checkpoint.
