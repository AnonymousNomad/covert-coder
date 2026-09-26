# C5-11 / C5-12 / C5-15 Reliability Closure Evidence

## Scope

Worktree: `E:\aide-v1-mission-cancellation`  
Branch: `fix/v1-mission-cancellation`  
Starting SHA: `f4da26b0b1c062dce8f3066f350f032dd3877ce4`

This wave implements the release-critical reliability chain identified in the frozen closure matrix:

- C5-11 — bounded BYOK/provider calls.
- C5-12 — bounded Model Hub external fetches plus explicit HTTP ingress timeout settings.
- C5-15 — operator cancellation of a running Resident/agent mission.

The implementation does not add mission crash-resume persistence; C2-11 remains a separate V1.1 concern.

## C5-11 — provider/BYOK bounds

BYOK provider probes now use a bounded abort signal (10 s production default).
BYOK chat now uses a bounded abort signal (60 s production default) and composes it with caller cancellation.
The normal provider chat path propagates caller cancellation separately from its existing provider timeout.
Provider-owned credentials remain under the existing credential owner; no authentication semantics changed.
## C5-12 — Model Hub and HTTP bounds

Model Hub search/repository metadata fetches now have a 15 s production timeout.
Model downloads now have a 45 s idle-data watchdog; stalled attempts abort, retain resumable partial bytes, and use the existing bounded retry behavior.
Model Hub TIMEOUT is mapped to the typed route TIMEOUT response rather than a generic internal error.

The typed HTTP server now explicitly configures:
- requestTimeout: 120000 ms
- headersTimeout: 66000 ms
- keepAliveTimeout: 65000 ms

These server settings bound request ingress/socket behavior. They are not represented as cancellation of arbitrary asynchronous handler work. Model Hub handler hangs are instead bounded at the owning external-fetch service.

## C5-15 — mission cancellation

A new governed `POST /api/agent/cancel` route is enrolled as `agent.cancel` / revoke.
Cancellation is exact-session and actor-owner bound through canonical Authority.
Each live agent session owns an AbortController and retained runner handle.
Cancellation propagates through model runtime, normal provider chat, BYOK provider chat, and agent tool execution.
Pending mutation approval is rejected before cancellation completes.
Running command execution receives the abort signal; on Windows only the owned child PID/tree is terminated.
Resident exposes a STOP TASK action only while the session is running or awaiting approval.
Terminal session state becomes `aborted`; verification execution truth remains `aborted`, never successful.

## Acceptance tests

Focused cancellation/provider battery:
- 23 tests passed, 0 failed.
- Covers in-flight model cancellation.
- Covers pending approval cancellation before a protected write.
- Covers running command cancellation and verifies the child PID is reaped.
- Covers provider caller-abort propagation.
- Covers BYOK caller-abort propagation.
- Covers BYOK hung probe timeout and hung chat timeout.

Architecture/Authority focused battery:
- 39 tests passed, 0 failed.
- OpenAPI drift passes.
- Route Authority coverage passes with 0 conflicts and 0 unclassified routes.

Server timeout test:
- 1 passed, 0 failed.
- Verifies the actual Node HTTP server receives all three configured timeout values.
## Full regression

`npm run check` completed successfully after the implementation:
- 630 tests total
- 619 passed
- 0 failed
- 11 skipped
- TypeScript passed.
- ESLint reported repository-existing warnings only (0 errors).
- Architecture suite passed.
- `git diff --check` passed.

Final full regression after adding the dedicated server-timeout acceptance test: 631 total, 620 passed, 0 failed, 11 skipped. The final closure commit is created only from this green state.

## Truthful closure boundary

C5-11 is satisfied for the supported BYOK/provider execution paths exercised here.
C5-12 is satisfied for Model Hub external fetch hangs and explicit server ingress timeout configuration; it does not claim a universal async-handler cancellation primitive.
C5-15 is satisfied for the current in-memory running agent mission topology: operator cancel reaches model/provider/tool boundaries, revokes pending approval, reaps an owned command tree, and exposes cockpit STOP TASK.

Cross-process mission durability/resume remains C2-11 and is not claimed by this wave.
Global process/network egress remains C4-02 and is not changed.
