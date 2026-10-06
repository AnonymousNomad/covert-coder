# Model Atlas — Consumer Contract Guide (MI-1A)

Status: **PROVISIONALLY FROZEN** for consumer integration (MI-1A). Additive/versioned changes only;
public fields are not renamed or restructured without a proven consumer blocker.
Owner: Model Intelligence (DeepSeek lane). Canonical product checkpoint: `3ef600d` (MI-1).

MODEL INTELLIGENCE OWNS MODEL EVIDENCE. MODEL LAB DISPLAYS THAT EVIDENCE.
AUTHORITY DECIDES WHETHER EXECUTION MAY OCCUR.

## Public import paths

| Surface | Path | Use |
| --- | --- | --- |
| Contracts (schemas + types) | `common/contracts/model-atlas.ts` | validate/normalize read responses; type consumers |
| Read service | `node/src/services/model-atlas-read.ts` → `createModelAtlasRead({ atlas })` | the consumer read surface |
| Deterministic fixture | `fixtures/model-atlas/mi1-consumer-fixture.json` | render Model Lab without rerunning a benchmark |

Consumers do **not** import `model-atlas.ts` store internals or read `.aide/atlas/**` files.

## Read surface

```ts
const read = createModelAtlasRead({ atlas });           // atlas is injected by the backend owner

read.modelsResponse(inputs: AtlasReadModelInput[]): Promise<ModelAtlasModelsResponseT>
// input: canonical model descriptor + current basis (see below). Output: one entry per model.

read.recordResponse(modelId, basis): Promise<ModelAtlasRecordResponseT | null>
// null when the model has no valid evidence. record = latest immutable evaluation; history = ascending.

read.candidateResponse(modelId): Promise<ModelAtlasCandidateResponseT>   // candidate: null when none
```

`AtlasReadModelInput = { model_id, display_name, artifact_sha256, basis, recommended_roles? }` and
`basis` is the current evaluation basis (source_revision, artifact_sha256, quantization, runtime_id,
runtime_version, harness_version, benchmark_id/version, grader_version, inference_config_digest,
machine_profile_digest, execution_node). The backend owner assembles the basis from canonical Model
Manager / runtime / hardware state; consumers never construct it themselves.

## A. LIST MODELS

Ask: "What models have Atlas evidence?" → `modelsResponse(inputs)`. Each entry carries
`evaluation_state` (`NEVER_EVALUATED | CURRENT | STALE | INCOMPLETE`), `qualification_state`,
`latest_evaluation_id`, `latest_evaluated_at`, `stale_reasons`, `scope`, `recommended_roles`,
`candidate_id`. Models with no evidence still appear (NEVER_EVALUATED) so the UI can offer evaluation.

## B. MODEL HISTORY

`recordResponse(modelId, basis).history` — ascending by `evaluated_at`, one entry per recorded
evaluation: `{ evaluation_id, evaluated_at, native_ratio, harnessed_ratio, delta_score,
qualification_state }`. History is append-only; records are immutable and never replaced.

## C. EVALUATION DETAIL

`recordResponse(modelId, basis).record` contains `fingerprint` (model/artifact/runtime/harness/
benchmark/config/machine/execution-node/chat-template), `hardware_profile` (incl. `execution_node`,
`execution_domain`), `native`, `harnessed` (each with `outcome`, `score`, `latency`, `tokens`,
`failures`, `categories`, `evidence_refs`), `comparison` (`basis: 'scaffold-ablation'`, deltas,
per-category), `qualification`, `recommended_roles`, `known_failures`, `known_limitations`,
`evidence_refs`, `evaluated_at`, `completed_at`, `receipt`, and `freshness` (recomputed per read).

NATIVE and HARNESSED are always separate condition objects. Never merge their scores.

## D. CURRENT QUALIFICATION

Render `qualification_state` from the models list (or `record.qualification.state`). Do not
recompute. Canonical vocabulary (Model Access): `UNTESTED | TESTED | QUALIFIED | NOT_QUALIFIED |
INVALID_EVIDENCE | STALE | REQUIRES_PREFLIGHT`. MI-1 derivation is conservative:
FAILED / PARTIAL / CANCELLED explorations become `UNTESTED` or `INVALID_EVIDENCE` — never `TESTED`.
`QUALIFIED`/`NOT_QUALIFIED` policy is not produced here; if present on a record it came from
canonical policy upstream.

## E. STALE STATE

