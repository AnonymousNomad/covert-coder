# WEEKEND RUN JOURNAL — deepseek/weekend-native-platform-20261009

## Ledger
| Phase | SHA | Notes |
|---|---|---|
| P0 | `19072f7` | baseline + owner map + evidence (accepted) |
| Ingestion | `b9f4d0c` | zip sha256 match `1550a0cf…`, manifest 70/70, extracted outside repos |
| P1 reading | `cca9900` | reading record + extracted plan (accepted history) |
| P1 leaf-1 | `34175ee` | **contracts**: `common/contracts/capability-projection.ts`, `common/contracts/tool-navigation.ts`; tsc node 0 |
| P1 leaf-2 | `d1a6d31` | **services + tests**: projection + navigator services; suites 25/25; tsc 0; eslint 0 errors; diff-check clean; **P1_CAPABILITY_PROJECTION_FOUNDATION_CANDIDATE** reached |
| P2 core | `c703d8b` | managed-client discovery/conformance truth boundary repair; focused suite 13/13; TypeScript 0; scoped ESLint environmental spin |
| P2 leaf-2 | `b087378` | canonical all-client registry, TARGET_1 descriptors, existing-bridge OpenCode wrapper, conformance and credential guards; focused 24/24 + OpenCode bridge 12/12; pushed; acceptance remains open on preserved route RED / lint spin |

## P1 leaf-2 notes
- Discovered + fixed during the gate: strict snapshot parsing collapsed credential-shaped metadata into `MALFORMED_RECORD`; service now uses a lenient top-level schema with a per-record credential screen BEFORE strict parsing (hostile-credential test green; fail-closed `CREDENTIAL_REJECTED`).
- Test files adapted to `noUncheckedIndexedAccess`/`noImplicitAny`; one unused eslint-disable removed.
- `FULL_ARCH_GATE_NOT_RUN` (recorded; broad gate optionally deferred to P8).
- `REAL_APP_CATALOG_ADAPTER = WAITING_ON_ACCEPTED_OWNER_CHECKPOINT` (unchanged).

## P1 required reading — COMPLETE
Package items used: `04_PHASE_PLAN` (P1 scope), `03_PRODUCT_LOCKS`, `06_OWNERSHIP_MAP`, `12_BLUEPRINT` (hash-identical E: copy), `05_SKILL_PLAN`; skills `covert-capability-projection-gateway`, `covert-tool-navigator`, `covert-skill-capability-routing`; SOPs `SOP_DEVELOPERS_WAY`, `SOP_THREAT_MODEL`, `SOP_VERIFICATION_EVIDENCE`, `SOP_CHECKPOINT_RECOVERY`; matrices `PHASE_DEPENDENCY` (P1), `VERIFICATION` (P1), `SKILL_REUSE` (full), `THREAT_MATRIX` (full).

## P2 — reading COMPLETE; implementation next (exact spec)
Skills read: `covert-managed-terminal-client-session`, `covert-client-adapter-conformance`, `covert-terminal-client-harness`; `CLIENT_ADAPTER_MATRIX` captured.
Matrix constraints: OpenCode = reuse existing `opencode-bridge` (do not rebuild; MANAGED_OBSERVED today, requalify for Tool Gateway); Claude Code / Codex CLI / Kimi Code = TARGET_1 adapters (PTY + programmatic where available; client-owned auth; candidate FULLY_GOVERNED only after exact-version negative bypass tests); Gemini CLI / Qwen Code = RESEARCH-ONLY, UNQUALIFIED; never scrape credentials; never default dangerous bypass flags; never fallback to a different model when exact target fails.
Next files (blueprint P2): `common/contracts/managed-client.ts` (session identity: client id/exact version/executable hash, project/worktree, principal, mission ref, model/provider identity when observable, governance truth class FULLY_GOVERNED|MANAGED_OBSERVED|UNQUALIFIED + evidence refs, lifecycle states, cancel/cleanup truth); `node/src/services/managed-client-registry.ts` (registration + discovery of installed clients via exact executable/version probes; no credential reads; refuses unknown/duplicate ids; not a plugin registry); `node/src/services/managed-clients/{claude-code,codex-cli,kimi-code}.ts` (launch descriptors over TerminalSessionService + owned-process lifecycle; adapter-specific tool restrictions declared, never assumed; TUI visibility preserved); `node/src/services/managed-clients/opencode.ts` (thin adapter around existing `opencode-bridge.ts`); `node/src/services/client-conformance.ts` (conformance runner producing verdicts + evidence refs; version-pinned; no blanket claims; no cross-version extrapolation); tests `tests/arch/managed-client-registry.test.ts`, `tests/arch/managed-client-conformance.test.ts` (discovery fixture, unknown client refused, duplicate refused, version mismatch -> UNQUALIFIED, auth status detection without credential read, cancel/cleanup truth, label honesty tests, no-fallback test).
Gate: focused suites + tsc + scoped eslint + `git diff --check`; core commit `feat(clients): add managed terminal client framework (P2)` is a candidate checkpoint. P3 remains gated until P2 acceptance is proven.

