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

## Subsequent regression infrastructure and closure foundation

Truth checkpoint `4cf80d95a71de917735be91862ae796ce5deb9ed` was pushed clean
after the actual versioned full pre-push gate: 869 tests, 858 passed, 0 failed,
11 skipped, about 705 seconds. Exact-SHA AIDE CI `36852046339` passed all 22
steps, including architecture, Veritas, worktree and fixture cleanup.

That full run also emitted a logger ENOENT warning after the subagent fixture
reported success. Source inspection found its queued Logger writes were not
drained before removing the temporary workspace. The fixture now retains the
exact server owner, flushes logging before removal, asserts the cleanup marker,
and confirms no late logger errors or recreated workspace. This repairs test
lifecycle ordering; production logger behavior is unchanged. The focused
fixture passed without the warning. A failure SOP was saved and loaded at
`C:\Users\Grey_\.agents\skills\failure-fixture-logger-drain\SKILL.md`.

The provider availability predicate additionally requires an execution adapter
and no remaining operator setup. The stale read-only terminal copy now points
to the real approved interactive panel while marking its keyboard shortcut
unwired. Six provider tests and 16 browser scenarios pass. A dedicated required
CI step now runs the browser regression on Chromium; local proof used Edge.

The closure extension preserves the existing historical ledger and seeds 12
bounded rows. Seven historically qualified required surfaces are missing or
incompletely exposed. The actual release CLI exits BLOCKED; schema validation
explicitly makes no release acceptance claim. Seven schema/state/CLI tests
pass, including required-deferral, missing evidence and exact-SHA rejection.
Plans, dependency order and limits are recorded in the separate integration
plan. No themes, docking, Model Packs or advisory runtime was implemented.

## Integration boundary

Final review at `022790e` found a remaining provider refresh race in
`advance()`: stage-four BYOK success/error assignments were not guarded after
the await. A controlled delayed response reproduced old consent enabled
overwriting the reopened session's consent disabled status. The full pre-push
was deliberately stopped before upload; its exact owned tree was verified dead
and origin remained `4cf80d9`. That interrupted run is not a full-gate pass.
The repair guards both post-await branches by open/session identity. Eighteen
browser scenarios now pass, including abandoned success and rejected reads.
The failed reproduction log remains at `E:\pip_temp\sol61-provider-race-before.log`;
the researched procedure is `failure-setup-session-provider-race`.

Luna owns packaging/bootstrap closure. Apply the isolated truth commits only
after reconciling against the then-current convergence SHA. Re-run required
checks and CI at that SHA; no isolated evidence can promote the release.

## Checkpoint disposition

Final code checkpoint `4e1c85f3b1881102ff7e7e1dc37630e232e17f1a` is pushed
clean with local/origin parity. The repaired full Windows versioned pre-push
gate passed **876 total / 865 passed / 0 failed / 11 skipped** in 768.811 seconds.
No logger write-failure warning was present. The full log is
`E:\pip_temp\sol61-repaired-full-push.log`, SHA-256
`7131aac3098690427c0e8300e7d30b2a93f857cd21d8667f5d5f915e1a597dde`.
Final browser regression passed 18 scenarios; both TypeScript checks, scoped
ESLint, syntax and frontend build passed. No matching owned verification
process remained after completion; observed pre-existing Node and Edge process
identities remained untouched. CI `36856924786` is pending at this entry.

Issue #38 checkpoint: comment `5930610507`. The GitHub plugin was callable and
used for review reads and this authorized checkpoint; no additional plugin was
needed. The optional review bridge was not exposed in this session.

The push reported existing moderate Dependabot alert #1. API readback and the
lockfile confirm `desktop/Cargo.lock` has glib 0.18.5 and advisory
GHSA-wrw7-89jp-8q8g reports a fix at 0.20.0. Candidate/platform exposure remains
unverified. No packaging dependency change was made; this is a packaging-owner
security-triage input, not evidence that Windows is affected.

- CAPABILITIES ADDED: none canonical; F01/F02/F03 repairs, required browser
  regressions and capability-closure foundation prepared in isolation.
- CAPABILITIES LOST: none removed by this slice; seven bounded historical
  qualification/exposure gaps are recorded as capability drift.
- CAPABILITIES STILL ISOLATED: all truth repairs and closure infrastructure;
  historical theme, terminal presentation and four Model Manager surfaces.
- PRODUCT-TRUTH FAILURES: F01/F02/F03 remain open at the assessed canonical
  source until selective integration and current-candidate verification.
- DOGFOOD FINDINGS: no live product dogfood in this isolated fixture unit.
- RELEASE BLOCKERS: native Windows bootstrap EOF, truth repairs not converged,
  live route/installed mission acceptance and remaining RC gates.
