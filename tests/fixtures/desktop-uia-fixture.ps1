Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

[xml]$markup = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Covert Desktop Control Fixture" Width="440" Height="330"
        AutomationProperties.AutomationId="covertDesktopFixtureWindow"
        WindowStartupLocation="CenterScreen">
  <StackPanel Margin="24">
    <ToggleButton x:Name="FixtureState" AutomationProperties.AutomationId="fixtureStateCheckbox"
                  Content="Fixture state" IsChecked="False" Width="150" Height="32" HorizontalAlignment="Left" />
    <Button x:Name="FixtureToggle" AutomationProperties.AutomationId="fixtureToggleButton"
            Content="Toggle fixture state" Width="180" Height="36" Margin="0,16,0,0" HorizontalAlignment="Left" />
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

$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($markup.OuterXml))
$window = [Windows.Markup.XamlReader]::Load($reader)
$state = $window.FindName('FixtureState')
$button = $window.FindName('FixtureToggle')
$button.Add_Click({ $state.IsChecked = -not [bool]$state.IsChecked })

$lifetime = New-Object System.Windows.Threading.DispatcherTimer
$lifetime.Interval = [TimeSpan]::FromSeconds(120)
$lifetime.Add_Tick({ $lifetime.Stop(); $window.Close() })
$lifetime.Start()
[void]$window.ShowDialog()
