import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity } from '../../node/src/services/windows-process-identity.mjs';

async function runPickerTreeProbe(pid, windowHandle, safeRoot) {
  const script = path.resolve('tests/fixtures/desktop-uia-tree-probe.ps1');
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-STA', '-File', script,
    '-TargetPid', String(pid), '-DialogHandle', String(windowHandle), '-SafeRoot', safeRoot
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 30000);
  timeout.unref?.();
  let exit;
  try { exit = await closed; }
  finally { clearTimeout(timeout); }
  const remaining = child.pid ? await readWindowsProcessIdentity(child.pid) : null;
  assert.equal(remaining, null, 'the bounded read-only UIA probe process exited and was reaped');
  assert.equal(timedOut, false, 'the bounded UIA tree probe completed within 30 seconds');
  assert.equal(exit.code, 0, `picker tree probe exit ${exit.code ?? exit.signal}: ${stderr.slice(0, 2000)}`);
  let result;
  try { result = JSON.parse(stdout.trim()); }
  catch (error) {
    const lines = stdout.split(/\r?\n/).filter(Boolean);
    const classify = line => {
      const value = line.trimStart();
      return value.startsWith('{') ? 'JSON_OBJECT' : value.startsWith('[') ? 'JSON_ARRAY' :
        /^warning:/i.test(value) ? 'WARNING' : /^(At line:|CategoryInfo|FullyQualifiedErrorId|Exception:)/i.test(value) ? 'POWERSHELL_ERROR' :
          /^(True|False)$/i.test(value) ? 'BOOLEAN' : /^PS [A-Z]:\\/i.test(value) ? 'PROMPT' : 'OTHER';
    };
    const shape = {
      byte_length: Buffer.byteLength(stdout),
      line_count: lines.length,
      parse_error: String(error.message).slice(0, 160),
      prefix_class: /^\uFEFF/.test(stdout) ? 'BYTE_ORDER_MARK' : stdout.trimStart().startsWith('{') ? 'JSON_OBJECT_PREFIX' :
        stdout.trimStart().startsWith('[') ? 'JSON_ARRAY_PREFIX' : /^warning:/i.test(stdout.trimStart()) ? 'POWERSHELL_WARNING' :
          stdout.length === 0 ? 'EMPTY' : 'NON_JSON_PREFIX',
      line_shapes: lines.slice(0, 12).map(line => ({ length: line.length, classification: classify(line) }))
    };
    assert.fail(`picker tree probe returned invalid JSON: ${JSON.stringify(shape)}; stderr=${stderr.slice(0, 1000)}`);
  }
  assert.equal(result.process.pid, pid);
  assert.equal(result.dialog.owner_pid, pid);
  assert.equal(result.dialog.hwnd, windowHandle);
  assert.equal(result.dialog.safe_root, '<FIXTURE_ROOT>');
  assert.equal(result.candidate_count_control_view, 3);
  assert.equal(result.raw_view.truncated, false);
  assert.equal(result.control_view.truncated, false);
  assert.equal(result.candidate_details.length, 3);
  return result;
}

