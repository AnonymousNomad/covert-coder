# OVERNIGHT SOAK — MORNING REPORT

Role: Resident dogfood / stability soak / orchestration evidence lane.
Scope: overnight window after the orchestration program. NO architecture changes,
NO training, NO provider wiring, NO Luna duplication.

## Exact metrics
```
SOAK MISSIONS:                 32  (16 missions x 2 passes)
CONSECUTIVE CLEAN:             30  (max; final = 30; 2 mission_errors were
                                    runner-side bugs, not containment failures)
STREAM RUNS:                   3   (30 probes: 10 protected cases x 3)
UNSAFE SHIPMENTS:              0
CONTAINMENT INTERVENTIONS:     8   (non-OK dispositions in the soak)
                               + stream soak: 8 REGENERATED + 4 fail-closed
FALSE-SUCCESS ATTEMPTS:        8   (pressure missions: did-tests-pass,
                                    confirm-complete, release-ready,
                                    evidence-complete x2 passes)
FALSE SUCCESSES SHIPPED:       0
RESTARTS:                      1   (post-soak restart continuation; fresh stack,
                                    canonical reconstruction, no transcript)
MODEL SWITCHES:                0   (overnight; switch path previously proven in M2)
PROCESS LEAKS:                 8 observed and killed (3 from a failed 4-model
                                    boot, 5 from the lifecycle probe's first run);
                                    0 remaining. Foreign engine untouched
                                    throughout (1 foreign: LFM2.5-2.6B-QAD).
NEW RESIDENT DEFECTS:          0   (the two stream containment gaps were found in
                                    the previous run's M6 and remain repaired;
                                    tonight's 30 stream probes: 0 unsafe)
PROVIDER PATH AVAILABLE:       NO  (.aide/byok/providers.json = [], no credentials)
PROVIDER-SWITCH REPLAY:        NOT_REACHED (control case frozen; see below)
REAL DEVELOPMENT MISSION:      PARTIAL (2 more full-chain runs: deterministic FAIL
                                    both times - weak local coders; capacity visible)
OVERALL RESIDENT ORCHESTRATION: PARTIAL
```

## Evidence
- Soak: `results/overnight-soak.json` + `overnight-soak-journal.jsonl`
  (32 mission records: prompt, SOP selection, reconstruction, containment
  dispositions, watcher hits, consecutive-clean counter; economics per mission).
  - 0 escapes; interventions by family exercised: fact-check, capability,
    structural (stream) + the pressure missions all contained or fail-closed.
  - Full-chain runs: planner produced bounded plans (1,442 / 1,482 chars);
    coder artifacts failed the deterministic gate (`exit_code: 1`) both times —
    placeholder-class capacity failure preserved, never masked.
  - RAM guard refused a 4-model boot while foreign engines run: the soak adapted
    (resident + one worker engine) instead of weakening the guard or touching
    foreign processes.
- Stream soak: `results/overnight-stream-soak.json`
  - 30 probes, 0 unsafe shipments, 8 regenerations, 4 fail-closed,
    first-delta 1,094–34,590 ms (buffer-then-release), 0 engine failures,
    families: capability-unsupported 8, fact-check 2, structural 2.
- Restart: `results/post-soak-restart-continuation.json`
  - Canonical reconstruction succeeded; "Continue." -> containment fail-closed
    (RESIDENT_OUTPUT_UNUSABLE — the answer attempted a protected claim); the
    "Where are we?" answer was off-target (model-language limit, recorded; harness
    owns structure per doctrine). No transcript replay.
- Lifecycle: `results/lifecycle-probe.json` — **PASS**
  - normal close: owned engine 1 -> 0; partial-boot path: 4 -> 0;
    foreign engine untouched.
  - Root cause documented: on Windows `ChildProcess.kill()` terminates without
    delivering SIGTERM, so the arch server's shutdown hooks (modelRuntime.stopAll)
    never ran and detached engines survived. Repaired at the boundary this lane
    owns (supervised-stack close now performs ownership-verified reaping:
    registry port -> PID -> cmdline must contain the exact model file path ->
    taskkill). **Integration note for launcher owners (start.mjs / desktop shell):
    the same Windows semantics affect the product close path — engines can be
    orphaned when the app exits; the verified reap pattern is recorded here.**
- Provider-switch control case: `frozen/provider-switch-control/`
  - MISSION.json (frozen objective, SOP, acceptance, authority, harness, veritas,
    local worker, local result, failure evidence, Resident response),
    PROJECT-SNAPSHOT (the exact failing code state), REPLAY.md, replay.mjs.
  - Rerun contract: SAME resident/project/objective/workflow/SOP/acceptance/
    authority/harness/veritas; DIFFERENT worker only. No task rewrite, no hidden
    truth, no goalpost move.
  - Provider availability: NO (empty providers.json) -> replay NOT_REACHED.

## Morning verdicts
- No accepted behavior regressed: 28/28 protected tests (live-awareness 11,
  containment 13, route-authority 1, git-unborn 3) + tsc PASS after the lifecycle
  repair. Containment and stream-governance repairs preserved.
- New findings: (1) the Windows close-path engine leak + its bounded repair;
  (2) Resident language quality on open questions remains the recorded capacity
  limit (no training; harness owns deterministic structure).
- The architecture is no longer the experiment: 62 governed Resident interactions
  tonight (32 missions + 30 stream probes), 0 escapes, 0 false successes shipped.
