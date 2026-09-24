# Harness H3 Consolidation

Status: **EVIDENCE CONSOLIDATION — NO NEW RUNTIME SLICE AUTHORIZED**

Checkpoint: `993df08f09a7ba2bc61b249f88e1df79a8d7e9bd`

Certified source candidate preserved unchanged:
`dc0d30ee226e7ff822592e3a800f064b4441b7af`

This document separates focused H3 evidence from release certification. It
does not authorize H4, Model Working Memory, Harness Sync, or a Resident
awareness implementation.

## H3 evidence map

| Claim | Implementation location | Test/evidence | Observed result | Limitation | Release status |
| --- | --- | --- | --- | --- | --- |
| Sealed admission is required before mutation | `node/src/services/attempt-journal.ts`: `prepare`, `seal`, `assertAdmitted`; live `agent-loop.mjs` path | `tests/arch/harness-attempt.test.ts`: pre-seal denial, live tamper denial | Sealed envelope plus durable `ATTEMPT_ADMITTED` required | Two durable artifacts are coordinated fail-closed, not one distributed transaction | FOCUSED PASS; not release-certified |
| Attempt creation is durable and collision-safe for the exercised service | `writeEnvelope` temp-file/fsync/rename; serialized journal append | persistence failure, duplicate identity, concurrent seal tests | Unsealed preparation cannot authorize; duplicate seal is idempotent | Cross-process writer coordination is not implemented | FOCUSED PASS; not release-certified |
| H2 partial commit cannot authorize mutation | `assertAdmitted` requires sealed envelope and admission record; `recover` classifies incomplete admission | `H2 PARTIAL-COMMIT REGRESSION` | Reproduced crash shape is denied and classified `RECOVERED_INCOMPLETE_ADMISSION` | Recovery is evidence classification, not automatic repair | FOCUSED PASS; not release-certified |
| Event ordering is canonical within an attempt | serialized append chain, attempt-local `seq`, `<attempt>:<seq>` `event_id` | concurrent observations and out-of-order journal tests | Unique ordered cursors; malformed/out-of-order integrity is explicit and admission fails closed | Journal is workspace-local JSONL; no distributed event broker | FOCUSED PASS; not release-certified |
| Events are attributable | `AttemptJournalEvent` fields: attempt, mission, project, source, sequence, redaction | live event assertions | Every exercised event carried the expected attempt/mission/project/source/redaction fields | Model/runtime/reasoning identity is still incomplete or `NOT_RECORDED` | FOCUSED PASS; not release-certified |
| Cursor reconnect is gap-detectable | `GET /api/harness/attempt/events`; `stream(after, limit)` | live first-page/reconnect test | Strictly-after cursor returned no duplicate semantic events and exposed integrity | Read API only; no SSE/WebSocket transport in H3 | FOCUSED PASS; not release-certified |
| Provenance is linked without duplicating the stream | `provenance.ts`, `provenance-ledger.ts`; logical `attempt:<id>` reference | live provenance assertion and Mission Receipt projection | Provenance records the attempt and stream reference | Reference is not a complete receipt or Veritas verdict | FOCUSED PASS; not release-certified |
| Secret redaction is applied before persistence | `redactSecrets` and journal writer | task/reason/command/provider-error redaction test | Exercised credentials were absent from journal/envelope text | Pattern-based redaction is not proof of universal secret detection | FOCUSED PASS; not release-certified |
| Project and attempt isolation are enforced | project-bound `assertAdmitted`, per-attempt filtering, workspace journal | wrong-project, wrong-attempt and live tamper tests | Cross-project admission and cross-attempt event attribution were denied | Broader multi-process and all evidence-store isolation remain outside H3 | FOCUSED PASS; not release-certified |

The focused Harness battery is **20/20**. Contract/route tests are **12/12**.
Node and browser typechecks, changed-file lint, OpenAPI generation, contract
drift and route-authority coverage pass on the H3 worktree. These are slice
results, not a release certification.

