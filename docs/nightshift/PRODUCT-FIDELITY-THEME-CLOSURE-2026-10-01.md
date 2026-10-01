# Product Fidelity: three Covert identities

Status: OPEN. Owner-directed release slice, not visual acceptance. Grounded at
canonical local bootstrap candidate `96a943601faa539798c2ff595897c9ae3146ae34`.
Finish the fundamental native/package verification repair before UI mutation.
PR #31 stays frozen. This packet supplements existing release directives.

## Governing references

Read the complete owner directive at
`E:\COVERT_OWNER_UI_REFERENCES_2026-10-01\SOL61_UI_THEME_DIRECTIVE.md` and the
new attached Owner Theme / UI Correction directive. Both target images were
provided directly on 2026-10-01 and visually inspected:

| Target | Local original | SHA-256 |
| --- | --- | --- |
| Original / colorful | `E:\pip_temp\codex-clipboard-5a14c5e9-3715-4f29-9c8f-ed13005f732a.png` | `c6927ab32791435e614b0a2d0f8a3ef2124670e94fe22b8199d527907a533339` |
| Matrix | `E:\pip_temp\codex-clipboard-71718b81-7b4f-4e17-b12c-8f977f9616cc.png` | `942f8719f225747da7a2331581c7ba291054cd6b4ef4f9a5f81ba1710e194fe6` |

These are design references containing conceptual data, not running-product
evidence. Do not copy their percentages, model readiness or mission counts.
The current/wrong mixed-state owner image is still unavailable; reproduce the
actual current render directly before implementing its repair.

## Repository facts and remaining reproduction

`browser/src/main.ts` mounts CockpitShell and imports cockpit CSS. The HTML
entry also loads `browser/src/main.css`. Legacy panels/topbar remain mounted
inside CockpitShell: they consume legacy surface tokens while cockpit chrome
uses independent `--ck-*` tokens and fixed theme colors. The old `createShell`
exists but is not the entrypoint's mounted shell. Do not claim two live shells.

Resident is mounted within the Command Center stage, which is hidden when the
Editor/Terminal center panel is selected. The historical Resident dock is not
integrated into the active editor layout. AmbientEffects currently creates CSS
grid/scan/dots, samples reduced motion once, and has no workflow subscription,
persisted effects control or lifecycle disposer. SystemTelemetry polls an
actual hardware profile but lacks displayed sample age and request ordering.

These are source findings. Before UI mutation capture actual browser Command
Center, Editor, Terminal, Models, Settings and setup, exact source/build identity,
computed token ownership and mounted layout. Trace each visible mismatch to its
owner rather than assuming every old stylesheet must be removed.

## Historical disposition

Inspect commit `1e0d069a3a50e4bb539f37e120494b0ab697d179` selectively.
Its historical covert-theme-system skill supplies useful engineering rules;
the latest owner directive governs identities/defaults.

| Asset/behavior | Disposition | Reason |
| --- | --- | --- |
| Semantic theme token ownership | CONVERGE | One component/behavior system; reconcile against active owners first |
| Versioned operator appearance preference and change event | CONVERGE | Recover persistence without a second preference system; preserve unknown keys |
| Historical Matrix rain/control implementation | CONVERGE selectively | Audit real state mapping, disposal, motion/performance and current integration |
| Historical Developer visual identity | SUPERSEDE | Corporate Emerald is a distinct requested professional identity |
| Historical screenshots/acceptance JSON | DEFER as historical reference | Different source/artifact cannot certify current candidate |
| Whole historical UI branch/layout | REJECT as an integration method | Recover bounded semantics, not stale architecture wholesale |
| Artwork percentages and fake task/model statuses | REJECT | Production must project measured canonical state |

## Proposed corporate direction — requires visual presentation and owner acceptance

Working public label: **Covert Emerald**. This is a descriptive proposal,
not trademark clearance or a final owner decision. Public branding must be
reviewed before release; the internal historical codename is not public copy.

Use near-black editor canvas, graphite raised tools, gunmetal separators and a
restrained emerald active edge. A compact original Covert emblem anchors the
rail. Neutral readable labels and stable editor contrast dominate; lighting is
reserved for active controls and focus. Cyan/purple denote information/AI
semantics, amber attention, red actual failure. Avoid a full-screen neon wash.
Technical system typography for controls and a local/offline monospace for code;
no text baked into backgrounds. Use consistent spacing, units and density.

Original retains expressive purple/cyan/blue/magenta illumination and Covert
branding. Matrix uses black/deep-green surfaces, code signal and emerald/teal
information hierarchy. They share semantic meanings and structure while their
materials, intensity, motifs and control treatments remain distinct.

### Research basis and design inference

