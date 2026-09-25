# Third-party notices — source release

This notice is an evidence index, not a legal opinion. The complete dependency
inventory is the candidate-bound CycloneDX SBOM. Each installed package retains
its upstream license and notice files in the package distribution; the source
archive does not vendor `node_modules`.

## Project source

Covert source is distributed under the Apache License 2.0 in [`LICENSE`](../../LICENSE).

## Direct package inventory observed in the candidate SBOM

The following identifiers are the package metadata observed for the direct
runtime/development dependencies in the candidate lockfile:

| Package family | Version in candidate | License metadata observed |
| --- | ---: | --- |
| `monaco-editor` | 0.56.0 | MIT |
| `typescript` | 5.9.3 | Apache-2.0 |
| `typescript-language-server` | 5.3.0 | Apache-2.0 |
| `ws` | 8.21.3 | MIT |
| `zod` | 4.6.2 | MIT |
| `node-pty` | 1.1.0 | MIT |
| `@xterm/xterm` | 6.0.0 | MIT |
| `@xterm/addon-fit` | 0.11.0 | MIT |
| `@eslint/js` / `eslint` | 10.0.1 / 10.10.0 | MIT / MIT |
| `@playwright/test` | 1.62.1 | Apache-2.0 |
| `@tauri-apps/cli` | 2.11.4 | Apache-2.0 OR MIT |
| `@types/node` / `@types/ws` | 26.5.1 / 8.18.1 | MIT / MIT |
| `typescript-eslint` | 8.70.0 | MIT |
| `vite` | 8.3.0 | MIT |

The transitive package license metadata, package URLs, versions, and hashes are
in the SBOM. License identifiers are reproduced from package metadata; they are
not a determination of the full terms applicable to every distribution.

## Bundled editor font

`browser/src/assets/fonts/CascadiaMono.ttf` is accompanied by its source and
license statement in `browser/src/assets/fonts/README.txt`: Microsoft Cascadia
Code, SIL Open Font License 1.1. The full license-text/attribution packaging
decision remains a human-review item for any binary release that redistributes
the font.

## Monaco/editor assets

The repository contains generated Monaco assets under `assets/monaco`. The
candidate SBOM identifies the source package as `monaco-editor` under MIT
metadata. Release packaging must still confirm that the generated asset bundle
retains the attribution/notice coverage required by the upstream distribution.
This remains `HUMAN_REVIEW`, not an invented clearance.

## Model metadata and weights

Model weights are not present in the certified source archive. `models/PACKS.md`
describes example packs and records Apache-2.0 metadata for those named packs,
but a future model bundle must be reviewed against the exact upstream artifact,
checksum, license, and attribution requirements. No model redistribution is
claimed by this source notice.

## Human review items

1. Confirm notice coverage for the generated Monaco asset bundle.
2. Confirm whether the Cascadia Mono license text must be shipped alongside any
   future packaged binary.
3. Review each future model bundle artifact independently; source metadata does
   not clear model-weight redistribution.
4. Review any separately packaged Tauri/native binaries and their notices.
