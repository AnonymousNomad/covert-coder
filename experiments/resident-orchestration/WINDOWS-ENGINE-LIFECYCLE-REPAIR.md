# WINDOWS ENGINE-LIFECYCLE REPAIR (recorded, bounded, proven)

## Root cause (reproduced)
On Windows, `ChildProcess.kill()` terminates the child **without delivering a
SIGTERM-style signal**. The arch server's `installShutdown` handlers therefore
never ran, `modelRuntime.stopAll()` never executed, and the runtime's **detached**
`llama-server` engines survived the stack close.

Reproduction (deterministic, probe run 1): normal close → owned engine survived
(1 → 1); 5-model close → 4 engines survived (4 → 4). Foreign engine present
throughout and untouched.

## Bounded repair (this lane's boundary — test/launch infra it owns)
`tests/helpers/supervised-stack.mjs` `close()` now performs an
**ownership-verified reap** after terminating children:
```
registry port (workspace .aide/ingested-models.json endpoint)
→ PID owning that listening port
→ command line MUST contain 'llama-server' AND the exact registered model file
→ eligible for taskkill /PID <pid> /F /T
```
Anything that fails the check is left alone. No broad process killing.

## Safety invariant
```
OWNED ENGINE   → may be terminated
FOREIGN ENGINE → MUST REMAIN UNTOUCHED
```

## Proof (results/lifecycle-probe.json — PASS)
```
owned before 1 → during 1  → after 0    (normal close)
owned       4 → (boot)     → after 0    (partial-boot path)
foreign engine: untouched (PID unchanged before/after)
```

## Integration note for other launcher owners (recorded, not repaired here)
The same Windows semantics affect any owner that terminates the stack and expects
graceful engine shutdown, including:
- `scripts/start.mjs` (its termination path uses taskkill trees; detached engines
  may escape),
- the desktop shell (Tauri `main.rs` uses `taskkill` on close),
- any other process-launch owner.
**Requirement for reconciliation:** adopt the same verified pattern (port → PID →
cmdline ownership check → reap) or ensure the runtime's engines are stopped
before the launcher exits. This lane does not repair unrelated owners without
explicit ownership; the requirement is recorded here for later reconciliation.

## Practical consequence (product honesty)
Until the launcher owners adopt the pattern, a Windows app close can leave model
engines running; users should be able to see and stop them via the model panel
(the runtime's truthful `stop()` — 409 CONFLICT when an unowned engine still
serves — remains the safety net).
