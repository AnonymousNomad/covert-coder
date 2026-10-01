param([Parameter(Mandatory=$true)][string]$LifecyclePath)
$ErrorActionPreference='Stop'
$tokens=$null
$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile([IO.Path]::GetFullPath($LifecyclePath),[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'Canonical lifecycle script has parse errors'}
$functions=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-Installer'},$true))
if($functions.Count -ne 1){throw 'Exactly one canonical installer function required'}
. ([scriptblock]::Create($functions[0].Extent.Text))

# Controlled process boundary only. No real installer, registry, application,
# network or filesystem mutation occurs in these command-contract cases.
$script:FixtureCalls=[Collections.Generic.List[object]]::new()
$script:FixtureWaits=[Collections.Generic.List[int]]::new()
$script:FixtureKills=0
$script:FixtureExitCode=0
$script:FixtureWaitSuccess=$true
function Start-Process {
  param([string]$FilePath,[string[]]$ArgumentList,[switch]$PassThru,[object]$WindowStyle)
  if($FilePath -notin @('msiexec.exe','C:\covert-fixture\installer.exe','C:\covert-fixture\uninstall.exe')){throw 'Fixture refuses an unexpected process target'}
  $script:FixtureCalls.Add([pscustomobject]@{FilePath=$FilePath;Arguments=@($ArgumentList);PassThru=[bool]$PassThru;WindowStyle=[string]$WindowStyle})
  $process=[pscustomobject]@{ExitCode=$script:FixtureExitCode}
  $process | Add-Member -MemberType ScriptMethod -Name WaitForExit -Value {param([int]$timeout) $script:FixtureWaits.Add($timeout); return $script:FixtureWaitSuccess}
  $process | Add-Member -MemberType ScriptMethod -Name Kill -Value {$script:FixtureKills+=1}
  return $process
}
function Find-InstalledUninstaller {return 'C:\covert-fixture\uninstall.exe'}
function Assert-Contract {
  param([bool]$Condition,[string]$Message)
  if(-not $Condition){throw $Message}
}
function Reset-Fixture {
  $script:FixtureCalls.Clear()
  $script:FixtureWaits.Clear()
  $script:FixtureKills=0
  $script:FixtureExitCode=0
  $script:FixtureWaitSuccess=$true
}
$installerKind='msi'
$installer='C:\covert-fixture\installer.exe'
$installLog='C:\covert-fixture\install.log'
$cases=@(
  @{Name='fresh MSI install has no repair-only feature flags';Body={
    Invoke-Installer 'install'
    $call=$script:FixtureCalls[0]
    Assert-Contract ($call.FilePath -eq 'msiexec.exe' -and $call.Arguments[0] -eq '/i') 'fresh MSI uses canonical install command'
    Assert-Contract (-not ($call.Arguments -match '^REINSTALL(?:MODE)?=')) 'fresh MSI install must not request previously installed features'
    Assert-Contract ($script:FixtureWaits.Count -eq 1 -and $script:FixtureWaits[0] -eq 180000) 'original process wait cap required'
  }},
  @{Name='same-build MSI upgrade retains exact repair flags';Body={
    Invoke-Installer 'upgrade'
    $installerArguments=$script:FixtureCalls[0].Arguments
    Assert-Contract ($installerArguments[0] -eq '/i' -and $installerArguments -contains 'REINSTALL=ALL' -and $installerArguments -contains 'REINSTALLMODE=amus') 'upgrade must retain explicit repair semantics'
  }},
  @{Name='MSI uninstall uses x and excludes repair flags';Body={
    Invoke-Installer 'uninstall'
    $installerArguments=$script:FixtureCalls[0].Arguments
    Assert-Contract ($installerArguments[0] -eq '/x' -and -not ($installerArguments -match '^REINSTALL(?:MODE)?=')) 'uninstall must remain removal'
  }},
  @{Name='installer reboot-required success is accepted without rebooting';Body={
    $script:FixtureExitCode=3010
    Invoke-Installer 'install'
    Assert-Contract ($script:FixtureKills -eq 0) 'successful installer must not be killed'
  }},
  @{Name='installer failure remains a failure';Body={
    $script:FixtureExitCode=1603
    $rejected=$false
    try {Invoke-Installer 'install'} catch {$rejected=$_.Exception.Message -like '*exit code 1603*'}
    Assert-Contract $rejected 'installer non-success exit must fail closed'
  }},
  @{Name='installer timeout preserves cap and kills only captured process';Body={
    $script:FixtureWaitSuccess=$false
    $rejected=$false
    try {Invoke-Installer 'install'} catch {$rejected=$_.Exception.Message -like '*180-second timeout*'}
    Assert-Contract ($rejected -and $script:FixtureKills -eq 1 -and $script:FixtureWaits[0] -eq 180000) 'installer timeout must preserve the original cap and owned-process cleanup'
  }},
  @{Name='unknown installer mode is rejected before process creation';Body={
    $rejected=$false
    try {Invoke-Installer 'unsupported'} catch {$rejected=$_.Exception -is [System.Management.Automation.ParameterBindingException]}
    Assert-Contract ($rejected -and $script:FixtureCalls.Count -eq 0) 'unknown installer mode must not spawn'
  }},
  @{Name='NSIS install upgrade and uninstall preserve silent owned helpers';Body={
    $installerKind='nsis'
    foreach($mode in @('install','upgrade','uninstall')){Invoke-Installer $mode}
    Assert-Contract ($script:FixtureCalls.Count -eq 3) 'three explicit NSIS operations required'
    foreach($call in $script:FixtureCalls){Assert-Contract ($call.Arguments.Count -eq 1 -and $call.Arguments[0] -eq '/S') 'NSIS must retain silent mode'}
    Assert-Contract ($script:FixtureCalls[2].FilePath -eq 'C:\covert-fixture\uninstall.exe') 'NSIS must use its resolved uninstaller'
  }}
)
$passed=0
$failed=0
foreach($case in $cases){
  Reset-Fixture
  try {
    & $case.Body
    foreach($call in $script:FixtureCalls){Assert-Contract ($call.PassThru -and $call.WindowStyle -eq 'Hidden') 'installer helper must preserve its process handle and remain hidden'}
    $passed+=1
    Write-Host ('PASS: '+$case.Name)
  }
  catch {$failed+=1; Write-Host ('FAIL: '+$case.Name+'; '+$_.Exception.Message)}
}
Write-Host ("installer contract: passed=$passed failed=$failed total="+$cases.Count+"; controlled-process-boundary only")
if($failed){exit 1}
exit 0
