# Agent Integrity fixture cleanup candidate

Date: 2026-10-07 UTC

Status: **BOUNDED TEST FIX VERIFIED LOCALLY; ORIGINAL AUTHORITY AUDIT TIMEOUT OPEN**

## Candidate identity

- Worktree: `E:\covert-agent-fixture-cleanup-20261007`
- Branch: `codex/agent-fixture-cleanup-20261007`
- Base and pre-change HEAD: `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c`
- Changed production behavior: none
- Changed test file: `tests/arch/agent-execution-integrity.test.ts`
- Test-file SHA-256 at verification: `5CA615E7A7B406854DA5345FDA14FE744681B5A4BFDCA466B203DC96E030C76F`

## Preserved failure and classification

The original aggregate failure is recorded in `agent-status-authority-audit-timeout-2026-10-04.md`. The `/api/agent/status` request exceeded its existing 30-second facade deadline while the required Authority audit append had not confirmed durable persistence. The exact lower-level filesystem/scheduling cause remains **UNKNOWN**. This candidate does not repair or clear that initial timeout.

The later `/api/agent/start` 409 responses had a separate, directly supported fixture-cleanup cause: the failed selected-skill test restored its renamed fixture but did not cancel or await the still-running agent session. The root `AgentLoop` ownership reservation remains held until the session finalizer settles, so later tests could encounter a busy root slot and shared-bus interference. The test cleanup now cancels through the existing Authority-approved `/api/agent/cancel` route and confirms terminal ownership release before restoring/reusing the workspace. Cleanup failures are combined with the original failure rather than hiding it.

A new regression reaches the governed approval boundary, cancels the session, observes `aborted`, then starts and completes another session in the same workspace. It verifies the root slot is released without bypassing Authority.

## Verification

All commands ran in the isolated candidate worktree against the modified source above.

| Gate | Command / scope | Result |
|---|---|---|
| Diff hygiene | `git diff --check` | exit 0 |
| TypeScript | `node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit` | exit 0; includes `tests/**/*.ts` |
| Focused regression | `node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 --test-name-pattern '(selected skill read failure|governed cancellation cleanup)' tests/arch/agent-execution-integrity.test.ts` | 2 tests, 2 passed, 0 failed, exit 0 |
| Affected architecture file | `node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/agent-execution-integrity.test.ts` | 30 tests, 30 passed, 0 failed, 0 skipped, 0 cancelled; 21.142 seconds; exit 0 |

The retained fixture `arch.log` SHA-256 is `FACF21DD68E2E1A7A0339F57E658BA547A23ECC190C2B528728D568B2CE4A47B`. The fixture is local and is not part of this repository change.

Resource sample near the full-file run: 4.38 GiB free physical RAM; 6.67 GiB free commit; 24.36 GiB commit limit; system drive had 7.05 GiB free and data drive about 73 GiB free. No process was terminated, no model was started, and no pagefile setting was changed.

## Not established by this candidate

- The original durable Authority audit append timeout's lower-level cause.
- Aggregate Windows pre-push status after this candidate.
- Full architecture battery or Veritas after this candidate.
- Exact-SHA GitHub CI for this candidate.
- Any integration or acceptance into the canonical convergence branch.

The original red remains open. This is an isolated test-fixture cleanup candidate only; PR #31 and the canonical worktree were not modified.
