param(
  [Parameter(Mandatory = $true)][int]$TargetPid,
  [Parameter(Mandatory = $true)][long]$DialogHandle,
  [Parameter(Mandatory = $true)][long]$ResultWindowHandle,
  [Parameter(Mandatory = $true)][string]$SafeRoot,
  [Parameter(Mandatory = $true)][string]$TargetFile,
  [Parameter(Mandatory = $true)][string]$ExpectedSha256
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$script:phase = 'INITIALIZE'
$script:lastSafetyDiagnostic = $null
$script:lastOpenDiagnostic = $null
$script:charactersAttempted = 0
Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class DesktopPickerEntryNative {
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public KEYBDINPUT ki; [FieldOffset(0)] public MOUSEINPUT mi; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION U; }
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hWnd, StringBuilder text, int maxCount);
  [DllImport("user32.dll")] private static extern IntPtr GetParent(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] private static extern uint SendInput(uint count, INPUT[] inputs, int size);
  [DllImport("user32.dll", EntryPoint="SendMessageTimeoutW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern IntPtr SendMessageTimeoutText(IntPtr hWnd, uint message, UIntPtr wParam, [Out] StringBuilder lParam, uint flags, uint timeoutMs, out UIntPtr result);
  [DllImport("user32.dll", EntryPoint="SendMessageTimeoutW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern IntPtr SendMessageTimeoutMessage(IntPtr hWnd, uint message, UIntPtr wParam, IntPtr lParam, uint flags, uint timeoutMs, out UIntPtr result);
  public static uint GetOwnerPid(IntPtr hWnd) { uint processId; GetWindowThreadProcessId(hWnd, out processId); return processId; }
  public static string WindowClass(IntPtr hWnd) { var text = new StringBuilder(256); return GetClassName(hWnd, text, text.Capacity) > 0 ? text.ToString() : String.Empty; }
  public static string WindowText(IntPtr hWnd) {
    var text = new StringBuilder(4096); UIntPtr result;
    if (SendMessageTimeoutText(hWnd, 0x000D, new UIntPtr((uint)text.Capacity), text, 0x0002, 1000, out result) == IntPtr.Zero)
      throw new InvalidOperationException("PICKER_TEXT_READBACK_TIMEOUT");
    return text.ToString();
  }
  public static IntPtr Parent(IntPtr hWnd) { return GetParent(hWnd); }
  public static int ControlId(IntPtr hWnd) { return GetDlgCtrlID(hWnd); }
  public static long ForegroundHandle() { return GetForegroundWindow().ToInt64(); }
  public static bool IsWindowAlive(IntPtr hWnd) { return IsWindow(hWnd); }
  public static bool IsLiveVisibleWindow(IntPtr hWnd) { return IsWindow(hWnd) && IsWindowVisible(hWnd); }
  public static bool SendUnicode(string value) {
    var inputs = new List<INPUT>();
    foreach (char character in value) {
      var down = new INPUT(); down.type = 1; down.U.ki.wScan = character; down.U.ki.dwFlags = 4; inputs.Add(down);
      var up = down; up.U.ki.dwFlags = 6; inputs.Add(up);
    }
    return inputs.Count == 0 || SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf(typeof(INPUT))) == (uint)inputs.Count;
  }
  public static bool SendKey(ushort key, bool keyUp) {
    var input = new INPUT(); input.type = 1; input.U.ki.wVk = key; input.U.ki.dwFlags = keyUp ? 2U : 0U;
    return SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) == 1;
  }
  public static bool ClickButton(IntPtr hWnd) {
    UIntPtr result;
    return SendMessageTimeoutMessage(hWnd, 0x00F5, UIntPtr.Zero, IntPtr.Zero, 0x0002, 1500, out result) != IntPtr.Zero;
  }
}
'@ -ErrorAction Stop | Out-Null

function Get-RuntimeIdKey([System.Windows.Automation.AutomationElement]$Element) {
  return (@($Element.GetRuntimeId()) -join ',')
}

function Assert-TargetIdentity {
  $actual = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId = " + $TargetPid) -ErrorAction SilentlyContinue
  if ($null -eq $actual) { throw 'PICKER_PROCESS_IDENTITY_LOST' }
  $created = $actual.CreationDate
  if ($created -isnot [datetime]) { $created = [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$created) }
  $actualCreated = $created.ToUniversalTime().ToString('o')
  if ([string]$actual.Name -ine 'powershell.exe' -or [int]$actual.ParentProcessId -ne [int]$script:expectedIdentity.parent_pid -or
      [string]$actual.ExecutablePath -ine [string]$script:expectedIdentity.executable_path -or $actualCreated -cne [string]$script:expectedIdentity.created_at_utc) {
    throw 'PICKER_PROCESS_IDENTITY_CHANGED'
  }
}

function Assert-DialogLease {
  Assert-TargetIdentity
  $handle = [IntPtr]::new($DialogHandle)
  if (-not [DesktopPickerEntryNative]::IsLiveVisibleWindow($handle) -or
      [DesktopPickerEntryNative]::GetOwnerPid($handle) -ne [uint32]$TargetPid -or
      [DesktopPickerEntryNative]::WindowClass($handle) -cne '#32770') { throw 'PICKER_DIALOG_LEASE_LOST' }
  $element = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
  if ($null -eq $element -or [int]$element.Current.ProcessId -ne $TargetPid -or
      (Get-RuntimeIdKey $element) -cne [string]$script:dialogRuntimeId) { throw 'PICKER_DIALOG_LEASE_LOST' }
  return $element
}

function Get-DirectChildren {
  param([Parameter(Mandatory = $true)][System.Windows.Automation.AutomationElement]$Parent)
  $children = [System.Collections.Generic.List[System.Windows.Automation.AutomationElement]]::new()
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  $child = $walker.GetFirstChild($Parent)
  while ($null -ne $child -and $children.Count -lt 256) {
    [void]$children.Add($child)
    $child = $walker.GetNextSibling($child)
  }
  return $children.ToArray()
}

function Get-NativeWindowAncestry([IntPtr]$Handle) {
  $rows = [System.Collections.Generic.List[object]]::new()
  $cursor = $Handle
  for ($depth = 0; $depth -lt 16 -and $cursor -ne [IntPtr]::Zero; $depth++) {
    [void]$rows.Add([pscustomobject]@{
      hwnd = [long]$cursor.ToInt64()
      owner_pid = [long][DesktopPickerEntryNative]::GetOwnerPid($cursor)
      class_name = [DesktopPickerEntryNative]::WindowClass($cursor)
      control_id = [DesktopPickerEntryNative]::ControlId($cursor)
    })
    $cursor = [DesktopPickerEntryNative]::Parent($cursor)
  }
  return $rows.ToArray()
}

function Resolve-LabeledFilenameEdit([System.Windows.Automation.AutomationElement]$Dialog) {
  $direct = @(Get-DirectChildren -Parent $Dialog)
  $labels = @($direct | Where-Object { $_.Current.AutomationId -eq '1090' -and $_.Current.Name -ceq 'File name:' -and $_.Current.ClassName -ceq 'Static' })
  $outer = @($direct | Where-Object { $_.Current.AutomationId -eq '1148' -and $_.Current.ClassName -ceq 'ComboBoxEx32' })
  if ($labels.Count -ne 1 -or $outer.Count -ne 1) { throw 'PICKER_FILENAME_LABEL_RELATION_AMBIGUOUS' }
  $outerElement = [System.Windows.Automation.AutomationElement]$outer[0]
  $outerChildren = @(Get-DirectChildren -Parent $outerElement)
  $combo = @($outerChildren | Where-Object { $_.Current.AutomationId -eq '1148' -and $_.Current.ClassName -ceq 'ComboBox' })
  if ($combo.Count -ne 1) { throw 'PICKER_FILENAME_COMBO_AMBIGUOUS' }
  $comboElement = [System.Windows.Automation.AutomationElement]$combo[0]
  $comboChildren = @(Get-DirectChildren -Parent $comboElement)
  $edit = @($comboChildren | Where-Object { $_.Current.AutomationId -eq '1148' -and $_.Current.ClassName -ceq 'Edit' })
  if ($edit.Count -ne 1) { throw 'PICKER_FILENAME_EDIT_AMBIGUOUS' }
  if (-not $edit[0].Current.IsEnabled -or $edit[0].Current.IsOffscreen -or $edit[0].Current.IsPassword -or [int]$edit[0].Current.ProcessId -ne $TargetPid) {
    throw 'PICKER_FILENAME_EDIT_UNAVAILABLE'
  }
  $editHandle = [IntPtr]::new([long]$edit[0].Current.NativeWindowHandle)
  if ($editHandle -eq [IntPtr]::Zero -or -not [DesktopPickerEntryNative]::IsLiveVisibleWindow($editHandle) -or
      [DesktopPickerEntryNative]::GetOwnerPid($editHandle) -ne [uint32]$TargetPid -or
      [DesktopPickerEntryNative]::WindowClass($editHandle) -cne 'Edit' -or [DesktopPickerEntryNative]::Parent($editHandle) -eq [IntPtr]::Zero) {
    throw 'PICKER_FILENAME_NATIVE_IDENTITY_INVALID'
  }
  return [pscustomobject]@{ element = $edit[0]; handle = $editHandle; runtime_id = (Get-RuntimeIdKey $edit[0]) }
}

function Test-FocusedTarget($Target) {
  Assert-DialogLease | Out-Null
  $foreground = [long][DesktopPickerEntryNative]::ForegroundHandle()
  $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
  $matches = $false
  $focusedPid = $null
  $focusedHwnd = $null
  $focusedClass = $null
  $focusedId = $null
  if ($null -ne $focused) {
    $focusedPid = [int]$focused.Current.ProcessId
    $focusedHwnd = [long]$focused.Current.NativeWindowHandle
    $focusedClass = [string]$focused.Current.ClassName
    $focusedId = [string]$focused.Current.AutomationId
    $matches = ((Get-RuntimeIdKey $focused) -ceq [string]$Target.runtime_id -and
      $focusedPid -eq $TargetPid -and $focusedHwnd -eq $Target.handle.ToInt64() -and $focusedClass -ceq 'Edit' -and $focusedId -ceq '1148')
  }
  $targetFocused = [bool]$Target.element.Current.HasKeyboardFocus
  return [pscustomobject]@{
    pass = ($foreground -eq $DialogHandle -and $matches -and $targetFocused)
    foreground_handle = $foreground
    dialog_handle = $DialogHandle
    focused_pid = $focusedPid
    focused_native_window_handle = $focusedHwnd
    focused_class = $focusedClass
    focused_automation_id = $focusedId
    focused_runtime_id_matches = $matches
    target_has_keyboard_focus = $targetFocused
  }
}

function Assert-PathBoundary {
  $root = [IO.Path]::GetFullPath($SafeRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $target = [IO.Path]::GetFullPath($TargetFile)
  $rootPrefix = $root + [IO.Path]::DirectorySeparatorChar
  if (-not $target.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'PICKER_TARGET_OUTSIDE_ROOT' }
  if (-not [IO.Directory]::Exists($root) -or -not [IO.File]::Exists($target)) { throw 'PICKER_TARGET_MISSING' }
  $cursor = $target
  $reparsePoint = [IO.FileAttributes]::ReparsePoint
  $components = 0
  while ($cursor -and $cursor.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
    if (($item.Attributes -band $reparsePoint) -ne 0) { throw 'PICKER_TARGET_REPARSE_POINT' }
    $components++
    if ([string]::Equals($cursor.TrimEnd('\'), $root, [StringComparison]::OrdinalIgnoreCase)) { break }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  if (-not [string]::Equals($cursor.TrimEnd('\'), $root, [StringComparison]::OrdinalIgnoreCase)) { throw 'PICKER_TARGET_ROOT_CHAIN_INVALID' }
  $canonicalRoot = (Resolve-Path -LiteralPath $root -ErrorAction Stop).Path.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $canonicalTarget = (Resolve-Path -LiteralPath $target -ErrorAction Stop).Path
  if (-not $canonicalTarget.StartsWith(($canonicalRoot + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) { throw 'PICKER_TARGET_CANONICAL_ESCAPE' }
  $fileBytes = [IO.File]::ReadAllBytes($canonicalTarget)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { $digest = ([BitConverter]::ToString($sha.ComputeHash($fileBytes))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
  if ($digest -cne $ExpectedSha256) { throw 'PICKER_TARGET_IDENTITY_CHANGED' }
  return [pscustomobject]@{ root = $canonicalRoot; target = $canonicalTarget; basename = [IO.Path]::GetFileName($canonicalTarget); bytes = $fileBytes.Length; sha256 = $digest; path_components_checked = $components }
}

function Get-ControlValue([System.Windows.Automation.AutomationElement]$Element) {
  $pattern = $null
  if ($Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { return [string]$pattern.Current.Value }
  return [string]$Element.Current.Name
}

try {
  $script:phase = 'PROCESS_IDENTITY'
  $process = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId = " + $TargetPid) -ErrorAction Stop
  if ($null -eq $process -or [string]$process.Name -ine 'powershell.exe') { throw 'PICKER_TARGET_PROCESS_INVALID' }
  $created = $process.CreationDate
  if ($created -isnot [datetime]) { $created = [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$created) }
  $script:expectedIdentity = [ordered]@{
    parent_pid = [int]$process.ParentProcessId
    executable_path = [string]$process.ExecutablePath
    created_at_utc = $created.ToUniversalTime().ToString('o')
  }

  $script:phase = 'PATH_CONTAINMENT'
  $pathIdentity = Assert-PathBoundary
  $root = $pathIdentity.root
  $targetPath = $pathIdentity.target
  if ($targetPath.Length -gt 2048) { throw 'PICKER_TARGET_PATH_TOO_LONG' }

  $script:phase = 'DIALOG_LEASE'
  Assert-TargetIdentity
  $dialogHandle = [IntPtr]::new($DialogHandle)
  if (-not [DesktopPickerEntryNative]::IsLiveVisibleWindow($dialogHandle) -or
      [DesktopPickerEntryNative]::GetOwnerPid($dialogHandle) -ne [uint32]$TargetPid -or
      [DesktopPickerEntryNative]::WindowClass($dialogHandle) -cne '#32770') { throw 'PICKER_DIALOG_LEASE_LOST' }
  $dialogElement = [System.Windows.Automation.AutomationElement]::FromHandle($dialogHandle)
  if ($null -eq $dialogElement -or [int]$dialogElement.Current.ProcessId -ne $TargetPid) { throw 'PICKER_DIALOG_LEASE_LOST' }
  $script:dialogRuntimeId = Get-RuntimeIdKey $dialogElement
  $dialogElement = Assert-DialogLease
  $resultHandle = [IntPtr]::new($ResultWindowHandle)
  if (-not [DesktopPickerEntryNative]::IsLiveVisibleWindow($resultHandle) -or
      [DesktopPickerEntryNative]::GetOwnerPid($resultHandle) -ne [uint32]$TargetPid) { throw 'PICKER_RESULT_WINDOW_INVALID' }
  $resultElement = [System.Windows.Automation.AutomationElement]::FromHandle($resultHandle)
  if ([string]$resultElement.Current.AutomationId -cne 'covertDesktopFixtureWindow' -or [int]$resultElement.Current.ProcessId -ne $TargetPid) {
    throw 'PICKER_RESULT_WINDOW_INVALID'
  }
  $resultRuntimeId = Get-RuntimeIdKey $resultElement
  $target = Resolve-LabeledFilenameEdit $dialogElement
  $targetTextBefore = [DesktopPickerEntryNative]::WindowText($target.handle)
  if ($targetTextBefore.Length -ne 0) { throw 'PICKER_FILENAME_FIELD_NOT_EMPTY' }

  $script:phase = 'OPEN_CONTROL_RESOLUTION'
  $dialogChildren = @(Get-DirectChildren -Parent $dialogElement)
  $openCandidates = @($dialogChildren | Where-Object {
    $_.Current.AutomationId -eq '1' -and $_.Current.Name -ceq 'Open' -and $_.Current.ClassName -ceq 'Button' -and $_.Current.IsEnabled
  })
  if ($openCandidates.Count -ne 1) { throw 'PICKER_OPEN_BUTTON_AMBIGUOUS' }
  $openElement = [System.Windows.Automation.AutomationElement]$openCandidates[0]
  $openHandle = [IntPtr]::new([long]$openElement.Current.NativeWindowHandle)
  $openText = ''
  $openTextRead = $false
  if ($openHandle -ne [IntPtr]::Zero) {
    try { $openText = [DesktopPickerEntryNative]::WindowText($openHandle); $openTextRead = $true } catch { }
  }
  $nativeOpenChain = if ($openHandle -ne [IntPtr]::Zero) { @(Get-NativeWindowAncestry $openHandle) } else { @() }
  $nativeParentContainsDialog = @($nativeOpenChain | Where-Object { $_.hwnd -eq $DialogHandle }).Count -eq 1
  $directParentMatchesDialog = ($openHandle -ne [IntPtr]::Zero -and [DesktopPickerEntryNative]::Parent($openHandle).ToInt64() -eq $DialogHandle)
  $openPattern = $null
  $openInvokeAvailable = $false
  try { $openInvokeAvailable = [bool]$openElement.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$openPattern) } catch { }
  $script:lastOpenDiagnostic = [ordered]@{
    candidate_count = $openCandidates.Count
    hwnd_nonzero = ($openHandle -ne [IntPtr]::Zero)
    hwnd_live_visible = ($openHandle -ne [IntPtr]::Zero -and [DesktopPickerEntryNative]::IsLiveVisibleWindow($openHandle))
    owner_pid_matches = ($openHandle -ne [IntPtr]::Zero -and [DesktopPickerEntryNative]::GetOwnerPid($openHandle) -eq [uint32]$TargetPid)
    class_matches_button = ($openHandle -ne [IntPtr]::Zero -and [DesktopPickerEntryNative]::WindowClass($openHandle) -ceq 'Button')
    direct_parent_matches_dialog = $directParentMatchesDialog
    native_ancestry_reaches_dialog = $nativeParentContainsDialog
    native_control_id = if ($openHandle -ne [IntPtr]::Zero) { [DesktopPickerEntryNative]::ControlId($openHandle) } else { $null }
    label_read_succeeded = $openTextRead
    label_characters = $openText.Length
    label_is_open = ($openText -ceq 'Open' -or $openText -ceq '&Open')
    invoke_pattern = $openInvokeAvailable
    native_ancestor_chain = @($nativeOpenChain)
  }
  $openIdentityValid = ($script:lastOpenDiagnostic.hwnd_nonzero -and $script:lastOpenDiagnostic.hwnd_live_visible -and
    $script:lastOpenDiagnostic.owner_pid_matches -and $script:lastOpenDiagnostic.class_matches_button -and
    $nativeParentContainsDialog -and $script:lastOpenDiagnostic.native_control_id -eq 1 -and
    $script:lastOpenDiagnostic.label_read_succeeded -and $script:lastOpenDiagnostic.label_is_open)
  if (-not $openIdentityValid) { throw 'PICKER_OPEN_BUTTON_IDENTITY_INVALID' }
  $openRuntimeId = Get-RuntimeIdKey $openElement

  $script:phase = 'FOCUS_VALIDATION'
  $focus = Test-FocusedTarget $target
  if (-not $focus.pass) { throw 'PICKER_FOCUS_TARGET_UNPROVEN' }

  $script:phase = 'PRE_INPUT_REVALIDATION'
  Assert-DialogLease | Out-Null
  $focus = Test-FocusedTarget $target
  if (-not $focus.pass) { throw 'PICKER_FOCUS_CHANGED_BEFORE_INPUT' }
  $targetTextBefore = [DesktopPickerEntryNative]::WindowText($target.handle)
  if ($targetTextBefore.Length -ne 0) { throw 'PICKER_FILENAME_FIELD_CHANGED_BEFORE_INPUT' }

  $script:phase = 'INPUT_DISPATCH'
  $sentCompletely = [DesktopPickerEntryNative]::SendUnicode($targetPath)
  if ($sentCompletely) { $script:charactersAttempted = $targetPath.Length }
  else { $script:charactersAttempted = -1 }
  if (-not $sentCompletely) { throw 'PICKER_INPUT_REJECTED' }
  Start-Sleep -Milliseconds 100
  Assert-DialogLease | Out-Null
  $focusAfterInput = Test-FocusedTarget $target
  $enteredText = [DesktopPickerEntryNative]::WindowText($target.handle)
  $textMatches = [string]::Equals($enteredText, $targetPath, [StringComparison]::OrdinalIgnoreCase)
  $script:lastSafetyDiagnostic = [ordered]@{
    foreground_matches_dialog = ($focusAfterInput.foreground_handle -eq $DialogHandle)
    focused_runtime_id_matches = $focusAfterInput.focused_runtime_id_matches
    target_has_keyboard_focus = $focusAfterInput.target_has_keyboard_focus
    readback_characters = $enteredText.Length
    expected_characters = $targetPath.Length
    readback_matches = $textMatches
    characters_attempted = $script:charactersAttempted
  }
  if (-not $focusAfterInput.pass -or -not $textMatches) {
    throw 'PICKER_INPUT_POSTCONDITION_FAILED'
  }

  $script:phase = 'OPEN_DISPATCH'
  $dialogElement = Assert-DialogLease
  $focus = Test-FocusedTarget $target
  if (-not $focus.pass -or [DesktopPickerEntryNative]::WindowText($target.handle) -cne $targetPath) { throw 'PICKER_FOCUS_CHANGED_BEFORE_OPEN' }
  $currentOpenCandidates = @((Get-DirectChildren -Parent $dialogElement) | Where-Object {
    $_.Current.AutomationId -eq '1' -and $_.Current.Name -ceq 'Open' -and $_.Current.ClassName -ceq 'Button' -and $_.Current.IsEnabled
  })
  if ($currentOpenCandidates.Count -ne 1 -or (Get-RuntimeIdKey $currentOpenCandidates[0]) -cne $openRuntimeId -or
      [long]$currentOpenCandidates[0].Current.NativeWindowHandle -ne $openHandle.ToInt64()) { throw 'PICKER_OPEN_BUTTON_LEASE_LOST' }
  $openTextBeforeDispatch = [DesktopPickerEntryNative]::WindowText($openHandle)
  $openChainBeforeDispatch = @(Get-NativeWindowAncestry $openHandle)
  if (-not [DesktopPickerEntryNative]::IsLiveVisibleWindow($openHandle) -or
      [DesktopPickerEntryNative]::GetOwnerPid($openHandle) -ne [uint32]$TargetPid -or
      [DesktopPickerEntryNative]::WindowClass($openHandle) -cne 'Button' -or
      [DesktopPickerEntryNative]::Parent($openHandle).ToInt64() -ne $DialogHandle -or
      @($openChainBeforeDispatch | Where-Object { $_.hwnd -eq $DialogHandle }).Count -ne 1 -or
      [DesktopPickerEntryNative]::ControlId($openHandle) -ne 1 -or
      ($openTextBeforeDispatch -cne 'Open' -and $openTextBeforeDispatch -cne '&Open')) { throw 'PICKER_OPEN_BUTTON_IDENTITY_CHANGED' }
  $openPattern = $null
  $openDispatch = 'BM_CLICK_EXACT_OWNED_BUTTON'
  if ($openElement.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$openPattern)) {
    $openPattern.Invoke()
    $openDispatch = 'INVOKE_PATTERN'
  } else {
    if (-not [DesktopPickerEntryNative]::ClickButton($openHandle)) { throw 'PICKER_OPEN_BUTTON_DISPATCH_TIMEOUT' }
  }

  $script:phase = 'POSTCONDITION'
  $deadline = [DateTime]::UtcNow.AddSeconds(5)
  $statusValue = ''
  $selectedPathValue = ''
  $selectedHashValue = ''
  $dialogClosed = $false
  do {
    Start-Sleep -Milliseconds 100
    $dialogClosed = -not [DesktopPickerEntryNative]::IsWindowAlive([IntPtr]::new($DialogHandle))
    if (-not [DesktopPickerEntryNative]::IsLiveVisibleWindow($resultHandle) -or
        [DesktopPickerEntryNative]::GetOwnerPid($resultHandle) -ne [uint32]$TargetPid) { throw 'PICKER_RESULT_WINDOW_LEASE_LOST' }
    $currentResult = [System.Windows.Automation.AutomationElement]::FromHandle($resultHandle)
    if ((Get-RuntimeIdKey $currentResult) -cne $resultRuntimeId) { throw 'PICKER_RESULT_WINDOW_RECREATED' }
    $statusCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'fixtureStatus')
    $pathCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'fixtureSelectedPath')
    $hashCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'fixtureSelectedSha256')
    $statusElements = @($currentResult.FindAll([System.Windows.Automation.TreeScope]::Descendants, $statusCondition))
    $pathElements = @($currentResult.FindAll([System.Windows.Automation.TreeScope]::Descendants, $pathCondition))
    $hashElements = @($currentResult.FindAll([System.Windows.Automation.TreeScope]::Descendants, $hashCondition))
    if ($statusElements.Count -eq 1 -and $pathElements.Count -eq 1 -and $hashElements.Count -eq 1) {
      $statusValue = Get-ControlValue $statusElements[0]
      $selectedPathValue = Get-ControlValue $pathElements[0]
      $selectedHashValue = Get-ControlValue $hashElements[0]
    }
  } while ((!$dialogClosed -or $statusValue -cne 'FIXTURE_FILE_ACCEPTED' -or
    -not [string]::Equals($selectedPathValue, $targetPath, [StringComparison]::OrdinalIgnoreCase) -or $selectedHashValue -cne $ExpectedSha256) -and [DateTime]::UtcNow -lt $deadline)

  $verified = ($dialogClosed -and $statusValue -ceq 'FIXTURE_FILE_ACCEPTED' -and
    [string]::Equals($selectedPathValue, $targetPath, [StringComparison]::OrdinalIgnoreCase) -and $selectedHashValue -ceq $ExpectedSha256)
  if (-not $verified) { throw 'PICKER_APPLICATION_POSTCONDITION_FAILED' }

  $result = [ordered]@{
    schema_version = 1
    ok = $true
    phase = 'COMPLETE'
    provider = 'WINDOWS_COMMON_DIALOG'
    process_pid = $TargetPid
    dialog_handle = $DialogHandle
    dialog_class = '#32770'
    filename_entry = [ordered]@{ automation_id = '1148'; class_name = 'Edit'; native_window_handle = $target.handle.ToInt64(); label = 'File name:'; focus_runtime_id_verified = $true; value_pattern = $false; legacy_value_available = $false }
    path_containment = [ordered]@{ result = 'PASS'; target_basename = $pathIdentity.basename; components_checked = $pathIdentity.path_components_checked; reparse_point_seen = $false; bytes = $pathIdentity.bytes; sha256 = $pathIdentity.sha256 }
    input = [ordered]@{ method = 'VERIFIED_FOCUSED_NATIVE_EDIT_SENDINPUT_UNICODE'; characters_sent = $targetPath.Length; target_path_readback_matches = $true }
    open = [ordered]@{ control_id = 1; semantic_name = 'Open'; class_name = 'Button'; native_window_handle = $openHandle.ToInt64(); dispatch = $openDispatch }
    postcondition = [ordered]@{ dialog_closed = $dialogClosed; caller_status = $statusValue; caller_path_matches = $true; caller_sha256_matches = $true }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $result -Depth 30 -Compress))
} catch {
  $code = [string]$_.Exception.Message
  if ($code -notmatch '^PICKER_[A-Z0-9_]+$') { $code = 'PICKER_ENTRY_PROBE_ERROR' }
  $result = [ordered]@{
    schema_version = 1
    ok = $false
    code = $code
    phase = $script:phase
    target_pid = $TargetPid
      dialog_handle = $DialogHandle
      characters_attempted = $script:charactersAttempted
      safety_diagnostic = $script:lastSafetyDiagnostic
      open_diagnostic = $script:lastOpenDiagnostic
      diagnostic = [ordered]@{
      exception_type = $_.Exception.GetType().Name
      line = [int]$_.InvocationInfo.ScriptLineNumber
      command = [string]$_.InvocationInfo.MyCommand.Name
      category = [string]$_.CategoryInfo.Category
    }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $result -Depth 16 -Compress))
}
