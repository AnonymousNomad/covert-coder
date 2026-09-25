param(
  [Parameter(Mandatory = $true)][int]$TargetPid,
  [Parameter(Mandatory = $true)][long]$DialogHandle,
  [Parameter(Mandatory = $true)][string]$SafeRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class DesktopPickerProbeNative {
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr hWnd, StringBuilder className, int maxCount);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  public static uint GetOwnerPid(IntPtr hWnd) { uint processId; GetWindowThreadProcessId(hWnd, out processId); return processId; }
  public static string WindowClass(IntPtr hWnd) { var name = new StringBuilder(256); return GetClassName(hWnd, name, name.Capacity) > 0 ? name.ToString() : String.Empty; }
}
'@ -ErrorAction Stop | Out-Null

function Protect-Text([object]$Value) {
  if ($null -eq $Value) { return $null }
  $text = [string]$Value
  if ($text.Length -eq 0) { return '' }
  $root = [IO.Path]::GetFullPath($SafeRoot).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  if ($text.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
    return '<FIXTURE_ROOT>' + $text.Substring($root.Length)
  }
  if ($text -match '^[A-Za-z]:\\|^\\\\') { return '<REDACTED_PATH>' }
  if ($text -match '^(?i:File name:|Open|Cancel|Look in:|File name|File list|Address|Location|upload-test\.txt|COVERT-FILE-PICKER-FIXTURE)$') {
    return $text
  }
  if ($text -match '^(?i:true|false|-?\d+)$') { return $text }
  return '<REDACTED_NON_FIXTURE_NAME>'
}

function Get-PatternNames([System.Windows.Automation.AutomationElement]$Element) {
  $result = [System.Collections.Generic.List[string]]::new()
  foreach ($name in @('Value', 'Text', 'LegacyIAccessible', 'SelectionItem', 'Invoke', 'ExpandCollapse', 'Window', 'Grid', 'Table', 'RangeValue', 'Scroll', 'ItemContainer', 'VirtualizedItem', 'Toggle', 'Transform', 'Selection', 'MultipleView', 'SynchronizedInput', 'Annotation', 'Dock', 'Drag', 'DropTarget')) {
    $pattern = $null
    try {
      $supported = switch ($name) {
        'Value' { $Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern) }
        'Text' { $Element.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$pattern) }
        'LegacyIAccessible' { $Element.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$pattern) }
        'SelectionItem' { $Element.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern) }
        'Invoke' { $Element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern) }
        'ExpandCollapse' { $Element.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$pattern) }
        'Window' { $Element.TryGetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern, [ref]$pattern) }
        'Grid' { $Element.TryGetCurrentPattern([System.Windows.Automation.GridPattern]::Pattern, [ref]$pattern) }
        'Table' { $Element.TryGetCurrentPattern([System.Windows.Automation.TablePattern]::Pattern, [ref]$pattern) }
        'RangeValue' { $Element.TryGetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern, [ref]$pattern) }
        'Scroll' { $Element.TryGetCurrentPattern([System.Windows.Automation.ScrollPattern]::Pattern, [ref]$pattern) }
        'ItemContainer' { $Element.TryGetCurrentPattern([System.Windows.Automation.ItemContainerPattern]::Pattern, [ref]$pattern) }
        'VirtualizedItem' { $Element.TryGetCurrentPattern([System.Windows.Automation.VirtualizedItemPattern]::Pattern, [ref]$pattern) }
        'Toggle' { $Element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$pattern) }
        'Transform' { $Element.TryGetCurrentPattern([System.Windows.Automation.TransformPattern]::Pattern, [ref]$pattern) }
        'Selection' { $Element.TryGetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern, [ref]$pattern) }
        'MultipleView' { $Element.TryGetCurrentPattern([System.Windows.Automation.MultipleViewPattern]::Pattern, [ref]$pattern) }
        'SynchronizedInput' { $Element.TryGetCurrentPattern([System.Windows.Automation.SynchronizedInputPattern]::Pattern, [ref]$pattern) }
        'Annotation' { $Element.TryGetCurrentPattern([System.Windows.Automation.AnnotationPattern]::Pattern, [ref]$pattern) }
        'Dock' { $Element.TryGetCurrentPattern([System.Windows.Automation.DockPattern]::Pattern, [ref]$pattern) }
        'Drag' { $Element.TryGetCurrentPattern([System.Windows.Automation.DragPattern]::Pattern, [ref]$pattern) }
        'DropTarget' { $Element.TryGetCurrentPattern([System.Windows.Automation.DropTargetPattern]::Pattern, [ref]$pattern) }
      }
      if ($supported) { [void]$result.Add($name) }
    } catch { }
  }
  return ,@($result)
}

