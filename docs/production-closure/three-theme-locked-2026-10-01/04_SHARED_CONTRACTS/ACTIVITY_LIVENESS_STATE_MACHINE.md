# ACTIVITY / LIVENESS STATE MACHINE

Use `activity_state_map.json` as the machine-readable contract.

## One state model, three presentations

### Corporate
Signature instrument: **top-right activity figure/dial**
- IDLE: dim emerald edge, no continuous motion.
- PLANNING: cyan eye/core + slow sweep.
- REASONING: violet core + slow controlled pulse.
- EXECUTING: emerald core + medium sweep.
- COMPILING/TESTING: brighter emerald/cyan + faster segmented sweep.
- VERIFYING: green ring with cyan verification tick.
- DEBUGGING: amber segmented sweep.
- WAITING_INPUT: amber breathing border, no spin.
- RECOVERING: amber-to-green transition only while recovery events are current.
- STALE: motion stops; amber `STALE` indicator.
- BLOCKED/FAILED: motion stops; red ring/edge and explicit reason.
- COMPLETE: one short green confirmation, then IDLE.

### Matrix
Signature instrument: **binary-rain field**
- motion speed/density follows motion_level;
- cyan/blue during planning;
- violet accents during model review only if useful;
- green during execution/verification;
- amber for debug/waiting;
- red accents only for actual failure/blocker;
- STALE freezes/slows to near-static and surfaces `STALE`;
- effects-off removes rain workers/timers completely.

### Original / Colorful
Signature instrument: **Resident hooded figure eyes/visor**
- IDLE: dim/static;
- PLANNING: cyan;
- REASONING: violet/magenta;
- EXECUTING: green;
- COMPILING/TESTING: brighter green/cyan with bounded pulse;
- DEBUGGING/WAITING: amber;
- STALE: dim amber static;
- FAILED/BLOCKED: red static;
- COMPLETE: short green confirmation then dim.

## Heartbeat rule
A visual "working" state requires a fresh canonical progress timestamp/event.

Recommended UI freshness:
- fresh: < 5 seconds since last accepted progress/heartbeat;
- aging: 5–15 seconds, keep state but reduce intensity;
- stale: > 15 seconds without progress for operations that should heartbeat, switch to STALE pending subsystem-specific policy.

These are UI defaults, not universal backend failure thresholds. Backend ownership defines actual failure timeouts.
