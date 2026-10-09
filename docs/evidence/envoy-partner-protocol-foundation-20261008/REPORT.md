# Envoy Partner Protocol / Security Foundation

- Date: 2026-10-08
- Worktree: `E:\covert-envoy-partner-protocol-luna-20261008`
- Branch: `feat/envoy-partner-protocol-luna-20261008`
- Reviewed P2 base: `682a42114450c4f7caf84e45ccdc601481dfb374`
- Implementation base: `70420efe26ca31ed41a889c9c2de4c76e026ba43`
- Implementation commit: `5acbb66a63bc4d7baf5b2f848fc91bba3de8a85c`

## Status and scope

The protocol and security foundation is implemented and locally tested. This is not an Envoy UI, Android client, live telemetry, Cipher chat, live worker, same-LAN deployment, public network, or mobile-device qualification claim.

The governed-execution disposition remains **`BLOCKED_EXTERNAL_DEPENDENCY`**. The protocol work does not alter or close the earlier real-worker dependency.

The operator selected the observed clean 40-character base SHA above after the directive's 39-character SHA failed to resolve. The target worktree was clean at that base before edits. The reviewed P2 base and Saul's active lane were left untouched. The baseline focused suite recorded before mutation was 60 passed, 0 failed, 0 skipped; its command is retained below.

## Owner map

| Fact or effect | Canonical owner | Contract or mechanism used | New binding / current gap |
|---|---|---|---|
| Operator identity and device administration | Existing Authority in `node/src/services/execution-authority.mjs` | Existing opaque operator `ActorHandle`, control plane, required durable audit recorder | Added operator-only create/list/approve/reject/revoke methods. A Partner device is not an `ActorHandle` and cannot call Authority control. |
| Partner device identity, public key, scopes, last-seen, revocation | Authority-owned private platform state | Existing `atomicWriteJson` and file mutation lock | Stored under `.aide/platform-authority/partner-devices.json`; no separate Authority database and no bearer token. |
| Workstation HTTP API | `ArchServer` | Existing typed API and Authority route handling | Broad API rejects any bind other than `127.0.0.1`; Partner administration uses its authenticated operator routes. |
| Partner transport | New narrow adapter, `node/src/services/partner-protocol.ts` | Strict shared contracts plus HTTPS | Separate opt-in listener; no broad workstation routes are exposed on it. Production projection is not wired. |
| Shared Partner protocol | `common/contracts/partner.ts` | Strict, versioned Zod contracts | Adds hello, pairing, device, proof, metric, snapshot, event, and error contracts. No Partner action request contract or action route was added. |
| Signature and request binding | `common/security/partner-proof.mjs` | P-256 ECDSA/SHA-256 and SHA-256 request-body digest | Length-framed UTF-8 signing fields bind workstation, certificate fingerprint, challenge, device, method, path, timestamp, and body digest. |
| Project, System, Work, Activity, Evidence, Cipher chat | Existing respective platform owners | Existing canonical projections/services | Not connected to the Partner listener in this slice. The injectable snapshot seam has no production provider; `PartnerEvent` is a contract only. |
| External egress policy | Existing Connections / routing preference and Authority | Existing `local-first` / `local-only` policy and external operation checks | Not changed. A paired device or stored credential is not treated as consent for external use. |

## Contracts, pairing, and transport

