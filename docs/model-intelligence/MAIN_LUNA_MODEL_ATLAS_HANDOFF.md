# Main Luna — Model Atlas Integration Handoff (MI-1A)

Purpose: wire Model Lab / Model Catalog to the Model Atlas evidence layer **without** reading Atlas
internals or building a second truth store. Owner of this surface: Model Intelligence (DeepSeek lane).
Contract status: provisionally frozen (see `docs/model-intelligence/MODEL_ATLAS_CONSUMER_CONTRACT.md`).

## What to import

```ts
import { createModelAtlasRead } from '../../node/src/services/model-atlas-read.ts';
import {
  ModelAtlasModelsResponse,
  ModelAtlasRecordResponse,
  ModelAtlasCandidateResponse
} from '../../common/contracts/model-atlas.ts';
```

The backend owner injects the `atlas` instance (same process/workspace as Model Manager).
Main Luna never imports the store service or touches `.aide/atlas/**` files.

## Three calls

```ts
const read = createModelAtlasRead({ atlas });

// 1. list: one entry per canonical model (assemble AtlasReadModelInput from Model Manager + runtime/hardware state)
const models: ModelAtlasModelsResponseT = await read.modelsResponse(inputs);

// 2. detail: latest immutable evaluation + ascending history (null when nothing valid exists)
const detail: ModelAtlasRecordResponseT | null = await read.recordResponse(modelId, basis);

// 3. pending evaluation, if any (execution stays Authority-gated; this is display data only)
const candidate: ModelAtlasCandidateResponseT = await read.candidateResponse(modelId);
```

## Sample shapes

`fixtures/model-atlas/mi1-consumer-fixture.json` contains ready-to-render views produced from the
accepted MI-1 real run: `views.models_current` (CURRENT + NEVER_EVALUATED + INCOMPLETE entries),
`views.models_stale` (STALE + `execution_node_changed`), `views.record` (native 0/10, harnessed
2/10, delta +0.2, zero recommendations, FRESH), `views.candidate` (execution-free). Use it to build
and test Model Lab UI without running any model.

## Vocabulary to render (never recompute)

- **evaluation_state**: `NEVER_EVALUATED | CURRENT | STALE | INCOMPLETE`
- **qualification_state**: `UNTESTED | TESTED | QUALIFIED | NOT_QUALIFIED | INVALID_EVIDENCE | STALE | REQUIRES_PREFLIGHT`
- **freshness**: `{ state: FRESH|STALE, scope: NONE|RESOURCE|FULL, stale_reasons[], checked_at }`
- **stale reasons**: `artifact_sha256_changed`, `source_revision_changed`, `quantization_changed`,
  `runtime_changed`, `runtime_version_changed`, `harness_version_changed`, `benchmark_definition_changed`,
  `inference_config_changed`, `machine_profile_changed` (RESOURCE scope), `execution_node_changed` (FULL scope),
  plus evidence conditions `native_missing`, `harnessed_missing`, `corrupt_evidence`
- **candidate reason**: `NO_EVIDENCE | STALE_EVIDENCE | INCOMPLETE_EVIDENCE`
- **conditions**: NATIVE and HARNESSED are always separate; show both; delta = harnessed − native.

## Truthful UI rules

1. Empty `recommended_roles` renders **NO ROLE RECOMMENDATION** (the SmolLM2 proof stays that way).
2. Native 0/10 is rendered as measured evidence, never hidden or normalized.
3. STALE keeps qualification visible with its reasons and scope; offer a candidate, not a silent rerun.
4. INCOMPLETE/`corrupt_evidence` is shown as unverifiable evidence — never as evaluated.
5. `candidate.execution = { mode: 'AUTHORITY_REQUIRED', executed: false }` — the UI must not start runs.
6. Node/domain chips come from `hardware_profile.execution_node/execution_domain`.

## Error behavior

- `recordResponse` → `null` = no valid evidence (show empty state, offer `candidate_id` when listed).
- `candidateResponse.candidate` → `null` = no candidate.
- Backend refusals (unknown model / no stable artifact hash) are backend-owned; if surfaced to the UI
  later they carry codes `MODEL_UNKNOWN` / `IDENTITY_INSUFFICIENT` and mean "not eligible for evaluation".

## Evidence links

`covert://model/<model_id>`, `covert://evidence/<evaluation_id>`, `covert://artifact/<artifact_sha256>`.
IDs are stable and free of credentials, secrets, or unnecessary absolute paths.

## Do NOT duplicate

No local qualification logic, no local history, no local freshness recomputation, no second artifact
identity, no parallel model registry. Presentation state (selection, expansion, tabs, sort/filter) stays
in the UI; evidence stays in Atlas/Model Manager.

## Verification available to you

`tests/unit/test-model-atlas-consumer.mjs` demonstrates the exact consumer journey against both the
fixture and the live read surface. If your integration needs a field or shape that is missing, raise it
as a proven consumer blocker — the contract is frozen against casual changes, not against real ones.