`evaluation_state === 'STALE'` with `stale_reasons[]` and `scope`:
`NONE | RESOURCE | FULL`. Resource-scoped (`machine_profile_changed`) refreshes resource/latency
observations only; FULL reasons (`artifact_sha256_changed`, `source_revision_changed`,
`quantization_changed`, `runtime_changed`, `runtime_version_changed`, `harness_version_changed`,
`benchmark_definition_changed`, `inference_config_changed`, `execution_node_changed`) invalidate the
comparison. Old evidence is preserved and stays visible with its reasons. Never collapse this to a
bare boolean.

## F. FAILURE STATE

- No valid evidence ever recorded → `NEVER_EVALUATED` (with `candidate_id` when a candidate exists).
- Persisted evidence that fails contract validation → `INCOMPLETE` + `stale_reasons: ['corrupt_evidence']`;
  it must not be displayed as evaluated.
- Record exists but a condition is missing → `INCOMPLETE` + `native_missing` / `harnessed_missing`.
- `recordResponse` returns `null` when nothing valid exists; `candidateResponse.candidate` is `null` when no candidate was created.
- Refused evaluation requests are not shown as models; refusals belong to the caller (Harness Sync
  returns typed refusal codes `MODEL_UNKNOWN`, `IDENTITY_INSUFFICIENT`).

## G. ROLE RECOMMENDATIONS

`recommended_roles[]` are evidence-bound: each has `role` (e.g. CODER, PLANNER, REVIEWER, RESIDENT,
VERIFIER, TOOL_USE, LOW_MEMORY, FAST_LOCAL, CLAIM_ADHERENCE, LONG_CONTEXT, COMPOUND_TASKS),
`reason`, and `evidence_refs` that must resolve to refs recorded on the evaluation. An empty array is
a legitimate, expected state — render "NO ROLE RECOMMENDATION", never a default role.

## H. EXECUTION NODE

`fingerprint.execution_node`, `hardware_profile.execution_node`, `hardware_profile.execution_domain`
(`INTERNAL | WORKSPACE | WSL | ISOLATED | EXTERNAL_HOST | REMOTE`), plus `machine_profile_digest`.
Node kinds are open strings: `local-windows`, `wsl:<distro>`, `container:<id>`, `ssh:<host>`,
`remote-covert:<id>`, future `covert-server:<id>`. A node change makes evidence STALE (FULL) — never
reuse another node's evidence.

## I. PROVENANCE

- Stable identity: `model_id` (canonical), `evaluation_id` (uuid), `artifact_sha256`.
- Link conventions for Main Luna: `covert://model/<model_id>`, `covert://evidence/<evaluation_id>`,
  `covert://artifact/<sha256>`. IDs contain no credentials, secrets, or unnecessary absolute paths
  (fixture digests are fixture constants; the evidence artifact hash is real).
- `evidence_refs[]` point at evidence documents (e.g. runner JSON paths relative to the repository).

## Stability classification (MI-1A freeze)

| Export | Class |
| --- | --- |
| `ModelAtlasModelsResponse`, `ModelAtlasRecordResponse`, `ModelAtlasCandidateResponse` (+ element schemas/types) | STABLE_FOR_CONSUMER |
| `AtlasEvaluationRecord` / `AtlasRecordedEvaluation` (+ `AtlasFingerprint`, `AtlasConditionResult`, `AtlasComparison`, `AtlasRecommendation`, `AtlasEvidenceFreshness`) | STABLE_FOR_CONSUMER |
| `AtlasEvaluationState`, `AtlasCandidateReason`, `AtlasEvaluationCondition`, `AtlasConditionOutcome`, `MODEL_ATLAS_SCHEMA`, `MODEL_ATLAS_CANDIDATE_SCHEMA` | STABLE_FOR_CONSUMER |
| `AtlasEvaluationCandidate` | STABLE_FOR_CONSUMER (candidates are read-only for consumers) |
| `createModelAtlasRead`, `AtlasReadModelInput` | STABLE_FOR_CONSUMER |
| `createModelAtlas`, `ModelAtlas`, `AtlasFreshnessBasis`, `compareFingerprints`, `deriveQualification`, `validateRecord` | INTERNAL_ONLY (backend/arrange; consumers may receive `AtlasFreshnessBasis` values from the backend owner) |
| `createHarnessSync` | INTERNAL_ONLY (backend orchestration; refusals surface through backend-owned endpoints later) |
| Store file layout under `.aide/atlas/**` | INTERNAL_ONLY — never read by consumers |

No export is classified UNSAFE_TO_FREEZE; none is NEEDS_CLARIFICATION after this guide.

## Duplicate-state law (no second registry)

Model Lab may keep presentation state: selected model, selected evaluation, expanded rows,
sort/filter, active tab. Model Lab must NOT keep its own canonical copies of qualification,
recommendations, evaluation history, freshness, artifact identity, or benchmark evidence —
those are Atlas/Model Manager truth, read through the surface above.
