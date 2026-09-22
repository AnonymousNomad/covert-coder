# P0 REPAIR — Release evidence gate now requires an affirmative pass

Status: REPAIRED + VERIFIED (second P0 closure)
Date: 2026-09-22 · Lane: `audit/wiring-ledger` · Target: `covert-production` @ `8ea6c8b`

## Source finding
`workflow-service.ts` release gate blocked only on explicit failure indicators; `inspectVeritasEvidence` (`workflow-validators.ts`) computed `failed` from failure markers only. A record with `verification.state = 'abstain' | 'incomplete' | 'unavailable'` — or a fabricated record with a matching `session_id` and no failure fields — satisfied `RELEASE_EVIDENCE`.

## Reproduction (BEFORE, in production's own test)
`tests/arch/workflow-service.test.ts:276-278` (at `8ea6c8b`) asserted exactly this:
```ts
await writeVerification(env.workspace, sessionId, { outcome: 'done', verification: { execution: 'succeeded', state: 'unavailable' } });
assert.deepEqual(await env.service.evaluateTransition(built.state, request), { result: 'satisfied', failed: [] });
assert.equal((await applyRequest(env, request)).stage, 'DEPLOYMENT');
```
A non-passed (`unavailable`) verification record advanced the workflow to DEPLOYMENT. This test was green in production CI — the violation was encoded as expected behavior.

## Observed consequence
The release transition (VALIDATION → DEPLOYMENT) could be satisfied by evidence that proves nothing (abstain/incomplete/fabricated), while the record format is unauthenticated JSON.

## Owner
- `node/src/services/workflow-validators.ts` (`inspectVeritasEvidence`)
- `node/src/services/workflow-service.ts` (RELEASE_EVIDENCE gate branch)

## Bounded repair (fail-closed, no redesign)
1. `VeritasEvidenceInspection` gains `passed: boolean` — affirmative only: `verification.passed === true` or `state === 'passed'` or `verdict.status === 'passed'`.
2. Gate: `if (!inspection.passed) { reason ??= 'veritas_not_passed:RELEASE_EVIDENCE'; continue; }`.
3. Production test corrected: the success fixture now uses an affirmative record (`state:'passed', passed:true`); a new abstain case asserts `veritas_not_passed:RELEASE_EVIDENCE` blocks the transition and state stays at VALIDATION.

## Same reproduction blocked (AFTER)
`tests/arch/workflow-service.test.ts` — the corrected test now proves, in order:
- failed record → `veritas_failed` (unchanged),
- **abstain record → `veritas_not_passed` + GATE_UNSATISFIED + stage stays VALIDATION (NEW)**,
- affirmative record → satisfied → DEPLOYMENT.

## Regression
- `workflow-service.test.ts` + `workflow-validators.test.ts`: 23/23 PASS.
- `workflow-routes` + `workflow-contracts` + `resident-workflow` + `workflow-authority`: 52/52 PASS.
- `tsc -p tsconfig.node.json`: 0.

## Notes
- The structural validator layer (`validateArtifactRef`) is intentionally unchanged: it owns existence/parse/session-match; the verdict is the gate's job (correct separation preserved).
- Operator adjudication remains possible by re-running verification to an affirmative pass; there is no override that fabricates one.
