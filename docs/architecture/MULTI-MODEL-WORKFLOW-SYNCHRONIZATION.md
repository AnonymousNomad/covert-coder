# Multi-Model Workflow Synchronization

- **Status:** DESIGN / CONTRACT ONLY. This document answers `docs/v1/COVERT-V1-RELEASE-MATRIX-ADDENDUM-001.md` ADD-001 and defines the synchronization contract remote missions depend on.
- **Parent:** `docs/architecture/REMOTE-OPERATOR-CONTROL-PLANE.md`.
- **Canonical owner:** Orchestrator/Workflow Engine owns transitions. Models propose. Authority permits. Admission admits. Veritas accepts. Resident reports.
- **Frozen references:** `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.md` rows C1-11, C1-12, C1-13, C1-14, C3-15, C3-16, C3-18, C3-19, C3-21, C5-23, C7-13, C7-15, C7-16, C7-30, RELS-03, RELS-04; ADD-001.

## 1. Required sequence and current support (FACT)

Required: `Resident → mission creation → planner → coder → deterministic verification → reviewer → bounded repair → reverification → acceptance → Resident reporting`.

| Element | Current status on base | Evidence |
|---|---|---|
| Resident | observation-only, zero mutating routes | `node/src/routes/resident.ts:31-34` |
| Mission creation | MISSING | C2-11; no mission entity |
| Planner/coder/reviewer roles | PARTIAL (optional role metadata; role→context retrieval) | `common/contracts/agent.ts:29`; `node/src/openapi.ts:505-533` |
| Deterministic verification | PARTIAL (workflow release gate real; agent loop never self-accepts) | C1-12; `agent-loop.mjs:661`; `workflow-service.ts:275-282` |
| Reviewer step | PARTIAL (manual role invocation; no automatic reviewer) | audit; ADD-001 |
| Bounded repair | PARTIAL (continuation manager budgets; no candidate-based repair of a mission) | `node/src/services/continuation-manager.ts:139-254`; C3-21 |
| Handoffs | IMPLEMENTED + VERIFIED | `tests/arch/worker-handoff-live.test.ts:170-305` |
| Workflow state transitions | IMPLEMENTED + VERIFIED | `workflow-service.ts`; `tests/arch/workflow-service.test.ts` |
| Transition ownership across models | MISSING | ADD-001; no model references in `workflow-service.ts` |
| Immutable candidate identity | MISSING | no candidate entity anywhere |
| Parallel workers / barriers | DESIGNED ONLY (subagent dispatch NOT_READY, C1-06) | `node/src/routes/agent.ts:272-280` |
| Worker death/reassignment | PARTIAL (continuation chains exist; not bound to attempts) | `continuation-manager.ts` |
| Long-horizon regression contract | MISSING — V1 REQUIRED | C7-30 |
| Attempt identity | MISSING (C1-14: no `attempt_id` anywhere) | `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.md:75` |

The audit conclusion matches ADD-001: the pieces exist adjacent to each other, but the synchronized chain does not.

## 2. Identities (the core of synchronization)

