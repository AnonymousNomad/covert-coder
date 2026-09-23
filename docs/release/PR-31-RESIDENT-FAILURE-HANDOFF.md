# PR #31 failure handoff

Status at the current production baseline:

```text
PR: 31
EVIDENCE SNAPSHOT HEAD: 2ec17dac593194bd55f8e3296c9c3b61330071f3
BASE: covert-production @ f4da26b0b1c062dce8f3066f350f032dd3877ce4
REVIEW: required
MERGE STATE: behind / not mergeable for release
RECOMMENDATION: DO NOT MERGE
```

The PR later moved to head `1d0d454a15ebcb0b47a25cfeda1293e42df895eb`
while its required checks were still in progress. That moving head is not
silently substituted for this captured failure evidence; DeepSeek #2 must
requalify the exact new SHA before any release decision.

Both required AIDE CI checks failed. The failure is not explained by the
recent npm dependency baseline; it is concentrated in Resident/core contracts
and required artifacts.

## First useful failures

### TypeScript/static

- Missing declarations for Resident MJS modules: `resident-awareness-provider.mjs`, `resident-sops.mjs`, `resident-containment.mjs`, `resident-envelope.mjs`, `resident-arsenal.mjs`, and `resident-arsenal-query.mjs`.
- Resulting implicit-any parameter errors.
- `ChatRouteOptions` rejects the supplied `governance` property.

Classification: `CORE_CONTRACT / RESIDENT_LANE`, not a Luna release-tool repair.

### Architecture

- Required `experiments/resident-awareness/results/arsenal-projection.json` is absent.
- Containment checks report missing artifact, ungoverned dirty output, bounded-regeneration mismatch, stream-parity failure, and missing static `governAnswer` route wiring.
- Model-router route-for-role/route-for-id/chat-fallback assertions fail.
- `POST /api/chat` and `POST /api/chat/stream` remain unclassified by route-authority coverage.

Classification: `RESIDENT_SEMANTICS / AUTHORITY_ROUTE / ARTIFACT`.

### Veritas

Veritas compilation failed while the ordinary tests were not sufficient to
establish the required canonical proof path.

## Gate summary

```text
install=success
frontend=success
backend_tests=success
static=failure
architecture=failure
veritas=failure
worktree=success
cleanup=success
```

This handoff is evidence for DeepSeek #2. It does not propose repairs, weaken
gates, or authorize a rebase/merge.
