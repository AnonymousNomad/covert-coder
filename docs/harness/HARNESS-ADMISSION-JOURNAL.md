# HARNESS ADMISSION JOURNAL (vNext H3)

Status: IMPLEMENTED (this slice). Storage: `.aide/admission/journal.jsonl`
(append-only) + `.aide/admission/attempts/<attempt_id>.json` (sealed envelope).
Owner: DeepSeek #1 (implementation); Luna owns independent certification.

## Purpose

Durable attempt/admission lifecycle truth around the LIVE AgentLoop mutation
path. It does NOT grant permission (Authority), does NOT judge acceptance
(Veritas), and does NOT duplicate Provenance — it feeds it via `attempt_id`.

## Core invariant

```text
NO MUTATION WITHOUT DURABLE ADMISSION.
```

Before a mutation-capable tool (`write_file`, `replace_in_file`, `run_command`,
`switch_mode`, `desktop_action`) can dispatch, the loop proves durably:
which attempt, which project, which mission, which Authority context, which
execution envelope. If durable admission cannot be established, the mutation is
DENIED (fail closed, recorded as a mistake).

## Durable admission (precise definition)

BOTH must hold:
1. sealed envelope file exists (temp-write + rename, `sealed: true`);
2. journal contains `ATTEMPT_ADMITTED` for that attempt.

A crash between them is `RECOVERED_INCOMPLETE_ADMISSION` — NOT admitted, and
mutation dispatch fails closed. This closes the historical H2 partial-commit
class (admission state persisted but execution identity ambiguous, or mutation
before durable admission). Regression: `tests/arch/harness-attempt.test.ts`
("H2 PARTIAL-COMMIT REGRESSION").

## Event set (append-only; fits existing lifecycle)

```text
ATTEMPT_CREATED → VALIDATION_COMPLETED → RESOURCE_ADMITTED → AUTHORITY_GRANTED
→ ATTEMPT_ADMITTED (sealed) → EXECUTION_STARTED → CONTEXT_BOUND → CONTEXT_DRIFT*
→ EFFECT_OBSERVED* / EFFECT_UNCERTAIN* → VERIFICATION_STARTED
→ ATTEMPT_COMPLETED / ATTEMPT_FAILED / ATTEMPT_ABORTED / ATTEMPT_ACCEPTED*
→ RECOVERY_CLASSIFIED*
```

Events carry `seq`, `ts`, `attempt_id`, `event`, and a bounded scalar `data`
map. Free text is secret-redacted before persistence. Chain-of-thought,
transcripts, credentials and authorization headers are never journaled.

## Authority boundary

`model/worker proposal → Authority decision → valid permit → execution
admission → Harness execution`. The envelope and journal consume Authority
references (owner, operation kind, one-use execution context); they never
bypass or re-grant Authority.

## Resource boundary

Resource Admission remains the policy owner. The journal records its decision
(`START` / `QUEUE` / `REFUSE_RESOURCE`) verbatim; a refusal aborts admission
(`ATTEMPT_FAILED`, `RESOURCE_FAILURE`) with no session and no execution.

## Retry safety (NO BLIND RETRY AFTER UNCERTAIN MUTATION)

Computed from durable events, not from memory:

| Journal truth | retry_safety |
|---|---|
| `EFFECT_UNCERTAIN` present | `UNCERTAIN_BLOCKED` |
| `RECOVERED_UNCERTAIN` / `RECOVERED_MUTATED_UNVERIFIED` | `UNCERTAIN_BLOCKED` |
| `EFFECT_OBSERVED` (clean mutation) | `NEW_ATTEMPT_REQUIRED` (fresh attempt + fresh Authority) |
| `FAILED`/`ABORTED` with no effects | `SAFE_TO_RETRY` |
| `RECOVERED_NOT_STARTED` | `SAFE_TO_RETRY` |
| `RECOVERED_INCOMPLETE_ADMISSION` | `NOT_APPLICABLE` |

## Crash recovery

`recover()` runs at journal construction and classifies every dangling attempt,
appending `RECOVERY_CLASSIFIED` (append-only; history is never rewritten):

- incomplete admission → `RECOVERED_INCOMPLETE_ADMISSION`
- admitted, never started → `RECOVERED_NOT_STARTED`
- started, no terminal, no effects → `RECOVERED_UNCERTAIN` (conservative)
- effect observed, no verification → `RECOVERED_MUTATED_UNVERIFIED`

No attempt silently becomes `COMPLETE` or `SAFE_TO_RETRY` without evidence.

## Provenance / Veritas / Ghost Code relationships

- Provenance: each finalized run carries `attempt_id` (canonical join; no second ledger).
- Veritas: journal records `verification_state`; acceptance judgment stays Veritas-owned.
- Ghost Code / replay foundation: stable identity exists for future binding (attempt, envelope, Authority, model/runtime markers, context hash, tool effects, verification).
- Live Execution foundation: the event stream is canonical, ordered, and UI-agnostic (no frontend-specific events).

## Reads

`GET /api/harness/attempts` (list) · `GET /api/harness/attempt?id=` (envelope +
events + state + retry_safety). Both central `capability.read`.

## Measured overhead (this box, tmp workspace)

Admission (5 appends + sealed write): **~10 ms**; durable admission check
(2 reads): **~2 ms**. Measured in the H3 battery; not an SLA.

## Acceptance evidence

`tests/arch/harness-attempt.test.ts` — 16 tests: deny matrix (no admission,
wrong attempt, wrong project, incomplete, persistence failure), duplicate
identity, drift rejection, crash classifications, retry safety, wrong-attempt
evidence isolation, secret redaction, measured performance, and two LIVE
end-to-end proofs (tampered envelope ⇒ DENIED with untouched file; full happy
path ⇒ sealed envelope + CONTEXT_BOUND + EFFECT_OBSERVED + provenance join).
