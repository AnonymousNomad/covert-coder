# Agent status timeout while Authority audit persistence is pending

Date: 2026-10-04

Worktree: `E:\covert-nightshift-integration`

Branch: `nightshift/production-convergence-20260926`

Diagnostic HEAD: `1af98c8050c8261d91328fbf1124305c9aa0362e`

Upstream HEAD at diagnosis: `ca8527e565b62326fd940f574d9964413e3c6751`
Status: **ORIGINAL RED PRESERVED; required audit-persistence boundary identified; lower-level Windows cause UNKNOWN**

## Preserved aggregate failure

- Original full pre-push log: `E:\pip_temp\covert-full-pre-push-20261004.log`; SHA-256 `E5B2061BAF0DE6FF82E18AD71DF17FF46D7BE591C713AF2EC0F252F4D6AD801D`.
- `GET /api/agent/status` ended as facade `ts 502` at **30,010 ms** while `selected skill read failure stops production inference and records context failure` took **53,888 ms**.
- The next two tests' `/api/agent/start` requests returned **409** because the preceding root agent session still owned the loop. Those failures followed the first timeout.
- Retained fixture workspace: `E:\pip_temp\aide-integrity-Crp6ZW`. Its `arch.log` records the timed-out status route as `NOT_READY: authorization audit was not durably recorded` at `2026-10-04T13:14:45.123Z`.
- The corresponding `.aide/cipher-state.jsonl` and attempt journal show a gap while the selected-skill session was finalizing. The attempt journal records `AUTHORITY_GRANTED` at `13:13:54.789Z` and `VERIFICATION_STARTED` at `13:14:45.285Z`. No durable success receipt exists for the failed status audit operation.

## Boundary and cause classification

The facade's **30-second client deadline** is unchanged. The status route is protected by the canonical Authority path. A read request first durably records an Authority proposal; `createExecutionAuthority.required()` fails closed if the audit recorder does not report `persisted: true`. The fixture's audit recorder calls `createStateBus.append()`, which performs `mkdir → open → write → sync → close` and collapses a filesystem error into `persisted: false`.

The retained server log therefore establishes the direct failure boundary: the TS request was awaiting a required Authority audit record and could not confirm durable persistence. The facade observed its existing client deadline, then the TS server surfaced `NOT_READY`. This was not an in-memory `AgentLoop.status()` lookup failure. The evidence does **not** distinguish which filesystem step delayed or failed, or whether Windows scheduling, storage, or concurrent sync activity caused it. Lower-level cause remains **UNKNOWN**.

The later `409` responses are a fixture-isolation cascade: `activeStart` is released only after the owned `runSession()` finalizer settles, while the failed test's `finally` restores the renamed skill but does not cancel or await the still-running session. This explains the later conflicts, not the first 30-second wait.

This Agent status/Authority persistence event is distinct from the preserved aggregate `/api/model/ready` and `/api/workspace/tree` incidents in [the Windows E2E blocker evidence](windows-e2e-model-ready-timeout-2026-10-04.md). It does not replace or clear those failures.

## Focused regression observation

Ran the affected architecture file with the repository's canonical Windows close shim and original deadlines/assertions:

```powershell
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/agent-execution-integrity.test.ts
```

- Result: **29 tests, 29 passed, 0 failed**, exit 0, **32.68 seconds**.
- Output: `E:\pip_temp\covert-agent-execution-integrity-full-20261004.log`; SHA-256 `1E51C3570311652DF17F0198C9D133A158C62DB00C74171FA37D46570650E9D1`.
- The selected-skill case passed in **1,159 ms**; subsequent verification-rejection and evidence-persistence cases also passed. The file run is diagnostic only and does not clear the aggregate red.
- Before this run, free RAM/commit measured **8.47/6.33 GiB**; after it, **7.81/6.55 GiB**. No app was closed, no process was terminated, no model was started, and pagefile settings were unchanged.

## Next diagnostic

Run the canonical serial Windows gate while collecting non-invasive host resource and disk latency samples. If the audit append stalls again, capture its exact filesystem operation without logging event contents or weakening Authority, deadlines, assertions, or cleanup guarantees. Separately repair the test's failure-path session cleanup only after a focused regression demonstrates that it cancels through the governed route and waits for terminal ownership release while preserving the original failure.
