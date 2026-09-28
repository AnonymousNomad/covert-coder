# Model Access foundation checkpoint — 2026-09-28

## Scope

Recovered the local interrupted Model Access slice in `E:/covert-nightshift-integration` on `nightshift/production-convergence-20260926`. The pre-change base and upstream were both `1dca0c51703ef800a6c2733ded9a2b1045d8bda6`. The recovery copy at `E:/covert-model-access-wip-20260928` remains preserved.

This closes the local implementation and verification portion of P0/P1. It is not yet the phase exit: the coherent checkpoint still needs a commit, push and exact-SHA GitHub CI.

## Implemented

- Strict Model Access contracts and a passive, secret-free `GET /api/models/manager` projection.
- Separate identities for logical models, artifact/source, provider routes, credential sources, execution adapters, runtime state and qualification.
- Bounded local artifact discovery and freshness checks. Artifact presence, provider health and stored credentials do not independently imply verified model support or readiness.
- Read-only selection policy that does not mutate preferences or alter execution routing.
- Connection test-request bounds that accept the 68-character `api:` plus maximum-length BYOK provider ID.
- Regenerated OpenAPI, facade route map and C1-02 ownership decisions; added and registered the focused failure skills.

## Verification

| Check | Result |
|---|---|
| Focused Model Access + Connections tests | 13/13 passed |
| `npm run contracts` | Passed; 238 documented operations |
| Facade map generation | Passed |
| C1-02 route decision generation | Passed |
| `npm run check:arch` | Passed: 795 total, 784 passed, 0 failed, 11 documented skips |
| Supervised paired facade `GET /api/models/manager` | HTTP 200; valid envelope; `public_safe: true`; canonical runtime `unsloth`; 18 inventory entries |
| `git diff --check` | Passed |

## Follow-up verification — 2026-09-28 15:38 -05:00

The prior Veritas run stopped at the staged desktop smoke because its test launcher omitted the native parent's required bootstrap arguments. After tracing the Tauri pairing flow, the smoke was updated to use an approved packaged origin, perform the one-time pairing exchange, assert the unpaired model route returns 403 and the paired route returns a valid 200 response, and exercise both TS and legacy routes through the facade. Pairing proof and session credentials stay in memory and are not logged or written. The smoke now chooses temporary ports, captures bounded child logs on failure, and verifies process/listener cleanup before removing its workspace.

| Check | Result |
|---|---|
| `npm run desktop:prepare` | Passed; staged from current source. Optional legacy bootstrap GGUF was absent and not claimed. |
| `node scripts/desktop-staged-smoke.mjs` | Passed 10/10 checks on the freshly rebuilt staged tree; pairing, protected model read, TS and legacy routes, fail-closed unknown route, and cleanup all observed. |
| `npm run check` | Passed; TypeScript and ESLint had 0 errors (62 existing warnings); architecture battery 795 total, 784 passed, 0 failed, 11 documented skips. |
| `npm test` | Passed, including REAL AIDE and P0 acceptance, Desktop battery 9/9, staged smoke 10/10, grammar battery 5/5, and final end-to-end smoke. |
| `npm run veritas -- --json --output artifacts/veritas-model-access-2026-09-28.json` | Passed all six checks; Veritas `verified`, score 1.0/1.0, no failed checks. |
| Issue #38 | Checked after the verification change; open, no comments. |

Veritas output is recorded in `artifacts/veritas-model-access-2026-09-28.json`. A post-run scan found no pairing-proof, bearer-token, or GitHub-token pattern in that report. No staged-stack process or listener remained after the smoke. This remains local source/runtime verification; the checkpoint commit, push, exact-SHA GitHub CI, live OpenCode Go/DeepSeek execution, user acceptance, and release gates are still open.

The architecture command includes Node TypeScript, browser TypeScript, ESLint and the full architecture battery. The 11 skips are existing explicit skips, including absent bundled GGUF artifacts and migration-waived assertions.

## Limits and next phase

The supervised facade probe proves only the endpoint and its safe projection. It does not prove a runtime/model is live or ready. Provider lifecycle ownership, cancellation and cleanup remain open for P2. Live OpenCode Go → DeepSeek V4.1 Flash execution, Mission Receipt acceptance, first-user/browser acceptance, CP01–CP18 and package/release gates also remain open.

Next: commit and push this coherent state, obtain CI on the exact SHA, then proceed to P2 Provider adapter lifecycle correctness. Machine-readable details are in [model-access-foundation-2026-09-28.json](model-access-foundation-2026-09-28.json); the Veritas check output is in `artifacts/veritas-model-access-2026-09-28.json`.
