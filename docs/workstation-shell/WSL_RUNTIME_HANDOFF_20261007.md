# WSL interactive runtime handoff — observed Windows boundary

Status: OPEN_NATIVE_REPRO. WSL discovery is repaired; interactive WSL is not qualified.

Owner: Runtime / Terminal / Packaging. The workstation owns the projection and keeps the regression visible; changing native backend/binary identity and containment requires composed runtime/package evidence.

## Reproduction and isolation

Host: Windows 10.0.26220, Node 26.4.0, node-pty 1.1.0, bundled ConPTY/OpenConsole 1.23.2510.08001. Installed distribution: Ubuntu-24.04. Discovery uses explicit UTF-16LE; one clean identity and stopped/running observations are returned without starting a distribution.

Production browser: the exact WSL distribution is selected, canonical Authority admits one real service session, but the xterm screen never receives the command marker. The acceptance assertion remains failing. Registration/RUNNING is not proof of a responsive shell.

Owned adapter probe: bundled backend emits ESC[1t and ESC[c ESC[?1004h ESC[?9001h, but no shell marker. Answering DA1 once does not resolve it. A noninteractive marker/pwd command on the same bundled path also fails to display output. Normal pipe execution of wsl.exe --distribution Ubuntu-24.04 --cd /mnt/e/pip_temp --exec /bin/sh -c pwd succeeds.

Diagnostic-only system ConPTY, with the same selected distribution, shell, environment policy and directory family: COVERT_SYSTEM_PROBE/mnt/e/pip_temp is observed and the PTY exits 0. This isolates a bundled-backend compatibility boundary, not the exact native C++ fault. System ConPTY has NOT been enabled in production. No silent fallback, dependency replacement, OS modification or distro shutdown was performed.

The probes leave Node conout workers referenced after PTY teardown; only each owned probe Node was stopped after matching parent, exact script and creation generation. No arbitrary PID/name termination or foreign process kill. Native child exit is distinguished from full native descendant/worker containment.

## Required contract and acceptance

GAP -> OWNER -> REQUIRED CONTRACT -> IMPLEMENTATION -> NEGATIVE TEST -> EVIDENCE -> STATUS

- Gap: responsive interactive WSL plus bounded verified shutdown under the selected executable/backend identity.
- Owner: Runtime / Terminal / Packaging; workstation tracks closure.
- Contract: explicit backend identity/qualification, exact distribution/cwd, same canonical Authority and service owner, no recovery fallback; unknown effects remain unknown.
- Implementation: qualify a WSL-compatible bundled ConPTY revision, or a deliberately selected alternative whose forced shutdown/descendant ownership is proved. Preserve the existing native path. No unqualified backend swap in this slice.
- Negative tests: malformed/uninstalled/stopped/unknown distribution; changed binary/backend after qualification; denied/revoked owner; hanging guest; own child survivor; foreign PID/listener untouched; cold start, stop, reload and recovery; replay must never synthesize stdin.
- Evidence: raw decoding/state, focused failures/repairs, failing browser logs, bundled/system differential JSON, binary version/hash/signature observations and resource receipts in evidence/20261007. Authenticode Valid alone is not compatibility or containment acceptance.
- Status: OPEN_NATIVE_REPRO; packaged WSL and global containment remain unproved.

Research boundary: Microsoft terminal #20536 documents DA1 initialization behavior (https://github.com/microsoft/terminal/pull/20536); the actual reply experiment here did not fix this host. Do not turn that hypothesis into a claimed repair.