## H3 requirement trace

| Requirement | H3 disposition | Evidence or gap |
| --- | --- | --- |
| Attempt identity | SATISFIED | Durable attempt UUID, mission/project binding and cursor identity |
| Mission/project binding | SATISFIED | Envelope fields, expected-project admission check, isolation tests |
| Workflow/stage identity | PARTIAL | Envelope retains `NOT_RECORDED`; no new workflow owner was created |
| Worker identity/role | PARTIAL | Admission input records worker fields; actual observed runtime identity is not fully reconciled |
| Model/provider identity | PARTIAL | Requested worker model/provider are bound; observed adapter/model fingerprint is incomplete |
| Runtime identity/version | NOT IMPLEMENTED | Deliberately deferred to canonical model/runtime contracts |
| Reasoning/budget identity | PARTIAL | Iteration/context bounds are recorded; provider reasoning and complete cost budget are unknown |
| Context hash | SATISFIED | Context is bound before seal and later drift is recorded without rewriting the envelope |
| Skill/SOP provenance | PARTIAL | H3 emits `SKILL_SELECTED` metadata; exact Skill IDs, versions, hashes and references are not yet bound |
| Authority linkage | PARTIAL | Permit identity and action/tool decision events are linked; Authority remains the permission owner |
| Tool execution linkage | SATISFIED for exercised tools | Request, permit, start, observation and effect events are recorded; process-level uncertainty remains limited |
| Verification linkage | PARTIAL | Veritas result event and evidence references exist; test-battery execution counts are not canonicalized by H3 |
| Evidence linkage | PARTIAL | Provenance stores a logical event-stream reference; full Mission Receipt projection is later work |
| Retry/repair identity | NOT IMPLEMENTED | H3 preserves failure truth but does not create a new repair-attempt lineage |
| Handoff identity | PARTIAL | Existing handoff ID can enter the envelope; H3 does not yet emit complete handoff lifecycle events |
| Resource admission | PARTIAL | Decision is recorded; durable reservation/settlement is not owned by H3 |
| Failure attribution | PARTIAL | Uncertain effect and recovery classifications exist; the complete taxonomy and first-divergence attribution remain future work |
| Replay semantics | PARTIAL | Ordered operational observations support future semantic/observation replay; replay execution is not implemented |

No missing row above is being filled with a new H4 subsystem. A field is
`NOT_RECORDED` or `PARTIAL` when the canonical owner does not yet provide safe
truth.

## Event stream quality review

H3 is sufficient as a stable foundation for a future Live Execution projection
because it provides scoped order, durable identity, redaction state and a
reconnect cursor. It is not yet a complete answer for every future surface.

| Future question | H3 status | Classification |
| --- | --- | --- |
| Who acted and on which attempt/project? | Event identity and source are present | SATISFIED for current events |
| Which model/runtime actually ran? | Requested worker fields exist; observed runtime fingerprint is incomplete | NEEDED LATER |
| Which context entered the call? | Context hash and bound block names are present | SATISFIED for current envelope; content projection remains Context Control-owned |
| Which exact Skills/version influenced the call? | Only compact selection metadata is emitted | NEEDED LATER |
| What resource decision was made? | Start/queue/refuse event and envelope decision exist | PARTIAL; durable reservation is NEEDED LATER |
| What Authority decision occurred? | Request/permit/denial events and operation references exist | PARTIAL; Authority remains canonical |
| What actually mutated? | Effect/file mutation observations exist for exercised file tools | PARTIAL; uncertain process side effects remain NEEDED LATER |
| Which tests really ran? | Command observations can be recorded | NEEDED LATER for battery-guard execution counts |
| What evidence supported acceptance? | Veritas/provenance references exist | PARTIAL; Mission Receipt projection is NEEDED LATER |
| Can an attempt be reconstructed? | Ordered observations and references exist | PARTIAL; Ghost semantic/observation replay is NEEDED LATER |
| Can a repair be compared to its parent? | Existing parent contracts are not emitted by H3 | NEEDED LATER |

