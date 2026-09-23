# Harness Crown-Jewel Review Base

## Review identity

| Field | Value |
|---|---|
| Review branch | `review/harness-crown-jewel-vnext` |
| Review worktree | `E:\aide-harness-crown-jewel-review` |
| Review base | `dc0d30ee226e7ff822592e3a800f064b4441b7af` |
| Base meaning | Immutable certified source candidate |
| Review date | 2026-09-23 |
| Production semantics changed | No |
| Implementation authorized | No |

The review was created from the certified candidate itself. The dirty
`resident/marathon-h1` checkout and source-assembly worktree were not used as
the review base. PR #31 was inspected read-only and was not merged.

## Evidence rule

This review separates three facts that must not be conflated:

1. **Present and wired** — code reachable from the certified candidate's
   production composition root.
2. **Present but shadow/test-only** — code in the candidate that is not on the
   live execution path.
3. **Historical or future work** — code reachable from Git history or another
   branch but absent from the certified candidate.

The H1 execution-transaction work (`f2136f8`, `503c813`, `13f2388`) and H2
ownership work (`5abb1e0`, `11b5dec`) are in the `work/astra-crown-jewel`
history, not in the ancestry of this review base. They therefore cannot be
credited as shipped Harness behavior.

## Verification performed

The following candidate-independent checks passed on this worktree:

```text
node --test harness/test-veritas.mjs harness/test-orchestrator.mjs
  2 tests, 2 passed, 0 failed

node --check harness/orchestrator.mjs
node --check harness/sandbox.mjs
node --check harness/veritas.mjs
node --check node/src/services/agent-loop.mjs
node --check node/src/services/agent-tools.mjs
node --check node/src/services/execution-authority.mjs
  all passed

git diff --check
  passed at review start
```

The review worktree did not contain `node_modules`; the full dependency-backed
test battery was not claimed or run here. No model engine, server, or foreign
process was started by this review.

## Primary evidence anchors

- Live composition: `node/src/openapi.ts:438-600`, `node/src/openapi.ts:641-724`
- Live agent lifecycle: `node/src/services/agent-loop.mjs:246-900`
- Tool boundary: `node/src/services/agent-tools.mjs:232-500`
- HTTP Authority: `node/src/server.ts:122-242`
- Operation Authority: `node/src/services/execution-authority.mjs:226-315`
- Resource check: `common/contracts/admission.ts:3-35`, `node/src/services/resource-admission.ts:56-99`
- Provenance and receipt: `common/contracts/provenance.ts:3-65`, `node/src/services/provenance-ledger.ts:47-116`
- Handoff/continuation: `common/contracts/worker-handoff.ts:39-103`, `node/src/services/continuation-manager.ts:139-225`
- Legacy/shadow Harness: `harness/README.md`, `harness/orchestrator.mjs`, `harness/sandbox.mjs`, `harness/veritas.mjs`
- Existing prior audit: `docs/audit/intelligence-spine/HARNESS_AUDIT.md`, `docs/audit/intelligence-spine/ORCHESTRATOR_AUDIT.md`, `docs/audit/intelligence-spine/PROVENANCE_AUDIT.md`
- Resident cross-model evidence, read-only from PR #31: `origin/resident/marathon-h1:experiments/resident-specialization/RESIDENT-CROSS-CANDIDATE-MATRIX.md`, `origin/resident/marathon-h1:experiments/resident-specialization/RESIDENT-SYSTEM-GAP-ANALYSIS.md`
