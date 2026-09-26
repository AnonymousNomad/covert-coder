# C4-04 — Model Hub Token-Bearing Egress

Status: **CLOSED** at implementation checkpoint `108d4fd599a48c488a69aee3a5741f928b40fd0e`, with Local-Only denial evidence added at `bae1e091410a00b6929bf6c7f3c26bedf65c3399`.

## Reproduction

At implementation base `d0d4e40a92de3e1aafcd6675a748bef3f5f2537e`, `GET /api/modelhub/files?repo_id=org%2Fmodel-1` had no route-owned operation descriptor. `common/security/operation-policy.mjs` classified it as `capability.read`; `ArchServer` automatically prepared read operations and executed them without an approval decision. The service then built the Hugging Face URL, attached the configured bearer header, and called its fetch transport.

The defect was reproduced with an `ArchServer` and a fake fetch transport. The observed Authority operation had `kind=capability.read`, `risk=read`, and `state=approved`. The request returned 200 from the fake endpoint and the fake transport observed an Authorization header. No live provider was contacted; the fake credential value was not included in logs or evidence.

Relevant paths at the reproduction checkpoint:

- `node/src/routes/modelhub.ts` — route had no `describeOperation`.
- `common/security/operation-policy.mjs` — route mapped to `capability.read`.
- `node/src/server.ts` — `read` operations were automatically prepared and dispatched.
- `node/src/services/modelhub.mjs` — the Hugging Face request attached the optional vaulted bearer header before fetch.

## Change

`GET /api/modelhub/files` now derives a route-owned `capability.external` operation from the validated `repo_id`. The route was removed from the central read map so route-authority coverage has exactly one owner. The descriptor contains no credential or caller-controlled URL. Authority approval binds the selected repository identity; a different route or changed target cannot reuse that approval.

Local model/file reads that do not contact a provider remain read-class operations. The existing modelhub downloads-list read remains unchanged.

## Verification

Using deterministic local fixtures only:

- No exact approval: request denied before fake fetch.
- Search-route approval replayed against files: rejected before fake fetch.
- Exact files approval: request succeeds and the fake transport observes the bearer header.
- The server log contains no fake credential value.
- Existing local/non-egress downloads listing remains covered by the modelhub route suite.
- Modelhub route tests: 8/8 pass.
- Accepted chat Authority contract/security tests: 6/6 pass.
- Route-authority coverage: 236 routes, 0 conflicts, 0 unclassified.
- `tsc -p tsconfig.node.json --noEmit`: pass.
- `git diff --check`: pass.

The broader Local-Only egress inventory is recorded in `C4-02-LOCAL-ONLY-EGRESS.md`; its remaining process-level and owner-handoff gaps do not reopen this route-specific C4-04 closure.

## Closure evidence

The C4-02 checkpoint proves that Local-Only blocks this token-bearing model-hub route at Authority preparation and again at transport after credential resolution. The fake provider receives zero requests on denial, the egress journal remains unchanged, malformed policy state fails closed, and the local downloads-list read remains available. A test with an unavailable credential source issues only an anonymous public metadata request; no Authorization header is attached and neither the fake credential sentinel nor credential-error detail is logged.

Result: the original C4-04 defect is closed. This does **not** close the broader C4-02 Local-Only gap; see `C4-02-LOCAL-ONLY-EGRESS.md`.
