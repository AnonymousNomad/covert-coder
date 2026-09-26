import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const NATIVE_HELPER = [
  'using System;',
  'using System.Collections.Generic;',
  'using System.Runtime.InteropServices;',
  'using System.Text;',
  'public static class CovertUiaNative {',
  '  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct GUITHREADINFO { public uint cbSize; public uint flags; public IntPtr hwndActive; public IntPtr hwndFocus; public IntPtr hwndCapture; public IntPtr hwndMenuOwner; public IntPtr hwndMoveSize; public IntPtr hwndCaret; public RECT rcCaret; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }',
  '  [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public KEYBDINPUT ki; [FieldOffset(0)] public MOUSEINPUT mi; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION U; }',
  '  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
  '  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);',
  '  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);',
  '  [DllImport("user32.dll")] private static extern IntPtr GetParent(IntPtr hWnd);',
  '  [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr hWnd);',
  '  [DllImport("user32.dll")] private static extern bool GetGUIThreadInfo(uint threadId, ref GUITHREADINFO info);',
  '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hWnd, StringBuilder className, int maxCount);',
  '  [DllImport("user32.dll", EntryPoint="SendMessageTimeoutW", CharSet=CharSet.Unicode, SetLastError=true)] private static extern IntPtr SendMessageTimeoutText(IntPtr hWnd, uint message, UIntPtr wParam, StringBuilder lParam, uint flags, uint timeoutMs, out UIntPtr result);',
  '  [DllImport("user32.dll", EntryPoint="SendMessageTimeoutW", CharSet=CharSet.Unicode, SetLastError=true)] private static extern IntPtr SendMessageTimeoutMessage(IntPtr hWnd, uint message, UIntPtr wParam, IntPtr lParam, uint flags, uint timeoutMs, out UIntPtr result);',
  '  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);',
  '  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);',
  '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);',
  '  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);',
  '  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);',
  '  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);',
  '  [DllImport("user32.dll")] public static extern uint SendInput(uint count, INPUT[] inputs, int size);',
  '  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);',
  '  public static uint GetOwnerPid(IntPtr hWnd) { uint processId; GetWindowThreadProcessId(hWnd, out processId); return processId; }',
  '  public static long[] VisibleWindowHandles(int targetPid) { var handles = new List<long>(); EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) { uint processId; GetWindowThreadProcessId(hWnd, out processId); if (processId == (uint)targetPid && IsWindowVisible(hWnd)) handles.Add(hWnd.ToInt64()); return true; }, IntPtr.Zero); return handles.ToArray(); }',
  '  public static string WindowClass(IntPtr hWnd) { var name = new StringBuilder(256); return GetClassName(hWnd, name, name.Capacity) > 0 ? name.ToString() : String.Empty; }',
  '  public static long ParentHandle(IntPtr hWnd) { return GetParent(hWnd).ToInt64(); }',
  '  public static int ControlId(IntPtr hWnd) { return GetDlgCtrlID(hWnd); }',
  '  public static bool IsLiveVisibleWindow(IntPtr hWnd) { return IsWindow(hWnd) && IsWindowVisible(hWnd); }',
  '  public static string WindowText(IntPtr hWnd) { var text = new StringBuilder(4096); UIntPtr result; if (SendMessageTimeoutText(hWnd, 0x000D, new UIntPtr((uint)text.Capacity), text, 0x0002, 1000, out result) == IntPtr.Zero) throw new InvalidOperationException("UIA_NATIVE_TEXT_READBACK_TIMEOUT"); return text.ToString(); }',
  '  public static bool ClickButton(IntPtr hWnd) { UIntPtr result; return SendMessageTimeoutMessage(hWnd, 0x00F5, UIntPtr.Zero, IntPtr.Zero, 0x0002, 1500, out result) != IntPtr.Zero; }',
  '  public static int SendUnicodeToVerifiedEdit(string value, long dialogHandle, long editHandle, uint expectedPid) { var dialog = new IntPtr(dialogHandle); var edit = new IntPtr(editHandle); if (!IsWindow(dialog) || !IsWindowVisible(dialog) || !IsWindow(edit) || !IsWindowVisible(edit) || GetForegroundWindow() != dialog || GetOwnerPid(dialog) != expectedPid || GetOwnerPid(edit) != expectedPid || WindowClass(edit) != "Edit") return 0; IntPtr cursor = edit; bool ownedChild = false; for (int depth = 0; depth < 16 && cursor != IntPtr.Zero; depth++) { if (cursor == dialog) { ownedChild = true; break; } cursor = GetParent(cursor); } if (!ownedChild) return 0; uint owner; uint threadId = GetWindowThreadProcessId(dialog, out owner); if (owner != expectedPid) return 0; var info = new GUITHREADINFO(); info.cbSize = (uint)Marshal.SizeOf(typeof(GUITHREADINFO)); if (!GetGUIThreadInfo(threadId, ref info) || info.hwndActive != dialog || info.hwndFocus != edit) return 0; return SendUnicode(value) ? 2 : 1; }',
  '  public static int ClickVerifiedOpenButton(long buttonHandle, long dialogHandle, uint expectedPid) { var button = new IntPtr(buttonHandle); var dialog = new IntPtr(dialogHandle); if (!IsWindow(dialog) || !IsWindowVisible(dialog) || !IsWindow(button) || !IsWindowVisible(button) || GetForegroundWindow() != dialog || GetOwnerPid(dialog) != expectedPid || GetOwnerPid(button) != expectedPid || WindowClass(button) != "Button" || GetParent(button) != dialog || GetDlgCtrlID(button) != 1) return 0; string text = WindowText(button); if (text != "Open" && text != "&Open") return 0; UIntPtr result; return SendMessageTimeoutMessage(button, 0x00F5, UIntPtr.Zero, IntPtr.Zero, 0x0002, 1500, out result) != IntPtr.Zero ? 2 : 1; }',
  '  public static bool SendUnicode(string value) { var inputs = new List<INPUT>(); foreach (char character in value) { var down = new INPUT(); down.type = 1; down.U.ki.wScan = character; down.U.ki.dwFlags = 4; inputs.Add(down); var up = down; up.U.ki.dwFlags = 6; inputs.Add(up); } return inputs.Count == 0 || SendInput((uint)inputs.Count, inputs.ToArray(), Marshal.SizeOf(typeof(INPUT))) == (uint)inputs.Count; }',
  '  public static bool SendKey(ushort key, bool keyUp) { var input = new INPUT(); input.type = 1; input.U.ki.wVk = key; input.U.ki.dwFlags = keyUp ? 2U : 0U; return SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) == 1; }',
  '  public static bool ClickAt(int x, int y) { if (!SetCursorPos(x, y)) return false; var down = new INPUT(); down.type = 0; down.U.mi.dwFlags = 2; var up = down; up.U.mi.dwFlags = 4; return SendInput(2, new INPUT[] { down, up }, Marshal.SizeOf(typeof(INPUT))) == 2; }',
  '}'
].join('\n');

