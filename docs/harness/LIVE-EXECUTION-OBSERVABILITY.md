# Live Execution Observatory

Status: **INTENDED PRODUCT REQUIREMENT — ARCHITECTURE / UX CONTRACT ONLY**

Working product name: **Live Execution**. “Execution Observatory” is the
internal architectural description; the user-facing label should remain short.

## 1. Goal

The Resident is the conversational front door. The workspace shows the work.
The Harness records what actually happened. Veritas determines whether it
worked.

The intended flow is:

```text
user request
→ Resident
→ mission begins
→ canonical execution events
→ editor / terminal / worker / Authority / verification projections
→ Mission Receipt
```

The operator must be able to answer, without guessing:

```text
what is active
which worker/model is active
what stage is active
what file/tool/command is active
what Authority decided
what tests actually ran
what Veritas observed
what remains uncertain
```

## 2. Non-goals

Live Execution must not become:

```text
private chain-of-thought viewer
hidden-reasoning-token viewer
credential or authorization-header viewer
random-process watcher that guesses mission state
UI-owned execution log or second provenance store
fake typing/progress animation
permission or approval bypass
replacement for the editor, terminal or Resident
unbounded raw stdout/transcript archive
```

Operational facts are visible. Private reasoning, secrets, unsafe internal
prompts and unrelated private context remain hidden or redacted.

## 3. Canonical event source

The UI must consume a canonical event projection from the execution boundary:

```text
Context Control / Skills / Workflow / Router
                 ↓ selected facts
       sealed execution envelope
                 ↓
Harness + Authority + Resource Admission
                 ↓ observed events
     Provenance / event stream projection
                 ↓
          Live Execution UI
```

This is compatible with the Crown-Jewel review's proposed durable attempt
journal. It must not create a second UI-specific truth store. Existing Authority
audit events, Veritas evidence and Provenance records remain owned by their
canonical subsystems and are referenced by the stream.

The UI may maintain an ephemeral render cache and a reconnect cursor. It may
not synthesize a `WORKING`, `PASS`, `VERIFIED`, `COMPLETE` or similar state from
spinner time, process existence, model prose, or a missing event.

## 4. Event envelope requirements

Every user-visible execution event must be attributable and ordered within its
mission/attempt:

```text
event_id
event_schema_version
mission_id
project_id
workflow_id and workflow_revision when available
stage_id when available
attempt_id and parent_attempt_id when available
monotonic_sequence within the event stream
occurred_at
emitted_at when different
source_owner
event_kind
safe_payload
causal_event_ids
authority_refs when relevant
evidence_refs when relevant
redaction_status
```

The event identity and sequence are canonical. UI arrival order is not. On
reconnect, the client requests a snapshot plus events after its last confirmed
sequence. A sequence gap is shown as `EVENTS CATCHING UP` or `STATE UNKNOWN`,
not silently filled.

## 5. Event kinds

The following is a minimum conceptual vocabulary. Existing contracts may map
to different names; implementation must preserve their ownership and meaning.

```text
MISSION_STARTED
CONTEXT_ENVELOPE_SEALED
SKILL_SELECTED
WORKFLOW_STAGE_CHANGED
WORKER_SELECTED
MODEL_RESOLVED
RESOURCE_DECISION
RESOURCE_STATE_CHANGED
AUTHORITY_REQUESTED
AUTHORITY_RESULT
ATTEMPT_ADMITTED
ATTEMPT_STARTED
TOOL_REQUESTED
TOOL_STARTED
TOOL_OUTPUT
TOOL_FINISHED
FILE_OBSERVED
FILE_MUTATION_OBSERVED
DIFF_AVAILABLE
PROCESS_STARTED
PROCESS_STATE_CHANGED
TEST_STARTED
TEST_PROGRESS
TEST_FINISHED
HANDOFF_CREATED
REPAIR_ATTEMPT_CREATED
RETRY_BLOCKED
VERIFICATION_STARTED
VERIFICATION_RESULT
EVIDENCE_RECORDED
MISSION_STATE_CHANGED
CANCELLATION_REQUESTED
PAUSE_REQUESTED
ATTEMPT_TERMINAL
MISSION_RECEIPT_READY
FAILURE
UNKNOWN_STATE
```

