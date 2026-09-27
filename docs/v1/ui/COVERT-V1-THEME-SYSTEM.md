# Covert V1 Theme System and Terminal Presentation — Acceptance Evidence

## Scope

Worktree: `E:\aide-v1-themes`
Branch: `feat/v1-theme-system`
Starting UI baseline: `1a7f80e7407c54616e167a513bbe6022b3cdd950` (`origin/feat/covert-desktop-control-v1`)

This slice closes the requested V1 visual-system behavior on the current Desktop Control UI baseline without changing product authority, routing, model truth, or workflow ownership.

## V1 theme contract

Exactly three first-class themes are exposed through the existing preference system:

1. **Default Covert** — the existing colorful tactical command-center presentation.
2. **Matrix** — a distinct dark green code-signal environment with operator-controlled binary motion.
3. **Developer** — a restrained graphite/circuit-board engineering workstation intended for long night sessions.

The themes share one shell and one semantic component system. They do not fork runtime state or backend behavior.

## Matrix

Matrix is no longer a green recolor of Default Covert.

- Code-rain presentation is present but **OFF by default**.
- Motion modes are `OFF`, `ADAPTIVE`, `SLOW`, and `STANDARD`.
- `ADAPTIVE` is driven only by canonical UI/verification state already owned by Covert.
- Signal colors may be adaptive or manually set to green, cyan, amber, or magenta.
- `prefers-reduced-motion`, the Covert reduced-motion preference, and effects-off state stop optional animation.
- The decorative Default Covert map/phase band is replaced at the top by resource instrumentation.

No project progress, debug success, verification result, or resource value is synthesized by CSS or animation logic.

## Developer

Developer uses graphite and low-saturation engineering colors, subtle circuit/bus traces, restrained glow, and static presentation. It is deliberately distinct from Matrix and from generic RGB/cyberpunk treatment.

## Resource instrumentation

The alternate-theme header exposes:

- RAM used/total from the hardware profile.
- VRAM used/total when the GPU probe supplies it.
- Storage used/total from `fs.statfs` against the canonical workspace filesystem.
- CPU logical processor count.

There is currently no canonical live CPU-utilization sample, so the UI reports CPU usage as unavailable rather than inventing a percentage or rendering zero.

System Health and the resource panel use the same hardware contract. Storage falls back to explicit `UNAVAILABLE` when the filesystem probe cannot provide a valid snapshot.

## Navigation

Left-rail destinations retain distinct accent identities and illuminated icon treatment in inactive, hover, focus, and active states. Keyboard focus remains a separate visible state.

## Embedded terminal presentation

The existing governed Embedded Terminal remains the execution owner. This slice changes presentation only around that accepted execution path:

- PowerShell receives a session-local, two-line Parrot-inspired prompt.
- The prompt does not modify the user's PowerShell profile.
- The structure is:
  `╭─[user@covert]─[workspace]`
  `╰─❯`
- The palette uses Covert purple, cyan/blue, green, and pink.
- The xterm ANSI palette follows active Covert theme tokens.
- Secrets continue to be removed by the existing terminal environment scrubber.
- Terminal start/stop and input remain governed by the existing Authority path.

Live acceptance observed the prompt as:

`╭─[Grey_@covert]─[E:\\aide-v1-themes]`
`╰─❯`

## Rendered acceptance

`scripts/theme-acceptance.mjs` exercises the real dev stack and a paired Edge renderer.

Final rendered result:

- 13 passed
- 0 failed

The battery verifies:

- Default Covert remains the unmarked default.
- Exactly three V1 themes are available.
- Matrix is static by default.
- Matrix motion and signal controls are real preference states.
- Adaptive Matrix stays static while idle and moves on a real working surface.
- Developer is visually distinct and static.
- Matrix/Developer topbar resource instrumentation is visible.
- Appearance state is durably written through the canonical preference store.
- No uncaught page errors occurred during the accepted render run.

Evidence:

- `docs/evidence/themes/theme-acceptance.json`
- `docs/evidence/themes/default-1440.png`
- `docs/evidence/themes/matrix-1440.png`
- `docs/evidence/themes/developer-1440.png`
- `docs/evidence/themes/matrix-1100.png`

One accepted run emitted a node-pty ConPTY `AttachConsole failed` diagnostic during harness teardown after all 13 checks had passed. It did not change product state or the acceptance result. The diagnostic remains recorded rather than hidden.

## Embedded terminal acceptance

The existing terminal acceptance battery was rerun after the prompt/palette change.

Result:

- 13 passed
- 0 failed

Verified live:

- terminal panel stays selected across onboarding race;
- provider discovery resolves;
- approved real PTY starts;
- the new two-line Covert prompt appears;
- workspace path is correct;
- keyboard input/output round trip succeeds;
- resize succeeds;
- shell exit returns to closed state;
- restart succeeds;
- canonical STOP SESSION succeeds;
- no uncaught page errors.

Evidence: `docs/evidence/themes/terminal-parrot-smoke.json`.

Focused terminal/runtime-provider regression:

- 14 passed
- 0 failed

## Hardware and preferences regression

- Hardware route battery: 3 passed, 0 failed.
- Operator preference unit battery: passed.
- Windows UIA focused regression: 7 passed, 0 failed.

The Windows UIA baseline contained six ESLint errors in two already-tracked Desktop Control files. This slice repaired only the escaping defects that caused those gate failures:
- the generated PowerShell traversal regex now retains the intended literal-dot escaping;
- the corresponding JS test regex no longer contains useless apostrophe escapes.

No Desktop Control capability was expanded by that repair.

## Full regression

Final `npm run check`:

- 651 tests total
- 643 passed
- 0 failed
- 8 skipped
- TypeScript: PASS
- ESLint: 0 errors (61 existing warnings)
- Architecture suite: PASS
- OpenAPI drift: PASS

`git diff --check`: PASS before closure.

## Boundaries

This slice does **not** claim:

- live CPU utilization;
- packaging/installer qualification;
- provider login completion;
- local-model starter-pack qualification;
- global Local-Only egress closure;
- Companion/mobile app completion.

Those remain separate owners/later integration gates.

## Status

**THEME SYSTEM / MATRIX / DEVELOPER / PARROT-STYLE EMBEDDED TERMINAL PRESENTATION: IMPLEMENTED AND VERIFIED ON THE CURRENT DESKTOP-CONTROL BASELINE.**

Final branch SHA and origin parity are recorded after closure commit/push.
