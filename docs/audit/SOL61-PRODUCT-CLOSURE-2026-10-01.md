# Sol 6.1 product closure — isolated integration evidence

Source: canonical `nightshift/production-convergence-20260926`, exact
`fc263fe26f364b5c972be79a8ac6e651a671dcd0` (clean; AIDE CI `36846897996` success).
Worktree: `E:\covert-sol61-product-closure`.
Branch: `audit/sol61-product-closure-20261001`.
Canonical worktree and frozen PR #31 are untouched.

## F01 — setup readiness

Before repair, `node scripts/setup-truth-ui.mjs --reproduce` exercised the actual
setup component in headless Edge with controlled API results. A daemon read
failed, yet stage 10 claimed CORE VALIDATION PASSED before validation and stage
11 claimed YOUR WORKFLOW IS READY after failure. The command exited 0 because
it asserted this original defect, not because setup was healthy.

Root cause: `.every()` over empty checks produced a pass during render;
validation populated results later; the final page reused cached `ready`.

Repair: explicit NOT_RUN/RUNNING/PASSED/FAILED/UNAVAILABLE run state, complete
required-check identity set, invalidation on navigation/reopen/rerun, rejection
of abandoned completions, and controls disabled during pending operations.
Daemon reachability alone no longer passes a non-HEALTHY health verdict.
Final copy states CORE VALIDATION PASSED rather than implying that an
unpersisted profile or unqualified model route is ready.

Local evidence:

- `node --experimental-strip-types --test tests/arch/setup-validation-truth.test.ts`: 8/8 passed.
- `node scripts/setup-truth-ui.mjs`: six browser assertions passed, including
  unavailable, unhealthy, all-pass, back/forward, rerun, pending and abandoned
  session behaviors (some assertions exercise multiple transitions).
- Node and browser TypeScript checks passed.
- Scoped ESLint passed.
- Frontend production build passed (existing bundle-size advisory remains).

These are isolated state/component/build proofs. They do not establish
canonical convergence, live provider use, dogfood or installed acceptance.

## Integration boundary

Luna owns packaging/bootstrap closure. Apply the isolated truth commits only
after reconciling against the then-current convergence SHA. Re-run required
checks and CI at that SHA; no isolated evidence can promote the release.

## Checkpoint disposition

- CAPABILITIES ADDED: none canonical; setup truth repair prepared in isolation.
- CAPABILITIES LOST: none removed by this slice; historical drift audit pending.
- CAPABILITIES STILL ISOLATED: this F01 repair.
- PRODUCT-TRUTH FAILURES: F02 persistence/provisioning and F03 failed status
  read remain open at canonical source; F01 canonical repair pending integration.
- DOGFOOD FINDINGS: no live product dogfood in this isolated fixture unit.
- RELEASE BLOCKERS: native Windows bootstrap EOF, truth repairs not converged,
  live route/installed mission acceptance and remaining RC gates.
- EVIDENCE: commands above; exact repair SHA and CI will be recorded at handoff.
