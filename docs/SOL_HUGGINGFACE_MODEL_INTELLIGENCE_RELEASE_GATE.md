# SOL RELEASE GATE — HUGGING FACE MODEL INTELLIGENCE

Date: 2026-10-01
Owner: James Ferrell
Target: Covert Coder release convergence
Branch: nightshift/production-convergence-20260926

## Directive

Treat Hugging Face discovery, acquisition, benchmarking, and recommendation as a release-gate requirement.

Do not accept legacy implementation, archived audits, route existence, UI placeholders, or SOP documentation as proof that the current convergence product satisfies this gate.

Hugging Face must feed the canonical MM9 / Intelligence Registry path. It must not become a second model registry or a parallel source of execution truth.

## Required operator journey

A user must be able to open Covert Model Manager and:

1. Search the live Hugging Face catalog from inside Covert.
2. Filter useful model properties including GGUF, task/model type, parameters, author, license, gated status, quantization, and relevant metadata.
3. Inspect available GGUF files/quants before download.
4. See whether each candidate fits the current machine using real RAM/VRAM/resource data.
5. Benchmark installed models using measured results, not static marketing metadata.
6. Combine Hugging Face metadata, qualification evidence, machine fit, and measured benchmark evidence into task-specific recommendations.
7. Explain why a model is recommended, excluded, unqualified, stale, blocked, or unsuitable.
8. Require explicit operator action before download. Network egress must remain visible, logged, cancelable, and subject to current authority/consent rules.
9. Verify downloaded artifacts before registration/import and surface the resulting model immediately in canonical Model Manager state.
10. Preserve model identity -> source/artifact identity -> provider/source -> credential source -> runtime adapter through acquisition and registration.
11. Never treat popularity, downloads, likes, or model-card claims as qualification evidence.
12. Never treat installation as qualification.
13. Never let the legacy Model Hub path create state that bypasses MM9, the Intelligence Registry, Authority, or runtime admission.
14. Prove the complete path with automated tests plus at least one live Hugging Face operator journey.

## Existing repo intent that must be reconciled

The repository already contains prior design/implementation intent for:
- `/api/modelhub/search`
- explicit Hugging Face download/import
- machine-fit analysis
- benchmark-backed recommendations
- `aide-model-hub-acquisition`
- `aide-model-task-recommender`
- onboarding guidance that points users to MODELS for Hugging Face search

The current README still classifies Hugging Face integration as "Partial / opt-in". Preserve that conservative claim until this gate is proven against the current convergence architecture.

## Known defect to inspect

The repository records an open Hugging Face nested-path issue: use of `encodeURIComponent(filename)` may encode `/` as `%2F`, potentially breaking artifacts stored in nested repository paths.

Verify and repair this if still present. Add a regression test covering nested Hugging Face artifact paths.

## Acceptance evidence

Sol must leave evidence for:
- live HF search response through the current product surface
- filters and GGUF file/quant inspection
- gated-repo credential path without credential leakage
- exact user-consent / egress behavior
- cancelable download behavior
- artifact integrity validation
- canonical MM9/Registry registration
- benchmark result ingestion
- machine-fit verdict
- task-specific recommendation with reason codes/evidence
- stale/hash-change behavior
- no duplicate registry/state path
- nested HF artifact path regression
- restart/recovery behavior after import

If any of these are only designed, partially wired, legacy-only, or unproven, report them as OPEN. Do not collapse design intent into a completion claim.

## Architectural law

Hugging Face = discovery/acquisition source.
MM9 / Intelligence Registry = canonical model truth.
Benchmarking = measured evidence.
Recommendation = advisory decision support using evidence.
Authority / resource admission = execution control.

No layer may silently assume the responsibility of another.
