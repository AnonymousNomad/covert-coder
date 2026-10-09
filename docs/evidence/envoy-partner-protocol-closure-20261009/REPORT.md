# Partner Protocol / Security Foundation — Closure Packet

## Status

**Local protocol/security candidate: PARTIAL.** The bounded same-workstation tests, dependency bootstrap, generated-contract checks, and C:-side regressions are green. The three test-only commits are on the C: feature branch; final publication is recorded only after remote read-back.

**Partner V1 release: BLOCKED.** Physical Android pairing/revocation, an actual same-LAN device, the mobile UI, production projections, and runtime/mobile packaging remain unproven. This report does not claim V1 complete.

**Governed execution: `BLOCKED_EXTERNAL_DEPENDENCY` (unchanged).** These tests do not prove a real worker execution.

## Source and recovery

- Active repository: `C:/CovertPartnerProtocol-recovered-20261008`
- Branch: `feat/envoy-partner-protocol-luna-20261008`
- Reviewed P2 base: `682a42114450c4f7caf84e45ccdc601481dfb374`
- Partner implementation base: `70420efe26ca31ed41a889c9c2de4c76e026ba43`
- Recovered implementation commit: `5acbb66a63bc4d7baf5b2f848fc91bba3de8a85c`
- Preserved recovered HEAD: `aba338cb05f8f1b7b77fb897922d61c2c185e310`
- Latest test/source checkpoint before this evidence commit: `ecb026fc4d4b129a35f4e0ad944a7534e0630fab`
- Git directory and common Git directory resolve to `C:/CovertPartnerProtocol-recovered-20261008/.git`; the C: repository is standalone.
- The bundle is retained at `C:/CovertRecovery-envoy-partner-protocol-20261008/partner-lane.bundle`. On C:, `cat-file` read the base, implementation, and HEAD commits; the HEAD tree and representative blob were readable; `git fsck --full --strict --no-reflogs` exited 0.
- The branch was first pushed normally at the exact recovered HEAD. At this report's preparation point, the later test and evidence commits are local; their publication and exact remote read-back are recorded in the operator handoff.

The original E: worktree and shared Git store were used as a read-only recovery source. No Git mutation was made to that store. E: remains suspect and was not repaired.

## Work completed

No Partner production service, contract, route, Authority behavior, Resource Admission policy, or UI code changed in this closure pass.

Test-only changes:

- `tests/arch/partner-protocol-security.test.ts`: covers concurrent one-use pairing, duplicate pending/active keys, re-pair behavior after revocation, Partner principals being rejected by Authority control, malformed payload handling, wrong pairing key, wrong device ID in request proof, corrupt registry fail-closed behavior, listener startup isolation, and peer CIDR enforcement.
- `tests/arch/capability-authority.test.ts`: replaces a Windows `E:/pip_temp` fixture root with `os.tmpdir()` and removes its own fixture after process/server shutdown.

Commits created:

- `5f51e960ca68ec270028fd8f197c01f9c959aa5b` — `test(partner): close pairing security matrix`
- `9f3625c4596441eadb3b32e3e71300f5ec0db689` — `test(authority): use isolated temp fixture paths`
- `ecb026fc4d4b129a35f4e0ad944a7534e0630fab` — `test(partner): reject mismatched device proofs`

The evidence commit contains this report and the saved logs. No R9 or README policy edit was made.

## Dependency and bootstrap

- Command: `npm ci --no-audit --no-fund --cache C:/CovertPartnerProtocol-npm-cache-20261009`
- Result: exit 0; the preserved npm debug log is `npm-ci-final.debug.log`. It records the normal locked install and a registry HTTP 200 fetch for `zod-4.6.5.tgz`.
- `package.json` requires `zod` at `^4.6.5`; `package-lock.json` pins `4.6.5` to the registry tarball with the recorded integrity value. `npm ls zod --depth=0` reports `zod@4.6.5`.
- The package-lock SHA-256 remained `655A77AA57CB701F8E762B4D7E3D6C89406DEFA07D4739D8093CF99F22E193A3`.
- No repository `.npmrc` forces offline mode. Network-backed `npm ci` used the C: cache, matching the explicit dependency-install authorization.
- The successful npm log contains no `EPERM` or cleanup failure. The earlier offline-cache failure and EPERM mention are not present in the preserved C-side install logs, so their exact earlier cause is **not proven**. The successful locked install, `npm ls`, typecheck, and test suites did not reproduce an install defect.
- npm warned that `node-pty@1.1.0` install/postinstall scripts were not approved by the existing allow-scripts policy. Those scripts were not run. The Partner verification here does not qualify the native PTY package.

## Preserved failures and recovery

- The first strict TypeScript run failed with TS2532 on indexed `Promise.allSettled` results. The one-success/one-conflict assertions were retained and explicit result narrowing fixed the test. `node-typecheck-after-device-proof.log` records the passing rerun; the original red remains in `node-typecheck-final.log`.
- The earlier offline dependency attempt lacked the `zod@4.6.5` tarball. The locked online `npm ci` fetched the exact registry artifact, exited 0, and left the lockfile unchanged.
- The exact earlier `EPERM` output is not present in preserved C-side npm logs. It was not reproduced by the successful install. Its cause remains unknown rather than being labeled cleanup noise.