- Contracts are strict and versioned at protocol major 1, minor 0. Unknown fields are rejected. Metrics represent `UNKNOWN`, `UNSUPPORTED`, or `STALE` with null values, never fabricated zeroes.
- Workstation pairing begins through the existing authenticated operator surface. The challenge has a five-minute expiry, one-use nonce, workstation ID, SHA-256 TLS certificate fingerprint, and requested scopes. The device signs the challenge with a P-256 key. The workstation verifies the signature and identity binding, then records a pending pairing for explicit operator approval. Pending approval expires after ten minutes.
- Operator approval can grant only a subset of the requested scopes. Delegated Resident/worker actors cannot issue or approve pairings. Approval audit is durably recorded before the device principal is committed. Device revocation is durable and checked on each protected request.
- The device principal contains a public key and thumbprint, never an operator bearer token. Private-key material is not returned or stored in the device registry. `Authorization` and `Cookie` headers are rejected on the Partner listener.
- HTTPS is required with TLS 1.2 minimum. The listener requires an explicit locally assigned private IPv4 address and a CIDR no broader than that interface subnet; peer addresses outside the configured CIDR are refused. Wildcard/public and unassigned-address binds fail before listen. Configuration is opt-in and requires all five `AIDE_PARTNER_*` fields, including certificate and private-key file paths. Incomplete or invalid configuration leaves the loopback workstation API running and the Partner listener unavailable.
- Device proofs use one-use challenges that expire after 30 seconds and sign the exact request method, path, timestamp, host identity, and body digest. Replays, stale proofs, body mismatch, missing scopes, and major-version mismatch fail closed. Major mismatch returns HTTP 426. Request bodies are limited to 32 KiB.
- The TLS listener does not accept a copied workstation bearer token and does not create a second Authority. Device-key proof is the Partner identity mechanism. Actual client-side certificate pinning and first-device onboarding UI remain mobile-client work.
- `PartnerSnapshot` is served only when a projection provider is configured, and hello advertises that feature only in that case. Production currently supplies no provider: the live code returns `PROJECTION_UNAVAILABLE`. The loopback test fixture injects a test snapshot only to verify the adapter boundary.
- Partner action paths are absent. Tests confirm `/partner/v1/actions` returns 404. No stop, approve/deny, shell, provider/model configuration, or execution path exists on the Partner listener.

## R9 policy impact audit — no policy edits made

### Conflict and intended scope

`AGENTS.md:39-40` still contains the legacy absolute R9 statement: “No cloud. No external APIs. No data leaves this machine.” `README.md:24` already states “Local by default. Connected by choice.” The implemented Connections and Authority architecture supports both local-first use and explicitly governed external routes. This is an active policy conflict; the directive is not being applied as product truth in this implementation.

`AGENTS.md:108` separately describes the current local-model hardware profile (“No cloud. No Colab. No external GPU. Everything local.”). That is a runtime qualification constraint for that hardware profile, not a suitable global product policy. It should move to the local-runtime profile or be labeled as hardware-specific.

### Contracts and code that rely on explicit routing policy

Review before migration, but preserve their narrower Local-Only behavior:

- Contract: `common/contracts/connections.ts` (`local-first`, `local-only`, `api-keys-with-approval`).
- Policy and route owners: `node/src/openapi.ts`, `node/src/routes/agent.ts`, `node/src/routes/modelhub.ts`, `node/src/routes/providers.ts`, `node/src/services/continuation-policy.ts`, `node/src/services/egress-manifest.ts`, `node/src/services/execution-authority.mjs`, `node/src/services/model-manager-view.ts`, `node/src/services/provider-connections.mjs`, and `node/src/services/routing-preference.mjs`.
- Tests covering route classification, consent, Local-Only, or no-fallback behavior: `tests/arch/agent-routes.test.ts`, `agent-worker-binding.test.ts`, `chat-authority-security.test.ts`, `cloud-status-truth.test.ts`, `connections-routes.test.ts`, `egress-manifest.test.ts`, `failure-continuation.test.ts`, `governed-execution-spine.test.ts`, `local-only-authority.test.ts`, `model-access.test.ts`, `modelhub-routes.test.ts`, `providers.test.ts`, `setup-validation-truth.test.ts`, `telegram-egress.test.mjs`, and `workbench-routes.test.ts`; also `tests/unit/test-connections-window-recovery.test.mjs` and `tests/unit/test-h2-byok.mjs`.
- `README.md`, `node/src/services/egress-manifest.ts`, and `tests/arch/egress-manifest.test.ts` already use the connected-by-choice doctrine. They should remain aligned with the controlled policy revision.

### Documentation and evidence requiring a targeted pass

