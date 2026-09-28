---
name: failure-model-manager-facade-map-omission
description: Repair route-authority and route-drift failures when a newly registered typed endpoint is present in OpenAPI but missing from the generated method-aware facade map and its ownership evidence.
---

# Typed Route Missing From the Facade Map

## Trigger

Use when a newly added typed route causes any of these failures:

- `FACADE_TYPED_OWNERSHIP ... matches=0` in `route-authority-coverage.test.ts`.
- `route-drift.test.ts` says the committed facade map omits a runtime registration.
- `build-facade-map.mjs --check` reports generated map drift.
- C1-02 route-ownership decision artifacts no longer match current registrations.

## Root cause

The typed route registration and generated OpenAPI are current, but the committed facade ownership map and downstream route inventory still describe the previous route set. A route is not publicly reachable through the façade until the map is regenerated.

## Repair

1. Confirm the route has a strict response contract, a typed registration, and an entry in generated OpenAPI.
2. Run `npm run contracts` after route and contract edits.
3. Run `node scripts/build-facade-map.mjs` to regenerate method-aware ownership from typed registrations, OpenAPI, and reviewed exceptions. Do not hand-edit generated route entries or add migration waivers to hide a new route.
4. Run `node scripts/build-c1-02-route-ownership-decisions.mjs` to refresh the derived current-route inventory. Preserve its frozen baseline reproduction and pinned decision assertions unless independent evidence requires changing them.
5. Verify `route-authority-coverage.test.ts`, all `route-drift.test.ts` cases, `npm run contracts`, and `git diff --check`.
6. Inspect the generated diff. The new operation must target the typed server with `PUBLIC_TYPED`; unknown paths must continue to fail closed.

Do not restart a shared running façade as part of an offline source-level repair. Live façade verification requires identifying and restarting only the process owned by the current checkout.
