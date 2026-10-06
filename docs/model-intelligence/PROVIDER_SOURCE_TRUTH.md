# PROVIDER_SOURCE_TRUTH — verified from source at cfaad71 lineage (session evidence)

All rows below cite files read directly this cycle. Branch shading: items marked [mi1b] exist on
`feat/model-intelligence-mi1b-reliability-20261005` (MI-1/MI-1A/MI-1B), not yet on convergence.
No UI or documentation inference used.

## Identity chain (canonical, present)
- Model identity / artifacts / availability / qualification vocabulary / credential sources / adapters:
  `common/contracts/model-access.ts` (canonical_id, artifact expected/observed sha256, hash_status,
  availability DISCOVERED…LOADABLE, qualification UNTESTED…REQUIRES_PREFLIGHT, credential kinds
  API_KEY_VAULT/SUBSCRIPTION_ACCOUNT/OFFICIAL_CLI_AUTH/OPENCODE_MANAGED_AUTH/OAUTH_SESSION/LOCAL_NONE,
  adapter kinds DIRECT_HTTP/OPENCODE/CODEX_CLI/CLAUDE_CLI/LOCAL_RUNTIME).
- Manager projection incl. freshness: `node/src/services/model-manager-view.ts`.
- Router (routeForRole/routeForId, health TTL, fitter): `node/src/services/model-router.ts`.

## Providers / credentials
- Built-in direct providers + egress hosts: `node/src/services/providers.ts` (openai, anthropic, google,
  mistral, groq, openrouter as catalogue entries), egress allowlist `provider-hosts.json`, journaling.
- BYOK: `node/src/services/byok-service.mjs` (.aide/byok/providers.json|routing.json|consent.json),
  `node/src/routes/byok.ts` (enrolled descriptors; secrets bind as sha256 digest + length only),
  DPAPI store `node/src/services/credentials.ts` (PowerShellCrypt).
- Unified connections/subscription discovery: `node/src/services/provider-connections.mjs`
  (local-runtime, BYOK, builtins, Codex/Claude CLI presence, HF token, OpenCode-managed; routing preference).
- OpenCode managed bridge: `node/src/services/opencode-bridge.ts` (exact provider/model refs; env scrubbed;
  no credential-file reads).

## Acquisition / formats
- Hugging Face catalogue + files + download/resume + import: `node/src/services/modelhub.mjs`,
  `node/src/routes/modelhub.ts` (capability.external/execute enrollments; egress journal; containment).
  [mi1b] nested-artifact `%2F` URL fix (`encodeArtifactPath`) + regression tests pending convergence.
- GGUF probe (v2/v3 header, arch allowlist llama/qwen2/lfm2): `node/src/services/gguf.ts`, ingest in
  `model-runtime.ts`; fit verdicts `model-fit.ts`; hardware probe `hardware.ts` / `hardware-profile.mjs`.
- Safetensors/Transformers acquisition or execution: ABSENT (no code path).

## Runtime
- Broker + explicit recovery topology: `node/src/services/runtime-adapter.ts`; adapters:
  `unsloth-runtime-adapter.ts` (canonical), `llama-cpp-runtime-adapter.ts`.
  [PR#41 @3e50cb4] composition `openapi.ts` passes the llama adapter + `selectedBackend`
  (`AIDE_LOCAL_RUNTIME_BACKEND` unsloth|llama-cpp), explicit `startLlamaCompatibility`; no auto fallback.
- Admission floors (canonical): `resource-admission.ts` freePhysical 6,656 MB / commit 5,120 MB / VRAM
  4,608 MB / GPU<50%. Legacy daemon reference floor 2.5 GB (`daemon/model-manager.mjs:43`).
- Evidence this session: live refusal `REFUSE_RESOURCE` with zero owned processes
  (`docs/evidence/runtime-gfx900-w3-live-compat.json` [gfx900]).
- Ollama / LM Studio / vLLM / arbitrary OpenAI-compatible servers: ABSENT as adapters (no discovery,
  no qualification, no routing).

## Evidence / qualification layer
- Atlas + Harness Sync + resident binding: [mi1b] `common/contracts/model-atlas.ts`,
  `resident-binding.ts`, services + tests (50/50 Atlas, 8/8 resident, route exposure accepted).

## Known defects/open (verified)
- `/api/models/status` in LLAMA_CPP composition without a running engine: 500 / ≥30 s hang→502
  (isolated; repair staged, PR #41 lane).
- Foreign-listener red on PR#41: does not reproduce currently (3/3 + 56/56 suites) — disposition kept open.
