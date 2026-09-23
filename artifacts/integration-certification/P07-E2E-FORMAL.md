# P0.7 — FORMAL END-TO-END ACCEPTANCE (handoff + failure continuation + restart)

Date: 2026-09-23 (session resuming 12b9519)
Probe: E:\pip_temp\opencode\p07-e2e.mjs (direct ArchServer stacks, real fixtures, two processes)
Evidence: artifacts/integration-certification/P07-E2E.json (probe output)

## Scenario executed
1. Stack A boots against a real workspace fixture; worker A (`local:coder-1`) runs a real bounded task via the real agent loop with a scripted local lane; the lane produces invalid output.
2. Failure classification: `INVALID_OUTPUT` -> continuation manager decision `switch` (attempt 1/2, replacement `local:coder-2`, role `act`).
3. Canonical continuation persisted (`chain_id a428cb51-7fcd-4667-a4fe-c35bc31a4bb2`) with canonical handoff (`handoff_id d6d2039f-b2fc-432d-ab1d-3f7ecc142ef5`).
4. **Full stack shutdown**: all servers, engines, and owned processes terminated (`full_shutdown_clean: true`).
5. Stack B restarts from scratch (no shared memory): reconstructs workflow/stage/continuation state from disk (`restart_continuation_planned: true`, same chain + handoff ids recovered).
6. Worker B (`local:coder-2`) starts from canonical state, consumes the handoff **once**, receives the bounded `[RECEIVING CONTEXT]` block, continues, and reaches `done` (`final_b: done`).
7. Handoff state after consumption: `CONSUMED` (consume-once).

## Verdicts
| Check | Result |
|---|---|
| WORKER A FAILED (real failure, real classification) | PASS |
| FULL SHUTDOWN CLEAN | PASS |
| RESTART RECONSTRUCTION (continuation + handoff from disk) | PASS |
| HANDOFF PERSISTED ACROSS RESTART | PASS |
| WORKER B CONSUMED ONCE AND COMPLETED | PASS (state CONSUMED, final_b done) |
| RECEIVING CONTEXT FROM CANONICAL HANDOFF | PASS |
| RAW TRANSCRIPT LEAK | NONE (marker analysis below) |
| FALSE CONTINUITY CLAIMS | 0 (continuation planned only after real INVALID_OUTPUT) |
| AUTHORITY LEAK / SECRET LEAK | NONE (covered by accepted live suite, 8/8: no authority transfer, no secrets) |

## Transcript-leak marker analysis
Probe flag `noplay` initially reported false due to a naive substring check. Marker-level inspection of worker B's persisted trajectory:
- `'never used'` (raw assistant content unique to A's transcript): **absent** -> raw transcript did NOT replay.
- `'read_file'`: present only (a) in the system prompt's tool documentation, and (b) inside the `[RECEIVING CONTEXT]` verified-facts summary (`step 1.read_file: passed`) — bounded canonical handoff semantics, by design. No raw turns, no tool outputs replayed.

## Conclusion
P0.7: **PASS** — real failure -> governed continuation -> canonical handoff -> full cold restart -> single consumption with bounded receiving context and continued work, with no raw-transcript/authority/secret leakage.
