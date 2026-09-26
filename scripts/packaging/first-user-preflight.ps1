param(
  [Parameter(Mandatory = $true)][string]$UserProfilePath,
  [Parameter(Mandatory = $true)][string]$ExpectedProductName,
  [Parameter(Mandatory = $true)][string]$ExpectedIdentifier,
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [Parameter(Mandatory = $true)][string]$ExpectedInstallerSha256,
  [Parameter(Mandatory = $true)][string]$CandidateSha,
  [Parameter(Mandatory = $true)][string]$CandidateVersion
)

$ErrorActionPreference = 'Stop'
$profilePath = [IO.Path]::GetFullPath($UserProfilePath).TrimEnd('\')
$currentProfile = [IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\')
$admin = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdministrator = $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$installerExists = Test-Path -LiteralPath $InstallerPath -PathType Leaf
$actualHash = if ($installerExists) { (Get-FileHash -LiteralPath $InstallerPath -Algorithm SHA256).Hash } else { $null }
$statePaths = @(
  [ordered]@{ kind = 'WEBVIEW PROFILE'; path = Join-Path $profilePath ("AppData\Local\" + $ExpectedIdentifier + '\EBWebView') },
  [ordered]@{ kind = 'APP CONFIG'; path = Join-Path $profilePath 'AppData\Roaming\Covert' },
  [ordered]@{ kind = 'LEGACY WORKSPACE STATE'; path = Join-Path $profilePath '.aide' }
)
$state = foreach ($entry in $statePaths) {
  [ordered]@{ kind = $entry.kind; path = $entry.path; exists = Test-Path -LiteralPath $entry.path }
}
$shortcutRoots = @(
  (Join-Path $profilePath 'Desktop'),
  (Join-Path $profilePath 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs')
) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }
$shortcuts = foreach ($shortcutRoot in $shortcutRoots) {
  Get-ChildItem -LiteralPath $shortcutRoot -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '(?i)(Covert|AIDE Sovereign Workbench)' } |
    ForEach-Object { $_.FullName }
}
$profileCurrent = $profilePath -eq $currentProfile
$cleanState = @($state | Where-Object { $_.exists }).Count -eq 0 -and @($shortcuts).Count -eq 0
$hashMatches = $installerExists -and $actualHash -eq $ExpectedInstallerSha256.ToUpperInvariant()
$uninstallRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
)
$namePattern = '(?i)(Covert|AIDE Sovereign Workbench|' + [Regex]::Escape($ExpectedProductName) + ')'
$registrations = foreach ($uninstallRoot in $uninstallRoots) {
  if (Test-Path -LiteralPath $uninstallRoot -PathType Container) {
    foreach ($key in Get-ChildItem -LiteralPath $uninstallRoot -ErrorAction SilentlyContinue) {
      $entry = Get-ItemProperty -LiteralPath $key.PSPath -Name DisplayName, DisplayVersion, InstallLocation -ErrorAction SilentlyContinue
      if ($entry.DisplayName -and ($entry.DisplayName -match $namePattern)) {
        [ordered]@{
          key = $key.PSChildName
          display_name = $entry.DisplayName
          display_version = $entry.DisplayVersion
          install_location = $entry.InstallLocation
        }
      }
    }
  }
}
[ordered]@{
  schema_version = 1
  operation = 'READ ONLY; must be run in the exact fresh standard-user session being qualified.'
  captured_at = [DateTime]::UtcNow.ToString('o')
  user = @{
    account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    profile_path = $profilePath
    profile_matches_current_user = $profileCurrent
    is_administrator = $isAdministrator
    standard_user = if ($profileCurrent) { -not $isAdministrator } else { $null }
  }
  candidate = @{
    installer_path = [IO.Path]::GetFullPath($InstallerPath)
    installer_exists = $installerExists
    expected_installer_sha256 = $ExpectedInstallerSha256.ToUpperInvariant()
    actual_installer_sha256 = $actualHash
    installer_hash_matches = $hashMatches
    source_sha = $CandidateSha
    version = $CandidateVersion
    expected_product_name = $ExpectedProductName
    expected_identifier = $ExpectedIdentifier
  }
  prior_state = @($state)
  matching_shortcuts = @($shortcuts)
  matching_uninstall_registrations = @($registrations)
  checks = @{
    standard_user = if ($profileCurrent -and -not $isAdministrator) { 'PASS' } else { 'FAIL OR UNVERIFIED' }
    clean_profile = if ($profileCurrent -and $cleanState -and @($registrations).Count -eq 0) { 'PASS' } else { 'FAIL' }
    installer_hash = if ($hashMatches) { 'PASS' } else { 'FAIL' }
    candidate_identity = if ($ExpectedProductName -and $ExpectedIdentifier -and $CandidateSha -and $CandidateVersion) { 'SUPPLIED; NOT INSPECTED' } else { 'FAIL' }
  }
} | ConvertTo-Json -Depth 8