## P2 — managed-client/provider integration — source checkpoint pushed; acceptance NOT CLOSED
Status: `P2_MANAGED_CLIENT_PROVIDER_FOUNDATION_IMPLEMENTED / NOT_ACCEPTED`. Source checkpoint `b087378fe4ac23ad13646d2d26bad723d8f0dba3` is pushed on `deepseek/weekend-native-platform-20261009`; final source-state worktree was clean with `HEAD...origin = 0/0` immediately after push.
Composition adjustment (recorded per blueprint allowance): adapters deferred to leaf-2 as a single cohesive module instead of per-client files — the three TARGET_1 adapters share one descriptor shape today; they will split per client when one diverges (reason recorded; no scope invention).
Leaf-2 implementation: `node/src/services/managed-clients.ts` provides three declaration-only TARGET_1 descriptors owned by `TerminalSessionService` (no process spawn or bypass args) and an OpenCode wrapper that consumes the canonical registry record and exact method references from the existing `opencode-bridge.ts`; the wrapper has no PTY path. Tests `tests/arch/managed-clients.test.ts` cover bounded descriptors, explicit unsupported operations, no fallback, exact provider/model matching, credential availability without values, OpenCode identity/cancellation/timeout passthrough, and PTY refusal. Existing bridge coverage now also verifies malformed authoritative output fails closed and cleans the session. Gate: focused tests + TypeScript + diff-check; the scoped ESLint attempt remains `ENVIRONMENTAL_SPIN`.

P2 source evidence at `docs/weekend-platform-20261009/evidence/p2-managed-client-provider-20261009.json`. Final source gates before commit: managed-client suites 24/24 (0 fail/skip/cancel); OpenCode bridge suite 12/12 (0 fail/skip/cancel); `npx tsc -p tsconfig.node.json` exit 0; staged `git diff --check` exit 0; push and post-fetch parity verified at `b087378`. Scoped ESLint remains `ENVIRONMENTAL_SPIN`, not pass. `FULLY_GOVERNED` was not awarded: P2 has no trusted evidence-reference verifier, so self-asserted LIVE flags/booleans yield `MANAGED_OBSERVED / NOT_RUN / LIVE_EVIDENCE_NOT_VERIFIED`.

Governance: Claude Code, Codex CLI, Kimi Code, and OpenCode remain `MANAGED_OBSERVED`; TARGET_1 provider qualification and OpenCode provider qualification remain `NOT_EVALUATED`; Gemini CLI and Qwen Code remain `UNQUALIFIED`. Live OpenCode proof is `LIVE_OPENCODE_PROOF_PENDING`; current bridge tests use deterministic local fixtures.

Preserved RED / UNKNOWN: the first uninstrumented `terminal-session-routes.test.ts` run was 11 total, 6 pass, 5 fail, 0 skip; five request operations hit the unchanged 5-second fixture deadline. Root cause is UNKNOWN; no storage I/O failure was established and no timeout was raised. Instrumented, unchanged-deadline diagnostic runs later passed 5/5 targeted cases and 11/11 full-suite cases, with safe method/path timing and event-loop metrics. Those later passes do not erase or explain the first red. `FULL_ARCH_GATE_NOT_RUN` and CI exact-SHA evidence was not collected.

## P3 — next only after P2 acceptance
Read skills `covert-cipher-mailbox-envelope`, `covert-cipher-wake-supervisor`, `covert-durable-scheduler-watch`, `covert-visible-work-operations` + `PHASE_DEPENDENCY` P3 row + `THREAT_MATRIX` Mailbox/Scheduler/Wake/Operations rows (captured); then contracts `cipher-mailbox.ts`/`scheduler.ts`/`operations-activity.ts`, `node:sqlite` storage spike under private state, wake supervisor state machine, operations projection — per blueprint P3. DING ≠ Authority; fresh policy/Admission at dispatch.

