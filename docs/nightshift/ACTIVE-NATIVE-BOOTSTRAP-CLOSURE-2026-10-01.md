# Native bootstrap closure execution packet

Sol 6.1 is the canonical executor under the owner's primary convergence handoff
and Issue #38 correction 5930979375. Historical Luna ownership is superseded.

## Ground

- Worktree: `E:\covert-nightshift-integration`.
- Branch: `nightshift/production-convergence-20260926`.
- Entry HEAD: `fc263fe26f364b5c972be79a8ac6e651a671dcd0`, equal to origin.
- Entry dirt: only this executor's ownership entry in `AGENT_NOTES.md`.
- Frozen PR #31: `b79d2480498e446cff36b26dd4b4faef7745726b`.
- Independent audit: `bf6f03874fd576b28f1ba2240062b41424691e9b`, exact-SHA
  AIDE CI 36858354648 SUCCESS 23/23. Do not merge wholesale. Seven code repairs
  remain isolated until a legitimate packaging green checkpoint.

## Objective and evidence

Close Windows native private-pipe EOF through actual installed NSIS/MSI launch,
pairing, health, cleanup and restart. A local native diagnostic is a root-cause
experiment; it does not certify installation, onboarding or release readiness.

- REPOSITORY: Tauri 2.11.5 / tauri-utils 2.9.3 caches a canonicalized starting
  binary path; Windows `resource_dir()` returns its directory. Canonicalization
  introduces the verbatim drive prefix. Current root resolver preserves it.
- RUNTIME: Exact run 36840612821 MSI native executable SHA-256
  `770155d9765f3b847032d50108475f37e17bb7009a73af9c8f6f59eef9f26d07`
  reproduced exit 101 / zero-byte pairing read locally, both with default parent
  streams and redirected parent streams. Scoped fresh WebView2 profiles protected
  owner data. Both runs left zero owned processes and zero product listeners.
- RUNTIME: Redirected stderr identifies bundled Node 22.20.0 `EISDIR`, `lstat E:`
  in entrypoint `realpathSync`, before launcher initialization. A plain entrypoint
  runs; the identical file with a verbatim drive prefix fails identically.
- RUNTIME: Current unmodified source release build SHA-256
  `22d24d85cd9284dcee7bb469e0640223a8aa3e78431e50eb9e162cc1f74c5e2c`
  reproduces the same failure against the exact extracted resource tree.
- RUNTIME: Five GUI-parent canaries (including detached console, null stderr,
  no-window flags) passed; the exact threaded bounded pipe reader also passed.
  Generic console inheritance and reader framing do not explain the observation.
- RUNTIME: Added canonical-path identity regression fails on original resolver:
  4 pass / 1 fail. Initial standalone compilation used a module as crate root
  and failed before tests; a parent-module wrapper corrected that harness error.
- RESEARCH: Node upstream issue 62446 and fix PR 65378 describe the same
  namespaced drive-root `realpathSync` defect. Locked local runtime reproduction
  is authoritative for this package, regardless of upstream release availability.

## Bounded repair in progress

Use existing locked `dunce` 1.0.5 as a direct native dependency to simplify only
safely equivalent Windows paths before constructing Node argv, cwd and resource
environment. Preserve root identity, missing/ambiguous-root rejection and all
Authority/pairing/admission behavior. Reject non-convertible verbatim semantics
with an explicit classification; do not strip reserved names, trailing spaces,
long paths or UNC namespaces blindly.

Regressions: canonical root with spaces retains exact identity, unsafe namespace
paths fail explicitly, actual bundled Node executes a canary from the resolved
canonical resource root. Native tests passed 15/15; locked offline release build
passed. Repaired native SHA-256
`97ee2b71b1776741aabe123128a74dc6dade436a961b6d1c079abbc95cdadb2b`
passed native bootstrap, health and zero-owned-process/listener cleanup twice,
including reused workspace state and the same WebView2 profile. This is a local
build against the exact extracted CI resources, not installed acceptance.

