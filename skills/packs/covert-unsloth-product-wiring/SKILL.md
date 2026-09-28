---
name: covert-unsloth-product-wiring
description: Connect Covert's production model, chat, and agent paths to the frozen canonical Unsloth Runtime Broker while preserving inventory, Authority, qualification, and explicit recovery boundaries. Use when product routes still execute the legacy direct llama.cpp ModelRuntime or a local dogfood run cannot reach Unsloth.
---

# Canonical Unsloth product wiring

## Accepted contract and dependencies

Read `docs/design/local-runtime-lab/UNSLOTH-V1-SUPPORT-CONTRACT.md`, `RUNTIME-ADAPTER-CONTRACT.md`, relevant Passport, and the exact product routes. Unsloth is canonical for the qualified Windows/Administrator/Vulkan/Liquid profile; direct llama.cpp is explicit journaled recovery only. The adapter owns process/port verification, API key use, load hash, inference and shutdown. Covert owns inventory, approval, qualification, selection and admission. A connected or imported model is never automatically qualified or executable.

## Procedure

1. Pin HEAD and current lane; check memory/commit/VRAM, Unsloth version, artifact SHA, process and listener ownership without printing credentials.
2. Trace status, start, ready, chat, stream, cancel, agent, role routing and shutdown from actual route construction. Identify each legacy direct path.
3. Bridge production dispatch to one RuntimeBroker instance. Preserve explicit injection seams for isolated tests. Never silently fall back to direct llama.cpp.
4. Bind model selection to allowlisted ID and verified artifact path/hash, backend identity, numeric loopback endpoint, and Authority approval. Treat unverified runtime-reported model IDs as insufficient qualification.
5. Project health, loaded identity, availability and failure truthfully. The old binary or import alone must not report the canonical backend ready. Keep context-window values labeled declared until effective served context is measured.
6. Exercise start → status → nonstream chat → stream → cancellation → stop and application shutdown through Covert, then negative cases (missing key/artifact, foreign port, wrong model, resource pressure). Verify owned cleanup.

## Forbidden approaches and risks

- Do not adopt a matching `/v1/models` response as process ownership, fetch with a key before identity checks, silently relocate a canonical port, or kill an unrelated process.
- Do not route ordinary product inference through the legacy `ModelRuntime` binary spawn path, or mark an imported artifact qualified from a path/name alone.
- Do not assert a model capability based on an adapter method or a single test model. Log only safe error codes; never token values or private prompts.
- Do not weaken the frozen runtime qualification or alter accepted adapter internals to make a product route pass.

## Stop, rollback and evidence

Stop on identity mismatch, unknown listener, failed hash, changed Runtime Passport, denial, insufficient resources or unexplained test failure. Preserve the failed state; do not retry blindly. Keep changes isolated to the product bridge and its tests so a focused revert restores the prior source path without deleting user models or credentials. Record baseline SHA, exact tests, operator-visible state, port/PID ownership, cleanup, and limits. Release acceptance needs a packaged application journey, not only an isolated broker test.
