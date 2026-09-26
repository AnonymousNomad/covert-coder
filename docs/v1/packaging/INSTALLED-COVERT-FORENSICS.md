# Installed Covert application forensics

Run: 20260925T-packaging-preflight
Audit base: release/source-assembly at e23aec80cd05ab0c237eba793421bb5e7c5a57e7

## Finding

The installed item is registered as **AIDE Sovereign Workbench**, version **0.1.0**, and runs from:

- Executable: E:\pip_temp\opencode\covert-install-p4\aide-sovereign-workbench.exe
- Product version: 0.1.0
- File version: 0.1.0.0
- Tauri identifier: org.ferrellsyntheticintelligence.aide
- Executable SHA-256: A6AFFA7A34A9CB926D2038C55E7EE436EB16176E793F36C3823F8EEAA0CC73A5
- Publisher metadata: ferrellsyntheticintelligence
- Authenticode: unsigned

The publisher string is metadata, not proof of publisher identity. The install path name includes “covert-install-p4” but does not establish the source generation or build pipeline. One bundled launcher file matches the clean release source snapshot by SHA-256; that component match does not identify the complete executable or installer. The proper classification is **UNKNOWN INSTALLED COVERT BUILD**.

## Registration and identity surfaces

A per-user uninstall entry exists under HKCU for AIDE Sovereign Workbench. It has an uninstall.exe command, no recorded install date/source, NoModify and NoRepair set, and no quiet uninstall command. No matching AppX/MSIX package, execution alias, product-specific service, or product-specific scheduled task was observed. Start Menu and Desktop shortcuts point to the installed executable and use its default icon. A taskbar pin was not found.

An NSIS-style uninstall layout is inferred from the executable and registry arrangement. The original installer artifact is unavailable, so the installer technology is not proven.

## State ownership and preservation

The install directory contains a mutable .aide tree with datasets, exports, index, logs, and cipher-state metadata. It is classified **UNIQUE TO LEGACY INSTALL** based on its location. Only names, counts, and file metadata were examined; state payloads were not displayed, parsed, or copied.

The WebView user data folder is:

C:\Users\Grey_\AppData\Local\org.ferrellsyntheticintelligence.aide\EBWebView

It contains filenames for History, Login Data, Web Data, Cookies, Preferences, and Local State. The databases and profile payloads were not opened. The installed app and current development use the same Tauri identifier, and no custom data directory was found in the audited Tauri configuration. Tauri documents the identifier as participating in system paths; Microsoft documents WebView2 user data folders as holding browser profile information such as cookies, permissions, and caches. This makes the profile **SHARED WITH CURRENT DEVELOPMENT** and potentially sensitive. It has not been touched or deleted.

The installed workspace and model path point into the install tree. The .aide state lives beneath that tree, so replacing or uninstalling the application could affect mutable user state unless packaging explicitly preserves or migrates it. There is no root runtime directory, no llama-server, no GGUF file, and the models and plugins directories are empty.

## Startup failure evidence

Historical Windows Application Hang 1002 and Windows Error Reporting 1001 AppHangB1 records reference the exact installed executable on September 20 and 21, 2026. A further AppHangTransient report was recorded on September 25, without a correlated Application Hang event in the collected records.

Existing logs under the install-local .aide\logs directory show that the facade failed to bind 127.0.0.1:4777 with EADDRINUSE. The spawn record points to fixed ports 4777, 4778, and 4779 and to an install-root runtime/llama-server.exe that is absent. At audit time, those ports belonged to Node processes from the protected Desktop Control worktree.

These findings establish historical hangs and concrete launch configuration defects. They do **not** prove that the port collision or missing model runtime caused each historical hang. No fresh launch was attempted because that would reuse the shared WebView profile and collide with protected processes. No new state was written, and no process was stopped.

Collected historical evidence lacks the fresh attempt's start time, parent/child process tree, window identity, exit code, fault module, .NET/runtime error, and event-to-log causal correlation. Failure classification: **STARTUP BOOTSTRAP DEFECT** is evidenced by the fixed-port bind failure; the cause of the observed hang remains **UNKNOWN**.

## Evidence

See [installed inventory](../../../artifacts/packaging-preflight/20260925T-packaging-preflight/installed-inventory.json), [startup evidence](../../../artifacts/packaging-preflight/20260925T-packaging-preflight/startup-failure-evidence.json), and [evidence README](../../../artifacts/packaging-preflight/20260925T-packaging-preflight/README.md).

Reference documentation: [Tauri configuration](https://v2.tauri.app/reference/config/#identifier) and [Microsoft WebView2 user data folders](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/user-data-folder).