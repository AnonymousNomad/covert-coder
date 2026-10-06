# MI-2 Design Note — Authorized Evaluation Execution (HOLD ONLY)

Status: **DESIGN ONLY — NOT STARTED, NOT AUTHORIZED.** MI-2 must not begin before Main Luna's
consumer verification of the MI-1A frozen contract, so the backend contract is not moved while the
UI integrates against it.

## Goal

Turn an execution-free evaluation candidate into a real, authorized evaluation run that produces an
immutable Atlas record with truthful native/harnessed results.

## Intended path

```text
evaluation candidate (execution.mode = AUTHORITY_REQUIRED, executed = false)
        ↓  operator Authority (exact operation, existing ExecutionAuthority patterns)
        ↓  Resource Admission (existing floors: RAM/commit/VRAM/GPU-util)
        ↓  Runtime Broker / RuntimeAdapter (existing canonical selection; llama.cpp recovery remains operator-activated)
        ↓  real execution (owned process, bounded; one heavy evaluation at a time)
        ↓  native + harnessed results (both conditions preserved; partial/cancelled truthful)
        ↓  immutable Atlas record (same contract as MI-1)
        ↓  qualification / recommendation projection (unchanged rules)
```

## Invariants (must not be violated)

1. Model Atlas never grants itself execution authority; the candidate stays inert until Authority approves.
2. No `approved: true` bypasses; approval binds the exact evaluation definition (model, artifact hash,
   runtime, benchmark/grader versions, sampling, node).
3. Resource Admission gates every run; no GPU-heavy run without admission.
4. Execution produces a **new** evaluation record; history is never overwritten.
5. Failure/cancel/partial outcomes are recorded truthfully and cannot become TESTED.
6. No automatic downloads; only already-present artifacts.
7. Foreign processes are never killed; `OBSERVED ≠ OWNED`.

## Open questions for MI-2 (to resolve with live evidence, not assumption)

- Which existing route/operation kind carries the exact binding (likely `capability.execute` over an
  evaluation-intent descriptor) and who owns the runner (node service vs harness script process)?
- How the runner streams progress into evidence without exposing internals to the UI (presentation state only).
- Where the evaluation run's process ownership is recorded (owned-process ledger fields: node, domain, cwd scope).
- Whether the scaffold-ablation suite stays the only instrument or a second suite id is versioned in.

## Acceptance gates MI-2 must satisfy before completion

- Candidate → approval → admission → run → record, end-to-end on one real local model.
- Refusal paths: unapproved, changed evaluation definition, admission denied, unknown model, missing artifact.
- Cancellation mid-run yields CANCELLED/PARTIAL records (never TESTED) and exact cleanup.
- One heavy evaluation at a time enforced; ports/processes verified free afterwards.
- Zero contract changes to MI-1A read surface; consumer tests stay green.

**Do not implement any of this in MI-1A.**
