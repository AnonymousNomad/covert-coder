param([string]$Root = '', [switch]$SafeScreenshotOnly, [switch]$OpenPickerOnLaunch, [switch]$UseLegacyPicker, [long]$StealFocusToHandle = 0)

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$rootPath = if ($Root) { [IO.Path]::GetFullPath($Root) } else { [IO.Path]::GetFullPath($PSScriptRoot) }
[xml]$markup = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Covert Desktop Control Fixture" Width="520" Height="560"
        AutomationProperties.AutomationId="covertDesktopFixtureWindow"
        WindowStartupLocation="CenterScreen">
  <StackPanel Margin="24">
    <TextBox x:Name="FixtureInput" AutomationProperties.AutomationId="fixtureTextInput"
             Text="" Width="420" Height="30" HorizontalAlignment="Left" />
    <TextBox x:Name="FixtureTabTarget" AutomationProperties.AutomationId="fixtureTabTarget"
             Text="" Width="420" Height="30" Margin="0,6,0,0" HorizontalAlignment="Left" />
    <TextBlock x:Name="FixtureStatus" AutomationProperties.AutomationId="fixtureStatus"
               Text="IDLE" Margin="0,8,0,0" />
    <TextBox x:Name="FixtureSelectedPath" AutomationProperties.AutomationId="fixtureSelectedPath"
             Text="" IsReadOnly="True" Width="420" Height="28" Margin="0,6,0,0" HorizontalAlignment="Left" />
    <TextBox x:Name="FixtureSelectedSha256" AutomationProperties.AutomationId="fixtureSelectedSha256"
             Text="" IsReadOnly="True" Width="420" Height="28" Margin="0,4,0,0" HorizontalAlignment="Left" />
    <ToggleButton x:Name="FixtureState" AutomationProperties.AutomationId="fixtureStateCheckbox"
                  Content="Fixture state" IsChecked="False" Width="150" Height="32" HorizontalAlignment="Left" />
    <Button x:Name="FixtureToggle" AutomationProperties.AutomationId="fixtureToggleButton"
            Content="Toggle fixture state" IsDefault="True" Width="180" Height="36" Margin="0,16,0,0" HorizontalAlignment="Left" />
    <Button x:Name="FixtureOpenPicker" AutomationProperties.AutomationId="fixtureOpenFilePickerButton"
            Content="Open fixture file picker" Width="220" Height="36" Margin="0,8,0,0" HorizontalAlignment="Left" />
    <PasswordBox x:Name="FixturePassword" AutomationProperties.AutomationId="fixtureFakeSecretField"
                 Password="FAKE-SECRET-NOT-REAL" Width="220" Height="28" Margin="0,12,0,0" HorizontalAlignment="Left" />
    <ScrollViewer x:Name="FixtureScroll" AutomationProperties.AutomationId="fixtureScrollViewer"
                  Height="100" Margin="0,16,0,0" VerticalScrollBarVisibility="Visible">
      <StackPanel>
        <TextBlock Text="Fixture row 01" Height="24" />
        <TextBlock Text="Fixture row 02" Height="24" />
        <TextBlock Text="Fixture row 03" Height="24" />
        <TextBlock Text="Fixture row 04" Height="24" />
        <TextBlock Text="Fixture row 05" Height="24" />
        <TextBlock Text="Fixture row 06" Height="24" />
        <TextBlock Text="Fixture row 07" Height="24" />
        <TextBlock Text="Fixture row 08" Height="24" />
        <TextBlock Text="Fixture row 09" Height="24" />
        <TextBlock Text="Fixture row 10" Height="24" />
        <TextBlock Text="Fixture row 11" Height="24" />
        <TextBlock Text="Fixture row 12" Height="24" />
      </StackPanel>
    </ScrollViewer>
  </StackPanel>
</Window>
'@

if ($SafeScreenshotOnly) {
  $passwordNode = $markup.SelectSingleNode('//*[local-name()="PasswordBox"]')
  if ($passwordNode) { [void]$passwordNode.ParentNode.RemoveChild($passwordNode) }
}

