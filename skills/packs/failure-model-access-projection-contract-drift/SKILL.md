---
name: failure-model-access-projection-contract-drift
description: Diagnose Model Access and Model Manager projection failures caused by strict response shape drift, stale state assertions, or confusing connection health with per-model support. Use when focused model-access tests fail, `/api/models/manager` returns a response-contract error, or configured credentials are reported as verified.
---

# Model Access Projection Contract Drift

## When to use

Use this procedure when Model Access tests report any of these symptoms:

- `ModelManagerResponse.parse` rejects an unexpected discovery or internal field.
- A connection test expects configured credentials to mean `connected`.
- A runtime fixture uses stale enum casing or expects a state that contradicts the current schema.
- A healthy provider connection marks every listed model route available.
- A read projection touches credential values, probes a provider, writes selection state, or performs execution.

## Procedure

1. Read the current `common/contracts/connections.ts` and `common/contracts/model-access.ts` schemas before changing implementation or assertions.
2. Compare the exact failing value with its producer. Keep internal discovery entries and filesystem details out of the public snapshot; return only the strict `ModelManagerResponse` shape.
3. Preserve lifecycle distinctions: a stored credential is `configured_not_verified` until provider authentication is observed; authentication health does not prove an exact model route works; runtime discovery does not prove an artifact is qualified; qualification does not imply the model is loaded or selected.
4. Keep the GET path passive. Assert zero secret reads, zero provider executions, zero preference writes, and no Authority mutation descriptors.
5. Keep selection scope and precedence descriptive while persistence and routing mutation remain disabled.
6. Update stale fixtures only when the current contract deliberately changed. Assert the new exact state and retain a negative case; never broaden a schema or weaken a regression assertion to make the test green.
7. Run the focused Model Access and connection tests, then Node TypeScript, affected route/secret checks, and the required architecture gate. Preserve exact failures and counts.

## Required negative cases

- Provider health without exact per-model support must not mark that model route available.
- Local-Only policy must leave external routes unavailable.
- Credential contents and machine paths must not appear in any public projection.
- Read-only inventory must not start, stop, select, probe, or execute a model/provider.
- Artifact presence and runtime discovery must not produce `READY` without current qualification evidence.

## Observed failure pattern

An interrupted Model Access foundation run returned five focused failures: stale connection assertions, an enum-case expectation inconsistent with the uppercase schema, a consent-state expectation inconsistent with missing consent, and a strict snapshot rejection because internal discovery entries were returned as public response fields. Confirm the current branch and exact test output before assuming the same causes.
