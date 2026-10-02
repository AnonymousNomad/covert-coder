# OWNER ACCEPTANCE GATE

A theme is not "done" until the owner approves the visual direction.

## Submission bundle per theme
- owner reference
- annotated owner reference
- actual-browser screenshot at 1600x900-equivalent
- actual-browser screenshot at target laptop/native resolution
- narrower-width screenshot
- reduced-motion screenshot/state
- effects-off state where applicable
- side-by-side reference comparison
- list of intentional differences
- list of known gaps

## Visual reject conditions
Automatic reject if:
- one theme is visibly just a recolor of another;
- Resident chat is missing;
- primary editor/work surface is not obvious;
- resources dominate the layout;
- activity visual is decorative and disconnected from state;
- mock values look like production truth;
- panels cannot resize/collapse;
- reference composition is substantially ignored without written rationale.

## Production gate after owner visual lock
- real telemetry adapters
- real liveness state
- liveness stale handling
- Resident real conversation
- model/provider/runtime truth
- layout persistence
- restart proof
- accessibility
- actual browser
- dogfood
- exact-SHA CI