function Get-ElementSummary([System.Windows.Automation.AutomationElement]$Element) {
  $current = $null
  try { $current = $Element.Current } catch { }
  if ($null -eq $current) {
    return [ordered]@{ control_type = $null; automation_id = $null; name = $null; class_name = $null; framework_id = $null; native_window_handle = $null; bounding_rectangle = $null; enabled = $null; keyboard_focusable = $null; has_keyboard_focus = $null; offscreen = $null; password = $null; process_id = $null; patterns = @(); legacy = $null; property_error = $true }
  }

  $rectangle = $null
  $rectangleValid = $false
  try {
    $bounds = $current.BoundingRectangle
    $coordinates = @([double]$bounds.X, [double]$bounds.Y, [double]$bounds.Width, [double]$bounds.Height)
    $rectangleValid = $true
    foreach ($coordinate in $coordinates) {
      if ([double]::IsNaN($coordinate) -or [double]::IsInfinity($coordinate)) { $rectangleValid = $false; break }
    }
    if ($rectangleValid) {
      $rectangle = [ordered]@{ x = $coordinates[0]; y = $coordinates[1]; width = $coordinates[2]; height = $coordinates[3] }
    }
  } catch { }

  $legacy = $null
  $legacyPattern = $null
  try {
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$legacyPattern)) {
      $legacyCurrent = $legacyPattern.Current
      $legacy = [ordered]@{
        role = [string]$legacyCurrent.Role
        state = [string]$legacyCurrent.State
        name = Protect-Text $legacyCurrent.Name
        value = Protect-Text $legacyCurrent.Value
      }
    }
  } catch { $legacy = [ordered]@{ error = $_.Exception.GetType().Name } }

  $valueInfo = $null
  $valuePattern = $null
  try {
    if ($Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
      $valueInfo = [ordered]@{ read_only = [bool]$valuePattern.Current.IsReadOnly; value = Protect-Text $valuePattern.Current.Value }
    }
  } catch { $valueInfo = [ordered]@{ error = $_.Exception.GetType().Name } }

  $handle = $null
  try { $handle = [long]$current.NativeWindowHandle } catch { }
  return [ordered]@{
    control_type = [string]$current.ControlType.ProgrammaticName
    automation_id = [string]$current.AutomationId
    name = Protect-Text $current.Name
    class_name = [string]$current.ClassName
    framework_id = [string]$current.FrameworkId
    native_window_handle = $handle
    bounding_rectangle = $rectangle
    bounding_rectangle_valid = $rectangleValid
    enabled = [bool]$current.IsEnabled
    keyboard_focusable = [bool]$current.IsKeyboardFocusable
    has_keyboard_focus = [bool]$current.HasKeyboardFocus
    offscreen = [bool]$current.IsOffscreen
    password = [bool]$current.IsPassword
    process_id = [int]$current.ProcessId
    patterns = Get-PatternNames $Element
    value_pattern = $valueInfo
    legacy = $legacy
  }
}

function Get-TreeSnapshot([System.Windows.Automation.AutomationElement]$Root, [System.Windows.Automation.TreeWalker]$Walker, [string]$ViewName) {
  $records = [System.Collections.Generic.List[object]]::new()
  $elements = @{}
  $queue = [System.Collections.Generic.Queue[object]]::new()
  $rootId = "$ViewName-0000"
  $queue.Enqueue([pscustomobject]@{ element = $Root; node_id = $rootId; parent_node_id = $null; depth = 0 })
  $truncated = $false
  $nodeLimit = 2500
  $depthLimit = 28
  while ($queue.Count -gt 0 -and $records.Count -lt $nodeLimit) {
    $entry = $queue.Dequeue()
    $record = Get-ElementSummary $entry.element
    $record.node_id = $entry.node_id
    $record.parent_node_id = $entry.parent_node_id
    $record.depth = $entry.depth
    $record.child_node_ids = @()
    $elements[$entry.node_id] = $entry.element
    [void]$records.Add($record)
    if ($entry.depth -ge $depthLimit) { $truncated = $true; continue }
    try {
      $child = $Walker.GetFirstChild($entry.element)
      $ordinal = 0
      while ($null -ne $child) {
        if (($records.Count + $queue.Count) -ge $nodeLimit) { $truncated = $true; break }
        $ordinal++
        $childId = '{0}-{1:D4}' -f $entry.node_id, $ordinal
        $record.child_node_ids += $childId
        $queue.Enqueue([pscustomobject]@{ element = $child; node_id = $childId; parent_node_id = $entry.node_id; depth = ($entry.depth + 1) })
        $child = $Walker.GetNextSibling($child)
      }
    } catch { $record.child_enumeration_error = $_.Exception.GetType().Name }
  }
  if ($queue.Count -gt 0) { $truncated = $true }
  return [pscustomobject]@{ view = $ViewName; root_node_id = $rootId; node_count = $records.Count; truncated = $truncated; nodes = @($records.ToArray()); elements = $elements }
}

