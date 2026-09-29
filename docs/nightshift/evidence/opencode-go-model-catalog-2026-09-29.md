# OpenCode Go catalog discovery through Model Access — 2026-09-29

## Bounded integration

One `opencode-managed` connection now exposes multiple model references discovered from the managed local OpenCode server's `GET /provider` catalog. The operator invokes discovery explicitly from Settings Connections through an Authority-governed `POST /api/connections/discover` operation. Passive Connections and Model Access reads never start the CLI or probe a provider. The bridge returns only safe OpenCode Go model IDs and a connected flag; it does not return auth material, model metadata, or server paths.

The discovered references flow through the existing Connections projection into Model Access. Catalog presence and OpenCode's connected flag do not mark any exact model `VERIFIED` or make a route available. The existing exact provider/model test, consent, Local-Only preference, Authority, and external egress gates remain in force. Discovery does not create a session or dispatch a prompt. A rediscovery clears prior short-lived exact support so a catalog change cannot silently retain route eligibility.

## Local verification and limits

- Focused bridge, Connections route, and Model Access tests: 29 passed, 0 failed. Fixture coverage includes multiple models under one Go provider, model ID filtering, no session/prompt during catalog read, passive read behavior, exact route remaining `UNKNOWN`, Authority approval and replay rejection.
- The final catalog input-filter tightening was followed by a Model Access retest: 12 passed, 0 failed.
- Node and browser TypeScript checks and scoped ESLint passed. Frontend production build passed. C1-02 route ownership artifacts were regenerated and their `--check` passed. `git diff --check` passed.
- No real OpenCode Go authentication, catalog, model inference, spend ceiling, or provider routing was verified in this checkpoint. The live provider/model path remains `UNKNOWN` until operator-managed auth and bounded spend policy are available and the exact model test passes.
