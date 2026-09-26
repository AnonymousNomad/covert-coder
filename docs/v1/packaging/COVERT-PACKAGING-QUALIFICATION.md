# Covert packaging qualification apparatus

Status: qualification tooling and contracts are being prepared on feat/covert-packaging-foundation-v1. This is not an application or installer qualification.

## Current source snapshot

The desktop application is a Tauri v2 Rust shell with a WebView2 frontend and bundled Node sidecar. Product identity remains AIDE Sovereign Workbench with identifier org.ferrellsyntheticintelligence.aide. package.json, Cargo.toml, and tauri.conf.json contain version values that diverge. No canonical version owner is established, so the version gate must return BLOCKED — VERSION OWNER UNRESOLVED until product/release ownership is decided.

Tauri bundle.targets is all. On Windows, the configured Tauri targets include NSIS and MSI/WiX formats; the existence of config is not proof that either candidate was built. There is no explicit bundle.windows configuration or wix.upgradeCode. Tauri’s current defaults are documented in the official [Windows installer guide](https://v2.tauri.app/distribute/windows-installer/) and [bundle configuration reference](https://v2.tauri.app/reference/config/#bundleconfig): NSIS defaults to current-user scope, MSI/WiX defaults to per-machine scope, and WebView2 uses the download bootstrapper unless configured otherwise. These defaults must be revalidated against the selected Tauri version and produced artifact.

The repository’s configured PNG/ICO assets match the known A/I-style AIDE identity hashes from preflight. desktop/icons/icon.svg is another stale AIDE source candidate but is not configured as a Tauri bundle icon. docs/assets/branding/covert-coder-emblem.png is a visual reference, not an approved packaged Covert logo. Canonical branding remains BRANDING INPUT REQUIRED. The later pipeline should consume one operator-approved canonical source, generate the platform variants, and verify every generated hash and consumer mapping; no artwork is created or replaced in this lane.

## Installer and version ownership

The frozen preflight observed a per-user HKCU uninstall entry and an NSIS-style uninstaller layout, inferred from metadata because the original installer was unavailable. That evidence describes the historical installation only. Current source sets Tauri targets to all, which selects the Windows NSIS and MSI/WiX formats when built; no candidate artifact was produced in this lane. Tauri’s current Windows guide says its default NSIS install is for the current user and needs no Administrator privilege; setting NSIS installMode to perMachine or both changes that behavior. The current WiX configuration has no per-user setting in Tauri; the current source implementation issue records MSI as per-machine. Verify scope from the actual produced artifact before release. [Tauri Windows installer guide](https://v2.tauri.app/distribute/windows-installer/), [Tauri WiX per-user scope issue](https://github.com/tauri-apps/tauri/issues/13792).

The default WebView2 install mode is downloadBootstrapper and may require internet if the runtime is not already present. No Windows installer configuration is present to select an embedded/offline/fixed runtime. Do not infer repair support, upgrade identity, or uninstall data retention from a successful bundle build.

The package.json version is 0.1.0-preflight, while Cargo.toml and tauri.conf.json are 0.1.0. Cargo version labels the Rust package; the Tauri version supplies the desktop bundle/application version; package.json is used by Node package tooling and existing release scripts. No release-owned mapping declares which value is canonical for a Covert release or how prerelease metadata should flow. The version gate reads docs/v1/packaging/VERSION-OWNER.json when a release owner approves one. That file is not present, so the gate blocks rather than treating Rust and app versions as interchangeable or normalizing the three values. The policy must map every source as canonical, exactly-derived, or independent with a rationale. A blocked or mismatched version command exits nonzero for qualification/CI.

## Commands

From the repository root:

- node scripts/packaging/qualification.mjs identity
- node scripts/packaging/qualification.mjs version
- node scripts/packaging/qualification.mjs branding
- powershell -NoProfile -File scripts/packaging/port-preflight.ps1
- node scripts/packaging/startup-probe.mjs --target <absolute-executable> --args-json <json-array> --timeout-ms <bounded-ms> --ports 4777,4778,4779
- node scripts/packaging/qualification.mjs manifest-create --dir <artifact-directory> --out <outside-directory>/manifest.json --source-sha <caller-supplied-sha> --build-version <caller-supplied-version> --product-identity <caller-supplied-identity>
- node scripts/packaging/qualification.mjs manifest-verify --dir <artifact-directory> --manifest <manifest.json>
- node --test scripts/packaging/test-qualification.mjs

The startup probe requires an absolute target. It never uses a shell. It discards process output and records byte counts, avoiding accidental secret capture. On Windows its cleanup helper proves the launched executable path, launch time, and process ancestry, then stops only those exact PIDs and verifies exit. If ownership cannot be established, the tree cleanup reports unverified/refused. It does not terminate a listener found by the port probe.

The first-user preflight is read-only and must only be run inside the exact new standard-user profile being tested. It checks only explicit state paths, matching shortcut names, the selected installer hash, and the current user’s effective administrator role. It creates no user and installs nothing.

## Package identity and version status vocabulary

- PASS: the requested fixture/candidate assertion was deterministically satisfied.
- FAIL: a configured input is missing, contradictory, unsafe, or hash-mismatched.
- PRESENT + UNVERIFIED: the source declares a value, but no built artifact or external proof establishes it.
- NOT CONFIGURED: no corresponding setting was found in the inspected source.
- BLOCKED — VERSION OWNER UNRESOLVED: source values exist, but no canonical owner or consumer mapping is approved.

The identity validator reports configured values without normalizing them. Its derived executable filename comes from the Cargo package name unless an explicit binary target is later found. Publisher text is not code-signing identity. A generated Wix upgradeCode is not equivalent to an explicit stable identity. Under Tauri’s current config rules, a missing upgradeCode is derived from the productName, so changing the displayed product name can change Windows upgrade identity unless a release-approved stable code is configured. [Tauri bundle configuration reference](https://v2.tauri.app/reference/config/#wixconfig).

## Fixture battery

The fixture tests cover:

| Fixture | Expected result |
|---|---|
| Matching package/display identity and aligned versions | PASS |
| Divergent versions with an unresolved owner | BLOCKED |
| Divergent versions with a supplied owner | FAIL |
| Independently managed source version with an approved rationale | PASS without equality comparison |
| Unresolved version owner at CLI boundary | Nonzero exit |
| Missing configured icon | FAIL |
| Known AIDE icon hash | FAIL as stale identity |
| Two different assets assigned to one identity surface | FAIL as conflicting surface asset |
| Stale configured branding at CLI boundary | Nonzero exit |
| Listening fixture port | listening=true with PID/path metadata where available |
| Free fixture port | listening=false |
| Same-name/process-path association without an owned lease | remains UNKNOWN or PATH ASSOCIATION ONLY |
| Normal process fixture | exit 0, no timeout |
| Fast-crash fixture | exact nonzero exit recorded |
| Hung fixture | bounded timeout and owned-root cleanup |
| Foreign same-name Node fixture | remains alive after target cleanup |
| Owned child process fixture | exact process-tree cleanup on Windows |
| Valid artifact manifest | PASS |
| Tampered artifact bytes | FAIL — ARTIFACT MISMATCH |

Every fixture result is classified PASS, FAIL, or INVALID. INVALID means the apparatus could not produce a trustworthy result; it is not a product failure. The current test suite emits a machine-readable count and case list. Product acceptance remains NOT RUN.

## Failure battery contract

| Case | Expected detection and owner | User-visible result | Startup continues? | Acceptance |
|---|---|---|---|---|
| Port occupied | Bootstrap supervisor identifies exact listener/process evidence | Specific startup conflict | No external request; shell gives recovery path | No unrelated listener receives pairing or API traffic |
| Runtime missing | Runtime state service | RUNTIME_NOT_CONFIGURED / UNAVAILABLE | Yes | Shell and configuration path work |
| Runtime path invalid | Runtime validator | RUNTIME_UNAVAILABLE with exact repair guidance | Yes | No silent fallback |
| Provider unavailable | Provider adapter | Provider unavailable | Yes | Shell remains usable |
| Credentials absent | Credential owner | NOT CONFIGURED | Yes | No authentication crash |
| Optional cache malformed | Cache owner/migration layer | Recovered with backup or safely refused | Yes where optional | Original bytes retained |
| WebView state stale/corrupt | Tauri profile owner | Isolated/recoverable profile error | Yes where possible | No silent database overwrite |
| Install directory read-only | Installer/state owner | State storage unavailable with safe path guidance | Yes only if external state works | No mutable-state write into bundle |
| User-state path unavailable | State owner | Explicit state unavailable | Product shell policy decides; never corrupt install | No fallback into install tree |
| Sidecar exits or hangs | Tauri parent and owned supervisor | Bounded startup failure | No | Exact owned tree stopped; foreign process survives |
| Desktop shell exits | Windows process owner | Closed | N/A | Exact owned child tree stops |
| Version mismatch | Release validator | Release blocked | N/A | Canonical owner and version are bound |
| Duplicate/legacy install | Installer identity owner | Clear upgrade/side-by-side choice | N/A | No accidental second product |
| Invalid update signature | Updater verifier | Update rejected | Existing version remains | No replacement before verification |
| Disk space insufficient | Installer | Clear failure and rollback | N/A | Existing data/build remains intact |
| Normal-user install | Installer | Declared scope and truthful privilege result | Yes if supported | No unnecessary elevation |
| Uninstall with user data | State lifecycle owner | Retention choice/result shown | N/A | Projects follow explicit policy |

No complete product failure battery was run in this foundation lane.

## Prepared evidence and limits

Machine-readable source findings and fixture results are stored under artifacts/packaging-foundation/<run-id>/. They identify this foundation lane’s source checkpoint and are not bound to a future Desktop Control candidate.

No Tauri build, install, launch of the frozen legacy application, clean-user test, clean-machine VM test, update, repair, uninstall, migration, or signature test was performed here. Active Desktop Control remains independently owned. These documents prepare later qualification; they do not close product packaging.
