# Live Execution UX

Status: **PRODUCT / UX CONTRACT — DESIGN ONLY**

## Product promise

```text
THE RESIDENT TALKS TO THE USER.
THE WORKSPACE SHOWS THE WORK.
THE HARNESS RECORDS WHAT ACTUALLY HAPPENED.
VERITAS PROVES WHETHER IT WORKED.
```

Live Execution is a view into one canonical mission, not another product or
execution engine.

## 1. Default command-center layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Mission / stage / connection / resource / verification state  │
├──────────────┬───────────────────────────────┬───────────────┤
│ Project      │ Editor                        │ Resident      │
│ files        │ active file + real diff       │ conversation   │
│              │                               │               │
├──────────────┴───────────────────────────────┴───────────────┤
│ Terminal / tests / command output                             │
├──────────────────────────────────────────────────────────────┤
│ Live Execution: timeline, workers, Authority, Veritas         │
└──────────────────────────────────────────────────────────────┘
```

Live Execution is collapsible and resizable. The editor remains the primary
work surface; Resident remains dockable; terminal remains inspectable. A user
can move from a Resident request to an active file, command, worker, evidence,
and receipt without losing mission context.

## 2. Focus mode

Focus mode shows only the facts needed for a non-specialist:

```text
Resident: repairing authentication...
Stage: Verification
Worker: DeepSeek V4.1 Flash
Tests: 37/42 complete
State: TESTING

[View Live Work]
```

Focus mode never hides a failure or converts an unknown state to a success. It
is a compact projection, not a different state machine.

## 3. Operator mode

Operator mode exposes expandable panels for:

```text
mission / attempt
workflow graph
worker/model/provider/runtime
Harness and Sync profile
Skills/SOPs
files and diffs
terminal commands/output
Authority decisions
resource admission
egress placement
verification/evidence
provenance references
Mission Receipt
```

Sensitive values remain redacted in every mode.

## 4. Mission header

The header answers “what is Covert doing right now?”:

```text
MISSION: Authentication repair
PROJECT: Covert
STAGE: Implementation
ATTEMPT: attempt-184
STATE: WORKING
PLACEMENT: hybrid
VERIFICATION: NOT RUN
BLOCKERS: 0
```

The header only uses canonical snapshot/event state. A disconnected stream is
shown as `STALE` or `UNKNOWN`, not as current activity.

## 5. Live timeline

Timeline cards use actual event time and sequence:

```text
10:31:04  Resident accepted mission
10:31:05  Context Envelope sealed
10:31:05  Skill selected: root-cause-debugging
10:31:06  Coder started: DeepSeek V4.1 Flash / REMOTE
10:31:08  Read src/auth.ts
10:31:12  Modified src/auth.ts
10:31:13  Authority permitted: npm test -- auth
10:31:14  Test battery started
10:31:22  41/42 executed; 1 failed
10:31:23  Repair attempt 2 created
10:31:34  Test battery: 42/42 PASS
10:31:35  Veritas started
10:31:38  VERIFIED
```

Cards distinguish:

```text
observed
requested
permitted
executed
verified
unknown
```

There is no artificial typing animation or periodic status cycling.

## 6. Worker cards

Worker cards show the role and actual resolved identity:

```text
PLANNER
Luna · REMOTE · COMPLETE

CODER
DeepSeek V4.1 Flash · OpenCode Go · ACTIVE
Harness: SYNCHRONIZED

REVIEWER
Granite · LOCAL · QUEUED
Reason: resource admission
```

When requested and actual identities differ, both appear. Handoff displays
context status, verified-fact references, and whether raw transcript transfer
occurred; it does not expose private reasoning.

## 7. File and editor behavior

Selecting a file event opens the actual file/diff. The UI highlights observed
changed ranges, identifies new/deleted/moved files, and links the mutation to
mission/attempt/worker/Authority. Atomic patches appear as diffs; incremental
edits appear only when actually observed.

An uncertain mutation is rendered visibly:

```text
src/auth.ts
EFFECT UNKNOWN — awaiting backend reconciliation
```

No fake cursor, fake keystroke or speculative diff is shown.

## 8. Terminal behavior

The terminal panel shows one command card per governed command:

```text
> npm test -- auth
cwd: workspace/covert
attempt: attempt-184
state: RUNNING

Tests: 42
Pass: 41
Fail: 1

