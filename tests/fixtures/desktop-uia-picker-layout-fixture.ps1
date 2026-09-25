param(
  [Parameter(Mandatory = $true)][int]$TargetPid,
  [Parameter(Mandatory = $true)][long]$DialogHandle,
  [Parameter(Mandatory = $true)][int]$Left,
  [Parameter(Mandatory = $true)][int]$Top,
  [Parameter(Mandatory = $true)][int]$Width,
  [Parameter(Mandatory = $true)][int]$Height
)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DesktopPickerLayoutNative {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder text, int maxCount);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
  public static uint OwnerPid(IntPtr hwnd) { uint pid; GetWindowThreadProcessId(hwnd, out pid); return pid; }
  public static string WindowClass(IntPtr hwnd) { var text = new StringBuilder(256); return GetClassName(hwnd, text, text.Capacity) > 0 ? text.ToString() : String.Empty; }
}
'@ -ErrorAction Stop | Out-Null

if ($Width -lt 400 -or $Height -lt 300) { throw 'PICKER_LAYOUT_BOUNDS_INVALID' }
$handle = [IntPtr]::new($DialogHandle)
if (-not [DesktopPickerLayoutNative]::IsWindow($handle) -or -not [DesktopPickerLayoutNative]::IsWindowVisible($handle) -or
    [DesktopPickerLayoutNative]::OwnerPid($handle) -ne [uint32]$TargetPid -or
    [DesktopPickerLayoutNative]::WindowClass($handle) -cne '#32770') { throw 'PICKER_LAYOUT_TARGET_INVALID' }
$before = New-Object DesktopPickerLayoutNative+RECT
if (-not [DesktopPickerLayoutNative]::GetWindowRect($handle, [ref]$before)) { throw 'PICKER_LAYOUT_READ_FAILED' }
if (-not [DesktopPickerLayoutNative]::SetWindowPos($handle, [IntPtr]::Zero, $Left, $Top, $Width, $Height, 0x0004 -bor 0x0010)) { throw 'PICKER_LAYOUT_MOVE_FAILED' }
$after = New-Object DesktopPickerLayoutNative+RECT
if (-not [DesktopPickerLayoutNative]::GetWindowRect($handle, [ref]$after)) { throw 'PICKER_LAYOUT_READ_FAILED' }
$beforeWidth = $before.Right - $before.Left
$beforeHeight = $before.Bottom - $before.Top
$afterWidth = $after.Right - $after.Left
$afterHeight = $after.Bottom - $after.Top
if ($after.Left -ne $Left -or $after.Top -ne $Top -or $afterWidth -ne $Width -or $afterHeight -ne $Height -or
    ($before.Left -eq $after.Left -and $before.Top -eq $after.Top -and $beforeWidth -eq $afterWidth -and $beforeHeight -eq $afterHeight)) {
  throw 'PICKER_LAYOUT_POSTCONDITION_FAILED'
}
[pscustomobject]@{
  ok = $true
  pid = $TargetPid
  hwnd = $DialogHandle
  before = [pscustomobject]@{ left = $before.Left; top = $before.Top; width = $beforeWidth; height = $beforeHeight }
  after = [pscustomobject]@{ left = $after.Left; top = $after.Top; width = $afterWidth; height = $afterHeight }
} | ConvertTo-Json -Compress -Depth 3
