param(
  [int[]]$Ports = @(4777, 4778, 4779, 4173, 5173),
  [string]$RepositoryRoot = '',
  [string]$InstallRoot = ''
)

$ErrorActionPreference = 'Stop'
$repositoryFull = if ($RepositoryRoot) { [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd('\') } else { '' }
$installFull = if ($InstallRoot) { [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\') } else { '' }
$capturedAt = [DateTime]::UtcNow.ToString('o')
$results = foreach ($port in ($Ports | Sort-Object -Unique)) {
  if ($port -lt 1 -or $port -gt 65535) { throw "invalid TCP port: $port" }
  $connections = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
    Sort-Object OwningProcess, LocalAddress -Unique)
  $listeners = foreach ($connection in $connections) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
    $executable = if ($process.ExecutablePath) { [IO.Path]::GetFullPath($process.ExecutablePath) } else { $null }
    $commandLine = [string]$process.CommandLine
    $ownership = 'UNKNOWN'
    if ($repositoryFull -and $commandLine.IndexOf($repositoryFull, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
      $ownership = 'CURRENT REPOSITORY PROCESS'
    } elseif ($installFull -and $executable -and $executable.StartsWith($installFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
      $ownership = 'SPECIFIED INSTALL ROOT'
    }
    [ordered]@{
      local_address = $connection.LocalAddress
      pid = [int]$connection.OwningProcess
      process_name = if ($process.Name) { $process.Name } else { $null }
      executable = $executable
      parent_pid = if ($process.ParentProcessId) { [int]$process.ParentProcessId } else { $null }
      ownership = $ownership
      identity_source = if ($process.ExecutablePath) { 'exact PID process path and parent metadata' } else { 'PID only; process metadata unavailable' }
    }
  }
  [ordered]@{
    port = $port
    listening = ($listeners.Count -gt 0)
    listeners = @($listeners)
  }
}

[ordered]@{
  schema_version = 1
  captured_at = $capturedAt
  operation = 'READ ONLY'
  results = @($results)
} | ConvertTo-Json -Depth 8 -Compress