## Next exact actions (resume from here after any restart)
1. **Service** `node/src/services/capability-projection.ts`: `createCapabilityProjection({ reader })` where `reader()` returns `CanonicalCatalogSnapshotT`. Behaviors: expected_generation mismatch → `ProjectionResult` with all records excluded reason `STALE_GENERATION` (or typed error — choose deterministic single behavior, document); per-record filter order: schema parse (`MALFORMED_RECORD`) → duplicate id (`DUPLICATE_ID`, first-wins) → audience (`WRONG_AUDIENCE`) → role via canonical `selected_roles` (`WRONG_ROLE`) → availability (`UNAVAILABLE`) → owner observable per reader flags (`OWNER_UNAVAILABLE`); credential-shaped keys anywhere in extra/description metadata → strip + `CREDENTIAL_REJECTED` exclusion; preserve `selected_roles`/`external_egress_required`/`effect`/`audiences` byte-exact; output `execution_state:'GATED'`, `effect_replay:false`; deterministic ordering: canonical input order preserved (no sorting divergence); never mutates snapshot; no processes.
2. **Service** `node/src/services/tool-navigator.ts`: `createToolNavigator({ projection })`; search: tokenize objective deterministically, match ID/OWNER/KEYWORDS; ranking deterministic (ID match > OWNER > KEYWORDS, then canonical order; NO model-dependent ranking); cap at request.limit (≤20); `truncated` flag; describe: exact-ID lookup → full `ToolDescriptor` or `ToolNavigationError` with truthful reason; audience/role filters identical to projection; stale generation → error `STALE_GENERATION`.
3. **Tests** `tests/arch/capability-projection.test.ts` (13+): field preservation (id/owner/effect/audiences/selected_roles/egress), stale generation, wrong audience, wrong role, unavailable, owner-unavailable distinct reason, malformed, duplicate, empty catalog, deterministic order, hostile secret-bearing metadata cannot escape (raw JSON scan for canaries), no mutation of input snapshot, GATED invariants.
4. **Tests** `tests/arch/tool-navigator.test.ts` (12+): exact-ID lookup, keyword search hit, bounded limit + truncation, deterministic ranking repeated-call equality, no invented results, wrong-audience excluded, wrong-role excluded, effect/egress preserved in hits/descriptors, unknown-capability typed error, empty objective error, large-catalog bounded output (e.g., 2000 records → hits ≤ limit, bytes bounded), stale generation error.
5. **Verification gate**: `npx tsc -p tsconfig.node.json`; `npx eslint` on changed files; `node --experimental-strip-types --no-warnings --test tests/arch/capability-projection.test.ts tests/arch/tool-navigator.test.ts`; `git diff --check`. FULL_ARCH_GATE_NOT_RUN (state it).
6. **Commit** `feat(capabilities): add governed projection and tool navigation foundation` (services+tests leaf), push, verify 0/0 clean, record `P1_CAPABILITY_PROJECTION_FOUNDATION_CANDIDATE` in this journal, then begin P2 reading (skills `covert-managed-terminal-client-session`, `covert-client-adapter-conformance`, `covert-terminal-client-harness`) and implement P2 seams.

## Gated items (do not attempt before accepted owner checkpoint)
- `REAL_APP_CATALOG_ADAPTER = WAITING_ON_ACCEPTED_OWNER_CHECKPOINT` (upstream: hot Cipher lane `L:\CovertScratch\cipher-mission-composer-20261009` @ `e019156…`; target contract: its App Catalog semantics).
- No edits to `app-catalog.ts`, platform-app contracts, OpenAPI/facade maps, operation policy, Cipher Laptop UI.

## REDs / repairs
- None open. (Reading-phase only; contracts tsc-green.)

## Environment
- Worktree `E:\covert-deepseek-weekend-20261009`, branch `deepseek/weekend-native-platform-20261009`.
- Junction `node_modules` from `E:\covert-model-intelligence-mi1b` (untracked dev convenience).
- Active Cipher lane untouched; foreign processes untouched; no repo resets.