- [VS Code theme roles](https://code.visualstudio.com/api/references/theme-color)
  support separate editor, workbench and terminal roles. Proposed inference:
  centralize semantic surface/state/focus tokens, then map editor/terminal tokens.
- [Carbon color roles](https://www.carbondesignsystem.com/building-blocks/foundations/color/guidelines)
  inform consistent role-based colors across modes. Proposed inference:
  theme palette overrides do not change status meaning or component behavior.
- [Carbon motion](https://carbondesignsystem.com/elements/motion/overview/)
  informs restrained routine feedback. Proposed inference: corporate tools remain
  stable while optional Matrix ambience stays behind the work surface.
- [Grafana dashboard guidance](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)
  informs useful questions, units and refresh cadence. Proposed inference: show
  developer resource/admission constraints, not decorative server statistics.
- [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
  and [animation control](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
  inform measurable contrast and optional motion. Target normal text 4.5:1,
  large text 3:1; verify focus and meaningful graphics independently.

## Canonical architecture and telemetry source map

Components consume semantic surface/text/accent/state/focus/border/telemetry
tokens. Theme appearance, layout, behavior and optional ambience have separate
owners. Appearance must never select models, alter routing or grant Authority.
Recover the canonical preference mechanism only after live ownership review.

| Display | Existing authoritative source | Boundary / required work |
| --- | --- | --- |
| Physical RAM used/free/total | Hardware service/profile, strict hardware contract | Show sample timestamp/age; reject inconsistent samples rather than conceal them |
| Windows commit | Resource Admission commit probe/evidence | Extend existing hardware owner with used/limit/free samples; do not duplicate admission decisions |
| VRAM used/free/total | Existing nvidia-smi hardware probe | Unknown/unavailable on unsupported devices; device identity/source/freshness required |
| CPU/GPU utilization | Not exposed by current hardware profile | Research bounded measured delta/provider sampling; UNKNOWN until contract and proof exist |
| Drive free/total and I/O pressure | Not exposed by current hardware profile | Extend current hardware owner; inspect actual project/system volumes; no inferred I/O load |
| Runtime/exact selected model/health | Model Manager / Runtime Broker | Project exact canonical identity and lifecycle evidence; selection is not READY |
| Context/generation | Exact worker/provider response contracts where supplied | Capacity, consumed and remaining are distinct; do not infer absent usage |
| Provider/local/network | Model Access connection/route evidence | Read failure is UNKNOWN; configuration is not authenticated/verified execution |

A telemetry read has one bounded in-flight request, monotonically ordered
samples, explicit stale/unavailable state and disposal. Hidden/pressure states
throttle polling. Never display a missing value as zero or animate fabricated
history. Sampling must not compete with local inference.

## Workstation and Matrix behavior proposal

Editor is the primary work surface, with persistent/dockable Resident beside
editor and terminal. Command Center is overview/control. Recover dock/layout
state without replacing navigation, model or workflow owners. Compact telemetry
supports work and may be collapsed. Preserve the existing terminal owner.

Bind Matrix only after inspecting actual Workflow/Agent/verification events.
Initial semantic proposal: idle/inactive slow; analysis cyan; AI review purple;
active execution green with bounded increased density; verified success green;
waiting/degraded amber and settled motion; actual failure/security red and slow.
Unknown does not imply activity. Deterministic precedence and stale-event
handling require tests. Effects OFF or reduced motion must dispose animation
timers/workers; selection of another theme also disposes Matrix activity.

Define idle/hover/focus/selected/running/success/warning/error/disabled controls
with theme-matched illumination and text/icon/border cues. Do not use color
alone for meaning. Fix tab order, zoom/reflow and constrained-width layouts.

## Exit evidence

OPEN: current-render reproduction; CSS/root-cause verification; visual proposal;
implementation; all-three-theme surface screenshots at laptop/narrow/zoom;
keyboard/readability; reduced motion/OFF with zero timers/workers; theme and dock
full-restart persistence; same-sample backend/metric equality and stale handling;
deterministic Matrix transitions plus a real dogfood transition; measured CPU,
GPU/RAM impact; focused and browser regressions; affected architecture/Veritas;
exact-SHA CI; actual installed dogfood; final owner visual identity acceptance.

No UI completion, live telemetry expansion or product acceptance is claimed.

## Additive Corporate correction and activity language

The owner rejected the first Corporate proposal as flat/generic. Preserve it
as SUPERSEDED history; it is not an approved implementation target. The complete
correction is attachment `1b6f3ad2-aef0-4399-869a-641d69f08b4b/Pasted text.txt`.
Owner Corporate reference `04-corporate-workstation-owner-reference.png` under
`E:\COVERT_OWNER_UI_REFERENCES_2026-10-01` has SHA-256
`e14b083546c6d5b02ef2ceb0d6a5698064a68739160a2b4677266d55fbbb5894`.
Its workstation materials/layout guide design, while conceptual gauges/model
labels are not product evidence. Create original Covert art rather than copying
the reference character/sigil.

Design first: revised direction, reusable tokens/components and an editable
high-fidelity concept precede product mutation. Corporate retains editor-first,
left navigation, real Resident messages/composer/actions on the right, terminal
below, compact measured telemetry, graphite/gunmetal material depth, purposeful
emerald lighting, technical typography and consistent controls. It remains a
distinct identity from Original and Matrix.

The complete activity addendum is attachment
`1af8312a-8d1c-4c24-bdcc-fa23068e28f1/Pasted text.txt`. The external working
specification is `proposals/CORPORATE-V2-DESIGN-STATE-SPEC.md` under the same owner
reference directory. One canonical activity/status mapping supplies three
presentations: Corporate's precise top-right dial/orb, Original's subtle Resident
eyes/visor lighting and Matrix's semantic rain. Navigation or response latency
does not prove thinking. Generic work, waiting, stale/unknown, attention, blocked,
failure, completion and cancellation remain explicit. Critical states need text
and icon feedback as well as color.

Acceptance additionally requires all three indicator state maps and captures of
idle, processing, attention, error and completion; reduced-motion/OFF and inactive
disposal proof; bounded measured CPU/GPU cost; and no interference with inference
or telemetry. No activity/UI implementation is accepted from this specification.

Figma plugin is installed/callable but the current account probe returns OAuth
required. Owner requested editable Figma designs; authentication remains pending.
No Figma design file or component library has been created. The native/package
blocker remains ahead of product UI mutation.
