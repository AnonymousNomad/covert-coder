# P0 REPAIR — ModelHub search external egress classification

Status: REPAIRED + VERIFIED (third P0 closure)
Date: 2026-09-22 · Lane: `audit/wiring-ledger` · Target: `covert-production` @ `8ea6c8b`

## Source finding
`GET /api/modelhub/search` was descriptor-owned as `capability.read`. The dispatcher auto-prepares and executes any operation whose kind ends in `.read` (`node/src/server.ts` dispatch: `if (input.kind.endsWith('.read')) { id = (await authority.prepare(...)).operation_id; }`) — **no operator decision**. The route transmits to Hugging Face and attaches the stored HF token when present (`modelhub.mjs`), so authenticated external egress ran under an auto-permitted read class. Every other external route in the system uses `capability.external` (`modelhub/download`, `byok/test`, `connections/test`, `providers/connect`).

## Reproduction (BEFORE)
Raw evidence: `p0/p0-search.json`
- `GET /api/modelhub/search?q=probe&limit=1` with **no operation header, no approval** → **HTTP 200** with real Hugging Face results (`RichardErkhov/ProbeMedicalYonseiMAILab_-_medllama3-v14-gguf`) — a real network transmission executed with no operator decision.

## Observed consequence
External, token-bearing egress could be triggered by any paired request without an approval binding the exact query; the descriptor comment ("the approved operation binds the exact query") was misleading because `.read` kinds never require approval.

## Owner
- `node/src/routes/modelhub.ts` (search route descriptor)

## Bounded repair
- Search descriptor kind: `capability.read` → **`capability.external`** (aligns with every other external route; the approved operation still binds the exact validated query, and omitted optionals stay `null` in the authority identity).

## Same reproduction blocked (AFTER)
- Same unapproved call → **409 NOT_READY "exact operation approval required"** (`APPROVAL_REQUIRED`), **zero egress** (`p0-search.json` AFTER run).
- Unknown caller-supplied operation id → **404** (no substitution), zero egress.

## Regression
- `tests/arch/modelhub-routes.test.ts` updated to the corrected invariant (unapproved → 409 + zero fetch; approved exact call → 200 with pinned host, mapped response, one journal entry; injection/defaults/upstream-failure paths re-run through approved operations) → **8/8 PASS** together with `route-authority-coverage`.
- `tsc -p tsconfig.node.json` → 0.

## Notes
- Local, non-transmitting reads keep their auto-permitted `.read` classes (no global blocking of harmless local reads — per the operator clarification).
- Remaining egress-as-read audit: none found among routes checked so far beyond this one; the ledger tracks the class.
