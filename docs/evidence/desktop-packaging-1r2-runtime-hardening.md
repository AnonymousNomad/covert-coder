# Desktop Packaging 1R2 Runtime Hardening

Date: 2026-10-06
Worktree: `E:\covert-desktop-dogfood-20261006`
Branch: `codex/desktop-dogfood-integrated-20261006`
Starting HEAD: `318b4ba9af8ff081ec25c17d4b24a5b6d3331b7d`

## Scope and status

This record covers the Windows ConPTY shutdown investigation, the bounded node-pty adapter change, and the separate Monaco/DOMPurify release-security review. Packaging from the resulting clean source checkpoint and installed-product verification remain pending in this record.

Verdicts at this checkpoint:

- `CONPTY-LIFECYCLE — IMPLEMENTED; packaged-asset PTY path verified; installed Covert integration pending.`
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

Repository rule R9 prohibits cloud access. The local npm cache has no verified fixed Monaco candidate or complete primary advisory metadata for this vendored configuration. Because the code is included and reachable, this review cannot claim the finding is inapplicable. No dependency upgrade was guessed, and `npm audit fix` was not run. The production sanitizer concern remains a release blocker until an offline, source-verifiable fixed dependency path is available.

## Verification at this checkpoint

Command: `node --test tests/arch/runtime-provider-node-pty.test.ts tests/arch/terminal-session-routes.test.ts`
Exit: `0`
Result: `13` passed, `0` failed, `0` skipped.

Command: `npx tsc --noEmit -p tsconfig.node.json`
Exit: `0`.

Command: `git diff --check`
Exit: `0`.

The previous 1R1 packaging evidence remains as documented in `desktop-dogfood-2026-10-06.md`; its dirty-worktree installer is not an artifact of this checkpoint. A new exact-clean-SHA build and install has not yet been run.
