---
name: covert-dogfood-evaluation
description: Run a real Covert-builds-Covert coding task and fair model/harness ON/OFF evaluation from a fixed task and independent verifier. Use for first live Resident missions, provider comparisons, benchmark claims, false success, or diagnosing harness effects.
---

# Covert dogfood and paired evaluation

Read `AGENTS.md`, `developer-way`, `aide-agent-harness-convergence`,
`aide-model-sop`, `aide-harness-prompt-scaffolding`, and
`process-hygiene-sop` as relevant. Use the nightshift execution ledger for phase
order. This procedure joins them at the real product edge; it does not override
approval, workspace trust, provider consent, or process ownership.

## Research and rationale

- SWE-bench evaluates a model-generated patch against a fixed base commit and
  issue using tests in a reproducible environment. Use its principle of independent
  executable grading, not its public score as a proxy for Covert quality:
  https://github.com/SWE-bench/SWE-bench/blob/main/docs/reference/harness.md
- The upstream llama.cpp llama-bench reports prompt processing and token
  generation separately and provides repeated measurements. These are speed
  measurements, not coding-success measurements:
  https://github.com/ggml-org/llama.cpp/blob/master/tools/llama-bench/README.md
- VS Code documents workspace trust and agent approvals as distinct boundaries:
  https://code.visualstudio.com/docs/agents/concepts/trust-and-safety

## Preflight and task lock

1. Record branch, SHA, worktree status, hardware, owned process tree, model file
   hash, runtime build, provider ID/model ID and current connection/consent state.
2. Record exact task text, initial fixture SHA, allowed tools, approval policy,
   token/time budget, verifier command and failure criteria before running a model.
3. Use a disposable fixture or a narrowly bounded repository issue. If task
   involves editing Covert itself, snapshot its base and review the proposed diff.
4. Set explicit seed/temperature where supported. Record unsupported parameters.
5. Keep secrets and private prompts out of committed reports. Store traces in an
   approved local location; commit only scrubbed metrics and verifiable receipts.
## Run the product journey

1. Start the supervised daemon/facade pair using the repository helper. Verify
   identity and ports rather than assuming a listening port belongs to Covert.
2. Enter through the actual Resident/agent API or UI, establish workspace trust
   and model selection, and submit the locked task. Exercise approval at its
   governing edge. Observe tool events, patch, verifier and final state.
3. Apply only the approved diff. Run the locked verifier independently on the
   resulting files; examine unexpected edits, denial paths and cleanup.
4. Preserve both successful and failed trials with reasoned failure classes.
5. End owned engines and verify no orphan processes or modified fixture remain.

## Paired comparison

For each fixed task, run harness ON and OFF from the same clean base, same
model weights/version, task, context, tool access, approval policy, budget,
timeout and hardware. Randomize or alternate order and repeat; log temperature,
seed and request parameters. If a control cannot have the same tool affordance,
label it non-equivalent and report separately. OpenCode, Codex and OpenRouter
are different harnesses/provider surfaces; use matched underlying model only
when available and never call a provider gateway a competing IDE.

Use independent executable assertions and manual diff review as the success
criterion. Report pass/fail per run, false-success, safety violations, elapsed
time, first-token latency when available, output/input tokens, memory and
unavailable measurements. Include confidence/variance; a single run is a
smoke test. The current `scripts/run-harness-battery.mjs` is a separate
scaffold-only pilot: ten unique tasks, behavioral grading, a synthetic canary,
and paired prompt-scaffold on/off conditions. Its local fixture checks request
and evidence plumbing only; it is not model evidence. It excludes tools,
Authority, Veritas, retrieval, and other harness products. For agent-level
coding evaluation, use a locked real task, an independent verifier, a reviewed
diff, and the product's Authority/Veritas evidence. Treat the older
`scripts/harness-real-model.mjs` as legacy; its patch-shape and fixture checks
are not release-grade coding proof.
## Dependencies and stop matrix

| Condition | Action |
|---|---|
| Baseline gate fails or integration SHA changes | Stop comparison; diagnose, pin a new base and rerun controls. |
| Model artifact missing, hash unverified or wrong runtime | Stop that arm; record a blocked setup, use a verified artifact. |
| Workspace untrusted, consent missing or approval denied | Stop execution; log a legitimate safety outcome. Never bypass. |
| No owned process identity or unrelated GPU workload | Stop and resolve ownership/scheduling before launch or cleanup. |
| Verifier absent, vacuous or changed after task lock | Invalid trial; define a failing baseline and relock tasks. |
| Context/tools/provider versions differ across arms | Mark non-equivalent; do not publish a harness delta. |
| Secrets appear in trace or unexpected egress occurs | Stop, scrub/quarantine evidence, investigate the boundary. |
| Model claims success but verifier or diff review fails | Score FAIL; keep trace and prioritize repair. |

Threats: prompt injection in repository/model-card content; unapproved writes;
network egress through provider/plug-in paths; hidden baseline contamination;
stale process on a reused port; self-reported grading; selective run reporting.
Controls: trust and authority gates, explicit egress consent, per-run clean
fixtures, port/process identity, deterministic verifier and full run manifest.

Exit only with a real model transaction through Covert, reviewed diff, passing
independent verifier, approval trace, exact hashes/versions and owned-process
cleanup. If blocked, record why and proceed to a repair with the same locked
task. Never convert a blocked run into a passing score.
