# Harness Lab — Day-Zero Baseline

The frozen identity future harness versions are measured against.

## Baseline identity

| Field | Value |
|---|---|
| Covert SHA | `600b91c710aeb497eaaf00f6f3284aacc546a2c0` (harness-intelligence-v1 branch base) |
| Harness version | `2.1.0` (`HARNESS_VERSION`, `harness/scaffold.mjs`) |
| Credo version | `1.1.0` |
| Battery | `harness-baseline-v1@1.0` (8 tasks, `harness/lab/tasks.json`) |
| Operating mode | `software-engineering` |
| Machine profile id | `eaf42e5b76cdc63f` (CPU/RAM/GPU digest; recomputed per host) |
| Harness run id | `day-zero-harness-2026-09-19T13-53-21-246Z` |
| Raw variant run id | `day-zero-no-harness-2026-09-19T20:20:39Z` (workflow `harness-baseline-v1-no-harness`) |

Event-level results live in the local ledger (`<repo>/.aide/harness-lab/`);
snapshots are `day-zero-harness-snapshot.json` and
`day-zero-no-harness-snapshot.json`. They are not committed.

## Fair comparison protocol

Every tested model runs the SAME task text, harness SHA, context budget
(2048), sampler (temperature 0), tool set (none model-facing; verification
executes fixtures), authority policy (one approved `POST /api/chat` per task),
and verification contract. No per-model tuning. Arms:

- **harness** — production chat path with the production scaffold (default)
- **no-harness** — identical task with `harness: false` (exploratory A/B)

## Day-Zero models (this machine)

| Model | Artifact sha256 (head) | Verdict |
|---|---|---|
| SmolLM2-360M-Instruct Q8_0 | `48ab3034d0dd401f` | ELIGIBLE |
| LFM2.5-1.2B-Thinking Q4_K_M | `7223a2202405b02e8` | ELIGIBLE |
| Qwen2.5-Coder-3B-Instruct Q4_K_M | `58c3aaf5a98c9ecc` | ARTIFACT-INVALID (direct engine probe returns a garbage token stream; engine reports a malformed tokenizer token type) |
| Phi-3-mini-4k Q4_K_M | — | ARTIFACT-INVALID (direct probe degenerates) |
| Qwen3-4B-MiniMax-Coder Q4_K_M | — | NOT-EVALUATED (thinking model exhausts the probe budget) |

Eligibility is recorded in `.aide/harness-lab/inventory.json` (local). Invalid
artifacts are excluded from eligibility but their already-observed events stay
in the append-only ledger, labeled by their own artifact hash; they are never
blended with valid identities.

## Day-Zero observations (all local; n per model = 8 per variant)

- Small local models pass a minority of the battery. The objective tasks
  discriminate: exact-format, artifact-producing, and regression-discrimination
  tasks separate models that follow instructions from models that do not.
- Harness impact is measurable per model and is NOT uniformly positive; the
  exploratory raw/harness pair exists exactly to quantify this per identity
  rather than assume it.
- Every prompt in the default arm reported `drift_reinjected: true` with
  `approx_prompt_tokens` dominated by injected skill/advisory context on a
  task prompt of a few dozen tokens — an accounted harness-cost observation,
  not a correctness defect.
- No event stores prompts, reasoning, or credentials. `veritas_verdict` is
  `null` for battery events because no per-task Veritas call is wired yet;
  deterministic fixture checks own verification for v1.

## Comparing a future harness version

```powershell
node scripts/harness-lab.mjs --label=harness-vB
```

Passports are grouped by performance identity; compare per-identity
completion rates, failure classes, medians, and task-class breakdowns between
`day-zero-*` and `harness-vB-*` snapshots for the same battery version. A
different battery version is not comparable without mapping tasks.

## Known limitations (v1)

- Battery v1 covers 8 fixture tasks; execution-verified coverage is 2 tasks.
- `time_to_first_token_ms`, `input_tokens`, `peak_ram_mb`, `peak_vram_mb` are
  `null` in Day-Zero events (not yet measured by the chat path).
- `tool_calls` counts verifier-executed fixture commands; model-facing tool
  execution (agent-loop path) is not part of battery v1.
- Thinking models may exhaust `max_tokens` inside reasoning; that is measured
  as failure, not corrected per-model.
