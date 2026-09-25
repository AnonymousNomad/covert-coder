# Unsloth V1 Windows Installation and Reconciliation Runbook

Profile: native Windows 11 Administrator, Unsloth `2026.9.11`, GGUF-only, Vulkan, GTX 1060-class qualified machine. This runbook is the canonical Covert procedure; its file hash is recorded in the V1 Passport and evidence manifest. It does not claim to recover the historical remote bootstrap bytes that were not retained during the successful installation.

## Installation state

The qualified installation is external to Covert at `E:\Unsloth-Studio-runtime-lab-RT27`. The observed paths are:

| Component | Path |
|---|---|
| Install/Studio home | `E:\Unsloth-Studio-runtime-lab-RT27` |
| CLI | `E:\Unsloth-Studio-runtime-lab-RT27\bin\unsloth.exe` |
| CLI wrapper | `E:\Unsloth-Studio-runtime-lab-RT27\bin\unsloth.cmd` |
| Managed Python | `E:\Unsloth-Studio-runtime-lab-RT27\unsloth_studio\Scripts\python.exe` |
| Install manifest | `E:\Unsloth-Studio-runtime-lab-RT27\unsloth_studio\unsloth_install_manifest.json` |
| Isolated cache roots | `E:\Unsloth-Studio-runtime-lab-RT27\.cache` and `E:\Unsloth-Studio-runtime-lab-RT27\cache` |
| API | `http://127.0.0.1:18888` |

The model artifact and Covert's DPAPI-backed credential slot are separate assets, not part of the runtime root. Public/runtime-state fixtures contain no machine paths or credential values.

First run the read-only reconciler from an Administrator PowerShell session:

```powershell
& .\scripts\qualification\unsloth-install-reconcile.ps1
```

Expected for the already qualified installation:

```text
state: CURRENT_INSTALL_RECOGNIZED_VERSION_MATCHED
detected_version: 2026.9.11
manifest_version: 2026.9.11
no_torch_profile: true
runtime_started: false
credentials_read: false
action: NO_DESTRUCTIVE_REINSTALL_REQUIRED
```

The reconciler is read-only. It fails closed for a non-Administrator session, missing files, version mismatch, or profile mismatch. Do not rerun installation merely to recreate the lost historical bootstrap hash.

## Fresh installation procedure

Only use this procedure if the reconciler reports that the runtime is absent and the operator explicitly requests installation. The official Windows path is documented by [Unsloth](https://github.com/unslothai/unsloth/blob/main/README.md). The upstream bootstrap is mutable and currently specifies a package lower bound rather than a reproducible historical installer build, so capture its hash at each install and stop qualification unless the installed package and manifest both resolve exactly to `2026.9.11`.

1. Open an Administrator PowerShell session on the target machine. Do not change execution policy globally.
2. Confirm the target root is the intended empty/dedicated runtime location. Never overwrite an existing install that the reconciler recognizes.
3. Download `https://unsloth.ai/install.ps1` to `E:\Unsloth-Studio-runtime-lab-RT27-bootstrap\install.ps1`, outside the runtime root so installation cannot replace its own bootstrap file. Inspect the file and record SHA-256 before execution; do not pipe a mutable network response directly to `iex` for a qualified build.
4. Set the documented install profile in that session:

```powershell
$bootstrapRoot = 'E:\Unsloth-Studio-runtime-lab-RT27-bootstrap'
$bootstrapPath = Join-Path $bootstrapRoot 'install.ps1'
New-Item -ItemType Directory -Force -Path $bootstrapRoot | Out-Null
Invoke-WebRequest -Uri 'https://unsloth.ai/install.ps1' -OutFile $bootstrapPath
Get-FileHash -LiteralPath $bootstrapPath -Algorithm SHA256
# Review the saved script before execution; require the recorded hash in the install record.

$env:UNSLOTH_NO_TORCH = '1'
$env:UNSLOTH_SKIP_AUTOSTART = '1'
$env:UNSLOTH_ISOLATE_UV_CACHE = '1'
$env:UNSLOTH_STUDIO_HOME = 'E:\Unsloth-Studio-runtime-lab-RT27'
$env:UNSLOTH_LLAMA_CPP_BACKEND = 'vulkan'
```

5. Execute the reviewed local script, for example `& $bootstrapPath`, from that same PowerShell session. Record the actual CLI, managed Python, manifest, cache, configuration, and install roots. Do not enable autostart, tunnels, LAN exposure, or cloud features.
6. Run the reconciler again. Require exact package and manifest version `2026.9.11`, GGUF-only/no-Torch profile, accessible CLI/Python/configuration, and no runtime started as a side effect.
7. Before first model load, use the normal Covert RuntimeAdapter path to verify loopback health, bearer authentication, ownership, and clean start/stop. Then run the exact artifact hash gate in the qualification harness.

The previous successful installation's bootstrap script hash is `UNKNOWN_NOT_RETAINED`; the old staged installer hash `5C6F0AFD0306A6461F346DD772D5A8BDE97780716507AA5824974375B1649A6C` belongs to a failed attempt and must never be substituted. The versioned runbook and read-only reconciler hashes are recorded separately.

The current installed manifest records `no_torch=true` and `pip_check_ok=false`. The GGUF-only profile intentionally omits PyTorch; `pip check` also reported unrelated package-version constraints. No dependency repair was applied. Runtime acceptance is based on exact-version reconciliation and the live GGUF health/load/inference suite, not on claiming a clean general-purpose Python environment.

## Upgrade policy

Automatic updates are disabled/not used. Do not update in place for V1. A new Unsloth version, backend package, or relevant runtime change invalidates the Passport. Install/requalify in a separately recorded step, then promote only after the V1 regression and live qualification gates pass.

## Reboot and recovery

After a host reboot, assume all old PIDs and listeners are stale. Discover the executable/version; inspect current ownership and port; start only the verified installation on an available loopback port; authenticate; require a healthy API identity; hash the exact GGUF before load; verify the loaded identity; and resume availability. A collision or unknown owner blocks startup. Recovery to direct llama.cpp is explicit and recorded.

## Removal / recovery

Covert stops only a runtime whose ownership it has verified. For a user-owned runtime, require operator action. Never kill a foreign/unknown process. Upstream documents a Windows PowerShell uninstaller at [scripts/uninstall.ps1](https://raw.githubusercontent.com/unslothai/unsloth/main/scripts/uninstall.ps1); review the exact version and path scope before execution because it may recursively remove installation-owned paths and alter user shortcuts, PATH, app data, or registry state.

Do not remove the selected GGUF/model store, Covert source/evidence, or Covert's DPAPI-backed credential slot as part of Unsloth removal. The Unsloth uninstall procedure does not authorize deleting those separate assets. After removal, verify the runtime root/CLI is gone, the dedicated port has no listener, no owned runtime process remains, and Covert reports `NOT_INSTALLED`. If the backend is absent, Covert surfaces unavailable state and retains Unsloth as the canonical selection; it does not silently activate another engine.
