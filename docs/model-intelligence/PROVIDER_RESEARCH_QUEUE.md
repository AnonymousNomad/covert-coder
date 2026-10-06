# PROVIDER_RESEARCH_QUEUE — remaining deliverables, method, and staging rule

Session budget allowed only the source-verified set. Nothing here may be written from memory:
each item's research must cite primary documentation with URLs and separate fact from inference.

## Staged deliverables (owner: DeepSeek research lane; do NOT implement)
1. PROVIDER_ECOSYSTEM_RESEARCH.md — per candidate (OpenRouter, Ollama, LM Studio, llama.cpp server,
   vLLM, OpenAI-compatible, Anthropic-compatible, Safetensors/Transformers): auth, discovery API,
   protocol, streaming, cancellation, tools, structured output, embeddings, multimodal, context limits,
   quota metadata, licensing, offline/failure behavior. Sources: vendor primary docs (OpenRouter API,
   Ollama api.md, LM Studio REST docs, vLLM OpenAI server docs, Anthropic Messages API, HF Hub docs).
   Method: webfetch each primary source this cycle was unable to run; record URL + retrieval date.
2. CUSTOM_BACKEND_CONTRACT.md — protocol families (Native / OpenAI-compatible / Anthropic-compatible /
   External-local / Covert-managed / Aggregator) mapped onto EXISTING Model Access identity chain,
   authority, admission; no parallel registry (draft skeleton only where source-verified).
3. PROVIDER_ADAPTER_MATRIX.md — per adapter: current class, required change, dependencies, tests.
4. MODEL_FORMAT_RUNTIME_MATRIX.md — GGUF (exists) vs Safetensors (absent) vs catalogue-only objects;
   disk/compat/runtime-candidate columns; never claim executability without evidence.
5. PROVIDER_SECURITY_REVIEW.md — threat table (endpoint substitution, SSRF, localhost impersonation,
   credential exfil, poisoned metadata/artifacts, capability lies, silent fallback, stale auth,
   changed backend identity, cross-project leakage) mapped to existing Authority/egress/admission
   (reuse `egress-manifest`, `provider-hosts.json`, digest-bound BYOK, admission) — no new security system.
6. PROVIDER_RELEASE_ROADMAP.md — buckets per §10 (A close-release / B architecture-now / C post-RC),
   mirrored into RELEASE-CONTROL-BOARD.md.
7. IMPLEMENTATION_HANDOFFS.md — per §10 handoff schema (OWNER/CURRENT/CHANGE/FILES/DEPS/TESTS/SECURITY/ACCEPTANCE).
   Candidate handoffs already grounded: AR-01 protocol family boundary; AR-02 catalogue≠execution;
   AR-03 assisted localhost discovery; AR-04 capability observation store; RC-02 status defect repair.

## Zero-config discovery design constraints (pre-recorded, source-verified constraints only)
- Detection ≠ authorization (Authority + egress policy bind every connect/probe).
- No silent enrollment/route/data transmission; detection surfaces a proposal only.
- Provenance rules already in-repo: egress journal, host allowlists, digest-bound secrets, admission floors.

## Staging rule
All research files live outside worktrees until the owner assigns a docs-only branch:
current staging: `E:\pip_temp\opencode\provider-research\` (read-only lane; no production code touched;
no commits made; gfx900/MI worktrees left exactly as found, including their foreign in-flight edits).
