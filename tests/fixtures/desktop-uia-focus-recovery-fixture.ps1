param(
  [Parameter(Mandatory = $true)][int]$TargetPid,
  [Parameter(Mandatory = $true)][long]$DialogHandle,
  [Parameter(Mandatory = $true)][long]$FilenameEditHandle,
  [Parameter(Mandatory = $true)][int]$DistractorPid,
  [Parameter(Mandatory = $true)][long]$DistractorWindowHandle,
  [Parameter(Mandatory = $true)][string]$DistractorClassName
)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DesktopFocusRecoveryNative {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct GUITHREADINFO { public uint cbSize; public uint flags; public IntPtr hwndActive; public IntPtr hwndFocus; public IntPtr hwndCapture; public IntPtr hwndMenuOwner; public IntPtr hwndMoveSize; public IntPtr hwndCaret; public RECT rcCaret; }
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder text, int maxCount);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint threadId, ref GUITHREADINFO info);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
  public static uint OwnerPid(IntPtr hwnd) { uint pid; GetWindowThreadProcessId(hwnd, out pid); return pid; }
  public static uint ThreadId(IntPtr hwnd) { uint pid; return GetWindowThreadProcessId(hwnd, out pid); }
  public static string WindowClass(IntPtr hwnd) { var text = new StringBuilder(256); return GetClassName(hwnd, text, text.Capacity) > 0 ? text.ToString() : String.Empty; }
}
'@ -ErrorAction Stop | Out-Null

$dialog = [IntPtr]::new($DialogHandle)
$edit = [IntPtr]::new($FilenameEditHandle)
$distractor = [IntPtr]::new($DistractorWindowHandle)
if (-not [DesktopFocusRecoveryNative]::IsWindowVisible($dialog) -or
    [DesktopFocusRecoveryNative]::OwnerPid($dialog) -ne [uint32]$TargetPid -or
    [DesktopFocusRecoveryNative]::WindowClass($dialog) -cne '#32770' -or
    -not [DesktopFocusRecoveryNative]::IsWindowVisible($edit) -or
    [DesktopFocusRecoveryNative]::OwnerPid($edit) -ne [uint32]$TargetPid -or
    [DesktopFocusRecoveryNative]::WindowClass($edit) -cne 'Edit' -or
    [DesktopFocusRecoveryNative]::OwnerPid($distractor) -ne [uint32]$DistractorPid -or
    [DesktopFocusRecoveryNative]::WindowClass($distractor) -cne $DistractorClassName) {
  throw 'FOCUS_RECOVERY_TARGET_INVALID'
}
$editParent = $edit
$editBelongsToDialog = $false
for ($depth = 0; $depth -lt 16 -and $editParent -ne [IntPtr]::Zero; $depth++) {
  if ($editParent -eq $dialog) { $editBelongsToDialog = $true; break }
  $editParent = [DesktopFocusRecoveryNative]::GetParent($editParent)
}
if (-not $editBelongsToDialog) { throw 'FOCUS_RECOVERY_EDIT_ANCESTRY_INVALID' }

if (-not [DesktopFocusRecoveryNative]::PostMessage($distractor, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)) {
  throw 'FOCUS_RECOVERY_CLOSE_DISPATCH_FAILED'
}
$closeDeadline = [DateTime]::UtcNow.AddSeconds(4)
while ([DesktopFocusRecoveryNative]::IsWindow($distractor) -and [DateTime]::UtcNow -lt $closeDeadline) { Start-Sleep -Milliseconds 50 }
if ([DesktopFocusRecoveryNative]::IsWindow($distractor)) { throw 'FOCUS_RECOVERY_DISTRACTOR_STILL_OPEN' }

$focusDeadline = [DateTime]::UtcNow.AddSeconds(5)
$threadId = [DesktopFocusRecoveryNative]::ThreadId($dialog)
$activeMatches = $false
$focusMatches = $false
do {
  Start-Sleep -Milliseconds 50
  $info = New-Object DesktopFocusRecoveryNative+GUITHREADINFO
  $info.cbSize = [uint32](8 + (6 * [IntPtr]::Size) + 16)
  if ([DesktopFocusRecoveryNative]::GetForegroundWindow() -eq $dialog -and [DesktopFocusRecoveryNative]::GetGUIThreadInfo($threadId, [ref]$info)) {
    $activeMatches = ($info.hwndActive -eq $dialog)
    $focusMatches = ($info.hwndFocus -eq $edit)
  }
} while ((!$activeMatches -or !$focusMatches) -and [DateTime]::UtcNow -lt $focusDeadline)
if (-not $activeMatches -or -not $focusMatches) { throw 'FOCUS_RECOVERY_TARGET_NOT_REACQUIRED' }
[pscustomobject]@{
  ok = $true
  target_pid = $TargetPid
  dialog_handle = $DialogHandle
  filename_edit_handle = $FilenameEditHandle
  distractor_pid = $DistractorPid
  distractor_handle = $DistractorWindowHandle
  distractor_closed = $true
  dialog_foreground = $true
  dialog_active = $activeMatches
  filename_edit_focused = $focusMatches
} | ConvertTo-Json -Compress -Depth 3