- Active boundary/evidence: `docs/v1/security/C4-02-LOCAL-ONLY-EGRESS.md/.json` and `C4-04-MODELHUB-EGRESS.md/.json`. C4-02 explicitly says Local-Only is not system-wide and that arbitrary child-process/PTY, legacy model manager, and protected browser/publication paths remain outside its verified boundary. That finding remains valid and must not be erased by changing product policy language.
- Product and release claims: `docs/COVERT_CODER_NORTH_STAR.md`, `docs/GAP_ANALYSIS.md`, `docs/RESEARCH_LOG.md`, `docs/authority/CHAT-AUTHORITY-CONTRACT-V1.md`, `docs/release/RELEASE-CLAIM-MATRIX.md`, `CAPABILITY-WIRING-LEDGER.md`, `KNOWN-LIMITATIONS.md`, and `SOURCE-CERTIFICATION-RECORD.md/.json`; `docs/production-closure/README.md` and `COMPETITIVE_PARITY_DIRECTIVE.md`.
- Provider/context references: `docs/harness/MODEL-CONNECTION-CONTRACT.md`, `MODEL-CONNECTION-UX.md`, `MODEL-CONNECTION-IMPLEMENTATION-HANDOFF.md`, `HARNESS-CROWN-JEWEL-REVIEW.md`, and `HARNESS-GAP-MATRIX.json`.
- The scoped search also finds dated evidence and implementation records under `docs/nightshift/`, `docs/v1/routes/`, `docs/v1/state/`, and `docs/workstation-shell/evidence/20261007/`. These are evidence snapshots or route/state contracts; preserve their historical result and date rather than rewriting them as current doctrine.
- Historical or explicitly scoped language: `docs/AUDIT-2026-08-31.md`, `docs/design/COVERT_RESIDENT_IDENTITY_SYSTEM.md`, `docs/MEMORY-30D-RESEARCH.md`, `docs/phase0/REPORT.md`, `docs/nightshift/ACTIVE-CONTEXT-PACKET.md`, `docs/evidence/desktop-packaging-1r2-runtime-hardening.md`, `docs/evidence/desktop-packaging-1r3-installed-terminal-artifact-identity.md`, local-runtime lab evaluation/methodology documents, `docs/audit/intelligence-spine/BENCHMARK_PLAN.md`, the first-run intelligence skill/matrix, `docs/production-closure/three-theme-locked-2026-10-01/05_IMPLEMENTATION/LUNA_RECOVERY_PROTOCOL.md`, and prior workstation/governed-execution evidence reports. Preserve dated conclusions as historical evidence; update only current claims and clearly label the scope/date.

The audit also found active `Local-Only` tests and language in chat, providers, Model Hub, Telegram, continuation, and worker-routing paths. These tests prove the optional Local-Only choice and no-fallback rules for those routes. They do not prove that all workstation egress is mediated.

### Recommended controlled migration language

Keep the operator's proposed replacement as the headline:

> Local-first by default. Data leaves the workstation only through an explicitly connected, scoped, operator-approved capability or paired device. No silent external egress.

Add adjacent clarifying statements so the headline is not mistaken for broad containment proof:

1. Credentials or a configured connection identify a possible route; they do not authorize transmission. External use must be permitted for the actual provider/destination, data class, project/task scope, and material cost/retention conditions.
2. Local-Only tasks never fall back to cloud or another external route; an unavailable local route fails visibly.
3. The policy statement does not claim system-wide network containment. That claim requires every relevant egress path to be technically mediated and verified.
4. Keep local hardware/model qualification limits in the corresponding runtime profile, separately from product-wide egress doctrine.

No R9, README, routing preference, or egress policy text was modified in this slice.

## Test and verification record

All listed Node test runs completed with zero failures, cancellations, or skips. Logs are in this directory.

Environment note: `npm ci --offline --no-audit --no-fund` did not complete because `zod@4.6.5` was not present in the offline cache; npm then reported `EPERM` while cleaning one partial `node_modules` item. No network install was attempted. To run checks, task-owned junctions temporarily referenced the already installed dependencies in `E:\covert-governed-execution-spine-luna-20261008-impl\node_modules`. After verification, every junction and the empty target `node_modules` directory were removed; each source target was checked to remain present. The source dependency worktree was not modified.