The real lifecycle functions then reproduced a second defect: `/health` is
protected and returned 403. Changed only the smoke to the canonical public
`/api/health`, matching native readiness; Authority remains unchanged. The
repaired functions passed two native launch/close cycles with identical persisted
workspace and profile, zero owned Node processes/listeners after each. They now
require first launch, same-install relaunch and post-reinstall launch in NSIS/MSI
CI, checking all three product ports and the owned bundled Node tree.

A further verification defect was not passed over: the legacy facade unit-test
after hook closed global active sockets, including runner/stdout transport. A
new asynchronous final assertion registered 22 tests but reported 21; after
moving it to its own required packaging file, the original fixture itself
intermittently reported only 20 of 21. Teardown now tracks only its own servers
and their sockets, awaits closure and asserts zero owned connections/listeners.
The complete facade suite reports 21/21 and its final transport test reports
1/1 independently. The packaging contract file reports its named assertion 1/1.
Original reporting anomalies are not counted as successful verification.

Node/browser TypeScript, launcher syntax, Rust formatting and diff checks passed.
Refreshed `desktop:verify` passed, including frontend build and staged resources;
no model is implicitly bundled or qualified. Scoped ESLint passed. The generated
C1-02 reproducibility check detected one shifted unit-test caller reference;
regeneration changes only its line 329 to 343, and `--check` then passes.
Full architecture, Veritas/exact-SHA CI and actual NSIS/MSI lifecycles remain
pending; do not mark the packaged blocker closed.

## Invariants and exit

Keep proofs in memory; no raw stdout, environment or credentials in receipts.
Never reset/stash/switch the canonical worktree. Preserve model collection and
6.5 GiB physical / 5 GiB commit model-start floors. These bootstrap experiments
do not start a local model. Track and stop only exact owned trees; verify fixed
ports. Never install/uninstall over unknown owner data.

Skills: Developer's Way, Developer Creed Production SOP, Covert production
closure, Covert Context Control, packaging/release, Windows, pre-push gate,
failure-native-bootstrap-eof, failure-rust-module-test-harness.

Exit: focused native regression and build, native startup/stop/relaunch,
affected architecture/Veritas, coherent reviewed push, exact-SHA AIDE CI and
fresh Desktop NSIS plus MSI lifecycles. Repair any red before calling closed.
Then selectively reconcile isolated truth repairs; only afterward real inside-
Covert Codex entitlement/catalog/exact-model governed dogfood.

## Reopen evidence

Follow-on full-gate red at local 96a9436 is retained separately in
`SOL61-WINDOWS-GATE-RECONCILIATION-2026-10-01.json`: 836 pass / 3 fail / 11 skip.
Measured scratch audit-flush latency justified a task-scoped SSD fixture root;
no fixture deadlines, durability, production source path or admission floors
changed. A startup embedding event/schema mismatch was independently reproduced
and repaired with strict verdict variants. Full corrected gate remains required.
The additive Product Fidelity packet is
`docs/nightshift/PRODUCT-FIDELITY-THEME-CLOSURE-2026-10-01.md`; it is OPEN and
must not derail this fundamental blocker.

- Historical package evidence: `WINDOWS-DESKTOP-PACKAGE-CANDIDATE-2026-10-01.md`.
- Exact native experiment driver: `E:\pip_temp\sol61-native-artifact-probe.ps1`.
- Exact native experiment roots: `E:\pip_temp\sol61-native-296587fb7d2d4e95b949f93bb8513344`,
  `E:\pip_temp\sol61-native-b15988a8f0c641feaa621125f7489915`,
  `E:\pip_temp\sol61-native-77cb8e02cfb441deb6cfe554837ef2ff`.
- Node path comparison: `E:\pip_temp\sol61-node-path-probe.cjs`.
- GUI canary and bounded reader: `E:\pip_temp\sol61-console-canary.rs`.
- Repaired native roots: `E:\pip_temp\sol61-native-db7141f79f1a4159831712c8651b0a7f`
  and `E:\pip_temp\sol61-native-4e782b2d3768462d855616c03f822a3a`.
