# Production convergence checkpoint — 2026-09-28 00:58 UTC

## Canonical source state

- Canonical worktree: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- HEAD: `b0f0a729e7b1bc72f4e7dfa4f18d8d13b8873798`
- Upstream: `origin/fix/v1-p0-route-drift`; local branch is ahead 13, behind 0. No push was made, so this SHA has no GitHub run of its own.
- Dirty state after the scoped commit: 12 tracked modifications, 36 untracked files, 0 staged. The existing directives, addenda, skills and harness-comparison work were preserved; this checkpoint is the 36th untracked file. No unrelated files were committed.
- The repository has 41 linked worktrees. Several separate accepted lanes still contain edits; no worktree was cleaned or removed.

## Completed release-closure unit: Mission Receipt honesty

Commit `b0f0a72` changes the receipt projection so it reports a mission-level supported conclusion only when every recorded run has `result: done` and `verification_state: verified`. Mixed or failed runs retain their per-run records, return no supported conclusion, and add an explicit limitation. A regression test covers one verified run mixed with a failed run.

This closes a concrete overclaim in the existing Mission Receipt projection. It does not establish a complete first-user coding journey or prove whole-product acceptance.

## Verification and evidence

- Focused `provenance.test.ts` + `route-drift.test.ts`: **13/13 passed**, including live route projection and the generated C1-02 route-decision check.
- Full `npm run check:arch`: **exit 0** on the exact source content subsequently committed as `b0f0a72`. It ran Node TypeScript, browser TypeScript, ESLint and the serialized architecture suite.
  - 120 architecture test files; **787 tests, 776 passed, 0 failed, 11 skipped**.
  - Started `2026-09-28T00:47:48.3837434Z`; completed `2026-09-28T00:58:32.4905475Z`; test duration `619437.6199 ms`.
  - The 11 skips remain environment or platform skips, including absent bundled GGUF artifacts; they are not local-model or clean-install acceptance.
- Raw full-gate log: `artifacts/convergence-check-arch-2026-09-28T004748Z.log`.
- An earlier full run failed only because placing the new test before the live route test shifted source line references recorded by C1-02. The test was moved to the end of the file; the focused route-drift rerun and the final full gate passed. Earlier log: `artifacts/convergence-check-arch-2026-09-28T000000Z.log`.
- No convergence-branch Veritas run or GitHub CI run was performed for `b0f0a72`. PR #31's separate successful CI is not evidence for this SHA.

## PR #31 remains frozen

- PR #31 remains open at `b79d2480498e446cff36b26dd4b4faef7745726b`, based on `covert-production` `f4da26b0b1c062dce8f3066f350f032dd3877ce4`.
- Its two GitHub Actions `verify` check-runs are successful (runs `36350689255` and `36350687573`). GitHub reports `mergeable: true`, `mergeable_state: blocked`; it was not merged or promoted.
- Local PR worktree `E:\aide-sovereign-workbench` remains on `resident/marathon-h1` at `b79d248`, with 136 tracked dirty paths and 411 untracked paths. Its HEAD was not changed. PR #26 and #30 remain independent.

## Accepted branch convergence status

Branch-tip ancestry checks confirm these accepted work tips are in the current lineage: `audit/wiring-ledger` (`dc0d30e`), `fix/authority-chat-contract-v1` (`e41083d`), `fix/v1-mission-cancellation` (`bf3dd2a`), `origin/fix/v1-p0-route-drift` (`a9628b8`), `release/source-assembly` (`e23aec8`) and `research/local-runtime-bakeoff` (`e41aafa`). Prior lineage review also found atomic persistence, egress/Local-Only, resource admission and workspace trust closures present. The new Mission Receipt correction is at `b0f0a72`.

The following tips are still outside the convergence branch. This means the tip commits are not integrated; it does not assert that no individual source files overlap with current work:

| Lane | Tip | Reconciliation evidence |
|---|---|---|
| Resident PR #31 | `b79d248` | Separate green PR; 41 branch-only commits from `f4da26b`; frozen. |
| Context Control | `a9fdf0b` | One branch-only commit; merge base `a92eb996`; one tracked local edit. |
| Model Manager | `d80d184` | Seven branch-only commits; merge base `8ea6c8b`. |
| Universal Intelligence / setup | `934f306` | Nine branch-only commits; merge base `8ea6c8b`; one untracked local file. |
| Subscription/provider | `26e33ba` | 48 branch-only commits; stale merge base `a92eb996`; one tracked local edit; broad lane, do not whole-merge. |
| Operator first-user lane | `3d411f1` | 40 branch-only commits from stale base `a92eb996`; its own CI run passed, but not on this SHA. |
| Desktop control / themes | `3d05f5a` / `1e0d069` | 44 / 46 branch-only commits from stale base `a92eb996`. |
| Ghost certification | `770fd0d` | 37 branch-only commits from stale base `a92eb996`; separate overnight tip `0226ee6` is also outside. |
| Model acquisition / first-run bootstrap | `a28aac8` / `79ecbf1` | 22 / 48 branch-only commits; both worktrees have substantial uncommitted changes. |
| Packaging foundation / preflight | `07d3609` / `72053e3` | Seven / four branch-only commits from `e23aec80`; not integrated. |
| Operator control / public ops | `a05ad84` / `0292821` | 24 / 20 branch-only commits; active worktree edits remain. |
| Edge/remote operator | — | Still in the closure queue; exact tip was not revalidated during this checkpoint. |

