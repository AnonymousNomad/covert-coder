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
$productPorts = @(4777, 4778, 4779)
$existingPortListeners = @(
  foreach ($port in $productPorts) {
    Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  }
)
if ($existingPortListeners.Count) {
  $existingListenerDetails = ($existingPortListeners | Sort-Object LocalPort, OwningProcess -Unique | ForEach-Object {
    "$($_.LocalPort)/$($_.OwningProcess)"
  }) -join ', '
  throw "desktop lifecycle smoke requires unused product ports $($productPorts -join ', '); existing port/pid entries: $existingListenerDetails"
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

function Write-InstalledNativeStartupDiagnostic {
  param([string]$DiagnosticPath)
  $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $fullPath = [System.IO.Path]::GetFullPath($DiagnosticPath)
  $parent = [System.IO.Path]::GetDirectoryName($fullPath).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $leaf = [System.IO.Path]::GetFileName($fullPath)
  if ($parent -ine $tempRoot -or $leaf -notmatch '^covert-desktop-startup-[0-9a-f]{32}-\d+\.log$') {
    throw 'native startup diagnostic refused an unexpected temporary path'
  }
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    Write-Host "desktop startup diagnostics: no native panic record at $fullPath"
    return
  }
  $item = Get-Item -LiteralPath $fullPath -Force
  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.PSIsContainer) {
    throw 'native startup diagnostic refused a reparse point or non-file'
  }
  $text = Get-Content -LiteralPath $fullPath -Raw -ErrorAction Stop
  $text = [regex]::Replace($text, 'COVERT_PAIRING_V1\s+[A-Za-z0-9_-]{43}', 'COVERT_PAIRING_V1 [redacted]')
  if ($text.Length -gt 3000) { $text = $text.Substring(0, 3000) }
  Write-Host 'desktop startup diagnostics: native panic record (capped and pairing-redacted)'
  Write-Host $text
  Remove-Item -LiteralPath $fullPath -Force
  if (Test-Path -LiteralPath $fullPath) { throw 'native startup diagnostic temporary record remained after cleanup' }
}

function Write-InstalledStartupDiagnostics {
  param([string]$ExecutablePath, [DateTime]$LaunchedAtUtc, [string]$NativeDiagnosticPath)
  Write-InstalledNativeStartupDiagnostic -DiagnosticPath $NativeDiagnosticPath
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

function Get-InstalledDiagnosticNodeTree {
  param([int]$RootProcessId, [string]$NodePath)
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -ieq 'node.exe' -and
    $_.ExecutablePath -ieq $NodePath -and
    ([int]$_.ProcessId -eq $RootProcessId -or (Test-ProcessDescendsFrom -ProcessId ([int]$_.ProcessId) -AncestorProcessId $RootProcessId))
  } | ForEach-Object { [int]$_.ProcessId })
}

function Write-InstalledDiagnosticLogTails {
  param([string]$LogsDirectory)
  foreach ($label in @('arch', 'legacy', 'facade')) {
    foreach ($stream in @('out', 'err')) {
      $logName = "desktop-$label-$stream.log"
      $logPath = Join-Path $LogsDirectory $logName
      if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) { continue }
      $lines = @(Get-Content -LiteralPath $logPath -Tail 40 -ErrorAction SilentlyContinue)
      $text = [string]::Join([Environment]::NewLine, [string[]]$lines)
      $text = [regex]::Replace($text, 'COVERT_PAIRING_V1\s+\S+', 'COVERT_PAIRING_V1 [redacted]')
      if ($text.Length -gt 3000) { $text = $text.Substring($text.Length - 3000) }
      Write-Host "desktop startup diagnostics: exact-root $logName tail (capped at 3000 characters)"
      if ($text) { Write-Host $text }
    }
  }
}

