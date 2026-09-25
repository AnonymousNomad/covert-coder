import { Buffer } from 'node:buffer';

const UIA_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop',
  'Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop',
  "Add-Type -TypeDefinition 'using System; using System.Collections.Generic; using System.Runtime.InteropServices; public static class CovertUiaNative { public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam); [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); [DllImport(\"user32.dll\")] private static extern bool IsWindowVisible(IntPtr hWnd); [DllImport(\"user32.dll\")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam); public static uint GetOwnerPid(IntPtr hWnd) { uint processId; GetWindowThreadProcessId(hWnd, out processId); return processId; } public static long[] VisibleWindowHandles(int targetPid) { var handles = new List<long>(); EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) { uint processId; GetWindowThreadProcessId(hWnd, out processId); if (processId == (uint)targetPid && IsWindowVisible(hWnd)) handles.Add(hWnd.ToInt64()); return true; }, IntPtr.Zero); return handles.ToArray(); } }' -ErrorAction SilentlyContinue",
  '$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json',
  '$expected = __IDENTITY__',
  'function Assert-TargetIdentity {',
  '  $actual = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId = " + [int]$expected.pid) -ErrorAction SilentlyContinue',
  "  if ($null -eq $actual) { throw 'UIA_PROCESS_IDENTITY_MISMATCH' }",
  '  $created = $actual.CreationDate',
  '  if ($created -isnot [datetime]) { $created = [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$created) }',
  '  $actualCreated = $created.ToUniversalTime().ToString(\'o\')',
  '  if ([int]$actual.ParentProcessId -ne [int]$expected.parentPid -or [string]$actual.Name -cne [string]$expected.name -or [string]$actual.ExecutablePath -ine [string]$expected.executablePath -or $actualCreated -cne [string]$expected.createdAtUtc) { throw \'UIA_PROCESS_IDENTITY_MISMATCH\' }',
  '}',
  'function Assert-TargetWindow {',
  '  Assert-TargetIdentity',
  '  $handle = [long]$payload.window_handle',
  '  $currentHandles = @([CovertUiaNative]::VisibleWindowHandles([int]$expected.pid))',
  '  if ($currentHandles -notcontains $handle -or [CovertUiaNative]::GetOwnerPid([IntPtr]::new($handle)) -ne [uint32]$expected.pid) { throw \'UIA_WINDOW_OWNER_MISMATCH\' }',
  '}',
  'try {',
  '  Assert-TargetIdentity',
  '  $windowHandles = @([CovertUiaNative]::VisibleWindowHandles([int]$expected.pid))',
  '  $allWindows = @($windowHandles | ForEach-Object { [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]::new([long]$_)) } | Where-Object { $null -ne $_ })',
  '  if ($payload.action -eq \'discover\') {',
  '    $rows = @($allWindows | Where-Object { $_.Current.NativeWindowHandle -ne 0 -and $_.Current.IsControlElement } | ForEach-Object {',
  '      [pscustomobject]@{ window_handle=[int]$_.Current.NativeWindowHandle; process_id=[int]$expected.pid }',
  '    })',
  '    $result = [pscustomobject]@{ ok=$true; verified=$true; action=\'discover\'; details=[pscustomobject]@{ windows=$rows } }',
  '  } else {',
  '    if ($windowHandles -notcontains [long]$payload.window_handle) { throw \'UIA_WINDOW_OWNER_MISMATCH\' }',
  '    $matches = @($allWindows | Where-Object { [int]$_.Current.NativeWindowHandle -eq [int]$payload.window_handle -and [CovertUiaNative]::GetOwnerPid([IntPtr]::new([long]$_.Current.NativeWindowHandle)) -eq [uint32]$expected.pid })',
  "    if ($matches.Count -ne 1) { throw 'UIA_WINDOW_NOT_UNIQUE' }",
  '    $window = $matches[0]',
  '    if (-not $window.Current.IsEnabled -or $window.Current.IsOffscreen) { throw \'UIA_WINDOW_UNAVAILABLE\' }',
  '    $verified = $false',
  '    $details = [pscustomobject]@{ window_handle=[int]$payload.window_handle; action=[string]$payload.action }',
  '    Assert-TargetIdentity',
  '    switch ([string]$payload.action) {',
  '      inspect {',
  '        $controls = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.IsControlElement -and -not $_.Current.IsPassword -and $_.Current.AutomationId } | Select-Object -First 256 | ForEach-Object { [pscustomobject]@{ automation_id=[string]$_.Current.AutomationId; control_type=[string]$_.Current.ControlType.ProgrammaticName; enabled=[bool]$_.Current.IsEnabled; offscreen=[bool]$_.Current.IsOffscreen } })',
  '        $verified = $true',
  '        $details | Add-Member -NotePropertyName controls -NotePropertyValue $controls',
  '      }',
  '      focus {',
  '        Assert-TargetWindow',
  '        $window.SetFocus()',
  '        Start-Sleep -Milliseconds 100',
  '        Assert-TargetWindow',
  '        $verified = ([CovertUiaNative]::GetForegroundWindow().ToInt64() -eq [int64]$payload.window_handle)',
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
  '        Assert-TargetWindow',
  '        $pattern.Invoke()',
  '        Start-Sleep -Milliseconds 150',
  '        Assert-TargetWindow',
  '        $observedState = [string]$toggle.Current.ToggleState',
  '        $verified = (($payload.expected_state -eq \'ON\' -and $observedState -eq \'On\') -or ($payload.expected_state -eq \'OFF\' -and $observedState -eq \'Off\'))',
  "        if (-not $verified) { throw 'UIA_POSTCONDITION_FAILED' }",
  '        $details | Add-Member -NotePropertyName automation_id -NotePropertyValue ([string]$payload.automation_id)',
  '        $details | Add-Member -NotePropertyName verified_by -NotePropertyValue ([string]$payload.verify_automation_id)',
  '      }',
  '      scroll {',
  '        $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty, [string]$payload.automation_id)',
  '        $elements = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition))',
  "        if ($elements.Count -ne 1) { throw 'UIA_CONTROL_NOT_UNIQUE' }",
  '        $element = $elements[0]',
  "        if (-not $element.Current.IsEnabled -or $element.Current.IsOffscreen -or $element.Current.IsPassword) { throw 'UIA_CONTROL_UNAVAILABLE' }",
  '        $pattern = $null',
  '        if (-not $element.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern, [ref]$pattern)) { throw \'UIA_SCROLL_PATTERN_UNAVAILABLE\' }',
  '        Assert-TargetWindow',
  '        $pattern.SetScrollPercent([double]$payload.horizontal_percent, [double]$payload.vertical_percent)',
  '        $current = $pattern.Current',
  '        Assert-TargetWindow',
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
  const identity64 = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64');
  const script = UIA_SCRIPT.replace('__IDENTITY__', `[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${identity64}')) | ConvertFrom-Json`) + [
    'catch {',
    '  $code = [string]$_.Exception.Message',
    "  if ($code -notmatch '^UIA_[A-Z_]+$') { $code = 'UIA_OPERATION_FAILED' }",
    '  [pscustomobject]@{ ok=$false; verified=$false; action=[string]$payload.action; code=$code } | ConvertTo-Json -Compress -Depth 3',
    '}'
  ].join('\n');
  return Buffer.from(script, 'utf16le').toString('base64');
}

