# Cipher/platform implementation checkpoint — 2026-10-07
Execution status: bounded source/integration-fixture checkpoint; broader verification RESOURCE-GATED. No background work is implied.

## Production changes
Two production commits after the observed starting checkpoint:
- `cf6eaf01334bf761a164569e776d9f3e4c315acb`: reject contradictory effect generation, Authority and Admission references on append and replay; real recorder observations carry only known actual Authority references.
- `80f0cf116a8df618ad66428bdbaa6714a52cb0e0`: durable canonical Project and Checkout UUIDs, owner registry, configured foreground seat, governed capability addressing, ledger associations, restart reconciliation and private-record protection.

Projects are identities; paths remain checkout locators. Trusted composition enrolls a root, not a UI event. Known projects/checkouts can coexist in the owner catalog; the running services remain bound to one configured checkout. There is intentionally no foreground-switch endpoint.

The same canonical file operation serves paired operator and separately enrolled service principals. Optional explicit project/checkout addresses must match the current owner binding. PREPARE records retain that address through later phases; consumption revalidates it before any effect. A catalog/root mismatch triggers a deterministic serious-integrity hold through existing ledger/Authority controls. Operator evidence/read access survives. This is not live Resident enrollment.

Recovery retains stable IDs across process/service restart. Lost, corrupt, redirected, replaced or incomplete owner records refuse effects instead of silently registering a new identity. Three same-owner catalog/enrollment records plus existing durable ledger references expose tested partial-loss cases; they are NOT an independent witness, signature, backup or complete rewrite detector.

Generic file operations cannot expose or mutate the catalog or enrollment marker, including tested Windows case, trailing-dot/space and default alternate-stream aliases. This does not sandbox OS/terminal access.

## Source truth and reconciliation
Own worktree: `E:\covert-workstation-integration-saul-20261006`.
Branch: `feat/workstation-integration-saul-20261006`; upstream: `origin/feat/workstation-integration-saul-20261006`.
Start: `8417af9e6a9bfd63ec73596c1a5134c03865fb70`, clean, 10 commits ahead of `14b9ad9`.
Code checkpoint: `80f0cf116a8df618ad66428bdbaa6714a52cb0e0`, clean before evidence files, 12 ahead / 0 behind both `14b9ad9` and locally observed upstream. No fetch, push or merge this turn.
Final evidence commit/clean status must be taken from the accompanying final Git receipt; a commit cannot embed its own SHA.

Luna: `E:\covert-sovereign-workstation-shell`, `feat/covert-sovereign-workstation-shell`, HEAD `12b999d329b59fd7dd480504ce84670b0de521f5`, no upstream. Final 13:20 UTC enumeration shows 39 modified and 10 individual untracked files; tracked delta 2,210 insertions / 357 deletions. The earlier observed nine untracked files is superseded by the actual enumeration. No Luna file was edited, staged, committed, reset, cleaned or stashed.
Convergence: `7f79be9f09afa43283d3548b3b2fd0c98a6dbca7`; preserve unrelated untracked directive. Packaging: clean `da320b96fc9ab2ec4da7d0c24150d24ce90d2c17`. Neither contains this slice by implication.
Full observed worktree inventory and source/resource receipt: `evidence/20261007-project-addressing/checkpoint-source-resource.txt`.

## Verification actually performed
Windows Node v26.4.0; disposable fixtures and TEMP/TMP on C:, no E:-backed runtime journal stress.
- Correlation: RED 31 pass / 13 fail; final GREEN 44/44 (4,615 ms). Historical missing/null references are preserved, never backfilled.
- Integrated owner/HTTP/Authority/Laptop/ledger/Notebook/shared-seat run: 85/85 (58,414 ms), zero failures/cancellations/skips.
- Final strict-query, Windows private-alias, OpenAPI, facade and ownership reproducibility refresh: 17/17 (42,038 ms), zero failures/cancellations/skips.
These are overlapping test groups, not a claim of 146 unique tests.
- Narrow strict ES2022 project-core compiler exit 0. This excludes the full server/recorder dependency graph; full Node and browser types remain unverified at this code SHA.
- Scoped ESLint and final affected-file lint exit 0.
- Actual HTTP paired/operator/service file effects, pre-execution refusal, operator evidence reads and restart behavior exercised. Independent Node process registry restart tested.
- Generated route truth: 245 routes, zero conflicting/unclassified ownership decisions; existing 20 migration waivers retained, not called closed.

Failures reproduced and repaired: contradictory references; ES2022-incompatible findLast introduced during repair; encoded catalog capacity mismatch; missing owner files wrongly treated as first-use; live catalog ID replacement; Windows ADS private-path alias; stale generated OpenAPI after strict empty query. Raw RED logs remain alongside GREEN. One transient PowerShell CLR launch failure under resource pressure was retried; not classified as a product-test failure.

Independent read-only security review: ACCEPTED_FOR_TESTED_SCOPE after repairs, no actionable source findings remaining in this slice. This is source review plus observed fixture logs, not packaged security acceptance.

## Resource and runtime limits
Established heavy floors unchanged: available physical RAM at least 3,072 MiB AND free commit strictly above 5,120 MiB.
Latest 13:20 UTC checkpoint: 3,149 MiB available physical / 1,563 MiB free commit. Heavy gate closed. Earlier measurements also failed free-commit floor.
No full suite, full Node/browser compilation, frontend build, browser workstation journeys, model run, packaged runtime, clean-user/clean-machine or CI acceptance was run at these SHAs.
No presentation files changed, no new screenshot or visual acceptance claim. Historical UI/PT Y evidence is not current proof.
No foreign process was killed. Tests owned their fixture/server/child handles; no foreign adoption. No timeouts, resource floors, Authority or Admission controls were weakened.
Luna's E: journal-latency/storage diagnosis remains open. Safe C: fixture runs do not prove production E: storage or its recovery characteristics.

## Security and remaining gates
S36 effect correlation, S37 project addressing and S38 private-state aliases added to the existing closure matrix with PARTIAL status and concrete owner handoffs.
Still open: task/AttemptJournal, terminal/process, standalone evidence, context lease and model-role adoption; activation-safe switch/rebind isolation; live Resident enrollment; installation-wide Laptop migration/backup; genuine witness/signatures; running-process/credential/egress/app containment; storage diagnosis.
Nested known checkout registrations are metadata only: existing parent-root grants still cover nested files. Full activated multi-project isolation is NOT proved.
Unsigned owner records cannot prove tamper resistance against rewriting all same-owner records and unsigned ledger together. No synthetic history or signatures were created.

## Luna integration and next executable slice
Use `LUNA_PROJECT_ADDRESSING_HANDOFF_20261007.md` for exact owners/APIs/states/permissions/negative tests/code SHAs.
Preserve Luna terminal resume, readiness, scrollback, central-route and facade-origin work. Merge source descriptors first, regenerate all shared artifacts from the final integrated tree, then run both lanes' tests. Do not copy either generated JSON over the other wholesale.
Next: recheck source/resources; full Node/browser types at the heavy floor; then bounded owner adapters for task/attempt/evidence/context, with terminal association coordinated with Luna. Foreground switching stays disabled until per-owner rebind, revoke and isolation negatives pass. Only then advance explicit Resident context lease/enrollment.
No platform READY / SECURE / ACCEPTED / QUALIFIED / RELEASE-CANDIDATE claim is made.
