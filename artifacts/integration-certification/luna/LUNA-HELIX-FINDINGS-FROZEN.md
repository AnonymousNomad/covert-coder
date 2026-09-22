# LUNA HELIX FINDINGS — FROZEN EXTERNAL EVIDENCE (verbatim, no reinterpretation)

Source: Luna's independent Helix structured-memory certification (external to this lane).
Frozen: 2026-09-22 by the wiring-audit lane. These findings are EVIDENCE, not acceptances.

## PROVEN (protected properties — must not regress)
1. Workspace-scoped memory survives fresh-process restart.
2. Fact-key supersession works in normal ordered operation.
3. Verified failure can outrank a worker's false-success claim.
4. Two workspaces remained isolated.
5. Recall remained bounded.
6. Context Control injected selected recall instead of replaying the historical journal.

## NOT PROVEN / DEFECTIVE (do not reinterpret into ACCEPT)
1. Repeated unsupported claims can become active retrievable memory. **← MEMORY POISONING (high priority)**
2. Older out-of-order writes can override newer temporal truth.
3. Normalized recall lacks sufficient provenance/evidence/validity/class metadata.
4. General decision/evidence lineage is incomplete.
5. Helix event digests/patterns are not unified with normal memory recall.
6. Role-specific Helix reconstruction is incomplete.
7. Raw-history-vs-compiled-context model advantage remains unproven.

## Hard invariants derived for this lane (from the operator addendum)
- REPETITION != VERIFICATION.
- CURRENT TRUTH MUST OUTRANK STALE ARRIVAL.
- UNKNOWN remains valid when evidence is insufficient.
- STORE-WITH-PROVENANCE and USE-AS-CURRENT-TRUTH are different decisions.
- Memory feeds the worker without becoming the worker's prompt history (bounded retrieval preserved: 331 recall tokens is the desirable baseline).
- Every memory repair must rerun the protected properties above.

## Required fixtures for Luna's independent rerun (to be produced with the repair)
- memory poisoning (repeated unsupported claim + contradictory verified evidence),
- out-of-order writes (newer accepted fact + later-arriving older event),
- role projection (Resident vs Planner vs Coder vs Reviewer),
- Resident→coder continuity,
- restart persistence,
- project isolation,
- bounded context.