function Invoke-ExactInstalledResourceLauncherDiagnostic {
  param([string]$ResourceRoot)
  $root = (Resolve-Path -LiteralPath $ResourceRoot -ErrorAction Stop).Path
  $nodePath = Join-Path (Join-Path $root 'runtime') 'node.exe'
  $launcherPath = Join-Path $root 'stack-launcher.mjs'
  $aideDirectory = Join-Path $root '.aide'
  if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf) -or -not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
    Write-Host 'desktop startup diagnostics: exact-root launcher diagnostic skipped; required resource missing'
    return
  }
  if (Test-Path -LiteralPath $aideDirectory) {
    Write-Host 'desktop startup diagnostics: exact-root launcher diagnostic skipped; pre-existing .aide workspace preserved'
    return
  }

  $baselineNodeIds = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -ieq 'node.exe' -and $_.ExecutablePath -ieq $nodePath
  } | ForEach-Object { [int]$_.ProcessId })
  if ($baselineNodeIds.Count) {
    Write-Host "desktop startup diagnostics: exact-root launcher diagnostic skipped; pre-existing bundled Node PID(s)=$($baselineNodeIds -join ',')"
    return
  }

  $archPort = 4778
  $legacyPort = 4779
  $facadePort = 4777
  $ports = @($archPort, $legacyPort, $facadePort)
  $occupiedPorts = @(
    foreach ($port in $ports) {
      Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    }
  )
  if ($occupiedPorts.Count) {
    $occupiedDetails = ($occupiedPorts | Sort-Object LocalPort, OwningProcess -Unique | ForEach-Object {
      "$($_.LocalPort)/$($_.OwningProcess)"
    }) -join ', '
    Write-Host "desktop startup diagnostics: exact-root fixed-port launcher diagnostic skipped; pre-existing listeners port/pid=$occupiedDetails"
    return
  }
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $nodePath
  $startInfo.WorkingDirectory = $root
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  foreach ($argument in @($launcherPath, '--native-bootstrap', '--pair-origin=http://tauri.localhost')) {
    [void]$startInfo.ArgumentList.Add($argument)
  }
  $startInfo.Environment['AIDE_WORKSPACE'] = $root
  $startInfo.Environment['AIDE_MODEL_DIR'] = Join-Path $root 'models'
  $startInfo.Environment['AIDE_ARCH_PORT'] = [string]$archPort
  $startInfo.Environment['AIDE_LEGACY_PORT'] = [string]$legacyPort
  $startInfo.Environment['AIDE_FACADE_PORT'] = [string]$facadePort
  $startInfo.Environment['AIDE_LLAMA_SERVER'] = Join-Path (Join-Path $root 'runtime') 'llama-server.exe'

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $outcome = 'not-started'
  $pairingFrameValid = $false
  $healthStatus = 0
  $timedOut = $false
  $exitCode = $null
  $processStarted = $false
  $stoppedByDiagnostic = $false
  $ownedNodeIds = @()
  $stderrTask = $null
  $stderrTail = ''

  try {
    if (-not $process.Start()) { throw 'process start returned false' }
    $processStarted = $true
    $outcome = 'waiting-for-pairing'
    $stdoutLineTask = $process.StandardOutput.ReadLineAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $stdoutLineTask.Wait(20000)) {
      $timedOut = $true
      $outcome = 'pairing-timeout'
    } else {
      $pairingFrame = [string]$stdoutLineTask.Result
      $pairingFrameValid = $pairingFrame -cmatch '^COVERT_PAIRING_V1 [A-Za-z0-9_-]{43}$'
      $pairingFrame = $null
      if (-not $pairingFrameValid) {
        $process.Refresh()
        if ($process.HasExited) { $exitCode = $process.ExitCode }
        $outcome = 'pairing-frame-invalid-or-absent'
      } else {
        $outcome = 'pairing-valid-waiting-for-health'
        $healthDeadline = [DateTime]::UtcNow.AddSeconds(30)
        do {
          $process.Refresh()
          if ($process.HasExited) {
            $exitCode = $process.ExitCode
            $outcome = 'process-exited-after-pairing'
            break
          }
          try {
            $health = Invoke-WebRequest -UseBasicParsing -SkipHttpErrorCheck -Uri "http://127.0.0.1:$facadePort/api/health" -TimeoutSec 2
            $healthStatus = [int]$health.StatusCode
            if ($healthStatus -eq 200) { $outcome = 'healthy'; break }
          } catch { }
          Start-Sleep -Milliseconds 250
        } while ([DateTime]::UtcNow -lt $healthDeadline)
        if ($healthStatus -ne 200 -and $outcome -eq 'pairing-valid-waiting-for-health') {
          $timedOut = $true
          $outcome = 'facade-health-timeout'
        }
      }
    }
  } catch {
    $outcome = "diagnostic-exception-$($_.Exception.GetType().Name)"
  } finally {
    if ($processStarted) {
      $ownedNodeIds = Get-InstalledDiagnosticNodeTree -RootProcessId $process.Id -NodePath $nodePath
      $process.Refresh()
      if (-not $process.HasExited) {
        $stoppedByDiagnostic = $true
        $treeStop = Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/PID', [string]$process.Id, '/T', '/F') -PassThru -WindowStyle Hidden
        if (-not $treeStop.WaitForExit(15000)) { throw 'exact-root diagnostic process-tree stop timed out' }
        $process.Refresh()
        if (-not $process.HasExited) { throw 'exact-root diagnostic launcher remained after process-tree stop' }
      } elseif ($null -eq $exitCode) {
        $exitCode = $process.ExitCode
      }
      if (-not $process.WaitForExit(15000)) { throw 'exact-root diagnostic launcher did not close redirected streams' }
    }
    if ($stderrTask -and $stderrTask.Status -eq [System.Threading.Tasks.TaskStatus]::RanToCompletion) {
      $stderrTail = [string]$stderrTask.Result
      $stderrTail = [regex]::Replace($stderrTail, 'COVERT_PAIRING_V1\s+\S+', 'COVERT_PAIRING_V1 [redacted]')
      if ($stderrTail.Length -gt 3000) { $stderrTail = $stderrTail.Substring($stderrTail.Length - 3000) }
    }
  }

  $stopwatch.Stop()
  $cleanupDeadline = [DateTime]::UtcNow.AddSeconds(15)
  do {
    $residualNodes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.Name -ieq 'node.exe' -and $_.ExecutablePath -ieq $nodePath -and $baselineNodeIds -notcontains [int]$_.ProcessId
    })
    $residualListeners = @(Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue)
    if (-not $residualNodes.Count -and -not $residualListeners.Count) { break }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $cleanupDeadline)
  if ($residualNodes.Count -or $residualListeners.Count) {
    throw "exact-root diagnostic cleanup incomplete; residual bundled Node PID(s)=$($residualNodes.ProcessId -join ','); listener PID(s)=$($residualListeners.OwningProcess -join ',')"
  }

  $logsDirectory = Join-Path $aideDirectory 'logs'
  if (Test-Path -LiteralPath $logsDirectory -PathType Container) { Write-InstalledDiagnosticLogTails -LogsDirectory $logsDirectory }
  $aideRemoved = $false
  if (Test-Path -LiteralPath $aideDirectory) {
    $rootFullPath = [System.IO.Path]::GetFullPath($root).TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    $aideFullPath = [System.IO.Path]::GetFullPath($aideDirectory)
    $aideItem = Get-Item -LiteralPath $aideDirectory -Force
    if (($aideItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      [System.IO.Path]::GetDirectoryName($aideFullPath).TrimEnd([System.IO.Path]::DirectorySeparatorChar) -ine $rootFullPath) {
      throw 'exact-root diagnostic workspace cleanup refused an unexpected path or reparse point'
    }
    $nestedReparsePoints = @(Get-ChildItem -LiteralPath $aideDirectory -Force -Recurse -ErrorAction Stop | Where-Object {
      ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
    })
    if ($nestedReparsePoints.Count) { throw 'exact-root diagnostic workspace cleanup refused nested reparse points' }
    Remove-Item -LiteralPath $aideFullPath -Recurse -Force
    $aideRemoved = -not (Test-Path -LiteralPath $aideFullPath)
  }
  $pairingFrameValid = [bool]$pairingFrameValid
  Write-Host "desktop startup diagnostics: exact installed-root launcher outcome=$outcome; pairing_frame_valid=$pairingFrameValid; health_status=$healthStatus; timed_out=$timedOut; natural_exit_code=$exitCode; stopped_by_diagnostic=$stoppedByDiagnostic; tree_pids=$($ownedNodeIds -join ','); tree_clean=$(-not $residualNodes.Count); listeners_clean=$(-not $residualListeners.Count); diagnostic_workspace_removed=$aideRemoved; elapsed_ms=$($stopwatch.ElapsedMilliseconds)"
  if ($stderrTail) { Write-Host 'desktop startup diagnostics: exact-root launcher stderr tail (capped and pairing-redacted)'; Write-Host $stderrTail }
}