EXIT 1 · 8.4s
```

Output is streamable, scrollable, bounded, redacted and linked to evidence.
Large output uses virtualization/truncation with a safe artifact reference. The
panel distinguishes process success from test/Veritas acceptance.

## 9. Authority activity

Authority cards are visually distinct:

```text
REQUESTED  write src/config.ts
PERMITTED  operation op-91 / attempt-184
CONSUMED   one-use operation observed
```

For a blocked action:

```text
REQUESTED  git push
DENIED     confirmation/policy requirement not satisfied
```

The UI never presents an Approve button that directly grants an effect. It
submits the normal governed request.

## 10. Verification activity

Verification has its own timeline/card group:

```text
WORKER CLAIM        COMPLETE
VERITAS             CHECKING
TESTS               42/42 EXECUTED
EXPECTED ARTIFACT   PRESENT
REGRESSION          PASS
ARCHITECTURE        PASS
FINAL VERDICT       VERIFIED
```

False success is explicit and useful:

```text
WORKER CLAIM        COMPLETE
VERITAS             REJECTED
REASON              requested test file did not execute
NEXT ACTION         repair attempt / operator review
```

## 11. Resource and placement cards

```text
LOCAL RESOURCES
Resident: 2.1 GB
Coder: 3.4 GB
Available RAM: 5.7 GB
Resource Admission: START
```

For a queue:

```text
Reviewer: QUEUED
Reason: local reserve would be violated
Next condition: Coder unload observed
```

Remote activity shows:

```text
Provider: OpenRouter
Model: exact discovered ID
Purpose: coder worker
Credential owner: OpenCode
Secret exposed to UI: NO
```

## 12. Harness Sync detail

When applied, the UI offers an expandable evidence-linked detail:

```text
Harness: SYNCHRONIZED
Passport: passport-001
Profile: profile-001

Applied adaptations:
• compact Skill projection
• maximum 6 capability candidates
• explicit obligations
• reasoning MAX

Acceptance standard: unchanged
Authority: unchanged
Veritas: unchanged
```

Unknown or expired profile data is displayed as such. Standard mode remains one
click away.

## 13. Workflow view

Use a graph/list appropriate to actual concurrency:

```text
[✓] Reconnaissance
[✓] Plan
[●] Implementation
[●] Research (parallel)
[ ] Verification
[ ] Review
```

Parallel branches are shown as parallel. The UI does not manufacture a linear
sequence for a concurrent workflow.

## 14. Safe controls

Available controls may include:

```text
PAUSE
CANCEL
VIEW DIFF
OPEN FILE
OPEN TERMINAL
VIEW EVIDENCE
VIEW AUTHORITY DECISION
VIEW WORKER
VIEW MODEL PROFILE
VIEW MISSION RECEIPT
```

Pause/cancel controls are disabled or labeled unavailable until the backend
contract can report safe semantics. A click must produce a canonical request
event and truthful outcome, not local UI state.

## 15. Navigation and filters

Every panel supports links back to the same mission/attempt. Filters include:

```text
mission
attempt
worker
model/provider
file
tool
event type
state
```

Filtering changes projection only; it cannot hide required failure/unknown
states from the Mission Receipt or canonical evidence.

## 16. Responsive and accessibility behavior

### Tablet landscape

Use list/detail or three-pane mode: project/files, editor/terminal, Resident or
Live Execution detail.

### Tablet portrait / phone width

Use a tabbed or stacked mode with persistent mission header and event cursor.
Resident, Live Execution, Terminal and Evidence remain reachable without
losing the active mission.

### Accessibility

```text
keyboard navigation
visible focus
text plus color/status icon
screen-reader labels for state transitions
monospace output with selectable text
reduced-motion support
touch targets sized for tablet
```

No status relies on color or animation alone.

## 17. Failure states

```text
WORKING
TESTING
VERIFYING
REPAIRING
WAITING_FOR_PERMISSION
WAITING_FOR_RESOURCE
OFFLINE / STREAM STALE
FAILED
CANCELLED
UNKNOWN
```

Each error explains:

```text
what was observed
what remains unknown
whether the workspace is safe
what next action is available
```

## 18. First implementation proof

One real mission must demonstrate:

```text
Resident message
→ mission start
→ worker/model visible
→ Skill visible
→ actual file event and diff
→ actual terminal command/output
→ Authority result
→ test result with executed count
→ Veritas result
→ Mission Receipt
```

The acceptance question is not “does the screen look busy?” It is:

```text
visible fact == canonical observed fact
```

Required result:

```text
SHADOW EXECUTION SEMANTICS: 0
```
