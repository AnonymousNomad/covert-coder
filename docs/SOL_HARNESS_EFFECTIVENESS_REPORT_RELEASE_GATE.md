# SOL RELEASE GATE — HARNESS EFFECTIVENESS REPORTING

Date: 2026-10-01
Owner: James Ferrell
Target: Covert Coder release convergence
Branch: nightshift/production-convergence-20260926

## Directive

Covert must not ship with harness effectiveness existing only as scattered scripts, historical Markdown, raw JSON, or internal claims.

Create and verify a canonical evidence-report path that shows what the SAME model does:

- without Covert guidance/harness intervention;
- with bounded Covert guidance/harness intervention;
- and, separately, through progressively more complete Covert system layers.

The objective is not marketing. The objective is reproducible evidence that can be inspected by the operator, contributors, grant reviewers, sponsors, researchers, and users.

Do not collapse different interventions into one "harness improvement" number.

## Existing evidence that must be preserved and reconciled

The repository already contains:

- `scripts/run-harness-battery.mjs`
  - paired local-model scaffold ablation;
  - explicitly measures prompt scaffold ON vs OFF;
  - explicitly does NOT measure the entire agent/tool/Authority/Veritas harness.
- `benchmarks/context-ablation-v1.mjs`
  - locked task/grader basis for the paired scaffold battery.
- `docs/evidence/harness-battery-qwen15b-full.md`
  - historical ON/OFF evidence.
- `docs/audit/intelligence-spine/BENCHMARK_PLAN.md`
  - proposed A-E system ablation methodology:
    A raw model;
    B + project context;
    C + selected skills;
    D + orchestrator;
    E full Covert harness.
- `skills/packs/aide-harness-prompt-scaffolding/SKILL.md`
  - requires fixed paired with/without evaluation and forbids cherry-picking.

Treat these as inputs and historical evidence, not proof that the current convergence product has completed this release gate.

## Required reporting layers

### Layer 1 — Prompt/scaffold ablation

Run the exact same model artifact under controlled paired conditions:

A. scaffold/guidance OFF
B. scaffold/guidance ON

Pin and record:

- model ID and exact artifact hash;
- quantization;
- runtime and runtime version;
- scaffold version/fingerprint;
- grader version;
- suite ID/version;
- context window;
- sampling parameters and seed;
- hardware/resource snapshot;
- task order seed;
- repeats;
- wall time;
- token usage when available.

Report:

- pass count and pass rate for OFF;
- pass count and pass rate for ON;
- absolute delta;
- treatment wins;
- baseline wins;
- ties;
- invalid responses;
- timeout/error counts;
- failure categories;
- per-task paired outcome;
- token/latency cost delta;
- regressions introduced by the scaffold;
- unchanged failures;
- confidence/uncertainty where the sample supports it.

Never call this "full harness effectiveness." Label it accurately as scaffold/guidance ablation.

### Layer 2 — Full-system ablation

Implement or complete the controlled A-E ladder already specified in `BENCHMARK_PLAN.md`:

A. Raw model + minimal format contract
B. A + project context
C. B + selected skills
D. C + orchestrator
E. Full Covert system path: memory/permissions/tools/repair/reviewer/verification as applicable

Use the same pinned model and controlled fixtures.

Where E has more tools or compute than A, report that explicitly. Do not attribute total-system gains solely to "better reasoning."

Also preserve a controlled-tool/compute comparison so the effect of guidance/orchestration can be distinguished from simply giving one arm more capabilities.

### Layer 3 — Product/operator report

The operator must be able to obtain a guided report from Covert without manually reading raw JSON.

At minimum provide:

- run identity;
- date/time;
- model identity + hash;
- hardware/runtime identity;
- intervention/arm definitions;
- task-suite identity;
- methodology summary;
- paired results table;
- per-task drill-down;
- gains;
- regressions;
- unchanged failures;
- invalid/unavailable/skipped outcomes;
- token/cost/latency impact;
- known limitations;
- exact claim the evidence licenses;
- claims the evidence does NOT license;
- links/paths to raw evidence;
- reproducibility command/config;
- integrity hashes for report inputs.

The report should be exportable in at least:

- machine-readable JSON;
- human-readable Markdown.

HTML/PDF presentation may be added if it does not become a substitute for the raw evidence.

## Guided interpretation requirement

Covert may explain the report, but it must not hide negative evidence.

