---
name: failure-runtime-test-auth-store-override
description: Prevent shared test-helper defaults from shadowing injected runtime credential stores.
---

# Runtime Test Credential-Store Override

## Finding

The auth test fixture always supplied an explicit null-token provider. That helper default took precedence over an injected credential-store reader, so the production fallback provider was never exercised and the slot assertion failed.

## Recovery

1. Inspect the effective options object after helper defaults and per-test overrides are merged.
2. Add the no-token test default only when the test did not inject either a token provider or credential store.
3. Assert both the requested credential slot and the emitted bearer header, while keeping the token out of status/errors.
4. Rerun the focused strict typecheck and the deterministic runtime contract suite.
