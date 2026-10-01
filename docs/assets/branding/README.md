# Branding assets

This directory is reserved for approved Covert Coder identity artwork.

Required canonical asset: `covert-coder-emblem.png`.

Optional transparent/vector variants may be added only when the exact approved artwork is available. Do not substitute generic shields, robots, code marks, or synthetic artwork.

**CANONICAL EMBLEM ASSET REQUIRED**

Every committed branding asset must be publication-safe and accompanied by provenance or approval notes.

## Provenance

`covert-coder-emblem.png` — bounded extraction of the approved emblem treatment from the approved Covert reference capture (`E:\COVERT UI\file_00000000de6c8206b69e2ac45115fab8.jpg`), 2026-09-16. Crop only: no redesign, no synthetic substitution, no fabricated variants.

## Desktop icon derivative

`desktop/icons/icon.svg` embeds the exact canonical PNG above in a centered, transparent square while preserving its aspect ratio. `desktop/icons/icon.png`, `desktop/icons/icon.ico`, and `desktop/icons/icon.icns` are the corresponding raster outputs generated with the repository's Tauri CLI 2.11.4. They introduce no new artwork; Tauri only resamples the embedded canonical PNG. To regenerate, run `tauri icon desktop/icons/icon.svg --output desktop/target/icon-regeneration` and copy the generated `icon.png`, `icon.ico`, and `icon.icns` into `desktop/icons`.
