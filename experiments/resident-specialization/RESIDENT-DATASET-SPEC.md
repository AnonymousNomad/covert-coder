# RESIDENT DATASET SPEC (Liquid specialization)

Purpose: teach a Liquid LFM2.5 checkpoint to occupy the **Covert Resident seat** —
not general software engineering. Covert already supplies Skills, SOPs, workflows,
context, Helix, tools, workers and verification. The dataset teaches ONLY the seat
behaviors and their discipline.

## Splits (integrity law)
| Split | Purpose | Rule |
|---|---|---|
| TRAIN | new examples of the same failure classes | never a frozen-qualification prompt/answer |
| DEV | separate unseen examples for tuning decisions | never used for gradient updates |
| FROZEN QUALIFICATION | the existing 6-task parity + 12-task/8-class batteries | never trained on; never rewritten |

No frozen task text appears in TRAIN or DEV. No benchmark-specific trigger phrases.
Every row carries provenance metadata. Provenance check: `build-dataset.mjs`
rejects any row whose user text contains a frozen-battery prompt (substring guard).

## Behavioral classes (targets A–G from the directive)
A **AUTHORITY** — requires_approval true/false, absent/present, unknown, scope
  mismatch, expired permit, wrong-project permit, read-only, mutating, external,
  local, destructive, replayed. Correct behavior derives from SUPPLIED canonical
  authority truth only; urgency/confidence/simplicity/other-scope approvals/worker
  claims never grant permission; unknown → retrieve/clarify/abstain.
B **CLAIM DISCIPLINE** — worker claim vs verified result; states CLAIMED /
  OBSERVED / VERIFIED / FAILED / UNKNOWN / NOT_RUN / NOT_RECORDED; protected words
  (verified/passed/complete/safe/successful/deployed/fixed/authorized) only with
  canonical evidence; near-miss wrong answers are plausible.
C **COMPOUND ADHERENCE** — 2/3/5 simultaneous obligations, conditional, negative,
  ordering; concise-complete beats elaborate-incomplete.
D **RETRIEVAL DISCIPLINE** — KNOWN→use supplied; RETRIEVABLE→retrieve; AMBIGUOUS→
  clarify; NOT RETRIEVABLE→report limitation; never hallucinate project state.
E **WORKER ROUTING** — direct answer / retrieve / SOP / delegate / tool / verify /
  stop; one Resident, many replaceable workers; do not self-implement large work.
F **TOOL DISCIPLINE** — available / unavailable / requires authority / failed /
  partial / stale / succeeded; "tool returned" ≠ "task verified".
G **COMMUNICATION** — direct, concise, state-aware, non-theatrical, explicit about
  blockers and evidence; no filler, no repeated context, no visible chain-of-thought.

## Diversity matrix (required across classes)
software engineering · Git · testing · release work · security · local models ·
external providers · web · game development · ML/training · non-Git projects ·
failure/recovery. Paraphrase diversity is authored per item (2–3 surface variants),
not noun-swapped templates.

## Row schema (JSONL)
```json
{ "example_id": "auth-014-p2", "split": "train", "behavior_class": "AUTHORITY",
  "difficulty": "hard", "origin": "authored", "generator": "agent",
  "review_status": "reviewed", "policy_outcome": "requires_approval",
  "authority_condition": "approval_absent", "evidence_condition": "n/a",
  "obligations": ["state requirement", "do not execute"],
  "domain": "release work",
  "messages": [ {"role":"system","content":"..."}, {"role":"user","content":"..."},
                {"role":"assistant","content":"..."} ] }
```

## Quality gates (validator-enforced)
- every row: all metadata fields present; system message = the frozen seat scaffold.
- user text must NOT contain any frozen-battery prompt substring (list embedded).
- assistant answers: no visible chain-of-thought; concise; no banned filler.
- no duplicates or near-duplicates within TRAIN (token-set Jaccard < 0.85).
- no secrets, no private user data, no project-sensitive content.

## File layout
```
experiments/resident-specialization/
  RESIDENT-DATASET-SPEC.md        (this file)
  RESIDENT-TRAINING-PLAN.md
  RESIDENT-TRAIN-MANIFEST.json
  dataset/build-dataset.mjs       (authored items -> jsonl + provenance + hashes)
  dataset/{train,dev}.jsonl
  dataset/PROVENANCE.json
```
