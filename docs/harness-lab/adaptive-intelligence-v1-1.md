# Adaptive Intelligence v1.1 — Qualification, Context Economics, Veritas-Backed Performance

The P5-independent half of the Adaptive Intelligence campaign. Model Memory
Strands (Helix integration) are **deliberately not implemented here** — see
"Waiting on accepted convergence" below.

## Baseline identity

| Field | Value |
|---|---|
| Base | `8f691d1` (accepted Harness Intelligence v1 tip) |
| Harness version | `2.1.0` |
| Performance event schema | `1.1` (v1.0 records remain readable) |
| Passport schema | `1.1` |
| Qualification schema | `1.0`, probe version `1.1` |
| Battery | `harness-baseline-v1@1.0` (8 tasks; 2 execution-verified) |

## Model qualification (orthogonal to runtime state)

READY means the runtime serves; QUALIFIED means this exact artifact +
quantization + runtime + configured context + profile digest passed a bounded
**functional** compatibility probe (instruction echo, structured transport,
trivial arithmetic, degeneracy analysis). Mediocre answers qualify; empty or
decode-corrupt generators do not. Failures persist, stay inspectable, and are
excluded from qualified routing candidates — artifacts are never deleted.

Day-Zero live results (through Covert, governed operations):

| Model | State | Failure class | Evidence |
|---|---|---|---|
| SmolLM2-360M Q8 | QUALIFIED | — | 3/3 probes |
| LFM2.5-1.2B-Thinking Q4 | QUALIFIED | — | probe budgets raised to 256/256/128 so reasoning models are not failed for thinking before answering (verified: answer at token 174) |
| Qwen2.5-Coder-3B Q4 | QUALIFICATION_FAILED | `degenerate_output` | direct engine probe returns a garbage token stream; engine reports a malformed tokenizer token type (`control-looking token 128247 '</s>' was not control-type`). Structural GGUF parsing succeeds — this is tokenizer-metadata incompatibility in the artifact, not proven file corruption |
| Phi-3-mini Q4 | ARTIFACT-INVALID (unqualified) | — | degenerate direct probe (prior campaign) |

A configuration that fails qualification with **no benchmark events** still
gets a passport (evidence class `QUALIFICATION_FAILED`, sample size 0) so
history remains inspectable.

## Context economics

Every composed prompt is accounted per source with `EXACT`/`ESTIMATED` labels;
totals are replaced by the engine's own `/apply-template` + `/tokenize` count
when the runtime exposes it.

Live example (58-token user request, smollm2):

| Source | Tokens (ESTIMATED) |
|---|---|
| SYSTEM_SCAFFOLD | 52 |
| RESIDENT | 363 |
| SKILL_CONTEXT | 939 |
| USER_REQUEST | 58 |
| **Exact engine total** | **1662** (`EXACT`; includes chat-template overhead) |
| double_count_ok | true |

Root cause of the v1 under-reporting: metadata reported only the chars/4 total
and the scaffold bytes, so the dominant injected blocks (skills advisory +
resident context) were invisible. They are now attributed per source, and the
honest gap between source estimates and the exact template total is visible
rather than hidden.

**Drift reinforcement** previously fired whenever the *total* estimate crossed
50% of the window — including the methodology/advisory injections themselves,
which produced a false positive on short prompts with rich methodology. It now
measures **conversation domination** (user + history) and keeps firing for long
transcripts (verified: short prompt + 939-token advisory → `drift_reinjected:
false`; 30-turn conversation → `true`).

## Veritas-backed performance

Executable tasks declare a Veritas contract (`code-change` +
`require_tests`). Observations carry a Veritas outcome derived from real
execution evidence through the existing `harness/veritas.mjs` gates:

- `VERIFIED` — deterministic checks and executed tests passed the threshold
- `FAILED` — deterministic evidence of failure (never a worker's claim)
- `ABSTAINED` — checks passed but required evidence (tests) was not executed
- `NOT_CONTRACTED` — task has no Veritas contract (text-only fixture tasks)

Day-Zero: all execution-verified tasks ended `FAILED` for both qualified
models; text tasks are `NOT_CONTRACTED`. No observation is ever upgraded to
verified success by a model's own "done" message.

## Benchmark observations (Day-Zero v1.1, n=8 per model per variant)

| Model | Harness | No-harness (4-task subset) |
|---|---|---|
| SmolLM2-360M | 1/8 (terminal discipline) | 0/4 |
| LFM2.5-1.2B | 1/8 (authority discipline) | 1/4 |

The A/B subset is exploratory (n=4) and establishes direction only: the
harness was neutral-to-positive here; no statistical claim is made. The
"harness + workflow + SOP/skills" arm (C) is not separately selectable in the
chat path today — the loaded methodology is reported through
`methodology.loaded` from what was actually injected — and is recorded as a
gap for the methodology loader work.

## Waiting on accepted convergence (Phase 5 gate)

Model Memory Strands and all Helix-dependent phases are **BLOCKED** per the
campaign rule: no backend-convergence branch containing P5 (`9e71bf9`) has
been published yet.

Evidence (2026-09-19): `git branch -r --contains 9e71bf9` → only
`origin/p5/memory-continuity`; `origin/integration/production-closure`
(`0bfdb1e`) does **not** contain it; the lane base `8f691d1` does not contain
it. P5 was not recreated independently.

Integration plan when the branch lands: merge the accepted convergence branch
into `feat/adaptive-intelligence-v1-1`, run the P5 focused tests
(>500-entry continuity, bounded retrieval, supersession, workspace isolation,
restart continuity, secret exclusion), then implement Model Memory Strands as
governed namespaces over the Memory Spine storage primitive with the
cross-model / projection / handoff layers of the campaign spec.

## Limitations

- Qualification is a bounded functional probe, not an intelligence measure.
- Per-source context costs are estimates; only the engine total is exact.
- `reasoning_reserve_tokens` is `null` (UNKNOWN) — llama-server exposes no
  reasoning split; nothing fabricated.
- Battery text tasks use fixture expectations; only execution tasks carry a
  Veritas contract.
- One host, one runtime (llama-server CPU), single sample per task.
