# WEEKEND PLATFORM P0 — OWNER MAP (canonical owners vs weekend seams)

Rule: the weekend lane creates projections/tests/prototypes only. It never creates a second owner.

## Canonical owners (DO NOT duplicate; from operator law + blueprint)
| Domain | Canonical owner (existing) | Weekend lane may |
|---|---|---|
| App Catalog | `node/src/services/app-catalog.ts`, `common/contracts/platform-app.ts` (hot: active Cipher lane) | consume via reader interface only; integration adapter waits for accepted checkpoint |
| Authority | Execution Authority (existing) | never substitute; DING/approval wiring only through it |
| Resource Admission | `resource-admission.ts` (existing floors) | measure/plan only; never weaken |
| Model Manager / Model Access | `model-runtime.ts`, `model-access.ts`, `model-manager-view.ts` | read-only consumption; no second registry |
| Model Atlas / Harness Sync | `model-atlas.*`, `harness-sync.*` | dossier reads; AutoTune proposals bind to Atlas evidence |
| Credentials | DPAPI store + BYOK + client-owned auth | never store/copy client credentials |
| Project/worktree | ProjectSeat/ProjectRegistry | read-only |
| Terminal/PTY/process lifecycle | `terminal-sessions.ts` + owned-processes | wrapper/metadata adapter only; extend core only if composition proves impossible |
| TaskService | existing generic task owner | no second task service |
| OpenCode | `opencode-bridge.ts` | reuse; adapter seam only |
| Mission Receipt / provenance | existing provenance owner | consume; no second receipt system |

## Weekend seams by phase (blueprint `12`, suggested names — reconfirm tree at implementation)
- **P1 capability projection/tool gateway**: `common/contracts/capability-projection.ts`, `common/contracts/tool-navigation.ts`, `node/src/services/capability-projection.ts`, `node/src/services/tool-navigator.ts`, `skill-router.ts` ONLY after auditing existing skill loader, tests `tests/arch/capability-projection.test.ts`, `tool-navigator.test.ts`. Forbidden: editing `app-catalog.ts`, platform-app contracts, OpenAPI/facade maps, or operation-policy "for test convenience".
- **P2 managed terminal clients**: `common/contracts/managed-client.ts`, `managed-client-registry.ts`, `managed-clients/{claude-code,codex-cli,kimi-code,opencode}.ts`, `client-conformance.ts`, tests `managed-client-*.test.ts`. ACP = optional future seam (not a replacement for Tool Gateway/MCP/Authority).
- **P3 mailbox/schedule/wake/Operations**: `cipher-mailbox.ts`, `scheduler.ts`, `operations-activity.ts` contracts; `cipher-mailbox-store.ts`, `covert-scheduler.ts`, `cipher-wake-supervisor.ts`, `operations-projection.ts`. Storage spike on `node:sqlite` (Node 26.4) with FK/txn/idempotency + versioned schema BEFORE durable use. Do not edit Cipher Laptop UI while hot.
- **P4 onboarding V2**: compose existing owners; MUST surface corrupt-state recovery instead of the current silent reset; no plaintext credentials in onboarding state.
- **P5 AutoTune**: `autotune.ts`, `autotune-planner.ts`, `runtime-profile.ts`; bind to exact artifact/runtime/hardware/settings/role/Harness revisions; Admission guards experiments; fit ≠ load ≠ qualification.
- **P6 native app SDK**: RFC + isolated experimental sample under `docs/weekend-platform-20261009/native-app-sdk/`; do NOT resurrect Workbenches/Bundles as the native-app owner (historical surface to reconcile).
- **P7 prototypes**: `browser/src/experiments/{covert-flow,api-lab,visual-core}/` only; not in main shell/nav/catalog while hot; no React without explicit decision; no new secret store.
- **P8 integration**: only after a clean accepted Cipher/App Catalog checkpoint; temporary integration worktree; rebind types to canonical catalog; regenerate artifacts; full available gates; exact conflict record.

## WAITING_ON_ACCEPTED_OWNER_CHECKPOINT (exact items)
1. P1 real App Catalog adapter integration (needs accepted `app-catalog`/platform-app checkpoint).
2. P6 conformance rebinding to canonical App Manifest types.
3. P3 Cipher Laptop UI wiring.
4. P8 all steps (by definition).
`L:\CovertScratch\cipher-mission-composer-20261009` remains ACTIVE-PRIVATE at `e019156…`; consume only via P8 gates when accepted.
