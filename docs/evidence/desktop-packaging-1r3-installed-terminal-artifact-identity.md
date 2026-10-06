# Desktop Packaging 1R3 — Installed Terminal and Artifact Identity

Date: 2026-10-06

Worktree: E:\covert-desktop-dogfood-20261006

Branch: codex/desktop-dogfood-integrated-20261006

## Checkpoint and scope

Starting HEAD: 7ef211c815cae9010659da83ce0e5fd249ab6cb5. The worktree was clean before this evidence note. The implementation source remains commit 5e9b993350dd8045043434455423320c7d37fa8c; subsequent commits through the starting HEAD contain evidence documentation only. The NSIS installer was built from the clean implementation tree recorded in the 1R2 evidence.

The configured origin is https://github.com/AnonymousNomad/covert-coder.git. This branch has no upstream and no local origin tracking ref. No fetch or remote request was made under repository rule R9, so origin parity is UNKNOWN.

This slice is limited to the installed terminal route, installer executable identity, and the already-known Monaco/DOMPurify release blocker. No product or dependency code was changed.

## Resource gate

Fresh sample at 2026-10-06 13:59:46 CDT:

- Available physical RAM: 2,769,592,320 bytes.
- Required floor: 3,221,225,472 bytes.
- Result: RESOURCE-GATE — BLOCKED.

No installed application, terminal, or post-restart session was launched in this slice. The runtime portion stopped at the gate. No foreign or protected process was terminated, the pagefile was not changed, and protected PIDs 13116 and 24024 were not touched. The stalled 7-Zip listing process owned by this probe was interrupted. Supported operator pairing was not established, so no product terminal route was attempted or bypassed.

The earlier base install/launch/shutdown and standalone packaged-resource PTY evidence remains as recorded in desktop-packaging-1r2-runtime-hardening.md. That evidence does not establish the installed product terminal route or the mandatory second session after restart.

## Artifact identity

| Boundary | Path | Size | SHA-256 |
|---|---|---:|---|
| Raw Tauri release executable | E:\covert-desktop-dogfood-20261006\desktop\target\release\aide-sovereign-workbench.exe | 11,761,152 | A39F824A479E133260944063DBD748F8E3930A3952B49DBE1385433C24CC5CB2 |
| NSIS installer | E:\covert-desktop-dogfood-20261006\desktop\target\release\bundle\nsis\Covert Coder_0.1.0_x64-setup.exe | 36,843,073 | D3C6E5DAD94D0A0CD01B143BD6FCD8251B3D700E66B3D65E41570BA36556A0C0 |
| Installed launcher | C:\Users\Grey_\AppData\Local\Covert Coder\aide-sovereign-workbench.exe | 11,761,152 | 014795B2C4E4F78F16BFC75507D43419670270E76477ED07DA7559DF31FFF9CF |

A full byte comparison found exactly three differing bytes between the raw release and installed executables, with equal lengths:

| File offset | Release byte | Installed byte |
|---|---:|---:|
| 0x00917682 | 55 (U) | 4E (N) |
| 0x00917683 | 4E (N) | 53 (S) |
| 0x00917684 | 4B (K) | 53 (S) |

All three bytes are in the .rdata section. In the surrounding embedded marker, the raw release contains the suffix TAURI_BUNDLE_TYPE_VAR_UNK and the installed executable contains TAURI_BUNDLE_TYPE_VAR_NSS. Both files report PE32+ x64, the same PE timestamp (1791309286), the same six section headers, zero PE checksum, and no certificate table. This rules out a size difference, PE timestamp change, checksum change, or Authenticode certificate append as the observed explanation. The marker strongly suggests a bundle-type substitution, but that cause is not proven.

7-Zip is present at C:\Program Files\7-Zip\7z.exe. A read-only archive-list attempt against the NSIS installer produced no output for more than 60 seconds and was interrupted; command exit was 1. No executable was extracted from the installer, so its embedded launcher hash and the first boundary where bytes diverge remain unknown.

Result: ARTIFACT-IDENTITY — BLOCKED. The release, installer, and installed executable are separately identified; the transformation boundary is not yet proven. Do not describe these executables as byte-identical or claim an explained transformation.

## Installed terminal and restart

The mandatory installed product route was not exercised because the fresh resource gate failed. Consequently there is no 1R3 evidence for:

- terminal creation through installed Covert and the authenticated API/session route;
- shell PID ownership or output delivered back through the application;
- command execution, cancellation, shell reuse, or nested child cleanup through that route;
- closing the terminal and proving session/process cleanup;
- application shutdown followed by relaunch and a second terminal session;
- post-restart terminal cleanup.

These rows remain BLOCKED, not passed. The earlier direct packaged node-pty probe and adapter regression test do not substitute for the installed route. Existing terminal lifecycle evidence remains CONPTY-LIFECYCLE — PARTIAL.

## Monaco / DOMPurify security

The local dependency state recorded in the 1R2 evidence is unchanged: Monaco 0.56.0 bundles DOMPurify 3.4.8; the root DOMPurify pin at 3.4.13 does not replace Monaco's bundled copy. The local advisory record identifies GHSA-p98j-92pf-mc4p and GHSA-6688-9rhm-gjv2 as affecting versions through 3.4.15; the locally cached Monaco 0.57.0 embeds 3.4.15 and is not a verified fix.

Repository source connects language-server hover content to Monaco's hover renderer: browser/src/editor/lsp-providers.ts registers the hover provider; node/src/routes/lsp.ts exposes the hover route; node/src/services/lsp.ts flattens the language-server response into text. The trust boundary is therefore content returned by a language server while analyzing workspace files. This establishes a production-reachable sanitizer input path; it does not demonstrate exploitability in a live app.

The Tauri configuration has a content security policy with default-src self and loopback-only connect-src entries. No repository-local evidence demonstrates that this policy neutralizes the affected sanitizer behavior. No exploit or containment qualification was run. R9 prohibits cloud research, and no locally verified fixed Monaco dependency was found.

Result: DESKTOP-SECURITY-DEPENDENCY — BLOCKED / UNRESOLVED. EXTERNAL SECURITY RESEARCH REQUIRED. No advisory was suppressed, no npm audit fix was run, and package.json/package-lock.json were not changed.

## Verification and mutation record

- Current-state check at the start: git status --short --branch — exit 0; clean at 7ef211c815cae9010659da83ce0e5fd249ab6cb5.
- Resource sample using Win32_OperatingSystem.FreePhysicalMemory × 1024 — exit 0; below the floor as recorded above.
- Get-FileHash SHA-256 checks for the three artifact boundaries — exit 0.
- Corrected full-byte comparison — exit 0; 11,761,152 bytes compared, exactly 3 differed.
- PE header/section inspection reported matching headers and located the difference in .rdata. Its first reporting script exited 1 because its PowerShell output variables were scoped incorrectly; the subsequent independent byte comparison supplied the exact differing offsets and values.
- 7-Zip archive-list attempt — interrupted after more than 60 seconds with exit 1 and no archive index.
- No source, package, build, or test files were changed. No builds or tests were rerun because this slice made no product-code mutation and the runtime gate was closed.
- This document is the only intended mutation for this checkpoint.

## Acceptance matrix

| Gate | Result |
|---|---|
| RESOURCE-GATE | BLOCKED |
| ARTIFACT-IDENTITY | BLOCKED |
| INSTALLED-TERMINAL-CREATE | BLOCKED |
| INSTALLED-TERMINAL-COMMAND | BLOCKED |
| INSTALLED-TERMINAL-CANCEL | BLOCKED |
| INSTALLED-TERMINAL-REUSE | BLOCKED |
| INSTALLED-TERMINAL-CLEANUP | BLOCKED |
| POST-RESTART-TERMINAL | BLOCKED |
| POST-RESTART-CLEANUP | BLOCKED |
| CONPTY-LIFECYCLE | PARTIAL |
| DESKTOP-SECURITY-DEPENDENCY | BLOCKED |
| DESKTOP-PACKAGING-1R3 | BLOCKED |
| DESKTOP-DOGFOOD-1R | PARTIAL |

## Next exact slice

Take a new serial RAM sample before any installed-app probe. If it meets 3,221,225,472 bytes, first extract and hash the launcher inside this exact NSIS installer to identify the artifact divergence boundary, then establish supported operator pairing and exercise the installed terminal route through cancellation, shell reuse, cleanup, application restart, and a second terminal session. Preserve the existing security blocker unless a locally verifiable remediation becomes available.
