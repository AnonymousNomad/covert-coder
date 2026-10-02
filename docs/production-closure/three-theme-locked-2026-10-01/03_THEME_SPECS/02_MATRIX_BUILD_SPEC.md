# THEME 02 — MATRIX

Reference: `../01_REFERENCES/02_MATRIX_OWNER_REFERENCE.jpg`

## Goal
A black/green cyber mission workstation with a live binary field that communicates real workflow state. This is not Corporate with green tokens.

## Baseline 1600x900
Top utility bar: 48 px.
Below it: 82 px metrics strip across the center/right.
Left activity rail: 82 px.
Mission/project pane: 228 px.
Right Resident pane: 320 px.
Bottom execution pane: 230 px.
Status bar: 24 px.

## Navigation
Left activity rail:
Workspace, Missions, Projects, Agents, Evidence, Intelligence, Tools, Deployments, Integrations, Settings.

The navigation language is intentionally mission-oriented and differs from Corporate.

## Project / mission pane
Top:
- current project selector
- active mission badge/status

Body:
- file/project tree
- agents/tasks/evidence filters

Bottom:
- current mission mini-summary:
  - status
  - evidence count
  - artifacts
  - active agents
  - runtime duration

## Metrics strip
Four compact cells:
- Tasks Completed
- Agents Running
- Evidence Items
- Active Missions

Use real tiny historical sparklines only when sample history exists.
Do not use this strip for hardware telemetry.

## Main work surface
Editor / mission work occupies center.
Top editor tabs.
Bottom execution panel:
`Terminal | Console | Agents | Evidence | Tasks`

## Resident
Right pane is a mission assistant:
- Chat
- Context
- Tools
- Missions
- concise task/action buttons
- full message composer
- current model/runtime footer

## Binary rain — core activity language
Binary field spans the shell background and may extend behind transparent gutters, never through text at unreadable contrast.

The rain consumes `activity_state_map.json`.

Parameters:
- IDLE: density 0.15, speed 0.20
- PLANNING: density 0.30, speed 0.35, cyan-green
- REASONING: density 0.35, speed 0.40, green with restrained violet/cyan traces
- EXECUTING: density 0.50, speed 0.60
- COMPILING/TESTING: density 0.65, speed 0.80
- VERIFYING: density 0.55, speed 0.60 with verification-green highlights
- DEBUGGING: density 0.40, speed 0.40, amber traces
- WAITING_INPUT: density 0.18, speed 0.12, amber cues
- STALE: density 0.08, speed 0.00 + visible STALE state
- FAILED/BLOCKED: density 0.10, speed 0.00 + red fault pulses/edge, no fake working motion
- COMPLETE: 600–900 ms green confirmation then return IDLE

The numeric parameters are normalized animation controls, not CSS seconds. Implement within the animation engine's own bounded ranges.

## Performance
- effects toggle must fully stop/remove animation loop/workers;
- pause when window hidden;
- cap rendering frame rate as needed;
- degrade density before stealing resources from local inference;
- honor `prefers-reduced-motion`;
- provide static Matrix texture when motion is disabled.

## Hardware telemetry
Use lower edge/right utility band, not the top mission metrics.
Style:
- narrow phosphor bars;
- compact numeric blocks;
- thin sparklines if real;
- no large circular dashboard widgets.

## Lock criteria
Owner must see:
- clearly different composition from Corporate;
- real Matrix atmosphere;
- binary rain behaving as liveness;
- mission-centered nav;
- Resident still usable;
- telemetry not confused with mission metrics.
