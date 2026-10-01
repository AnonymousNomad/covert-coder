param(
  [ValidateSet('nsis', 'msi')]
  [string]$requestedInstallerKind = 'nsis'
)

$ErrorActionPreference = 'Stop'

$desktopConfigPath = Join-Path $PSScriptRoot '..\desktop\tauri.conf.json'
$desktopConfig = Get-Content -LiteralPath $desktopConfigPath -Raw | ConvertFrom-Json
$productName = [string]$desktopConfig.productName
if (-not $productName) { throw "desktop productName is missing from $desktopConfigPath" }
$cargoManifestPath = Join-Path $PSScriptRoot '..\desktop\Cargo.toml'
$cargoManifest = Get-Content -LiteralPath $cargoManifestPath -Raw
$packageSection = [regex]::Match($cargoManifest, '(?ms)^\[package\]\s*(?<body>.*?)(?=^\[|\z)')
$packageName = [regex]::Match($packageSection.Groups['body'].Value, '(?m)^\s*name\s*=\s*"(?<name>[^"]+)"')
if (-not $packageSection.Success -or -not $packageName.Success) { throw "desktop Cargo package name is missing from $cargoManifestPath" }
$appExeName = "$($packageName.Groups['name'].Value).exe"
$appExeNameRegex = '(?i)(uninstall|{0}$)' -f [regex]::Escape($appExeName)

Write-Host "desktop lifecycle smoke: starting from $((Get-Location).Path); script root $PSScriptRoot"
$bundleCandidates = @(
  (Join-Path $PSScriptRoot '..\desktop\target\release\bundle'),
  (Join-Path ((Get-Location).Path) 'desktop\target\release\bundle'),
  (Join-Path $PSScriptRoot '..\target\release\bundle'),
  (Join-Path ((Get-Location).Path) 'target\release\bundle')
)
Write-Host "desktop lifecycle smoke: bundle candidates $($bundleCandidates -join '; ')"
$bundleRoot = $null
foreach ($candidate in $bundleCandidates) {
  if (Test-Path -LiteralPath $candidate -PathType Container) { $bundleRoot = $candidate; break }
}
if (-not $bundleRoot) { throw "desktop bundle directory is missing; checked: $($bundleCandidates -join ', ')" }
$bundleFiles = @(Get-ChildItem -LiteralPath $bundleRoot -Recurse -File)
Write-Host "desktop lifecycle smoke: bundle root $bundleRoot"
Write-Host 'desktop lifecycle smoke: bundle files'
$bundleFiles | ForEach-Object { Write-Host " - $($_.FullName)" }
$msi = $bundleFiles | Where-Object { $_.Extension -ieq '.msi' } | Select-Object -First 1
$nsis = $bundleFiles | Where-Object {
  $_.Extension -ieq '.exe' -and
  $_.FullName -match '(?i)\\nsis\\' -and
  $_.Name -notmatch $appExeNameRegex
} | Select-Object -First 1
if ($requestedInstallerKind -eq 'nsis') { $selectedInstaller = $nsis } else { $selectedInstaller = $msi }
if (-not $selectedInstaller) { throw "requested $requestedInstallerKind installer not found under $bundleRoot; bundle files: $($bundleFiles.Name -join ', ')" }

$installer = $selectedInstaller.FullName
$installerKind = $requestedInstallerKind
$existingPortListeners = @(Get-NetTCPConnection -State Listen -LocalPort 4777 -ErrorAction SilentlyContinue)
if ($existingPortListeners.Count) {
  $existingListenerPids = $existingPortListeners.OwningProcess -join ', '
  throw "desktop lifecycle smoke requires unused TCP port 4777; existing listener PID(s): $existingListenerPids"
}
$installLog = Join-Path $env:TEMP 'covert-desktop-msi-install.log'

function Get-UninstallEntries {
  $roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($root in $roots) {
    Get-ItemProperty -Path $root -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $productName }
  }
}

function Get-EntryInstallLocation {
  param([object]$Entry)
  $installLocation = ([string]$Entry.InstallLocation).Trim().Trim('"')
  if (-not $installLocation) { return $null }
  return $installLocation
}

