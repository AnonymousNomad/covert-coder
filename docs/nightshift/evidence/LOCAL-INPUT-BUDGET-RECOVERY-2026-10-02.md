# Local input budget and newest-task recovery — 2026-10-02

Status at recording: **LOCAL VERIFIED; publication/full hook/candidate exact-SHA CI pending**.
Canonical branch: nightshift/production-convergence-20260926. Accepted parent: 49cf367967c459874a31fb219079ed85c49daece; AIDE CI 36963301431 SUCCESS, all 23 steps.

## Failure, root cause and bounded repair

Actual Runtime returns context minus completion reserve. Router subtracted it again and passed the reduced input budget into a fitting function that also reserved completion tokens. A valid 63-character/16-token task became four characters under a 1024-token window and 512-token output reserve. The original seven byte-preservation regressions all failed. Router now fits the canonical input budget with zero additional fitting reserve; runtime completion options are unchanged. The original reproduction now dispatches all 63 characters.

Boundary testing separately failed four cases: an exhausted served window was represented as null and fell back to the larger manifest window; and system plus guaranteed newest turn could exceed the budget. Known exhaustion now returns zero, Router refuses it, and runtime retry also refuses zero. Router rejects a final joint over-budget result before inference rather than silently dropping authority instructions or shrinking the requested reserve.

Actual Runtime with a controlled HTTP endpoint reproduced successful chat/stream HTTP-400 retries omitting the newest task. The original overflow tests were strengthened to inspect actual retry messages, retaining their existing success assertions: baseline 1 pass/2 fail. Inserting newest into the existing kept array preserves the current instruction in both retries. No new runtime, router, Authority or context owner was created.

## Verification

- Final affected Router/context/Authority/AgentLoop/provenance/handoff: 93/93, zero failures, skips or cancellation.
- Eleven real-Runtime/Router budget regressions cover defaults, explicit reserve, boundary input, system/task retention, older-history eviction, oversized newest tail, cancellation/reuse, exhaustion, observed-window fallback and joint overflow.
- Both TypeScript projects, scoped lint and unchanged C1 ownership generator check pass.
- First complete Veritas RED retained: new fixture capture used a narrower role union than real Runtime accepts. Capture now uses the real parameter shape, with no cast/type-rule waiver; original tests gate passed.
- Final complete original Veritas: 6/6 true; architecture 919 total/908 pass/0 fail/11 skip/0 cancelled. Entire original npm test chain passes.

## Evidence limits and next work

Controlled responses and HTTP endpoints prove these paths and their input bytes; they do not qualify a model, template, hardware profile, provider or Resident role. Token estimates remain heuristic. No actual model started, floor lowered, default completion changed, deadline relaxed or foreign process stopped. This is not whole R11/context/Resident or RC acceptance. Unknown-context/cloud fitting and tokenizer qualification are outside this bounded receipt.

Next: reviewed coherent publication through the unchanged full hook, exact-SHA CI and Issue #38; then actual served-input and observed-model provenance through existing Router/AgentLoop/append-only AttemptJournal owners. Immutable pre-fit admission context remains admission intent, not a claim of actual served context. Visuals remain paused; the locked package and Design Lab are preserved. PR #31 remains frozen. Historical unexplained gate timeouts and fresh-user/dogfood release gates remain open.

Machine-readable source hashes and 31 immutable raw-artifact hashes: LOCAL-INPUT-BUDGET-RECOVERY-2026-10-02.json. Parent publication/CI update: RESIDENT-EXACT-WORKER-PUBLISHED-2026-10-02.json. Raw artifacts remain outside product at E:\covert-tooling\functional-release-20261001.