async function runPickerEntryProbe({ pid, windowHandle, resultWindowHandle, safeRoot, targetFile }) {
  const canonicalRoot = await fs.realpath(safeRoot);
  const canonicalFile = await fs.realpath(targetFile);
  const rootStat = await fs.lstat(canonicalRoot);
  assert.equal(rootStat.isDirectory() && !rootStat.isSymbolicLink() && (rootStat.attributes & 0x400) === 0, true, 'approved fixture root is a real directory');
  const relative = path.relative(canonicalRoot, canonicalFile);
  assert.equal(relative.length > 0 && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), true, 'canonical fixture file is contained inside the approved root');
  const fileStat = await fs.lstat(canonicalFile);
  assert.equal(fileStat.isFile() && !fileStat.isSymbolicLink() && (fileStat.attributes & 0x400) === 0, true, 'approved fixture target is a regular non-reparse file');
  let cursor = path.dirname(canonicalFile);
  let componentsChecked = 0;
  while (true) {
    const componentStat = await fs.lstat(cursor);
    assert.equal(componentStat.isDirectory() && !componentStat.isSymbolicLink() && (componentStat.attributes & 0x400) === 0, true, 'every fixture path component is a non-reparse directory');
    componentsChecked++;
    if (cursor.toLowerCase() === canonicalRoot.toLowerCase()) break;
    const parent = path.dirname(cursor);
    assert.notEqual(parent.toLowerCase(), cursor.toLowerCase(), 'canonical target parent chain reaches the approved root');
    cursor = parent;
  }
  const fileBytes = await fs.readFile(canonicalFile);
  const sha256 = createHash('sha256').update(fileBytes).digest('hex');
  const script = path.resolve('tests/fixtures/desktop-uia-picker-entry-probe.ps1');
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-STA', '-File', script,
    '-TargetPid', String(pid), '-DialogHandle', String(windowHandle), '-ResultWindowHandle', String(resultWindowHandle),
    '-SafeRoot', canonicalRoot, '-TargetFile', canonicalFile, '-ExpectedSha256', sha256
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let timedOut = false;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, 30000);
  timeout.unref?.();
  let exit;
  try { exit = await closed; }
  finally { clearTimeout(timeout); }
  const remaining = child.pid ? await readWindowsProcessIdentity(child.pid) : null;
  assert.equal(remaining, null, 'the bounded picker entry probe process exited and was reaped');
  assert.equal(timedOut, false, 'the bounded picker entry probe completed within 30 seconds');
  assert.equal(exit.code, 0, `picker entry probe exit ${exit.code ?? exit.signal}: ${stderr.slice(0, 1200)}`);
  let result;
  try { result = JSON.parse(stdout.trim()); }
  catch (error) { assert.fail(`picker entry probe returned invalid JSON (${Buffer.byteLength(stdout)} bytes): ${String(error.message).slice(0, 160)}; stderr=${stderr.slice(0, 1200)}`); }
  return { result, canonicalRoot, canonicalFile, fileBytes: fileBytes.length, sha256, componentsChecked };
}

async function preservePickerTree(provider, result) {
  if (process.env.COVERT_DESKTOP_CONTROL_PRESERVE_PICKER_TREE !== '1') return null;
  const relativeDirectory = 'docs/evidence/desktop-control-wave2';
  const directory = path.resolve(relativeDirectory);
  const stat = await fs.lstat(directory);
  assert.equal(stat.isDirectory() && !stat.isSymbolicLink(), true, 'picker evidence destination is a real directory');
  const destination = path.join(directory, `file-picker-accessibility-${provider}.json`);
  const contents = `${JSON.stringify(result, null, 2)}\n`;
  await fs.writeFile(destination, contents, { flag: 'wx' });
  return {
    path: `${relativeDirectory}/${path.basename(destination)}`,
    sha256: createHash('sha256').update(contents).digest('hex'),
    bytes: Buffer.byteLength(contents)
  };
}

function summarizePickerTree(tree) {
  const controlNodes = new Map(tree.control_view.nodes.map(node => [node.node_id, node]));
  return {
    foreground: tree.foreground,
    candidates: tree.candidate_details.map(candidate => ({
      control_type: candidate.summary.control_type,
      automation_id: candidate.summary.automation_id,
      class_name: candidate.summary.class_name,
      framework_id: candidate.summary.framework_id,
      native_window_handle: candidate.summary.native_window_handle,
      keyboard_focusable: candidate.summary.keyboard_focusable,
      has_keyboard_focus: candidate.summary.has_keyboard_focus,
      patterns: candidate.summary.patterns,
      child_count: candidate.descendant_node_ids.length,
      child_chain: candidate.descendant_node_ids.map(id => controlNodes.get(id)).filter(Boolean).map(node => ({
        node_id: node.node_id,
        control_type: node.control_type,
        automation_id: node.automation_id,
        class_name: node.class_name,
        framework_id: node.framework_id,
        native_window_handle: node.native_window_handle,
        keyboard_focusable: node.keyboard_focusable,
        has_keyboard_focus: node.has_keyboard_focus,
        patterns: node.patterns,
        value_pattern: node.value_pattern,
        legacy: node.legacy
      })),
      parent_chain: candidate.parent_chain.map(node => ({ control_type: node.control_type, automation_id: node.automation_id, class_name: node.class_name, framework_id: node.framework_id, native_window_handle: node.native_window_handle })),
      sibling_context: candidate.sibling_context.filter(node => node.name === 'File name:' || node.name === 'Open' || node.name === 'Cancel').map(node => ({ control_type: node.control_type, automation_id: node.automation_id, name: node.name, class_name: node.class_name }))
    })),
    semantic_labels: tree.semantic_labels.map(label => ({ view: label.view, control_type: label.summary.control_type, automation_id: label.summary.automation_id, name: label.summary.name, class_name: label.summary.class_name, patterns: label.summary.patterns, value_pattern: label.summary.value_pattern })),
    focused_element: tree.focused_element ? { belongs_to_dialog: tree.focused_element.belongs_to_dialog, summary: tree.focused_element.summary } : null,
    raw_node_count: tree.raw_view.node_count,
    control_node_count: tree.control_view.node_count,
    raw_candidate_count: tree.candidate_count_raw_view
  };
}