function Get-ParentChain([System.Windows.Automation.AutomationElement]$Element, [System.Windows.Automation.TreeWalker]$Walker) {
  $chain = [System.Collections.Generic.List[object]]::new()
  $cursor = $Element
  for ($depth = 0; $depth -lt 24 -and $null -ne $cursor; $depth++) {
    [void]$chain.Add((Get-ElementSummary $cursor))
    try { $cursor = $Walker.GetParent($cursor) } catch { break }
  }
  return ,@($chain.ToArray())
}

function Get-SiblingContext([System.Windows.Automation.AutomationElement]$Element, [System.Windows.Automation.TreeWalker]$Walker) {
  $siblings = [System.Collections.Generic.List[object]]::new()
  try {
    $parent = $Walker.GetParent($Element)
    if ($null -eq $parent) { return ,@() }
    $child = $Walker.GetFirstChild($parent)
    $index = 0
    while ($null -ne $child -and $index -lt 48) {
      $index++
      $siblings.Add([pscustomobject]@{ ordinal = $index; element = $child }) | Out-Null
      $child = $Walker.GetNextSibling($child)
    }
    $result = foreach ($item in $siblings) {
      $summary = Get-ElementSummary $item.element
      $summary['sibling_ordinal'] = $item.ordinal
      $summary
    }
    return ,@($result)
  } catch { return ,@() }
}

function Get-NodeDescendantIds($Tree, [string]$NodeId) {
  $result = [System.Collections.Generic.List[string]]::new()
  $queue = [System.Collections.Generic.Queue[string]]::new()
  $byId = @{}
  foreach ($node in $Tree.nodes) { $byId[$node.node_id] = $node }
  $queue.Enqueue($NodeId)
  while ($queue.Count -gt 0) {
    $currentId = $queue.Dequeue()
    foreach ($childId in $byId[$currentId].child_node_ids) {
      [void]$result.Add($childId)
      $queue.Enqueue($childId)
    }
  }
  return ,@($result.ToArray())
}

$process = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId = " + $TargetPid) -ErrorAction SilentlyContinue
if ($null -eq $process -or [string]$process.Name -ine 'powershell.exe') { throw 'PICKER_PROBE_TARGET_PROCESS_INVALID' }
$createdAt = $process.CreationDate
if ($createdAt -isnot [datetime]) { $createdAt = [System.Management.ManagementDateTimeConverter]::ToDateTime([string]$createdAt) }
$identity = [ordered]@{
  pid = $TargetPid
  name = [string]$process.Name
  executable_path = ([string]$process.ExecutablePath -replace ('^' + [regex]::Escape($env:SystemRoot)), '<SYSTEMROOT>')
  created_at_utc = $createdAt.ToUniversalTime().ToString('o')
}

$handle = [IntPtr]::new($DialogHandle)
if (-not [DesktopPickerProbeNative]::IsWindow($handle) -or [DesktopPickerProbeNative]::GetOwnerPid($handle) -ne [uint32]$TargetPid) {
  throw 'PICKER_PROBE_DIALOG_OWNERSHIP_INVALID'
}
$dialog = [System.Windows.Automation.AutomationElement]::FromHandle($handle)
if ($null -eq $dialog -or [int]$dialog.Current.ProcessId -ne $TargetPid) { throw 'PICKER_PROBE_DIALOG_ELEMENT_INVALID' }

$rawWalker = [System.Windows.Automation.TreeWalker]::RawViewWalker
$controlWalker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$rawTree = Get-TreeSnapshot $dialog $rawWalker 'raw'
$controlTree = Get-TreeSnapshot $dialog $controlWalker 'control'

