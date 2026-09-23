# Certified dependency baseline

The certified source release is pinned to candidate
`dc0d30ee226e7ff822592e3a800f064b4441b7af` and its exact lockfile SHA-256 is:

`5E5DB8EC50247E517EF54F8521DA33502407F46E2E71AB79FC346B8B7A22AD6A`

The candidate contains:

| Package | Certified version |
| --- | ---: |
| `zod` | `4.6.2` |
| `@types/node` | `26.5.1` |
| `@playwright/test` | `1.62.1` |
| `playwright` | `1.62.1` |
| `playwright-core` | `1.62.1` |

The discrepancy with the earlier maintenance report is resolved by ancestry:
the candidate is based at public merge-base
`a92eb996d438ba433916a886d3d1de084c71dd4f`. PRs #28, #29, and #27 were later
merged into `covert-production`, ending at
`f4da26b0b1c062dce8f3066f350f032dd3877ce4`. Those merges are not ancestors of
the candidate and are therefore not silently represented as candidate content.

If the newer production dependency baseline is desired for the public release,
it requires a new candidate and a new certification. The certified candidate is
not rewritten to make the histories look alike.