const UIA_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop',
  'Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop',
  "$nativeSource = @'",
  NATIVE_HELPER,
  "'@",
  'Add-Type -TypeDefinition $nativeSource -ErrorAction Stop',
  '$envelope = [Console]::In.ReadToEnd() | ConvertFrom-Json',
  '$payload = $envelope.request',
  '$expected = $envelope.identity',
  'function Assert-TargetIdentity {',
  '  if ($script:identityCache.ok -and ([DateTime]::UtcNow - $script:identityCache.at).TotalSeconds -lt 2) { return }',
  '  $identityOk = $false; $identityAttempt = 0; $actual = $null; $actualCreated = $null',
  '  while (-not $identityOk -and $identityAttempt -lt 4) {',
  '    $actual = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId = " + [int]$expected.pid) -ErrorAction SilentlyContinue',
  '    if ($null -ne $actual) {',
  '      $created = $actual.CreationDate',
  '      if ($created -isnot [datetime]) { $created = [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$created) }',
  '      $actualCreated = $created.ToUniversalTime().ToString(\'yyyy-MM-ddTHH:mm:ss.fffZ\')',
  '      $identityOk = ([int]$actual.ParentProcessId -eq [int]$expected.parentPid -and [string]$actual.Name -ceq [string]$expected.name -and [string]$actual.ExecutablePath -ieq [string]$expected.executablePath -and $actualCreated -ceq [string]$expected.createdAtUtc)',
  '    }',
  '    if (-not $identityOk) { Start-Sleep -Milliseconds 120; $identityAttempt++ }',
  '  }',
  "  if (-not $identityOk) {",
  "    $script:identityDiagnostic = [pscustomobject]@{ expected_pid=[int]$expected.pid; expected_parent=[int]$expected.parentPid; expected_name=[string]$expected.name; expected_path=[string]$expected.executablePath; expected_created=[string]$expected.createdAtUtc; actual_present=($null -ne $actual); actual_parent=$([int]$actual.ParentProcessId); actual_name=[string]$actual.Name; actual_path=[string]$actual.ExecutablePath; actual_created=[string]$actualCreated }",
  "    throw 'UIA_PROCESS_IDENTITY_MISMATCH'",
  '  }',
  '  $script:identityCache = [pscustomobject]@{ at = [DateTime]::UtcNow; ok = $true }',
  '}',
  'function Get-WindowElement([long]$handle) { return [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]::new($handle)) }',
  'function Get-RuntimeIdKey($element) { return (@($element.GetRuntimeId()) -join \',\') }',
  'function Assert-LeasedWindow([long]$handle, [string]$runtimeId, [string]$className, [int]$ownerPid = 0) {',
  '  if ($ownerPid -eq 0) { $ownerPid = [int]$expected.pid }',
  '  Assert-TargetIdentity',
  '  if (-not [CovertUiaNative]::IsWindow([IntPtr]::new($handle))) { throw \'UIA_WINDOW_STALE\' }',
  '  $handles = @([CovertUiaNative]::VisibleWindowHandles([int]$ownerPid))',
  '  if ($handles -notcontains $handle -or [CovertUiaNative]::GetOwnerPid([IntPtr]::new($handle)) -ne [uint32]$ownerPid) { throw \'UIA_WINDOW_OWNER_MISMATCH\' }',
  '  $element = Get-WindowElement $handle',
  '  if ($null -eq $element -or (Get-RuntimeIdKey $element) -cne $runtimeId -or [CovertUiaNative]::WindowClass([IntPtr]::new($handle)) -cne $className) { throw \'UIA_WINDOW_STALE\' }',
  '  return $element',
  '}',
  'function Assert-TargetWindow { return Assert-LeasedWindow ([long]$payload.window_handle) ([string]$expected.windowRuntimeId) ([string]$expected.windowClassName) }',
  "$script:focusCheckDiagnostic = $null",
  "$script:identityDiagnostic = $null",
  "$script:identityCache = [pscustomobject]@{ at = [DateTime]::MinValue; ok = $false }",
  "$script:filePickerCheckDiagnostic = $null",
  "$script:inputPhase = 'NOT_STARTED'",
  'function Assert-InputFocus($element, [string]$stage) {',
  '  Assert-TargetWindow | Out-Null',
  '  $foreground = [long][CovertUiaNative]::GetForegroundWindow().ToInt64()',
  '  $controlFocused = [bool]$element.Current.HasKeyboardFocus',
  '  $script:focusCheckDiagnostic = [pscustomobject]@{ stage=$stage; expected_window_handle=[long]$payload.window_handle; foreground_window_handle=$foreground; foreground_matches=($foreground -eq [long]$payload.window_handle); control_has_keyboard_focus=$controlFocused }',
  '  if (-not $script:focusCheckDiagnostic.foreground_matches -or -not $controlFocused) { throw \'UIA_FOCUS_LOST\' }',
  '  Assert-TargetWindow | Out-Null',
  '  $foreground = [long][CovertUiaNative]::GetForegroundWindow().ToInt64()',
  '  $controlFocused = [bool]$element.Current.HasKeyboardFocus',
  '  $script:focusCheckDiagnostic = [pscustomobject]@{ stage=$stage; expected_window_handle=[long]$payload.window_handle; foreground_window_handle=$foreground; foreground_matches=($foreground -eq [long]$payload.window_handle); control_has_keyboard_focus=$controlFocused }',
  '  if (-not $script:focusCheckDiagnostic.foreground_matches -or -not $controlFocused) { throw \'UIA_FOCUS_LOST\' }',
  '}',
  'function Get-SafeFocusSnapshot($window, $target, [string]$stage) {',
  '  $foreground = [long][CovertUiaNative]::GetForegroundWindow().ToInt64()',
  '  $windowFocused = [bool]$window.Current.HasKeyboardFocus',
  '  $targetFocused = [bool]$target.Current.HasKeyboardFocus',
  '  $focusedProcessId = $null',
  '  $focusedWindowHandle = $null',
  '  $focusedElement = $null',
  '  $focusedElementWithinWindow = $false',
  '  $focusReadErrorType = $null',
  '  $treeCheckErrorType = $null',
  '  try {',
  '    $focusedElement = [System.Windows.Automation.AutomationElement]::FocusedElement',
  '    if ($null -ne $focusedElement) { $focusedProcessId = [int]$focusedElement.Current.ProcessId; $focusedWindowHandle = [long]$focusedElement.Current.NativeWindowHandle }',
  '  } catch { $focusReadErrorType = [string]$_.Exception.GetType().Name }',
  '  if ($null -ne $focusedElement) {',
  '    try {',
  '      $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker',
  '      $windowRuntimeId = Get-RuntimeIdKey $window',
  '      $node = $focusedElement',
  '      for ($depth = 0; $depth -lt 64 -and $null -ne $node; $depth++) {',
  '        if ((Get-RuntimeIdKey $node) -ceq $windowRuntimeId) { $focusedElementWithinWindow = $true; break }',
  '        $node = $walker.GetParent($node)',
  '      }',
  '    } catch { $treeCheckErrorType = [string]$_.Exception.GetType().Name }',
  '  }',
  '  return [pscustomobject]@{ stage=$stage; expected_window_handle=[long]$payload.window_handle; foreground_window_handle=$foreground; foreground_matches=($foreground -eq [long]$payload.window_handle); window_has_keyboard_focus=$windowFocused; target_has_keyboard_focus=$targetFocused; focused_process_id=$focusedProcessId; focused_native_window_handle=$focusedWindowHandle; focused_element_within_window=$focusedElementWithinWindow; focus_read_error_type=$focusReadErrorType; tree_check_error_type=$treeCheckErrorType }',
  '}',
  'function Set-InputFocus($element) {',
  '  Assert-TargetWindow | Out-Null',
  '  $foreground = [long][CovertUiaNative]::GetForegroundWindow().ToInt64()',
  "  $script:inputPhase = 'SET_FOCUS'",
  '  $script:focusCheckDiagnostic = [pscustomobject]@{ stage=\'SET_FOCUS\'; expected_window_handle=[long]$payload.window_handle; foreground_window_handle=$foreground; foreground_matches=($foreground -eq [long]$payload.window_handle); control_is_keyboard_focusable=[bool]$element.Current.IsKeyboardFocusable; control_has_keyboard_focus=[bool]$element.Current.HasKeyboardFocus; control_enabled=[bool]$element.Current.IsEnabled; control_offscreen=[bool]$element.Current.IsOffscreen }',
  '  if ($foreground -ne [long]$payload.window_handle) { throw \'UIA_FOCUS_LOST\' }',
  '  $element.SetFocus()',
  '  Start-Sleep -Milliseconds 50',
  "  $script:inputPhase = 'BEFORE_INPUT'",
  "  Assert-InputFocus $element 'BEFORE_INPUT'",
  '}',
  'function Assert-ForegroundWindow([string]$stage) {',
  '  Assert-TargetWindow | Out-Null',
  '  $foreground = [long][CovertUiaNative]::GetForegroundWindow().ToInt64()',
  '  $matches = ($foreground -eq [long]$payload.window_handle)',
  '  $script:focusCheckDiagnostic = [pscustomobject]@{ stage=$stage; expected_window_handle=[long]$payload.window_handle; foreground_window_handle=$foreground; foreground_matches=$matches }',
  '  if (-not $matches) { throw \'UIA_FOCUS_LOST\' }',
  '  Assert-TargetWindow | Out-Null',
  '}',
  'function Find-Control([string]$automationId) {',
  '  $window = Assert-TargetWindow',
  '  $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, $automationId)',
  '  $elements = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition))',
  '  if ($elements.Count -ne 1) { throw \'UIA_CONTROL_NOT_UNIQUE\' }',
  '  $element = $elements[0]',
  '  if (-not $element.Current.IsEnabled -or $element.Current.IsOffscreen -or $element.Current.IsPassword) { throw \'UIA_CONTROL_UNAVAILABLE\' }',
  '  return $element',
  '}',
  'function Find-ControlByName([string]$name) {',
  '  $window = Assert-TargetWindow',
  '  # WebView2 DOM elements report the webview process, so resolution is scoped',
  '  # to the leased window subtree (and exact name uniqueness) instead of a PID.',
  '  $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, $name)',
  '  $elements = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition) | Where-Object { $_.Current.IsControlElement })',
  '  if ($elements.Count -eq 0) {',
  '    $trimmed = $name.Trim()',
  '    $elements = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.IsControlElement -and ([string]$_.Current.Name).Trim() -ceq $trimmed })',
  '  }',
  '  if ($elements.Count -ne 1) {',
  '    $candidateRows = @()',
  '    foreach ($candidate in $elements) { $candidateType = \'\'; try { $candidateType = [string]$candidate.Current.ControlType.ProgrammaticName } catch { }; $candidateRows += ("{0}:{1}:control={2}" -f $candidateType, $(if ($candidate.Current.IsEnabled) { \'enabled\' } else { \'disabled\' }), $(if ($candidate.Current.IsControlElement) { \'yes\' } else { \'no\' })) }',
  '    if ($candidateRows.Count -eq 0) {',
  '      $needle = $name.Trim().Split(\':\')[0]',
  '      $nearby = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { ([string]$_.Current.Name) -like ("*" + $needle + "*") } | Select-Object -First 6 | ForEach-Object { ([string]$_.Current.Name).Substring(0, [Math]::Min(60, ([string]$_.Current.Name).Length)) })',
  '      $candidateRows = @($nearby | ForEach-Object { "near:$_" })',
  '    }',
  '    $script:controlNameDiagnostic = $candidateRows',
  '    throw \'UIA_CONTROL_NOT_UNIQUE\'',
  '  }',
  '  $element = $elements[0]',
  '  if (-not $element.Current.IsEnabled -or $element.Current.IsOffscreen -or $element.Current.IsPassword) { throw \'UIA_CONTROL_UNAVAILABLE\' }',
  '  return $element',
  '}',
  'function Resolve-SemanticControl([string]$automationId, [string]$name) {',
  '  if ($automationId) { return Find-Control $automationId }',
  '  return Find-ControlByName $name',
  '}',
  'function Get-ClassWindowHandles([string]$className) {',
  '  # Direct owned children are included because Chromium opens the native file',
  '  # picker in a sandboxed child process of the browser. Only direct children',
  '  # of the verified target are considered; no image or command-line search.',
  '  $handles = @([CovertUiaNative]::VisibleWindowHandles([int]$expected.pid))',
  '  $childPids = @(Get-CimInstance Win32_Process -Filter ("ParentProcessId = " + [int]$expected.pid) -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessId)',
  '  foreach ($childPid in $childPids) { $handles += @([CovertUiaNative]::VisibleWindowHandles([int]$childPid)) }',
  '  return @($handles | Where-Object { [CovertUiaNative]::WindowClass([IntPtr]::new([long]$_)) -ceq $className } | ForEach-Object { [long]$_ })',
  '}',
  'function Find-TextPatternSurface($window) {',
  '  # Console windows expose their text through the conhost UIA provider, so the',
  '  # element ProcessId is the console host, not the leased client. Scope the',
  '  # search to the leased window subtree instead of matching the client PID.',
  '  $surfaces = @($window.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition) | Select-Object -First 256)',
  '  foreach ($candidate in $surfaces) {',
  '    try {',
  '      if ($candidate.Current.IsPassword -or $candidate.Current.IsOffscreen) { continue }',
  '      $candidatePattern = $null',
  '      if ($candidate.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$candidatePattern)) { return $candidate }',
  '    } catch { }',
  '  }',
  '  return $null',
  '}',
  'function Read-TextPatternSurface($surface) {',
  '  try {',
  '    $pattern = $null',
  '    if (-not $surface.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern)) { return $null }',
  '    $ranges = $pattern.GetVisibleRanges()',
  '    $builder = New-Object System.Text.StringBuilder',
  '    foreach ($range in $ranges) {',
  '      if ($builder.Length -ge 8192) { break }',
  '      [void]$builder.Append($range.GetText(8192 - $builder.Length))',
  '    }',
  '    return $builder.ToString()',
  '  } catch { return $null }',
  '}',
  'function Get-SafeControlValue($element) {',
  '  if ($element.Current.IsPassword) { throw \'UIA_SENSITIVE_CONTROL\' }',
  '  $pattern = $null',
  '  if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { return [string]$pattern.Current.Value }',
  '  return [string]$element.Current.Name',
  '}',
  'function Get-DirectUiChildren($parent) {',
  '  $children = [System.Collections.Generic.List[System.Windows.Automation.AutomationElement]]::new()',
  '  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker',
  '  $child = $walker.GetFirstChild($parent)',
  '  while ($null -ne $child -and $children.Count -lt 256) { [void]$children.Add($child); $child = $walker.GetNextSibling($child) }',
  '  return $children.ToArray()',
  '}',
  'function Get-NativeParentChain([IntPtr]$handle) {',
  '  $handles = [System.Collections.Generic.List[long]]::new(); $cursor = $handle',
  '  for ($depth = 0; $depth -lt 16 -and $cursor -ne [IntPtr]::Zero; $depth++) { [void]$handles.Add($cursor.ToInt64()); $cursor = [IntPtr]::new([CovertUiaNative]::ParentHandle($cursor)) }',
  '  return $handles.ToArray()',
  '}',
  'function Resolve-PickerFilenameEdit($dialog) {',
  '  $direct = @(Get-DirectUiChildren $dialog)',
  '  $labels = @($direct | Where-Object { $_.Current.AutomationId -ceq \'1090\' -and $_.Current.Name -ceq \'File name:\' -and $_.Current.ClassName -ceq \'Static\' -and [int]$_.Current.ProcessId -eq [int]$expected.pid })',
  '  $outer = @($direct | Where-Object { $_.Current.AutomationId -ceq \'1148\' -and $_.Current.ClassName -ceq \'ComboBoxEx32\' -and [int]$_.Current.ProcessId -eq [int]$expected.pid })',
  '  if ($labels.Count -ne 1 -or $outer.Count -ne 1) { throw \'UIA_FILE_PICKER_CONTROL_AMBIGUOUS\' }',
  '  $labelIndex = -1; $outerIndex = -1',
  '  for ($index = 0; $index -lt $direct.Count; $index++) { $runtimeId = Get-RuntimeIdKey $direct[$index]; if ($runtimeId -ceq (Get-RuntimeIdKey $labels[0])) { $labelIndex = $index }; if ($runtimeId -ceq (Get-RuntimeIdKey $outer[0])) { $outerIndex = $index } }',
  '  if ($labelIndex -lt 0 -or $outerIndex -ne ($labelIndex + 1)) { throw \'UIA_FILE_PICKER_CONTROL_AMBIGUOUS\' }',
  '  $outerElement = [System.Windows.Automation.AutomationElement]$outer[0]',
  '  $combos = @((Get-DirectUiChildren $outerElement) | Where-Object { $_.Current.AutomationId -ceq \'1148\' -and $_.Current.ClassName -ceq \'ComboBox\' -and [int]$_.Current.ProcessId -eq [int]$expected.pid })',
  '  if ($combos.Count -ne 1) { throw \'UIA_FILE_PICKER_CONTROL_AMBIGUOUS\' }',
  '  $comboElement = [System.Windows.Automation.AutomationElement]$combos[0]',
  '  $edits = @((Get-DirectUiChildren $comboElement) | Where-Object { $_.Current.AutomationId -ceq \'1148\' -and $_.Current.ClassName -ceq \'Edit\' -and [int]$_.Current.ProcessId -eq [int]$expected.pid })',
  '  if ($edits.Count -ne 1) { throw \'UIA_FILE_PICKER_CONTROL_AMBIGUOUS\' }',
  '  $edit = [System.Windows.Automation.AutomationElement]$edits[0]',
  '  if (-not $edit.Current.IsEnabled -or $edit.Current.IsOffscreen -or $edit.Current.IsPassword) { throw \'UIA_FILE_PICKER_CONTROL_UNAVAILABLE\' }',
  '  $handle = [IntPtr]::new([long]$edit.Current.NativeWindowHandle)',
  '  if ($handle -eq [IntPtr]::Zero -or -not [CovertUiaNative]::IsLiveVisibleWindow($handle) -or [CovertUiaNative]::GetOwnerPid($handle) -ne [uint32]$expected.pid -or [CovertUiaNative]::WindowClass($handle) -cne \'Edit\') { throw \'UIA_FILE_PICKER_CONTROL_UNAVAILABLE\' }',
  '  $nativeAncestors = @(Get-NativeParentChain $handle)',
  '  if ($nativeAncestors -notcontains [long]$payload.window_handle) { throw \'UIA_FILE_PICKER_CONTROL_UNAVAILABLE\' }',
  '  return [pscustomobject]@{ element=$edit; handle=$handle; runtime_id=(Get-RuntimeIdKey $edit); label_runtime_id=(Get-RuntimeIdKey $labels[0]); outer_runtime_id=(Get-RuntimeIdKey $outerElement); combo_runtime_id=(Get-RuntimeIdKey $comboElement); label_adjacent=$true }',
  '}',
  'function Resolve-PickerOpenButton($dialog) {',
  '  $buttons = @((Get-DirectUiChildren $dialog) | Where-Object { $_.Current.AutomationId -ceq \'1\' -and $_.Current.Name -ceq \'Open\' -and $_.Current.ClassName -ceq \'Button\' -and $_.Current.IsEnabled -and [int]$_.Current.ProcessId -eq [int]$expected.pid })',
  '  if ($buttons.Count -ne 1) { throw \'UIA_FILE_PICKER_CONTROL_AMBIGUOUS\' }',
  '  $button = [System.Windows.Automation.AutomationElement]$buttons[0]; $handle = [IntPtr]::new([long]$button.Current.NativeWindowHandle)',
  '  if ($handle -eq [IntPtr]::Zero -or -not [CovertUiaNative]::IsLiveVisibleWindow($handle) -or [CovertUiaNative]::GetOwnerPid($handle) -ne [uint32]$expected.pid -or [CovertUiaNative]::WindowClass($handle) -cne \'Button\' -or [CovertUiaNative]::ParentHandle($handle) -ne [long]$payload.window_handle -or [CovertUiaNative]::ControlId($handle) -ne 1) { throw \'UIA_FILE_PICKER_CONTROL_UNAVAILABLE\' }',
  '  $nativeText = [CovertUiaNative]::WindowText($handle)',
  '  if ($nativeText -cne \'Open\' -and $nativeText -cne \'&Open\') { throw \'UIA_FILE_PICKER_CONTROL_UNAVAILABLE\' }',
  '  return [pscustomobject]@{ element=$button; handle=$handle; runtime_id=(Get-RuntimeIdKey $button) }',
  '}',
  'function Test-PickerFilenameFocus($target) {',
  '  Assert-TargetWindow | Out-Null',
  '  $foreground = [long][CovertUiaNative]::GetForegroundWindow().ToInt64(); $focused = $null; $runtimeMatch = $false; $focusedPid = $null; $focusedHandle = $null; $focusedClass = $null; $focusedAutomationId = $null',
  '  try { $focused = [System.Windows.Automation.AutomationElement]::FocusedElement } catch { }',
  '  if ($null -ne $focused) { $focusedPid = [int]$focused.Current.ProcessId; $focusedHandle = [long]$focused.Current.NativeWindowHandle; $focusedClass = [string]$focused.Current.ClassName; $focusedAutomationId = [string]$focused.Current.AutomationId; $runtimeMatch = ((Get-RuntimeIdKey $focused) -ceq [string]$target.runtime_id) }',
  '  $targetFocus = [bool]$target.element.Current.HasKeyboardFocus',
  '  return [pscustomobject]@{ pass=($foreground -eq [long]$payload.window_handle -and $runtimeMatch -and $targetFocus -and $focusedPid -eq [int]$expected.pid -and $focusedHandle -eq $target.handle.ToInt64() -and $focusedClass -ceq \'Edit\' -and $focusedAutomationId -ceq \'1148\'); foreground_handle=$foreground; runtime_id_matches=$runtimeMatch; target_has_keyboard_focus=$targetFocus; focused_pid=$focusedPid; focused_handle=$focusedHandle; focused_class=$focusedClass; focused_automation_id=$focusedAutomationId }',
  '}',
  'function Assert-PickerFilenameFocus($target, [string]$stage, [bool]$allowSemanticRefocus) {',
  '  $focus = Test-PickerFilenameFocus $target',
  '  if ($allowSemanticRefocus -and -not $focus.pass -and $focus.foreground_handle -eq [long]$payload.window_handle) { try { $target.element.SetFocus(); Start-Sleep -Milliseconds 50 } catch { } ; $focus = Test-PickerFilenameFocus $target }',
  '  $script:focusCheckDiagnostic = [pscustomobject]@{ stage=$stage; expected_window_handle=[long]$payload.window_handle; foreground_window_handle=$focus.foreground_handle; foreground_matches=($focus.foreground_handle -eq [long]$payload.window_handle); focused_runtime_id_matches=$focus.runtime_id_matches; target_has_keyboard_focus=$focus.target_has_keyboard_focus; focused_process_id=$focus.focused_pid; focused_native_window_handle=$focus.focused_handle; focused_class=$focus.focused_class; focused_automation_id=$focus.focused_automation_id }',
  '  if (-not $focus.pass) { throw \'UIA_FOCUS_LOST\' }',
  '}',
  'function Get-FileSha256([string]$filePath) {',
  '  $stream = [IO.File]::Open($filePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read); $sha = [System.Security.Cryptography.SHA256]::Create()',
  '  try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace(\'-\', \'\').ToLowerInvariant() } finally { $sha.Dispose(); $stream.Dispose() }',
  '}',
  'function Get-ValueHash([string]$value) {',
  '  $sha = [System.Security.Cryptography.SHA256]::Create()',
  '  try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($value)))).Replace(\'-\', \'\').ToLowerInvariant() } finally { $sha.Dispose() }',
  '}',
  'try {',
  '  Assert-TargetIdentity',
  '  $windowHandles = @([CovertUiaNative]::VisibleWindowHandles([int]$expected.pid))',
  '  $allWindows = @($windowHandles | ForEach-Object { [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]::new([long]$_)) } | Where-Object { $null -ne $_ })',
  '  if ($payload.action -eq \'discover\') {',
  '    $eligibleWindows = @($allWindows | Where-Object { $_.Current.NativeWindowHandle -ne 0 -and $_.Current.IsControlElement })',
  '    $rows = @($eligibleWindows | Select-Object -First 64 | ForEach-Object {',
  '      $class = [CovertUiaNative]::WindowClass([IntPtr]::new([long]$_.Current.NativeWindowHandle))',
  '      $automationId = [string]$_.Current.AutomationId',
  '      [pscustomobject]@{ window_handle=[long]$_.Current.NativeWindowHandle; process_id=[int]$expected.pid; runtime_id=@($_.GetRuntimeId() | Select-Object -First 16); class_name=$class.Substring(0, [Math]::Min($class.Length, 128)); automation_id=$automationId.Substring(0, [Math]::Min($automationId.Length, 64)) }',
  '    })',
  '    $result = [pscustomobject]@{ ok=$true; verified=$true; action=\'discover\'; details=[pscustomobject]@{ windows=$rows; windows_truncated=($eligibleWindows.Count -gt 64) } }',
  '  } else {',
  '    if ($windowHandles -notcontains [long]$payload.window_handle) { throw \'UIA_WINDOW_OWNER_MISMATCH\' }',
  '    $matches = @($allWindows | Where-Object { [long]$_.Current.NativeWindowHandle -eq [long]$payload.window_handle -and [CovertUiaNative]::GetOwnerPid([IntPtr]::new([long]$_.Current.NativeWindowHandle)) -eq [uint32]$expected.pid })',
  "    if ($matches.Count -ne 1) { throw 'UIA_WINDOW_NOT_UNIQUE' }",
  '    $window = Assert-TargetWindow',
  '    if (-not $window.Current.IsEnabled -or $window.Current.IsOffscreen) { throw \'UIA_WINDOW_UNAVAILABLE\' }',
  '    $verified = $false',
  '    $details = [pscustomobject]@{ window_handle=[int]$payload.window_handle; action=[string]$payload.action }',
  '    Assert-TargetIdentity',
  '    switch ([string]$payload.action) {',
  '      inspect {',
  '        $eligibleControls = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.IsControlElement -and -not $_.Current.IsPassword -and $_.Current.AutomationId })',
  '        $controls = @($eligibleControls | Select-Object -First 256 | ForEach-Object { $id = [string]$_.Current.AutomationId; [pscustomobject]@{ automation_id=$id.Substring(0, [Math]::Min($id.Length, 64)); control_type=[string]$_.Current.ControlType.ProgrammaticName; enabled=[bool]$_.Current.IsEnabled; offscreen=[bool]$_.Current.IsOffscreen } })',
  '        $verified = $true',
  '        $details | Add-Member -NotePropertyName controls -NotePropertyValue $controls',
  '        $details | Add-Member -NotePropertyName controls_truncated -NotePropertyValue ($eligibleControls.Count -gt 256)',
  '      }',
  '      focus {',
  '        Assert-TargetWindow | Out-Null',
  '        if ($payload.automation_id) { $focusElement = Find-Control ([string]$payload.automation_id) } else { $focusElement = $window }',
  "        $script:focusCheckDiagnostic = Get-SafeFocusSnapshot $window $focusElement 'BEFORE_SET_FOCUS'",
  '        $focusElement.SetFocus()',
  '        Start-Sleep -Milliseconds 100',
  '        $focusDeadline = [DateTime]::UtcNow.AddSeconds(2); $verified = $false',
  '        do {',
  '          Assert-TargetWindow | Out-Null',
  "          $script:focusCheckDiagnostic = Get-SafeFocusSnapshot $window $focusElement 'AFTER_SET_FOCUS'",
  '          $targetFocused = if ($payload.automation_id) { $script:focusCheckDiagnostic.target_has_keyboard_focus } else { $script:focusCheckDiagnostic.focused_element_within_window }',
  '          $foregroundHandle = [CovertUiaNative]::GetForegroundWindow()',
  '          $foregroundOwnerPid = if ($foregroundHandle -ne [IntPtr]::Zero) { [CovertUiaNative]::GetOwnerPid($foregroundHandle) } else { 0 }',
  '          $processMatches = ($script:focusCheckDiagnostic.focused_process_id -eq [int]$expected.pid) -or ($foregroundOwnerPid -eq [uint32]$expected.pid)',
  '          $verified = ($script:focusCheckDiagnostic.foreground_matches -and $processMatches -and $script:focusCheckDiagnostic.focused_element_within_window -and $targetFocused)',
  '          if (-not $verified) { Start-Sleep -Milliseconds 150; $focusElement.SetFocus() }',
  '        } while (-not $verified -and [DateTime]::UtcNow -lt $focusDeadline)',
  "        if (-not $verified) { throw 'UIA_FOCUS_LOST' }",
  '        $details | Add-Member -NotePropertyName focus_owner_pid -NotePropertyValue ([int]$foregroundOwnerPid)',
  '        $details | Add-Member -NotePropertyName focus_provider_pid -NotePropertyValue ([int]$script:focusCheckDiagnostic.focused_process_id)',
  '        if ($payload.automation_id) { $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id) }',
  '      }',
  '      invoke {',
  '        $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, [string]$payload.automation_id)',
  '        $elements = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition))',
  "        if ($elements.Count -ne 1) { throw 'UIA_CONTROL_NOT_UNIQUE' }",
  '        $element = $elements[0]',
  "        if (-not $element.Current.IsEnabled -or $element.Current.IsOffscreen -or $element.Current.IsPassword) { throw 'UIA_CONTROL_UNAVAILABLE' }",
  '        $pattern = $null',
  '        if (-not $element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) { throw \'UIA_INVOKE_PATTERN_UNAVAILABLE\' }',
  '        $verifyCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, [string]$payload.verify_automation_id)',
  '        $verifyElements = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $verifyCondition))',
  "        if ($verifyElements.Count -ne 1) { throw 'UIA_POSTCONDITION_NOT_UNIQUE' }",
  '        $verifyElement = $verifyElements[0]',
  '        $toggle = $null',
  '        if (-not $verifyElement.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$toggle)) { throw \'UIA_POSTCONDITION_NOT_TOGGLE\' }',
  "        $script:inputPhase = 'BEFORE_INVOKE'",
  "        Assert-ForegroundWindow 'BEFORE_INVOKE'",
  "        $script:inputPhase = 'PATTERN_DISPATCHED'",
  '        $pattern.Invoke()',
  '        Start-Sleep -Milliseconds 150',
  "        Assert-ForegroundWindow 'AFTER_INVOKE'",
  '        $observedState = [string]$toggle.Current.ToggleState',
  '        $verified = (($payload.expected_state -eq \'ON\' -and $observedState -eq \'On\') -or ($payload.expected_state -eq \'OFF\' -and $observedState -eq \'Off\'))',
  "        if (-not $verified) { throw 'UIA_POSTCONDITION_FAILED' }",
  "        $script:inputPhase = 'PATTERN_VERIFIED'",
  '        $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id)',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue ([string]$payload.verify_automation_id)',
  '      }',
  '      type_text {',
  '        $element = Find-Control ([string]$payload.automation_id)',
  '        if ($element.Current.IsPassword) { throw \'UIA_SENSITIVE_CONTROL\' }',
  '        if ($payload.text -match \'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]\') { throw \'UIA_TEXT_NOT_PLAIN\' }',
  '        $valuePattern = $null',
  '        if (-not $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern) -or $valuePattern.Current.IsReadOnly) { throw \'UIA_VALUE_PATTERN_UNAVAILABLE\' }',
  '        Assert-TargetWindow | Out-Null',
  '        Set-InputFocus $element',
  "        $script:inputPhase = 'INPUT_DISPATCHED'",
  '        if (-not [CovertUiaNative]::SendUnicode([string]$payload.text)) { throw \'UIA_INPUT_REJECTED\' }',
  '        Start-Sleep -Milliseconds 80',
  "        Assert-InputFocus $element 'AFTER_INPUT'",
  '        $verified = ((Get-ValueHash ([string]$valuePattern.Current.Value)) -ceq [string]$payload.expected_value_sha256)',
  '        if (-not $verified) { throw \'UIA_POSTCONDITION_FAILED\' }',
  "        $script:inputPhase = 'INPUT_VERIFIED'",
  '        $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id)',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue \'value_sha256\'',
  '      }',
  '      replace_text {',
  '        $element = Find-Control ([string]$payload.automation_id)',
  '        if ($element.Current.IsPassword -or $payload.text -match \'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]\') { throw \'UIA_TEXT_NOT_PLAIN\' }',
  '        $valuePattern = $null',
  '        if (-not $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern) -or $valuePattern.Current.IsReadOnly) { throw \'UIA_VALUE_PATTERN_UNAVAILABLE\' }',
  '        Assert-TargetWindow | Out-Null',
  '        Set-InputFocus $element',
  "        $script:inputPhase = 'INPUT_DISPATCHED'",
  '        if (-not [CovertUiaNative]::SendKey(0x11, $false)) { throw \'UIA_INPUT_REJECTED\' }',
  '        try {',
  '          if (-not [CovertUiaNative]::SendKey(0x41, $false)) { throw \'UIA_INPUT_REJECTED\' }',
  '          if (-not [CovertUiaNative]::SendKey(0x41, $true)) { throw \'UIA_INPUT_REJECTED\' }',
  '        } finally { [void][CovertUiaNative]::SendKey(0x11, $true) }',
  '        if (-not [CovertUiaNative]::SendUnicode([string]$payload.text)) { throw \'UIA_INPUT_REJECTED\' }',
  '        Start-Sleep -Milliseconds 80',
  "        Assert-InputFocus $element 'AFTER_INPUT'",
  '        $verified = ((Get-ValueHash ([string]$valuePattern.Current.Value)) -ceq [string]$payload.expected_value_sha256)',
  '        if (-not $verified) { throw \'UIA_POSTCONDITION_FAILED\' }',
  "        $script:inputPhase = 'INPUT_VERIFIED'",
  '        $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id)',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue \'value_sha256\'',
  '        $details | Add-Member -NotePropertyName keyboard_shortcut -NotePropertyValue \'CTRL+A\'',
  '      }',
  '      press_key {',
  '        $element = Find-Control ([string]$payload.automation_id)',
  '        $valuePattern = $null',
  '        if ($element.Current.IsPassword -or -not $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) { throw \'UIA_VALUE_PATTERN_UNAVAILABLE\' }',
  '        Assert-TargetWindow | Out-Null',
  '        Set-InputFocus $element',
  "        $script:inputPhase = 'INPUT_DISPATCHED'",
  '        $keyCodes = @{ ENTER=0x0D; ESCAPE=0x1B; TAB=0x09; BACKSPACE=0x08; DELETE=0x2E }',
  '        if (-not $keyCodes.ContainsKey([string]$payload.key)) { throw \'UIA_KEY_NOT_ALLOWLISTED\' }',
  '        $keyCode = [uint16]$keyCodes[[string]$payload.key]',
  '        if (-not [CovertUiaNative]::SendKey($keyCode, $false)) { throw \'UIA_INPUT_REJECTED\' }',
  '        try { Start-Sleep -Milliseconds 30 } finally { [void][CovertUiaNative]::SendKey($keyCode, $true) }',
  '        Start-Sleep -Milliseconds 80',
  '        Assert-TargetWindow | Out-Null',
  '        $verifyElement = Find-Control ([string]$payload.verify_automation_id)',
  '        if ($payload.key -eq \'TAB\' -and -not $verifyElement.Current.HasKeyboardFocus) { throw \'UIA_KEY_POSTCONDITION_FAILED\' }',
  '        $verified = ((Get-ValueHash (Get-SafeControlValue $verifyElement)) -ceq [string]$payload.expected_value_sha256)',
  '        if (-not $verified) { throw \'UIA_POSTCONDITION_FAILED\' }',
  '        $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id)',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue ([string]$payload.verify_automation_id)',
  "        $script:inputPhase = 'INPUT_VERIFIED'",
  '        $details | Add-Member -NotePropertyName key -NotePropertyValue ([string]$payload.key)',
  '      }',
  '      activate {',
  '        $target = Resolve-SemanticControl ([string]$payload.automation_id) ([string]$payload.target_name)',
  '        if ([CovertUiaNative]::GetForegroundWindow().ToInt64() -ne [long]$payload.window_handle) { $script:focusCheckDiagnostic = Get-SafeFocusSnapshot $window $target \'BEFORE_ACTIVATE\'; throw \'UIA_FOCUS_LOST\' }',
  '        Assert-TargetWindow | Out-Null',
  '        $verifyPre = $null',
  '        try { $verifyPre = Resolve-SemanticControl ([string]$payload.verify_automation_id) ([string]$payload.verify_name) } catch { $verifyPre = $null }',
  '        $preVisible = ($null -ne $verifyPre)',
  '        $preClassHandles = @()',
  '        if ($payload.expect_new_window_class) {',
  '          $preClassHandles = @(Get-ClassWindowHandles ([string]$payload.expect_new_window_class))',
  '        }',
  '        $pattern = $null; $activateDispatch = \'INVOKE_PATTERN\'',
  '        if ($target.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {',
  '          Assert-TargetWindow | Out-Null',
  '          $pattern.Invoke()',
  '        } else {',
  '          $window.SetFocus()',
  '          Start-Sleep -Milliseconds 60',
  '          $target.SetFocus()',
  '          Start-Sleep -Milliseconds 60',
  "          Assert-ForegroundWindow 'BEFORE_ACTIVATE_ENTER'",
  '          if (-not [CovertUiaNative]::SendKey(0x0D, $false)) { throw \'UIA_INPUT_REJECTED\' }',
  '          try { Start-Sleep -Milliseconds 30 } finally { [void][CovertUiaNative]::SendKey(0x0D, $true) }',
  '          $activateDispatch = \'FOCUS_ENTER\'',
  '        }',
  '        $deadline = [DateTime]::UtcNow.AddSeconds(6); $verified = $false',
  '        if ($payload.expect_new_window_class) {',
  '          # A requested new window is the primary postcondition. Some controls',
  '          # accept InvokePattern without performing their user gesture, so a',
  '          # bounded keyboard fallback is attempted once before refusal.',
  '          $newWindowDeadline = [DateTime]::UtcNow.AddSeconds(3); $newWindowHandle = $null',
  '          do {',
  '            Start-Sleep -Milliseconds 120',
  '            $candidates = @(Get-ClassWindowHandles ([string]$payload.expect_new_window_class) | Where-Object { $preClassHandles -notcontains [long]$_ })',
  '            if ($candidates.Count -ge 1) { $newWindowHandle = [long]$candidates[0] }',
  '          } while ($null -eq $newWindowHandle -and [DateTime]::UtcNow -lt $newWindowDeadline)',
  '          if ($null -eq $newWindowHandle -and $activateDispatch -eq \'INVOKE_PATTERN\') {',
  '            $window.SetFocus()',
  '            Start-Sleep -Milliseconds 60',
  '            $target.SetFocus()',
  '            Start-Sleep -Milliseconds 60',
  "            Assert-ForegroundWindow 'BEFORE_ACTIVATE_FALLBACK'",
  '            if (-not [CovertUiaNative]::SendKey(0x0D, $false)) { throw \'UIA_INPUT_REJECTED\' }',
  '            try { Start-Sleep -Milliseconds 30 } finally { [void][CovertUiaNative]::SendKey(0x0D, $true) }',
  '            $activateDispatch = \'FOCUS_ENTER_FALLBACK\'',
  '            $newWindowDeadline = [DateTime]::UtcNow.AddSeconds(6)',
  '            do {',
  '              Start-Sleep -Milliseconds 120',
  '              $candidates = @(Get-ClassWindowHandles ([string]$payload.expect_new_window_class) | Where-Object { $preClassHandles -notcontains [long]$_ })',
  '              if ($candidates.Count -ge 1) { $newWindowHandle = [long]$candidates[0] }',
  '            } while ($null -eq $newWindowHandle -and [DateTime]::UtcNow -lt $newWindowDeadline)',
  '          }',
  '          if ($null -ne $newWindowHandle) {',
  '            $verified = $true',
  '            $details | Add-Member -NotePropertyName new_window_class -NotePropertyValue ([string]$payload.expect_new_window_class)',
  '            $details | Add-Member -NotePropertyName new_window_handle -NotePropertyValue $newWindowHandle',
  '            $details | Add-Member -NotePropertyName new_window_pid -NotePropertyValue ([int][CovertUiaNative]::GetOwnerPid([IntPtr]::new([long]$newWindowHandle)))',
  '          }',
  '        }',
  '        if (-not $verified) {',
  '          do {',
  '            Start-Sleep -Milliseconds 100',
  '            Assert-TargetWindow | Out-Null',
  '            try {',
  '              $verifyElement = Resolve-SemanticControl ([string]$payload.verify_automation_id) ([string]$payload.verify_name)',
  '              $verified = ($null -ne $verifyElement -and $verifyElement.Current.IsEnabled -and -not $verifyElement.Current.IsOffscreen)',
  '            } catch { $verified = $false }',
  '          } while (-not $verified -and [DateTime]::UtcNow -lt $deadline)',
  '        }',
  '        if (-not $verified) { throw \'UIA_POSTCONDITION_FAILED\' }',
  "        $script:inputPhase = 'INPUT_VERIFIED'",
  '        if ($payload.automation_id) { $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id) }',
  '        if ($payload.target_name) { $details | Add-Member -NotePropertyName target_name_sha256 -NotePropertyValue (Get-ValueHash ([string]$payload.target_name)) }',
  '        $verifiedBy = if ($payload.verify_automation_id) { [string]$payload.verify_automation_id } else { \'name:\' + (Get-ValueHash ([string]$payload.verify_name)) }',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue $verifiedBy',
  '        $details | Add-Member -NotePropertyName activate_dispatch -NotePropertyValue $activateDispatch',
  '        $details | Add-Member -NotePropertyName verify_previsible -NotePropertyValue $preVisible',
  '      }',
  '      window_input {',
  '        $window = Assert-TargetWindow',
  "        $script:inputPhase = 'BEFORE_INPUT'",
  '        if ([CovertUiaNative]::GetForegroundWindow().ToInt64() -ne [long]$payload.window_handle) { $script:focusCheckDiagnostic = Get-SafeFocusSnapshot $window $window \'BEFORE_INPUT\'; throw \'UIA_FOCUS_LOST\' }',
  '        $surface = Find-TextPatternSurface $window',
  '        if ($null -eq $surface) { throw \'UIA_TEXT_PATTERN_UNAVAILABLE\' }',
  '        $preText = Read-TextPatternSurface $surface',
  '        $window.SetFocus()',
  '        Start-Sleep -Milliseconds 60',
  "        Assert-ForegroundWindow 'BEFORE_INPUT'",
  "        $script:inputPhase = 'INPUT_DISPATCHED'",
  '        if (-not [CovertUiaNative]::SendUnicode([string]$payload.text)) { throw \'UIA_INPUT_REJECTED\' }',
  '        if ($payload.submit) {',
  '          Start-Sleep -Milliseconds 60',
  "          Assert-ForegroundWindow 'BEFORE_SUBMIT'",
  '          if (-not [CovertUiaNative]::SendKey(0x0D, $false)) { throw \'UIA_INPUT_REJECTED\' }',
  '          try { Start-Sleep -Milliseconds 30 } finally { [void][CovertUiaNative]::SendKey(0x0D, $true) }',
  '        }',
  '        $deadline = [DateTime]::UtcNow.AddSeconds(6); $lineMatched = $false; $currentText = $null',
  '        do {',
  '          Start-Sleep -Milliseconds 120',
  '          Assert-TargetWindow | Out-Null',
  '          $currentSurface = Find-TextPatternSurface $window',
  '          if ($null -ne $currentSurface) { $currentText = Read-TextPatternSurface $currentSurface }',
  '          if ($null -ne $currentText) {',
  '            foreach ($line in ($currentText -split "\\r?\\n")) { if ($line.Trim() -ceq [string]$payload.expect_text) { $lineMatched = $true; break } }',
  '          }',
  '        } while (-not $lineMatched -and [DateTime]::UtcNow -lt $deadline)',
  '        if (-not $lineMatched) { throw \'UIA_POSTCONDITION_FAILED\' }',
  "        $script:inputPhase = 'INPUT_VERIFIED'",
  '        $verified = $true',
  "        $details | Add-Member -NotePropertyName input_method -NotePropertyValue 'UNICODE_TO_FOREGROUND_OWNED_WINDOW'",
  '        $details | Add-Member -NotePropertyName expect_text_sha256 -NotePropertyValue (Get-ValueHash ([string]$payload.expect_text))',
  '        $details | Add-Member -NotePropertyName pre_text_sha256 -NotePropertyValue (Get-ValueHash ([string]$preText))',
  '        $details | Add-Member -NotePropertyName output_line_matched -NotePropertyValue $true',
  '        $details | Add-Member -NotePropertyName post_text_sha256 -NotePropertyValue (Get-ValueHash ([string]$currentText))',
  '        $details | Add-Member -NotePropertyName text_surface_chars -NotePropertyValue ([int]$currentText.Length)',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue \'text_pattern_output_line\'',
  '      }',
  '      click {',
  '        $element = Find-Control ([string]$payload.automation_id)',
  '        if ([CovertUiaNative]::GetForegroundWindow().ToInt64() -ne [long]$payload.window_handle) { $script:focusCheckDiagnostic = Get-SafeFocusSnapshot $window $element \'BEFORE_CLICK\'; throw \'UIA_FOCUS_LOST\' }',
  '        $window.SetFocus()',
  '        Start-Sleep -Milliseconds 100',
  '        Assert-TargetWindow | Out-Null',
  '        if ([CovertUiaNative]::GetForegroundWindow().ToInt64() -ne [long]$payload.window_handle) { throw \'UIA_FOCUS_LOST\' }',
  '        $element = Find-Control ([string]$payload.automation_id)',
  '        $bounds = $element.Current.BoundingRectangle',
  '        if ($bounds.IsEmpty -or $bounds.Width -le 1 -or $bounds.Height -le 1) { throw \'UIA_COORDINATE_UNAVAILABLE\' }',
  '        $x = [int][Math]::Round($bounds.Left + ($bounds.Width / 2)); $y = [int][Math]::Round($bounds.Top + ($bounds.Height / 2))',
  '        $point = New-Object CovertUiaNative+POINT; $point.X = $x; $point.Y = $y',
  '        $hit = [CovertUiaNative]::WindowFromPoint($point)',
  '        if ($hit -eq [IntPtr]::Zero -or [CovertUiaNative]::GetAncestor($hit, 2).ToInt64() -ne [long]$payload.window_handle) { throw \'UIA_CLICK_TARGET_OCCLUDED\' }',
  '        Assert-TargetWindow | Out-Null',
  '        if ([CovertUiaNative]::GetForegroundWindow().ToInt64() -ne [long]$payload.window_handle) { throw \'UIA_FOCUS_LOST\' }',
  '        if (-not [CovertUiaNative]::ClickAt($x, $y)) { throw \'UIA_INPUT_REJECTED\' }',
  '        Start-Sleep -Milliseconds 120',
  '        Assert-TargetWindow | Out-Null',
  '        $verifyElement = Find-Control ([string]$payload.verify_automation_id)',
  '        $verifyPattern = $null',
  '        if (-not $verifyElement.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$verifyPattern)) { throw \'UIA_POSTCONDITION_NOT_TOGGLE\' }',
  '        $observedState = [string]$verifyPattern.Current.ToggleState',
  '        $verified = (($payload.expected_state -eq \'ON\' -and $observedState -eq \'On\') -or ($payload.expected_state -eq \'OFF\' -and $observedState -eq \'Off\'))',
  '        if (-not $verified) { throw \'UIA_POSTCONDITION_FAILED\' }',
  '        $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id)',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue ([string]$payload.verify_automation_id)',
  '        $details | Add-Member -NotePropertyName input_method -NotePropertyValue \'COORDINATE_REVALIDATED\'',
  '      }',
  '      screenshot {',
  '        if (-not $payload.capture_path -or -not $expected.captureRoot) { throw \'UIA_CAPTURE_ROOT_MISSING\' }',
  '        $window = Assert-TargetWindow',
  '        if ([CovertUiaNative]::IsIconic([IntPtr]::new([long]$payload.window_handle))) { throw \'UIA_WINDOW_UNAVAILABLE\' }',
  '        $sensitive = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.IsPassword })',
  '        if ($sensitive.Count -gt 0) { throw \'UIA_SENSITIVE_WINDOW\' }',
  '        $root = [IO.Path]::GetFullPath([string]$expected.captureRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar',
  '        $capture = [IO.Path]::GetFullPath([string]$payload.capture_path)',
  '        if (-not $capture.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw \'UIA_CAPTURE_PATH_DENIED\' }',
  '        $rect = New-Object CovertUiaNative+RECT',
  '        if (-not [CovertUiaNative]::GetWindowRect([IntPtr]::new([long]$payload.window_handle), [ref]$rect)) { throw \'UIA_CAPTURE_FAILED\' }',
  '        $width = $rect.Right - $rect.Left; $height = $rect.Bottom - $rect.Top',
  '        if ($width -lt 64 -or $height -lt 64 -or $width -gt 4096 -or $height -gt 4096) { throw \'UIA_CAPTURE_BOUNDS_INVALID\' }',
  '        Add-Type -AssemblyName System.Drawing -ErrorAction Stop',
  '        $bitmap = New-Object System.Drawing.Bitmap($width, $height); $graphics = [System.Drawing.Graphics]::FromImage($bitmap); $hdc = $graphics.GetHdc()',
  '        try { if (-not [CovertUiaNative]::PrintWindow([IntPtr]::new([long]$payload.window_handle), $hdc, 2)) { throw \'UIA_CAPTURE_FAILED\' } } finally { $graphics.ReleaseHdc($hdc); $graphics.Dispose() }',
  '        try { $bitmap.Save($capture, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $bitmap.Dispose() }',
  '        $bytes = [IO.File]::ReadAllBytes($capture); $sha = [System.Security.Cryptography.SHA256]::Create()',
  '        try { $digest = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace(\'-\', \'\').ToLowerInvariant() } finally { $sha.Dispose() }',
  '        $verified = ($bytes.Length -gt 100 -and $digest -match \'^[0-9a-f]{64}$\')',
  '        $details | Add-Member -NotePropertyName capture_bytes -NotePropertyValue $bytes.Length',
  '        $details | Add-Member -NotePropertyName capture_sha256 -NotePropertyValue $digest',
  '        $details | Add-Member -NotePropertyName capture_width -NotePropertyValue $width',
  '        $details | Add-Member -NotePropertyName capture_height -NotePropertyValue $height',
  '      }',
  '      select_file {',
  '        if (-not $payload.selection_root -or -not $payload.file_path -or -not $payload.result_window_handle -or -not $payload.verify_file_automation_id -or -not $payload.verify_sha256_automation_id) { throw \'UIA_FILE_PICKER_REQUEST_INVALID\' }',
  "        $script:inputPhase = 'PICKER_PRECONDITIONS'",
  '        Assert-LeasedWindow ([long]$payload.result_window_handle) ([string]$expected.resultWindowRuntimeId) ([string]$expected.resultWindowClassName) ([int]$expected.resultWindowPid) | Out-Null',
  '        $dialog = Assert-TargetWindow',
  '        $dialogHandle = [IntPtr]::new([long]$payload.window_handle)',
  '        if ([CovertUiaNative]::WindowClass($dialogHandle) -cne \'#32770\' -or [CovertUiaNative]::GetOwnerPid($dialogHandle) -ne [uint32]$expected.pid) { throw \'UIA_FILE_PICKER_DIALOG_INVALID\' }',
  '        $rootInput = [string]$payload.selection_root; $fileInput = [string]$payload.file_path',
  '        if ($rootInput -match \'(^|[\\/])\.\.([\\/]|$)\' -or $fileInput -match \'(^|[\\/])\.\.([\\/]|$)\') { throw \'UIA_FILE_OUTSIDE_ROOT\' }',
  '        $root = [IO.Path]::GetFullPath($rootInput).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)',
  '        $file = [IO.Path]::GetFullPath($fileInput)',
  '        if (-not [string]::Equals($root, $rootInput.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase) -or -not [string]::Equals($file, $fileInput, [StringComparison]::OrdinalIgnoreCase)) { throw \'UIA_FILE_OUTSIDE_ROOT\' }',
  '        $rootPrefix = $root + [IO.Path]::DirectorySeparatorChar',
  '        if (-not $file.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($file)) { throw \'UIA_FILE_OUTSIDE_ROOT\' }',
  '        $cursor = $file; $reparsePoint = [IO.FileAttributes]::ReparsePoint',
  '        while ($cursor -and $cursor.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {',
  '          $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop',
  '          if (($item.Attributes -band $reparsePoint) -ne 0) { throw \'UIA_FILE_OUTSIDE_ROOT\' }',
  '          if ([string]::Equals($cursor.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar), $root, [StringComparison]::OrdinalIgnoreCase)) { break }',
  '          $cursor = [IO.Path]::GetDirectoryName($cursor)',
  '        }',
  '        if (-not [string]::Equals($cursor.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar), $root, [StringComparison]::OrdinalIgnoreCase)) { throw \'UIA_FILE_OUTSIDE_ROOT\' }',
  '        $fileInfo = Get-Item -LiteralPath $file -Force -ErrorAction Stop',
  '        if ($fileInfo.PSIsContainer) { throw \'UIA_FILE_PICKER_NOT_A_FILE\' }',
  '        $expectedFileSha256 = Get-FileSha256 $file',
  "        $script:filePickerCheckDiagnostic = [pscustomobject]@{ stage='FILENAME_RESOLUTION'; label_automation_id='1090'; filename_automation_id='1148'; value_pattern_available=$false }",
  '        $target = Resolve-PickerFilenameEdit $dialog; $open = Resolve-PickerOpenButton $dialog',
  "        $script:filePickerCheckDiagnostic = [pscustomobject]@{ stage='FOCUS_VALIDATION'; label_to_edit_ancestry_verified=$true; filename_runtime_id_verified=$true; filename_native_class='Edit'; value_pattern_available=$false; is_keyboard_focusable=[bool]$target.element.Current.IsKeyboardFocusable }",
  '        if ([CovertUiaNative]::WindowText($target.handle).Length -ne 0) { throw \'UIA_FILE_PICKER_FIELD_NOT_EMPTY\' }',
  "        $script:inputPhase = 'BEFORE_INPUT'",
  '        Assert-PickerFilenameFocus $target \'BEFORE_INPUT\' $true',
  '        Assert-LeasedWindow ([long]$payload.result_window_handle) ([string]$expected.resultWindowRuntimeId) ([string]$expected.resultWindowClassName) ([int]$expected.resultWindowPid) | Out-Null',
  '        Assert-TargetWindow | Out-Null',
  '        if ([CovertUiaNative]::WindowText($target.handle).Length -ne 0) { throw \'UIA_FILE_PICKER_FIELD_CHANGED\' }',
  '        $inputResult = [CovertUiaNative]::SendUnicodeToVerifiedEdit($file, [long]$payload.window_handle, $target.handle.ToInt64(), [uint32]$expected.pid)',
  '        if ($inputResult -eq 0) { Assert-PickerFilenameFocus $target \'BEFORE_INPUT\' $false; throw \'UIA_FOCUS_LOST\' }',
  '        if ($inputResult -ne 2) { throw \'UIA_INPUT_REJECTED\' }',
  "        $script:inputPhase = 'INPUT_DISPATCHED'",
  '        Start-Sleep -Milliseconds 80',
  '        Assert-TargetWindow | Out-Null',
  '        Assert-PickerFilenameFocus $target \'AFTER_INPUT\' $false',
  '        $enteredPath = [CovertUiaNative]::WindowText($target.handle)',
  '        $readbackDeadline = [DateTime]::UtcNow.AddSeconds(3)',
  '        while (-not [string]::Equals($enteredPath, $file, [StringComparison]::OrdinalIgnoreCase) -and [DateTime]::UtcNow -lt $readbackDeadline) {',
  '          Start-Sleep -Milliseconds 80',
  '          $enteredPath = [CovertUiaNative]::WindowText($target.handle)',
  '        }',
  "        if (-not [string]::Equals($enteredPath, $file, [StringComparison]::OrdinalIgnoreCase)) { throw 'UIA_FILE_PICKER_VALUE_MISMATCH' }",
  '        $dialog = Assert-TargetWindow',
  '        Assert-LeasedWindow ([long]$payload.result_window_handle) ([string]$expected.resultWindowRuntimeId) ([string]$expected.resultWindowClassName) ([int]$expected.resultWindowPid) | Out-Null',
  '        Assert-PickerFilenameFocus $target \'BEFORE_OPEN\' $false',
  '        if (-not [string]::Equals([CovertUiaNative]::WindowText($target.handle), $file, [StringComparison]::OrdinalIgnoreCase)) { throw \'UIA_FILE_PICKER_VALUE_MISMATCH\' }',
  '        $currentOpen = Resolve-PickerOpenButton $dialog',
  '        if ($currentOpen.handle -ne $open.handle -or $currentOpen.runtime_id -cne $open.runtime_id) { throw \'UIA_FILE_PICKER_CONTROL_STALE\' }',
  '        $openPattern = $null; $openDispatch = \'BM_CLICK_EXACT_OWNED_BUTTON\'',
  '        if ($currentOpen.element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$openPattern)) { Assert-TargetWindow | Out-Null; $openPattern.Invoke(); $openDispatch = \'INVOKE_PATTERN\' }',
  '        else { Assert-TargetWindow | Out-Null; $openResult = [CovertUiaNative]::ClickVerifiedOpenButton($currentOpen.handle.ToInt64(), [long]$payload.window_handle, [uint32]$expected.pid); if ($openResult -eq 0) { throw \'UIA_FOCUS_LOST\' }; if ($openResult -ne 2) { throw \'UIA_FILE_PICKER_OPEN_TIMEOUT\' } }',
  '        $pathCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, [string]$payload.verify_file_automation_id)',
  '        $hashCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, [string]$payload.verify_sha256_automation_id)',
  '        $deadline = [DateTime]::UtcNow.AddSeconds(5); $dialogClosed = $false; $pathReceiptMatches = $false; $hashReceiptMatches = $false',
  '        do {',
  '          Start-Sleep -Milliseconds 100',
  '          $dialogClosed = -not [CovertUiaNative]::IsWindow($dialogHandle)',
  '          if (-not $dialogClosed) { continue }',
  '          $main = Assert-LeasedWindow ([long]$payload.result_window_handle) ([string]$expected.resultWindowRuntimeId) ([string]$expected.resultWindowClassName) ([int]$expected.resultWindowPid)',
  '          $pathReceipts = @($main.FindAll([System.Windows.Automation.TreeScope]::Descendants, $pathCondition)); $hashReceipts = @($main.FindAll([System.Windows.Automation.TreeScope]::Descendants, $hashCondition))',
  '          if ($pathReceipts.Count -gt 1 -or $hashReceipts.Count -gt 1) { throw \'UIA_FILE_PICKER_POSTCONDITION_AMBIGUOUS\' }',
  '          if ($pathReceipts.Count -eq 1 -and $hashReceipts.Count -eq 1 -and -not $pathReceipts[0].Current.IsPassword -and -not $hashReceipts[0].Current.IsPassword) {',
  '            $receivedPath = Get-SafeControlValue $pathReceipts[0]; $receivedHash = (Get-SafeControlValue $hashReceipts[0]).Trim().ToLowerInvariant()',
  '            $pathReceiptMatches = [string]::Equals($receivedPath, $file, [StringComparison]::OrdinalIgnoreCase) -or [string]::Equals($receivedPath, [IO.Path]::GetFileName($file), [StringComparison]::OrdinalIgnoreCase)',
  '            $hashReceiptMatches = ($receivedHash -ceq $expectedFileSha256)',
  '          }',
  '        } while ((!$dialogClosed -or !$pathReceiptMatches -or !$hashReceiptMatches) -and [DateTime]::UtcNow -lt $deadline)',
  '        if (-not $dialogClosed) { throw \'UIA_FILE_PICKER_DIALOG_NOT_CLOSED\' }',
  '        if (-not $pathReceiptMatches -or -not $hashReceiptMatches) { throw \'UIA_FILE_PICKER_RECEIPT_MISMATCH\' }',
  '        if ((Get-FileSha256 $file) -cne $expectedFileSha256) { throw \'UIA_FILE_PICKER_TARGET_CHANGED\' }',
  "        $script:inputPhase = 'INPUT_VERIFIED'",
  "        $script:filePickerCheckDiagnostic = [pscustomobject]@{ stage='POSTCONDITION'; label_to_edit_ancestry_verified=$true; filename_entry_runtime_id_verified=$true; input_target_path_readback_verified=$true; open_dispatch=$openDispatch; dialog_closed=$dialogClosed; caller_path_receipt_verified=$pathReceiptMatches; caller_sha256_receipt_verified=$hashReceiptMatches }",
  '        $verified = $true',
  '        $details | Add-Member -NotePropertyName automation_id -NotePropertyValue \'1148\'',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue \'caller_file_path_and_sha256\'',
  '        $details | Add-Member -NotePropertyName open_dispatch -NotePropertyValue $openDispatch',
  '        $details | Add-Member -NotePropertyName file_sha256 -NotePropertyValue $expectedFileSha256',
  '        $details | Add-Member -NotePropertyName file_bytes -NotePropertyValue $fileInfo.Length',
  '        $details | Add-Member -NotePropertyName filename_focus_verified -NotePropertyValue $true',
  '        $details | Add-Member -NotePropertyName input_path_readback_verified -NotePropertyValue $true',
  '        $details | Add-Member -NotePropertyName dialog_closed -NotePropertyValue $dialogClosed',
  '        $details | Add-Member -NotePropertyName caller_path_receipt_verified -NotePropertyValue $pathReceiptMatches',
  '        $details | Add-Member -NotePropertyName caller_sha256_receipt_verified -NotePropertyValue $hashReceiptMatches',
  '        $details | Add-Member -NotePropertyName path_containment -NotePropertyValue \'PASS\'',
  '        $details | Add-Member -NotePropertyName input_method -NotePropertyValue \'VERIFIED_FOCUSED_NATIVE_EDIT_SENDINPUT_UNICODE\'',
  '      }',
  '      scroll {',
  '        $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, [string]$payload.automation_id)',
  '        $elements = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition))',
  "        if ($elements.Count -ne 1) { throw 'UIA_CONTROL_NOT_UNIQUE' }",
  '        $element = $elements[0]',
  "        if (-not $element.Current.IsEnabled -or $element.Current.IsOffscreen -or $element.Current.IsPassword) { throw 'UIA_CONTROL_UNAVAILABLE' }",
  '        $pattern = $null',
  '        if (-not $element.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern, [ref]$pattern)) { throw \'UIA_SCROLL_PATTERN_UNAVAILABLE\' }',
  '        Assert-TargetWindow | Out-Null',
  '        $pattern.SetScrollPercent([double]$payload.horizontal_percent, [double]$payload.vertical_percent)',
  '        $current = $pattern.Current',
  '        Assert-TargetWindow | Out-Null',
  '        $verified = ([Math]::Abs($current.VerticalScrollPercent - [double]$payload.vertical_percent) -lt 1.0)',
  '        $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id)',
  '        $details | Add-Member -NotePropertyName vertical_percent -NotePropertyValue ([double]$current.VerticalScrollPercent)',
  '      }',
  "      default { throw 'UIA_ACTION_UNSUPPORTED' }",
  '    }',
  '    if (-not $verified) { throw \'UIA_ACTION_UNVERIFIED\' }',
  '    $result = [pscustomobject]@{ ok=$true; verified=$true; action=[string]$payload.action; details=$details }',
  '  }',
  '  $result | ConvertTo-Json -Compress -Depth 5',
  '}',
].join('\n');

