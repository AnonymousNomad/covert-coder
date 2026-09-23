# glib / Tauri dependency review

## Observed state

- `desktop/Cargo.toml` declares Tauri `2.x` without a direct `glib` dependency.
- The production lockfile resolves `tauri 2.11.5` and transitive `glib 0.18.5`.
- The Dependabot cargo security-update job cannot resolve `glib >=0.20.0` through the current graph. This is a dependency-resolution finding, not proof that the shipped Windows artifact is vulnerable.
- Rust/Cargo is not installed in the audited environment, so no local `cargo tree` or target build was claimed.

## Advisory identity

GitHub Dependabot alert #1 identifies **GHSA-wrw7-89jp-8q8g** (no CVE),
severity `medium`, with vulnerable range `>=0.15.0, <0.20.0` and first patched
version `0.20.0`. The matching RustSec record is **RUSTSEC-2024-0429**, an
unsoundness in `glib::VariantStrIter`. The advisory describes undefined
behavior/possible null-pointer crashes in the affected iterator
implementation. It is not a claim that every application using `glib 0.18.5`
reaches the affected functions.

Primary source: [RustSec RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html).
Repository alert: [Dependabot alert #1](https://github.com/AnonymousNomad/covert-coder/security/dependabot/1).

## Reachability and platform classification

The lockfile shows the Tauri Wry graph includes GTK/WebKit crates, while the
repository's supported release evidence currently treats the native Tauri
package as uncompiled until a Rust toolchain is available. Tauri documents
WebView2 on Windows and WebKitGTK/GTK system dependencies on Linux; the
lockfile is a cross-target resolution and does not, by itself, prove that
`glib` is included in a Windows bundle.

Primary platform reference: [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/).

Current classification:

```text
RESOLUTION_STATUS: REQUIRES_TARGETED_BUILD_REVIEW
WINDOWS_RUNTIME_REACHABILITY: NOT_ESTABLISHED
LINUX_NATIVE_BUILD_REACHABILITY: PLAUSIBLE THROUGH GTK/WEBKIT GRAPH
RELEASE_BLOCKER: NOT_PROVEN
```

No Tauri upgrade or lockfile override is authorized from this review. For a
defensible disposition, run the target-specific dependency/build checks in an
environment with Rust and the intended target toolchain:

1. `cargo tree --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc -i glib@0.18.5`
2. `cargo tree --manifest-path desktop/Cargo.toml --target x86_64-unknown-linux-gnu -i glib@0.18.5`
3. Build the supported artifact(s) and inspect the bundle for GTK/GLib runtime files.
4. Record the exact Tauri crate versions and the minimum upgrade, if any, that permits `glib >=0.20.0` without breaking the desktop contract.

Until those checks exist, the item is `POST_RELEASE_TRACKED / HUMAN REVIEW`,
not silently suppressed and not inflated into a confirmed shipped-runtime
vulnerability.
