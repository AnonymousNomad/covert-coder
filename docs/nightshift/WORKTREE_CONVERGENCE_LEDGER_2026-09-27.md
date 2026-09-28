# Covert Worktree Convergence Ledger — 2026-09-27

Status: ACTIVE RELEASE-CONVERGENCE CONTROL RECORD

Canonical integration lane:
- Worktree: `E:\covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- Current HEAD: `c2b8a70ac4e7a69a9865aae97a66a74e05e5f8a3`
- Current state: DIRTY — harness-comparison / production-closure work must be checkpointed before integration merges.

Protected Resident lane:
- PR #31 remote head: `b79d2480498e446cff36b26dd4b4faef7745726b`
- GitHub required CI: GREEN.
- Local `resident/marathon-h1` worktree is dirty with unrelated post-PR closure work.
- Rule: freeze PR #31 at `b79d248`; do not commit unrelated local dirty work onto that PR.

Already contained in the convergence lineage:
- `audit/wiring-ledger`
- `feat/harness-vnext-h3`
- `fix/authority-chat-contract-v1`
- `fix/v1-mission-cancellation`
- `fix/v1-p0-atomic-persistence`
- `fix/v1-p0-egress-local-only`
- `fix/v1-p0-route-drift`
- `fix/v1-resource-admission-gate`
- `nightshift/workspace-trust-c4-01`
- `release/source-assembly`
- `research/local-runtime-bakeoff`

Worktree retirement completed this audit:
- Removed clean merged worktree `E:\aide-sovereign-workbench-audit`; branch preserved.
- Removed clean merged worktree `E:\aide-sovereign-workbench-harness`; branch preserved.
- Stopped bulk retirement after those two to avoid unnecessary Windows dependency-tree deletion cost.
- No branches were deleted. No resets, forced removals, or history rewrites were performed.

Known superseding branch relationships:
- `feat/v1-theme-system` contains `feat/covert-desktop-control-v1` and is 2 commits ahead; integrate the theme branch rather than both.
- `feat/covert-packaging-foundation-v1` contains `audit/covert-packaging-preflight` and is 3 commits ahead; do not integrate the preflight lane separately.
- `release/subscription-provider-certification` contains `release/provider-handoff-gate-v0.1` and is 13 commits ahead.
- `feat/covert-universal-intelligence-v1` history contains Model Manager MM9 evidence tip `d80d184` plus later onboarding/provider work; treat it as the primary Model Manager/onboarding candidate unless diff review disproves this.
- `release/operator-convergence-luna-overnight` diverges from the desktop/theme lineage and requires explicit reconciliation; do not assume it is superseded.

Priority reconciliation candidates not yet in convergence:
1. PR #31 Resident integration `b79d248`.
2. `feat/covert-universal-intelligence-v1` — Model Manager + unified onboarding/provider setup.
3. `release/subscription-provider-certification` — subscription/OpenCode transport.
4. `feat/v1-theme-system` — includes desktop-control lineage; theme/presentation stays behind functional gates.
5. `feat/ghost-real-task-certification-v1`.
6. `fix/context-control-canonical-path` — one unique commit; verify whether PR #31/newer context work supersedes it before integrating.
7. `feat/covert-packaging-foundation-v1`.
8. `feat/v1-public-ops`.
9. Remote/Edge/Companion closure after extracting current dirty work from the protected PR #31 worktree.
10. Public-site convergence after release-critical lanes are stable.

Hard rule: no integration merge into a dirty convergence worktree. First checkpoint and verify the current harness-comparison changes, then integrate one lane at a time with gates between waves.