$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($markup.OuterXml))
$window = [Windows.Markup.XamlReader]::Load($reader)
$inputBox = $window.FindName('FixtureInput')
$status = $window.FindName('FixtureStatus')
$selectedPath = $window.FindName('FixtureSelectedPath')
$selectedSha256 = $window.FindName('FixtureSelectedSha256')
$state = $window.FindName('FixtureState')
$button = $window.FindName('FixtureToggle')
$inputBox.Add_TextChanged({ $status.Text = 'TEXT_RECEIVED' })
if ($StealFocusToHandle -gt 0) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CovertDesktopFixtureNative {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
}
'@ -ErrorAction Stop
  $script:focusStealScheduled = $false
  $script:focusStealTimer = New-Object System.Windows.Threading.DispatcherTimer
  $script:focusStealTimer.Interval = [TimeSpan]::FromMilliseconds(15)
  $script:focusStealTimer.Add_Tick({
    $script:focusStealTimer.Stop()
    [void][CovertDesktopFixtureNative]::SetForegroundWindow([IntPtr]::new($StealFocusToHandle))
  })
  $inputBox.Add_GotKeyboardFocus({
    if (-not $script:focusStealScheduled) {
      $script:focusStealScheduled = $true
      $script:focusStealTimer.Start()
    }
  })
}
$button.Add_Click({ $state.IsChecked = -not [bool]$state.IsChecked })
$window.Add_PreviewKeyDown({
  param($sender, $eventArgs)
  if ($eventArgs.Key -eq [System.Windows.Input.Key]::Enter) { $status.Text = 'ENTER_RECEIVED'; $eventArgs.Handled = $true }
  if ($eventArgs.Key -eq [System.Windows.Input.Key]::Escape) { $status.Text = 'ESCAPE_RECEIVED'; $eventArgs.Handled = $true }
  if ($eventArgs.Key -eq [System.Windows.Input.Key]::Back) { $status.Text = 'BACKSPACE_RECEIVED' }
  if ($eventArgs.Key -eq [System.Windows.Input.Key]::Delete) { $status.Text = 'DELETE_RECEIVED' }
})
$pickerButton = $window.FindName('FixtureOpenPicker')
$pickerButton.Add_Click({
  $fullName = $null
  if ($UseLegacyPicker) {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.AutoUpgradeEnabled = $false
    $dialog.InitialDirectory = $rootPath
    $dialog.Filter = 'Text files (*.txt)|*.txt'
    $dialog.Multiselect = $false
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $fullName = [IO.Path]::GetFullPath($dialog.FileName) }
  } else {
    $dialog = New-Object Microsoft.Win32.OpenFileDialog
    $dialog.InitialDirectory = $rootPath
    $dialog.Filter = 'Text files (*.txt)|*.txt'
    $dialog.Multiselect = $false
    if ($dialog.ShowDialog($window) -eq $true) { $fullName = [IO.Path]::GetFullPath($dialog.FileName) }
  }
  if ($fullName) {
    $rootPrefix = $rootPath.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($fullName.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.File]::ReadAllText($fullName) -eq 'COVERT-FILE-PICKER-FIXTURE') {
      $bytes = [IO.File]::ReadAllBytes($fullName)
      $sha = [System.Security.Cryptography.SHA256]::Create()
      try { $digest = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
      finally { $sha.Dispose() }
      $selectedPath.Text = $fullName
      $selectedSha256.Text = $digest
      $status.Text = 'FIXTURE_FILE_ACCEPTED'
    } else {
      $selectedPath.Text = ''
      $selectedSha256.Text = ''
      $status.Text = 'FIXTURE_FILE_REJECTED'
    }
  }
})

if ($OpenPickerOnLaunch) {
  $window.Add_Loaded({
    $pickerTimer = New-Object System.Windows.Threading.DispatcherTimer
    $pickerTimer.Interval = [TimeSpan]::FromMilliseconds(1500)
    $pickerTimer.Add_Tick({
      $pickerTimer.Stop()
      $clickArgs = [System.Windows.RoutedEventArgs]::new([System.Windows.Controls.Primitives.ButtonBase]::ClickEvent)
      [void]$pickerButton.RaiseEvent($clickArgs)
    })
    $pickerTimer.Start()
  })
}

$lifetime = New-Object System.Windows.Threading.DispatcherTimer
$lifetime.Interval = [TimeSpan]::FromSeconds(120)
$lifetime.Add_Tick({ $lifetime.Stop(); $window.Close() })
$lifetime.Start()
$window.Add_ContentRendered({ [void]$button.Focus() })
[void]$window.ShowDialog()
