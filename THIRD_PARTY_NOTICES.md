# Third-party notices

Covert Coder's Apache-2.0 license does not replace dependency or asset licenses.

## Bundled Cascadia Mono font

`browser/src/assets/fonts/CascadiaMono.ttf` is an existing Microsoft Cascadia font asset. The copyright and SIL Open Font License 1.1 text are included in [Cascadia-OFL.txt](browser/public/Cascadia-OFL.txt), which Vite also copies into the frontend distribution. The upstream notice reserves the font name Cascadia Code. [Upstream license](https://github.com/microsoft/cascadia-code/blob/main/LICENSE).

No font modification or new font asset was introduced by this presentation pass. The existing asset's provenance is recorded in `browser/src/assets/fonts/README.txt`.

## Dependencies and models

Locked npm dependencies retain the license and notice files distributed in their packages. Release packaging must preserve applicable notices for bundled dependencies, including Monaco and xterm. `package-lock.json` identifies exact versions; this short inventory is not a substitute for a distribution-wide license audit.

Model weights and inference binaries are not included in this UI change. Imported models, tools, and plugins retain their upstream licenses and must be evaluated before redistribution.