export function buildWindowsUiaCommand(request, identity) {
  validateWindowsUiaRequest(request);
  if (!identity || request.pid !== identity.pid) throw new TypeError('UIA target identity does not match request PID');
  if (request.action !== 'discover' && (typeof identity.windowRuntimeId !== 'string' || !identity.windowRuntimeId ||
      typeof identity.windowClassName !== 'string' || !identity.windowClassName)) {
    throw new TypeError('UIA action requires a session-issued window identity');
  }
  if (request.action === 'select_file' && (!identity.resultWindowRuntimeId || !identity.resultWindowClassName)) {
    throw new TypeError('UIA file selection requires a leased result window identity');
  }
  if (request.action === 'screenshot' && !identity.captureRoot) {
    throw new TypeError('UIA screenshot requires a bounded evidence root');
  }
  return UIA_SCRIPT + [
  'catch {',
  '  $code = [string]$_.Exception.Message',
  "  if ($code -notmatch '^UIA_[A-Z_]+$') { $code = 'UIA_OPERATION_FAILED' }",
  '  $innerType = if ($_.Exception.InnerException) { [string]$_.Exception.InnerException.GetType().Name } else { $null }',
  '  $diagnostic = [pscustomobject]@{ exception_type=[string]$_.Exception.GetType().Name; inner_exception_type=$innerType; category=[string]$_.CategoryInfo.Category; command=[string]$_.InvocationInfo.MyCommand.Name; line=[int]$_.InvocationInfo.ScriptLineNumber; offset=[int]$_.InvocationInfo.OffsetInLine; input_phase=[string]$script:inputPhase; focus_check=$script:focusCheckDiagnostic; file_picker=$script:filePickerCheckDiagnostic; identity=$script:identityDiagnostic; control_name=$script:controlNameDiagnostic }',
  '  [pscustomobject]@{ ok=$false; verified=$false; action=[string]$payload.action; code=$code; diagnostic=$diagnostic } | ConvertTo-Json -Compress -Depth 7',
    '}'
  ].join('\n');
}

