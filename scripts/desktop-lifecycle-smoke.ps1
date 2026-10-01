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

function Invoke-InstalledNodeProbe {
  param([string]$NodePath, [string]$Label, [string[]]$Arguments)
  try {
    $probeOutput = @(& $NodePath @Arguments 2>&1)
    $probeExitCode = $LASTEXITCODE
  } catch {
    $probeOutput = @($_.Exception.Message)
    $probeExitCode = -1
  }
  $probeText = [string]::Join([Environment]::NewLine, [string[]]$probeOutput)
  $probeText = [regex]::Replace($probeText, 'COVERT_PAIRING_V1\s+\S+', 'COVERT_PAIRING_V1 [redacted]')
  if ($probeText.Length -gt 2000) { $probeText = $probeText.Substring($probeText.Length - 2000) }
  Write-Host "desktop startup diagnostics: bundled Node probe=$Label exit=$probeExitCode"
  if ($probeText) { Write-Host $probeText }
  $remaining = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -ieq 'node.exe' -and $_.ExecutablePath -ieq $NodePath })
  if ($remaining.Count) { Write-Host "desktop startup diagnostics: bundled Node probe residual PID(s)=$($remaining.ProcessId -join ',')" }
}

function Write-InstalledWindowsFailureEvents {
  param([string]$ExecutablePath, [DateTime]$LaunchedAtUtc)
  $executableName = Split-Path -Path $ExecutablePath -Leaf
  try {
    $events = @(Get-WinEvent -FilterHashtable @{
      LogName = 'Application'
      Id = @(1000, 1001)
      StartTime = $LaunchedAtUtc.ToLocalTime()
    } -MaxEvents 100 -ErrorAction Stop)
  } catch {
    if ($_.FullyQualifiedErrorId -match 'NoMatchingEventsFound') {
      Write-Host 'desktop startup diagnostics: no Application Error/WER events in the launch window'
    } else {
      Write-Host "desktop startup diagnostics: Application Error/WER query unavailable: $($_.Exception.Message)"
    }
    return
  }
  $matchingEvents = @($events | Where-Object {
    $_.Message -and $_.Message.IndexOf($ExecutablePath, [StringComparison]::OrdinalIgnoreCase) -ge 0
  } | Select-Object -First 5)
  if (-not $matchingEvents.Count) {
    Write-Host "desktop startup diagnostics: no Application Error/WER events matched $executableName in the launch window"
    return
  }
  foreach ($event in $matchingEvents) {
    $eventMessage = [regex]::Replace([string]$event.Message, 'COVERT_PAIRING_V1\s+\S+', 'COVERT_PAIRING_V1 [redacted]')
    if ($eventMessage.Length -gt 2500) { $eventMessage = $eventMessage.Substring($eventMessage.Length - 2500) }
    Write-Host "desktop startup diagnostics: Application event id=$($event.Id); provider=$($event.ProviderName); at=$($event.TimeCreated.ToUniversalTime().ToString('o'))"
    Write-Host $eventMessage
  }
}

function Write-InstalledStartupDiagnostics {
  param([string]$ExecutablePath, [DateTime]$LaunchedAtUtc)
  $executableDirectory = Split-Path -Path $ExecutablePath -Parent
  $candidates = @(
    [PSCustomObject]@{ Label = 'executable directory'; Root = $executableDirectory },
    [PSCustomObject]@{ Label = 'nested resources'; Root = (Join-Path $executableDirectory 'resources') }
  )
  foreach ($candidate in $candidates) {
    $nodePath = Join-Path (Join-Path $candidate.Root 'runtime') 'node.exe'
    $launcherPath = Join-Path $candidate.Root 'stack-launcher.mjs'
    $authorityPath = Join-Path (Join-Path $candidate.Root 'common') 'security\authority-channel.mjs'
    $logsDirectory = Join-Path $candidate.Root '.aide\logs'
    $nodeExists = Test-Path -LiteralPath $nodePath -PathType Leaf
    $launcherExists = Test-Path -LiteralPath $launcherPath -PathType Leaf
    Write-Host "desktop startup diagnostics: candidate=$($candidate.Label); root=$($candidate.Root); node=$nodeExists; launcher=$launcherExists; logs=$logsDirectory"
    if ($nodeExists -and $launcherExists) {
      Invoke-InstalledNodeProbe -NodePath $nodePath -Label 'version' -Arguments @('--version')
      Invoke-InstalledNodeProbe -NodePath $nodePath -Label 'launcher syntax' -Arguments @('--check', $launcherPath)
      if (Test-Path -LiteralPath $authorityPath -PathType Leaf) {
        $authorityUri = [System.Uri]::new($authorityPath).AbsoluteUri
        Invoke-InstalledNodeProbe -NodePath $nodePath -Label 'authority module import' -Arguments @('--input-type=module', '--eval', 'await import(process.argv[1])', $authorityUri)
      } else {
        Write-Host "desktop startup diagnostics: authority module missing at $authorityPath"
      }
    }
    if (-not (Test-Path -LiteralPath $logsDirectory -PathType Container)) {
      Write-Host "desktop startup diagnostics: no child log directory at $logsDirectory"
      continue
    }
    foreach ($label in @('arch', 'legacy', 'facade')) {
      foreach ($stream in @('out', 'err')) {
        $logName = "desktop-$label-$stream.log"
        $logPath = Join-Path $logsDirectory $logName
        if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) { continue }
        $logLines = @(Get-Content -LiteralPath $logPath -Tail 80 -ErrorAction SilentlyContinue)
        $logText = [string]::Join([Environment]::NewLine, [string[]]$logLines)
        $logText = [regex]::Replace($logText, 'COVERT_PAIRING_V1\s+[A-Za-z0-9_-]{43}', 'COVERT_PAIRING_V1 [redacted]')
        if ($logText.Length -gt 6000) { $logText = $logText.Substring($logText.Length - 6000) }
        Write-Host "desktop startup diagnostics: $logName tail (capped at 6000 characters)"
        if ($logText) { Write-Host $logText }
      }
    }
  }
  Write-InstalledWindowsFailureEvents -ExecutablePath $ExecutablePath -LaunchedAtUtc $LaunchedAtUtc
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
$appLaunchedAtUtc = [DateTime]::UtcNow
$app = Start-Process -FilePath $installed.Exe -PassThru
Write-Host 'desktop lifecycle smoke: checking daemon health'
try {
  $health = Wait-ForDaemonHealth -Process $app -Url 'http://127.0.0.1:4777/health'
} catch {
  $healthError = $_
  $cleanupError = $null
  try { Stop-InstalledApp -Process $app } catch { $cleanupError = $_ }
  Write-InstalledStartupDiagnostics -ExecutablePath $installed.Exe -LaunchedAtUtc $appLaunchedAtUtc
  if ($cleanupError) {
    throw "installed daemon health failed: $($healthError.Exception.Message); owned app cleanup failed: $($cleanupError.Exception.Message)"
  }
  throw $healthError
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