test('UIA captures a safe leased window and probes fixture-only selection in WPF and legacy WinForms pickers', {
  skip: process.platform !== 'win32', timeout: 180000
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-desktop-uia-capture-picker-'));
  const records = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://uia-capture-fixture.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const actor = authority.authenticate(paired.token, origin);
  let desktop = createDesktopControl({ workspace, authority });
  const sessionId = `uia-capture-${process.pid}-${Date.now()}`;
  const fixture = path.resolve('tests/fixtures/desktop-uia-fixture.ps1');
  const fixturePids = [];
  const cleanupOutcomes = new Map();
  let task = 0;

  async function execute(kind, body, callback) {
    const input = { workspace, taskId: `desktop-uia-capture-${++task}`, kind, args: { body } };
    const operation = await authority.prepare(actor, input);
    await authority.decide(actor, operation.operation_id, 'approve');
    return authority.execute(actor, operation.operation_id, input, (_descriptor, handle) => callback(handle));
  }

  async function action(body) {
    const request = { ...body, approved: true };
    return execute('desktop.action', request, handle => desktop.act(request, handle, sessionId));
  }

  async function launchFixture(extraArgs = []) {
    const result = await action({
      op: 'launch_app', target: 'powershell.exe',
      args: ['-NoProfile', '-STA', '-File', fixture, '-Root', workspace, ...extraArgs], show_window: true
    });
    const match = /owned process (\d+)/.exec(result.output);
    assert.ok(match, result.output);
    const pid = Number(match[1]);
    assert.ok(pid > 0);
    fixturePids.push(pid);
    return pid;
  }

  async function discover(pid) {
    const result = await action({ op: 'uia_action', target: JSON.stringify({ action: 'discover', pid }) });
    return JSON.parse(result.output).details.windows;
  }

  async function waitForWindow(pid, predicate, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const windows = await discover(pid);
      const found = windows.find(predicate);
      if (found) return { windows, found };
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.fail(`leased fixture window was not discovered for PID ${pid}`);
  }

  try {
    const grants = { enabled: true, grants: { apps: ['powershell.exe'], roots: [workspace], window_titles: [] }, ttl_minutes: 5 };
    await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));

    const capturePid = await launchFixture(['-SafeScreenshotOnly']);
    const { found: captureWindow } = await waitForWindow(capturePid, row => row.automation_id === 'covertDesktopFixtureWindow');
    const pointerClick = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'click', pid: capturePid, window_handle: captureWindow.window_handle, lease_id: captureWindow.lease_id,
      automation_id: 'fixtureToggleButton', verify_automation_id: 'fixtureStateCheckbox', expected_state: 'ON'
    }) });
    assert.equal(pointerClick.assertion.pass, true);
    assert.match(pointerClick.output, /COORDINATE_REVALIDATED/);
    assert.equal(pointerClick.receipt.result, 'SUCCESS');

    const captured = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'screenshot', pid: capturePid, window_handle: captureWindow.window_handle, lease_id: captureWindow.lease_id
    }) });
    assert.equal(captured.assertion.pass, true);
    const captureDetails = JSON.parse(captured.output).details;
    assert.match(captureDetails.capture_ref, /^\.aide\/desktop\/evidence\/[0-9a-f-]+\.png$/i);
    assert.match(captureDetails.capture_sha256, /^[0-9a-f]{64}$/i);
    assert.ok(captureDetails.capture_width >= 64 && captureDetails.capture_width <= 4096);
    assert.ok(captureDetails.capture_height >= 64 && captureDetails.capture_height <= 4096);
    const screenshot = await fs.readFile(path.join(workspace, ...captureDetails.capture_ref.split('/')));
    assert.deepEqual([...screenshot.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(createHash('sha256').update(screenshot).digest('hex'), captureDetails.capture_sha256);
    assert.equal(screenshot.readUInt32BE(16), captureDetails.capture_width);
    assert.equal(screenshot.readUInt32BE(20), captureDetails.capture_height);
    assert.equal(captured.receipt.attempt_id, sessionId);
    assert.equal(captured.receipt.process_id, capturePid);
    assert.equal(captured.receipt.window_handle, captureWindow.window_handle);
    assert.deepEqual(captured.receipt.evidence_refs, [captureDetails.capture_ref]);
    if (process.env.COVERT_DESKTOP_CONTROL_PRESERVE_CAPTURE === '1') {
      const evidenceRelative = 'docs/evidence/desktop-control-wave2';
      const evidenceDirectory = path.resolve(evidenceRelative);
      const evidenceParent = await fs.lstat(path.dirname(evidenceDirectory));
      assert.equal(evidenceParent.isDirectory() && !evidenceParent.isSymbolicLink(), true, 'evidence parent is a real directory');
      try { await fs.mkdir(evidenceDirectory); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      const evidenceStat = await fs.lstat(evidenceDirectory);
      assert.equal(evidenceStat.isDirectory() && !evidenceStat.isSymbolicLink(), true, 'evidence destination is a real directory');
      const screenshotName = `safe-fixture-window-${captureDetails.capture_sha256}.png`;
      const screenshotPath = path.join(evidenceDirectory, screenshotName);
      try { await fs.writeFile(screenshotPath, screenshot, { flag: 'wx' }); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const existing = await fs.readFile(screenshotPath);
        assert.equal(createHash('sha256').update(existing).digest('hex'), captureDetails.capture_sha256, 'existing evidence image is identical; never overwrite');
      }
      const durableReceipt = {
        schema_version: 1,
        attempt_id: sessionId,
        task_id: 'desktop-uia-capture-1',
        captured_at_utc: new Date().toISOString(),
        application: 'powershell.exe',
        process_id: capturePid,
        window_handle: captureWindow.window_handle,
        ownership_state: 'ATTEMPT_OWNED',
        operation: 'screenshot',
        capture_scope: 'LEASED_WINDOW_ONLY',
        capture_sha256: captureDetails.capture_sha256,
        capture_bytes: screenshot.length,
        width: captureDetails.capture_width,
        height: captureDetails.capture_height,
        verification: 'PNG_SIGNATURE_DIMENSIONS_AND_SHA256_MATCH',
        action_id: captured.receipt.action_id,
        evidence_ref: `${evidenceRelative}/${screenshotName}`
      };
      const receiptName = `window-capture-${captured.receipt.action_id}.json`;
      await fs.writeFile(path.join(evidenceDirectory, receiptName), `${JSON.stringify(durableReceipt, null, 2)}\n`, { flag: 'wx' });
      console.log(`PRESERVED_SAFE_CAPTURE=${evidenceRelative}/${screenshotName}`);
      console.log(`PRESERVED_CAPTURE_RECEIPT=${evidenceRelative}/${receiptName}`);
    }

    const captureCleanup = await execute('desktop.panic', {}, handle => desktop.panic(handle));
    assert.equal(captureCleanup.ok, true, 'the isolated capture fixture is cleaned up before opening the file picker');
    for (const outcome of captureCleanup.outcomes) cleanupOutcomes.set(outcome.pid, outcome);
    assert.equal(captureCleanup.outcomes.some(outcome => outcome.pid === capturePid && outcome.status === 'terminated'), true);
    assert.equal(await readWindowsProcessIdentity(capturePid), null);
    desktop = createDesktopControl({ workspace, authority });
    const pickerGrants = { enabled: true, grants: { apps: ['powershell.exe'], roots: [workspace], window_titles: [] }, ttl_minutes: 5 };
    await execute('desktop.grants', pickerGrants, handle => desktop.setGrants(pickerGrants, handle));

    const selectedFile = path.join(workspace, 'upload-test.txt');
    const selectedContents = 'COVERT-FILE-PICKER-FIXTURE';
    await fs.writeFile(selectedFile, selectedContents, { encoding: 'utf8', flag: 'wx' });
    const pickerPid = await launchFixture(['-OpenPickerOnLaunch']);
    const { windows: pickerWindows } = await waitForWindow(pickerPid, row => row.automation_id === 'covertDesktopFixtureWindow');
    const mainWindow = pickerWindows.find(row => row.automation_id === 'covertDesktopFixtureWindow');
    assert.ok(mainWindow, 'result window lease captured before selecting the file');

    let pickerWindow = null;
    const deadline = Date.now() + 20000;
    while (!pickerWindow && Date.now() < deadline) {
      const currentWindows = await discover(pickerPid);
      for (const candidate of currentWindows) {
        if (candidate.window_handle === mainWindow.window_handle) continue;
        try {
          const inspected = await action({ op: 'uia_action', target: JSON.stringify({
            action: 'inspect', pid: pickerPid, window_handle: candidate.window_handle, lease_id: candidate.lease_id
          }) });
          const controls = JSON.parse(inspected.output).details.controls;
          if (controls.some(control => control.automation_id === '1148') && controls.some(control => control.automation_id === '1')) {
            pickerWindow = candidate;
            break;
          }
        } catch (error) {
          if (!['UIA_WINDOW_UNAVAILABLE', 'UIA_WINDOW_STALE'].includes(error.code)) throw error;
        }
      }
      if (!pickerWindow) await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(pickerWindow, 'real Windows OpenFileDialog exposes the bounded filename and Open controls');

    const wpfPickerTree = await runPickerTreeProbe(pickerPid, pickerWindow.window_handle, workspace);
    const wpfTreeEvidence = await preservePickerTree('wpf-isolated', wpfPickerTree);
    console.log(`WPF_PICKER_ACCESSIBILITY=${JSON.stringify({ ...summarizePickerTree(wpfPickerTree), evidence: wpfTreeEvidence })}`);

    const outsideRoot = path.resolve(workspace, '..', `not-granted-${path.basename(workspace)}`);
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({
        action: 'select_file', pid: pickerPid, window_handle: pickerWindow.window_handle, lease_id: pickerWindow.lease_id,
        selection_root: outsideRoot, file_path: path.join(outsideRoot, 'operator-file.txt'),
        result_window_handle: mainWindow.window_handle, result_lease_id: mainWindow.lease_id,
        verify_automation_id: 'fixtureStatus'
      }) }),
      { code: 'PATH_NOT_GRANTED' },
      'selection outside the granted fixture root is refused before UIA dispatch'
    );

    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({
        action: 'select_file', pid: pickerPid, window_handle: pickerWindow.window_handle, lease_id: pickerWindow.lease_id,
        selection_root: workspace, file_path: selectedFile,
        result_window_handle: mainWindow.window_handle, result_lease_id: mainWindow.lease_id,
        verify_automation_id: 'fixtureStatus'
      }) }),
      error => {
        assert.equal(error.code, 'UIA_FILE_PICKER_CONTROL_UNAVAILABLE');
        assert.equal(error.desktopReceipt?.result, 'FAILURE');
        assert.equal(error.desktopReceipt?.failure_classification, 'UIA_FILE_PICKER_CONTROL_UNAVAILABLE');
        const diagnostic = error.diagnostic?.file_picker;
        console.log(`PICKER_STRUCTURAL_DIAGNOSTIC=${JSON.stringify({
          stage: diagnostic?.stage,
          filename_candidate_count: diagnostic?.filename_candidate_count,
          filename_candidates: diagnostic?.filename_candidates,
          nearby_control_count: diagnostic?.nearby_control_count,
          nearby_controls: diagnostic?.nearby_controls
        })}`);
        assert.equal(diagnostic?.stage, 'FILENAME_CONTROL');
        const usableFilenameFields = (diagnostic?.filename_candidates ?? []).filter(candidate =>
          candidate.control_type === 'ControlType.Edit' && candidate.enabled === true &&
          candidate.offscreen === false && candidate.password === false &&
          candidate.value_pattern === true && candidate.read_only === false
        );
        assert.equal(usableFilenameFields.length, 0, 'ambiguous or unproven picker controls are never used as a filename field');
        assert.doesNotMatch(JSON.stringify(diagnostic), /COVERT-FILE-PICKER-FIXTURE|upload-test\.txt/);
        return true;
      },
      'the current native picker provider surface is not qualified for safe file selection'
    );

    const wpfEntry = await runPickerEntryProbe({
      pid: pickerPid, windowHandle: pickerWindow.window_handle, resultWindowHandle: mainWindow.window_handle,
      safeRoot: workspace, targetFile: selectedFile
    });
    assert.equal(wpfEntry.result.ok, true, `WPF fixture-only semantic focus and input probe: ${JSON.stringify(wpfEntry.result)}`);
    assert.equal(wpfEntry.result.filename_entry.focus_runtime_id_verified, true);
    assert.equal(wpfEntry.result.path_containment.result, 'PASS');
    assert.equal(wpfEntry.result.input.target_path_readback_matches, true);
    assert.equal(wpfEntry.result.open.dispatch, 'BM_CLICK_EXACT_OWNED_BUTTON');
    assert.equal(wpfEntry.result.postcondition.dialog_closed, true);
    assert.equal(wpfEntry.result.postcondition.caller_path_matches, true);
    assert.equal(wpfEntry.result.postcondition.caller_sha256_matches, true);
    assert.equal(wpfEntry.result.path_containment.sha256, wpfEntry.sha256);
    console.log(`WPF_PICKER_FIXTURE_ENTRY=${JSON.stringify({ ...wpfEntry.result, canonical_root_verified: true, canonical_file_verified: true, path_components_checked: wpfEntry.componentsChecked })}`);

    const wpfCleanup = await execute('desktop.panic', {}, handle => desktop.panic(handle));
    assert.equal(wpfCleanup.ok, true, 'the isolated WPF caller is cleaned up before the WinForms variant starts');
    for (const outcome of wpfCleanup.outcomes) cleanupOutcomes.set(outcome.pid, outcome);
    assert.equal(wpfCleanup.outcomes.some(outcome => outcome.pid === pickerPid && outcome.status === 'terminated'), true);
    assert.equal(await readWindowsProcessIdentity(pickerPid), null);
    desktop = createDesktopControl({ workspace, authority });
    await execute('desktop.grants', pickerGrants, handle => desktop.setGrants(pickerGrants, handle));

    const legacyPickerPid = await launchFixture(['-OpenPickerOnLaunch', '-UseLegacyPicker']);
    const { found: legacyMainWindow } = await waitForWindow(legacyPickerPid, row => row.automation_id === 'covertDesktopFixtureWindow');
    let legacyPickerWindow = null;
    const legacyDeadline = Date.now() + 20000;
    while (!legacyPickerWindow && Date.now() < legacyDeadline) {
      for (const candidate of await discover(legacyPickerPid)) {
        if (candidate.window_handle === legacyMainWindow.window_handle) continue;
        try {
          const inspected = await action({ op: 'uia_action', target: JSON.stringify({
            action: 'inspect', pid: legacyPickerPid, window_handle: candidate.window_handle, lease_id: candidate.lease_id
          }) });
          const controls = JSON.parse(inspected.output).details.controls;
          if (controls.some(control => control.automation_id === '1148') && controls.some(control => control.automation_id === '1')) {
            legacyPickerWindow = candidate;
            break;
          }
        } catch (error) {
          if (!['UIA_WINDOW_UNAVAILABLE', 'UIA_WINDOW_STALE'].includes(error.code)) throw error;
        }
      }
      if (!legacyPickerWindow) await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(legacyPickerWindow, 'legacy Win32 picker dialog is discoverable under the owned fixture process');
    const winformsPickerTree = await runPickerTreeProbe(legacyPickerPid, legacyPickerWindow.window_handle, workspace);
    const winformsTreeEvidence = await preservePickerTree('winforms-isolated', winformsPickerTree);
    console.log(`WINFORMS_PICKER_ACCESSIBILITY=${JSON.stringify({ ...summarizePickerTree(winformsPickerTree), evidence: winformsTreeEvidence })}`);
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({
        action: 'select_file', pid: legacyPickerPid, window_handle: legacyPickerWindow.window_handle,
        lease_id: legacyPickerWindow.lease_id, selection_root: workspace, file_path: selectedFile,
        result_window_handle: legacyMainWindow.window_handle, result_lease_id: legacyMainWindow.lease_id,
        verify_automation_id: 'fixtureStatus'
      }) }),
      error => {
        const diagnostic = error.diagnostic?.file_picker;
        assert.equal(error.code, 'UIA_FILE_PICKER_CONTROL_UNAVAILABLE');
        assert.equal(error.desktopReceipt?.result, 'FAILURE');
        assert.equal(diagnostic?.stage, 'FILENAME_CONTROL');
        const usableFilenameFields = (diagnostic?.filename_candidates ?? []).filter(candidate =>
          candidate.control_type === 'ControlType.Edit' && candidate.enabled === true &&
          candidate.offscreen === false && candidate.password === false &&
          candidate.value_pattern === true && candidate.read_only === false
        );
        assert.equal(usableFilenameFields.length, 0, 'the provider refusal remains fail closed');
        assert.doesNotMatch(JSON.stringify(diagnostic), /COVERT-FILE-PICKER-FIXTURE|upload-test\.txt/);
        console.log(`LEGACY_PICKER_REFUSAL=${JSON.stringify({ code: error.code, stage: diagnostic.stage, filename_candidate_count: diagnostic.filename_candidate_count, filename_candidates: diagnostic.filename_candidates })}`);
        return true;
      },
      'the current WinForms production resolver remains fail closed before filename input'
    );

    const winformsEntry = await runPickerEntryProbe({
      pid: legacyPickerPid, windowHandle: legacyPickerWindow.window_handle, resultWindowHandle: legacyMainWindow.window_handle,
      safeRoot: workspace, targetFile: selectedFile
    });
    assert.equal(winformsEntry.result.ok, true, `WinForms fixture-only semantic focus and input probe: ${JSON.stringify(winformsEntry.result)}`);
    assert.equal(winformsEntry.result.filename_entry.focus_runtime_id_verified, true);
    assert.equal(winformsEntry.result.path_containment.result, 'PASS');
    assert.equal(winformsEntry.result.input.target_path_readback_matches, true);
    assert.equal(winformsEntry.result.open.dispatch, 'BM_CLICK_EXACT_OWNED_BUTTON');
    assert.equal(winformsEntry.result.postcondition.dialog_closed, true);
    assert.equal(winformsEntry.result.postcondition.caller_path_matches, true);
    assert.equal(winformsEntry.result.postcondition.caller_sha256_matches, true);
    assert.equal(winformsEntry.result.path_containment.sha256, winformsEntry.sha256);
    console.log(`WINFORMS_PICKER_FIXTURE_ENTRY=${JSON.stringify({ ...winformsEntry.result, canonical_root_verified: true, canonical_file_verified: true, path_components_checked: winformsEntry.componentsChecked })}`);
    assert.equal(captured.receipt.result, 'SUCCESS', 'bounded screenshot remains independently qualified');
    assert.doesNotMatch(JSON.stringify({ captured, records }), /FAKE-SECRET-NOT-REAL/);
  } finally {
    try {
      const panic = await execute('desktop.panic', {}, handle => desktop.panic(handle));
      assert.equal(panic.ok, true);
      for (const outcome of panic.outcomes) cleanupOutcomes.set(outcome.pid, outcome);
      assert.equal((await desktop.status()).tracked_children, 0);
      for (const pid of fixturePids) {
        assert.equal(['terminated', 'exited'].includes(cleanupOutcomes.get(pid)?.status), true, `owned fixture PID ${pid} terminated or exited through its retained owner`);
        assert.equal(await readWindowsProcessIdentity(pid), null, `owned fixture PID ${pid} is absent after cleanup`);
      }
    } finally {
      authority.control.close();
      await fs.rm(workspace, { recursive: true, force: true });
    }
  }
});