function isSubpath(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function ensureHelperDirectory(workspaceRoot, helperDirectory) {
  if (typeof workspaceRoot !== 'string' || !path.isAbsolute(workspaceRoot) ||
      typeof helperDirectory !== 'string' || !path.isAbsolute(helperDirectory)) {
    throw Object.assign(new TypeError('workspace-bounded UIA helper directory is required'), { code: 'UIA_HELPER_ROOT_INVALID' });
  }
  const root = await fs.realpath(workspaceRoot);
  const target = path.resolve(helperDirectory);
  if (!isSubpath(root, target)) throw Object.assign(new Error('UIA helper directory escaped the authorized workspace'), { code: 'UIA_HELPER_ROOT_INVALID' });
  const relative = path.relative(root, target);
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try { await fs.mkdir(current); }
    catch (error) { if (error?.code !== 'EEXIST') throw error; }
    const stat = await fs.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw Object.assign(new Error('UIA helper path contains a non-directory or symbolic link'), { code: 'UIA_HELPER_ROOT_INVALID' });
    const real = await fs.realpath(current);
    if (!isSubpath(root, real)) throw Object.assign(new Error('UIA helper path resolved outside the authorized workspace'), { code: 'UIA_HELPER_ROOT_INVALID' });
  }
  return target;
}