Do not merge any of these stale-base lanes wholesale. Reconcile their necessary commits and contracts against the convergence SHA first.

## Acceptance status

### CP01–CP18

No CP01–CP18 matrix was rerun against `b0f0a72`; current-candidate operator acceptance is therefore **not established**. Last historical checkpoint:

- CP01: **PASS, 20/20**, at old SHA `8173693`.
- CP02: **PARTIAL, 11/14**; `DC-EPIPE-001` still needed operator approval/rebuild.
- CP03: **PENDING**; `/api/session` autosave approval returned 409 and `/api/lsp/open` lacked capability policy (403).
- CP04: **CLOSED** with evidence on its prior checkpoint.
- CP05–CP18: **PENDING or PARTIAL historically; not revalidated**. Do not count them as current passes.

### First-user journey

**PARTIAL evidence exists on a separate SHA only.** The operator lane records a downloaded 88,201,792-byte SmolLM2-135M GGUF with SHA-256 `c53fe6626c7165ebfd8de5db22edc3f719b813da001e662bc5cb453f2540a076`, local endpoint warmup, role assignment and a Resident response. That is useful model/Resident evidence at `3d411f1`, not the current convergence SHA and not the full clean-user install → coding objective → Veritas → Mission Receipt → restart/uninstall path.

### Mission Receipt

**Contract/projection tests pass locally; live product acceptance remains open.** The canonical route and append-only ledger exist; terminal/provenance finalization emits `MISSION_RECEIPT_READY`. The mixed-run false conclusion is fixed and covered by tests. No clean-user coding mission has yet been carried through the receipt and recovered after restart on this candidate.

### OpenCode Go → DeepSeek V4.1 Flash

**Not proven on the convergence SHA.** The provider branch contains a fixture-driven OpenCode bridge and governed subscription work, but its tip is not integrated and the branch did not provide a real DeepSeek V4.1 Flash run. The current receipt test mentions `opencode-go/deepseek-v4.1-flash` only as a handoff fixture. Historical `P03-OPENCODE-GO.json` showed routing/start HTTP 200 and delegated identity but lacked complete verification and a source SHA. No current live task, stream, Veritas result or Mission Receipt proves this path.

### Packaging and install

**Open.** Packaging branches are separate; no exact-candidate signed installer, SBOM/license/provenance record, clean Windows user install, clean-machine install, recovery or uninstall validation was run. Historical installed 0.1.0 evidence has unknown source identity and does not count as candidate acceptance.

## Harness pilot resource gate

The real local 60-completion pilot remains **BLOCKED, 0/60 completions**. Last recorded preflight, before the architecture run:

- Free physical RAM: **4.23 GiB** (required ≥7.25 GiB).
- Free commit: **1.68 GiB** (required ≥6.25 GiB).
- NVIDIA GTX 1060: 6 GiB total VRAM, 4,827 MiB free, 47°C, 6% utilization.
- No bundled `models/*.gguf` was found in the convergence checkout. A `llama-server` process was present without a listener on the expected port; ownership was not established, so it was left alone.
- Edge and user applications were left untouched; no processes were killed. Credential presence remains unknown. Re-run the resource and credential preflight before any inference; do not infer from these older measurements.

## Current release blockers

1. One clean convergence worktree and a single candidate source state do not yet exist; 41 linked worktrees remain and canonical has preserved dirty user work.
2. PR #31 is not integrated, despite its separate green verify workflow.
3. Model Access Fabric and OpenCode Go provider work need narrow stale-base reconciliation, then live DeepSeek V4.1 Flash acceptance through Covert.
4. Current-candidate CP01–CP18 and the first-user coding path have not been run.
5. Mission Receipt needs a real coding journey plus restart/recovery validation.
6. Local-model acquisition/integrity and the 60-completion harness pilot remain blocked by resource/artifact prerequisites.
7. Packaging, signing, SBOM/license/provenance, clean-user and clean-machine install, whole-product E2E/restart/uninstall remain open.
8. No GitHub CI/Veritas gate has been run for `b0f0a72`; the green check above is local only.

## Next executable work unit

Read-only reconcile the Model Manager and subscription/provider lanes against `b0f0a72`: map the exact dependencies and current route/Authority ownership for `node/src/services/opencode-bridge.ts`, `subscription-transports.ts`, `provider-connections.*`, and the Model Manager contracts/routes. Select the smallest dependency-ordered integration slice; do not merge the 48-commit provider lane wholesale. Then run the integrated adapter/Authority tests, perform credential-presence checks without exposing secrets, and execute a governed OpenCode Go → DeepSeek V4.1 Flash task that produces a current-SHA Mission Receipt and Veritas evidence. Keep the local 60-completion model pilot blocked until a fresh resource gate and model-artifact check pass.
