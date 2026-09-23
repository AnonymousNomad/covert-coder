# Tauri upgrade reconnaissance

This is an impact map, not an upgrade proposal. No Tauri version, Cargo lock,
desktop API, or packaging behavior was changed.

## Current integration surface

| Surface | Current evidence | Upgrade review needed |
| --- | --- | --- |
| Rust crate | `desktop/Cargo.toml` declares `tauri = "2"` and `tauri-build = "2"` | Re-resolve the complete lock graph and record the exact Tauri/runtime/wry versions. |
| Native entrypoint | `desktop/src/main.rs` starts the local stack and validates resources/readiness | Compile and run the same lifecycle battery after any upgrade. |
| Tauri config | `desktop/tauri.conf.json` uses `frontendDist`, `devUrl`, CSP, windows, resources, and all bundle targets | Validate config schema and generated bundles. |
| Plugins | No Tauri plugin declaration is present in `desktop/Cargo.toml` | Confirm no new default capability/permission surface is introduced. |
| Frontend boundary | Typed browser build is staged into `browser/dist` | Run `desktop:prepare`, staged smoke, and browser contract checks. |
| Windows packaging | Tauri bundle targets are `all`; MSI/NSIS behavior is not locally compiled in this environment | Build on a Rust/MSVC-equipped Windows runner before claiming a release artifact. |
| Linux packaging | GTK/WebKitGTK transitive path is plausible | Run target-specific `cargo tree` and native build before supporting Linux. |

## Recommendation

Do not perform a broad Tauri migration solely because Dependabot cannot move
the transitive `glib` crate within the current GTK3-compatible graph. First
establish whether the affected dependency is reachable in a supported shipped
artifact, then identify the minimum Tauri/runtime movement and re-run the
desktop security, packaging, and process-lifecycle batteries.

The glib evidence and required target-specific commands are in
`GLIB-TAURI-ADVISORY-REVIEW.md` and its JSON companion.