| Scope | Exact command / result |
|---|---|
| Pre-edit baseline at `70420efe26ca31ed41a889c9c2de4c76e026ba43` | `node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/execution-authority.test.ts tests/arch/capability-authority.test.ts tests/arch/local-only-authority.test.ts tests/arch/route-authority-coverage.test.ts tests/arch/openapi-drift.test.ts tests/arch/events-contract.test.ts tests/arch/chat-authority-security.test.ts tests/arch/project-private-state.test.ts tests/arch/state-persistence-atomicity.test.ts tests/arch/governed-execution-spine.test.ts` — 60 passed. Baseline command/result were recorded before source mutation. |
| Partner + private-state focus, final after signature-frame correction | `node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/partner-protocol-security.test.ts tests/arch/project-private-state.test.ts` — 6 passed, 0 failed. See `partner-protocol-tests-final.txt`. |
| Core Authority/P1/P2/Partner regression, final after signature-frame correction | `node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/execution-authority.test.ts tests/arch/capability-authority.test.ts tests/arch/local-only-authority.test.ts tests/arch/route-authority-coverage.test.ts tests/arch/openapi-drift.test.ts tests/arch/events-contract.test.ts tests/arch/chat-authority-security.test.ts tests/arch/project-private-state.test.ts tests/arch/state-persistence-atomicity.test.ts tests/arch/governed-execution-spine.test.ts tests/arch/partner-protocol-security.test.ts` — 65 passed, 0 failed. See `core-regressions-final.txt`. |
| Egress/Connections/Model Access/Local-Only regression | `node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/connections-routes.test.ts tests/arch/model-access.test.ts tests/arch/agent-worker-binding.test.ts tests/arch/modelhub-routes.test.ts tests/arch/providers.test.ts tests/arch/telegram-egress.test.ts tests/arch/workbench-routes.test.ts tests/arch/egress-manifest.test.ts tests/arch/cloud-status-truth.test.ts tests/arch/local-only-runtime-endpoint.test.ts` — 86 passed, 0 failed. See `local-connected-regressions.txt`. |
| Route/facade drift | `node --experimental-strip-types --no-warnings --import ./scripts/http-close-shim.mjs --test --test-concurrency=1 --test-timeout=240000 tests/arch/route-drift.test.ts` — 5 passed. See `route-drift.txt`. |
| Node TypeScript | `node node_modules/typescript/bin/tsc -p tsconfig.node.json --noEmit` — exit 0. See `node-typecheck-final.txt`. |
| Touched-surface lint | `node node_modules/eslint/bin/eslint.js common/contracts/partner.ts common/security/partner-proof.mjs node/src/routes/authority.ts node/src/server.ts node/src/services/execution-authority.mjs node/src/services/partner-device-store.mjs node/src/services/partner-protocol.ts tests/arch/partner-protocol-security.test.ts tests/arch/project-private-state.test.ts` — exit 0. See `eslint-touched-final.txt`. |
| OpenAPI generation | `node scripts/contracts.mjs` — generated `common/openapi.json`, 1,228,390 bytes and 253 documented operations. See `contracts-generate.txt`; OpenAPI drift is included in the 65-test core run. |
| Generated route artifacts | `node scripts/build-facade-map.mjs --check` and `node scripts/build-c1-02-route-ownership-decisions.mjs --check` — both reported up to date. See `facade-map-check.txt` and `route-ownership-check.txt`. |
| Syntax and whitespace | `node --check common/security/partner-proof.mjs`, `node --check node/src/services/partner-device-store.mjs`, `node --check node/src/services/execution-authority.mjs`, and `git diff --check` — all exit 0. See `syntax-diff-final.txt`. |

Browser TypeScript was not run because no browser source was touched. Full test suite, Android build/device tests, and clean-machine/package acceptance were not run.

## Security review and unresolved boundaries

### Verified in this slice