```ts
type Mission = {
  mission_id: string;               // durable, UUID; the addressable unit for remote control
  workspace_id: string;             // canonical workspace identity
  created_by_actor: string;         // operator or adapter actor
  created_via_request: string;      // ingress request_id (dedupe); null for local
  objective_digest: string;         // sha256 of normalized objective
  policy_ref: string | null;        // permission profile version at creation
  state: 'CREATED' | 'RUNNING' | 'AWAITING_APPROVAL' | 'BLOCKED' |
         'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
  completion: { accepted_verification_ref: string; unresolved_obligations: string[] } | null;
};

type Attempt = {
  attempt_id: string;               // new identity (C1-14 semantics decision)
  mission_id: string;
  role: 'planner' | 'coder' | 'verifier' | 'reviewer' | 'repair' | 'resident';
  predecessor_attempt_ids: string[];
  candidate_id: string | null;      // produced or reviewed candidate
  worker: { kind: 'model' | 'tool' | 'human'; ref: string; model_id?: string; model_digest?: string };
  state: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'SUPERSEDED';
  operation_refs: string[];         // authority operation_ids used by this attempt
  admission_ref: string | null;
  verification_ref: string | null;
  started_at: string;
  ended_at: string | null;
};

type Candidate = {
  candidate_id: string;
  mission_id: string;
  produced_by_attempt: string;
  content_digest: string;           // immutable identity: digest of the exact artifact set
  artifact_refs: string[];
  review: { reviewer_attempt: string; decision: 'APPROVE' | 'REJECT' | 'NEEDS_EVIDENCE'; reviewed_digest: string } | null;
  invalidated_by: string[];         // attempt ids that produced a newer digest
};

type Obligation = {
  obligation_id: string;
  mission_id: string;
  kind: string;                     // e.g. 'test-suite', 'review', 'release-evidence'
  required: boolean;
  state: 'OPEN' | 'SATISFIED' | 'WAIVED' | 'UNRESOLVED';
  evidence_ref: string | null;
};

type MissionTransition = {
  transition_id: string;
  mission_id: string;
  from_state: Mission['state'];
  to_state: Mission['state'];
  actor: string;                    // orchestrator/workflow service actor
  trigger_attempt: string | null;
  operation_ref: string | null;     // Authority operation authorizing side effects
  admission_ref: string | null;
  approval_ref: string | null;      // human approval when required
  evidence_refs: string[];
  reason: string | null;
  at: string;
};
```

Identity rules:
- `mission_id` is durable and addressable by remote status/cancellation. It is never inferred from a chat thread.
- `attempt_id` is new and required by C1-14's semantics decision; `task_id` remains the Authority descriptor key, and `request_id` remains the ingress dedupe key. The three are related, not interchangeable.
- `candidate_id` is immutable identity: any content change produces a new candidate; reviews bind `candidate_id` + `content_digest`.
- Every transition and side-effecting attempt references its Authority `operation_id`, so C5-23's correlation chain is a join, not a narrative.

## 3. Ownership and transition rules

1. **Models propose state; Orchestrator/Workflow Engine owns transitions.** A planner cannot launch the coder; a coder cannot declare completion; a reviewer cannot approve a different candidate digest than the one reviewed.
2. **One writer per mission.** Mission transitions are serialized by the mission store (optimistic revision check). Two devices issuing conflicting requests surface as a transition rejection, never last-writer-wins.
3. **Candidates are immutable.** Repair creates a new candidate (`content_digest` changes) and invalidates the prior review (`invalidated_by`).
4. **Stale review is rejected.** A review transition whose `reviewed_digest` differs from the current candidate's `content_digest` is refused with `STALE_REVIEW`.
5. **Deterministic verification precedes acceptance.** Acceptance requires a passing evidence record (the workflow release-gate semantics, `workflow-service.ts:275-282`): absence of failure is not evidence; abstain/incomplete/unavailable never satisfy acceptance (C1-12). Until the product can write passing verification honestly, acceptance stays CLI/release-gate owned.
6. **Completion requires:** accepted verification AND no `OPEN` required obligations AND no `RUNNING` attempts. False completion is a transition refusal (`FALSE_COMPLETION`), and Resident reports canonical accepted state only.
7. **Repair is bounded.** Reuse the continuation budget model (`common/contracts/continuation.ts:44-86`); exceeding the budget transitions the mission to `PARTIAL`/`FAILED`, not an infinite loop.
8. **Worker death** marks the attempt `FAILED`, records the receipt, and permits reassignment through the continuation manager (existing retry/switch/terminal semantics) — never through silent model substitution. Model identity is recorded per attempt (closes the C1-13 model-id gap when implemented).
9. **Parallel workers** run only with an explicit join barrier: a downstream attempt requires all `predecessor_attempt_ids` to reach a terminal state; partial results are `PARTIAL`, never assumed complete.
10. **Every transition checks Authority and Admission.** Side-effecting attempts carry exact operations (`agent.tool` precedent, `agent-loop.mjs:470-488`); starts pass Resource Admission (C5-19). Denial is a recorded transition (`BLOCKED`), not a hidden failure.
11. **Human approval boundary.** Explicit transitions (stage advancement in the durable workflow, CLASS A/B capability invocation, acceptance when evidence is ambiguous) require an operator decision. Approval binds the exact operation digest; a changed candidate or args invalidates the approval.
12. **Interruption/reassignment** preserves completed work: artifacts stay referenced by digest; obligations are recomputed, never deleted.

