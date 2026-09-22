# P0 REPAIR — Chat authority enrollment (production chat was unreachable)

Status: REPAIRED + VERIFIED (first P0 closure of the wiring audit)
Date: 2026-09-22 · Lane: `audit/wiring-ledger` · Target: `covert-production` @ `8ea6c8b`

## Source finding
- `POST /api/chat` and `POST /api/chat/stream` were listed as MIGRATION-WAIVER (ARCHITECTURE-DECISION) in `tests/arch/route-authority-coverage.test.ts:33-34` and had **no** central policy row and **no** route descriptor in `node/src/routes/chat.ts`.
- The governed dispatcher denies unenrolled routes: `node/src/server.ts` (`httpOperationKind` → null → `FORBIDDEN 'capability has no authority policy'`).
- Facade routing maps `/api/chat` → ts (`common/facade-route-map.json` prefixes), so the denial is on the production path.

## Reproduction (BEFORE)
Raw evidence: `artifacts/integration-certification/p0/p0-probe.json`, `artifacts/integration-certification/p0/p0-chat-prod.json`

1. Direct stack (`ArchServer` + `buildRoutes`, paired owner):
   - `POST /api/authority/prepare` for `POST /api/chat` → **403 FORBIDDEN "capability has no authority policy"**.
2. Production entry (supervised stack: supervisor + arch + legacy + facade):
   - `POST /api/chat` direct to TS → **403** (same message).
   - `POST /api/chat` through the facade → **403** (same message).
   - Approved-operation attempt (`prepare` via the authority route) → **403** (cannot even prepare).
   - Legacy target → 409 NOT_READY (its own authority round-trip failed in this stack).

## Observed consequence
Production chat is unreachable through the governed TS dispatcher; the only interactive surface (cockpit chat) would receive a policy denial. The prior local-inference lane had already discovered and repaired this exact class on its own branch (`fix/local-inference-production-gate`, commit message: "POST /api/chat, POST /api/chat/stream ... failed closed 403 'capability has no authority policy' ... REPAIR: enrolls chat + chat/stream as capability.execute (approved op binds the exact messages body)"), but the repair never reached `covert-production`.

## Owner
- `common/security/operation-policy.mjs` (HTTP_POLICY matrix)
- `tests/arch/route-authority-coverage.test.ts` (waiver list + pinned count)

## Bounded repair (port of the accepted local-inference repair)
1. `operation-policy.mjs`: added
   - `['POST /api/chat', 'capability.execute']`
   - `['POST /api/chat/stream', 'capability.execute']`
   The approved operation binds the exact messages body — which also binds any external transmission when the resolved route is a remote provider (P0-3 egress semantics for the chat path).
2. `route-authority-coverage.test.ts`: removed the two chat waivers; pinned count 24 → 22.

## Same reproduction blocked (AFTER)
- Direct stack: `prepare POST /api/chat` → **200**, kind `capability.execute`, risk `execute`, pending operation bound to the exact body digest (`p0-probe.json` AFTER run: `chat_prepare.status = 200`).
- Coverage matrix: `{routes:216, ENROLLED_CENTRAL:121, ENROLLED_DESCRIPTOR:68, MIGRATION-WAIVED:22, CONFLICTING:0, UNCLASSIFIED:0}`.

## Regression
- `tests/arch/route-authority-coverage.test.ts` 5/5 PASS (waiver pin deliberately updated, no new waivers).
- `tests/arch/chat-context.test.ts` PASS.
- `tsc -p tsconfig.node.json` → 0.

## Corrections to the first-pass agent reports (evidence over inference)
- **P0-4 (direct tool dispatcher) is NOT an authority bypass.** Probe: `POST /api/agent/tool` prepares as `agent.tool` / risk `execute` (200 pending), executes a read-only tool only after approval (200 with real output), and refuses `write_file` with 403 `tool write_file requires a session approval`. The real gap is **evidence**: the direct route creates no `.aide/trajectories`/`.aide/verifications` record (directory listing unchanged). Downgraded to observability defect (P2).
- **P0-3 (egress as read)** is now materially reduced for the chat path (approval-bound `capability.execute`). Remaining sub-item: `GET /api/modelhub/search` classification (token-bearing HF egress) — needs the descriptor/policy check and its own before/after probe.
- The earlier agent claim that chat rows existed at `operation-policy.mjs:86-92` was wrong; the runtime 403 is decisive.
