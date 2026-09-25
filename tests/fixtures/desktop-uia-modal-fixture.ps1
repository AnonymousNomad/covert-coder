param([ValidateSet('NONE', 'SAFE', 'UNEXPECTED', 'UNKNOWN', 'DESTRUCTIVE', 'FOREIGN')][string]$Kind = 'SAFE', [switch]$StartupOnly, [int]$ProbeShowSeconds = 0)

$ErrorActionPreference = 'Stop'
if ($ProbeShowSeconds -lt 0 -or $ProbeShowSeconds -gt 30) { throw 'MODAL_FIXTURE_PROBE_DURATION_INVALID' }
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$ownerMarkup = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:AutomationProperties="clr-namespace:System.Windows.Automation;assembly=PresentationCore"
        Title="Covert Desktop Modal Fixture" Width="420" Height="220"
        AutomationProperties.AutomationId="covertModalFixtureOwner"
        WindowStartupLocation="CenterScreen">
  <StackPanel Margin="20">
    <TextBlock Text="Disposable modal ownership fixture" />
    <TextBox x:Name="FixtureInput" AutomationProperties.AutomationId="modalFixtureInput"
             Text="" Width="350" Height="28" Margin="0,12,0,0" HorizontalAlignment="Left" />
    <ToggleButton x:Name="OwnerActionState" AutomationProperties.AutomationId="modalFixtureActionState"
                  Content="Safe action state" IsChecked="False" Width="220" Height="32" Margin="0,8,0,0"
                  HorizontalAlignment="Left" />
    <Button x:Name="OwnerSafeAction" AutomationProperties.AutomationId="modalFixtureSafeAction"
            Content="Run safe fixture action" Width="220" Height="34" Margin="0,6,0,0"
            HorizontalAlignment="Left" />
  </StackPanel>
</Window>
'@
$ownerReader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($ownerMarkup))
$owner = [Windows.Markup.XamlReader]::Load($ownerReader)
$owner.Add_ContentRendered({ [void]$owner.FindName('FixtureInput').Focus() })
$ownerActionState = $owner.FindName('OwnerActionState')
$owner.FindName('OwnerSafeAction').Add_Click({ $ownerActionState.IsChecked = $true })

$lifetime = New-Object System.Windows.Threading.DispatcherTimer
$lifetime.Interval = [TimeSpan]::FromSeconds($(if ($ProbeShowSeconds -gt 0) { $ProbeShowSeconds } else { 120 }))
$script:modalProbeWindow = $null
$lifetime.Add_Tick({
  $lifetime.Stop()
  if ($script:modalProbeWindow -and $script:modalProbeWindow.IsVisible) { $script:modalProbeWindow.Close() }
  if ($owner.IsVisible) { $owner.Close() }
})
$lifetime.Start()

if ($Kind -eq 'NONE') {
  [void]$owner.ShowDialog()
  return
}

$spec = switch ($Kind) {
  'SAFE' { @{ window_id = 'covertExpectedSafeModal'; description = 'Expected safe fixture confirmation'; control_id = 'expectedSafeToggle'; action_id = 'expectedSafeActionButton'; control_label = 'Continue safe fixture' } }
  'UNEXPECTED' { @{ window_id = 'covertUnexpectedOwnedModal'; description = 'Unexpected owned fixture prompt'; control_id = 'unexpectedOwnedToggle'; action_id = 'unexpectedOwnedActionButton'; control_label = 'Unexpected fixture action' } }
  'UNKNOWN' { @{ window_id = 'covertUnknownModal'; description = 'Unknown fixture prompt'; control_id = 'unknownModalToggle'; action_id = 'unknownModalActionButton'; control_label = 'Unknown fixture action' } }
  'DESTRUCTIVE' { @{ window_id = 'covertDestructiveLikeModal'; description = 'Delete disposable fixture data permanently?'; control_id = 'destructiveDeleteToggle'; action_id = 'destructiveDeleteActionButton'; control_label = 'Delete fixture data' } }
  'FOREIGN' { @{ window_id = 'covertForeignModal'; description = 'Foreign process fixture modal'; control_id = 'foreignModalToggle'; action_id = 'foreignModalActionButton'; control_label = 'Foreign fixture action' } }
  default { throw 'MODAL_FIXTURE_KIND_INVALID' }
}

$modalMarkup = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:AutomationProperties="clr-namespace:System.Windows.Automation;assembly=PresentationCore"
        Title="Covert Desktop Modal Fixture" Width="460" Height="260"
        AutomationProperties.AutomationId="$($spec.window_id)"
        WindowStartupLocation="CenterOwner" ShowInTaskbar="False">
  <StackPanel Margin="24">
    <TextBlock AutomationProperties.AutomationId="modalDescription" Text="$($spec.description)" TextWrapping="Wrap" />
    <ToggleButton x:Name="FixtureModalToggle" AutomationProperties.AutomationId="$($spec.control_id)"
                  Content="Observed fixture state" IsChecked="False" Width="240" Height="38"
                  Margin="0,18,0,0" HorizontalAlignment="Left" />
    <Button x:Name="FixtureModalAction" AutomationProperties.AutomationId="$($spec.action_id)"
            Content="$($spec.control_label)" Width="240" Height="38" Margin="0,8,0,0"
            HorizontalAlignment="Left" />
  </StackPanel>
</Window>
"@
$modalReader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($modalMarkup))
$modal = [Windows.Markup.XamlReader]::Load($modalReader)
if ($StartupOnly) {
  Write-Output "MODAL_XAML_LOAD_PASS=$Kind"
  return
}
$script:modalProbeWindow = $modal
[void]$owner.Show()
$modal.Owner = $owner
$script:modalFixtureToggle = $modal.FindName('FixtureModalToggle')
$modal.FindName('FixtureModalAction').Add_Click({ $script:modalFixtureToggle.IsChecked = $true })
$modal.Add_ContentRendered({ [void]$modal.FindName('FixtureModalToggle').Focus() })
if ($ProbeShowSeconds -gt 0) {
  $fixtureIdentity = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
  Write-Output ('MODAL_FIXTURE_ID=' + ($fixtureIdentity | Select-Object ProcessId, ExecutablePath, CreationDate | ConvertTo-Json -Compress))
}
[void]$modal.ShowDialog()
if ($ProbeShowSeconds -gt 0) { Write-Output "MODAL_RUNTIME_PROBE_COMPLETE=$Kind" }
$owner.Close()