export function validateWindowsUiaRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new TypeError('UIA request must be an object');
  const allowed = new Set(['action', 'pid', 'window_handle', 'lease_id', 'automation_id', 'target_name', 'verify_automation_id', 'verify_name', 'expect_new_window_class', 'verify_file_automation_id', 'verify_sha256_automation_id', 'expected_state', 'horizontal_percent', 'vertical_percent', 'text', 'expect_text', 'submit', 'expected_value_sha256', 'key', 'selection_root', 'file_path', 'result_window_handle', 'result_lease_id', 'result_pid']);
  if (Object.keys(request).some(key => !allowed.has(key))) throw new TypeError('UIA request contains unsupported fields');
  if (!Number.isSafeInteger(request.pid) || request.pid <= 0) throw new TypeError('UIA process ID is required');
  const fields = {
    discover: ['action', 'pid'],
    inspect: ['action', 'pid', 'window_handle', 'lease_id'],
    focus: ['action', 'pid', 'window_handle', 'lease_id'],
    invoke: ['action', 'pid', 'window_handle', 'lease_id', 'automation_id', 'verify_automation_id', 'expected_state'],
    scroll: ['action', 'pid', 'window_handle', 'lease_id', 'automation_id', 'horizontal_percent', 'vertical_percent'],
    type_text: ['action', 'pid', 'window_handle', 'lease_id', 'automation_id', 'text', 'expected_value_sha256'],
    replace_text: ['action', 'pid', 'window_handle', 'lease_id', 'automation_id', 'text', 'expected_value_sha256'],
    press_key: ['action', 'pid', 'window_handle', 'lease_id', 'automation_id', 'verify_automation_id', 'key', 'expected_value_sha256'],
    click: ['action', 'pid', 'window_handle', 'lease_id', 'automation_id', 'verify_automation_id', 'expected_state'],
    screenshot: ['action', 'pid', 'window_handle', 'lease_id'],
    select_file: ['action', 'pid', 'window_handle', 'lease_id', 'selection_root', 'file_path', 'result_window_handle', 'result_lease_id', 'verify_file_automation_id', 'verify_sha256_automation_id'],
    activate: ['action', 'pid', 'window_handle', 'lease_id'],
    window_input: ['action', 'pid', 'window_handle', 'lease_id', 'text', 'expect_text']
  };
  if (!Object.hasOwn(fields, request.action)) throw new TypeError('UIA action is unsupported');
  if (request.action !== 'discover' && (typeof request.lease_id !== 'string' || request.lease_id.length < 16 || request.lease_id.length > 80)) {
    throw new TypeError('UIA session window lease is required');
  }
  const optional = { focus: ['automation_id'], activate: ['automation_id', 'target_name', 'verify_automation_id', 'verify_name', 'expect_new_window_class'], window_input: ['submit'], select_file: ['result_pid'] }[request.action] ?? [];
  const permitted = new Set([...fields[request.action], ...optional]);
  if (Object.keys(request).some(key => !permitted.has(key)) || fields[request.action].some(key => !Object.hasOwn(request, key))) throw new TypeError('UIA request fields do not match its action');
  if (request.action !== 'discover' && (!Number.isSafeInteger(request.window_handle) || request.window_handle <= 0)) throw new TypeError('UIA window handle is required');
  const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 64;
  if (['invoke', 'scroll', 'type_text', 'replace_text', 'press_key', 'click'].includes(request.action) && !validId(request.automation_id)) throw new TypeError('UIA automation ID is required');
  if (request.action === 'invoke' && (!validId(request.verify_automation_id) || !['ON', 'OFF'].includes(request.expected_state))) throw new TypeError('UIA invoke requires a toggle-state postcondition');
  if (['click', 'press_key'].includes(request.action) && !validId(request.verify_automation_id)) throw new TypeError('UIA input requires a postcondition control');
  if (['type_text', 'replace_text'].includes(request.action)) {
    if (typeof request.text !== 'string' || request.text.length < 1 || request.text.length > 1024 || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(request.text)) throw new TypeError('UIA input must be bounded plain text');
    if (typeof request.expected_value_sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(request.expected_value_sha256)) throw new TypeError('UIA text input requires a SHA-256 postcondition');
  }
  if (request.action === 'press_key' && (!['ENTER', 'ESCAPE', 'TAB', 'BACKSPACE', 'DELETE'].includes(request.key) ||
      typeof request.expected_value_sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(request.expected_value_sha256))) {
    throw new TypeError('UIA key is unsupported or lacks a bounded value postcondition');
  }
  if (request.action === 'click' && (!validId(request.verify_automation_id) || !['ON', 'OFF'].includes(request.expected_state))) throw new TypeError('UIA click requires a toggle-state postcondition');
  const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128 && !/[\x00-\x1F\x7F]/.test(value);
  if (request.action === 'activate') {
    const targetById = validId(request.automation_id);
    const targetByName = validName(request.target_name);
    if (targetById === targetByName) throw new TypeError('UIA activate requires exactly one automation ID or exact control name');
    if (!validId(request.verify_automation_id) && !validName(request.verify_name)) throw new TypeError('UIA activate requires a visibility postcondition control');
    if (Object.hasOwn(request, 'expect_new_window_class') &&
        (typeof request.expect_new_window_class !== 'string' || !/^#?[A-Za-z0-9_]{1,64}$/.test(request.expect_new_window_class))) {
      throw new TypeError('UIA activate window class expectation is invalid');
    }
  }
  if (request.action === 'window_input') {
    if (typeof request.text !== 'string' || request.text.trim().length < 1 || request.text.length > 256 || /[\x00-\x1F\x7F]/.test(request.text)) throw new TypeError('UIA window input must be bounded plain text');
    if (typeof request.expect_text !== 'string' || request.expect_text.trim().length < 1 || request.expect_text.length > 128 || /[\x00-\x1F\x7F]/.test(request.expect_text)) throw new TypeError('UIA window input requires a bounded expected output line');
    if (request.text.trim() === request.expect_text.trim()) throw new TypeError('UIA window input output line must differ from the typed command');
    if (Object.hasOwn(request, 'submit') && typeof request.submit !== 'boolean') throw new TypeError('UIA window input submit must be a boolean');
  }
  if (request.action === 'select_file') {
    if (typeof request.selection_root !== 'string' || request.selection_root.length < 2 || request.selection_root.length > 500 ||
        typeof request.file_path !== 'string' || request.file_path.length < 2 || request.file_path.length > 1000 ||
        !Number.isSafeInteger(request.result_window_handle) || request.result_window_handle <= 0 ||
        typeof request.result_lease_id !== 'string' || request.result_lease_id.length < 16 || request.result_lease_id.length > 80 ||
        !validId(request.verify_file_automation_id) || !validId(request.verify_sha256_automation_id) ||
        request.verify_file_automation_id === request.verify_sha256_automation_id) {
      throw new TypeError('UIA file selection requires bounded paths, result window lease, and distinct exact-file and SHA-256 receipt controls');
    }
    if (Object.hasOwn(request, 'result_pid') && (!Number.isSafeInteger(request.result_pid) || request.result_pid <= 0)) {
      throw new TypeError('UIA file selection result process ID is invalid');
    }
  }
  if (request.action === 'scroll') {
    for (const key of ['horizontal_percent', 'vertical_percent']) {
      const value = request[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 100) throw new TypeError(`UIA ${key} must be between -1 and 100`);
    }
    if (request.horizontal_percent === -1 && request.vertical_percent === -1) throw new TypeError('UIA scroll requires at least one bounded axis');
  }
  return request;
}