function Find-InstalledExe {
  $entries = @(Get-UninstallEntries)
  foreach ($entry in $entries) {
    $installLocation = Get-EntryInstallLocation $entry
    if ($installLocation) {
      $candidate = Join-Path $installLocation $appExeName
      if (Test-Path -LiteralPath $candidate) { return [PSCustomObject]@{ Exe = $candidate; Entry = $entry } }
    }
  }
  $roots = @(
    $env:LOCALAPPDATA,
    (Join-Path $env:LOCALAPPDATA 'Programs'),
    $env:ProgramFiles,
    ${env:ProgramFiles(x86)}
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  foreach ($root in $roots) {
    foreach ($directory in @($root, (Join-Path $root $productName))) {
      $candidate = Join-Path $directory $appExeName
      if (Test-Path -LiteralPath $candidate) { return [PSCustomObject]@{ Exe = $candidate; Entry = ($entries | Select-Object -First 1) } }
    }
  }
  return $null
}

function Find-InstalledUninstaller {
  $entry = @(Get-UninstallEntries) | Select-Object -First 1
  if (-not $entry) { throw "installed $productName uninstall entry was not found" }
  $installLocation = Get-EntryInstallLocation $entry
  if ($installLocation) {
    $candidate = Join-Path $installLocation 'uninstall.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  if ($entry.UninstallString) {
    $match = [regex]::Match([string]$entry.UninstallString, '^\s*(?:"(?<quoted>[^"]+\.exe)"|(?<bare>.+?\.exe))(?:\s|$)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
      $candidate = if ($match.Groups['quoted'].Success) { $match.Groups['quoted'].Value } else { $match.Groups['bare'].Value }
      if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
  }
  throw "installed $productName uninstaller was not found in its uninstall entry"
}

function Wait-ForDaemonHealth {
  param(
    [System.Diagnostics.Process]$Process,
    [string]$Url,
    [int]$TimeoutSeconds = 105
  )
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $nextProgress = [DateTime]::UtcNow.AddSeconds(10)
  $lastError = 'no health response received'
  while ([DateTime]::UtcNow -lt $deadline) {
    $Process.Refresh()
    if ($Process.HasExited) { throw "installed application exited before daemon health with code $($Process.ExitCode)" }
    try {
      $health = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 1 -ErrorAction Stop
      if ($health.StatusCode -eq 200) { return $health }
      $lastError = "health returned HTTP $($health.StatusCode)"
    } catch {
      $lastError = $_.Exception.Message
    }
    if ([DateTime]::UtcNow -ge $nextProgress) {
      Write-Host "desktop lifecycle smoke: waiting for daemon health; app PID $($Process.Id); last probe: $lastError"
      $nextProgress = [DateTime]::UtcNow.AddSeconds(10)
    }
    Start-Sleep -Milliseconds 500
  }
  throw "installed daemon health did not return HTTP 200 within $TimeoutSeconds seconds; app PID $($Process.Id); last probe: $lastError"
}

function Stop-InstalledApp {
  param([System.Diagnostics.Process]$Process)
  $Process.Refresh()
  if ($Process.HasExited) { return }
  if ($Process.CloseMainWindow() -and $Process.WaitForExit(15000)) { return }
  $treeStop = Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/PID', [string]$Process.Id, '/T', '/F') -PassThru -WindowStyle Hidden
  if (-not $treeStop.WaitForExit(15000)) { throw "taskkill did not finish for installed application PID $($Process.Id)" }
  $Process.Refresh()
  if (-not $Process.HasExited) { throw "installed application process tree did not stop for PID $($Process.Id)" }
}

function Test-ProcessDescendsFrom {
  param([int]$ProcessId, [int]$AncestorProcessId)
  $currentProcessId = $ProcessId
  for ($depth = 0; $depth -lt 32; $depth++) {
    if ($currentProcessId -eq $AncestorProcessId) { return $true }
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $currentProcessId" -ErrorAction SilentlyContinue
    if (-not $processInfo) { return $false }
    $parentProcessId = [int]$processInfo.ParentProcessId
    if ($parentProcessId -eq 0 -or $parentProcessId -eq $currentProcessId) { return $false }
    $currentProcessId = $parentProcessId
  }
  return $false
}

function Invoke-Installer {
  param([string]$Mode)
  Write-Host "desktop lifecycle smoke: invoking $Mode installer"
  if ($installerKind -eq 'msi') {
    $installerArg = '"' + $installer + '"'
    $logPath = if ($Mode -eq 'uninstall') { Join-Path $env:TEMP 'covert-desktop-msi-uninstall.log' } else { $installLog }
    $logArg = '"' + $logPath + '"'
    $arguments = if ($Mode -eq 'uninstall') {
      @('/x', $installerArg, '/qn', '/norestart', '/L*v', $logArg)
    } else {
      @('/i', $installerArg, '/qn', '/norestart', '/L*v', $logArg, 'REINSTALL=ALL', 'REINSTALLMODE=amus')
    }
    $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList $arguments -PassThru
  } elseif ($Mode -eq 'uninstall') {
    $uninstaller = Find-InstalledUninstaller
    $process = Start-Process -FilePath $uninstaller -ArgumentList @('/S') -PassThru
  } else {
    $process = Start-Process -FilePath $installer -ArgumentList @('/S') -PassThru
  }
  if (-not $process.WaitForExit(180000)) { $process.Kill(); throw "$Mode installer exceeded the 180-second timeout" }
  if ($process.ExitCode -notin @(0, 3010)) { throw "$Mode installer failed with exit code $($process.ExitCode)" }
}

Write-Host "desktop lifecycle smoke: installing $installer ($installerKind)"
Invoke-Installer 'install'
Write-Host 'desktop lifecycle smoke: locating installed executable'
$installed = Find-InstalledExe
if (-not $installed) { throw "installed $productName executable was not found" }

Write-Host "desktop lifecycle smoke: launching $($installed.Exe)"
$app = Start-Process -FilePath $installed.Exe -PassThru
Write-Host 'desktop lifecycle smoke: checking daemon health'
try {
  $health = Wait-ForDaemonHealth -Process $app -Url 'http://127.0.0.1:4777/health'
} catch {
  Stop-InstalledApp -Process $app
  throw
}
$healthListeners = @(Get-NetTCPConnection -State Listen -LocalPort 4777 -ErrorAction SilentlyContinue)
$ownedHealthListeners = @($healthListeners | Where-Object { Test-ProcessDescendsFrom -ProcessId ([int]$_.OwningProcess) -AncestorProcessId $app.Id })
if (-not $ownedHealthListeners.Count) { Stop-InstalledApp -Process $app; throw 'daemon health passed but TCP 4777 is not owned by the installed desktop process tree' }
$healthListenerProcessId = [int]$ownedHealthListeners[0].OwningProcess
Stop-InstalledApp -Process $app
$processDeadline = [DateTime]::UtcNow.AddSeconds(15)
do {
  $listenerProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $healthListenerProcessId" -ErrorAction SilentlyContinue
  $portListeners = @(Get-NetTCPConnection -State Listen -LocalPort 4777 -ErrorAction SilentlyContinue)
  if (-not $listenerProcess -and -not $portListeners.Count) { break }
  Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $processDeadline)
if ($listenerProcess -or $portListeners.Count) { throw 'installed app closed but its daemon process or TCP 4777 listener remained' }

Write-Host 'desktop lifecycle smoke: same-build reinstall/upgrade probe'
Invoke-Installer 'upgrade'
if (-not (Find-InstalledExe)) { throw 'same-build reinstall removed the installed executable' }

$entry = @(Get-UninstallEntries) | Select-Object -First 1
if ($entry -and $entry.PSChildName -match '^\{[0-9A-F-]+\}$' -and $installerKind -eq 'msi') {
  Write-Host 'desktop lifecycle smoke: uninstalling MSI product'
  $uninstallLog = '"' + (Join-Path $env:TEMP 'covert-desktop-msi-uninstall.log') + '"'
  $uninstall = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/x', $entry.PSChildName, '/qn', '/norestart', '/L*v', $uninstallLog) -PassThru
  if (-not $uninstall.WaitForExit(180000)) { $uninstall.Kill(); throw 'uninstall exceeded the 180-second timeout' }
  if ($uninstall.ExitCode -notin @(0, 3010)) { throw "uninstall failed with exit code $($uninstall.ExitCode)" }
} else {
  Invoke-Installer 'uninstall'
}

Start-Sleep -Seconds 2
if (Find-InstalledExe) { throw 'installed application remains after uninstall' }
if (@(Get-NetTCPConnection -State Listen -LocalPort 4777 -ErrorAction SilentlyContinue).Count) { throw 'daemon listener remained after desktop uninstall' }
Write-Host 'desktop lifecycle smoke passed: install, launch, health, close, reinstall, uninstall, cleanup'
