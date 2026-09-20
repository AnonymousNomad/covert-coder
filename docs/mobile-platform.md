# Covert Mobile Platform foundation

This slice keeps one Workstation governance spine and adds bounded mobile
clients/adapters around it.

## Implemented contract

`covert.mobile-production` is a first-party declarative plugin manifest. It has
no entrypoint and requests only `ui.view` and `command.register`. The backend
adapter exposes structured Android and Apple operations through the existing
Execution Authority. It does not add a Harness, memory store, provider brain,
filesystem API, or arbitrary shell command.

Android operations are:

- environment status;
- native Gradle/Tauri v2 project inspection;
- device inventory;
- debug APK build;
- artifact inspection and SHA-256 hashing;
- bounded install, launch, stop, and Logcat operations.

Build evidence is staged as `BUILD_PASSED`, `ARTIFACT_FOUND`, `HASHED`,
`INSTALL_PASSED`, `PACKAGE_PRESENT`, `LAUNCH_REQUEST_PASSED`, and
`RUNTIME_EVIDENCE_OBSERVED`. A successful Gradle exit never implies runtime
verification.

Apple inspection covers Swift Package, SwiftUI source, and conservative Xcode
project/workspace metadata. Xcode-dependent actions return
`UNAVAILABLE — MACOS/XCODE REQUIRED` off macOS. The build contract accepts a
future paired Mac, governed macOS runner, or other explicitly configured
executor without hard-coding one provider.

## Covert Edge and Cipher Voice

`mobile/edge/remote-bridge-client.ts` is the client foundation for Android and
iOS. Its session token is memory-only. It exposes only status, bounded command,
voice capability, and voice command routes. It has no terminal, arbitrary file,
raw database, model runtime, or unrestricted localhost API surface.

The server-side Remote Bridge projects the existing Resident, workflow,
TaskService, model status, notification, and verification facts. The same
TaskService instance feeds both `/api/tasks` and the Edge projection. Telegram
remains the existing transport adapter in this slice; the bridge extraction
seam is present without moving provider/orchestration logic into a second
transport owner.

Cipher Voice uses the same bridge and authority policy. Read commands may be
hands-free; mutating/high-risk commands require the normal confirmation path.
Push-to-talk is a capability contract. Custom hotword and always-listening
authority are explicitly unavailable. Android widget/quick-action and Apple
App Intent/Siri integrations are platform adapter targets, not claims of live
implementation.

## Release and Concierge

`release-manifest.json` is generated from artifacts that exist locally. Each
entry contains size, SHA-256, signing/certification state, requirements, and a
reference. File presence never upgrades signing or certification. Concierge
returns only deterministic `certification_state=certified` matches; otherwise
it returns an empty result and limitations.

The supported GitHub integration choice is a static README/Pages-linked
Concierge first. GitHub's supported surfaces do not imply arbitrary custom
chat injection into a normal repository page. A future GitHub App can be added
in a separate explicitly authorized online lane with minimum repository
permissions and selected webhooks; it must not become a second Covert control
plane or bypass Workstation authority.

## Current proof boundary

The live Windows detector observed the Android SDK root but no JDK, adb,
build-tools, Android platforms, global Gradle, Android Studio, or physical
device. Therefore no real APK, install, launch, or runtime evidence is claimed
from this worktree. The hermetic battery proves fixture parsing, staged hashing,
fail-closed device behavior, authority pairing reuse, Edge projection, voice
policy, and Concierge selection. A real Covert Edge APK remains the next proof
boundary once a legitimate Android project/toolchain/device is available.