## 4. Mapping to existing components (no replacement)

| Contract element | Existing substrate | Required change |
|---|---|---|
| Mission store | none (C2-11) | New durable store (V1.1); must not duplicate workflow `state.json` — workflow remains the project-stage truth, mission is the work unit |
| Transition journal | audit rows + workflow transition events | Extend event types; keep append-only `.aide/cipher-state.jsonl` + workflow state write-ahead |
| Attempt/worker identity | provenance runs, handoffs, continuation chains | Add `attempt_id`; join to `operation_id` and `handoff_id` |
| Candidate identity | none | New; digest of artifact set; ties into reviewer evidence path (`node/src/openapi.ts:514-533`) |
| Obligations | none (C5-23) | New; referenced by mission completion |
| Verification | `.aide/verifications/*.verification.json` + workflow gate | Product must be able to write a truthful passing verification (C1-12) |
| Repair loop | continuation manager | Bind budgets to attempts/candidates |
| Parallel workers | subagent dispatch contract (C1-06, NOT_READY) | Implement or keep serial; contract fixed now |
| Resident reporting | Resident read routes | Report mission state; no mutation (Resident remains non-acting) |

## 5. Remote coupling

- `mission_id` is the canonical target for remote status, cancellation, and notifications.
- REMOTE-009 (mission continues after client disconnect), REMOTE-010 (remote cancellation), REMOTE-014 (worker crash/reassignment), REMOTE-015 (verified completion notification) are the remote acceptance tests that exercise this contract.
- Remote cancellation obeys Section 3 rules: stop new dispatch, cancel interruptible attempts, let atomic work settle, preserve evidence, mark obligations, end in `CANCELLED`/`PARTIAL`.

## 6. Long-horizon invariants (C7-30 clauses)

No project bleed (mission bound to one workspace); no lost obligations (obligation store is durable with the mission); no stale capability/model identity (attempt records model id/digest; capability qualification is checked per transition); no false completion (Section 3.6); no lost verification state (verification refs are durable evidence).

## 7. Release addendum

ADD-001 already records the material gap and the required design invariant. This lane:
- confirms ADD-001's mapping and extends it with the remote-specific obligations (`REMOTE-REQ-*` in `docs/v1/REMOTE-OPERATOR-RELEASE-ADDENDUM.json`);
- does not alter the frozen matrix counts or the ADD-001 text;
- recommends that the multi-model workflow synchronization implementation remains owned by CORE/WORKFLOW-ORCHESTRATOR, with the contracts in this document as the typed interface the remote lane consumes.

## 8. Verification requirements

ADD-001 closure evidence (unchanged, restated): typed DAG and transition contract; bound mission/attempt/role/predecessor/candidate identities and policy receipts; deterministic tests for each transition, parallel barriers, stale review, bounded repair/reverification, interruption/reassignment, Authority denial, Resource Admission denial, human approval, and false completion; Resident reports canonical accepted state only.

Remote additions: REMOTE-009/010/014/015 plus receipts joining `request_id → mission_id → attempt_id → operation_id → verification_ref`.

## 9. Open decisions

1. Mission store location and format (recommend `.aide/missions/<mission_id>.json` + append-only transition journal; ownership CORE).
2. Whether the existing 6-stage project workflow is a projection of the mission layer or a sibling (recommend sibling with explicit linkage: stage transitions remain project truth; mission transitions are work-unit truth).
3. Whether subagent parallel dispatch (C1-06) is implemented in V1 or explicitly serial-only (recommend serial-only until ADD-001 lands).