- One-use and expired pairing challenges, replay rejection, wrong workstation ID/fingerprint rejection, operator-only approval, scope subset enforcement, pending-device refusal, durable revocation and last-seen across a separate Authority process restart.
- Device proof replay and stale request binding refusal; proof is bound to method/path/body digest/workstation identity and device key. A missing System or Work scope is denied before the projection provider is called.
- Broad workstation API rejects non-loopback binding. The protocol listener rejects wildcard/public and unassigned addresses and checks the configured peer CIDR.
- Major protocol mismatch fails with HTTP 426. Tests verify Partner responses omit the pairing signature field and operator bearer/private-key text, and logs omit the test bearer marker and signature. Partner requests carrying `Authorization` or `Cookie` headers are rejected.
- Authority persistence reuses the existing private-state and atomic JSON owner. Windows path alias and alternate-stream checks cover the new Authority state location.
- Pairing approval audit is durably recorded before device activation. Test TLS certificate/key are untrusted test fixtures and the fixture README prohibits product use.

### Not proven / known limitations

- The TLS adapter was exercised only on loopback with an untrusted test certificate and a test client configured to accept it. No same-LAN phone, certificate pinning UX, Android client, or real network boundary was tested. The RFC1918 binding/CIDR checks are configuration guards, not a claim that the OS firewall or every egress path is contained.
- Production currently wires no Partner snapshot projection. There is no live System/Work data, Event stream, deduplication/resync behavior, stale telemetry update, Cipher chat, notification, or mobile settings UI.
- Pairing approval, rejection, and revocation are operator routes on the loopback workstation API. The Partner protocol cannot approve, revoke, run shell, stop work, or execute actions.
- Device proof challenges are ephemeral and become invalid after daemon restart; this fails closed. Device identity, scopes, last-seen, and revocation persist. TLS certificate rotation currently conflicts with the persisted workstation fingerprint and has no dedicated rotation/recovery flow.
- TLS key file ACL/ownership validation and certificate lifecycle automation are not implemented. Deployment must protect configured key material; no key was copied to the device registry.
- Challenge issuance/submission and pairing rejection/revocation persist state before the corresponding audit write, while approval audits before activation. If audit persistence fails after one of those state changes, the request can return an error although an open challenge, consumed challenge/pending pairing, rejection, or revocation has already persisted. This does not grant an unapproved device access, but leaves an ambiguous operator response; a later UI should reread canonical state before retrying.
- Scope-specific projections are not implemented; the current optional combined snapshot requires both `system.read` and `work.read`. Future adapters should avoid returning a combined projection to a device lacking either scope.
- IPv6 is unsupported by the V1 listener. No push service, cloud relay, or public listener is present.

No physical-device, live-worker, public-internet, live-telemetry, chat, or system-wide network-containment claim is made.

## Implementation checkpoint files

Implementation commit `5acbb66a63bc4d7baf5b2f848fc91bba3de8a85c` changes 20 files:

- `common/contracts/partner.ts`
- `common/facade-route-map.json`
- `common/openapi.json`
- `common/security/partner-proof.d.mts`
- `common/security/partner-proof.mjs`
- `common/security/private-platform-state.mjs`
- `docs/v1/routes/C1-02-ROUTE-OWNERSHIP-DECISIONS.json`
- `docs/v1/routes/C1-02-ROUTE-OWNERSHIP-DECISIONS.md`
- `node/src/routes/authority.ts`
- `node/src/server.ts`
- `node/src/services/execution-authority.d.mts`
- `node/src/services/execution-authority.mjs`
- `node/src/services/partner-device-store.mjs`
- `node/src/services/partner-protocol.ts`
- `tests/arch/partner-protocol-security.test.ts`
- `tests/arch/project-private-state.test.ts`
- `tests/fixtures/partner-protocol/README.md`
- `tests/fixtures/partner-protocol/partner-test-cert.pem`
- `tests/fixtures/partner-protocol/partner-test-key.pem`
- `tests/fixtures/partner-protocol/restart-probe.mjs`

The follow-up evidence commit adds this report and the saved command outputs in this directory. No R9 edit, browser UI, Android source, or foreign worktree change is included.
