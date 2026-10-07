$ErrorActionPreference='Stop'
$taskRoot='E:\covert-workstation-integration-saul-20261006'
$taskEvidence='E:\covert-tooling\workstation-continuation-20261007-0145\nightshift-arch-expanded'
if(Test-Path $taskEvidence){throw 'Evidence directory already exists; preserve prior run'}
$null=New-Item -ItemType Directory -Path $taskEvidence

$taskMemory=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory
$taskOs=Get-CimInstance Win32_OperatingSystem
$taskInitial=[pscustomobject]@{AvailablePhysicalMB=[math]::Round($taskOs.FreePhysicalMemory/1024);FreeCommitMB=[math]::Round(($taskMemory.CommitLimit-$taskMemory.CommittedBytes)/1MB);Time=(Get-Date).ToUniversalTime().ToString('o')}
if($taskInitial.AvailablePhysicalMB -lt 3072 -or $taskInitial.FreeCommitMB -le 5120){throw 'Heavy resource gate closed'}

$taskWatch=[Diagnostics.Stopwatch]::StartNew()
$taskProcess=Start-Process -FilePath (Get-Command node).Source -ArgumentList (@('--max-old-space-size=1024','--test','--test-concurrency=1') + @(Get-ChildItem -LiteralPath "$taskRoot\tests\arch" -Filter '*.test.ts' | Sort-Object Name | ForEach-Object {$_.FullName})) -WorkingDirectory $taskRoot -PassThru -NoNewWindow -RedirectStandardOutput "$taskEvidence\runtime.log" -RedirectStandardError "$taskEvidence\runtime.stderr"
$taskHandle=$taskProcess.Handle
$taskRootNode=Get-CimInstance Win32_Process -Filter "ProcessId=$($taskProcess.Id)"
if(!$taskRootNode){throw 'Root generation unavailable; measurement cannot qualify run'}
function Generation($item){return "$($item.ProcessId)@$($item.CreationDate.ToUniversalTime().Ticks)"}
$taskOwned=@{};$taskCpu=@{};$taskPeak=0L;$taskSamples=0
$taskOwned[(Generation $taskRootNode)]=$true
do {
 $taskNodes=@(Get-CimInstance Win32_Process);$taskCurrentByPid=@{}
 foreach($taskItem in $taskNodes){$taskCurrentByPid[[int]$taskItem.ProcessId]=$taskItem}
 do {
  $taskAdded=$false
  foreach($taskItem in $taskNodes){
   $taskKey=Generation $taskItem
   if($taskOwned.ContainsKey($taskKey)){continue}
   $taskParent=$taskCurrentByPid[[int]$taskItem.ParentProcessId]
   if($taskParent -and $taskParent.CreationDate -le $taskItem.CreationDate -and $taskOwned.ContainsKey((Generation $taskParent))){$taskOwned[$taskKey]=$true;$taskAdded=$true}
  }
 } while($taskAdded)
 $taskCurrent=0L
 foreach($taskItem in $taskNodes){
  $taskKey=Generation $taskItem
  if($taskOwned.ContainsKey($taskKey)){
   $taskCurrent+=[long]$taskItem.WorkingSetSize
   $taskCpu[$taskKey]=([double]$taskItem.KernelModeTime+[double]$taskItem.UserModeTime)/10000
  }
 }
 $taskSamples++;if($taskCurrent -gt $taskPeak){$taskPeak=$taskCurrent}
 Start-Sleep -Milliseconds 250
 $taskProcess.Refresh()
} while(!$taskProcess.HasExited)
$taskProcess.WaitForExit();$taskWatch.Stop();$taskExit=$taskProcess.ExitCode
if($null -eq $taskExit){throw 'Exit code unavailable'}
$taskMemory=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory;$taskOs=Get-CimInstance Win32_OperatingSystem
$taskResult=[pscustomobject]@{ExitCode=$taskExit;ElapsedSeconds=[math]::Round($taskWatch.Elapsed.TotalSeconds,3);SampledPeakOwnedTreeMB=[math]::Round($taskPeak/1MB,2);SampledCpuMilliseconds=[math]::Round(($taskCpu.Values|Measure-Object -Sum).Sum);OwnedGenerations=@($taskOwned.Keys);Samples=$taskSamples;Initial=$taskInitial;FinalPhysicalMB=[math]::Round($taskOs.FreePhysicalMemory/1024);FinalFreeCommitMB=[math]::Round(($taskMemory.CommitLimit-$taskMemory.CommittedBytes)/1MB);Scope='PID plus creation generation; live parent generation required. Architecture regression tree only, not idle product benchmark; short descendants can be missed.';At=(Get-Date).ToUniversalTime().ToString('o')}
$taskResult|ConvertTo-Json -Depth 5|Set-Content "$taskEvidence\resource.json" -Encoding UTF8
$taskResult|Select-Object ExitCode,ElapsedSeconds,SampledPeakOwnedTreeMB,SampledCpuMilliseconds,Samples,Initial,FinalPhysicalMB,FinalFreeCommitMB,Scope|ConvertTo-Json -Depth 4
Get-Content "$taskEvidence\runtime.log" -Tail 28
Get-Content "$taskEvidence\runtime.stderr" -Tail 12
exit $taskExit
