# COMPONENT CONTRACTS

Build behavior once, appearance per theme.

## Primitive behavior components
- `WorkbenchShell`
- `ActivityRail`
- `ProjectContextPane`
- `EditorSurface`
- `ExecutionPanel`
- `ResidentDock`
- `ModelRuntimePanel`
- `TelemetryCluster`
- `ActivityLivenessIndicator`
- `StatusBar`
- `ResizableSplitter`
- `ThemeProvider`
- `AmbientEffectsController`

## Separation rule
Do not put hard-coded theme colors inside behavior components.

Behavior emits semantic slots:
- surface.base
- surface.raised
- border.default
- border.active
- text.primary
- text.muted
- state.info
- state.reasoning
- state.running
- state.success
- state.warning
- state.error
- telemetry.normal
- telemetry.pressure
- focus.ring

Theme adapters map these slots to visual values.

## Layout rule
Theme can select a distinct shell composition while reusing behavior primitives.

Corporate shell != Matrix shell != Original shell.

## Activity
`ActivityLivenessIndicator` consumes:
- workflow state
- progress timestamp
- stale state
- operation label
- subsystem
- reduced motion
- effects enabled

It renders through a theme-specific adapter:
- CorporateActivityFigure
- MatrixRainActivity
- OriginalVisorActivity
