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

## F03 — provider status truth

Canonical source maps a rejected `byokStatus()` to LOCAL_ONLY; the initial
store and topbar also advertise LOCAL ONLY before any read. The repair starts
CHECKING, composes successful canonical BYOK and Connections observations,
and displays STATUS_UNAVAILABLE on either read failure. It uses LOCAL_ONLY
only for the explicit canonical routing preference. Consent off, missing
authentication, configuration without verification, observed unavailable
configured connections, and an available verified route have separate states.
A route requires connected status, authentication, healthy runtime/provider,
routing permission, ready setup and verified exact model support to claim
availability. This does not certify a live mission.

The reader revokes old observations before each refresh, rejects out-of-order
results and suppresses publication after disposal. The topbar refreshes every
30 seconds and releases the timer on pagehide; no old success is retained on
read failure. Six transition tests and the actual topbar's browser failure
label passed. Both TypeScript checks and scoped ESLint passed. The existing
Connections service can itself degrade some internal read errors; this slice
does not infer universal provider absence from that view.

## F02 — persistence and provisioning truth

`node scripts/setup-truth-ui.mjs --reproduce-persistence` loads the original
`fc263fe` component from Git into an in-memory Vite module (no worktree rewrite).
In Edge, a rejected onboarding write still advanced past approval; the final
save control was hidden, leaving zero profile writes. This is direct bounded
UI reproduction of the original defect, not live daemon evidence.

The repair saves a validated version-2 draft through the existing approved
file-write API, keeps approval open after failed required writes, and reads
canonical onboarding choices before retrying so a successful choice write is
not repeated just because the profile save failed. Required validation now
includes recorded role/workbench choices and an exact current preference
match. A visible completion action requires validation, saves preferences,
calls canonical onboarding completion, then persists the completion timestamp.
Every failure remains visible and unresolved; no exception becomes success.

All eight interview-choice categories explicitly state SAVED AS PREFERENCE
after successful persistence, or DEFERRED before that. No choice claims
account connection, routing/consent, download, qualification, policy change,
repository import, workflow creation or integration provisioning. Role and
workbench are recorded onboarding preferences; no workbench installation is
performed. Recommendations remain advisory. Multiple checkbox choices no
longer overwrite earlier selections through a stale closure.

Drafts resume after approval or at validation; historical completion timestamps
never restore a current pass. Existing v1 profiles migrate as preferences.
Malformed/unavailable profiles cannot establish readiness. An unavailable
saved model recommendation is retained by identity rather than substituted.
Late session results cannot mutate a reopened session's status/selection.

Local proof: 15 actual browser scenarios passed across F01/F02/F03; five
profile tests passed; the affected onboarding/state/profile/cloud set passed
24/24. Both TypeScript checks, scoped ESLint and frontend build passed. One
unused local in the new profile test initially produced a lint warning and
was removed. Final broad architecture/Veritas CI remains pending.

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
