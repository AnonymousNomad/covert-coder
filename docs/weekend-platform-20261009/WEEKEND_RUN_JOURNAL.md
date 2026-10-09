# WEEKEND RUN JOURNAL — deepseek/weekend-native-platform-20261009

## Ledger
| Phase | SHA | Notes |
|---|---|---|
| P0 | `19072f7` | baseline + owner map + evidence (accepted) |
| Ingestion | `b9f4d0c` | zip sha256 match `1550a0cf…`, manifest 70/70, extracted outside repos |
| P1 reading | `cca9900` | reading record + extracted plan (accepted history) |
| P1 leaf-1 | `34175ee` | **contracts**: `common/contracts/capability-projection.ts`, `common/contracts/tool-navigation.ts`; tsc node 0 |
| P1 leaf-2 | `d1a6d31` | **services + tests**: projection + navigator services; suites 25/25; tsc 0; eslint 0 errors; diff-check clean; **P1_CAPABILITY_PROJECTION_FOUNDATION_CANDIDATE** reached |

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
Gate: focused suites + tsc + scoped eslint + `git diff --check`; commit `feat(clients): add managed terminal client framework (P2)`; then P3 reading next.

## P2 — core leaf COMPLETE (`ebe05f4`); leaf-2 (adapters) queued
Status: `P2_MANAGED_CLIENT_FRAMEWORK_CANDIDATE` (core). Contract + registry + conformance committed; suite 10/10; tsc 0; `SCOPED_ESLINT = ENVIRONMENTAL_SPIN` (known local behavior; wedged process killed by exact PID; not verified green); `git diff --check` clean.
Composition adjustment (recorded per blueprint allowance): adapters deferred to leaf-2 as a single cohesive module instead of per-client files — the three TARGET_1 adapters share one descriptor shape today; they will split per client when one diverges (reason recorded; no scope invention).
Leaf-2 exact spec: `node/src/services/managed-clients.ts` with `createClaudeCodeAdapter()`, `createCodexCliAdapter()`, `createKimiCodeAdapter()` (each returns `{ client_id, buildLaunch(discovery) => ManagedLaunchDescriptor }` — declarations only: executable/args/tool_restrictions/tui_visible, NO process spawn, NO bypass flags ever; assert at construction that restricted-flag lists never contain dangerous bypass tokens like `--dangerously`, `--yolo`, `--dangerously-skip-permissions`) and `createOpenCodeBridgeAdapter()` (returns `{ client_id: 'opencode', control_surface: 'existing-bridge', buildPtyLaunch: () => { throw } }` — OpenCode executes through the existing `opencode-bridge.ts`, never a second owner; PTY launch refusal is truthful `NOT_SUPPORTED` with reason `use existing bridge`). Tests `tests/arch/managed-clients.test.ts`: no-bypass-flag invariant across all adapters, opencode refuses PTY launch with truthful reason, descriptor schema parse-exactness, args bounded, TUI visibility flag true, codex sandbox-policy declaration present, kimi version-pin note present. Gate: tsc + focused tests + diff-check (eslint attempt with 10-min bound; record spin if it recurs). Commit `feat(clients): add managed client adapter descriptors (P2 leaf-2)`.

## P3 — next after P2 leaf-2
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
