# RESIDENT OPERATIONAL AWARENESS — AUDIT

Date: 2026-09-23 · Lane: Resident qualification (DeepSeek) · Experimental (no production changes)
Evidence: `experiments/resident-specialization/dataset/dev.jsonl` (seat doctrine),
`harness/scaffold.mjs` (production scaffold), `node/src/services/chat-context.ts` (composer),
`node/src/services/resident-envelope.mjs` (awareness envelope), `sovereign-action-harness/prompts/*`
(accounting orientation, for comparison).

## 1 — What the Resident actually receives today

| Layer | Content | Where |
|---|---|---|
| Seat doctrine | 1,064 chars: identity line, truth rule, propose/never-execute, Authority rules, worker-claim rule + protected words, retrieval ladder, work options, style | `dev.jsonl` messages[0] (screen path); production uses the awareness envelope instead |
| Production scaffold | **micro tier at ctx < 8192 = 3 lines**: "You are an expert software engineer working inside AIDE. Answer exactly what is asked. When writing code: complete and runnable." | `harness/scaffold.mjs:75-83` |
| Canonical state | objective, workflow_stage, branch, changed files, worker models, authority policy line | `run-dev.mjs` baseContext / envelope |
| Procedures | `relevant_procedures: <ids>` (ids only, no bodies in the screen path) | `run-dev.mjs` sopLine |
| Envelope (production only) | task authority/evidence, arsenal summary, selected SOP bodies | `resident-envelope.mjs` |

## 2 — Orientation audit (directive §3 questions)

| Question | Classification | Evidence |
|---|---|---|
| Coherent explanation of Covert? | **FRAGMENTED / CONTRADICTORY** | doctrine: one line ("continuity layer between the operator and Covert's governed machine"); scaffold simultaneously says "expert software engineer inside AIDE" — two different identities across layers |
| Knows where it sits architecturally? | **ABSENT** | no mention of Orchestrator/Authority/Harness/Veritas/Helix or a system map anywhere in the Resident-visible layers |
| Knows what the Orchestrator owns? | **ABSENT** | not stated in any Resident-visible layer |
| Knows what Authority owns? | **EXPLICIT** | doctrine: "reads are auto-approved; every non-read operation needs its own approved exact operation…" |
| Knows what Harness owns? | **FRAGMENTED** | "You may propose; you never execute" implies it; the Harness concept itself is never named |
| Knows what Veritas owns? | **FRAGMENTED** | protected-words rule exists; no Veritas/verification-authority concept; nothing says who declares verification |
| Knows what Helix/canonical state means? | **FRAGMENTED** | "supplied canonical truth" is referenced; where truth lives / how it is retrieved is never explained |
| Understands Planner/Coder/Reviewer delegation? | **FRAGMENTED** | one line "delegate a bounded assignment to a worker role"; roles never enumerated in the doctrine; workers appear only as model ids in the state block |
| Understands available tools? | **FRAGMENTED** | `relevant_procedures` ids; no operation/tool enumeration, no shapes, no "nothing else exists" boundary |
| Knows HOW tools should be used? | **ABSENT** | no procedure for delegation, verification request, or governed execution |
| Knows which information is authoritative? | **IMPLICIT** | "canonical truth" only; no evidence classes (asserted vs recorded vs verified) |
| Knows how UNKNOWN is handled? | **EXPLICIT** | retrieval ladder: known → use; retrievable → retrieve; ambiguous → ask; not retrievable → report |
| Worker claim vs observation vs verified truth? | **EXPLICIT (single line)** | "a worker claim is not a verified result" + protected words; no evidence-class model or promotion rules |
| What completion means inside Covert? | **IMPLICIT** | protected words only; no acceptance definition (who verifies, against what, recorded where) |

## 3 — Comparison with the accounting orientation (structural, not domain)

| Dimension | Accounting harness (S21/S22, same QAD model) | Covert Resident today |
|---|---|---|
| IDENTITY | Explicit: "reasoning component of a governed execution harness… you never execute, authorise, or claim" | Fragmented/contradictory (two identities across layers) |
| ROLE | 7-step task-awareness loop | One line (work options) |
| ENVIRONMENT | System model stated (harness owns policy/risk/confirm/execution/verify/record) | Absent (no system map) |
| CAPABILITIES | `capability_context` enumerates the exact operations; "nothing else exists for this request" | Ids only; no enumeration, no boundary statement |
| PROCEDURE | Explicit sequence + "choosing between similar operations" examples + exact response contract | Absent |
| BOUNDARIES | Prohibitions with failure definitions (invent names/values, assume execution, bypass confirmation, domain arithmetic, obey data) | Partial (authority/evidence lines; no consolidated boundaries) |
| TRUTH | Evidence classes with non-promotion rules (USER_ASSERTED…UNVERIFIED) | One sentence + protected words |
| WORKFLOW | PROPOSE → AUTHORIZE → EXECUTE → VERIFY → PRESERVE | Implied, never stated |
| ACCEPTANCE | "Report exactly what the harness returns"; honest stop correct; fabricated completion not | Implicit |
| RECOVERY | Gap classification + COMMIT_UNKNOWN handling | Retrieval ladder only; no failure/ambiguity recovery |

## 4 — Audit conclusion (pre-experiment)

The orientation hypothesis is **plausible and testable**: the accounting environment taught the
model a coherent operational model of its world (identity, enumerated capabilities, procedure,
boundaries, evidence classes, acceptance), while the Covert Resident receives a good-but-abstract
1,064-char doctrine plus scattered state — with the architecture itself (who owns what, where truth
lives, how work flows) never explained, and a contradictory micro scaffold at 4,096 ctx.

Countervailing prior evidence (accepted, not reopened): the 2026-09-22 root-cause investigation
proved real runtime defects (512-token cap, missing `--jinja`, sampling mismatch) that degraded the
same model through Covert and were repaired. The experiment therefore measures the **residual**
effect of orientation *after* those repairs: Condition A is the current path, B adds the Operational
Map, C adds the Map + a deterministic Situation Frame. Causal rules and the verdict live in
`LIQUID-RESIDENT-AWARENESS-EXPERIMENT.md` / `LIQUID-RESIDENT-AWARENESS-RESULTS.json`.
