# Harness Responsibility Matrix

Legend: **D** decides policy/meaning, **P** proposes, **E** enforces a boundary,
**X** executes, **O** observes, **V** verifies acceptance, **S** persists,
**R** reports. `—` means no ownership. `Partial` means the candidate has a
projection or shadow implementation, not complete ownership.

| Component | D | P | E | X | O | V | S | R |
|---|---|---|---|---|---|---|---|---|
| Resident | — | P | — | — | O | — | — | R |
| Context Control | D (relevance/budget projection) | P | E (bounded projection) | — | O | — | Partial | R |
| Skill Intelligence | D (selection) | P | E (selection bounds) | — | O | — | — | R |
| Workflow | D (stage/revision rules) | P | E (stage transitions) | — | O | — | S | R |
| Orchestrator / AgentLoop | Partial | P | E (loop/tool policy) | X (drives tool calls) | O | — | Partial | R |
| Model Router | D (route selection) | P | E (fit/route health) | X (invokes adapter) | O | — | — | R |
| Resource Admission | D (resource policy) | — | E (probe decision) | — | O | — | — | R |
| Execution Authority | D (permission policy) | P (operation proposal) | E (scope/digest/one-shot) | X (calls executor) | O | — | Partial audit | R |
| Legacy Harness | Partial generic gates | P | Partial policy checks | — / shadow | O | Partial generic score | trace return only | R |
| Live Harness boundary | — | — | Partial | Partial via AgentLoop | O | — | Partial trajectory | R |
| Veritas | D (acceptance semantics) | — | E (fail-closed gate) | — | O (evidence) | V | Partial report | R |
| Provenance Ledger | — | — | E (schema validation) | — | O (submitted facts) | — | S | R |
| Helix / canonical truth | — | — | E (truth-class projection) | — | O | V only by policy | S | R |
| Ghost Code / replay | — | P (reconstruction) | E (privacy/scope) | Partial observation replay | O | — | Partial metadata/trajectory | R |
| Connection Center | D (connection/status projection) | P (available paths) | E (credential/egress boundary) | X (connect/disconnect/discover) | O | — | Partial projection | R |
| Provider adapter / OpenCode bridge | — | P (provider capability) | E (bridge/host boundary) | X (provider request) | O | — | — | R |
| Model Capability Passport | — | — | E (fingerprint/lineage validation) | — | O (verified observations) | — | Future canonical owner | R |
| Synchronized Harness Profile | — | P (derived execution presentation) | E (invariant preservation) | — | O | — | Future policy projection | R |
| Cross-Model Synthesis | D (analysis criteria) | P (recommendation) | — | — | O | — | Future analysis projection | R |
| Canonical Execution Event Stream | — | — | E (ordering/redaction/scope) | — | O (subsystem facts) | — | Future journal/projection | R |
| Live Execution UI | — | — | — | — | O (stream projection) | — | Ephemeral cache/cursor only | R |

## Candidate reality versus intended division

### Duplicated or overlapping ownership

1. `harness/orchestrator.mjs` claims a reason/build/verify loop, while
   `agent-loop.mjs` is the live loop.
2. `harness/veritas.mjs` has a generic evidence score, while the live loop
   constructs a separate required-evidence projection and deliberately forces
   `passed: false`.
3. Context is built by the AgentLoop, the non-stream chat composer, and several
   route-level providers. There is no single immutable envelope.
4. Permission is canonical at HTTP Authority, but tool registry metadata,
   AgentLoop approvals, direct capability routes, legacy workflow and Telegram
   each expose adjacent policy surfaces.
5. Replay is both metadata-only `ReplayStore` and trajectory/audit persistence;
   they do not share an attempt identity.
6. Continuation, handoff, and trajectory each represent mission continuity with
   different identities and effect detail.

### Missing ownership

1. No component owns the immutable “exact thing admitted for mutation.”
2. No component owns durable resource reservation/settlement for an attempt.
3. No component owns a complete model/runtime/configuration fingerprint for each
   model call.
4. No component owns effect certainty across crashes and retries.
5. No component owns an attempt-scoped requirement/evaluator manifest.
6. No component owns a privacy-safe, attempt-scoped replay envelope.
7. No component owns empirical Model Capability Passports or derived
   Synchronized Harness Profiles.

## Boundary decisions for vNext

- Harness may enforce limits and observe execution, but cannot issue permission.
- Context Control creates the envelope; Harness records the immutable envelope
  identity/hash and does not rewrite it.
- Model Router/Orchestrator chooses a model/profile; Harness records what
  actually ran and stops on admitted budget violations.
- Resource Admission decides whether a configuration can run; it does not decide
  acceptance and does not become a model recommender.
- Veritas consumes independent attempt evidence; Harness never self-certifies.
- Provenance is the canonical history sink; Harness must feed it rather than
  create a second provenance store.
- Harness Sync calibrates presentation/execution strategy only; it cannot change
  Authority, Veritas, project isolation, or acceptance criteria.
- Cross-Model Synthesis is an analysis/projection layer over verified history,
  not a permission system or hidden model router.
- Connection Center owns access, status and discovery projection, not model
  quality, Authority or acceptance. Delegated credentials remain with the
  approved bridge; direct credentials remain with the secure credential owner.
- Model Capability Passports store attributable observations; Synchronized
  Profiles are derived policy projections; Cross-Model Synthesis analyzes
  canonical verified history. None becomes a second execution or truth system.
- The Canonical Execution Event Stream is the ordered, redacted projection of
  Harness/Authority/Resource/Veritas/Provenance facts. The Live Execution UI
  only renders it and may keep a reconnect cursor; it cannot invent mission
  state, permissions, execution, or verification.