export async function windowsUiaAction(request, identity, run, options = {}) {
  if (typeof run !== 'function') throw new TypeError('Windows UIA runner is required');
  const script = buildWindowsUiaCommand(request, identity);
  const payload = { ...request };
  if (request.action === 'screenshot') {
    if (typeof options.capturePath !== 'string' || !options.capturePath) throw new TypeError('bounded screenshot path is required');
    payload.capture_path = options.capturePath;
  }
  const timeout = Number.isSafeInteger(options.timeout) ? options.timeout : 8000;
  const helperDirectory = await ensureHelperDirectory(options.workspaceRoot, options.helperDirectory);
  const helperPath = path.join(helperDirectory, `uia-${randomUUID()}.ps1`);
  let created = false;
  let stdout;
  let operationError;
  try {
    await fs.writeFile(helperPath, script, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    created = true;
    const envelope = JSON.stringify({ request: payload, identity });
    stdout = await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', helperPath], {
      timeout,
      input: envelope
    });
  } catch (error) {
    operationError = error;
  } finally {
    if (created) {
      try { await fs.unlink(helperPath); }
      catch (error) {
        operationError = Object.assign(new Error('UIA helper file could not be removed after the owned invocation'), {
          code: 'UIA_HELPER_CLEANUP_FAILED', cause: operationError ?? error
        });
      }
    }
  }
  if (operationError) throw operationError;
  let result;
  try { result = JSON.parse(String(stdout).trim()); }
  catch {
    const output = String(stdout);
    const trimmed = output.trimStart();
    const diagnostic = {
      byte_length: Buffer.byteLength(output),
      line_count: output.length ? output.split(/\r?\n/).length : 0,
      sha256: createHash('sha256').update(output).digest('hex'),
      line_shapes: output.split(/\r?\n/).filter(Boolean).slice(0, 12).map(line => {
        const value = line.trimStart();
        const classification = value.startsWith('{') ? 'JSON_OBJECT' : value.startsWith('[') ? 'JSON_ARRAY' :
          /^warning:/i.test(value) ? 'WARNING' : /^(At line:|CategoryInfo|FullyQualifiedErrorId|Exception:)/i.test(value) ? 'POWERSHELL_ERROR' :
            /^(True|False)$/i.test(value) ? 'BOOLEAN' : /^PS [A-Z]:\\/i.test(value) ? 'PROMPT' : 'OTHER';
        return { length: line.length, classification };
      }),
      prefix_class: trimmed.startsWith('{') ? 'JSON_OBJECT_PREFIX' : trimmed.startsWith('[') ? 'JSON_ARRAY_PREFIX' :
        /^\uFEFF/.test(trimmed) ? 'BYTE_ORDER_MARK' : /^warning:/i.test(trimmed) ? 'POWERSHELL_WARNING' :
          output.length === 0 ? 'EMPTY' : 'NON_JSON_PREFIX'
    };
    throw Object.assign(new Error('UI Automation returned malformed result data'), {
      code: 'UIA_RESULT_INVALID', diagnostic
    });
  }
  if (!result.ok || !result.verified) {
    throw Object.assign(new Error(String(result.code ?? 'UIA_ACTION_UNVERIFIED')), {
      code: String(result.code ?? 'UIA_ACTION_UNVERIFIED'), diagnostic: result.diagnostic
    });
  }
  return result;
}