Not every event is durable at the same granularity. High-volume terminal
chunks may be streamed with bounded retention while the command identity,
result, hashes, counts and evidence reference are durable. A UI render event
is never a canonical execution event.

## 6. Source ownership

| Observable fact | Canonical source | UI behavior |
|---|---|---|
| mission/stage | Resident/Workflow/Orchestrator contract | display source and revision |
| context sealed | Context Control + sealed envelope | show ID/digest summary, not private prompt dump |
| Skill selected | Skill Intelligence/provenance projection | show ID/version/name and loaded-size summary |
| worker/model/provider | Model Router/adapter/runtime observation | show requested versus actual when they differ |
| resource state | Resource Admission / Health contract | show decision, reason and timestamp |
| permission | Execution Authority | show requested/permitted/denied/expired/consumed |
| command/process | Harness/tool observation | show actual command, bounded output and result |
| file/diff | Harness/filesystem observation | show actual mutation/diff and uncertainty |
| verification | Veritas | show claim, evidence, checks and verdict separately |
| receipt | Mission Receipt canonical projection | link to the same event/evidence IDs |

The UI must never promote an advisory model or worker event into one of these
truth classes.

## 7. Editor observability

When a worker reads or changes a file, the projection may show:

```text
active file/path
mission and attempt
worker role and actual model
read/created/modified/deleted/moved state
changed ranges or resulting diff
Authority reference when mutation was governed
before/after or uncertainty state
```

Atomic patch generation displays the resulting patch/diff. Incremental edits
display actual observed changes. There is no simulated keystroke animation.
If a write's final effect is uncertain, the file view says `EFFECT UNKNOWN`
and does not display a false clean state.

## 8. Terminal observability

The governed terminal view may show:

```text
command after secret redaction
working directory within the allowed scope
mission/attempt/worker
start time and running state
stdout/stderr, bounded and redacted
exit status
duration
requested/discovered/executed test counts when applicable
evidence link
```

Output is virtualized or truncated for large streams. The full safe evidence
artifact remains available where the canonical evidence contract permits it.
An exit code of zero is an execution observation, not a verification verdict.

## 9. Worker, model and Harness visibility

Worker cards expose expandable facts:

```text
role: planner / coder / reviewer / debugger / researcher
requested worker/model
actual worker/model/provider/runtime
placement: LOCAL / REMOTE / UNKNOWN
connection/credential owner reference, never secret
Harness: STANDARD / SYNCHRONIZED
profile/passport IDs when available
workflow stage
attempt state
```

If a fallback occurs, show requested and actual identities separately and create
the canonical lineage event. A profile is visible only when it was actually
applied; unknown fields remain `UNKNOWN`.

For handoff:

```text
Coder → Reviewer
context handoff: consumed / failed / unknown
raw transcript transferred: yes / no / unknown
verified facts transferred: count/reference
```

## 10. Workflow and concurrency visibility

The UI projects the actual workflow graph/state. It must not force concurrent
work into a fake linear checklist. A graph or list/detail view may show:

```text
completed
active
queued
waiting for resource
waiting for permission
verifying
repairing
blocked
failed
unknown
```

Each node remains linked to its mission/attempt and evidence. Filters may be by
mission, attempt, worker, model, file or tool without changing the underlying
truth.

## 11. Authority visibility

Authority events are visible as a distinct activity:

```text
REQUESTED
PERMITTED
DENIED
EXPIRED
CONSUMED
EXECUTION RESULT
```

Example:

```text
REQUESTED: write src/config.ts
AUTHORITY: PERMITTED
ATTEMPT: attempt-184
```

The UI's Approve/Reject action sends the normal Authority request. It never
creates an Edge/UI-owned permit or treats a model request as permission.

## 12. Veritas visibility

Verification is visually separate from worker execution:

```text
WORKER CLAIM: implementation complete
VERITAS: checking
TESTS: 42/42 executed
EXPECTED ARTIFACT: present
REGRESSION: pass
ARCHITECTURE CONTRACT: pass
VERDICT: VERIFIED
```

Rejected apparent success is first-class:

```text
WORKER CLAIM: COMPLETE
VERITAS: REJECTED
REASON: expected test did not execute
NEXT: repair attempt created / operator action required
```

