# Desktop glib advisory - bounded source/target diagnosis

Snapshot: f7175144753a2bcfaaa3ff0ce79a558007f77dbb. This is an existing
desktop dependency issue, not a new Runtime/Provider regression. No fix,
waiver, exploitability verdict or release acceptance is claimed here.

GitHub alert1 names GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429 on
desktop/Cargo.lock, glib0.18.5. The published advisory identifies an immutable
out-pointer passed to a variadic C function, with undefined behavior in
VariantStrIter; its patched range starts at0.20.0. Primary references:

- https://rustsec.org/advisories/RUSTSEC-2024-0429.html
- https://github.com/gtk-rs/gtk-rs-core/pull/1343
- https://github.com/AnonymousNomad/covert-coder/security/dependabot/1

The locally cached glib0.18.5 crate SHA256 equals the registry checksum in
the canonical lockfile:
233daaf6e83ae6a12a52055f568f9d7cf4671dabb78ff9560ab6da230ce00ee5.
Cached src/variant_iter.rs matches that archive byte-for-byte and contains
the immutable pointer defect. Its SHA256:
1fd02859333761c45321b32f28b24233446b97d0022a90d3a937ed162585b90e.
Cargo.lock SHA256:
a6c09c098f9a9c0fcf55d1c432b1cfa7749bdda0d8f9c3c5ae8ab3cb3c27ed04.

Locked/offline cargo tree --invert glib with x86_64-pc-windows-msvc exits0
with no dependency edge. The Linux x86_64-unknown-linux-gnu graph exits0
and resolves glib through GTK/GIO/WebKit/Tauri/Wry; current Tauri2.11.5,
tauri-runtime-wry2.11.4, wry0.55.1, gtk0.18.2. This proves resolved target
scope. It does not prove runtime reachability, exploitability or that Windows
has no other dependency issues. Existing Linux artifact smoke is not proof
that affected optimized iterator behavior is safe.

Linux release promotion remains OPEN/BLOCKED pending a qualified compatible
upstream correction or explicit reproducible upstream backport. Do not force
glib0.20 into GTK0.18, mutate the global Cargo cache, suppress the advisory or
claim a patched artifact without optimized upstream regressions, dependent
desktop build/install/smoke and exact-SHA evidence. Investigate supported
upstream dependency resolutions first; keep the existing desktop architecture.

Raw artifacts are retained outside the product under
E:\covert-tooling\functional-release-20261001:
glib-locked-source-observation.json, glib-windows-locked-tree.log and
glib-linux-locked-tree.log, plus inspect-glib-locked-source.mjs. These are
source/graph diagnostics, not Covert release qualification. No Cargo, model,
OS, pagefile or cache file changed during diagnosis.
