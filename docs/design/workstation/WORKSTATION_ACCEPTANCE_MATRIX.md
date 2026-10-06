# Acceptance, performance and accessibility

No product/runtime tests claimed. Preparatory checks do not pass these gates.

| ID | Check / required failure case | Current |
|---|---|---|
| A01 | Luna full dirty/untracked diff and packaging ownership; preserve old controls | BLOCKED |
| A02 | Complete checkout baseline/type/lint/build/regression | BLOCKED |
| B01 | Actual reference comparison: idle/edit/2 terminals/overlap/snap/monitor/models/Cipher/Buddy/refusal | UNVERIFIED |
| C01 | Frame actions, keyboard, pointer cancellation, offscreen recovery, no typing-focus theft | UNVERIFIED |
| C02 | Launcher/internal switching; no stolen editor/terminal/Windows keys | UNVERIFIED |
| C03 | Per-project layouts, corrupt version, DPI changes; no stored command execution | UNVERIFIED |
| D01 | Real editor/files/search/Git; dirty buffers/denied writes/source changes | UNVERIFIED |
| D02 | Two distinct approved PTYs: I/O/resize/Ctrl-C/close/cleanup; no foreign stop/orphan | UNVERIFIED |
| D03 | High-output/minimized terminal: bounded buffers/responsive stop/visible gaps | UNVERIFIED |
| D04 | Models/connections: revoked key/unqualified artifact/failed auth/unknown state | UNVERIFIED |
| D05 | Profiles/discovery: missing capability does not silently install/download/grant/egress | UNVERIFIED |
| E01 | Actual Cipher binding, scope/task/context; worker switch cannot rebind | UNVERIFIED |
| E02 | Independent stop/revoke with Cipher unavailable | UNVERIFIED |
| F01 | Buddy fact mapper/chassis/persona swaps: no fake WORKING or privilege change | UNVERIFIED |
| F02 | Safe placement/hidden/reduced motion; no covering decisions/input/evidence | UNVERIFIED |
| F03 | Enabled chassis conformance and small-size silhouettes | UNVERIFIED |
| G01 | PTT capture/output: denied/device-lost/undeclared remote route/immediate stop | UNVERIFIED |
| G02 | Selected-image scope/egress: no ambient capture/silent cloud route | UNVERIFIED |
| H01 | AI outage tools usable within own dependencies; truthful daemon outage/recovery | UNVERIFIED |
| H02 | Admission required/observed/stale/unknown metrics, no fake zero/healthy | UNVERIFIED |
| H03 | Source-bound required verification: no exit-zero PASS/stale receipt | UNVERIFIED |
| H04 | Restart: no replayed approvals/mic/RUNNING/current PASS | UNVERIFIED |
| I01 | Windows 100/125/150/200%, zoom/narrow/high contrast/focus/reduced motion | UNVERIFIED |
| I02 | Windows full process-tree budgets/long-session leak measurements | BLOCKED |
| I03 | Packaging lane exact-artifact representative journey | BLOCKED |

## Candidate budgets, not measured results

Idle empty UI/WebView process tree private working set ≤400 MiB; defined small project editor + two quiet terminals approximately ≤700 MiB. Settled idle <1% machine CPU. Buddy incremental aim ≤50 MiB against same scenario off; idle static or occasional 2–4 FPS, active short clips ≤15 FPS, hidden rendering explicitly suspended. Shared telemetry samples roughly 2–5 seconds.

Record SHA/build/runtime/OS/driver/scale/project/output rate/model artifact/host contention and CPU method. Measure host/UI/backend/model separately and total. JS heap alone and Linux browser memory are not Windows WebView2 totals. No blanket GPU disable or unrelated-process kill to make a budget pass.

Bound lists/history/buffers; lazy views/assets/routes; shared observations; dispose subscriptions/observers. Repeat open/close through a representative long session and inspect retained objects/processes.

## Accessibility

Normal text ≥4.5:1 and large text ≥3:1 contrast; check focus/non-text controls separately. Labels/icons independent of color. Adjustable text, visible persistent focus, keyboard geometry, logical focus return, screen-reader labels. True decisions are modal; applications not.

Utility content reflows on zoom/narrow hosts; title bars/launcher/task strip remain reachable. Static reduced-motion Buddy; no glow/scanlines interfering with readability. Token math is preparation, not rendered conformance.

## Security closure gates

The [security contract](WORKSTATION_SECURITY_CONTRACT.md), [28-row closure matrix](WORKSTATION_SECURITY_CLOSURE_MATRIX.csv) and [eight precise owner handoffs](WORKSTATION_SECURITY_HANDOFFS.md) are mandatory acceptance inputs. Source-confirmed controls and owner assignment do not pass a gate.

| ID | Required proof | Current |
|---|---|---|
| J01 | S01–S03: operator/Resident/worker distinct authenticated principals; exact use-time grants and refusal | UNVERIFIED |
| J02 | S04–S07/S25: scoped context/continuity/credentials/files; root and project race protection | UNVERIFIED |
| J03 | S08–S09/S13–S14: honest shell reach, native ownership, artifact/runtime substitution, owned-only termination | BLOCKED |
| J04 | S10–S12: no localhost scope widening, precise destination/retry/fallback and credential use | OPEN_SOURCE_GAP |
| J05 | S15–S17/S23: enabled first-party app lifecycle, trusted updates/IPC and no unproven third-party execution | BLOCKED |
| J06 | S18–S20: bounded passive assets, media stop, no capture/voice selfapproval or undeclared egress | UNVERIFIED |
| J07 | S21–S22/S24/S28: authentic scoped events, safe restart, audit failure and source-bound verification | UNVERIFIED |
| J08 | S26–S27: independent panic/integrity, observed containment under all model failures | UNVERIFIED |

For every applicable V1 matrix row require actual integrated negative-test evidence bound to exact source/build/artifact/host. Keep later/unqualified features disabled. Third-party execution's absent sandbox is not a passing first-party or packaging test. No security-hardened acceptance on partial containment, a model assurance, a mock-only test or an exit-zero process.

## Product result

FAIL for observed unresolved required failure; else BLOCKED for missing required dependency; else PASS only for all applicable passes; else PARTIAL for some passes/unfinished work; else UNVERIFIED. N/A needs justified applicability, never silently excludes promised capabilities.

Whole workstation: BLOCKED / NOT ACCEPTED. Next product action requires A01/A02, not renewed routine approval.
