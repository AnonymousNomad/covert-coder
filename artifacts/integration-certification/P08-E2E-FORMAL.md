# P0.8 — LOCAL → EXTERNAL → LOCAL (worker replaceability, one continuous mission)

Date: 2026-09-23 (session resuming 8f02d7f)
Probe: E:\pip_temp\opencode\p08-e2e.mjs (direct stack, one workspace, one task lineage)
Evidence: artifacts/integration-certification/P08-E2E.json

## Scenario
1. LEG 1 — **LOCAL A** (`local:auto`, local provider): bounded fixture task completes (`LOCAL-PHASE-1`).
2. HANDOFF 1 — canonical create (built from A's canonical trajectory; `from local:auto` → `to opencode-go/deepseek-v4.1-flash`, provider `opencode`).
3. LEG 2 — **EXTERNAL** (`opencode-go/deepseek-v4.1-flash`): session started with `chat_source: provider` + `handoff_id`; the reception branch pinned the REAL provider resolver; the real external model consumed the handoff once, produced `EXTERNAL-PHASE-2`, reached `done`.
4. HANDOFF 2 — canonical create (`from external` → `to local:coder-2`).
5. LEG 3 — **LOCAL B** (`local:coder-2`): session started with `handoff_id`; local engine pinned via canonical resolver; consumed once, produced `LOCAL-PHASE-3`, reached `done`.

## Verdicts (all true)
| Check | Result |
|---|---|
| LOCAL A done | TRUE |
| HANDOFF 1 created (200) | TRUE |
| EXTERNAL B done (REAL opencode-go inference through Covert) | TRUE |
| External B received RECEIVING CONTEXT block | TRUE |
| External B raw-transcript leak | NONE |
| Handoff 1 consumed (state CONSUMED, consume-once) | TRUE |
| Handoff 1 carries no secrets/credentials | TRUE |
| HANDOFF 2 created (200) | TRUE |
| LOCAL C done | TRUE |
| Local C received RECEIVING CONTEXT block | TRUE |
| Local C raw-transcript leak | NONE |
| Handoff 2 consumed (state CONSUMED) | TRUE |
| Workers/models/providers changed (local:auto → opencode-go/deepseek-v4.1-flash → local:coder-2) | TRUE |

Continuity invariants: one workspace, one authority chain (every request owner-approved), continuity flowed ONLY through canonical handoffs (no transcript replay, no operator recap).

## Truthful notes
- `verification_b: incomplete` on the external session — the harness verification gate ran and reported incomplete (no file mutation to verify); session still reached `done`. Recorded as-is, not upgraded.
- The probe completed all legs (~8 min) but hung on process exit (undici keep-alive sockets — known class); the terminating shell killed it after the evidence JSON was already written. No stray processes remained. Fixed for future runs by adding an explicit `process.exit(0)`.

## Conclusion
P0.8: **PASS** — worker/model/provider interchangeability without breaking project identity, canonical truth lineage, authority semantics, or continuity protocol.