export function validateWindowsUiaRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new TypeError('UIA request must be an object');
  const allowed = new Set(['action', 'pid', 'window_handle', 'automation_id', 'verify_automation_id', 'expected_state', 'horizontal_percent', 'vertical_percent']);
  if (Object.keys(request).some(key => !allowed.has(key))) throw new TypeError('UIA request contains unsupported fields');
  if (!Number.isSafeInteger(request.pid) || request.pid <= 0) throw new TypeError('UIA process ID is required');
  const fields = {
    discover: ['action', 'pid'],
    inspect: ['action', 'pid', 'window_handle'],
    focus: ['action', 'pid', 'window_handle'],
    invoke: ['action', 'pid', 'window_handle', 'automation_id', 'verify_automation_id', 'expected_state'],
    scroll: ['action', 'pid', 'window_handle', 'automation_id', 'horizontal_percent', 'vertical_percent']
  };
  if (!Object.hasOwn(fields, request.action)) throw new TypeError('UIA action is unsupported');
  const permitted = new Set(fields[request.action]);
  if (Object.keys(request).some(key => !permitted.has(key)) || fields[request.action].some(key => !Object.hasOwn(request, key))) throw new TypeError('UIA request fields do not match its action');
  if (request.action !== 'discover' && (!Number.isSafeInteger(request.window_handle) || request.window_handle <= 0)) throw new TypeError('UIA window handle is required');
  const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 64;
  if (['invoke', 'scroll'].includes(request.action) && !validId(request.automation_id)) throw new TypeError('UIA automation ID is required');
  if (request.action === 'invoke' && (!validId(request.verify_automation_id) || !['ON', 'OFF'].includes(request.expected_state))) throw new TypeError('UIA invoke requires a toggle-state postcondition');
  if (request.action === 'scroll') {
    for (const key of ['horizontal_percent', 'vertical_percent']) {
      const value = request[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < -1 || value > 100) throw new TypeError(`UIA ${key} must be between -1 and 100`);
    }
    if (request.horizontal_percent === -1 && request.vertical_percent === -1) throw new TypeError('UIA scroll requires at least one bounded axis');
  }
  return request;
}

export async function windowsUiaAction(request, identity, run) {
  if (typeof run !== 'function') throw new TypeError('Windows UIA runner is required');
  const encoded = buildWindowsUiaCommand(request, identity);
  const stdout = await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { timeout: 8000, input: JSON.stringify(request) });
  let result;
  try { result = JSON.parse(String(stdout).trim()); }
  catch { throw Object.assign(new Error('UI Automation returned malformed result data'), { code: 'UIA_RESULT_INVALID' }); }
  if (!result.ok || !result.verified) {
    throw Object.assign(new Error(String(result.code ?? 'UIA_ACTION_UNVERIFIED')), { code: String(result.code ?? 'UIA_ACTION_UNVERIFIED') });
  }
  return result;
}
