# RESIDENT-WORKER-CONTRACT

The bounded assignment contract the Resident lane uses to delegate. Workers are
replaceable; the contract is what makes them substitutable.

## Assignment fields (buildWorkerAssignment)
| Field | Meaning | Law |
|---|---|---|
| `objective` | the operator-level goal (never the transcript) | required |
| `workflow_stage` | canonical stage context | required |
| `requested_role` | planner / coder / reviewer / specialist | required |
| `task` | the bounded task text (what to do, what to return) | required |
| `constraints` | prohibitions (no test edits, no placeholders, …) | bounded list |
| `canonical_project_state` | the minimum reconstructed state | compact string |
| `required_skills` | SOP ids selected deterministically | ≤2 bodies loaded |
| `required_evidence` | what the result must be judged by | explicit |
| `authority_requirements` | always `proposal-only` | enforced (throws otherwise) |
| `return_contract` | e.g. "one fenced code block", "numbered plan" | explicit |
| `scratchTarget` | the authorized target the caller may apply to | caller-owned |
| `execution_evidence` | real execution results for the reviewer | required for reviewers |

## Laws
1. **Proposal-only**: workers never write files, never execute commands, never hold
   authority. The caller applies accepted proposals to an authorized target.
2. **No transcript**: the assignment carries reconstructed state, not conversation.
3. **Methodology routing**: SOP bodies are selected deterministically (score ≥ 5.0
   strong, class fallback) and injected into the assignment, not memorized.
4. **Evidence-bearing review (REVIEW-01)**: the reviewer receives objective,
   acceptance criteria, the change, and `execution_evidence`. The coder's narrative
   is never evidence.
5. **Deterministic verdict ownership**: the authoritative verdict comes from the
   deterministic execution gate (`harness/veritas.mjs` + explicit checks). An
   advisory model opinion (PASS) cannot override a deterministic FAIL — proven live
   in M1 and M2 (deterministic=FAIL | advisory=PASS).
6. **Bounded recovery**: at most two recovery attempts per failure, each with a
   recorded reason and expected benefit (no model thrashing).
7. **Fail closed**: exhausted recovery, missing authority, or contradictory state
   ends the mission with an operator decision, never with an invented success.

## Role contracts (harness/sops.json)
`reason` (planner) · `build` (coder) · `verify` (reviewer, must_not approve-own-output)
· `operator` · `archivist`.
