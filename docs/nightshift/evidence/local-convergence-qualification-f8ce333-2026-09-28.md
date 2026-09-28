# Local convergence qualification checkpoint - 2026-09-28

## Source and boundary

- Repository: `AnonymousNomad/covert-coder`
- Worktree: `E:/covert-nightshift-integration`
- Branch: `nightshift/production-convergence-20260926`
- Tested source SHA: `f8ce333762b95d084fcf44e37646bccc64814a94`
- At test start/end: tracked and staged diffs empty; branch was 19 commits ahead of the historical upstream `origin/fix/v1-p0-route-drift`.
- PR #31 remains protected at `b79d2480498e446cff36b26dd4b4faef7745726b`; no PR #31 changes were made.
- Runtime: NEURO-MIRROR, Windows, Node `v26.4.0`.

## Verification on the tested source SHA

| Command | Result |
|---|---|
| `npm run check:arch` | PASS; TypeScript node and browser projects passed; ESLint had 0 errors and 62 warnings; architecture battery: 787 total, 776 passed, 0 failed, 11 skipped; runtime 593.46 s. |
| `npm run contracts` | PASS; OpenAPI generated with 237 operations; `git diff --exit-code -- common/openapi.json` returned 0. |
| `npm run build:frontend` | PASS; 1,415 modules transformed; Vite build completed in 4.88 s. Warning: main JS chunk 4,504.61 kB (1,155.53 kB gzip), above Vite's 500 kB advisory. |
| `node harness/test-veritas.mjs` | PASS; `veritas test passed`. |
| `node scripts/acceptance-p0.mjs` | PASS; supervised local stack exercised pairing, governed file write, LSP start/stop and denied document sync, terminal, task approval, Git stage/commit, model status, fail-closed BYOK, denied unapproved agent start, session persistence and restart recovery. |
| Six `node --check` checks matching the syntax stage of `npm run check` | PASS: app, daemon, orchestrator, checks, Veritas, and Veritas CLI. |
| `git diff --check`, tracked diff and index checks | PASS; no tracked or staged changes after verification. |

## Focused Telegram and Authority repair

- `node scripts/telegram-battery.mjs`: 5 passed, 0 failed, 0 skipped.
- `node --test tests/arch/execution-authority.test.ts tests/arch/telegram-egress.test.mjs tests/arch/capability-authority.test.ts`: 28 passed, 0 failed, 0 skipped.
- `npx tsc -p tsconfig.node.json --noEmit`: exit 0.
- `npx eslint scripts/telegram-battery.mjs node/src/services/telegram.mjs node/src/routes/telegram.ts`: exit 0.
- These focused checks ran against the exact test content committed as `0f3aa24`; subsequent commit `f8ce333` only records evidence classification.

## Evidence limits and remaining gates

- The desktop row at `2026-09-28T13:10:10.205Z` is preserved as one focused generated harness result. Its exact historical argv/filter is unknown; it is not a full Desktop Control battery or product-runtime acceptance. See `desktop-battery-row-classification-2026-09-28.md`.
- This checkpoint proves local architecture/build/P0 acceptance only. It does not prove live provider or OpenCode Go inference, full first-user acceptance, CP01-CP18, browser/pairing E2E, packaged installation, clean-machine installation, or release acceptance.
- The convergence branch has not yet been pushed. GitHub CI for the convergence SHA remains pending.
