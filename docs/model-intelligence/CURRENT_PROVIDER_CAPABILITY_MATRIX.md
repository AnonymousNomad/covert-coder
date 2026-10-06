# CURRENT_PROVIDER_CAPABILITY_MATRIX (source-verified)

Classes: IMPLEMENTED / PARTIAL / CONTRACT ONLY / EXPERIMENTAL / BLOCKED / ABSENT / UNKNOWN.
"Tested" = covered by focused tests read/run this cycle; "Live" = real runtime evidence this cycle.

| Capability | Class | Tested | Live | Source |
| --- | --- | --- | --- | --- |
| Native API providers (OpenAI/Anthropic/Google/Mistral/Groq) | IMPLEMENTED | yes | partial (no live provider call this cycle) | providers.ts, provider-routes tests |
| BYOK key storage (DPAPI, digest-bound descriptors) | IMPLEMENTED | yes | yes (earlier lane evidence) | byok-service, credentials.ts, byok-routes |
| Role routing (planner/coder/reviewer/utility) | IMPLEMENTED | yes | no | byok.ts, model-router routeForRole |
| Subscription/CLI auth discovery (Codex/Claude) | PARTIAL | yes | no | provider-connections.mjs |
| OpenCode managed bridge | IMPLEMENTED | yes | earlier-lane evidence | opencode-bridge.ts |
| OpenRouter as provider entry + egress allow | PARTIAL (no live catalogue search route) | providers tests | no | providers.ts BUILTIN |
| OpenRouter live catalogue discovery | ABSENT | — | — | research queue |
| Hugging Face search/files/download/import | IMPLEMENTED | yes | yes (live search this cycle) | modelhub.mjs + routes |
| HF download resume/cancel/progress | IMPLEMENTED | yes | cancel live-proven earlier; download staged | modelhub tests |
| Nested HF artifact paths | IMPLEMENTED [mi1b, pending convergence] | yes (3 regression) | no | encodeArtifactPath |
| GGUF inspection/ingest/fit | IMPLEMENTED | yes | yes (manifest probe live) | gguf.ts, model-fit.ts |
| Safetensors/Transformers | ABSENT | — | — | no path found |
| Covert-managed runtime (Unsloth canonical) | IMPLEMENTED | yes | passport-qualified historically; not run this cycle | runtime-adapter, unsloth adapter |
| llama.cpp recovery adapter | IMPLEMENTED (explicit; no auto fallback) | 56/56 focused | admission-refusal live; full lifecycle BLOCKED (RAM) | gfx900 branch |
| External local runtime (arbitrary OpenAI-compatible URL) | PARTIAL (DIRECT_HTTP kind in contracts; no discovery/qualification) | partial | no | model-access.ts, model-router |
| Ollama detection/adapter | ABSENT | — | — | none |
| LM Studio detection/adapter | ABSENT | — | — | none |
| vLLM adapter | ABSENT | — | — | none |
| Health-gated routing + fallback typing | IMPLEMENTED | yes | no | model-router.ts |
| Qualification/freshness/staleness (Atlas) | IMPLEMENTED [mi1b] | 50/50 | yes (real record) | model-atlas.* |
| Harness Sync candidate creation (no execution) | IMPLEMENTED [mi1b] | 8/8 | yes | harness-sync.ts |
| Resident binding (Cipher↔Liquid) | IMPLEMENTED [mi1b] | 13/13 | route exposure; UNBOUND truthfully | resident-binding.* |
| Resource Admission floors | IMPLEMENTED | yes | yes (typed refusal live) | resource-admission.ts |
| `/api/models/status` in compat mode, unstarted | DEFECT (isolated) | — | yes (500 / hang) | routes/models.ts + broker path |

Legend: [mi1b] = commit on model-intelligence branch pending convergence; [gfx900] = PR #41 branch.
