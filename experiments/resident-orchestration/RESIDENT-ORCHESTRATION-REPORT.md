# RESIDENT ORCHESTRATION + GOVERNED WORKER INTELLIGENCE — FINAL REPORT

Directive: make the Resident function as the persistent intelligence coordinating
Covert's governed development system. Session: 2026-09-21. Training: none
(`NO NEW TRAINING JUSTIFIED` honored; no weights touched).

## What was proven (evidence first)

**The loop runs end-to-end on real product surfaces.**
M1 (`results/M1-plan-coder-review.json`): operator goal → Resident understanding →
canonical reconstruction → deterministic SOP selection → Arsenal worker selection →
planner (qwen1.5b) → coder (received the accepted plan) → approved write → approved
test execution → deterministic verdict → reviewer (evidence-bearing, advisory) →
Resident interpretation ("The verdict is FAIL, not PASS.") → continuity entry.
M2 (`results/M2M3-restart-continuity-failure-recovery.json`): fresh stack, no
transcript, reconstruction from canonical state, "Continue.", structured failure,
Resident-chosen action **honored** (REPLAN → revised plan), bounded recovery with a
recorded model switch (qwen1.5b → SmolLM2-360M), deterministic verdict, continuity.
M6 (`results/M6-streamed-acceptance.json`): **10/10 real-engine streamed
acceptance, 0 unsafe shipments.**

**Two real production defects were found by the mandated stream acceptance test
and repaired with regressions:**
1. Containment pattern coverage (invented named capability; the Unicode
   "capability" phrasing; "release is ready for production"). Repaired in
   `resident-containment.mjs`; containment battery **13/13** (new live-escape
   regression test).
2. **Stream governance-input parity**: `routeForChatStream` was wired without the
   Arsenal projection → capability containment was inert on the stream path.
   Repaired in `openapi.ts`; re-run 10/10 with live `capability-unsupported`
   regenerations.

**Protections preserved:** 117-mission baseline untouched (no Resident code
changed in this program except the containment families above, which only ADD
detections); 65/65 batteries held (containment 13/13, live-awareness + authority
12/12, SOPs 13/13, tsc PASS); buffer-then-release kept; deterministic-verdict
invariant held in every mission (advisory PASS never overrode a deterministic FAIL).

**Authority preserved:** every mutation went through approved exact operations;
an unauthenticated stream request was refused by the facade (403, observed);
workers remained proposal-only; no authority transferred by wording.

**Context economics:** largest assignment ~520 tokens; no stage received the
transcript; SOP bodies capped at 2; per-stage token/call accounting recorded.

**Findings recorded (not hidden):**
- Local worker capacity: 0.5B–1.5B coders produced placeholder/non-implementing
  artifacts; the chain refused false success and ended with an operator decision.
- Resident reconstruction: one-line answers for multi-part structured questions at
  230M → classified MODEL_CAPACITY (format adherence); architectural remedy
  recorded (harness owns structure, model owns language). No training.
- Grandchild-engine leak on stack close (engines are spawned detached and escape
  the tree kill): 4 engines leaked across orchestration runs, identified as mine
  and killed; hardening note recorded (stack close should reap by ownership, or
  the runtime's stopAll must complete before exit).
- Provider switching: **BLOCKED_BY_PRODUCTION_WIRING** (canonical bridge exists;
  no approved provider; DeepSeek owns the transport).
- Canonical workflow artifact vocabulary is experience-domain; code missions
  cannot yet advance canonical stages without matching artifacts → lane
  continuity store used alongside the canonical workflow state.

## Classifications
```
Resident Stability:               ACCEPT   (no regressions; containment strengthened; baseline preserved)
Resident Context Reconstruction:  PARTIAL  (canonical state is consumed and sufficient; the 230M model's
                                            multi-part prose is thin → harness owns structure)
Resident → Planner:               ACCEPT   (bounded plan artifact from reconstruction; no transcript)
Planner → Coder:                  ACCEPT   (coder receives the accepted/revised plan explicitly)
Coder → Reviewer:                 ACCEPT   (evidence-bearing reviewer; deterministic verdict authoritative)
Evidence → Resident:              ACCEPT   (Resident reported FAIL over the advisory PASS; containment fail-closed on unsafe summaries)
Failure Recovery:                 ACCEPT   (structured failure → chosen action honored → bounded recovery → honest end state)
Model Switch Continuity:          ACCEPT   (switch executed with recorded reason; state survived)
Provider Switch Continuity:       BLOCKED  (BLOCKED_BY_PRODUCTION_WIRING; mission preserved)
Restart Continuity:               ACCEPT   (fresh stack, canonical reconstruction, continued work)
Offline Resident:                 ACCEPT   (all missions local-only; no remote attempts)
Authority Preservation:           ACCEPT   (approved exact operations only; unauthenticated stream refused)
Live Streaming:                   ACCEPT   (10/10 real-engine, 0 unsafe, buffer-then-release held)
Real Development Mission:         PARTIAL  (complete chain on a real repo task; final PASS blocked by local worker capability)
Overall Resident Orchestration:   PARTIAL  (the loop is real and governed end-to-end; a verified PASS still
                                            requires a capable worker — the architecture never fakes one)
```

## Final question
> Can an operator give the Resident a development objective, allow Covert to
> select and coordinate the appropriate workers, survive worker/model/provider
> failure, verify the result, remember the important project state, and continue
> the project without the operator manually orchestrating the models?

**Evidence-only answer: PARTIAL — yes for coordination, verification, continuity
and failure survival; not yet for verified completion with the current local
worker set.**
- Objective intake, worker selection, bounded delegation, execution evidence,
  deterministic verification, continuity, restart continuation, model switching
  and failure recovery were all demonstrated live (M1/M2/M6).
- Provider failure survival is designed but BLOCKED_BY_PRODUCTION_WIRING.
- The final verified PASS did not occur because the available local coders cannot
  implement the task; the system correctly refused to fake completion and demanded
  an operator decision (or a stronger worker). That refusal is the strongest
  evidence that the orchestration layer is governed rather than performative.
