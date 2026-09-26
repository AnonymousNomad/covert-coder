# Covert packaging and installed-application truth

This is a read-only preflight on the clean release source snapshot at e23aec80cd05ab0c237eba793421bb5e7. It is not a release qualification and does not authorize modifying or replacing the installed AIDE application.

## Current source build truth

| Area | Observed source truth | Status |
|---|---|---|
| Desktop technology | Tauri v2 Rust shell, WebView2 UI, bundled Node sidecar | PRESENT |
| Entry point | desktop/src/main.rs | PRESENT |
| Development | npm run desktop:dev | PRESENT |
| Preparation | npm run desktop:prepare | PRESENT |
| Build | npm run desktop:build | PRESENT |
| Bundle config | desktop/tauri.conf.json; targets all; resources/**/*; icons/icon.png and icons/icon.ico | PRESENT |
| Product identity | AIDE Sovereign Workbench | PRESENT, does not yet represent a distinct packaged Covert identity |
| Application ID | org.ferrellsyntheticintelligence.aide | PRESENT; shared with installed app and active development |
| Version | package.json 0.1.0-preflight; Cargo.toml and Tauri config 0.1.0 | DIVERGENT |
| Installer source | Tauri bundler configuration; no separate checked-in installer source identified | PARTIAL |
| Installed package type | HKCU uninstall registration and uninstaller.exe; inferred NSIS-style | UNVERIFIED |
| Update | no updater configuration or signed update metadata identified | MISSING |

The clean frozen source describes startup that waits for required local resources, sidecar pairing, and facade health before creating the window. Missing required resource errors reach a fatal path. Ports are fixed. GGUF model weights are optional in the preparation flow. Therefore the source does not yet demonstrate the required degraded startup contract for absent runtime, missing models, unavailable providers, absent credentials, malformed optional cache, or a missing project.

The installed app has no model or llama-server and points to a missing runtime path. The existing install log reports a port bind collision. Historical hangs are verified, but their direct cause was not established.

## Branding pipeline

The installed executable icon and frozen source desktop icons use the colorful A/I-style mark. The Start Menu and Desktop shortcuts point to the executable using its default icon; Apps & Features points to that executable through DisplayIcon. Tauri bundle icons are desktop/icons/icon.svg, desktop/icons/icon.png, and desktop/icons/icon.ico. Runtime window/taskbar rendering and installer artwork were not separately verified because a safe fresh launch or original installer artifact was unavailable.

docs/assets/branding/covert-coder-emblem.png is documented as a reference/crop and is not wired into the application bundle. Repository documentation still identifies a canonical emblem asset as required. Result: **BRANDING INPUT REQUIRED**. No new artwork was created.

## Installation architecture

Observed facts:

- The uninstall registration is per-user under HKCU. Default installation scope, elevation requirements, and install directory policy are unverified.
- The observed install is under E:\pip_temp\opencode\covert-install-p4.
- Mutable .aide workspace/index/log state is inside that installation directory.
- The WebView profile is under user AppData and shared by the application identifier.
- No product service or scheduled task was found.
- Source includes sidecar process-tree cleanup, but lifecycle behavior was not safely rerun.
- No single-instance contract was found.
- The local runtime's Administrator requirements are separate from the normal Covert application installer contract.

Required before release: explicitly define per-user versus machine-wide installation, elevation, stable install location, upgrade/downgrade/repair/rollback/uninstall/reinstall, shortcut replacement, duplicate install prevention, single-instance behavior, background helper ownership, credential retention/removal, and project/state migration or preservation. Prevent uninstall or upgrade from silently deleting user projects or shared profile state.

## First-user contract

A prepared procedure is in [Covert first-user acceptance](COVERT-FIRST-USER-ACCEPTANCE.md). It requires a new standard Windows user profile and is not satisfied by another terminal in the existing profile. The installed profile contains shared WebView state, so it is not suitable as a clean-user acceptance profile.

## Clean-machine contract

A clean Windows VM or machine remains separate from first-user acceptance. It must verify the supported Windows version, normal-user installation, prerequisites, installer authenticity, first launch, current UI and branding, provider setup, local-runtime setup route, project workflow, update authenticity, rollback, repair, uninstall, reinstall, and removal of stale legacy identity. No clean-machine run was performed in this preflight.

## Release integrity

| Control | Status | Evidence |
|---|---|---|
| Version source | PARTIAL | package.json and Cargo/Tauri versions differ |
| Artifact naming | PRESENT + UNVERIFIED | CI names platform artifacts; no installed hash binding |
| Checksums | PARTIAL | manifest script exists; no verified manifest for installed package |
| Code/installer signing | MISSING | installed executable and uninstaller are unsigned |
| SBOM | MISSING | none found in clean source snapshot |
| Dependency scanning | MISSING | none found in clean source snapshot |
| License inventory | PARTIAL | model metadata exists; dependency/license review incomplete |
| Release provenance | PARTIAL | manifest tooling exists; installed binary is not tied to a source commit/artifact record |
| Update authenticity | MISSING | no signed update metadata or updater configuration identified |
| Release notes | PARTIAL | no notes tied to the installed executable hash |

The desktop CI workflow builds and smoke-tests Windows artifacts and runs a lifecycle probe in CI. That does not establish first-user profile isolation, clean-machine installation, rollback, state migration, or authenticity of this installed binary.

Evidence is in [packaging source inventory](../../../artifacts/packaging-preflight/20260925T-packaging-preflight/packaging-source-inventory.json) and [asset inventory](../../../artifacts/packaging-preflight/20260925T-packaging-preflight/asset-inventory.json). This audit did not install tools, launch the app, modify packaging source, or change the installed application.