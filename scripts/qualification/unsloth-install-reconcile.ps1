[CmdletBinding()]
param(
    [string]$InstallRoot = 'E:\Unsloth-Studio-runtime-lab-RT27',
    [string]$ExpectedVersion = '2026.9.11'
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($InstallRoot)
$python = Join-Path $root 'unsloth_studio\Scripts\python.exe'
$cliExe = Join-Path $root 'bin\unsloth.exe'
$cliCmd = Join-Path $root 'bin\unsloth.cmd'
$manifestPath = Join-Path $root 'unsloth_studio\unsloth_install_manifest.json'
$admin = ([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$filesPresent = (Test-Path -LiteralPath $python -PathType Leaf) -and
    (Test-Path -LiteralPath $cliExe -PathType Leaf) -and
    (Test-Path -LiteralPath $cliCmd -PathType Leaf) -and
    (Test-Path -LiteralPath $manifestPath -PathType Leaf)

$result = [ordered]@{
    state = 'NOT_RECOGNIZED'
    execution_context = if ($admin) { 'ADMINISTRATOR' } else { 'NON_ADMINISTRATOR' }
    expected_version = $ExpectedVersion
    detected_version = $null
    manifest_version = $null
    no_torch_profile = $null
    pip_check_ok_recorded = $null
    root_accessible = (Test-Path -LiteralPath $root -PathType Container)
    managed_python_accessible = $false
    cli_exe_present = Test-Path -LiteralPath $cliExe -PathType Leaf
    cli_wrapper_present = Test-Path -LiteralPath $cliCmd -PathType Leaf
    runtime_started = $false
    credentials_read = $false
    action = 'NO_INSTALL_OR_REPAIR_PERFORMED'
}

if (-not $admin -or -not $filesPresent) {
    $result | ConvertTo-Json -Depth 4 -Compress
    exit 3
}

$versionOutput = & $python -c "import importlib.metadata as m; print(m.version('unsloth'))"
if ($LASTEXITCODE -ne 0) {
    $result | ConvertTo-Json -Depth 4 -Compress
    exit 4
}
$detected = ([string]($versionOutput | Select-Object -Last 1)).Trim()
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$result.detected_version = $detected
$result.manifest_version = [string]$manifest.package_version
$result.no_torch_profile = [bool]$manifest.no_torch
$result.pip_check_ok_recorded = [bool]$manifest.pip_check_ok
$result.managed_python_accessible = $true
if ($detected -eq $ExpectedVersion -and $manifest.package_version -eq $ExpectedVersion -and $manifest.no_torch -eq $true) {
    $result.state = 'CURRENT_INSTALL_RECOGNIZED_VERSION_MATCHED'
    $result.action = 'NO_DESTRUCTIVE_REINSTALL_REQUIRED'
    $result | ConvertTo-Json -Depth 4 -Compress
    exit 0
}
$result.state = 'VERSION_MISMATCH_QUALIFICATION_STALE'
$result | ConvertTo-Json -Depth 4 -Compress
exit 5
