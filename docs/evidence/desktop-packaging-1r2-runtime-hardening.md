# Desktop Packaging 1R2 Runtime Hardening

Date: 2026-10-06
Worktree: `E:\covert-desktop-dogfood-20261006`
Branch: `codex/desktop-dogfood-integrated-20261006`
Starting HEAD: `318b4ba9af8ff081ec25c17d4b24a5b6d3331b7d`

## Scope and status

This record covers the Windows ConPTY shutdown investigation, the bounded node-pty adapter change, the clean-source NSIS build/install, and the separate Monaco/DOMPurify release-security review. The installed app launched, reported truthful health, resolved external model storage, left its installation tree unchanged, and closed through its main window. The integrated terminal route, a second app launch after restart, and paired dogfood remain open.

Verdicts at this checkpoint:

- `CONPTY-LIFECYCLE — PARTIAL; packaged-asset PTY lifecycle passed; installed authorized terminal route and post-restart second session pending.`
- `DESKTOP-SECURITY-DEPENDENCY — BLOCKED / UNRESOLVED.`
- `DESKTOP-PACKAGING-1R2 — PARTIAL.`
- `DESKTOP-DOGFOOD-1R — PARTIAL.`

## ConPTY finding

The default `node-pty@1.1.0` ConPTY termination failure reproduces in both the installed resource package and the development package. It emits `AttachConsole failed`; the shell exit is `-1073741510`. A separate live `AttachConsole` probe succeeds in the same Windows user/session and returns the console process list. The evidence therefore does not support a Codex-host restriction or a package-staging difference.

The pinned node-pty source starts its console-process-list helper asynchronously and invokes the native kill path synchronously in the same `kill()` call. Its helper performs `AttachConsole` before `GetConsoleProcessList`. This ordering, the failure in both package modes, and the independent successful attach identify the failure as a node-pty default shutdown race. The helper's attach diagnostic is not suppressed.

The packaged resource runtime was then exercised with `useConpty: true` and `useConptyDll: true`. The exact full lifecycle record is:

- Result: `E:\pip_temp\covert-desktop-1r2-18519c1ce18e4e94bc7f8f6dfced2f5b\full-lifecycle-run-003\full-lifecycle.result.json`
- Result SHA-256: `43F912D861AC7969487B37E0154BE4B5302F8470A0F1E0E5184D58C714039912`
- Runner command: `pwsh.exe -NoProfile -NonInteractive -File E:\pip_temp\covert-desktop-1r2-18519c1ce18e4e94bc7f8f6dfced2f5b\full-lifecycle-run-003\run.ps1`
- Harness process exit: `0`; node runner PID `23116`, exit `0`; PTY shell PID `12012`.
- Resource gate at launch: `6,304,837,632` bytes available; required floor `3,221,225,472` bytes.
- Packaged runtime: Node `v26.4.0`, `x64`; node-pty `1.1.0`; `conpty.node` and `OpenConsole.exe` loaded from the installed Covert resource paths.
- Command output marker `COVERT_OUTPUT_SENTINEL_8f31` was observed.
- `PING.EXE` PID `25596` was present before cancellation and absent afterward; `cmd.exe` PID `12012` remained alive and returned the cancellation marker `COVERT_CANCEL_SENTINEL_6b9a`.
- A long-lived nested Node child PID `5448` printed `COVERT_CHILD_SENTINEL_31f7` before explicit PTY termination.
- Independent `AttachConsole` succeeded and reported the console PIDs; node-pty stderr contained no attach failure.
- Explicit termination emitted the node-pty exit event with code `1`. This is the DLL-backed implementation's observed forced-termination result.
- The pre-kill owned tree included the runner, shell, `OpenConsole.exe`, `conhost.exe`, and nested Node child. After termination, the exact PID/creation-time identities from that tree were absent; `postKillOwnedProcesses` and `cleanupActions` were both empty.
- The ancestry collector checked process creation time on each parent edge to reject reused PIDs.

