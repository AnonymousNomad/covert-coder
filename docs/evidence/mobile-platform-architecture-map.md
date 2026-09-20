# Covert Mobile Platform — RC Architecture Map

Baseline: `ddcba2fb34d3b34d93d036a9b2b921cafee3d812` (`release/v0.1-rc`)

Implementation lane: `feat/mobile-platform-v0.1` in `E:/aide-sovereign-workbench-mobile`

This is the pre-change repository map for the mobile platform slice. It records
the existing seams that the slice is allowed to use and the boundaries it must
not duplicate.

## Existing seams

| Concern | Existing source | Finding | Mobile decision |
|---|---|---|---|
| Plugin discovery/trust | `plugins/manager.mjs`, `plugins/README.md`, `node/src/routes/plugins.ts` | Manifests are validated and trusted; discovery does not execute entrypoints. Trusted execution is a separate, capability-scoped child-process path. | Register `covert.mobile-production` as a declarative first-party manifest. Its Android/Apple adapters are core-governed descriptors, not a second plugin runtime. |
| Route composition | `node/src/openapi.ts` | One `buildRoutes()` composition root creates services and spreads route families. | Add mobile/edge/concierge route families here, sharing service instances. |
| HTTP authority | `node/src/server.ts`, `node/src/services/execution-authority.mjs`, `common/security/operation-policy.mjs` | Authenticated actors use bearer credentials. Read operations receive an authority receipt; writes/executes require an exact approved operation and execution handle. | Every mutating mobile/edge/voice action uses route-owned exact descriptors and the existing execution handle. No body-supplied `approved` flag is trusted. |
| Local facade | `scripts/facade.mjs`, `common/facade-route-map.json` | User-facing port `4777` routes TS families to the internal Arch server. The route map is cached at startup. | Add `/api/mobile`, `/api/edge`, and `/api/concierge` families, regenerate the map, and restart the facade for live proof. |
| Resident/workflow | `node/src/routes/resident.ts`, `node/src/services/workflow-service.ts`, `common/contracts/resident.ts`, `common/contracts/workflow.ts` | Resident is advisory/read-only; workflow state and transitions are centralized and approval-gated. | Edge projections consume Resident/workflow state only. Edge and voice never create a parallel state store. |
| Telegram | `node/src/routes/telegram.ts`, `node/src/services/telegram.mjs`, `node/src/services/telegram-brain.mjs`, `node/src/openapi.ts` | One Telegram transport is wired to the same desktop service and authority in the composition root. | Add a shared Remote Bridge core for bounded projections and commands; keep Telegram as a transport adapter and do not move provider/orchestration logic into mobile. |
| Pairing | `common/security/authority-channel.mjs`, `node/src/routes/authority.ts`, `desktop/src/main.rs`, `desktop/stack-launcher.mjs` | Pairing proofs are short-lived, one-use, origin-bound, and exchanged for an in-memory actor credential. Tauri obtains its proof through a private native bootstrap pipe. | Edge pairing reuses this authority primitive. No new cryptography, raw credential material, or long-lived pairing secret is introduced. |
| Notifications/events | `node/src/services/notification-service.mjs`, `node/src/events.ts`, `common/contracts/notifications.ts` | Notifications are bounded, typed, and published through the existing event hub. | Edge consumes a bounded projection; it receives no raw files, Helix data, or database handles. |
| Secrets | `node/src/services/secret-store.mjs`, `common/contracts/byok.ts`, `aide-secrets-handling-protocol` | Secrets stay server-side and are not returned by status routes. | Mobile artifact status contains only signing-profile references and configured/valid booleans. |
| Desktop shell | `desktop/tauri.conf.json`, `desktop/src/main.rs` | Tauri v2 is configured for desktop; native pairing and managed stack lifecycle are desktop-specific. | Add no desktop redesign. Mobile remains a client contract and bounded plugin surface; Apple builds are executor-bound. |
| Release evidence | `release/package-manifest.json`, `release/desktop-build-status.json`, `release/RELEASE_CHECKLIST.md` | Existing release data is primarily model/desktop preflight and contains pending entries. | Add a generated artifact manifest that emits only observed files, hashes, and certification state. |
| UI extension surface | `browser/src/services/registry.ts`, typed cockpit panels, existing plugin panel | The service registry is lifecycle-only; plugin manifests are declarative and current contributions reveal governed cockpit features. | Add one bounded Android Production panel and expose it through existing panel selection; do not add a permanent navigation system. |

## Shared control-plane invariant

```text
Covert Edge / Telegram / Cipher Voice
        -> authenticated actor session
        -> Remote Bridge core
        -> Resident / workflow projection or approved command
        -> Execution Authority
        -> Harness / Workstation resource
```

The remote layer must never expose a raw PTY, arbitrary filesystem path,
arbitrary localhost route, model authority, signing secret, or provider
credential. A voice transcript is input data, not an authority grant.

## Proof boundaries at the RC

- Android toolchain/device/build proof is not present in the RC repository.
- Tauri Android/iOS targets are not present in the RC desktop configuration.
- The host process listens on loopback by default, so internet reachability is
  not claimed by the mobile foundation. Same-network/paired transport remains a
  future executor/transport deployment concern.
- No custom wake word, Android assistant role, Siri replacement, or App Intent
  implementation is present in the RC.

The implementation must preserve these as explicit `MISSING`, `UNAVAILABLE`, or
`EXPERIMENTAL` states until live evidence exists.
