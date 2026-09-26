# Covert installation state and migration contract

Status: inventory and requirements only. No state was read, copied, migrated, or deleted in this lane.

## Observed state ownership

The installed-app preflight inspected names and metadata only. It found an install-root .aide tree containing datasets, exports, index, logs, and cipher-state.jsonl. It did not open payloads. It also found the WebView2 profile under the current Tauri identifier in the operator’s Local AppData. That profile is shared with current development and may contain cookies, history, saved login data, and browser preferences; its payload was not read.

The current packaged shell sets AIDE_WORKSPACE to Tauri resource_dir. Backend services then place application and project state beneath WORKSPACE/.aide, and default model files beneath resource_dir/models. The source includes session, settings, onboarding, task/workflow, replay, memory, project index, telemetry/log, provenance, desktop-grant, provider-host, and model-engine state beneath workspace/.aide. This is mutable data in a replaceable installation/resource tree.

Credential paths are distinct:

- node/src/services/credentials.ts stores DPAPI-protected provider credentials at workspace/.aide/credentials.dpapi. Windows DPAPI uses CurrentUser scope.
- node/src/openapi.ts creates a provider secret store at the current OS home directory’s .aide/secrets.json. The secret-store implementation protects values with DPAPI by default. Its optional plaintext fallback exists only when AIDE_ALLOW_PLAINTEXT_SECRETS=1; this preflight did not inspect that environment value or any credential payload.
- Historical Telegram configuration is under workspace/.aide/telegram/config.json and may contain a DPAPI-protected token representation. Payloads were not inspected.

Project source files belong to their selected workspace. The current packaged shell’s default workspace is resource_dir, so it does not currently establish a safe external project-data root by default. Exact state location depends on runtime environment and was not migrated.

## State inventory and lifecycle policy required for V1

| Class | Current locations evidenced | Update / repair | Uninstall | Sensitivity / reconstruction |
|---|---|---|---|---|
| User data and application preferences | resource_dir/.aide/settings.json and other service-specific .aide state | Preserve; migrate atomically if location changes | Explicit operator/product choice; never silently delete | User-owned; some reconstructible, some not |
| Project data | Workspace directories and indexes below WORKSPACE/.aide | Preserve exactly; indexes may be rebuilt only after backup | Preserve by default outside install root | Source data is user-owned; index/cache is reconstructible |
| Credential data | workspace/.aide/credentials.dpapi; user-home/.aide/secrets.json; Telegram config | Preserve only through an explicit same-user, format-aware migration | Require explicit credential-retention/removal policy | Sensitive; DPAPI CurrentUser scope prevents casual cross-user migration |
| Database / structured state | cipher-state JSONL, replay/session/community/workflow and service files under .aide | Versioned migration with pre-migration backup and rollback | Preserve or remove only by explicit policy | Mixed user data and reconstructible service state |
| Configuration | settings, provider-host allowlist, provider manifests and environment overrides | Preserve user choices; do not carry machine-specific paths blindly | Explicit | May contain private endpoints or encrypted credential references |
| Cache / index | index files, model status caches, frontend/WebView caches | Rebuild only after integrity check and retaining original | May be removed if explicitly documented | Reconstructible only when source data is preserved |
| WebView profile | %LOCALAPPDATA%/<Tauri identifier>/EBWebView | Preserve only if identity is intentionally retained; otherwise create an isolated profile | Explicitly decide; never infer from install removal | Sensitive browser and session data; not safely mergeable |
| Logs / telemetry | resource_dir/.aide/logs, metrics, egress logs | Rotate/preserve under retention policy | Explicit retention policy; scrub secrets | May contain sensitive project data |
| Temporary data | Not fully inventoried | Remove only when owned, bounded, and no longer active | Remove only exact owned temporary files | Reconstructible |
| Install artifacts | application, resources, uninstaller, shortcuts | Replace through signed upgrade identity; never store mutable user state here | Remove exact registered product artifacts | Reinstallable; must be provenance-bound |

Lifecycle behavior for update, repair, rollback, uninstall, and reinstall is not established by source-only evidence. No product policy should be inferred from the presence of an uninstaller.

## Tauri identifier decision

**Option A — retain org.ferrellsyntheticintelligence.aide.** Existing WebView and AppData identity remain in place. This can preserve the current profile relationship but continues the AIDE identity and can make the legacy installation, current development, and release share browser state. Rollback and duplicate-install behavior remain coupled to existing identity. No profile migration is needed, but isolation is not achieved.

**Option B — change to an approved canonical Covert identifier.** Tauri creates a new AppData/WebView location. The old profile remains separate and should not be copied automatically. This improves product identity isolation but can create a second Windows product unless package upgrade identity is held stable deliberately. Credentials and WebView sessions require explicit migration decisions; DPAPI credential data must remain under the same Windows user and be tested without exposing values. Rollback returns to an older identity and must not overwrite the new profile.

Changing productName may also change Tauri’s derived MSI/WiX upgradeCode. No explicit wix.upgradeCode is configured. Therefore an identity or product-name decision must be accompanied by a stable, explicitly approved installer upgrade identity before release.

No canonical Covert name, identifier, or approved logo package is supplied in this lane. **OPERATOR / RELEASE DECISION REQUIRED.** Do not change the current identifier here.

## Migration requirements

1. Keep the frozen legacy installation untouched as evidence.
2. Move mutable user/project state outside the replaceable application directory before shipping upgrades.
3. Use a versioned migration manifest that lists exact source, destination, state class, sensitivity, hash, and disposition. Never copy WebView databases or credentials implicitly.
4. Take a restorable backup before mutation; migrations must be idempotent and interruption-safe.
5. Keep projects by default on uninstall. Make credential deletion/retention an explicit consented choice.
6. Test same-user DPAPI decrypt after migration using a synthetic credential; never record or log plaintext.
7. Test rollback and reinstall with the legacy identity present, including shortcut, uninstall registration, and duplicate-install outcomes.
8. Verify state hashes or schema-level invariants after migration; never claim migration success from a successful installer exit alone.
