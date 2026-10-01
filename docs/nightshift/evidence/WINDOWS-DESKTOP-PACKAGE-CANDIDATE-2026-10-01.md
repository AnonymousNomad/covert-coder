# Windows desktop package candidate — 2026-10-01

**Status:** Local Windows build and artifact-shape checks PASS. Fresh-runner installer lifecycle, clean-user first run, signing, and release acceptance remain OPEN. These outputs are unsigned developer artifacts, not a release candidate receipt.

## Source and environment

- Repository: `E:\covert-nightshift-integration`; branch: `nightshift/production-convergence-20260926`.
- The package change set is committed at `fc6f32cd609695092ac63259077cb62f6f4a61e0`, based on parent `ca17d89862261c17bd0dfe470efeddaa11a77253`.
- Local host: Windows 11 Home Insider Preview. Node `v26.4.0`, npm `11.17.0`, Rust/Cargo `1.98.1`, Tauri CLI `2.11.4`.
- The local desktop workflow uses Node 26; the repository's GitHub desktop workflow pins Node `22.20.0`. GitHub runner results are required to verify the pinned environment.

## Verified locally

- `npm run desktop:verify` — exit 0. The typed frontend and staged resources verified. No GGUF weight or direct llama.cpp server was staged; the optional SmolLM2 bootstrap artifact is absent, and the canonical Unsloth runtime is external and unchecked.
- An explicitly configured nonexistent `AIDE_ENGINE_SOURCE` fails before staging with exit 1. With `AIDE_ENGINE_SOURCE` unset, desktop preparation no longer consults the machine-specific `E:\llama-cpp` path. The verifier rejects a direct server staged without explicit configuration.
- `npm run desktop:build` — exit 0 on Windows x64; both MSI and NSIS bundles were produced. The first attempt exposed Windows error 17 while Tauri moved its NSIS tool directory from the per-user cache on C: into the project target on E:. Setting `bundle.useLocalToolsDir=true` keeps the tool cache under the project target; the subsequent build completed both bundles.
- `npm run desktop:smoke` — exit 0. It confirmed nonempty MSI and NSIS artifacts; it does not install or launch them.
- The PowerShell lifecycle script parsed without errors. Its installer install/launch/health/reinstall/uninstall flow was not run against the owner profile.
- `node --check` passed for `desktop/prepare.mjs` and `desktop/verify-prepare.mjs`; `git diff --check` passed.

## Exact-SHA hosted verification

