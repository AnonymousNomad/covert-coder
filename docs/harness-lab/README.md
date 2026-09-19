# Harness Lab

Evidence infrastructure around the ONE Covert Harness. It makes the harness
**measurable**; it does not change harness execution semantics.

```
TASK -> context/methodology -> authority -> ONE Covert Harness -> model
     -> objective verification -> performance event -> ledger -> passports
```

## Components

| Component | Location | Purpose |
|---|---|---|
| Performance event contract | `common/contracts/performance.ts` | Versioned (`schema_version: 1.1`) strict observation schema: run/model/machine/operating_mode/methodology/task/execution/verification/outcome/provenance — plus context economics, Veritas outcome, and loaded methodology |
| Local ledger | `node/src/services/performance-ledger.ts` | Append-only JSONL with a sha256 chain (`seq`/`prev_hash`/`hash`), secret-shape rejection, corruption detection, bounded queries; v1.0 history stays readable |
| Model qualification | `node/src/services/model-qualification.ts` | Bounded FUNCTIONAL probe (echo/JSON/arithmetic + degeneracy detection) per artifact+quant+runtime+context+profile identity; failures persist and are excluded from qualified candidates |
| Model Passport | `node/src/services/model-passport.ts` | DERIVED projection (counts/rates/medians) per performance identity with qualification-aware evidence classes — never raw truth, never a fabricated score |
| Operating modes | `common/contracts/harness-modes.ts`, `harness/modes.mjs` | Typed loadouts for one harness; deterministic composition; constraints accumulate, budgets tighten, status is the weakest component |
| Battery v1 | `harness/lab/tasks.json`, `harness/lab/battery.mjs`, `harness/lab/fixtures/` | 8 objective tasks (7 text-fixture + 2 execution-verified; `bug-repair` and `regression-test` run real code) |
| Veritas outcomes | `harness/lab/veritas-outcome.mjs` | VERIFIED / FAILED / ABSTAINED / NOT_CONTRACTED from deterministic execution evidence via the existing Veritas gates |
| Live runner | `scripts/harness-lab.mjs` | Drives the real supervised stack through approved exact operations for every model/task; qualifies first, skips failed configurations, re-pairs on authority session expiry |
| Query surface | `GET/POST /api/harness-lab/*` | Read-only: events, passports, passport, qualifications, modes, composed mode, evidence recommendation; `POST /api/harness-lab/qualify` is the one governed execution |

## Data location (local by default)

Everything accumulated lives under `<repo>/.aide/harness-lab/` (gitignored):

- `performance-events.jsonl` — the ledger
- `passports.json` — persisted projection
- `runs/<run>/.../response.txt|checks.json|meta.json` — per-task evidence
- `day-zero-*.json` — baseline snapshots
- `inventory.json` — model eligibility record for this machine

The repository ships schemas, implementation, tests, fixtures and docs.
The operator's measurements never enter git.

## Running the baseline battery

```powershell
node scripts/harness-lab.mjs                                   # all eligible models, harness on
node scripts/harness-lab.mjs --models=smollm2-360m,lfm2.5-1.2b
node scripts/harness-lab.mjs --variant=no-harness --label=raw  # exploratory A/B
node scripts/harness-lab.mjs --keep                            # keep copied artifacts/models
```

The runner copies candidate artifacts into `models/` (gitignored), registers
and starts them through the governed Covert path, sends every task through the
production chat route with the production harness scaffold, verifies
objectively, appends one performance event per task, then derives passports and
writes a snapshot. It cleans up model copies unless `--keep`.

## Laws

1. **No fake scores.** Only counts, rates, and medians over observed events.
   Insufficient evidence is labeled `INSUFFICIENT`, never invented.
2. **Identity separation.** Quantization, artifact hash, runtime and configured
   context are part of the performance identity; materially different
   configurations are never blended.
3. **No self-grading.** Verification is fixture checks, executed candidate
   artifacts, repository state, and command outcomes. A model never grades a
   model.
4. **Privacy.** Events store IDs, hashes, references and safe measurements.
   Strict schemas reject unknown fields (raw prompts, reasoning, keys) and a
   secret-shape scan rejects credential-looking content before it is written.
5. **Read-only recommendations.** `POST /api/harness-lab/recommend` answers
   which models have evidence for a task class; it never routes production
   workloads and never labels a model "best".
6. **One harness.** Modes are loadouts over the existing registries (workflow
   stages, skills categories, `harness/sops.json`, operation-policy kinds).
   Composition may narrow permissions; it may never loosen them.
