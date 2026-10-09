# P1 READING RECORD + EXECUTION PLAN (pre-implementation, 2026-10-09)

## Package items read (exact, from the verified extraction)
`E:\pip_temp\covert-deepseek-weekend-handoff\COVERT_DEEPSEEK_WEEKEND_2026-10-09`
- `00_START_HERE.md` (read; E: copy hash-identical to package)
- `01_DEEPSEEK_WEEKEND_DIRECTIVE.md` (read)
- `02_CURRENT_STATE_AND_STARTING_POINT.md` (read)
- `03_PRODUCT_LOCKS_AND_ARCHITECTURE.md` (read)
- `04_PHASE_PLAN.md` (read)
- `06_CODE_OWNERSHIP_AND_COLLISION_MAP.md` (read)
- `12_IMPLEMENTATION_BLUEPRINT.md` (read; E: copy hash-identical to package)
- Matrices: `PHASE_DEPENDENCY_MATRIX.csv`, `VERIFICATION_MATRIX.csv`, `SKILL_REUSE_MATRIX.csv` (full reads)

## Remaining before writing P1 code (ordered, small)
1. `05_SKILL_PLAN.md`
2. Skills: `covert-capability-projection-gateway`, `covert-tool-navigator`, plus the skill-routing skill identified by 05
3. SOPs: `SOP_THREAT_MODEL.md`, `SOP_VERIFICATION_EVIDENCE.md`, `SOP_DEVELOPERS_WAY.md` (applicable rows)
4. Matrices rows to execute from: `THREAT_MATRIX.csv` (P1 cases), `PHASE_DEPENDENCY_MATRIX.csv` P1 row, `VERIFICATION_MATRIX.csv` P1 row (captured)

## P1 execution plan (extracted from the blueprint + directive; no scope invention)
Files (independent seams only, per `12_IMPLEMENTATION_BLUEPRINT.md` P1):
- `common/contracts/capability-projection.ts` — projection contract; consumes an App-Catalog READER interface; preserves capability id/owner/effect/audiences/selected_roles/external_egress_required/catalog generation exactly; no re-derivation, no widening.
- `common/contracts/tool-navigation.ts` — navigator request/result contracts (objective → search → bounded candidates → describe/load).
- `node/src/services/capability-projection.ts` — deterministic projection service over the reader interface; stale-generation rejection; truthful reason codes (UNKNOWN/UNAVAILABLE/WRONG_AUDIENCE/WRONG_ROLE/ABSENT) — never collapsed to NOT_FOUND.
- `node/src/services/tool-navigator.ts` — deterministic, bounded search/rank; no invented capabilities; unknown stays unknown; unavailable stays unavailable; no effectful selection beyond request; on-demand describe/load.
- `tests/arch/capability-projection.test.ts`, `tests/arch/tool-navigator.test.ts` — full P1 test matrix per directive §18 (projection/navigator/separation), incl. hostile secret-bearing inputs, audience/role/egress/effect preservation, staleness, duplicates, empty catalog, huge-catalog bounds, injection strings treated as untrusted metadata.
- `skill-router.ts` ONLY after auditing the existing skill loader (`SKILL_REUSE_MATRIX` warns: `aid-skills-auto-load-by-context` = AUDIT FIRST, avoid duplicate skill router).

Laws enforced in code/tests: discovery never grants/admits/executes; projection creates no processes and mutates no catalog state; freshness bound to catalog generation (not timestamps/TTL); credentials/secrets cannot escape projection (negative tests with hostile inputs, not just type omission); MCP = projection not registry; skills never grant capabilities; deterministic ordering; bounded context for the small Liquid model (search-then-describe pattern).

## Gated items (unchanged)
- `REAL_APP_CATALOG_ADAPTER = WAITING_ON_ACCEPTED_OWNER_CHECKPOINT` (hot lane `L:\CovertScratch\cipher-mission-composer-20261009` @ `e019156…`, active-private).
- No wiring into `app-catalog.ts`, platform-app contracts, OpenAPI/facade maps, operation policy, Cipher Laptop UI.

## Status
Reading phase checkpoint only. No product code written in this commit (P1 code begins after the remaining short reads above, per operator gate).
