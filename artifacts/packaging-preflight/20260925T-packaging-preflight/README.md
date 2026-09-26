# Packaging preflight evidence

Run ID: 20260925T-packaging-preflight

This directory contains a bounded metadata capture for the installed AIDE/Covert application, historical startup evidence, source and asset inventory, and the extracted executable icon.

The capture excludes unrelated scheduled tasks and processes. User-state payloads and WebView databases were not displayed, parsed, or copied. No credentials are included.

The installed app was not launched, modified, uninstalled, repaired, or replaced. AppData was not deleted. No protected worktree or process was modified.

Historical Application Hang and Windows Error Reporting events, along with existing install-local logs, establish prior hangs and a port-bind failure. They do not prove one causal chain. A fresh launch was not attempted because the application shares its WebView profile identifier with current development and its fixed ports are held by the protected Desktop Control process.

Files:
- installed-inventory.json
- startup-failure-evidence.json
- asset-inventory.json
- packaging-source-inventory.json
- installed-executable-icon.png

Hashes are recorded in the JSON evidence and recomputed during final validation.