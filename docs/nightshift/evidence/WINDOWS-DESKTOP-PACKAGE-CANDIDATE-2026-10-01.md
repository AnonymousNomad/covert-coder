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

## Remaining gates

The latest hosted desktop run `36815864239` exposed the Windows resource-root defect described above. The tested local resolver repair remains uncommitted and unpushed; exact-SHA AIDE CI and fresh-runner NSIS/MSI lifecycle acceptance are required next. Clean-user onboarding, packaged model/runtime setup, whole-product journeys, signing, SBOM/license/provenance closure, and the final RC receipt remain open. No release-readiness or packaged-acceptance claim follows from these builds.
