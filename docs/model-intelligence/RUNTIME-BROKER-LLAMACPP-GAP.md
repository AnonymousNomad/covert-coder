# Runtime Broker — llama.cpp Composition Gap Analysis (MI-1C §6)

Status: **SEAM IDENTIFIED — COMPOSITION NOT YET MUTATED.** Repository truth classifies this wiring as
the PR #41 candidate family (`docs/nightshift/evidence/runtime-backend-gap-audit-reconciliation-2026-10-04.md`),
not canonical. This document records the exact missing seam so the owning lane can compose it without
inventing an execution path.

## Canonical start path today

```text
POST /api/models/start (facade → ts, capability.execute approved op)
→ BrokerModelRuntime.start(id)                       node/src/services/broker-model-runtime.ts:256
   1. model allowlisted + artifact exists            (line 258-259)
   2. Unsloth observed version == accepted Runtime Passport backendVersion   (line 261)
   3. Unsloth port ownership verified (no FOREIGN / UNKNOWN)                 (line 262)
   4. verifyQualifiedArtifact(model.file) → accepted tuple hash              (line 272)
   5. boundRuntimeProfile(...) exact-artifact profile                        (line 273)
   6. Resource Admission admitLocalRuntimeStart() must decide START          (line 274-277)
   7. broker.load({...}, true) → Unsloth owns the process                    (line 280)
→ endpoint + identity confirmation, cleanup on failure                       (line 288-305)
```

## Composition facts

- `node/src/openapi.ts:257` composes: `new RuntimeBroker(new UnslothRuntimeAdapter({ workspace }), null, workspace)`
  — **the second argument (llama.cpp recovery adapter) is `null`**.
- `RuntimeBroker` (`node/src/services/runtime-adapter.ts:145`) pins `canonicalBackend = 'UNSLOTH'`;
  `activateLlamaRecovery` (line 230) is an **explicit operator action only** and journals a
  `RuntimeFallbackEvent`; `selectCanonical` (line 264) is the only silent-selection surface and never
  falls back on failure.
- `LlamaCppRuntimeAdapter` (`node/src/services/llama-cpp-runtime-adapter.ts:34`) is **fully implemented and
  tested** (health/load/infer/status; direct-recovery coverage in `tests/arch/runtime-broker.test.ts:1048`).
- `BrokerModelRuntime.start` has **no recovery branch**: with the recovery slot null it is structurally
  incapable of starting a non-Unsloth artifact, and with the slot composed it would still need an explicit
  policy branch (see missing seam §2).

## The exact missing seam (ordered)

1. **Composition point** — `openapi.ts:257`: replace `null` with a constructed `LlamaCppRuntimeAdapter`
   using the same option injection ModelRuntime uses (binary resolution incl. `E:\llama-cpp`, workspace,
   observation seam). No other file needs to change for construction.
2. **Recovery-selection semantics in `BrokerModelRuntime.start`** — today the method *requires* the Unsloth
   passport before admission. Composition alone is inert: `start` must gain an explicit branch that is
   reachable **only** when llama.cpp recovery has been activated through `broker.activateLlamaRecovery`
   (operator decision, journaled). Unsloth remains canonical: no silent fallback on Unsloth failure.
3. **Admission ordering** — the admission call at line 274 already precedes `broker.load`, so the recovery
   branch must keep the same order: admission → `broker.load(recovery)` — never spawn first.
4. **Identity/passport requirements differ by adapter** — Unsloth binds the accepted V1 tuple; llama.cpp
   must instead bind the **observed artifact sha256 + runtime identity** into the served identity/status
   (`RUNTIME_REPORTED` vs `REQUESTED_ARTIFACT` evidence classes in `common/contracts/runtime.ts:8-14`)
   so worker evidence carries truthful provenance.
5. **Ownership and cleanup** — the recovery load must retain the owned child and reuse the same
   failed-start cleanup (`cleanupOwnedRuntimeAfterFailedStart`) and stop/cancel semantics; no
   special-case spawn outside the broker.
6. **Observable adapter identity** — status must expose which adapter served the model
   (`UNSLOTH | LLAMA_CPP`) for UI/evidence; `RuntimeStatusResponse.reported_backend` already models this.

## Required tests when the owning lane composes it

Adapter-selection matrix (per directive §8): Unsloth-qualified → Unsloth; explicit llama.cpp-qualified →
llama.cpp only when activated and requirements hold; unsupported artifact → fail closed; admission failure
→ no runtime starts; missing adapter → explicit failure; **no silent fallback**; runtime identity matches
route; stop/cancel ends exactly the owned process and state returns truthfully. Fixture acceptance must not
be presented as real-model qualification.

## Why staged, not done here

- The wiring is a canonical-composition decision for the PR #41 candidate lane, not an additive model-
  intelligence slice; mutating `BrokerModelRuntime.start` semantics belongs to that owner.
- The full architecture suite currently cannot certify a broker change: `tests/arch/adapter-request-input.test.ts`
  wedges (>1 h, 0.5 s CPU, pre-existing; transcript preserved) — `FULL_ARCH_GATE = PARTIAL`.
- Real worker inference additionally requires the host to clear the admission floor (see below), so no
  end-to-end runtime proof is claimable tonight regardless of composition.

## Adjacent truthful state (same slice)

- Canonical admission floors: `freePhysicalMemoryMB = 6656` (`node/src/services/resource-admission.ts:26-27`);
  legacy llama.cpp reference floor: 2.5 GB (`daemon/model-manager.mjs:43`). Host free RAM during this
  session: 0.5–1.0 GB (other agent hosts) → `HF-WORKER-DOGFOOD: PARTIAL — RESOURCE ADMISSION` is the
  correct, non-weakened classification. Floors must not be relaxed.
- HF acquisition lane stays runtime-agnostic: search/resolve/download/verify/register produce a verified
  artifact only (`scripts/model-dogfood-1.mjs`; nested-artifact `%2F` fix guarded by regression tests).
