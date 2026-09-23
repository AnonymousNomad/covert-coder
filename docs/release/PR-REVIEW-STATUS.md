# Open pull-request disposition at the dependency baseline

Baseline: `covert-production` at
`f4da26b0b1c062dce8f3066f350f032dd3877ce4`.

| PR | Current state | Action | Reason |
| ---: | --- | --- | --- |
| #26 | green, docs-only, rebased, `REVIEW_REQUIRED` | `HUMAN_REVIEW_PENDING` | Branch protection requires an independent approval; do not self-approve or bypass. |
| #30 | green, docs-only, rebased, `REVIEW_REQUIRED` | `HUMAN_REVIEW_PENDING` | Branch protection requires an independent approval; do not self-approve or bypass. |
| #31 | required checks failing, Resident/core lane | `DO_NOT_MERGE` | Static, architecture, route-authority, artifact, and Veritas failures are recorded in `PR-31-RESIDENT-FAILURE-HANDOFF.md`. |

The three Dependabot PRs already merged into the baseline are recorded in
`DEPENDENCY-BASELINE.json`. No production branch mutation is performed by
this ledger.