function Invoke-Installer {
  param([ValidateSet('install', 'upgrade', 'uninstall')][string]$Mode)
  Write-Host "desktop lifecycle smoke: invoking $Mode installer"
  if ($installerKind -eq 'msi') {
    $installerArg = '"' + $installer + '"'
    $logPath = if ($Mode -eq 'uninstall') { Join-Path $env:TEMP 'covert-desktop-msi-uninstall.log' } else { $installLog }
    $logArg = '"' + $logPath + '"'
    $arguments = if ($Mode -eq 'uninstall') {
      @('/x', $installerArg, '/qn', '/norestart', '/L*v', $logArg)
    } else {
      @('/i', $installerArg, '/qn', '/norestart', '/L*v', $logArg)
    }
    # REINSTALL requests only previously installed features. A fresh product
    # must use normal install selection; same-build upgrade keeps repair flags.
    if ($Mode -eq 'upgrade') { $arguments += @('REINSTALL=ALL', 'REINSTALLMODE=amus') }
    $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList $arguments -PassThru -WindowStyle Hidden
  } elseif ($Mode -eq 'uninstall') {
    $uninstaller = Find-InstalledUninstaller
    $process = Start-Process -FilePath $uninstaller -ArgumentList @('/S') -PassThru -WindowStyle Hidden
  } else {
    $process = Start-Process -FilePath $installer -ArgumentList @('/S') -PassThru -WindowStyle Hidden
  }
  if (-not $process.WaitForExit(180000)) { $process.Kill(); throw "$Mode installer exceeded the 180-second timeout" }
  if ($process.ExitCode -notin @(0, 3010)) { throw "$Mode installer failed with exit code $($process.ExitCode)" }
  Write-Host "desktop lifecycle smoke: $Mode installer exited with code $($process.ExitCode)"
}