- Actual lifecycle-function probe: `E:\pip_temp\sol61-lifecycle-functions-probe.ps1`;
  forbidden-path failure retained at `E:\pip_temp\sol61-lifecycle-4a13813e7c124c3fa54483fd637cbb75`,
  repaired cycles at `E:\pip_temp\sol61-lifecycle-42741d4668ed4b36b2728ed7850182cd`.
- Primary sources: https://github.com/nodejs/node/issues/62446 and
  https://github.com/nodejs/node/pull/65378; installed locked Tauri sources
  `src/platform/starting_binary.rs` and `src/platform.rs`.

## Exact `bd4a06a` result and native ownership repair

Source `bd4a06a0d2176864963a0c240c9bb128a473d675` passed exact-SHA
[AIDE CI 36871320248](https://github.com/AnonymousNomad/covert-coder/actions/runs/36871320248),
**22/22 steps**, including Veritas. The corrected local full Windows pre-push
reported **841 pass / 0 fail / 11 skip of 852**. These close the bounded
embedding/full-gate checkpoint; they do not close packaging.

[Desktop 36871406341](https://github.com/AnonymousNomad/covert-coder/actions/runs/36871406341)
passed Linux/macOS and Windows native tests, build and artifact smoke. Installed
Windows NSIS reached health but failed its owned Node/listener cleanup predicate;
MSI was skipped. The hosted failure remains OPEN. Its exact residual identity
was not reported by the old smoke; do not infer that a local experiment proves
the precise hosted normal-close cause.

Exact extracted NSIS native SHA-256
`1c0597addff1d21de170cda957796b871743976b6296b5ed47318593f99f9178`
passed local normal window close and same-state restart. Abrupt termination of
only its native parent then reproduced an independent Covert lifecycle defect:
four bundled Node processes, their consoles and all three product listeners
remained after 15 seconds. Exact owned rescue removed them. Windows parent
termination does not terminate child processes or execute the native Exit
callback. A separate GUI-parent timer canary passed both inherited and null
standard-handle cases; that hypothesis was not reproduced.

The bounded repair establishes a private unnamed Windows Job Object before
Tauri or any child can start. Only `KILL_ON_JOB_CLOSE` is enabled. The native
process holds its sole non-inheritable handle for its process lifetime; Windows
closes it on ordinary exit or crash, terminating descendants. Assignment failure
blocks startup. No breakaway, quota, Authority, model or admission policy changes.
The direct Windows dependency uses already-locked `windows-sys` 0.61.2; the lock
adds only the root dependency, with no package version churn.

Local repaired native SHA-256
`7e15eb45ffbecb8e56d2c5b9b9df7faf42e0443438dc638903da2b50f9b3f023`
passed **16/16 release native tests** and the two packaging contract tests.
Against the exact CI Node/resources, four actual native cycles passed: normal
window close, same-state restart, parent-only forced termination and recovery.
All captured descendants, including WebView/Node/console/probe children, and
all three listeners were absent without rescue. The actual lifecycle function
also passed normal close, forced termination and recovery (**3/3**). A separate
invalid-private-frame native startup fixture exited with the expected code 101
and left no owned Node/listener resources without rescue. This is diagnostic
failure-path evidence, not a production pairing exchange or installer proof.

Receipt: `evidence/SOL61-NATIVE-OWNERSHIP-REPAIR-2026-10-01.json`. Full affected
architecture/Veritas and fresh exact-SHA NSIS/MSI remain required for this repair.
The smoke now requires crash/recovery cycles and reports safe residual birth/PID
metadata on failure. Keep all preceding reds; never accept a rerun-only result.

Primary research: [Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects),
[nested jobs](https://learn.microsoft.com/en-us/windows/win32/procthread/nested-jobs),
[process termination](https://learn.microsoft.com/en-us/windows/win32/procthread/terminating-a-process)
and [Rust process-owned raw handles](https://doc.rust-lang.org/std/os/windows/io/trait.IntoRawHandle.html).
