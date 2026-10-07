# Raw continuation evidence — 2026-10-07

Source: `80f0cf116a8df618ad66428bdbaa6714a52cb0e0`, with `cf6eaf01334bf761a164569e776d9f3e4c315acb` prerequisite. Tests ran on the uncommitted content subsequently committed to those exact SHAs. No post-test production code edits occurred beyond the separately re-tested strict-query/private-alias refinements and their generated artifacts.

Runtime: Windows 11 Home Insider Preview 10.0.26220; Node v26.4.0; npm 11.17.0. E: source/dependencies, C: disposable fixture/TEMP/TMP. No provider/model/spend/credential was used. Existing real Authority paired operator and separate service actor fixtures, never self-enrollment by Cipher.

| Receipt | Observed outcome | Proof |
|---|---|---|
| correlation-red.log | 31 pass, 13 fail | mismatch counterexamples |
| correlation-green-es2022.log | 44/44; process exit 0; 4,615.3316 ms | final correlation regression |
| project-registry-red.log | missing new owner module | initial pre-implementation requirement signal; not a behavior regression |
| project-addressing-red.log | absent owner/route/private boundary failures | pre-integration signal |
| project-review-red.log / project-marker-red.log | 2 / 3 failures respectively | capacity, owner-ID replacement, both-record loss counterexamples |
| project-final-focused.log | 85/85; process exit 0; 58,414.0589 ms | seven-file Windows integration regression |
| project-private-state-red.log | default Windows ADS alias failure | actual guard counterexample |
| project-routes-private-final.log | generated OpenAPI/facade drift failures | stale strict-query generated contract; retained raw RED |
| project-routes-private-green.log | 17/17; process exit 0; 42,038.3084 ms | final five-file route/alias/generated refresh |
| project-core-types.log | empty stdout; CORE_TYPE_EXIT0 observed | narrow compiler only, config attached |
| project-scoped-lint.log / project-final-lint.log / correlation-lint.log | empty stdout; exit 0 observed | scoped lint; empty logs are expected |
| project-contracts-final.log / project-facade-final.log / project-owner-final.log | process exit 0 | generation, later reproduced by drift tests |
| checkpoint-source-resource.txt | observed Git/resource inventory | raw checkpoint source truth |

Raw logs retain their original bytes/encoding. `manifest.json` records SHA-256 and byte count after copy comparison; `.gitattributes` disables line-ending conversion here. Verify staged/committed blob bytes against the manifest before relying on it. SHA-256 is an artifact digest, NOT a ledger signature or independent witness.

## Reproduction
Recheck source/resource truth first; do not run full/heavy gates below the established floors. Use a fresh C: disposable TEMP/TMP. Test file groups are serialized. Existing timeouts remain unchanged. Commands below are reproducible equivalents; raw logs did not record a complete shell transcript or start/finish wall timestamps. Durations are the runner's observed values.

From `E:\covert-workstation-integration-saul-20261006`:
```powershell
# Assign TEMP/TMP to a new owned C: fixture directory before running.
node --max-old-space-size=256 --test --test-concurrency=1 tests/arch/cipher-ledger.test.ts tests/arch/cipher-authority-lineage.test.ts
node --max-old-space-size=256 --test --test-concurrency=1 tests/arch/project-registry.test.ts tests/arch/project-addressing.test.ts tests/arch/cipher-ledger.test.ts tests/arch/cipher-authority-lineage.test.ts tests/arch/shared-capability-seat.test.ts tests/arch/cipher-laptop-routes.test.ts tests/arch/cipher-notebook.test.ts
# Child contract builders inherit a task-only 256 MiB heap cap:
$env:NODE_OPTIONS='--max-old-space-size=256'
node --max-old-space-size=256 --test --test-concurrency=1 tests/arch/project-private-state.test.ts tests/arch/project-addressing.test.ts tests/arch/openapi-drift.test.ts tests/arch/route-drift.test.ts tests/arch/route-authority-coverage.test.ts
node --max-old-space-size=256 node_modules/typescript/bin/tsc --noEmit -p <owned-C-copy-of-tsconfig.project-core.json>
```
The narrow compiler config uses the exact E: source paths in this worktree. It must be adapted to an integrated worktree before reproduction. Generator helper also names this owned source; do not execute it on another lane without adapting ownership/paths.

## Review and limitations
Read-only reviewer `/root/cipher_correlation_review`: ACCEPTED_FOR_TESTED_SCOPE, after ES2022, catalog capacity/enrollment-loss and private/query repairs. Final source review reported no remaining actionable finding. The final 17-test log refreshed query/alias/generated evidence after the 85-test run. No implementation delegation or review-agent edits.

No full Node/browser compilation, UI screenshot/browser journey, packaged runtime, clean-machine, model, full-suite or production E: storage evidence is present here. Historical evidence remains separate. Fixture success does not establish installation-wide continuity, activated multi-project isolation, live Resident/context leases, signatures or global containment.
Known cleanup: fixture tests owned their server/child handles and completed with zero cancellations; no foreign process was terminated. C: raw artifacts were intentionally retained. A transient PowerShell CLR launch failure was retried; it did not run/alter a product test.

Evidence-delivery validation initially failed because the repository's existing `.gitignore:7:*.log` excluded raw logs from directory staging. The Git-blob validator caught the absent staged files before commit. Explicitly stage only this owned evidence set with `git add -f`; preserve the repository ignore policy. This is an artifact-delivery defect, not a product test failure.

A second delivery check rejected original CRLF/trailing whitespace in raw receipts. Raw evidence is archived as binary (`-text -diff`) to retain exact observed bytes; readable README/path list remain text diffs. The normal source/document whitespace check stays enabled, and staged/committed byte-count plus SHA-256 checks remain mandatory. No log was trimmed to obtain a pass.