- AIDE CI run [36811932878](https://github.com/AnonymousNomad/covert-coder/actions/runs/36811932878) for `fc6f32cd609695092ac63259077cb62f6f4a61e0` passed all **22/22** steps.
- Cross-platform desktop run [36812007534](https://github.com/AnonymousNomad/covert-coder/actions/runs/36812007534) built and artifact-smoked Linux, macOS, and Windows. Linux and macOS jobs passed. Windows package build and artifact smoke passed, then the NSIS install lifecycle failed before app launch. MSI lifecycle was skipped because the earlier NSIS step failed in the same job.
- Root cause: the NSIS uninstall registry entry exposed `InstallLocation` with surrounding quote characters. `Find-InstalledExe` passed that value directly to `Join-Path`, which interpreted the prefix `"C` as a PowerShell drive name and stopped the smoke. No product/runtime failure was observed because the app had not yet launched.
- Repair at the next local worktree revision: normalize quoted registry `InstallLocation` once before executable or uninstaller path composition. A focused local regression check extracted the production normalizer from the PowerShell AST and verified both quoted and bare paths with spaces. Fresh-runner rerun of NSIS and MSI lifecycle is still required.

- AIDE CI run [36813178795](https://github.com/AnonymousNomad/covert-coder/actions/runs/36813178795) for `e1d5b5c1cbee8b7e8e63928a229940cc536ca603` passed all **22/22** steps.
- Desktop run [36813206962](https://github.com/AnonymousNomad/covert-coder/actions/runs/36813206962) passed Linux and macOS build/artifact smoke. Windows build and artifact smoke passed; NSIS installed and launched the executable. The lifecycle smoke then made a single health request after a fixed five-second delay and got connection refused. The NSIS step failed and MSI lifecycle was skipped. The application process had not exited when the probe ran.
- The second failure was a smoke timing defect: `desktop/src/main.rs` allows up to 30 seconds for facade health after bootstrap, while the smoke script slept five seconds and did not retry. This result does not establish a product startup failure.
- Current local repair replaces that one-shot probe with a bounded 105-second health poll, covering the app's existing 60-second pairing-pipe wait plus 30-second facade-readiness wait with margin. It observes application exit, reports repeated refusal, and stops only the test-launched app process tree if readiness fails. Focused local checks pass for delayed health success and bounded timeout. Fresh-runner NSIS and MSI lifecycle proof remains open.

## Local artifact hashes

These hashes identify the local outputs only. The GitHub workflow builds separate artifacts and must record their hashes independently.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `Covert Coder_0.1.0_x64_en-US.msi` | 56,325,261 | `9F17A5750192745C5FCCE11DEAB18838E16F35977CD3E7D5458DE4B632A409BE` |
| `Covert Coder_0.1.0_x64-setup.exe` | 36,515,753 | `BFA1BA8E447098E38B54731F2995ABD3F768644C0CA6BC1CF84C8F17261E33EA` |

Both installer files and the shell executable report `NotSigned` under Windows Authenticode inspection. No signing certificate or signing claim was supplied.

## Identity and resource boundary

- Tauri product/window display name is `Covert Coder`; the stable application identifier `org.ferrellsyntheticintelligence.aide` remains unchanged pending a reviewed WebView data-directory migration.
- PNG, ICO, and ICNS icons were generated by Tauri CLI `2.11.4` from the repository's approved `docs/assets/branding/covert-coder-emblem.png`. The SVG wrapper embeds that exact PNG with transparent square padding; it introduces no new artwork. Provenance is in `docs/assets/branding/README.md`.
- Final post-build sample at `2026-10-01T03:32:52Z`: free physical RAM `8,119.7 MiB`; free commit `9,891.4 MiB`; free VRAM `5,601/6,144 MiB`; GPU utilization `6%`. These exceed the fixed start floors, but this package check did not start a model. No Covert runtime/build process remained; Codex-owned Node processes were left running. Edge, WebView, OS, and other owner processes were untouched. Pagefile configuration was not changed.
- The already committed LFM2.5 model card records its separate exact-model, Authority/Model Manager/Runtime Broker/Admission lifecycle proof and final stop. This packaging run did not repeat or expand that model qualification.

## Exact-SHA package-lifecycle rerun `0fa7210`

- AIDE CI run [36815801644](https://github.com/AnonymousNomad/covert-coder/actions/runs/36815801644) passed all **22/22** steps for `0fa721031fac11d96d67032365e5bcdf61371e33`.
- Desktop run [36815864239](https://github.com/AnonymousNomad/covert-coder/actions/runs/36815864239) passed macOS and Linux build/artifact smoke. Windows build and artifact smoke passed, but the installed NSIS executable exited with code **101** about nine seconds after launch, before daemon health; MSI lifecycle was skipped. This is a packaged startup failure, not a timeout or acceptance result.
- Root cause: Windows `resource_dir()` in the locked Tauri dependency resolves to the installed executable directory. The bundle places configured `resources/**/*` beneath its `resources` child. The local release tree contains `resources/runtime/node.exe` and `resources/stack-launcher.mjs`, while the corresponding files are absent directly beside the executable. `main.rs` searched only the returned directory; setup returned an error and `.expect()` panicked.
- Current local repair checks exactly two candidates: the returned directory and its `resources` child. It requires one candidate to contain both the platform Node executable and launcher, rejects missing/incomplete or ambiguous layouts, and uses the resolved root consistently for runtime launch and child environment paths.
- Four focused Rust tests pass for direct layout, nested layout, missing/incomplete layout, and ambiguous layout. `rustfmt --check --edition 2021 desktop/src/resource_root.rs` passes. The Windows desktop workflow now runs these tests before packaging. Repository-wide `cargo fmt --check` still reports pre-existing formatting differences in untouched `main.rs` sections; those sections were not rewritten.
- The repair and evidence are currently local. A new exact-SHA AIDE run and fresh-runner NSIS/MSI lifecycle rerun are required; no packaged acceptance claim follows from the local resolver tests.

## Exact-SHA package-lifecycle rerun `2311a26`

- Exact-SHA AIDE CI run [36818145683](https://github.com/AnonymousNomad/covert-coder/actions/runs/36818145683) passed all **22/22** workflow steps for `2311a2617aacacee8ff50c6b94010e2aba587bef`.
- Desktop run [36818174916](https://github.com/AnonymousNomad/covert-coder/actions/runs/36818174916) passed Linux/macOS and Windows build/artifact smoke. Windows NSIS installed and launched the application at `2026-10-01T05:15:34Z`, but it exited with code **101** at `05:15:45Z`; the health probe had timed out once at its one-second request deadline. MSI lifecycle was skipped. The installed startup cause remains **UNKNOWN**; this is not packaged acceptance.
- The failure log showed that the previous lifecycle smoke stopped after the tracked application exited and did not collect installed child logs. The local diagnostic WIP in `scripts/desktop-lifecycle-smoke.ps1` now stops only that tracked app tree before reporting the executable directory and its `resources` child, the presence of `runtime/node.exe` and `stack-launcher.mjs`, and capped tails of only the known `desktop-{arch,legacy,facade}-{out,err}.log` files. Each log is capped at 80 lines and 6,000 characters. The exact `COVERT_PAIRING_V1` protocol uses a 43-character URL-safe proof; diagnostics redact that value. The proof uses a dedicated parent pipe and is not written to these child logs.
- Local PowerShell AST parsing passed. A bounded synthetic fixture verified nested-resource discovery, preservation of a cause marker, the 6,000-character tail cap, and pairing-proof redaction. This verifies diagnostics only; it does not identify or fix the installed startup failure.
- Host baseline at `2026-10-01T05:36:52Z`: physical free **7,898.5/6,656 MiB**; commit free **9,406.8/5,120 MiB**, commit limit **26,915.2 MiB**. Pagefiles are system-managed on C: and E: (allocated 7,664 and 2,944 MiB; current use 6,136 and 2,363 MiB). A later process census found no Covert app, local model/runtime, OpenCode, Python/DAP, or Code process; no running WSL distribution; and no listeners on ports 4777, 4780–4782, 8104, or 18888. The visible Edge/WebView and Codex-owned processes were left running. The admission floors were already clear, so no processes were stopped and no pagefile settings were changed. These host counters are not a canonical Admission decision.
- The diagnostic change and evidence are local and uncommitted at this checkpoint. Next: review, commit, and push the diagnostics/evidence unit; rerun the hosted Windows NSIS and MSI lifecycle; inspect emitted logs and repair the first proven startup cause. Clean-user onboarding, packaged model/runtime setup, whole-product journeys, signing, SBOM/license/provenance closure, and the final RC receipt remain open. PR #31 remains frozen.

## Exact-SHA package-lifecycle rerun `0e8a4bd`

- Exact-SHA AIDE CI run [36821276967](https://github.com/AnonymousNomad/covert-coder/actions/runs/36821276967) passed all **22/22** steps for `0e8a4bd8796bf4a3e169b03ca19fec5168afef53`.
- Desktop run [36821359925](https://github.com/AnonymousNomad/covert-coder/actions/runs/36821359925) passed Linux and macOS build/artifact smoke and Windows build/artifact smoke. The Windows NSIS installer installed and launched the app at `2026-10-01T05:55:44Z`; the app exited with code **101** at `05:55:52Z` before daemon health. MSI lifecycle was skipped. The startup cause remains **UNKNOWN**; packaged acceptance failed.
- The failure output established that the executable-directory candidate did not contain `runtime/node.exe` or `stack-launcher.mjs`; the nested `resources` candidate contained both. Neither candidate had `.aide/logs`. The exact extracted MSI image used bundled Node `v22.20.0`; its SHA-256 was `FDDDBF4581E046B8102815D56208D6A248950BB554570B81519A8A5DACFEE95D`. The MSI SHA-256 was `66CE58DC4040C7438638711D731906796EF9446C2F4A1E5115D3A4432732E57D`.
- Exact-artifact preflight passed `node --version`, `node --check stack-launcher.mjs`, and an isolated import of `common/security/authority-channel.mjs`. A bounded direct launcher diagnostic from that exact resource root used origin `http://tauri.localhost`, an isolated workspace override, and checked-free diagnostic ports. The one-time pairing frame was validated in memory only; facade health reached HTTP 200. The exact launcher and three bundled Node child processes were stopped, listeners were absent, and the temporary `.aide` directory was removed. This isolates a working resource tree/launcher path but is **diagnostic only**, not Tauri shell startup or packaged acceptance.
- The pending lifecycle reporter now probes only the two structural resource candidates, captures Node version/syntax/authority-import results, queries Application Error/WER only for the launch interval and exact executable path, caps output, and redacts the entire pairing-frame value. PowerShell AST parsing and synthetic checks passed for the extracted Node version probe, full-value redaction, output cap, and exact-path event filtering. These checks validate the reporter, not the native startup cause; no WER cause has yet been observed.
- Fresh host sample at `2026-10-01T06:30:46Z`: free physical **7.61/6.50 GiB** and free commit **9.05/5.00 GiB**. Pagefiles remain system-managed (C: allocated 7,664 MiB/current use 6,218 MiB; E: 2,944/2,361 MiB). No Covert-owned runtime or relevant listener was present. Existing Edge/WebView, Codex, and Windows processes were left untouched; nothing was stopped and pagefile settings were unchanged. These counters are host telemetry, not canonical Admission.
- Cause remains **UNKNOWN**, narrowed to the Tauri bootstrap/process context or an environment difference because the exact resource tree starts independently. Next: commit and push the hardened reporter/evidence, run exact-SHA AIDE CI and fresh Windows NSIS/MSI lifecycles, inspect exact-path WER and bounded child diagnostics, and repair only the first proven cause. PR #31 remains frozen; clean-user onboarding, packaged model/runtime setup, whole-product journeys, signing, SBOM/license/provenance closure, and final RC receipt remain open.

## Remaining gates

The latest hosted desktop run `36821359925` fails the installed NSIS startup with exit code 101 after the pushed resource-root repair; its MSI step was skipped. The exact extracted resource tree passed bounded direct launcher diagnostics, but this does not establish Tauri packaged startup. Cause remains UNKNOWN pending exact-path WER/native bootstrap diagnostics on a new Windows lifecycle run. Hosted NSIS/MSI lifecycle, clean-user onboarding, packaged model/runtime setup, whole-product journeys, signing, SBOM/license/provenance closure, and final RC receipt remain open. No release-readiness or packaged-acceptance claim follows from these builds.
