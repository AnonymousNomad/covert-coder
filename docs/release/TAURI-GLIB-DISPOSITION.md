# Tauri / glib advisory disposition

GitHub Dependabot alert #1 reports `GHSA-wrw7-89jp-8q8g` for `glib`. The
RustSec record identifies the affected range as `>=0.15.0,<0.20.0` and the
patched line as `>=0.20.0`.

## Observed dependency graph

The certified source object contains this desktop graph in
`desktop/Cargo.lock`:

```text
aide-sovereign-workbench
  -> tauri 2.11.5
  -> tauri-runtime-wry 2.11.4
  -> gtk 0.18.2
  -> glib 0.18.5
```

The project does not directly declare `glib`; it arrives through the Tauri
desktop stack. Cargo was not installed on the certification machine, so a fresh
`cargo tree` or desktop compilation was not claimed.

## Release scope

- The source-core certification covers the Node/browser workbench path. No
  prebuilt Tauri binary or packaged installer is shipped by the source release.
- The dependency is a real desktop packaging concern, especially for a Linux
  desktop build, but the exact `VariantStrIter` call reachability from this
  application was not established.
- This is therefore **not a source-core release blocker**. It remains a
  **desktop-installer blocker for the affected build path** until the resolved
  graph reaches `glib >=0.20.0` or an explicitly reviewed mitigation is proven.

## Upgrade conclusion

Do not force a blind Tauri upgrade or a local Cargo patch. The observed Tauri
2.11.5 graph still resolves the old GTK/glib family. A Tauri version number that
actually delivers the required graph movement is not established in this
assembly. The desktop lane must identify and test an upstream-compatible
resolution, then run clean build/install/upgrade/uninstall and security checks.

References: [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g),
[RustSec RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html),
and [Tauri GTK4 migration issue #12561](https://github.com/tauri-apps/tauri/issues/12561).
