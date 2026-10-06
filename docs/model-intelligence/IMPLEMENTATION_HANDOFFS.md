# IMPLEMENTATION HANDOFFS — Provider Ecosystem (RC1-filtered)

Classification per capability: **RC1 CAPABILITY REQUIRED · FOUNDATION REQUIRED / ACTIVATION NOT
REQUIRED · BACKLOG · REJECTED**. "Documented" vendor capability is never treated as Covert-qualified;
`CURRENT STATE` reflects only source-verified or Covert-observed evidence (see PROVIDER_SOURCE_TRUTH.md).
Vendor-document rows still pending first-party retrieval are marked `[DOC-PENDING]` with the exact source
to fetch; nothing is written from memory.

## FINAL TABLE (finite handoff)

| CAPABILITY | CURRENT STATE | RC1 NEED | OWNER | IMPLEMENTATION BOUNDARY | DEPENDENCIES | ACCEPTANCE TEST | SECURITY GATE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Native providers (OpenAI/Anthropic/Google/Mistral/Groq) + BYOK | IMPLEMENTED, tested; descriptors digest-bound; DPAPI store | RC1 CAPABILITY REQUIRED (exists) | Model Intelligence lane | `providers.ts`, `byok-service.mjs`, `credentials.ts`, `routes/byok.ts` — no new registry | Authority, egress allowlist | existing byok/provider route matrices stay green | sha256-digest secret binding; egress journal |
| Provider-connections lifecycle + role routing | IMPLEMENTED (planner/coder/reviewer/utility; subscription/CLI discovery partial) | RC1 CAPABILITY REQUIRED (exists) | Model Intelligence lane | `provider-connections.mjs`, `model-router.ts` | BYOK, builtins | connections/routing suites green | no plaintext secrets in state/logs |
| Hugging Face catalogue + acquisition (GGUF) | IMPLEMENTED; live search observed this cycle; nested-path fix `[mi1b]` pending convergence | RC1 CAPABILITY REQUIRED (exists) | Model Intelligence lane | `modelhub.mjs`, `routes/modelhub.ts` | Authority (external ops), egress, containment | modelhub unit + route suites; nested-path regressions | egress journal; containment; optional token never logged |
| GGUF inspect/ingest/fit | IMPLEMENTED, live manifest probe observed | RC1 CAPABILITY REQUIRED (exists) | Model Intelligence lane | `gguf.ts`, `model-fit.ts`, `model-runtime.ts` | hardware probe | gguf/fit suites | arch allowlist fail-closed |
| Canonical Unsloth runtime path | IMPLEMENTED; passport-scoped; untouched | RC1 CAPABILITY REQUIRED (exists) | Runtime lane (PR #41 lineage) | `runtime-adapter.ts`, `unsloth-runtime-adapter.ts` | admission, passport | existing broker suites | ownership verification; admission floors |
| Runtime Broker adapter seam + explicit selection (reusable) | IMPLEMENTED on PR #41 (`3e50cb4`); no auto fallback | FOUNDATION REQUIRED / ACTIVATION NOT REQUIRED | Runtime lane | `runtime-adapter.ts`, `broker-model-runtime.ts`, `openapi.ts` composition seam | admission upstream | runtime-compatibility 5/5 + broker suites 56/56 | explicit activation only; ownership checks |
| llama.cpp reference/compat lifecycle (live) | PARTIAL / RESOURCE ADMISSION (physical < 6,656 MB; refusal live-proven) | FOUNDATION REQUIRED (seam) — full lifecycle BACKLOG [EXPERIMENT] | Runtime lane | same as above + `scripts/runtime-compat-live.mjs` harness | host RAM window | full start→infer→stream→cancel→recover→stop | admission-before-load; owned PID only |
| `/api/models/status` in compat composition | KNOWN DEFECT, experimental-scope only (500 / hang; canonical path unaffected) | BACKLOG [EXPERIMENT] (no V1 route dependency found) | Runtime lane | `routes/models.ts` projection + broker compat status | — | focused status projection test when repaired | no false READY; truthful unavailable state |
| gfx900 hardware qualification | NOT PROVEN; evidence preserved | BACKLOG [EXPERIMENT] | External tester hardware lane | n/a (qualification matrix) | real gfx900 hardware | HIP/ROCm evidence matrix | no support claim without evidence |
| OpenRouter live catalogue | ABSENT (static provider entry only) `[DOC-PENDING: openrouter.ai/docs/api-reference]` | BACKLOG [POST-RC] | Model Intelligence lane | provider adapter family FN-02 | FN-02, FN-05 | catalogue→qualification journey test | catalogue ≠ execution; metadata treated untrusted |
| Ollama / LM Studio / vLLM / external OpenAI-compatible runtimes | ABSENT as adapters `[DOC-PENDING: ollama api.md; lmstudio docs; vLLM OpenAI server]` | FOUNDATION REQUIRED (detection+external-local seam FN-04) / integration BACKLOG | Model Intelligence lane | new adapter family over existing identity chain | FN-04, Authority, egress | detect→propose (never auto-enroll) + explicit connect test | detection ≠ authorization; localhost impersonation checks |
| Anthropic-compatible servers (non-native) | ABSENT beyond native provider entry `[DOC-PENDING: messages API spec]` | BACKLOG [POST-RC] | Model Intelligence lane | adapter family FN-02 | FN-02 | protocol conformance suite | TLS + endpoint identity rules |
| Safetensors/Transformers catalogue objects | ABSENT (no representable class) | FOUNDATION REQUIRED (FN-03 representation only) | Model Intelligence lane | model-access contract extension (additive) | FN-03 | non-executable representation test | never claim executability without evidence |
| Assisted onboarding UX contract (detect/select→endpoint→auth→discover→probe→qualify→assign) | ABSENT | FOUNDATION REQUIRED / ACTIVATION NOT REQUIRED | Model Intelligence lane (contract) + UI owner consumes | contract in model-access + connections projection | FN-02/04/05 | journey conformance test with refusal paths | no silent enrollment/egress/routing |
| Provider-ecosystem security review | THIS DOC SET defines the threat rows (table below) | FOUNDATION (review artifact) REQUIRED | Model Intelligence lane | reuses Authority/egress/admission | — | threat rows each mapped to an existing control | no new security system |

## Threat rows (mapped to existing controls; no new security system)
| Threat | Existing control |
| --- | --- |
| Malicious custom endpoint / endpoint substitution | explicit operator endpoint identity + TLS rules; no fallback |
| Localhost impersonation / SSRF | loopback-only defaults; host allowlist (`provider-hosts.json`); egress manifest |
| Credential exfiltration | DPAPI store; digest-only descriptors; no plaintext in state/logs; env scrub |
| Malicious model metadata / capability lies | metadata untrusted; qualification requires Covert-observed evidence (Atlas) |
| Poisoned artifacts | sha256 identity chain + GGUF probe + containment |
| Silent cloud fallback | REJECTED by law; explicit activation only |
| Stale auth / changed backend identity | health TTL + identity revalidation (`model-router`), connection lifecycle tests |
| Cross-project credential leakage | workspace-scoped `.aide/` state + Authority binding |

## Pending first-party retrieval (next session's opening action; no fabrication)
Fetch and extract DISCOVERY/AUTH/MODELS/STREAMING/CANCELLATION/TOOLS/STRUCTURED-OUTPUT/EMBEDDINGS/
MULTIMODAL/USAGE/METADATA/LOCAL-vs-REMOTE/FAILURE/SECURITY/TERMS for: OpenRouter API reference; HF Hub
API docs; Ollama `api.md`; LM Studio REST/server docs; llama.cpp server README; vLLM OpenAI-server docs;
OpenAI-compatible and Anthropic-compatible protocol references — then update this file's `[DOC-PENDING]`
rows and PROVIDER_ECOSYSTEM_RESEARCH.md. Owners remain the existing lanes listed above; no new agent assigned.