## Resource Admission

The latest canonical decision before the final Partner/core test rerun was `START` at `2026-10-09T04:52:35.459Z`, recorded in `admission-before-device-proof-rerun.json`:

- free physical memory: 6,231 MiB; required floor: 3,072 MiB
- free commit: 7,611 MiB; required strict floor: greater than 5,120 MiB
- free VRAM observed: 5,201 MiB

This is a test-workload admission observation. No governed local worker was launched.

## Verification results

All final test commands were run from the C: repository with process-local `TEMP`, `TMP`, and `TMPDIR` set to `C:/CovertPartnerProtocol-temp-20261009`; each Node test command checked `os.tmpdir()` before execution.

| Scope | Result | Evidence |
|---|---:|---|
| Partner protocol + private platform state | 11 passed, 0 failed, 0 skipped | `partner-private-state-final-green.log` |
| Authority / P1 / P2 / Partner | 70 passed, 0 failed, 0 skipped | `core-regressions-final-green.log` |
| Capability Authority focused file | 12 passed, 0 failed, 0 skipped | `capability-authority-c-temp.log` |
| Connections / egress / Model Access / Local-Only | 88 passed, 0 failed, 0 skipped | `egress-regressions-c-temp.log` |
| Route drift | 5 passed, 0 failed, 0 skipped | `route-drift-final.log` |
| Node TypeScript | exit 0 | `node-typecheck-after-device-proof.log` |
| Touched-surface ESLint | exit 0 | `eslint-touched-after-device-proof.log` |
| Contract generation | exit 0; OpenAPI 1,228,390 bytes, 253 operations | `openapi-generation-final.log` |
| Facade route map check | up to date | `facade-map-final.log` |
| C1-02 route ownership check | up to date | `route-ownership-final.log` |
| JavaScript syntax checks | 3 files exit 0 | `syntax-diff-final.log` |
| `git diff --check` | exit 0 | `syntax-diff-final.log` |

The 26 raw command logs referenced by this packet are preserved byte-for-byte in `verification-logs.zip`. The archive entries were SHA-256 compared with their C:-side source files before packaging; `verification-logs-manifest.json` records the hashes and archive digest.

Exact principal regression commands:

```text
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/partner-protocol-security.test.ts tests/arch/project-private-state.test.ts
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/execution-authority.test.ts tests/arch/capability-authority.test.ts tests/arch/local-only-authority.test.ts tests/arch/route-authority-coverage.test.ts tests/arch/openapi-drift.test.ts tests/arch/events-contract.test.ts tests/arch/chat-authority-security.test.ts tests/arch/project-private-state.test.ts tests/arch/state-persistence-atomicity.test.ts tests/arch/governed-execution-spine.test.ts tests/arch/partner-protocol-security.test.ts
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/connections-routes.test.ts tests/arch/model-access.test.ts tests/arch/agent-worker-binding.test.ts tests/arch/modelhub-routes.test.ts tests/arch/providers.test.ts tests/arch/telegram-egress.test.mjs tests/arch/workbench-routes.test.ts tests/arch/egress-manifest.test.ts tests/arch/cloud-status-truth.test.ts tests/arch/local-only-runtime-endpoint.test.ts
node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/route-drift.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit
node node_modules/eslint/bin/eslint.js tests/arch/partner-protocol-security.test.ts tests/arch/capability-authority.test.ts
node scripts/contracts.mjs
node scripts/build-facade-map.mjs --check
node scripts/build-c1-02-route-ownership-decisions.mjs --check
node --check common/security/partner-proof.mjs
node --check node/src/services/partner-device-store.mjs
node --check node/src/services/execution-authority.mjs
```

The egress command uses the discovered repository file `telegram-egress.test.mjs`; the prior foundation report spells this as a nonexistent `.ts` path. Its preserved reference log has 86 passing tests. The current actual `.mjs` selector has 88 passing tests. The two current-only cases are `Telegram Local-Only blocks connection and poll startup before network or running state` and `Telegram external action fails closed when Authority egress guard is absent`. The exact reason those cases were absent from the old 86-test log is not established; no passing count was discarded.

Browser TypeScript was not run because no browser source was touched. The full repository suite, public-network tests, Android build, physical device tests, package acceptance, and clean-machine tests were not run.

## Adversarial closure matrix

