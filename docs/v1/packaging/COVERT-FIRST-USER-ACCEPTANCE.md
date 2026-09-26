# Covert first-user and clean-machine acceptance contract

Status: procedure prepared; not executed. Do not use the operator's existing Windows profile as a substitute.

## First-user acceptance profile

Create or use a new standard Windows user only when the acceptance run is explicitly scheduled. The profile must have no old Covert/AIDE AppData, configuration, credentials, caches, project history, or legacy shortcuts. Do not delete the current operator profile to approximate a clean test.

Record Windows version, account type, installer filename/hash/signature, install scope, timestamps, and process ownership. Keep the normal application install separate from local Unsloth/runtime Administrator qualification.

## Acceptance sequence

1. Verify installer hash, signature/publisher, source provenance, supported Windows version, and documented prerequisites.
2. Install as a standard user using the declared install scope. Record the install directory, registry identity, package identity, and shortcuts.
3. Launch. Verify the current Covert identity and UI, then complete first-run onboarding. Confirm a missing local runtime produces a truthful NOT CONFIGURED or UNAVAILABLE state without a crash and exposes the documented configuration path.
4. Confirm no-model state is truthful and model configuration remains available.
5. Confirm an unavailable external provider and absent provider credentials are reported without preventing shell startup.
6. Confirm malformed optional cache is either safely recovered or refused without silent corruption.
7. Open or create a workspace using the supported flow. Verify project data is placed outside a replaceable application directory unless an explicit documented design says otherwise.
8. Open Settings and System Health. Verify each reports the actual configured state.
9. Close the app and verify exact owned process cleanup. Reopen and verify only intended preferences/workspace state persists.
10. Exercise update and repair only with a signed, provenance-verified candidate. Verify version, data preservation, shortcut replacement, and rollback behavior.
11. Uninstall. Record exactly which binaries, shortcuts, credentials, WebView state, configuration, and project data are removed or retained. Require explicit product policy for each.
12. Reinstall. Verify stale identity is absent, retained user data follows policy, and first-run or migration behavior is truthful.
13. Capture final process, listener, registry, shortcut, and state inventory. Verify no orphan owned process remains.

Each result must be tied to exact installer and source hashes. A CI lifecycle test is useful but does not substitute for this profile-based procedure.

## Separate clean-machine acceptance

Use a disposable clean Windows VM or machine after first-user acceptance. Prove:

- Supported Windows version and normal-user setup.
- Required prerequisites and installer authenticity.
- Installation and first launch without pre-existing app state.
- Current application identity, UI, and icon.
- Provider configuration, local-runtime setup path, and workspace workflow.
- Update authenticity, rollback, repair, uninstall, and reinstall.
- No stale legacy AIDE/Covert identity or duplicate shortcuts remain.

This clean-machine qualification has not been run. It is separate from first-user acceptance.