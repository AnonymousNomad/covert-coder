# Selective capability integration plan

Assessment source: canonical `fc263fe26f364b5c972be79a8ac6e651a671dcd0`.
This isolated lane prepares repairs and integration plans. Luna retains the
active packaging/bootstrap work; PR #31 remains frozen. Reassess against the
actual convergence SHA before applying any slice.

## Immediate integration order

1. Reach Luna's earned packaging/bootstrap checkpoint.
2. Apply `e82c4ee` (F01), `77987bc` (F03), then `4cf80d9` (F02) in order.
3. Apply `d084200` (fixture logger drain), then `b9e8b04` (required browser CI,
   additional remote adapter/setup predicates and truthful terminal copy).
4. Apply `022790e` (additive capability-ledger/gate), then `4e1c85f`
   (setup provider-read session guard and success/failure browser regression).
5. Resolve journal/evidence conflicts by retaining both lanes' history. Keep
   current runtime, Model Access, Authority, Admission and packaging contracts.
6. Run the actual browser regression, type/lint/build, affected architecture
   and full exact-SHA CI on convergence. Isolated CI does not certify it.
7. Resume dependency-ordered installed model-source/Resident/mission/recovery
   acceptance. The plans below follow core release blockers; no visual sprint
   should displace them.

## Historical facts and limits

- Theme origin: `feat/v1-theme-system` at
  `1e0d069a3a50e4bb539f37e120494b0ab697d179`. The recorded theme battery
  passes 13/13 for Covert/Matrix/Developer; the terminal battery records 13/13.
  These are bounded historical evidence, not current release acceptance.
- MM9 origin: `376acd0fb0b5d1431a1df2273e60a1d3351545b4` on
  `feat/model-manager`; the checkpoint ledger records 57 focused tests,
  12 route/contract checks and 3 Edge component E2E tests passing. Its broad
  architecture acceptance was pending; MM8's 622/16/11 result stays unchanged.
- The current Models panel calls the canonical Model Manager projection but
  lacks Model Packs, Notes, Advisories and Specials presentation.
- Current `main.ts` mounts CockpitShell. That shell hides the command/Resident
  stage when selecting editor. Legacy resident-dock source remains in the tree
  and old shell; it does not prove active conversation docking.
- The current terminal uses approved real PTY sessions. Historical prompt and
  theme palette semantics are absent from the inspected current terminal owner.

## Model Manager surfaces — four bounded slices

| Capability | Current owner / selective port | Required proof |
| --- | --- | --- |
| Model Packs | Extend `common/contracts/model-access.ts` and `node/src/services/model-manager-view.ts` with manifest-backed read-only pack projection. Render in existing `browser/src/panels/models.ts`. Reuse modelhub and canonical artifact/qualification owners for separately approved actions. | Missing/partial members, exact artifact identity, missing provenance/license/hash, stale qualifications, resource denial, provider/model mismatch; discovered/imported does not become READY. No implicit download/start/route change. |
| Developer Notes | Port attributed static advisory content plus bounded dismissal preference; render beside canonical model state. | Empty/error/unknown states and restart of promised dismissal semantics. Notes never supply qualification or Authority evidence. |
| System Advisories | Derive severity/action from canonical identity/artifact/runtime/provider/qualification facts. | Unknown/stale inputs remain unresolved; advice does not claim to repair the cause or authorize mutation. |
| Developer Specials | Port workflow recipes as advisory data over current roles and qualified model references. | Unset model membership stays unset. Unsupported recipes are not executable workflows; no model ranking, cost claim or automatic selection without evidence. |

Do not port the historical registry/router, selection override mechanism, or
old runtime READY predicates. Availability remains distinct from qualification.
Keep advisory recipes distinct from supported execution workflows and receipts.

## Resident docking — one shell owner

Move/reuse the existing ResidentCore mount in the active CockpitShell rather
than constructing a second Resident conversation, context store or coordinator.
Introduce a persistent region beside editor/terminal with explicit show/hide,
resize and keyboard focus return. Preserve the existing Authority-governed
mission/stream/cancel/receipt path. The old dock is layout reference material,
not an interchangeable conversation implementation.

Acceptance: editor → show Resident → real context/task updates → hide while
working → show with retained state → terminal → resize/narrow layout → focus
return → cancel → subsequent task → restart/recover. Test only behaviors the
product actually promises; hidden updates must not create stale positive state.

## Themes and terminal presentation

Use the existing shell, preferences owner and semantic CSS tokens. Port
capability semantics, not historical shell markup. Restore an explicit Original
choice and distinct Matrix presentation, including editor, terminal, syntax,
Resident, focus/selection/status and reduced motion. Adaptive motion may
consume only actual current app/verification telemetry; unavailable samples
must remain unavailable.

Beskar is a separate dark-emerald requirement. The graphite Developer theme
does not implement it. Establish its own surfaces, typography/borders, status
language, editor/terminal palettes and approved emblem reference before claiming
acceptance. Approved artwork is a future owner dependency if unavailable;
do not fabricate an approval or rename Developer to close the row.

For the Parrot-inspired prompt, preserve `node/src/services/terminal-sessions.ts`
as the governed process owner and `browser/src/panels/terminal.ts` as the xterm
owner. Apply session-local presentation only. Do not modify global profiles.
Reprove input, cancel/stop, exact process-tree cleanup, restart and palette/focus
behavior. The terminal shortcut copy repair changes no PTY or shortcut behavior.

## Closure gate foundation

The existing `artifacts/integration-certification/capability-ledger.json`
retains its historical 38-row audit unchanged and adds a strict `closure`
section with 12 evidence-grounded rows. Coverage is explicitly PARTIAL.

`npm run release:capabilities` evaluates the actual checkout branch/SHA and
exits nonzero for missing required convergence/acceptance, capability drift,
incomplete inventory or missing candidate evidence paths. Required DEFERRED,
REJECTED or SUPERSEDED rows do not become implicit waivers. Seven historical
drift rows currently fail. `--validate` validates schema only and prints
`release_acceptance_evaluated: false`.

This foundation validates ledger requirements. It does not independently
authenticate CI/dogfood/receipt contents or certify all release gates. Existing
Authority, Veritas, package and candidate evidence owners remain authoritative.
Expand the remaining RC inventory and bind the promotion procedure to this
command when integrating; no release promotion procedure was run here.

## Disposition

Every seeded capability has a declared scheduling disposition. DEFERRED here
means pending selective integration/requalification, and blocks release when
the capability is required. No owner requirement has been removed or waived.
No historical theme/MM9 pass is inherited by the current candidate.
