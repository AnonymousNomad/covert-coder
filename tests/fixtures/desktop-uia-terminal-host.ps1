param(
  [switch]$Watchdog,
  [int]$WatchPid = 0,
  [string]$WatchTargets64 = '',
  [string]$LogPath = '',
  [string]$ReadyPath = ''
)
$ErrorActionPreference = 'Stop'
$log = { param($message) if ($LogPath) { try { [IO.File]::AppendAllText($LogPath, ("{0} {1}`r`n" -f (Get-Date -Format 'HH:mm:ss.fff'), $message)) } catch { } } }

# Deterministic terminal host fixture for Desktop Control qualification.
# The launcher stays alive and hosts the console through conhost.exe, which is
# the only pattern that yields a real ConsoleWindowClass window when the parent
# tree is attached to a pseudoconsole. Earlier attempts can fail to attach, so
# each attempt is stability-checked before it is accepted. A self-watchdog
# reaps the exact host and terminal processes after the launcher dies
# (including force termination), verifying each retained creation time before
# any Stop-Process call.
if ($Watchdog) {
  & $log "watchdog start watch=$WatchPid"
  try { Wait-Process -Id $WatchPid -Timeout 900 -ErrorAction SilentlyContinue } catch { }
  & $log 'watchdog woke'
  Start-Sleep -Milliseconds 250
  $json = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($WatchTargets64))
  foreach ($target in ($json | ConvertFrom-Json)) {
    $process = Get-Process -Id $target.pid -ErrorAction SilentlyContinue
    if ($process -and [long]$process.StartTime.Ticks -eq [long]$target.ticks) {
      Stop-Process -Id $target.pid -Force -ErrorAction SilentlyContinue
      & $log "watchdog killed $($target.pid)"
    }
  }
  exit 0
}

& $log "launcher start pid=$PID"
$consoleHost = $null
$terminalProcess = $null
for ($attempt = 1; $attempt -le 8 -and $null -eq $terminalProcess; $attempt++) {
  $candidateHost = Start-Process -FilePath 'conhost.exe' -ArgumentList @('cmd.exe','/k') -PassThru
  & $log "attempt $attempt conhost pid=$($candidateHost.Id)"
  $candidateTerminal = $null
  $deadline = (Get-Date).AddSeconds(5)
  while ($null -eq $candidateTerminal -and (Get-Date) -lt $deadline) {
    $candidateTerminal = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($candidateHost.Id)" -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'cmd.exe' } | Select-Object -First 1
    if ($null -eq $candidateTerminal) { Start-Sleep -Milliseconds 200 }
  }
  if ($null -eq $candidateTerminal) {
    Stop-Process -Id $candidateHost.Id -Force -ErrorAction SilentlyContinue
    continue
  }
  Start-Sleep -Milliseconds 800
  $stableTerminal = Get-Process -Id $candidateTerminal.ProcessId -ErrorAction SilentlyContinue
  $stableHost = Get-Process -Id $candidateHost.Id -ErrorAction SilentlyContinue
  if ($stableTerminal -and $stableHost) {
    $consoleHost = $stableHost
    $terminalProcess = $stableTerminal
    & $log "accepted conhost=$($consoleHost.Id) terminal=$($terminalProcess.Id)"
  } else {
    & $log "attempt $attempt unstable; retrying"
    Stop-Process -Id $candidateHost.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $candidateTerminal.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
if ($null -eq $terminalProcess) { throw 'TERMINAL_CHILD_MISSING' }
& $log "terminal pid=$($terminalProcess.Id)"
$targets = @(
  [pscustomobject]@{ pid = $consoleHost.Id; ticks = [long]$consoleHost.StartTime.Ticks },
  [pscustomobject]@{ pid = $terminalProcess.Id; ticks = [long]$terminalProcess.StartTime.Ticks }
)
$encoded = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes(($targets | ConvertTo-Json -Compress)))
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath,'-Watchdog','-WatchPid',$PID,'-WatchTargets64',$encoded,'-LogPath',$LogPath) -WindowStyle Hidden | Out-Null
& $log 'watchdog spawned'
# Bring the hosted console window to the foreground deterministically. The
# launcher is not the foreground process, so the documented AttachThreadInput
# sequence is required; this is fixture setup only and never bypasses the
# product's own focus verification, which still refuses on any mismatch.
# Ordering note: the watchdog is spawned before this focus so its startup
# cannot steal the foreground from the terminal afterwards.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class CovertTerminalFocusNative {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint attach, uint attachTo, bool attachFlag);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int command);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder text, int maxCount);
  public static string WindowClass(IntPtr hwnd) { var text = new StringBuilder(256); return GetClassName(hwnd, text, text.Capacity) > 0 ? text.ToString() : String.Empty; }
  public static List<IntPtr> ConsoleWindowsForPid(uint target) {
    var found = new List<IntPtr>();
    EnumWindows((hwnd, lParam) => { uint processId; GetWindowThreadProcessId(hwnd, out processId); if (processId == target && IsWindowVisible(hwnd) && WindowClass(hwnd) == "ConsoleWindowClass") found.Add(hwnd); return true; }, IntPtr.Zero);
    return found;
  }
  public static uint ThreadId(IntPtr hwnd) { uint processId; return GetWindowThreadProcessId(hwnd, out processId); }
}
'@
$consoleWindow = [IntPtr]::Zero
$focusDeadline = (Get-Date).AddSeconds(10)
while ($consoleWindow -eq [IntPtr]::Zero -and (Get-Date) -lt $focusDeadline) {
  $candidateWindows = [CovertTerminalFocusNative]::ConsoleWindowsForPid([uint32]$terminalProcess.Id)
  if ($candidateWindows.Count -gt 0) { $consoleWindow = $candidateWindows[0] }
  else { Start-Sleep -Milliseconds 150 }
}
if ($consoleWindow -ne [IntPtr]::Zero) {
  [void][CovertTerminalFocusNative]::ShowWindow($consoleWindow, 9)
  Start-Sleep -Milliseconds 200
  $foreground = [CovertTerminalFocusNative]::GetForegroundWindow()
  $foregroundThread = [CovertTerminalFocusNative]::ThreadId($foreground)
  $currentThread = [CovertTerminalFocusNative]::GetCurrentThreadId()
  if ($foregroundThread -ne $currentThread) { [void][CovertTerminalFocusNative]::AttachThreadInput($currentThread, $foregroundThread, $true) }
  try { $focused = [CovertTerminalFocusNative]::SetForegroundWindow($consoleWindow) }
  finally { if ($foregroundThread -ne $currentThread) { [void][CovertTerminalFocusNative]::AttachThreadInput($currentThread, $foregroundThread, $false) } }
  & $log "console window focus=$focused hwnd=$($consoleWindow.ToInt64())"
} else {
  & $log 'console window not found for focus'
}
if ($ReadyPath) {
  [IO.File]::WriteAllText($ReadyPath, "host=$($consoleHost.Id) terminal=$($terminalProcess.Id)")
}
[Console]::Out.WriteLine("COVERT_TERMINAL_HOST_READY host=$($consoleHost.Id) terminal=$($terminalProcess.Id)")
[Console]::Out.Flush()
$hold = (Get-Date).AddMinutes(10)
while ((Get-Date) -lt $hold) { Start-Sleep -Milliseconds 500 }
