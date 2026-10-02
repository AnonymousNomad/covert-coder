# ArchServer signal-handler lifecycle closure

Recorded: 2026-10-02 UTC
Scope status: **CLOSED_FOR_PROVEN_SCOPE** at source SHA `93a6764604dccb0ce85962edb99fda80893cd05`.

This closes the ArchServer `SIGINT`/`SIGTERM` listener leak only. It does not close the separate historical full-suite timeout blocker or establish release-candidate acceptance.

## First red and root cause

The preserved pre-repair regression failed after an `ArchServer` listener was closed: the process listener count was expected to return to baseline (`0` new listeners) but remained at `1`. The baseline TAP artifact is `E:\covert-tooling\functional-release-20261001\server-signal-cleanup-baseline.tap.log` (SHA-256 `7B131B55CFF03F3008DF557E147B67D29F1597351E74017304874D83C9739C5A`). The pre-repair source at parent `f7175144753a2bcfaaa3ff0ce79a558007f77dbb` registered anonymous `process.once` callbacks and did not remove them when the owning HTTP server closed. A directly closed server never consumed those one-shot process listeners, so each later instance accumulated another handler for each signal.

`node/src/server.ts` now retains the exact `SIGINT` and `SIGTERM` callback references and removes only those references from that server's `close` event. It does not call `removeAllListeners`, raise a global listener limit, suppress warnings, or change the existing bounded/idempotent shutdown callback.

## Regression proof

`tests/arch/server-signal-cleanup.test.ts` proves:

- three sequential create/close cycles return both process listener lists to their original baseline;
- two live instances own different callback references;
- closing the first removes its callbacks and leaves the second instance's callbacks registered;
- closing the second restores the original baseline;
- each `SIGINT` and `SIGTERM` callback reaches the canonical shutdown hook in an isolated child and its listener counts return to baseline.

The focused current-SHA run passed **2/2** (0 failed, skipped, or cancelled; 3.70 s). Its TAP log is `E:\covert-tooling\functional-release-20261001\server-signal-cleanup-current-sha-20261002.tap.log`, SHA-256 `F285563473722CF2DB87BAC8DEEB38C97ECC2893AAA9E68973CFB2A487F867D6`.

## Broader verification

| Gate | Result |
| --- | --- |
| `npm run check` | 979 total, 968 pass, 0 fail, 11 skipped; TypeScript checks passed; ESLint 0 errors / 62 warnings. Log SHA-256 `FF8A232B0EE706285FF2BFD634AB1EC4F250ABE14B51DCA51DBD0DED6D6CA1DC`. |
| Plain `npm test` v7 | Exit 0; full original chain completed. Log SHA-256 `4A68638381257664559460C1F6941CE2151A22F9E942062E7C5558DA5E56DEEA`. |
| `npm run veritas -- --task-class code-change` | Exit 0; all six checks true: path-boundary, secret-scan, manifest-validation, compile, tests, and git-diff. The tests gate ran the full `npm test` chain. Log SHA-256 `3BFE5F35A59CEA6DE5BC6D561BBD347AA30B8EA9D07715464D0DA5DBB6F00626`. |
| Exact-SHA AIDE CI | Run [37046618494](https://github.com/AnonymousNomad/covert-coder/actions/runs/37046618494), source SHA `93a6764604dccb0ce85962edb99fda80893cd05`: success, 23/23 steps, 0 failed, 0 skipped. |

The full Veritas E2E sequence returned `/api/plugins/presets` in 37 ms, `/api/artifacts` in 35 ms, and `/api/authority/prepare` in 11 ms. These later responses do **not** root-cause or erase the separately preserved historical 30-second timeout reds.

The Veritas desktop battery appended a `DC-a battery` **9/9** row to `docs/evidence/desktop-battery.md`; that generated evidence row is retained.

## Cleanup, skill, and limits

- The focused fixture removed its temporary roots. After Veritas, the observed Veritas/architecture process IDs were gone and no `covert-server-signal-*` fixture directory remained.
- Existing local skill `failure-server-signal-handler-leak` was loaded and reviewed. Automated validation is **BLOCKED/UNVERIFIED**: `py -3` has no PyYAML (`ModuleNotFoundError: yaml`), and `python`/`python3` resolve to unavailable Microsoft Store aliases. No Python environment was changed. The skill's frontmatter and lifecycle content were reviewed manually; this is not a validator pass.
- The child fixture uses `process.emit()` to exercise the registered callback path. It does not claim to prove Windows kernel delivery of console signals.
- Historical `npm test` timeout reds at `/api/artifacts`, `/api/authority/prepare`, and `/api/plugins/presets` remain **OPEN / CAUSE_UNKNOWN** in `MANAGED-OPENCODE-PREPARED-INPUT-LOCAL-2026-10-02.json`. Their original logs and traces remain preserved outside the repository with recorded hashes.
- Live model/provider execution, local-model qualification, whole Resident qualification, packaging, fresh-user acceptance, dogfood, and RC readiness remain unproven. The GLib advisory remains open, PR #31 remains frozen, and visual themes remain paused.

Detailed machine-readable result and source hashes: `ARCHSERVER-SIGNAL-HANDLER-CLEANUP-2026-10-02.json`.