- EVIDENCE: first pushed checkpoint `4cf80d9`, full architecture 858/0/11,
  exact-SHA CI `36852046339` (22/22). Subsequent focused tests passed 27/27,
  browser regressions now 18 scenarios; type/lint/build/diff checks passed.
  Final full gate passed 865/0/11; final exact-SHA CI is pending at this entry.

## Sol integration handoff

Final code CI receipt: [AIDE CI 36856924786](https://github.com/AnonymousNomad/covert-coder/actions/runs/36856924786)
completed SUCCESS on exact `4e1c85f3b1881102ff7e7e1dc37630e232e17f1a`;
all 23 steps passed. Captured logs confirm all 18 Chromium browser scenarios,
Veritas exit 0, and all required gate outcomes success. No rerun was requested.
Machine-readable bounded evidence: `SOL61-VERIFICATION-2026-10-01.json`.
The earlier pending entries above preserve chronology; this result supersedes
their CI status without changing their evidence scope.

SOURCE: canonical `nightshift/production-convergence-20260926` at
`fc263fe26f364b5c972be79a8ac6e651a671dcd0`.

FINAL CODE: isolated `audit/sol61-product-closure-20261001` at
`4e1c85f3b1881102ff7e7e1dc37630e232e17f1a`. The documentation receipt is a
subsequent bounded checkpoint; its final HEAD/CI is recorded through Issue #38.

REPAIRS COMPLETED IN ISOLATION: F01 completed-current-run validation; F02
required preference writes, resumability and provisioning copy; F03 unknown
provider state and explicit routing semantics; abandoned provider reads;
truthful terminal shortcut copy; fixture logger cleanup ordering.

REGRESSIONS ADDED: state-machine/profile/cloud/closure tests, 18 browser
scenarios, required Chromium CI, and logger-drain teardown assertions.
Success/failure/unavailable/stale paths are distinct; no assertion was weakened.

CAPABILITIES RECOVERED: integration-ready truth semantics and a partial
machine-readable closure gate. Historical UI capabilities have selective
integration plans; none was restored into canonical by this lane.

CAPABILITY DRIFT: Original, Matrix, terminal presentation, Model Packs,
Developer Notes, System Advisories and Developer Specials have bounded
historical evidence but absent/incomplete exposure at the assessed canonical
SHA. Beskar has a separate design requirement; Resident docking is partial.

COMMITS / LUNA INTEGRATION ORDER:

| SHA | Stronger invariant |
| --- | --- |
| `e82c4ee609247466fda55a78114791b8a6308bee` | Required validation must complete in the current run. |
| `77987bc38c8480109828e84ee2d3a80239fbc8c8` | Failed status read never implies LOCAL ONLY. |
| `4cf80d95a71de917735be91862ae796ce5deb9ed` | Required persisted choices gate setup completion. |
| `d084200b7756e11afacb5766ea83384edd3d84a5` | Fixture logging drains before deleting its workspace. |
| `b9e8b0428aadd90066a6883ef4a5687f109ce108` | Remote availability requires adapter/setup evidence; browser regressions are mandatory CI. |
| `022790e73a134b9f486a559dc311ac20c294512c` | Required capability drift and missing current evidence block the ledger gate. |
| `4e1c85f3b1881102ff7e7e1dc37630e232e17f1a` | Abandoned provider success/error cannot overwrite a reopened dialog. |

Apply only after Luna's earned packaging checkpoint and fresh reconciliation.
Preserve both lanes' journals, then reprove the convergence SHA. See the
selective capability integration plan for owner/path-specific recovery work.

TEST EVIDENCE: commands/results and reproduction/root-cause history above;
full architecture 865/0/11, focused tests 27/27, browser 18 scenarios,
TypeScript/scoped ESLint/syntax/frontend build passed. Eight local skips need
bundled GGUFs absent from this checkout; three are existing migration waivers.

OPEN BLOCKERS: native packaging/bootstrap EOF at the assessed source;
unintegrated truth repairs; incomplete closure inventory and required drift;
real installed provider/model/Resident coding mission and recovery acceptance.
The glib alert is a separate security-triage input with unverified platform
exposure, not a demonstrated Windows runtime defect.

PRODUCT DECISIONS NEEDED: none for these isolated repairs. Future Beskar
identity/emblem approval, if unavailable at implementation time, belongs to
that future capability unit; this work creates no new owner approval gate.

DO NOT CLAIM: canonical repair completion, provider/model qualification,
installed acceptance, live coding/dogfood, restored themes/MM9/docking,
security clearance, full release-gate certification or RC readiness.
