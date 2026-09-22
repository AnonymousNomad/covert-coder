# MODEL-NEUTRAL WORKER DELEGATION — CONTRACT MAP + DISPOSITION

Date: 2026-09-22 · Lane: `audit/wiring-ledger` · Status: **REGISTERED — smallest canonical contract identified; runtime NOT built (candidate not delayed, per addendum escape clause)**

## The canonical owner already exists
The requested `delegate_worker({...})` capability maps onto the **existing subagent dispatch contract**, which is already live as a truthful contract surface in production:
- Contract: `common/contracts/agent.ts` — `AgentSubagentSpawnRequest` / subagent role enum (`researcher, coder, tester, reviewer, documenter, custom`).
- Routes: `node/src/routes/agent.ts` — `POST /api/agent/subagent/spawn|list|status`; today all three return **truthful `NOT_READY` "subagent dispatch not wired on this instance"** (the contract is the wire-in; the runtime is deliberately deferred).

Therefore: **Covert owns delegation** (the routes + contracts), not any model. No new Resident, no new agent catalog, no parallel orchestrator is required — the missing piece is the child-loop runtime behind the existing contract.

## Mapping (request -> existing contract)
| Requested | Existing canonical |
|---|---|
| `objective` | `AgentSubagentSpawnRequest.task` |
| `capability` (coding/review/recon/testing/security/documentation/verification) | subagent role enum (extensible; role→worker/model chosen by Covert routing) |
| `acceptance_criteria` | spawn request fields + child Context Envelope |
| `parallelizable` / fan-out | parent/child lineage + `max concurrent workers` policy (to be enforced at the runtime) |
| `context_requirements?` | child **Context Envelope** built by the existing providers (memory/RAG/evidence/workflow/skills) — never a transcript clone |
| result contract (`result, artifacts, evidence, verification, limitations, handoff`) | child session's existing governed outputs (trajectory + verification record + handoff envelope) |
| delegation outcomes (ACCEPTED/QUEUED/REFUSED_*/UNAVAILABLE) | to be added as the runtime's truthful statuses (no silent failure) |

## Governance requirements (binding for the runtime lane)
max delegation depth · max concurrent workers · resource admission (Resident priority; RAM/VRAM doctrine) · provider budget · parent/child lineage · cycle prevention · timeout · cancellation · authority scope (child = canonical policy→Authority→Harness→Veritas; spawning grants **no** authority) · process ownership (Wave 10A ownership rules apply to child engines) · evidence return · child claims not canonical truth.

## Why not built tonight
- The necessary orchestration substrate (child agent-loop dispatch, lineage store, admission policy) is not wired; building it ad hoc would create the very competing subsystem the doctrine forbids.
- The addendum explicitly permits delay: "Do not delay the current release candidate for a large multi-agent expansion if the necessary orchestration substrate is not yet safe."
- The smallest canonical step (contract identification + governance list + truthful NOT_READY surface) is already satisfied by the existing subagent routes.

## Proof obligations carried forward (unchanged, for the delegation lane)
1. local model requests a reviewer worker · 2. external model requests a bounded worker · 3. selection differs from requester · 4. bounded child context (no transcript dump) · 5. result returns to parent · 6. Authority enforced · 7. Veritas authoritative · 8. recursion/resource limits reject unsafe fan-out · 9. restart preserves lineage where required · 10. changing providers does not change the contract.