The event stream must not be expanded merely to make the UI look complete. A
future event is justified only when it closes a governance, diagnostic,
reproduction or acceptance question and has a canonical fact owner.

## Awareness/context ownership boundary

Pending Resident evidence, the working ownership hypothesis is:

```text
Context Control → selects/builds relevant model-facing context
Workflow       → owns stage and obligations
Skills         → selects applicable methodology
Helix          → supplies canonical durable truth
Harness        → binds immutable inputs and records attempt observations
Resident       → reasons over the governed situation
Veritas        → independently evaluates outcomes
Provenance     → records attributable history
```

Harness may hash, bind, reject drift and expose a scoped projection. It must
not become the system that retrieves project truth, constructs arbitrary
context, selects Skills, or advances Workflow by assertion.

## Future attempt-input contract (design only)

The following is a review template, not a runtime schema. Each field requires
an authoritative producer before it can be required at admission.

| Candidate input | Classification | Current H3 state |
| --- | --- | --- |
| `project_id`, `mission_id`, `attempt_id` | REQUIRED | `project_id`/`mission_id`/`attempt_id` bound |
| `workflow_id`, `stage_id` | OPTIONAL until Workflow supplies canonical IDs | `NOT_RECORDED` in current envelope |
| `worker_id`, `worker_role` | REQUIRED when a worker is selected | role and requested identity recorded |
| `model_id`, `provider_id` | REQUIRED when resolved | requested values recorded; observed identity partial |
| artifact hash, runtime ID/version, chat template | OPTIONAL until runtime contract exists | `NOT_RECORDED` |
| reasoning budget | OPTIONAL until policy resolves it | iteration/context limits only |
| context envelope hash | REQUIRED for model-facing execution | bound before seal |
| situation-frame hash | NOT YET JUSTIFIED | wait for Liquid result |
| capability-surface hash | NOT YET JUSTIFIED | wait for canonical Capability Fabric |
| Skill projection hash/version | OPTIONAL until Skill provenance contract lands | current H3 stores limited selection metadata |
| Authority state / permit identity | REQUIRED for mutation-capable execution | operation reference recorded; Authority owns decision |
| resource admission ID | OPTIONAL until durable reservation exists | decision recorded, no reservation ID |
| objective and acceptance contract | REQUIRED when canonical owners provide them | objective recorded; acceptance is partly `NOT_RECORDED` |
| parent/retry/repair/handoff lineage | REQUIRED for derived attempts | future lineage integration |
| timestamps | DERIVED | journal/envelope timestamps |

This table is intentionally conservative. A missing value stays explicit rather
than being inferred from model output, UI state or a transcript.

## 148/149 regression classification

The affected regression was reproduced on `993df08` in
`tests/arch/handoff-routes.test.ts`: the asynchronous session created by the
preceding secret-transcript test could finish after the inert-import test's
filesystem snapshot, adding trajectory/verification artifacts. The same test
passed 7/7 on the H3 parent `eb324c8`, so the failure was not pre-existing on
that parent.

Classification: **H3_REGRESSION — TEST-FIXED, RUNTIME UNCHANGED**.

The fix awaits the intentionally asynchronous session's terminal state before
the fixture boundary. It does not loosen the inert-import assertion or change
agent/Harness semantics. The corrected handoff route battery passes **7/7**.

The broader architecture gate remains non-green for other known baseline
failures and is not represented as an H3 release certification.

## Current hold

```text
H3 behavioral surface: FROZEN
H3 evidence: CONSOLIDATED
H4 implementation: NOT AUTHORIZED
Model Working Memory runtime: NOT IMPLEMENTED
Liquid Resident awareness result: PENDING
```
