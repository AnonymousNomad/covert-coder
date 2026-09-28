---
name: covert-fresh-user-release-audit
description: Test a Covert Windows release as a clean new user from installer through onboarding, model discovery/download, Resident coding, restart and uninstall. Use before public release, when the setup wizard or packaged sidecar fails, or when source-checkout smoke tests have been mistaken for install proof.
---

# Covert clean-user release audit

Read `AGENTS.md`, `aide-onboarding-walkthrough`,
`aide-model-hub-acquisition`, `aide-model-task-recommender`,
`aide-packaging-offline`, `aide-distribution-packaging` and
`aide-release-engineering`. Their old AIDE names, model counts and endpoints
are historical guidance; first reconcile against the current Covert build.

## Research and purpose

Tauri's official Windows installer guide distinguishes NSIS/MSI artifacts and
WebView2 offline installation. A source-tree dev server cannot prove those
bundle/runtime assumptions:
https://v2.tauri.app/distribute/windows-installer/
Hugging Face documents revisioned file downloads, cache and Hub metadata.
Search results do not certify a local model artifact:
https://huggingface.co/docs/hub/api
https://huggingface.co/docs/hub/models-downloading
GitHub artifact attestations can bind a binary to a build, complementing its
SHA-256; neither replaces the installed application's behavior test:
https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations

## Preparation and isolation

1. Build at a recorded clean SHA using the current supported release command.
   Record installer path, hash, size, runtime/model manifests and signing state.
2. Use a disposable VM or truly fresh Windows user profile without a Covert
   checkout, developer Node dependencies, prior settings, secret store or
   existing Covert services. Identify unrelated processes before cleanup.
3. Keep the exact artifact fixed. Keep an installation transcript with time,
   screenshot/log, screen name, observed API state, user action, failure and
   repro steps; scrub credentials.
## Journey to replay

1. Download/copy, validate checksum, install, launch and pair the packaged app.
   Verify sidecar identity, port ownership, health and no hidden dev dependency.
2. Follow the wizard as a novice: workspace, privacy, model/provider option,
   automatic workflow setup and resumable walkthrough. Test skip and back once.
3. Choose a recommended model with real fit/source data, explicitly consent
   to Hugging Face search/download, inspect gated/license/file/size information,
   verify the downloaded file/hash and load it. If network is blocked, use a
   separately verified offline model pack and record the blocked online route.
4. Start a first bounded Resident coding task. Review approval, actual edits,
   diagnostics, terminal output and independent task verifier; save work.
5. Restart and confirm workspace, model selection, Resident state and evidence
   persist without secrets surfacing. Test stop/cancel, repair or reinstall, and
   uninstall while preserving user data according to the product contract.
6. Repeat the promise of offline mode with network disconnected; do not claim
   a download works offline. Observe any unexpected egress.
## Risk, pause and release decision matrix

| Observation | Decision |
|---|---|
| Installer absent, unsigned against a signed-release claim, or SHA mismatch | Stop release; repair build/provenance and retest fixed artifact. |
| Only a developer checkout or preconfigured profile is available | Record source smoke only; fresh-user release gate remains open. |
| Sidecar cannot launch, port owner is unknown, or app needs global Node | Stop; capture logs/process tree, repair packaging. |
| Wizard skips required consent or task runs from untrusted workspace | Stop; treat as security blocker. |
| Model is a descriptor only, corrupt, wrong architecture or unverified | Stop model path; never label it ready. |
| Hugging Face unreachable, gated, rate limited or disk insufficient | Show recoverable state; log precise environmental blocker. |
| Resident reports success with failing independent verifier | Release-blocking false success; retain trace and repair. |
| Uninstall erases project data or leaves owned executable processes | Stop release; reproduce in a fresh profile. |

Threats include carrying over developer credentials, downloader path traversal,
malicious model-card prompt injection, silent egress, false model readiness,
stale listeners, destructive uninstall and an installer/UI source mismatch.
Exercise each boundary through product behavior and an adversarial fixture.

Exit with artifact SHA, clean-profile transcript, installer and first coding
journey, reconnect/restart/uninstall checks, blocked paths, exact failures and
supportable release scope. Never count source tests as install acceptance.
