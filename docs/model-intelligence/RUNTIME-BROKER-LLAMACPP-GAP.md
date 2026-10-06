# Runtime Broker — llama.cpp Composition Gap Analysis (MI-1C §6)

Status: **STATIC REPRODUCTION COMPLETE — NO SAFE COMPOSITION MUTATION YET.** Repository truth classifies
this wiring as the PR #41 candidate family (`docs/nightshift/evidence/runtime-backend-gap-audit-reconciliation-2026-10-04.md`),
not canonical. This document records the verified callback, ownership, selection, and qualification gaps.

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
- `LlamaCppRuntimeAdapterOptions` delegates process lifecycle and inference to `ModelRuntime` callbacks.
  Production's `BrokerModelRuntime` extends `ModelRuntime` and overrides `start`, `stop`, `chat`, and
  `chatStream`. Passing those virtual methods back into the adapter would recurse through the same broker.
  Constructing a second `ModelRuntime` avoids recursion only by splitting the model registry and private
  process-ownership map, which would make stop/status ownership ambiguous. A supported composition therefore
  needs an explicit base lifecycle-host seam over the **same** runtime instance; neither seam exists today.
- The base lifecycle has no public owned-process/PID/engine observation contract for the adapter. Its
  process map is private. The adapter currently reports `version: null`, while the checked-in Unsloth
  passport is exact to its backend version, artifact hash, and host profile. An LLAMA_CPP runtime profile
  cannot inherit that Unsloth qualification.
- Repository search found no production route that invokes `activateLlamaRecovery`; current call sites are
  the Runtime Broker tests. Selection is therefore explicit in the broker abstraction, but not currently
  operator-reachable through the product path.
- `BrokerModelRuntime`'s `start`, `isLoaded`, status projection, and saved-profile validation are all
  Unsloth-specific. Separately, base `ModelRuntime.start` rejects any runtime-bound sidecar. Simply adding
  the recovery adapter does not yield a governed LLAMA_CPP start path.

## Missing seams (ordered)

1. **Same-instance lifecycle host** — provide an explicit adapter host over the single
   `BrokerModelRuntime` model registry and child-process ledger. The host must expose only owned lifecycle,
   wait-ready, inference, and verified ownership/PID/engine observations; it must not create a second
   `ModelRuntime` or route back through the overridden broker methods.
2. **Operator selection** — add a product-reachable, Authority-protected selection operation that calls
   `activateLlamaRecovery` only on explicit operator intent and records the existing append-only event.
   Unsloth remains default; its failures must never select llama.cpp automatically.
3. **Backend-specific start and stop policy** — retain the common order admission → broker load, prove the
   selected backend and its owned runtime before reporting running, and keep one cleanup/stop/cancel owner.
4. **Independent llama runtime identity** — observe a pinned executable/build identity and version (or
   preserve UNKNOWN and block qualification). `version: null` is not a passport identity. The configured
   external executable must remain portable and operator-selected.
5. **Separate qualification passport/profile** — bind the exact artifact hash, runtime build digest/version,
   runtime-affecting profile digest, hardware/driver/environment facts, admission evidence, and qualification
   evidence. Missing facts remain UNKNOWN and cannot inherit the Unsloth V1 passport. The existing Unsloth
   passport and `UNSLOTH_V1_QUALIFICATION` stay unchanged.
6. **Truthful status and recovery evidence** — distinguish loaded/requested artifact identity from runtime-
   reported identity, preserve backend identity and fallback event, and keep unqualified LLAMA_CPP in a
   non-READY state.

## Required tests when the owning lane composes it

Adapter-selection matrix (per directive §8): Unsloth-qualified → Unsloth; explicit llama.cpp-qualified →
llama.cpp only when activated and requirements hold; unsupported artifact → fail closed; admission failure
→ no runtime starts; missing adapter → explicit failure; **no silent fallback**; runtime identity matches
route; stop/cancel ends exactly the owned process and state returns truthfully. Fixture acceptance must not
be presented as real-model qualification.

## Current disposition

- No source code was changed and no model/runtime was started during this static follow-up. The verified
  callbacks show that construction-only wiring is unsafe; the integration contract must be made explicit
  before mutation. This conclusion does not reject llama.cpp or supersede PR #41 review.
- The full architecture suite currently cannot certify a broker change:
  `tests/arch/adapter-request-input.test.ts` wedges (>1 h, 0.5 s CPU, pre-existing; transcript preserved) —
  `FULL_ARCH_GATE = PARTIAL`.
- Live worker inference additionally requires the host to clear the applicable admission floors. No local
  runtime qualification or release claim follows from this static trace.

## Adjacent truthful state (same slice)

- Canonical admission floors: `freePhysicalMemoryMB = 6656` (`node/src/services/resource-admission.ts:26-27`);
  legacy llama.cpp reference floor: 2.5 GB (`daemon/model-manager.mjs:43`). Host free RAM during this
  session: 0.5–1.0 GB (other agent hosts) → `HF-WORKER-DOGFOOD: PARTIAL — RESOURCE ADMISSION` is the
  correct, non-weakened classification. Floors must not be relaxed.
- HF acquisition lane stays runtime-agnostic: search/resolve/download/verify/register produce a verified
  artifact only (`scripts/model-dogfood-1.mjs`; nested-artifact `%2F` fix guarded by regression tests).
