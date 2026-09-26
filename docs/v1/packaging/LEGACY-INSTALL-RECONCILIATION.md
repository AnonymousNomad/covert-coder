# Legacy AIDE / Covert Install Reconciliation

Run: 2026-09-26, preflight hold E:\aide-covert-legacy-migration-hold\20260926-pre-uninstall

## Result

The stale per-user AIDE Sovereign Workbench 0.1.0 installation was removed through its registered NSIS uninstaller after the operator confirmed the uninstall prompt. Windows removed the executable, uninstall registration, Desktop shortcut, and Start Menu shortcut. The installed UI generation was identified as the old design by the operator.

The former install directory remains with two empty directories, models and plugins. Their contents were checked recursively and both are empty. An exact nonrecursive cleanup command was rejected by the automatic command policy before execution. No alternate deletion route was attempted. The empty residue is classified and retained.

## Legacy installation identity

| Field | Finding |
|---|---|
| Display name / product | AIDE Sovereign Workbench |
| Version | 0.1.0 |
| Publisher | ferrellsyntheticintelligence |
| Install directory | E:\pip_temp\opencode\covert-install-p4 |
| Executable | aide-sovereign-workbench.exe |
| Executable SHA-256 | A6AFFA7A34A9CB926D2038C55E7EE436EB16176E793F36C3823F8EEAA0CC73A5 |
| Executable signature | Not signed |
| AppUserModelID | org.ferrellsyntheticintelligence.aide |
| Provenance | Unknown installed build; binary is not tied to a source commit |
| UI generation | Old AIDE-era UI, confirmed visually by the operator |

The Desktop shortcut supplied by the operator was C:\Users\Grey_\OneDrive\Desktop\AIDE Sovereign Workbench.lnk. Before uninstall, it resolved to the executable above. The Start Menu shortcut resolved to the same executable. Both shortcuts reported AppUserModelID org.ferrellsyntheticintelligence.aide.

The per-user uninstall entry was at HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\AIDE Sovereign Workbench. Its registered command was the exact path E:\pip_temp\opencode\covert-install-p4\uninstall.exe. That binary contained an NSIS marker and was not signed. The operator completed its confirmation prompt. The uninstaller exit code was not captured.

## State preservation

Before uninstall, the app was asked to close normally by its exact PID 9056. Its sidecar listeners stopped; after the bounded wait, the app and its original child process identities were gone. No force termination was used.

The install-local .aide directory was moved intact to:

E:\aide-covert-legacy-migration-hold\20260926-pre-uninstall\legacy-install-aide

It contains 11 files totaling 3,958,590 bytes. File names, sizes, and timestamps are recorded in the external safety snapshot; file contents were not read or hashed. The tree included session/state, index, and log files that may contain project or sensitive material. No credential payload was exported.

The snapshot is:

E:\aide-covert-legacy-migration-hold\20260926-pre-uninstall\safety-snapshot.json

SHA-256:

DEAA5581151A06125DFCECC053432EF7589FAB56DF08D5914E2577D075E72130

The shared WebView profile at C:\Users\Grey_\AppData\Local\org.ferrellsyntheticintelligence.aide\EBWebView existed before and after uninstall. It was not opened, copied, migrated, or deleted. DPAPI and operating-system credential stores were not inspected.

The current development state at E:\aide-sovereign-workbench\.aide remained present with the same metadata baseline: 105 files and 127,701,934 bytes before and after uninstall. File contents were not read.

## Post-uninstall references and processes

Verified absent after uninstall:

- HKCU uninstall registration for AIDE Sovereign Workbench
- Desktop shortcut named AIDE Sovereign Workbench
- Start Menu shortcut named AIDE Sovereign Workbench
- App Paths registrations for aide-sovereign-workbench.exe
- matching AppX package, service, and Run-key startup entry
- legacy executable, uninstaller, and .aide under the old install directory
- listeners on ports 4777, 4778, and 4779
- processes matching the old executable and the recorded original process-tree identities

No matching taskbar shortcut was found in the known pinned-shortcut folder before uninstall. The disabled scheduled task aide-stack remains; its action points to E:\aide-sovereign-workbench and is not part of the removed installation, so it was preserved. No taskbar registry pin inspection or unrelated startup inventory was performed.

## Remaining install-directory residue

E:\pip_temp\opencode\covert-install-p4 remains and contains only two empty, non-reparse directories: models and plugins. No files remain. The attempt to remove those empty directories was blocked by automatic command policy before execution. They are preserved as classified empty installer residue pending operator disposition.

## Current development candidate

The separately owned Desktop Control worktree contains a distinct release executable:

- Worktree: E:\aide-desktop-control-v1
- Branch: feat/covert-desktop-control-v1
- HEAD observed: 3e4cf1aa5df4e92c061e9b6a461d08931d9a244d
- Worktree: dirty and owned by its active worker
- Candidate executable: E:\aide-desktop-control-v1\desktop\target\release\aide-sovereign-workbench.exe
- Candidate SHA-256: 155BEFF62C8AA4F56C6CD10CEA9D1B33A6218E62AB9ACB3E04295C02867E47CF
- Candidate file version and product name: 0.1.0 / AIDE Sovereign Workbench
- Candidate launch command from source: npm run desktop:dev

The candidate hash differs from the removed binary. Its source relationship is only path-associated because the worktree is dirty and the binary does not embed a source SHA. It was not launched in this cleanup lane. The operator has reported that the current design is newer; this session did not re-verify its UI.

The current source configuration still uses product name AIDE Sovereign Workbench and identifier org.ferrellsyntheticintelligence.aide. This cleanup did not change product identity, upgrade identity, the shared WebView profile, or the current application. A canonical Covert package identity and explicit upgrade identity remain packaging decisions.

## Lane and scope

- Cleanup worktree: E:\aide-covert-legacy-cleanup
- Branch: fix/v1-legacy-install-reconciliation
- Starting SHA: 07d360953cda54f547a9ace71aa22f5368c3128e
- Provider work paused cleanly at d80d18445b475d2ae2f6987b16cbb047224b2c5e; no provider changes were made.
- Desktop Control, Packaging Foundation, P0 Release Closure, and current development state were not modified.
- No replacement app was installed and no new shortcut was created.

This reconciliation does not qualify a Covert installer, migration, package identity, fresh-user install, or clean-machine install.
