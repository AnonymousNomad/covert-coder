# RELEASE CLAIM MATRIX — candidate `audit/wiring-ledger`

Date: 2026-09-23. Every classification points to executed evidence on this lane. No claim outruns its evidence.

| Claim | Classification | Evidence |
|---|---|---|
| Local by default | **PROVEN** | P0.9 offline probe (consent-off 403 truthful, zero egress); egress manifest (local capabilities PACKAGED_LOCAL); readiness local-first |
| Connected by choice | **PROVEN** | BYOK consent switch gating provider paths; egress manifest consent states; P0.3 governed egress journal |
| Offline core | **PROVEN** | P0.9-OFFLINE.json |
| Local models | **PARTIAL** | D2 lifecycle positive (real inferences) + negatives 8/9 + Wave 10A ownership; BUT bundled GGUF artifacts are not in this checkout (platform skips) and serving needs an installed engine/runtime |
| External provider workers | **PROVEN** | P0.3 (real opencode-go inference through Covert), P0.4 (real governed external mission), P0.8 external leg (real inference, handoff consumed) |
| Replaceable workers (local↔external↔local) | **PROVEN** | P0.8: all 13 verdicts true on one continuous mission |
| Skills / SOP intelligence | **PROVEN** | P0.5 4/4 (bounded discovery, correct selection, irrelevant exclusion, stage-aware); golden mission `[SKILL CONTEXT]` |
| Workflow continuity | **PROVEN** | Workflow creation route + stage→context block + receipt lineage |
| Restart continuity | **PROVEN** | P0.7: cold shutdown → restart → continuation + handoff from disk → consume-once → done |
| Authority | **PROVEN** | Route authority coverage (0 conflicting, 0 unclassified); owner-approved mutations; deny paths exercised across suites |
| Harness | **PROVEN** | P0.6 evidence-gated transitions (claim without evidence rejected); harness verification states honest |
| Veritas | **PROVEN** | Release-evidence affirmative-pass gate; CI veritas gates; honest `unavailable` semantics in golden mission |
| Mission Receipt | **PROVEN** | P1 receipt battery + golden mission receipt (runs/verification/limitations/evidence_refs from canonical truth) |
| Health supervision | **PROVEN** | P1 health battery (PID-is-not-health, stale bookkeeping DEGRADED) + live route |
| Resource admission | **PROVEN** | P1 admission battery (Resident priority, QUEUE/REFUSE with reasons) + live route |
| Provider switching | **PROVEN** | worker-handoff-live 8/8 (no authority/secret transfer), P0.8 |
| Capability Center (UI) | **PARTIAL** | Presentation layer exists (Luna lane); backend Capability Fabric NOT implemented here → do not claim backend capability management |
| Capability Fabric v0.1 | **NOT_PROVEN / POST_CANDIDATE** | Scope spans Authority + plugin substrate; deferred for candidate stability |
| Delegation runtime | **NOT_PROVEN / POST_CANDIDATE** | DELEGATION-CONTRACT.md (POST_CANDIDATE, truthful NOT_READY) |
| Cross-project isolation | **PROVEN** | P11: cross_project_leak 0 (8/8 verdicts) |

## False-success battery mapping (adversarial controls → evidence)
| Control | Evidence |
|---|---|
| Worker claims complete without evidence | P0.6: claim rejected, stage unchanged |
| Failed test presented as success | Veritas gate requires affirmative pass; `veritas_not_passed` blocks |
| Stale evidence | Receipt/verification read canonical files at request time (no caching of verdicts) |
| Wrong-project evidence | P11 isolation: receipt/runs/handoffs empty across projects |
| Wrong-mission evidence | Receipt filters by mission id; unrelated runs excluded |
| Authority denied but worker claims permission | worker-handoff-live: consumed authority does not transfer; route authority coverage |
| Missing test file | Battery guard selftest: missing requested file → FAIL |
| Expected test count shortfall | Battery guard selftest: observed < expected → FAIL |
| Tool exit 0 without expected observation | Mission receipt distinguishes process exit from executed-and-passed tests (golden: supported_conclusion null) |
| Handoff from wrong project | P11: get/consume across projects → 404 |
| Unsupported VERIFIED claim | Golden mission: `no_unsupported_completion` true (receipt refuses) |
