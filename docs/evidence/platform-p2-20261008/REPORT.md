# Covert P2 — read-only Resident capability discovery
Date: 2026-10-08

## Source and scope
Worktree: E:\covert-platform-app-foundation-saul-20261008
Branch: feat/covert-platform-app-foundation-20261007
Starting HEAD: 4aa79faa393b1835c6eb654c96876d0796e2f460 (P1 preserved).
P2 is a bounded local commit; no push/merge, P3, marketplace, grant, enrollment, invocation, qualification or lifecycle mutation.

## Production behavior
- ResidentCapabilityManifest V1 and authenticated, project/checkout-scoped GET /api/resident/capabilities.
- Read-only projection over the canonical App Catalog, ProjectSeat, CipherLedger and ModelManagerView.
- Logical Resident identity is distinct from enrollment. Observed identity binds unsigned canonical ledger ID/checkpoint/count/integrity revision. A read never enrolls or manufactures history.
- All applications, capabilities and worker routes remain GATED; grants and Admission remain NOT_EVALUATED. No execution eligibility is inferred from addressability, model support or role selection.
- Owner declarations are checked per capability against registered owner-factory metadata and canonical operation policy. Effects no longer derive from HTTP method. Audiences are explicit minimum declarations.
- Project/checkout/seat and catalog generation are validated after asynchronous owner reads. Ledger revision changes during discovery refuse the projection.
- Thirty-second freshness uses an internal injectable clock and expires exactly at valid_until. Old discovery/catalog generations, fabricated capabilities/worker references and changed owner facts fail validation.
- Credential containment is structural: strict projections omit credential sources/handles, connection IDs and provider labels. Worker IDs become fixed-format opaque digest references over canonical owner identities; these are neither signatures nor credential handles. Roles and egress are preserved exactly for supported canonical roles; an invalid snapshot becomes UNAVAILABLE.
- Pending decisions are UNAVAILABLE with an explicit owner-discovery reason, not a fabricated zero count.
- Cipher owner failure only degrades Cipher-owned discovery bindings. Direct operator catalog, Projects, file/editor read and Terminal session listing remain independent.

## Verification
All four test runs passed: P1/P2 48/48; project/addressing/shared-seat/route/OpenAPI/terminal 41/41; WSL readiness 4/4; Authority/ledger/private-state 26/26. Total 119/119, no skips.
Node types, browser types, scoped ESLint, contract generation and git diff --check passed.
ESLint retained one P1 baseline unused _digest warning (0 errors); git show confirmed it predates P2.
Production HTTP tests exercised pairing, authentication refusal, strict scoped queries, unsupported POST, actor revocation while awaiting discovery, and direct operator fallback with actual file content. The terminal discovery fixture fails if it attempts PTY spawn.
Negative coverage includes all-route execution gating, provenance/revision substitution, exact expiry, asynchronous scope invalidation, catalog generation changes, invented principal/grant/capability/worker/eligibility, structural credential rejection, exact roles/egress/effects/audiences, duplicate adapters, and the 2x2 ledger/worker availability matrix.
Independent source review found a final-ledger-read scope race; repaired and negatively tested. Final review reports no blocking finding, source-only; it is not independent runtime acceptance.

## Observed failures and repairs
- Original P2 RED: discovery module absent. Original test bytes/hash retained in verification archive.
- Initial focused run 37/39: fixture incorrectly expected a status read to enroll an empty ledger. Repaired fixture through a real test-owned ledger append and added a negative proving discovery cannot enroll a fresh ledger.
- Next focused run 40/40, then types failed on an unknown-returning handler callback. Made the test callback async; types and final expanded tests pass.
- Resource gate refused the additional Authority run at 7656 MiB RAM / 4395 MiB free commit. Fresh sample recovered to 9009 / 5361 without further termination; actual Authority-run gate passed at 8465 / 5136. Floors remain 3072 MiB RAM and strictly more than 5120 MiB free commit.
- Main final run gate samples ranged 6599–7427 MiB physical and 5399–5978 MiB free commit. All final heavy phases passed their gates.
- A diagnostic git-show command exceeded Node's default output buffer reading the large existing OpenAPI file. Increased only that inspection buffer and re-ran it; production tests/gates were unaffected. Only new OpenAPI path is /api/resident/capabilities.
- One evidence read RPC timed out (HTTP 504). A fresh control probe succeeded; evidence collection uses bounded local commands.
- Earlier authorized resource recovery preserved repository/session indexes before stopping the two original OpenCode processes and the verified Codex GUI tree; control/system/security processes were preserved. Durable data was not removed. Unsaved UI text/in-flight generation recovery cannot be guaranteed. No additional process was stopped after the later gate refusal.
- Preliminary log names were reused before archiving: original missing-module RED and type-failure logs survive, but the first 37/39 focused stdout was overwritten by the 40/40 run. Results retain its exit status; this report records the observed failures without inventing a missing raw log.

## Remaining boundaries
- Resident enrollment, live principal/context lease, grants, pending-decision owner integration, invocation, qualification and execution remain gated/unimplemented.
- Worker digest references are read-only discovery identities; owner resolution/invocation is not enabled.
- Hash-chain provenance remains unsigned. Witness/signature and global containment are not claimed.
- App lifecycle mutation, P3, marketplace and arbitrary executable contributions remain outside this slice.
- No new UI was mounted in P2; no new browser screenshot, packaged/security/full-suite/clean-machine/CI/release-candidate claim.
- Actual local-model acquisition/execution remains Luna's separate vertical; not duplicated here.

## Evidence
verification.zip contains curated raw verification logs, resource gates, original P2 RED test, source fingerprint and tracked production diff.
SHA256SUMS.txt binds archive/report/source-fingerprint bytes. Foreign-lane patches, credential values and session recovery indexes are excluded.