$candidates = @($controlTree.nodes | Where-Object { $_.automation_id -eq '1148' })
$candidateDetails = foreach ($candidate in $candidates) {
  [pscustomobject]@{
    node_id = $candidate.node_id
    summary = $candidate
    descendant_node_ids = Get-NodeDescendantIds $controlTree $candidate.node_id
    parent_chain = Get-ParentChain $controlTree.elements[$candidate.node_id] $controlWalker
    sibling_context = Get-SiblingContext $controlTree.elements[$candidate.node_id] $controlWalker
  }
}

$semanticLabels = @()
foreach ($tree in @($controlTree, $rawTree)) {
  $walker = if ($tree.view -eq 'control') { $controlWalker } else { $rawWalker }
  foreach ($node in $tree.nodes) {
    if ($node.name -in @('File name:', 'File name', 'Open', 'Cancel', 'Look in:', 'File list', 'Address', 'Location', 'upload-test.txt') -or $node.automation_id -eq '1') {
      $semanticLabels += [pscustomobject]@{
        view = $tree.view
        node_id = $node.node_id
        summary = $node
        parent_chain = Get-ParentChain $tree.elements[$node.node_id] $walker
        sibling_context = Get-SiblingContext $tree.elements[$node.node_id] $walker
      }
    }
  }
}

$focused = $null
$foregroundHandle = [long][DesktopPickerProbeNative]::GetForegroundWindow().ToInt64()
$foreground = [IntPtr]::new($foregroundHandle)
$foregroundOwnerPid = [long][DesktopPickerProbeNative]::GetOwnerPid($foreground)
$foregroundClass = [DesktopPickerProbeNative]::WindowClass($foreground)
try {
  $focusedElement = [System.Windows.Automation.AutomationElement]::FocusedElement
  if ($null -ne $focusedElement) {
    $focused = [ordered]@{
      summary = Get-ElementSummary $focusedElement
      raw_parent_chain = Get-ParentChain $focusedElement $rawWalker
      control_parent_chain = Get-ParentChain $focusedElement $controlWalker
      belongs_to_dialog = $false
    }
    $dialogRuntimeId = (@($dialog.GetRuntimeId()) -join ',')
    $cursor = $focusedElement
    for ($depth = 0; $depth -lt 64 -and $null -ne $cursor; $depth++) {
      if ((@($cursor.GetRuntimeId()) -join ',') -ceq $dialogRuntimeId) { $focused.belongs_to_dialog = $true; break }
      $cursor = $rawWalker.GetParent($cursor)
    }
  }
} catch { $focused = [ordered]@{ error = $_.Exception.GetType().Name } }

$safeRootFull = [IO.Path]::GetFullPath($SafeRoot)
$result = [ordered]@{
  schema_version = 1
  captured_at_utc = [DateTime]::UtcNow.ToString('o')
  provider = if ($candidates.Count -eq 3) { 'THREE_AUTOMATION_ID_1148_CANDIDATES' } else { 'UNEXPECTED_CANDIDATE_COUNT' }
  process = $identity
  dialog = [ordered]@{ hwnd = $DialogHandle; owner_pid = [long][DesktopPickerProbeNative]::GetOwnerPid($handle); class_name = [DesktopPickerProbeNative]::WindowClass($handle); safe_root = '<FIXTURE_ROOT>' }
  candidate_count_control_view = $candidates.Count
  candidate_count_raw_view = @($rawTree.nodes | Where-Object { $_.automation_id -eq '1148' }).Count
  candidate_details = @($candidateDetails)
  semantic_labels = @($semanticLabels)
  foreground = [ordered]@{ hwnd = $foregroundHandle; owner_pid = $foregroundOwnerPid; class_name = $foregroundClass; matches_dialog = ($foregroundHandle -eq $DialogHandle); belongs_to_target_process = ($foregroundOwnerPid -eq [long]$TargetPid) }
  focused_element = $focused
  raw_view = [ordered]@{ node_count = $rawTree.node_count; truncated = $rawTree.truncated; nodes = $rawTree.nodes }
  control_view = [ordered]@{ node_count = $controlTree.node_count; truncated = $controlTree.truncated; nodes = $controlTree.nodes }
}

if ($rawTree.truncated -or $controlTree.truncated) { $result.tree_truncated = $true }
$json = ConvertTo-Json -InputObject $result -Depth 80 -Compress
[Console]::Out.WriteLine($json)
