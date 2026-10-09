# WEEKEND RUN JOURNAL — deepseek/weekend-native-platform-20261009

## Ledger
| Phase | SHA | Notes |
|---|---|---|
| P0 | `19072f7` | baseline + owner map + evidence (accepted) |
| Ingestion | `b9f4d0c` | zip sha256 match `1550a0cf…`, manifest 70/70, extracted outside repos |
| P1 reading | `cca9900` | reading record + extracted plan (accepted history) |
| P1 leaf-1 | (this commit) | **contracts**: `common/contracts/capability-projection.ts`, `common/contracts/tool-navigation.ts`; tsc node 0 |

## P1 required reading — COMPLETE
Package items used: `04_PHASE_PLAN` (P1 scope), `03_PRODUCT_LOCKS`, `06_OWNERSHIP_MAP`, `12_BLUEPRINT` (hash-identical E: copy), `05_SKILL_PLAN`; skills `covert-capability-projection-gateway`, `covert-tool-navigator`, `covert-skill-capability-routing`; SOPs `SOP_DEVELOPERS_WAY`, `SOP_THREAT_MODEL`, `SOP_VERIFICATION_EVIDENCE`, `SOP_CHECKPOINT_RECOVERY`; matrices `PHASE_DEPENDENCY` (P1), `VERIFICATION` (P1), `SKILL_REUSE` (full), `THREAT_MATRIX` (full).

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
