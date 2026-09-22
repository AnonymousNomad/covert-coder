# P0 CLASSIFICATION — Self-improve runner (VALID SYSTEM MAINTENANCE)

Date: 2026-09-22 · Lane: `audit/wiring-ledger` · Target: `covert-production` @ `8ea6c8b`
Per the operator clarification: reproduce and classify the ACTUAL writes before judging; observability alone closes nothing if user/project state can be mutated.

## Chain (evidence)
| Link | Evidence |
|---|---|
| TRIGGER | Daemon boot + every 6h; kill-switch `AIDE_CLOSED_LOOP !== 'false'` (`node/src/server.ts:381-399`). Detached spawn, `stdio:'ignore'`, `unref()`. |
| PROCESS OWNER | The daemon spawns `scripts/selfimprove.mjs` with `process.execPath` (`server.ts:385-392`). |
| TARGET FILES | Constants (`scripts/selfimprove.mjs:34-37`): `STATE_BUS=.aide/cipher-state.jsonl` (READ), `SIGNAL_DIR=.aide/training/` (WRITE), `LOG=.aide/logs/selfimprove.log` (WRITE); journal `=.aide/logs/selfimprove-iterations.jsonl` (WRITE, `:184-196`). |
| MUTATION CLASS | **SYSTEM-OWNED INTERNAL MAINTENANCE** — all targets are rooted inside `.aide/`. |
| AUTHORITY DECISION | None (no prepare/decide/consume) — same class as memory/chat-history/trajectory writes, which are also service-owned `.aide/` stores without authority operations. |
| EXECUTION PATH | Direct fs writes; `delegate()` and `verifyAdapterImprovement()` are **log-only placeholders** (`selfimprove.mjs:157-179`) — no process execution, no battery run. |
| EVIDENCE/AUDIT | Own log + iteration journal only; no canonical audit-bus rows (observability gap, P3). |

## Bounded reproduction (empirical)
Scratch root via `AIDE_SELFIMPROVE_ROOT`; one detector-matching `gate` failure row; ran `node scripts/selfimprove.mjs --since=24h`:

```
OBSERVE: 1 events in last 24h
DETECT: 1 failure events
CLUSTER: 1 distinct (category, source) buckets
emitted 1 failure rows to <scratch>\.aide\training\signal-2026-09-22.jsonl
```
Files created (complete list):
- `.aide/logs/selfimprove.log`
- `.aide/logs/selfimprove-iterations.jsonl`
- `.aide/training/signal-2026-09-22.jsonl`
Non-`.aide` files created: **0**.

## Disposition
**VALID SYSTEM MAINTENANCE.** The runner cannot mutate user/project workspace state; it maintains Covert's own closed-loop state inside `.aide/`. This is NOT a governance defect, and observability alone is not claimed as a closure — it is not required for closure.

Remaining optional item (P3): emit a canonical audit-bus row per runner iteration so its activity is visible beside other system events. Not implemented here (no redesign; not required).
