# Covert first-user qualification preflight

Status: checklist and read-only script prepared; no Windows account was created, no app was installed, and no operator profile was scanned.

## Required test identity

Run the preflight from the exact fresh standard Windows account that will execute the acceptance. A second terminal under the operator’s existing user is not a first-user test. Do not create this account until the acceptance run is separately scheduled.

Provide the candidate’s exact installer path and SHA-256, source commit, version, approved display name, and approved Tauri identifier. The current product identity/version owner is unresolved, so no acceptance should proceed until those values are approved and the version gate passes.

Example, run only inside that designated test profile:

    powershell -NoProfile -File scripts/packaging/first-user-preflight.ps1 -UserProfilePath $env:USERPROFILE -ExpectedProductName '<approved product name>' -ExpectedIdentifier '<approved identifier>' -InstallerPath '<candidate installer path>' -ExpectedInstallerSha256 '<64 hex characters>' -CandidateSha '<candidate commit>' -CandidateVersion '<candidate version>'

The command is read-only. It verifies the running account matches the supplied profile, checks effective Administrator membership, hashes the installer, inspects only three exact expected state paths, and searches only Desktop/Start Menu shortcut names containing Covert or AIDE Sovereign Workbench. It checks uninstall registrations by reading only DisplayName, DisplayVersion, and InstallLocation, then returns only entries whose display name matches Covert, AIDE Sovereign Workbench, or the supplied expected product name. It does not inspect state payloads or unrelated user files. Profile cleanliness is not proven if the account/path does not match.

## Acceptance sequence

1. Record Windows version/build, account type, machine class, installer filename/hash/signature, candidate SHA/version, approved product identity, install scope, and prerequisites.
2. Confirm the read-only first-user preflight reports a matching current profile, standard-user status, no prior Covert/AIDE state at the expected paths, no legacy shortcut, and the supplied installer hash matches.
3. Install using the declared per-user or machine scope. Record install location, registry identity, package identity, WebView2 deployment, shortcuts, and elevation behavior.
4. Launch and verify current Covert product/UI/icon identity. Complete onboarding.
5. Verify missing Runtime is truthful and nonfatal; verify missing model, unavailable provider, absent credentials, and malformed optional cache behavior.
6. Open or create a workspace and verify project files live outside the replaceable install directory.
7. Open Settings and System Health and record actual state.
8. Close and reopen; verify process cleanup and only intended state persists.
9. Run signed update and repair cases when those features exist. Verify version, data preservation, shortcut replacement, and rollback.
10. Uninstall and record exact binaries, shortcuts, credentials, WebView profile, configuration, and project data retained or removed.
11. Reinstall and prove stale identity, duplicate shortcuts, and unintended shared state are absent.
12. Capture final process/listener/registry/shortcut/state evidence and verify zero orphan owned processes.

First-user acceptance is separate from clean-machine acceptance and from the Tauri CI lifecycle smoke test.
