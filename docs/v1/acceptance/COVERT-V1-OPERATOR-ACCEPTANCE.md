# Covert V1 — Operator Acceptance Battery Ledger

Status: **CHECKPOINT 1 GREEN (20/20)** — the remaining checkpoints are pending the authoritative
18-checkpoint taxonomy (this file currently records the verified subset; nothing is claimed beyond it).

- Lane: `feat/covert-desktop-control-v1` · Worktree: `E:\aide-desktop-control-v1`
- Frozen product checkpoint: `1a7f80e7407c54616e167a513bbe6022b3cdd950` (product code unchanged since)
- Build identity exercised: `desktop/target/release/aide-sovereign-workbench.exe`, sha256 `d1d8a83fd16959ddae0aed2dd99a69c918c8ccff14634c3d4684f87662107bb5`; embedded bundle `index-kemRXAAR.js`, sha256 `e58665a18f88ad86dfe5c4cee608bf0552b382b7868ffda7b655050cb2e63cce`
- Machine-readable results: `docs/v1/acceptance/COVERT-V1-OPERATOR-ACCEPTANCE.json`
- Driver: `scripts/acceptance-checkpoint1-uia.mjs` (UIA-driven on the built shell; idle desktop required)

## Checkpoint 1 — Shell / Navigation / Security / Approvals (PASS 20/20)

| ID | Check | Result |
| --- | --- | --- |
| CH1-000 | build identity executable present | PASS |
| CH1-001 | built shell boots, owns the stack, renders identity (`AIDE Sovereign Workbench`, `Covert Coder`) | PASS |
| CH1-101..112 | all 12 cockpit destinations dispatch with a truthful view change and the app stays alive | PASS 12/12 |
| CH1-201 | `OPEN SESSION` dispatches its approval dialog | PASS |
| CH1-202 | approval rejection (`Cancel`) dispatches | PASS |
| CH1-203 | rejected approval leaves NO terminal session (zero owned shells) | PASS |
| CH1-204 | panel truthfully re-offers `OPEN SESSION` after rejection | PASS |
| CH1-301 | panic ends the owned shell and frees ports 4777-4779 | PASS |
| CH1-302 | foreign shells survive (owned-only termination; pwsh 4, Edge 18 before and after) | PASS |

Navigation evidence samples (fresh names per destination): RESIDENT `PRIVATE MINDS`; PROJECTS
`WORKSPACE FILES`; EDITOR `Split editor right`; MODELS `Artifact, runtime, and readiness are separate
facts...`; SKILLS `PARTIAL`; MEMORY `Recorded work. Explicit provenance.`; VERIFICATION `Veritas owns
verification...`; SECURITY `Explicit authority. Bounded operations.`; EXTENSIONS `PHASE-GATED`;
SETTINGS `OPERATOR CONTROL`; COMMAND CENTER `OPERATIONAL EVIDENCE`; TERMINAL `Interactive sessions run
as approved operations...`.

### Measured environment characteristic (recorded, not a defect)
The WebView2 UIA provider intermittently returns an **empty subtree** right after first paint or a
switch to a heavy panel. Measured: boot 17 -> 0 names; command center 0 names at +3.4 s (recovered at
8.8 s during the passing run); SETTINGS stable at 249 names. The driver uses a bounded settle-retry
and still FAILS truthfully if the tree never answers; no masking.

## Cross-checkpoint evidence already in hand (not a substitute for checkpoints 2-18)
- Embedded Terminal V1: built-shell battery `docs/evidence/embedded-terminal-battery-built.json` PASS 16/16
  (approval accept + reject paths, real owned `pwsh.exe`, reap to zero, zero leaks); dev battery
  `docs/evidence/embedded-terminal-battery.json` PASS 13/13 across four runs.
- Desktop UIA gates (idle desktop): panic/ownership 5/5, modals PASS, capture picker PASS, terminal GUI
  PASS (bounded input + wrong-focus zero-input), browser GUI PASS on retry (one WMI-visibility transient
  on a Chromium child; 18/18 foreign Edge survivors).

## Open items
1. The authoritative 18-checkpoint taxonomy to schedule checkpoints 2-18 (requested from the operator).
2. UI-ID-001 operator-visible build identity ambiguity — classification `UNRESOLVED_PACKAGING_HANDOFF`
   (see `docs/v1/desktop/EMBEDDED-TERMINAL-V1.md` section 7).
