param(
  [Parameter(Mandatory = $true)][ValidateRange(1, 2147483647)][int]$RootPid,
  [Parameter(Mandatory = $true)][string]$RootPath,
  [Parameter(Mandatory = $true)][string]$FromTime,
  [Parameter(Mandatory = $true)][string]$ToTime
)

$ErrorActionPreference = 'Stop'
$expectedPath = [IO.Path]::GetFullPath($RootPath)
$start = [DateTime]::Parse($FromTime).ToLocalTime()
$end = [DateTime]::Parse($ToTime).ToLocalTime()
$pidHex = '0x{0:x}' -f $RootPid
try {
  $events = @(Get-WinEvent -FilterHashtable @{ LogName = 'Application'; Id = @(1000, 1001, 1002); StartTime = $start; EndTime = $end } -ErrorAction Stop)
  $matched = foreach ($event in $events) {
    $xml = [xml]$event.ToXml()
    $data = @{}
    foreach ($item in $xml.Event.EventData.Data) { $data[[string]$item.Name] = [string]$item.'#text' }
    $eventPath = @($data['AppPath'], $data['ApplicationPath'], $data['FaultingApplicationPath']) | Where-Object { $_ } | Select-Object -First 1
    $eventPid = @($data['ProcessId'], $data['FaultingProcessId']) | Where-Object { $_ } | Select-Object -First 1
    $pidMatches = $eventPid -and ($eventPid -eq [string]$RootPid -or $eventPid -eq $pidHex)
    $pathMatches = $eventPath -and [IO.Path]::GetFullPath($eventPath) -eq $expectedPath
    if ($pidMatches -or $pathMatches) {
      [ordered]@{
        record_id = $event.RecordId
        event_id = $event.Id
        provider = $event.ProviderName
        time = $event.TimeCreated.ToUniversalTime().ToString('o')
        process_id = $eventPid
        application = @($data['AppName'], $data['ApplicationName'], $data['FaultingApplicationName']) | Where-Object { $_ } | Select-Object -First 1
        module = @($data['ModuleName'], $data['FaultingModuleName']) | Where-Object { $_ } | Select-Object -First 1
        identity_match = if ($pidMatches) { 'PID' } else { 'EXECUTABLE PATH' }
      }
    }
  }
  [ordered]@{ status = 'AVAILABLE'; events = @($matched) } | ConvertTo-Json -Depth 6 -Compress
} catch {
  [ordered]@{ status = 'UNAVAILABLE'; events = @(); reason = 'Application log query unavailable or no matching provider data.' } | ConvertTo-Json -Depth 6 -Compress
}
