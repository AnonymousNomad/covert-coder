# OpenCode Go catalog discovery through Model Access — 2026-09-29

## Bounded integration

One `opencode-managed` connection now exposes multiple model references discovered from the managed local OpenCode server's `GET /provider` catalog. The operator invokes discovery explicitly from Settings Connections through an Authority-governed `POST /api/connections/discover` operation. Passive Connections and Model Access reads never start the CLI or probe a provider. The bridge returns only safe OpenCode Go model IDs and a connected flag; it does not return auth material, model metadata, or server paths.

The discovered references flow through the existing Connections projection into Model Access. Catalog presence and OpenCode's connected flag do not mark any exact model `VERIFIED` or make a route available. The existing exact provider/model test, consent, Local-Only preference, Authority, and external egress gates remain in force. Discovery does not create a session or dispatch a prompt. A rediscovery clears prior short-lived exact support so a catalog change cannot silently retain route eligibility.

## Local verification and limits

- Focused bridge, Connections route, and Model Access tests: 29 passed, 0 failed. Fixture coverage includes multiple models under one Go provider, model ID filtering, no session/prompt during catalog read, passive read behavior, exact route remaining `UNKNOWN`, Authority approval and replay rejection.
- The final catalog input-filter tightening was followed by a Model Access retest: 12 passed, 0 failed.
- Node and browser TypeScript checks and scoped ESLint passed. Frontend production build passed. C1-02 route ownership artifacts were regenerated and their `--check` passed. `git diff --check` passed.
- No real OpenCode Go authentication, catalog, model inference, spend ceiling, or provider routing was verified in this checkpoint. The live provider/model path remains `UNKNOWN` until operator-managed auth and bounded spend policy are available and the exact model test passes.

## Exact-SHA CI regression and bounded repair

The first source checkpoint `ab0c268eac2d595a5c2abb13f9ff919a56f52be2` failed AIDE CI `36605861876` in the architecture gate. The three failures all traced to one omitted generated artifact: `common/facade-route-map.json` lacked the new exact `POST /api/connections/discover` owner. The route authority coverage, route drift, and committed facade map reproduction checks correctly rejected that mismatch. The Veritas compile gate also failed because it exercised the same architecture suite; its other reported checks passed. The frontend, backend/integration, and typecheck/lint CI steps had passed.

Running `node scripts/build-facade-map.mjs` added the typed-server owner. Regenerating C1-02 ownership evidence changed its typed registration count from 238 to 239, matching the 239 OpenAPI operations. Both generators' `--check` passed. The three previously failing ownership assertions passed together (3/3). A broader local route-drift invocation also hit a separate 60-second supervised facade probe timeout on this host; it was interrupted after that failure, so it is not counted as a passing local full-suite run. The exact repair still requires its own CI result.
