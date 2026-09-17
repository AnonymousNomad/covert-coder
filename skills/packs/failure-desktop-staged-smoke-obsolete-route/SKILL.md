---
name: failure-desktop-staged-smoke-obsolete-route
description: Repair packaged-stack smoke failures caused by probing a facade prefix that has no canonical route. Use when /api/models returns 404 while /api/models/status is the registered contract.
---

# Desktop Staged Smoke Obsolete Route

## Procedure

1. Confirm the failing response is a truthful `404 NOT_FOUND`, not a staging or facade transport failure.
2. Check the shared OpenAPI contract, route implementation, facade map, and current acceptance journey.
3. Update the smoke probe to a registered canonical route only when all authorities agree.
4. Preserve the response-shape assertion; adapt it to the registered route contract rather than accepting arbitrary JSON.
5. Rerun the complete staged stack smoke and verify its ports and processes are gone.

## Guardrail

Do not add a production route solely to satisfy an obsolete smoke test. A facade prefix establishes ownership; it does not prove that the bare prefix is itself a route.