The product adapter in `node/src/services/runtime-providers.ts` now explicitly selects the DLL-backed ConPTY path on Windows only. Regression coverage verifies that Windows receives `useConpty: true` and `useConptyDll: true`, while non-Windows runtimes receive neither flag.

This proves the packaged node-pty resource path and the product adapter contract. It does not yet prove a terminal opened through the installed app's authorized route, nor app shutdown/restart and a second integrated terminal session.

## Monaco / DOMPurify security disposition

Local package and bundle inspection established:

- Shipped Monaco package version: `0.56.0`.
- Monaco's vendored sanitizer version: DOMPurify `3.4.8`.
- The vendored sanitizer is present in the production frontend bundle.
- `browser/src/editor/lsp-providers.ts` registers a Monaco hover provider using language-server content; Monaco's markdown renderer sanitizes that rendered content. The sanitizer path is therefore reachable in Covert's build.
- The root `dompurify` override to `3.4.13` does not replace Monaco's vendored copy.

Repository rule R9 prohibits cloud access. The prior local [1R1 dependency record](desktop-dogfood-2026-10-06.md) preserves GHSA-p98j-92pf-mc4p and GHSA-6688-9rhm-gjv2, both affecting DOMPurify through `3.4.15`; it also records that Monaco `0.57.0` embeds DOMPurify `3.4.15`. That Monaco version is therefore not a demonstrated safe fix. The local npm cache has no verified Monaco candidate embedding a fixed DOMPurify release. Because the code is included and reachable, this review cannot claim the finding is inapplicable. No dependency upgrade was guessed, and `npm audit fix` was not run. The production sanitizer concern remains a release blocker until an offline, source-verifiable fixed dependency path is available.

## Verification at this checkpoint

Command: `node --test tests/arch/runtime-provider-node-pty.test.ts tests/arch/terminal-session-routes.test.ts`
Exit: `0`
Result: `13` passed, `0` failed, `0` skipped.

Command: `npx tsc --noEmit -p tsconfig.node.json`
Exit: `0`.

Command: `git diff --check`
Exit: `0`.

## Exact-source packaging sequence

Source commit: `5e9b993350dd8045043434455423320c7d37fa8c`
Branch: `codex/desktop-dogfood-integrated-20261006`
Tree at build: clean; no tracked or untracked source changes.

`package.json` and `package-lock.json` are unchanged from starting HEAD `318b4ba9af8ff081ec25c17d4b24a5b6d3331b7d`. `package-lock.json` SHA-256: `655A77AA57CB701F8E762B4D7E3D6C89406DEFA07D4739D8093CF99F22E193A3`.

Commands and results, in order:

1. `npm run build:frontend` — exit `0`; Vite `8.3.0`, 30.21 s. It reported the existing `index` chunk at `4,682.37 kB` and the `500 kB` chunk-size warning.
2. `node desktop/prepare.mjs` — exit `0`; staged `node-pty@1.1.0 (win32-x64)` and the existing pinned stack dependencies. It confirmed model weights and model runtime remain external.
3. `node desktop/verify-prepare.mjs` — exit `0`; resource verification passed.
4. Rust/native checks: `cargo fmt --manifest-path desktop/Cargo.toml -- --check` — exit `1` on pre-existing formatting in `desktop/src/main.rs`; no whole-file formatting was applied. `cargo check --manifest-path desktop/Cargo.toml` — exit `0` in 1m23s, no warnings. `cargo test --manifest-path desktop/Cargo.toml` — exit `0`, 16 passed, 0 failed, 0 ignored; compile 1m31s, tests 11.98s.
5. `npx tauri build --config desktop/tauri.conf.json --no-bundle` — exit `0`; release compile 2m41s, output `desktop/target/release/aide-sovereign-workbench.exe`. Tauri's canonical `beforeBuildCommand` repeated the frontend build (4.08s) and resource preparation; the same chunk-size warning appeared.
6. `npx tauri bundle --config desktop/tauri.conf.json --bundles nsis` — exit `0`; `makensis` generated the canonical NSIS setup installer.

Artifact identity:

- Installer: `E:\covert-desktop-dogfood-20261006\desktop\target\release\bundle\nsis\Covert Coder_0.1.0_x64-setup.exe`
- Size: `36,843,073` bytes.
- SHA-256: `D3C6E5DAD94D0A0CD01B143BD6FCD8251B3D700E66B3D65E41570BA36556A0C0`.
- `node scripts/desktop-artifact-smoke.mjs` — exit `0`.
- Installer invoked with `Start-Process -FilePath <installer> -ArgumentList '/S' -Wait -PassThru`; exit `0`.

The installed launcher has the same size as the release launcher (`11,761,152` bytes), but its SHA-256 is `014795B2C4E4F78F16BFC75507D43419670270E76477ED07DA7559DF31FFF9CF`, while `desktop/target/release/aide-sovereign-workbench.exe` is `A39F824A479E133260944063DBD748F8E3930A3952B49DBE1385433C24CC5CB2`. Cause of this raw executable hash difference is **UNKNOWN**. The installed resource copy of `node/src/services/runtime-providers.ts` does match the committed source SHA-256 `48B8B231ADB3524DC6816A3D7DD956C172E7FB23F7A3288BD4B55F89B2DAEB35`. This resource match does not explain the executable mismatch.

## Installed launch and shutdown

- Install root: `C:\Users\Grey_\AppData\Local\Covert Coder`.
- Installed tree: 1,233 files, `182,247,415` bytes.
- Before launch, after launch, and after controlled shutdown, the metadata manifest SHA-256 remained `EBE9624660C026950442090DB4490895E181016932F682616322F4BEE638D5CB`; no file count, size, or last-write metadata changed during ordinary app use.
- Installed launch PID `16308` came from `C:\Users\Grey_\AppData\Local\Covert Coder\aide-sovereign-workbench.exe`, created `2026-10-06T13:31:08.599282-05:00`. The window title was `Covert Coder`, its window handle was nonzero, and it responded after startup.
- `GET http://127.0.0.1:4777/api/health` returned HTTP `200` after 3.1 s. State was `DEGRADED`; backend `HEALTHY`; facade, resident, workers, and remote bridge `UNKNOWN`; model engines `STOPPED`. No model was reported ready.
- Runtime command lines used the installed Covert executable and the Codex package's virtualized installed-resource tree under `E:\WpSystem\...\LocalCache\Local\Covert Coder\resources`. No process command line referenced the source worktree.
- Workspace and logs were outside the install root at `C:\Users\Grey_\AppData\Local\org.ferrellsyntheticintelligence.aide\workspace` and `.aide\logs`.
- The launcher shell had no `AIDE_MODEL_DIR` override. The installed Rust bootstrap's Windows default selects `E:\CovertData\CovertCoder\models` when E: is present and passes the resolved path to child processes. That model directory existed with 0 model files; its runtime directory, `E:\CovertData\CovertCoder\models\runtime`, existed with 0 runtime files. No model was downloaded or bundled.
- At launch, listeners were PID `15548` on 4779, PID `20744` on 4778, and PID `11388` on 4777. `CloseMainWindow()` returned `true`; the app exited within 20 s. Exact app/backend process identities were absent afterward, and ports 4777–4779 had no listeners. Exit code was unavailable from the process wrapper.
- Available physical RAM after shutdown was `3,010,711,552` bytes, below the required `3,221,225,472`-byte floor. Later serial samples were `3,203,428,352` bytes at `13:38:45 CDT`, `3,208,232,960` bytes at `13:39:31 CDT`, and `3,186,876,416` bytes at `13:40:13 CDT`. One later sample was `3,924,250,624` bytes (timestamp not captured), but the fresh pre-probe sample at `13:44:22 CDT` was `3,176,370,176` bytes, below the floor. No app restart or adapter lifecycle probe was started below the floor, and no process was terminated to obtain headroom.

The exact installed artifact launched and served the base app, but the raw executable hash difference is unresolved, and an operator-paired terminal was not opened. Packaging remains partial; no release or dogfood acceptance is claimed.

The previous 1R1 evidence remains in `desktop-dogfood-2026-10-06.md`; its dirty-worktree installer is not the artifact recorded here.