Examples:

- "Harness ON improved 4 paired tasks, regressed 1, tied 15."
- "No measurable improvement in this battery."
- "This result measures prompt scaffolding only, not the full execution harness."
- "Authority refusal remained a model capability failure in both conditions."
- "Latency increased X%; completion accuracy increased Y%."
- "Sample size is too small for a broad generalization."

The interpretation layer must distinguish:

- observation;
- deterministic test result;
- statistical estimate;
- inference;
- unproven hypothesis.

## Anti-cherry-picking law

Every report must preserve the complete denominator.

Do not:

- remove failed tasks after seeing results;
- discard timeouts without counting them;
- publish only categories that improved;
- overwrite historical raw evidence without retaining the run identity;
- compare different model hashes as if they were the same model;
- compare different harness/scaffold versions without labeling the change;
- rerun only the losing arm;
- silently change seeds, context size, quant, runtime, or hardware;
- let the evaluated model grade itself.

If a run is invalid, retain it and label why.

## Current evidence-file problem

Historical evidence currently includes patterns such as `harness-battery-latest.json` being overwritten per run.

For release evidence, each accepted run must receive an immutable run ID and immutable artifact path. A convenience `latest` pointer may exist, but it must not be the only retained evidence.

## Acceptance gates

Sol must prove:

1. Current scaffold ON/OFF runner executes against a real local model and emits immutable structured evidence.
2. Same model/hash/runtime/config is used for both paired arms.
3. Raw responses and grader outcomes can be traced to task/run IDs.
4. Report generator produces deterministic JSON and Markdown from the same evidence artifact.
5. Report includes negative results and regressions.
6. Report explicitly identifies which harness layer was measured.
7. Full denominator is preserved.
8. Historical runs remain identifiable and are not overwritten.
9. At least one current real-model paired report is generated on the convergence lane.
10. At least one report can be opened from the normal Covert product flow or evidence surface.
11. The A-E full-system benchmark path is either implemented and evidenced or explicitly marked OPEN; do not imply the scaffold A/B battery proves full-system effectiveness.
12. Public README/site claims are derived only from accepted evidence and include methodology/limitations.
13. Report artifacts are suitable for external review without exposing private source, secrets, prompts containing sensitive material, or operator credentials.

## Public/professional evidence package

For grant, sponsor, contributor, and technical-review use, produce a clean evidence package containing:

- executive summary;
- methodology;
- exact model/runtime/hardware identities;
- baseline vs treatment tables;
- per-category results;
- complete denominator;
- regressions/failures;
- token/latency/resource cost;
- raw artifact hashes;
- reproducibility instructions;
- limitations;
- date and Covert commit SHA.

The public package must be generated from the same underlying immutable evidence as the operator report. Do not maintain a separate hand-edited marketing truth.

## Architectural law

Harness guidance is an intervention.
Verification is evidence.
Authority is permission.
Tools are capability.
A benchmark is measurement.
A report is interpretation of preserved measurement.

Do not merge these concepts into one score.


## Harness Synchronization relationship

This release gate is part of the Harness Synchronization design, not a separate reporting subsystem.

Harness Synchronization must provide the controlled apparatus that keeps baseline and treatment runs comparable and makes their evidence trustworthy. The synchronized apparatus must own or stamp:

- disposable/isolated workspace identity;
- exact task fixture revision;
- allowed-path policy;
- hidden evaluator/test identity and exact test count;
- model artifact identity and hash;
- runtime identity/version and runtime lease/lock state;
- scaffold/harness version;
- context/config/sampling settings;
- authority/tool-policy configuration;
- resource snapshot;
- run ordering/seeds/repeats;
- patch validation and final-tree capture;
- raw responses/results;
- evaluator outcomes;
- immutable evidence artifact IDs.

The report generator consumes those synchronized run artifacts. It must not reconstruct missing state after the fact.

A synchronized comparison is invalid if one arm changes any material variable that the other arm did not, unless that variable is the declared intervention under test. Any such mismatch must be surfaced in the report as a comparability failure rather than hidden inside an aggregate score.

The intended flow is:

`Harness Sync apparatus -> paired/multi-arm execution -> hidden evaluator -> immutable evidence -> guided report -> public/professional evidence package`

This preserves the original Harness Sync purpose: prove what changed, why the comparison is fair, and whether Covert actually improved the outcome rather than merely changing the environment.