Write-Host "desktop lifecycle smoke: installing $installer ($installerKind)"
Invoke-Installer 'install'
Write-Host 'desktop lifecycle smoke: locating installed executable'
$installed = Find-InstalledExe
if (-not $installed) { throw "installed $productName executable was not found" }

function Invoke-InstalledAppCycle {
param($installed, [string]$Label, [switch]$ForceParentExit)
Write-Host "desktop lifecycle smoke: $Label launching $($installed.Exe)"
$appLaunchedAtUtc = [DateTime]::UtcNow
$nativeDiagnosticId = [Guid]::NewGuid().ToString('N')
$diagnosticEnvName = 'COVERT_DESKTOP_STARTUP_DIAGNOSTIC_ID'
$previousDiagnosticId = [System.Environment]::GetEnvironmentVariable($diagnosticEnvName, [System.EnvironmentVariableTarget]::Process)
try {
  [System.Environment]::SetEnvironmentVariable($diagnosticEnvName, $nativeDiagnosticId, [System.EnvironmentVariableTarget]::Process)
  $app = Start-Process -FilePath $installed.Exe -PassThru -WindowStyle Hidden
} finally {
  [System.Environment]::SetEnvironmentVariable($diagnosticEnvName, $previousDiagnosticId, [System.EnvironmentVariableTarget]::Process)
}
$nativeDiagnosticPath = Join-Path ([System.IO.Path]::GetTempPath()) ("covert-desktop-startup-{0}-{1}.log" -f $nativeDiagnosticId, $app.Id)
Write-Host 'desktop lifecycle smoke: checking daemon health'
try {
  $health = Wait-ForDaemonHealth -Process $app -Url 'http://127.0.0.1:4777/api/health'
} catch {
  $healthError = $_
  $cleanupError = $null
  try { Stop-InstalledApp -Process $app } catch { $cleanupError = $_ }
  Write-InstalledStartupDiagnostics -ExecutablePath $installed.Exe -LaunchedAtUtc $appLaunchedAtUtc -NativeDiagnosticPath $nativeDiagnosticPath
  $resourceRoot = Join-Path (Split-Path -Path $installed.Exe -Parent) 'resources'
  Invoke-ExactInstalledResourceLauncherDiagnostic -ResourceRoot $resourceRoot
  if ($cleanupError) {
    throw "installed daemon health failed: $($healthError.Exception.Message); owned app cleanup failed: $($cleanupError.Exception.Message)"
  }
  throw $healthError
}
$healthListeners = @(Get-NetTCPConnection -State Listen -LocalPort 4777 -ErrorAction SilentlyContinue)
$ownedHealthListeners = @($healthListeners | Where-Object { Test-ProcessDescendsFrom -ProcessId ([int]$_.OwningProcess) -AncestorProcessId $app.Id })
if (-not $ownedHealthListeners.Count) { Stop-InstalledApp -Process $app; throw 'daemon health passed but TCP 4777 is not owned by the installed desktop process tree' }
$healthListenerProcessId = [int]$ownedHealthListeners[0].OwningProcess
$healthListenerIdentity = Get-CimInstance Win32_Process -Filter "ProcessId = $healthListenerProcessId" -ErrorAction Stop
if (-not $healthListenerIdentity) { Stop-InstalledApp -Process $app; throw 'owned health listener exited before identity capture' }
$resourceRoot = Join-Path (Split-Path -Path $installed.Exe -Parent) 'resources'
$installedNodePath = Join-Path $resourceRoot 'runtime\node.exe'
$ownedNodeIds = @(Get-InstalledDiagnosticNodeTree -RootProcessId $app.Id -NodePath $installedNodePath)
if (-not $ownedNodeIds.Count) { Stop-InstalledApp -Process $app; throw 'installed app has no identifiable bundled Node process tree' }
$ownedNodeBirths = @{}
foreach ($ownedNodeId in $ownedNodeIds) {
  $identity = Get-CimInstance Win32_Process -Filter "ProcessId = $ownedNodeId" -ErrorAction SilentlyContinue
  if ($identity -and $identity.ExecutablePath -ieq $installedNodePath) {
    $ownedNodeBirths[[int]$ownedNodeId] = $identity.CreationDate
  }
}
if ($ForceParentExit) {
  Write-Host "desktop lifecycle smoke: $Label terminating only the exact native parent handle"
  $app.Kill()
  if (-not $app.WaitForExit(15000)) { throw 'exact installed native parent did not terminate' }
} else {
  Stop-InstalledApp -Process $app
}
$processDeadline = [DateTime]::UtcNow.AddSeconds(15)
do {
  $listenerCandidate = Get-CimInstance Win32_Process -Filter "ProcessId = $healthListenerProcessId" -ErrorAction SilentlyContinue
  $listenerProcess = $null
  if ($listenerCandidate -and $listenerCandidate.CreationDate -eq $healthListenerIdentity.CreationDate -and
      $listenerCandidate.ExecutablePath -ieq $healthListenerIdentity.ExecutablePath) { $listenerProcess = $listenerCandidate }
  $remainingOwnedNodes = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $ownedNodeBirths.ContainsKey([int]$_.ProcessId) -and $_.ExecutablePath -ieq $installedNodePath -and
      $_.CreationDate -eq $ownedNodeBirths[[int]$_.ProcessId]
  })
  $portListeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 4777,4778,4779 })
  if (-not $listenerProcess -and -not $remainingOwnedNodes.Count -and -not $portListeners.Count) { break }
  Start-Sleep -Milliseconds 250
} while ([DateTime]::UtcNow -lt $processDeadline)
if ($listenerProcess -or $remainingOwnedNodes.Count -or $portListeners.Count) {
  $residual = [ordered]@{
    cycle = $Label
    forced_parent_exit = [bool]$ForceParentExit
    listener_process = @($listenerProcess | Where-Object { $_ } | Select-Object ProcessId, ParentProcessId, Name, CreationDate)
    owned_nodes = @($remainingOwnedNodes | Select-Object ProcessId, ParentProcessId, Name, CreationDate)
    listeners = @($portListeners | Select-Object LocalPort, OwningProcess)
  }
  Write-Host "desktop lifecycle smoke: residual ownership metadata $($residual | ConvertTo-Json -Depth 5 -Compress)"
  throw 'installed app closed but its owned Node process or product listener remained'
}
Write-Host "desktop lifecycle smoke: $Label health and all owned Node/listener cleanup passed"
}

Invoke-InstalledAppCycle -installed $installed -Label 'first launch'
Invoke-InstalledAppCycle -installed $installed -Label 'same-install relaunch'
Invoke-InstalledAppCycle -installed $installed -Label 'forced parent exit' -ForceParentExit
Invoke-InstalledAppCycle -installed $installed -Label 'recovery after forced exit'

Write-Host 'desktop lifecycle smoke: same-build reinstall/upgrade probe'
Invoke-Installer 'upgrade'
$reinstalled = Find-InstalledExe
if (-not $reinstalled) { throw 'same-build reinstall removed the installed executable' }
Invoke-InstalledAppCycle -installed $reinstalled -Label 'after reinstall'

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
Write-Host 'desktop lifecycle smoke passed: install, launch, health, close, relaunch, reinstall, post-reinstall launch, uninstall, cleanup'