| Case | Status | Evidence / boundary |
|---|---|---|
| Pairing challenge one-use, replay, and expiry | PROVEN | Concurrent submit yields one pending result and one `CONFLICT`; successful replay is rejected; expired challenge is rejected. |
| Wrong workstation ID/fingerprint | PROVEN | Existing direct Authority negative cases reject both bindings. |
| Wrong pairing key/signature | PROVEN | HTTPS adapter returns `FORBIDDEN`; the valid device key can still use the unconsumed challenge. |
| Wrong device ID in request proof | PROVEN | HTTPS adapter returns `CONFLICT` before projection for a proof identity that differs from its challenge. |
| Duplicate active or pending public key | PROVEN | Both registration attempts return `CONFLICT`. |
| Re-pair after revocation | PROVEN | The revoked thumbprint remains rejected; a new key enters `AWAITING_OPERATOR` and still requires operator approval. Same-device key rotation UX is not implemented. |
| Missing/unknown scope and scope escalation | PROVEN | Empty/unknown requests fail; operator approval cannot add unrequested scopes; snapshot without both required read scopes is denied before provider invocation. |
| Device scope becoming Authority or execution authority | PROVEN | A Partner principal cannot call Authority grant controls; `/partner/v1/actions` remains 404. |
| Major protocol mismatch | PROVEN | Major mismatch returns 426. |
| Malformed strict-contract payload, response/log redaction | PROVEN | Unknown fields return `INVALID_REQUEST`; test marker is absent from response and logs. Raw invalid JSON bytes were not separately exercised. |
| Durable revocation and last-seen after process restart | PROVEN | Separate Authority-process probe observes `REVOKED_WITH_LAST_SEEN`; revoked devices cannot request fresh proof challenges. |
| Corrupt registry | PROVEN | Restart fails with `NOT_READY` and preserves the exact corrupt bytes. |
| Concurrent pairing | PROVEN within the single Authority process | The existing file mutation lock serializes two simultaneous confirmations in the supervised process. Cross-process multi-writer concurrency is not established. |
| Out-of-CIDR peer | PROVEN at the adapter boundary | A real loopback socket sourced from `127.0.0.2` is denied by a listener configured for `127.0.0.1/32`. This is not a same-LAN-device test. |
| Broad workstation API binding | PROVEN | Wildcard binding is refused; the broad listener binds to `127.0.0.1`. |
| Partner listener opt-in and failure isolation | PARTIAL | The broad API does not expose `/partner/v1`; invalid Partner TLS setup fails while the loopback API still responds. Editor/Terminal/Projects UI behavior was not tested. |
| Registry and Authority persistence owner | PROVEN in this slice | Partner identity/revocation stays in Authority-owned private state; no second Authority database was added. |

## Storage-safety exception and cleanup

This mission did **not** leave E: untouched. The incident and its limits are recorded in `test-temp-routing.md`.

1. The first focused Partner run inherited `TEMP`/`TMP=E:/pip_temp`; Node tests using `os.tmpdir()` therefore created test workspaces on E:. The suite passed, and its test cleanup paths ran, but the residual state was not independently inspected because E: became read-only for this mission.
2. A later core run with C: temp overrides exposed one hard-coded test root, `E:/pip_temp/opencode/phase2a-authority-gr9zag`. That test closed its servers but did not remove the directory. Its residual contents remain **UNKNOWN** and were not inspected or cleaned.
3. The fixture was corrected to use `os.tmpdir()` and remove its own known workspace. The capability test and final core rerun show C: paths and `workspaceRemoved: true`.
4. No test/build command ran after the temp-path discovery without the C: preflight. No E: Git-store mutation, cleanup, or storage repair was attempted.
5. `C:/CovertPartnerProtocol-temp-20261009` remains as a task-owned temporary root. No active Node test process referenced it. A recursive cleanup request was rejected before execution by command policy and was not retried.

This exception prevents any claim that E: remained read-only throughout the overnight work. No E: storage diagnostics were run after recovery; the current error-count delta is UNKNOWN.

## R9 and policy

`AGENTS.md` R9 and `README.md` were not changed. The legacy absolute R9 sentence remains in conflict with the operator-selected `Local-first by default. Connected by explicit choice.` policy. No global search/replace or policy migration occurred.

The earlier impact inventory remains in `docs/evidence/envoy-partner-protocol-foundation-20261008/REPORT.md`, section `R9 policy impact audit`. It identifies the active Connections contract and routing/Authority owners, Local-Only and egress tests, C4-02/C4-04 boundaries, and the historical/product claims that require targeted review. The core and egress suites above passed the relevant current Local-Only/egress regressions; they do not prove system-wide network containment.

Recommended policy migration remains controlled and separate: `Local-first by default. Data leaves the workstation only through an explicitly connected, scoped, operator-approved capability or paired device. No silent external egress.` Credentials or configured connections alone do not authorize egress; this statement is not proof of system-wide containment.

## Remaining unproven gates

- Actual same-LAN Android device pairing, device-key storage, revocation, and post-revocation denial.
- Physical-device TLS certificate pinning and first-device onboarding UX.
- Public-network behavior, firewall behavior, router exposure, or system-wide egress containment.
- Production Partner System/Work projections, live telemetry/event synchronization, stale-state behavior, and data freshness.
- Cipher chat through the Partner surface, mobile UI, notifications, and Android packaging/update lifecycle.
- Any Partner action, worker stop, approval, shell, model/provider change, or credential configuration; those are intentionally absent from V1 scope.
- Cross-process concurrent Authority writers and TLS certificate-rotation/recovery workflow.
- The cause and residual contents of the earlier E: temporary test directory.

The current candidate is reviewable and locally verified within the stated boundaries. It is not a physical-device release qualification and does not change `BLOCKED_EXTERNAL_DEPENDENCY`.
