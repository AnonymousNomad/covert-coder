# Production dependency reconciliation

The frozen `covert-production` dependency baseline is commit
`f4da26b0b1c062dce8f3066f350f032dd3877ce4`.

| Package | Resolved production version | Source |
| --- | ---: | --- |
| `zod` | `4.6.5` | Dependabot PR #28, merge `2ab607bb88454980866170baa4cae46edc61d04e` |
| `@types/node` | `26.6.1` | Dependabot PR #29, merge `d1ec478f7246d9e9e462b9acb228ef5e1d34eea9` |
| `@playwright/test` | `1.63.0` | Dependabot PR #27, merge `f4da26b0b1c062dce8f3066f350f032dd3877ce4` |
| `playwright` | `1.63.0` | lockfile resolution |
| `playwright-core` | `1.63.0` | lockfile resolution |

`package-lock.json` SHA-256 at this baseline is
`0C11388E7F114D5BCEECE57BF78AF3C11B3CCBAA42BFFFD166D6E58F267E9A8D`.

Candidate certification uses the read-only command below. It compares both
the declared package ranges and lockfile resolutions; it does not rebase,
rewrite, or repair the candidate.

```powershell
node scripts/release-dependency-reconcile.mjs `
  --production <covert-production-worktree> `
  --candidate <immutable-candidate-worktree> `
  --json-out dependency-reconciliation.json
```

The checker fails closed with these classifications:

- `MISSING_PRODUCTION_MERGE` — a required production dependency is absent or its direct declaration is older.
- `OLDER_DEPENDENCY` — the candidate resolves below the production baseline.
- `LOCKFILE_DIVERGENCE` — package manifest and lockfile disagree or a required resolution is absent.
- `UNEXPECTED_VERSION` — the candidate resolves newer than the frozen baseline and needs explicit compatibility evidence.

The current production push AIDE CI result is green (`35866125477`). The
separate Dependabot update workflow still reports a `glib` resolution advisory;
that is tracked in `GLIB-TAURI-ADVISORY-REVIEW.md` and is not silently treated
as a clean audit.
