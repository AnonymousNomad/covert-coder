# Harness vNext Slice 1 — Implementation Record

Status: implemented on `feat/harness-vnext-h3` as a post-candidate line.

Certified source candidate preserved unchanged:

`dc0d30ee226e7ff822592e3a800f064b4441b7af`

## Implemented contract

The live AgentLoop now prepares an unsealed execution envelope, binds the
observed context before the first model call, seals the envelope atomically,
durably records `ATTEMPT_ADMITTED`, and only then enters execution. Mutation
tools require the sealed envelope, the admission record, and the expected
project binding on every dispatch.

The admission journal is append-only JSONL under `.aide/admission/journal.jsonl`
with an atomic per-attempt envelope under `.aide/admission/attempts/`. Each
event has an attempt-local monotonic cursor and deterministic event identity:
`<attempt_id>:<seq>`. Appends are serialized and fsynced; malformed or
out-of-order records make admission fail closed.

## Historical H2 failure addressed

H2 could persist partial admission truth before the authoritative execution
identity was durable. The new boundary requires both a sealed envelope and an
`ATTEMPT_ADMITTED` event. A crash between those writes is classified as
`RECOVERED_INCOMPLETE_ADMISSION`; no mutation can pass `assertAdmitted`.

The live path uses `prepare → bind context → seal → executionStarted`. A
material context change after sealing is recorded as `CONTEXT_DRIFT`; the
sealed envelope is never rewritten.

## Event and persistence relationship

The journal is the canonical ordered execution observation for an attempt. It
records model request/response metadata, tool and Authority boundaries, real
file effects, command observations, verification, and provenance references.
It does not store chain-of-thought, credentials, or raw secret-bearing data.

The existing Provenance Ledger remains the canonical run ledger. It stores the
attempt identity and a logical `attempt:<id>` event-stream reference; it does
not duplicate the stream. Veritas remains the acceptance authority. Mission
Receipts may project the logical event reference as evidence, but an event is
an observation, not a verified conclusion.

## Read API

Authenticated read routes expose:

* `GET /api/harness/attempts`
* `GET /api/harness/attempt?id=<uuid>`
* `GET /api/harness/attempt/events?id=<uuid>&after=<seq>&limit=<n>`

The event route is cursor-based and reconnectable. A client resumes strictly
after `next_after`, de-duplicates by `event_id`, and receives explicit
`OK`/`CORRUPT`/`OUT_OF_ORDER` integrity state. The route is a projection of
the durable journal; it is not a UI-owned cache or inferred process watcher.

## Failure semantics

An observed mutation without terminal verification requires a new attempt.
An uncertain effect produces `EFFECT_UNCERTAIN` and blocks blind retry. A
repair/retry must create a new attempt and retain the original lineage. A
worker claim cannot produce `ATTEMPT_ACCEPTED`; only the existing Veritas path
can determine acceptance.

## Known limitations

* Full Live Execution frontend projection is not part of this slice.
* The journal is per-workspace JSONL, not yet a distributed event broker.
* Provider-specific hidden reasoning/token counts remain `UNKNOWN` unless the
  adapter reports safe operational metadata.
* Existing tool execution still needs later hardening for process-level
  uncertain-side-effect observation and complete battery/test event semantics.
* Model Working Memory / Attempt Sandbox remains a review-only, unimplemented
  capability pending the Liquid Resident operational-awareness experiment; the
  current attempt stream must not be treated as a working-memory store.
* Capability Fabric, Harness Sync, model passports, delegation, and
  cross-model synthesis remain outside this slice.

## Verification record

The focused Harness battery passes **20/20**. It covers H2 partial admission,
pre-seal execution denial, concurrent seal idempotence, context drift,
uncertain mutation, cross-attempt isolation, secret redaction, ordered event
cursors/reconnect, tamper denial, live mutation observation, and Provenance
linkage. Node and browser typechecks, changed-file lint, OpenAPI generation,
contract drift, and route-authority coverage pass on this worktree.

The affected handoff route battery now passes **7/7** after its fixture was
made to await the intentionally asynchronous session it starts. The prior
`148/149` result was an H3-exposed test-isolation race, reproduced as absent on
parent `eb324c8`, and fixed without changing runtime semantics. See:

```text
docs/harness/HARNESS-H3-CONSOLIDATION.md
docs/harness/RESIDENT-AWARENESS-INTEGRATION-GATE.md
```

## Rollback

Rollback is a branch-level revert of the post-candidate Harness-vNext commit.
The certified source candidate is not rewritten. Existing `.aide/admission`
data is treated as post-candidate evidence and must not be silently promoted
to canonical truth if the implementation is rolled back.
