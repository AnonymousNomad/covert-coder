# CORE CLOSURE RUNSTATE — release line `audit/wiring-ledger`

Last verified: 2026-09-23 (after P0.8 freeze). Purpose: reconstruct the mission without rereading conversation history.

## Current state

```
current_sha:        (this commit — P0 FREEZE)
branch:             audit/wiring-ledger
origin:             github.com/AnonymousNomad/covert-coder
phase:              P0 CLOSED -> P1 QUEUE (not started)
candidate_ready:    NO
```

## Completed gates (all with evidence)

| Gate | Status | Evidence |
|---|---|---|
| P0.2 process ownership (owned reaped, foreign untouched) | PASS | WAVE10A-SWEEP.json |
| P0.3 OpenCode Go through Covert | PASS | P03-OPENCODE-GO.json |
| P0.4 real governed external mission | PASS | P04-REAL-MISSION.json |
| P0.5 Skills behavior | PASS | P05-SKILLS.json |
| P0.6 evidence-gated transitions | PASS | P06-EVIDENCE-GATE.json |
| P0.7 handoff + failure continuation + cold restart | PASS | P07-E2E-FORMAL.md + P07-E2E.json |
| P0.8 local↔external↔local worker replaceability | PASS | P08-E2E-FORMAL.md + P08-E2E.json |
| P0.9 offline core | PASS | P09-OFFLINE.json |
| P0.10 delegation | POST_CANDIDATE | DELEGATION-CONTRACT.md |

## Battery integrity

- `scripts/battery-guard.mjs` enforces REQUESTED == DISCOVERED == EXECUTED; selftest PASS (3 negative/positive controls).
- continuation suite: expected 10 / observed 10 / pass 10 / fail 0 / skip 0 (guard-verified).
- P0 regression batch (10 suites): observed 98 / pass 98 / fail 0 / skip 0 / all files present / verdict PASS. Manifest: artifacts/integration-certification/BATTERY-p0-regression.json.
- Discovered defect class (fixed): `node --test <missing-file>` silently omits it; prior combined "43/43" claim corrected to INVALID/INCOMPLETE. Preserved as evidence.

## Counters

```
false-green batteries:      0 (guard enforced from 12b9519)
false verified:             0
false transitions:          0
cross-project handoff leak: 0
owned process leaks:        0
foreign processes touched:  0
```

## Next dependencies (in order)

1. P1 Health Supervisor (deterministic canonical states over facade/backend/Resident/engines/ports; readiness+liveness, not PID).
2. P1 Resource Admission (START/QUEUE/REFUSE_RESOURCE; Resident priority; reuse resource-guard).
3. P1 Worker/Model Provenance Ledger + Mission Receipt (test fields: battery_id/requested/executed/passed/failed/skipped/verdict).
4. P1 First-run Readiness, Doctor Truth, Egress Manifest.
5. Golden verified mission (readiness→Resident→Skill→worker→Authority→Harness→execution→Veritas→evidence→Receipt).
6. Luna skills-loader handoff review; Capability Fabric go/no-go (POST_CANDIDATE unless additive+regression-protected).
7. Full release regression -> claim matrix -> immutable candidate.

## Known limitations / notes

- External session `verification_b: incomplete` in P0.8 (no file mutation to verify); recorded as-is.
- Probes with real HTTP must call `process.exit(0)` (undici keep-alive hang class).
- `task_id` for worker-handoff create must be a canonical session id (trajectory-backed).
- Kimi live proof ENVIRONMENT-BLOCKED (no Kimi Code entitlement); moonshot builtin path recorded.
- Foreign engines (main worktree LFM2.5, ports 8097/8194) must never be killed.
