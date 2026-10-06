# MI-1 Evidence — Model Atlas + Harness Sync

Date: 2026-10-05 · Lane: `feat/model-intelligence-mi1-20261005` · Worktree: `E:\covert-model-intelligence-mi1`
Base (and sole ancestor): `cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c` (convergence HEAD, `nightshift/production-convergence-20260926`).

Status: **MI-1 ACCEPTED CANDIDATE** — one real local model traversed the full path
(identity → artifact → compatibility-by-execution → candidate → native → harnessed → comparison →
qualification → durable Atlas record → read contract); deterministic and refusal tests pass; product
work outside this slice was not touched. Formal acceptance remains with the owner/reviewer.

## A. Baseline

- Worktree created from the actual accepted convergence HEAD `cfaad71` via `git worktree add` (not from memory).
- Canonical convergence worktree `E:\covert-nightshift-integration` at `cfaad71`, ahead 11 of origin, one foreign untracked file (Main Luna's directive) — **not touched**.
- PR #31 verification worktree (`E:\aide-pr31-verify-ac0eb0a`, detached `579d767`) — **not touched**.
- `node_modules`: junction to the canonical worktree's tree (identical `package-lock.json` hash) — development convenience; not tracked by git.

## B. Repository truth found (inventory summary)

Existing and already tested at `cfaad71` (used, not rebuilt): canonical Model Manager
(`node/src/services/model-runtime.ts`), Model Hub (`modelhub.mjs`), Model Access contract
(`common/contracts/model-access.ts` — canonical qualification vocabulary
`UNTESTED|TESTED|QUALIFIED|NOT_QUALIFIED|INVALID_EVIDENCE|STALE|REQUIRES_PREFLIGHT`), Model Manager
projection with `evaluateQualificationFreshness` (`model-manager-view.ts:32`), Runtime Broker +
Unsloth adapter + llama.cpp recovery adapter, OpenCode bridge, hardware probe/fit/admission, GGUF
inspection, download/import/resume, Veritas/Harness, and the versioned scaffold-ablation battery
(`benchmarks/context-ablation-v1.mjs` + `scripts/run-harness-battery.mjs`).

Genuinely absent (MI-1 scope): Harness Sync implementation (design-only doc
`docs/harness/HARNESS-SYNC-ARCHITECTURE.md`), durable per-model evaluation records, Model Atlas
contract, evaluation identity, native-vs-harnessed structured comparison, evidence staleness for
evaluations. `docs/harness/HARNESS-GAP-MATRIX.json` itself records `harness_sync: ABSENT`.

## C. Implementation (contract-first, additive only)

| File | Kind | Purpose |
| --- | --- | --- |
| `common/contracts/model-atlas.ts` | new contract | `MODEL_ATLAS_SCHEMA` evaluation record (immutable), fingerprint (model/artifact/runtime/harness/benchmark/config/machine/execution-node), native + harnessed condition results (never merged), comparison, qualification (canonical vocabulary), evidence-bound recommendations, candidate (`execution: AUTHORITY_REQUIRED`, `executed: false`), freshness, and the read contracts (`models`, `record+history`, `candidate`) |
| `node/src/services/model-atlas.ts` | new service | durable store under `<workspace>/.aide/atlas/` (evaluations immutable + candidates), `recordEvaluation` (validated; refuses duplicates/unbound evidence refs/score overflow), `stateFor` (NEVER_EVALUATED/CURRENT/STALE/INCOMPLETE + reasons + scope), `historyFor`, candidate create/read, `compareFingerprints` (known-vs-known only; unknown basis never fabricates staleness), conservative `deriveQualification` (TESTED only when both conditions COMPLETED; FAILED/PARTIAL/CANCELLED never become TESTED) |
| `node/src/services/harness-sync.ts` | new service | `inspect` (read-only: CURRENT or CANDIDATE_READY, never writes/executes) and `sync` (persists candidate); refuses `MODEL_UNKNOWN` and `IDENTITY_INSUFFICIENT` (no stable artifact sha256); `buildFingerprint` binds model+artifact+runtime+harness+benchmark+config+machine+node |
| `node/src/services/model-atlas-read.ts` | new service | stable read contract for Model Catalog / Model Lab consumers (models with evaluation state, single record + history, candidate); no UI |
| `tests/unit/test-model-atlas.mjs` | tests (13) | immutability, typed refusals, separate native/harnessed, history growth, full state matrix, resource-scoped staleness, unknown-basis honesty, corrupt evidence, execution-free candidates, qualification conservatism |
| `tests/unit/test-harness-sync.mjs` | tests (8) | refusals, missing/stale/incomplete candidates, no-write inspect, no-execution guarantees, harness/benchmark version invalidation, fingerprint binding |
| `tests/unit/test-model-atlas-read.mjs` | tests (5) | read states, candidate identity, stale reasons, null-without-evidence, immutable history |
| `scripts/model-atlas-mi1-demo.mjs` | evidence tooling | ingests a completed runner JSON into a real Atlas record through the services and demonstrates sync + read; refuses non-complete runs |

No canonical registry, router, runtime, provider, or UI was modified. Nothing here bypasses
Model Access or Authority: candidate creation is metadata work; evaluation runs remain an authorized
operation outside the service (the candidate records `execution: { mode: 'AUTHORITY_REQUIRED', executed: false }`).

## D. Acceptance evidence (raw)

| Command | Working dir | Exit | Result |
| --- | --- | --- | --- |
| `node --test tests/unit/test-model-atlas.mjs tests/unit/test-harness-sync.mjs tests/unit/test-model-atlas-read.mjs` | `E:\covert-model-intelligence-mi1` | 0 | 23 tests, 23 pass, 0 fail |
| `npx tsc -p tsconfig.node.json` | same | 0 | no diagnostics |
| `npx eslint common/contracts/model-atlas.ts node/src/services/model-atlas.ts node/src/services/model-atlas-read.ts node/src/services/harness-sync.ts` | same | 0 | clean |
| `npx eslint scripts/model-atlas-mi1-demo.mjs tests/unit/test-*.mjs` (the three new tests) | same | 0 | clean |
| `node --experimental-strip-types --no-warnings --test tests/arch/model-state.test.ts` | same | 0 | 4/4 pass (adjacent subsystem) |
| `node scripts/run-harness-battery.mjs ...` (real run, see E) | same | 0 | `completion_status: complete` |
| `node scripts/model-atlas-mi1-demo.mjs ...` | same | 0 | record persisted; sync CURRENT; stale-node candidate; read CURRENT |

Full-suite note: this slice is additive and touches no existing module; the affected-subtree gate
is the unit suite + typecheck + adjacent arch test above. The repository-wide `check:arch` chain was
not run to completion in this session (known local ESLint/HDD spin behaviour documented in the repo);
that limitation is stated rather than hidden.

## E. Real model proof (genuine, deterministic suite)

```text
model:                SmolLM2-360M-Instruct (Q8_0), already present at E:\models
canonical model id:   local:smollm2-360m-instruct-q8_0
artifact:             smollm2-360m-instruct-q8_0.gguf (386,404,992 bytes)
hash:                 48ab3034d0dd401fbc721eb1df3217902fee7dab9078992d66431f09b7750201 (sha256, verified)
runtime:              llama.cpp build 9940 (259f2e2a5), CPU (-ngl 0), local server 127.0.0.1:8107 (owned, stopped cleanly)
hardware:             local-windows node; benchmark environment captured in runner environment + resource snapshot
native result:        0/10 (scaffold OFF control arm)
harness result:       2/10 (scaffold ON treatment arm; +0.2 absolute delta, 2 treatment wins, 0 losses, 8 ties)
comparison:           delta_score 0.2; per-task categories preserved; latency/tokens preserved per arm
qualification:        TESTED (both conditions COMPLETED; canonical vocabulary)
recommended roles:    none — evidence is below any role threshold; recorded honestly as a limitation
record:               evaluation_id fbaa2556-915a-495d-8ed3-7d86d8bba7e9
evidence refs:        docs/evidence/model-atlas-mi1/smollm2-360m-q8-native-harness-run.json (89,708 bytes)
exported record:      docs/evidence/model-atlas-mi1/smollm2-360m-q8-atlas-record.json
durable store:        <workspace>/.aide/atlas/evaluations/fbaa2556-....json (7,816 bytes, immutable)
stale demonstration:  execution_node local-windows -> wsl:ubuntu produced CANDIDATE_READY / STALE_EVIDENCE
                      with reason ["execution_node_changed"] and a persisted execution-free candidate
```

The 0/10 native score is valid negative evidence and is preserved, not hidden.

## F. Failures / negative evidence

- Real run: native 0/10 — the 360M model fails the 10-task coding/obligation suite without the scaffold; harnessed 2/10. This is a truthful capability observation, not a harness defect.
- CANCELLED/FAILED/PARTIAL evaluations map to UNTESTED/INVALID_EVIDENCE — they can never produce TESTED.
- Corrupt persisted records are surfaced as `INCOMPLETE` with `corrupt_evidence` and are never silently trusted.
- Foreign process noted and left alone: llama-server PID 22988 belongs to the AES-LedgerPro lane (Ollama bundle); it was running during the real evaluation with no interference.

## G. Known limitations

- Qualification in MI-1 is deliberately binary-free but shallow: TESTED means "evaluation evidence exists and completed"; QUALIFIED/NOT_QUALIFIED policy (thresholds, Veritas acceptance) is not invented here.
- Role recommendations are evidence-bound and empty unless a caller records measured, referenced reasons; no derivation policy yet.
- One evaluation instrument is used (scaffold-ablation suite; descriptive pilot, no broad effectiveness claim). Cross-model or multi-seed comparisons are not yet implemented.
- The evaluation endpoint was started manually for the proof (owned by the evidence tooling, stopped cleanly); integration into Runtime Broker/Model Lab execution remains future work and is deliberately out of scope.
- Only one execution node (local-windows, CPU) was exercised. WSL/container/remote node evidence is carried by design but not yet produced.

## M. World Resource Mapping (V3 alignment — mapping only, no World Graph built)

| World concept | Canonical source in this slice | Stable identity carried |
| --- | --- | --- |
| Model identity | Model Manager canonical id | `model_id` (e.g. `local:smollm2-360m-instruct-q8_0`) → future `model:<canonical-id>` |
| Source / repository | fingerprint `source_revision`; artifact `source_ref` available upstream | revision string bound into fingerprint |
| Artifact identity | fingerprint `artifact_sha256`, `quantization`; hardware_profile carries node | sha256 (sha256-addressed) |
| Runtime identity | fingerprint `runtime_id`, `runtime_version` | e.g. `llama.cpp` + `9940` |
| Execution node / domain | fingerprint `execution_node`; record `hardware_profile.execution_node/execution_domain` | `local-windows`, `wsl:<distro>`, `container:<id>`, `ssh:<host>`, `remote-covert:<id>` |
| Evaluation identity | `evaluation_id` (uuid), immutable file per record | `covert://evidence/<evaluation_id>` convention documented for Main Luna |
| Qualification | record `qualification.state` (canonical Model Access vocabulary) | state + basis + stale_reasons |
| Recommended roles | `recommended_roles[]` (evidence-ref-bound; World role set includes CODER/PLANNER/REVIEWER/RESIDENT/VERIFIER) | role key + evidence refs |
| Stale state | `freshness` (checked_at, FRESH/STALE, scope NONE/RESOURCE/FULL, reasons) | recomputed on read against current basis |
| Failures | `known_failures[]`, per-condition `failures[]` | bounded codes + counts |
| Evidence references | `evidence_refs[]` → runner JSON + record file | repo-relative paths |
| Read contract | `ModelAtlasModelsResponse`, `ModelAtlasRecordResponse`, `ModelAtlasCandidateResponse` | consumed by Model Catalog → Model Lab |

Separations preserved per V3: provider ≠ connection ≠ model ≠ source repository ≠ artifact ≠ runtime ≠
loaded runtime instance ≠ evaluation ≠ qualification ≠ recommendation. No second model registry was
created; the Atlas is an evidence store that references canonical identity.

## N. Execution node compatibility

- The record separates **execution node** (`execution_node`), **execution domain**
  (`INTERNAL|WORKSPACE|WSL|ISOLATED|EXTERNAL_HOST|REMOTE`), **machine/benchmark environment digest**
  (`machine_profile_digest`), **runtime adapter/version**, and **artifact** — so evidence cannot be
  silently reused across nodes or hardware.
- Staleness dimensions cover: source revision, artifact hash, quantization, runtime, runtime version,
  harness version, benchmark/grader definition, sampling configuration, machine profile (RESOURCE scope),
  and execution node (FULL scope).
- Future Covert model server / remote nodes map onto `execution_node` + `hardware_profile` without a
  contract change; no remote infrastructure was built.

## Read contract for Main Luna (what to query)

- **What models exist / what is their state** → compose `AtlasReadModelInput[]` (canonical Model Manager
  entries + current basis) → `modelsResponse()`: evaluation_state, qualification_state, latest evaluation id/time,
  stale reasons + scope, candidate id, recommended roles.
- **One model's evidence** → `recordResponse(modelId, basis)`: latest immutable record (native AND harnessed, delta,
  failures, limitations, evidence refs) + full history.
- **Pending evaluation** → `candidateResponse(modelId)`: candidate with reason and `executed:false`.
- Consumers never reconstruct semantics from files; the backend owns evaluation truth.

## Scope discipline (§35 — explicitly NOT done)

No Model Lab/Catalog UI, no workstation shell changes, no provider/runtime/credential changes, no downloads,
no new benchmark suite, no qualification-threshold policy, no push to protected/shared branches, no merges.
