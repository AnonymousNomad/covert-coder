param(
  [Parameter(Mandatory = $true)][ValidateSet('Snapshot', 'Cleanup')][string]$Mode,
  [Parameter(Mandatory = $true)][ValidateRange(1, 2147483647)][int]$RootPid,
  [Parameter(Mandatory = $true)][string]$RootPath,
  [Parameter(Mandatory = $true)][string]$StartedAt
)

$ErrorActionPreference = 'Stop'
$expectedPath = [IO.Path]::GetFullPath($RootPath)
$launchTime = [DateTime]::Parse($StartedAt).ToUniversalTime()
function Convert-ProcessCreationTime([object]$Value) {
  if ($Value -is [DateTime]) { return $Value.ToUniversalTime() }
  $text = [string]$Value
  if ($text -match '^\d{14}\.') { return [Management.ManagementDateTimeConverter]::ToDateTime($text).ToUniversalTime() }
  return [DateTime]::Parse($text, [Globalization.CultureInfo]::InvariantCulture).ToUniversalTime()
}
$all = @(Get-CimInstance Win32_Process)
$byPid = @{}
foreach ($entry in $all) { $byPid[[int]$entry.ProcessId] = $entry }
$root = $byPid[$RootPid]
if (-not $root) {
  [ordered]@{ schema_version = 1; root_alive = $false; tree = @(); cleaned_pids = @(); cleanup_verified = $true; error = $null } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}
if (-not $root.ExecutablePath -or [IO.Path]::GetFullPath($root.ExecutablePath) -ne $expectedPath) {
  [ordered]@{ schema_version = 1; root_alive = $true; tree = @(); cleaned_pids = @(); cleanup_verified = $false; error = 'root executable identity mismatch; cleanup refused' } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}
$rootCreated = Convert-ProcessCreationTime $root.CreationDate
if ($rootCreated -lt $launchTime.AddSeconds(-3) -or $rootCreated -gt [DateTime]::UtcNow.AddSeconds(3)) {
  [ordered]@{ schema_version = 1; root_alive = $true; tree = @(); cleaned_pids = @(); cleanup_verified = $false; error = 'root creation time mismatch; cleanup refused' } | ConvertTo-Json -Depth 8 -Compress
  exit 0
}
$records = [Collections.Generic.List[object]]::new()
$unknownChildren = [Collections.Generic.List[object]]::new()
$windowAppeared = $null
$responsive = $null
try {
  $rootProcess = Get-Process -Id $RootPid -ErrorAction Stop
  $windowAppeared = ($rootProcess.MainWindowHandle -ne 0)
  $responsive = [bool]$rootProcess.Responding
} catch {}
$records.Add([pscustomobject]@{ pid = $RootPid; parent_pid = [int]$root.ParentProcessId; executable = $expectedPath; depth = 0; creation = $rootCreated.ToString('o'); window_appeared = $windowAppeared; responsive = $responsive; identity_complete = $true })
$frontier = @($RootPid)
$depth = 0
while ($frontier.Count -gt 0) {
  $depth += 1
  $next = @()
  foreach ($parent in $frontier) {
    foreach ($child in $all | Where-Object { [int]$_.ParentProcessId -eq $parent }) {
      $childPid = [int]$child.ProcessId
      if ($records.pid -contains $childPid) { continue }
      if (-not $child.ExecutablePath -or -not $child.CreationDate) {
        $unknownChildren.Add([pscustomobject]@{ pid = $childPid; parent_pid = $parent; depth = $depth; reason = 'executable path or creation time unavailable' })
        $next += $childPid
        continue
      }
      $childCreated = Convert-ProcessCreationTime $child.CreationDate
      if ($childCreated -lt $rootCreated) { continue }
      $records.Add([pscustomobject]@{ pid = $childPid; parent_pid = $parent; executable = [IO.Path]::GetFullPath($child.ExecutablePath); depth = $depth; creation = $childCreated.ToString('o'); window_appeared = $null; responsive = $null; identity_complete = $true })
      $next += $childPid
    }
  }
  $frontier = $next
}

$cleaned = [Collections.Generic.List[int]]::new()
$errors = [Collections.Generic.List[string]]::new()
if ($Mode -eq 'Cleanup') {
  foreach ($unknown in $unknownChildren) { $errors.Add("PID $($unknown.pid) identity unavailable; cleanup refused for that PID") }
  foreach ($record in @($records | Sort-Object depth -Descending)) {
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.pid)" -ErrorAction SilentlyContinue
    if (-not $current) { $cleaned.Add([int]$record.pid); continue }
    $currentPath = if ($current.ExecutablePath) { [IO.Path]::GetFullPath($current.ExecutablePath) } else { '' }
    $currentCreated = if ($current.CreationDate) { (Convert-ProcessCreationTime $current.CreationDate).ToString('o') } else { '' }
    if ($currentPath -ne $record.executable -or $currentCreated -ne $record.creation) {
      $errors.Add("PID $($record.pid) changed identity; cleanup refused for that PID")
      continue
    }
    Stop-Process -Id ([int]$record.pid) -Force -ErrorAction SilentlyContinue
    $deadline = [DateTime]::UtcNow.AddSeconds(2)
    do {
      Start-Sleep -Milliseconds 50
      $stillThere = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.pid)" -ErrorAction SilentlyContinue
    } while ($stillThere -and [DateTime]::UtcNow -lt $deadline)
    if ($stillThere) { $errors.Add("PID $($record.pid) remained after exact-PID stop") }
    else { $cleaned.Add([int]$record.pid) }
  }
}
$remaining = [Collections.Generic.List[int]]::new()
foreach ($record in $records) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.pid)" -ErrorAction SilentlyContinue
  if (-not $current) { continue }
  $currentPath = if ($current.ExecutablePath) { [IO.Path]::GetFullPath($current.ExecutablePath) } else { '' }
  $currentCreated = if ($current.CreationDate) { (Convert-ProcessCreationTime $current.CreationDate).ToString('o') } else { '' }
  if ($currentPath -eq $record.executable -and $currentCreated -eq $record.creation) { $remaining.Add([int]$record.pid) }
}
[ordered]@{
  schema_version = 1
  root_alive = ($remaining -contains $RootPid)
  tree = @($records)
  unknown_children = @($unknownChildren)
  cleaned_pids = @($cleaned)
  remaining_pids = @($remaining)
  cleanup_verified = ($Mode -eq 'Snapshot' -or ($errors.Count -eq 0 -and $cleaned.Count -eq $records.Count -and $remaining.Count -eq 0))
  error = if ($errors.Count) { $errors -join '; ' } else { $null }
} | ConvertTo-Json -Depth 8 -Compress