No green state may be derived from worker prose, process exit, or event count.

## 13. Resource and placement visibility

The command center displays separate local/remote and resource facts:

```text
Resident: LOCAL
Coder: LOCAL — llama.cpp
Reviewer: REMOTE — OpenRouter
Available RAM: observed value or UNKNOWN
Resource Admission: START / QUEUE / REFUSE / UNKNOWN
Reason: safe bounded explanation
```

If a worker is queued because a reserve would be violated, show that reason.
Remote model placement does not grant remote execution authority. Egress shows
provider, model, purpose, placement, credential owner reference and whether a
secret was exposed to the UI (`NO`); it never shows a token.

## 14. Redaction and privacy

All stream payloads pass through one canonical secret-redaction policy before
UI delivery. Test at minimum:

```text
API keys
authorization headers
OAuth/device tokens
.env values
provider error bodies
Git credentials
private keys
credential-bearing command output
```

Remote visibility does not broaden context permission. A remote worker sees
only the Context Envelope permitted by the existing egress/Authority policy.
Raw private chain-of-thought and hidden reasoning tokens are never a Live
Execution payload.

## 15. Pause and cancel semantics

Pause and cancel are requests to canonical Orchestrator/Harness/Authority
services, not direct UI process controls.

| Current point | Required truthful behavior |
|---|---|
| before admission | cancel can close the pending attempt; no execution occurred |
| waiting for permission | cancel withdraws/marks the request according to Authority; no UI permit is minted |
| model call active | request cooperative cancellation; terminal state is not claimed until the call is observed stopped or becomes `UNKNOWN` |
| tool/process active | request bounded cancellation and await quiescence; partial/unknown effects block blind retry |
| verification active | stop verification only with explicit terminal `NOT_VERIFIED`/`UNKNOWN`; never `VERIFIED` |
| terminal/receipt ready | no-op or show already terminal; do not rewrite history |
| pause | pause at a safe lifecycle boundary; mid-mutation pause is not promised |

Required event sequence is conceptually:

```text
CANCEL_REQUESTED
→ CANCELLING
→ QUIESCENCE_OBSERVED
→ CANCELLED
```

or:

```text
CANCEL_REQUESTED
→ EFFECT/PROCESS STATE UNKNOWN
→ UNKNOWN
```

The second path is honest and blocks automatic continuation. A button must not
be shipped as “Cancel” until these semantics exist.

## 16. Ghost Code and Mission Receipt

Live Execution is an observation projection of the same facts Ghost Code can
later replay for analysis:

```text
timeline
→ recorded execution facts
→ observation replay / semantic replay where supported
```

Replay does not imply deterministic model reasoning or automatic mutation
re-execution. A completed timeline resolves into Mission Receipt through a
canonical `MISSION_RECEIPT_READY` event. The receipt and timeline must share
mission/attempt/evidence IDs and cannot tell contradictory stories.

## 17. Performance and stream behavior

The observatory must not materially slow mission execution. The implementation
should investigate:

```text
initial snapshot + cursor-based event replay
event batching and bounded frequency
backpressure and reconnect
terminal chunk truncation/virtualization
large diff virtualization
separate durable evidence from ephemeral rendering
```

Canonical evidence is persisted where required. UI rendering events are not
persisted. If the stream is unavailable, the UI shows `CONNECTION LOST` and
the last snapshot as `STALE`; it never shows cached `RUNNING` as current.

## 18. Acceptance requirements

The first implementation proof must demonstrate one real governed mission:

```text
mission start
→ worker/model selected
→ Skill visible
→ file read/write observed
→ terminal command/output observed
→ Authority result observed
→ test start/result observed
→ Veritas verdict observed
→ Mission Receipt available
```

For every displayed fact prove:

```text
visible command == actual command
visible file mutation == actual mutation
visible worker/model == actual observed identity
visible Authority result == canonical Authority result
visible test counts == requested/discovered/executed counts
visible Veritas result == canonical result
visible Receipt == canonical receipt
```

Required release gate:

```text
SHADOW EXECUTION SEMANTICS: 0
```

The UI may be incomplete, but it must never invent execution progress or
verification.
