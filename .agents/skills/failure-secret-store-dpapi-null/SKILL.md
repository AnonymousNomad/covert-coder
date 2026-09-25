---
name: failure-secret-store-dpapi-null
description: Investigate a Windows secret-store round trip where DPAPI protection succeeds but unprotection is surfaced as null, without confusing an unchanged baseline failure with a UI regression.
---

# DPAPI Round-Trip Null

## Instructions

1. Run only `node --test tests/unit/test-secret-store.mjs`; preserve the complete test summary and failing assertion.
2. Record the current HEAD and compare both `tests/unit/test-secret-store.mjs` and `node/src/services/secret-store.mjs` to that checkpoint before assigning ownership.
3. Inspect the DPAPI helper and process boundary without printing credential values. `getKey()` intentionally catches unprotect errors and returns `null`, so `null` is a failure, not proof of an empty entry.
4. If the failing inputs and implementation are unchanged from the accepted starting checkpoint, classify the result as a baseline/environment issue with root cause unresolved. Preserve evidence and do not modify secret-store semantics in an unrelated UI lane.
5. Change DPAPI behavior only in its owning security lane after a reproduced, diagnosed defect and authorized scope. Then rerun the isolated test and the complete secret-store suite.

## Guard

Never log real credentials, DPAPI plaintext, ciphertext, or secret-bearing environment values while diagnosing this failure.
