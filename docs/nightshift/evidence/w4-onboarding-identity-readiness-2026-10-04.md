# W4 onboarding identity-bound readiness evidence

Date: 2026-10-04
Worktree: `E:\covert-nightshift-integration`
Branch: `nightshift/production-convergence-20260926`
Base: `7391b98e1e0972dd3fe4365420fe15366b77b24c`
Implementation commit: `2923db8f99b9070a991210e976caef3faf9055af`
Status: **LOCAL VERIFICATION PASS; exact-SHA GitHub CI pending**

## Failure and cause

Before repair, the actual browser component was driven through successful setup validation, then its configured provider identity was changed before the user selected “Save and Complete Setup.” The run returned `STALE_IDENTITY_ACCEPTED`, `providerChanged: true`, and `completed: 1`. The test-first browser regression then failed at `scripts/setup-truth-ui.mjs:213` with `actual: 1`, `expected: 0`.

Cause: readiness represented only the checks from a completed validation run. That run observed provider and model counts, while final completion trusted the old pass and never compared current Model Access, artifact, runtime, provider, or routing identity with the state that had been validated.

## Repair

- Added required `model access identity` and `provider identity` checks. Failure to read either side now yields `UNAVAILABLE`, which cannot establish setup readiness.
- Bound successful validation to a SHA-256 fingerprint of the current Model Manager and BYOK snapshots. The digest remains in setup-session memory; provider endpoint values are hashed separately and are not displayed or persisted.
- Recheck identity while the results screen is open, revoke readiness on an identity change or unavailable recheck, and recheck before saving/completing onboarding.
- Show the completed check details on the results screen so a blocked identity read is visible to the user.
- Kept account secrets, runtime admission floors, routing behavior, and local-model start behavior unchanged.

## Verification

- Failure reproduction before repair: stale provider identity was accepted and onboarding completion ran once.
- `node --test tests/arch/setup-validation-truth.test.ts`: **9 passed, 0 failed**.
- `node scripts/setup-truth-ui.mjs`: **20 PASS assertions**. Covered provider identity change, model/artifact identity change, runtime identity change, unavailable identity reads, readiness revocation, revalidation, and successful completion after revalidation, along with existing setup regressions.
- `npx tsc -p browser/tsconfig.browser.json --noEmit`: **exit 0**.
- `npm run check`: **exit 0**; 984 architecture tests, 973 passed, 0 failed, 11 skipped. TypeScript passed. ESLint reported 0 errors and 62 repository warnings.
- `npm run veritas`: **passed / verified**, score **1.0** against threshold **0.9**; path-boundary, secret-scan, manifest-validation, compile, tests, and git-diff checks all passed.
- Veritas' full test run appended the 2026-10-04 `DC-a battery` **9/9** row in `docs/evidence/desktop-battery.md`; that generated evidence was preserved.
- `git diff --check`: **pass**.

The browser proof uses the existing controlled API fixture and exercises the actual setup component; it does not establish clean-install or packaged-product acceptance. No local model/runtime was started during this work. Local-runtime qualification and gfx900 remain separate, unqualified gates.

## Publication

Exact-SHA GitHub CI for implementation commit `2923db8f99b9070a991210e976caef3faf9055af` is pending publication and will be recorded after the result is observed.
