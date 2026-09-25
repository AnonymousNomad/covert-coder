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

async function moveResizePicker(pid, windowHandle, left, top, width, height) {
  const script = path.resolve('tests/fixtures/desktop-uia-picker-layout-fixture.ps1');
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-File', script,
    '-TargetPid', String(pid), '-DialogHandle', String(windowHandle),
    '-Left', String(left), '-Top', String(top), '-Width', String(width), '-Height', String(height)
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
  }, 10000);
  timeout.unref?.();
  let exit;
  try { exit = await closed; }
  finally { clearTimeout(timeout); }
  const remaining = child.pid ? await readWindowsProcessIdentity(child.pid) : null;
  assert.equal(remaining, null, 'the bounded picker layout fixture exited and was reaped');
  assert.equal(timedOut, false, 'the bounded picker layout fixture completed within 10 seconds');
  assert.equal(exit.code, 0, `picker layout fixture exit ${exit.code ?? exit.signal}: ${stderr.slice(0, 1000)}`);
  let result;
  try { result = JSON.parse(stdout.trim()); }
  catch (error) { assert.fail(`picker layout fixture returned invalid JSON (${Buffer.byteLength(stdout)} bytes): ${String(error.message).slice(0, 160)}`); }
  assert.deepEqual({ pid: result.pid, hwnd: result.hwnd, left: result.after.left, top: result.after.top, width: result.after.width, height: result.after.height },
    { pid, hwnd: windowHandle, left, top, width, height });
  return result;
}

async function closeDistractorAndVerifyPicker({ targetPid, dialogHandle, filenameEditHandle, distractorPid, distractorWindow }) {
  const script = path.resolve('tests/fixtures/desktop-uia-focus-recovery-fixture.ps1');
  const child = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-File', script,
    '-TargetPid', String(targetPid), '-DialogHandle', String(dialogHandle), '-FilenameEditHandle', String(filenameEditHandle),
    '-DistractorPid', String(distractorPid), '-DistractorWindowHandle', String(distractorWindow.window_handle),
    '-DistractorClassName', distractorWindow.class_name
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
  }, 15000);
  timeout.unref?.();
  let exit;
  try { exit = await closed; }
  finally { clearTimeout(timeout); }
  const remaining = child.pid ? await readWindowsProcessIdentity(child.pid) : null;
  assert.equal(remaining, null, 'the bounded modal focus recovery fixture exited and was reaped');
  assert.equal(timedOut, false, 'the bounded modal focus recovery fixture completed within 15 seconds');
  assert.equal(exit.code, 0, `modal focus recovery fixture exit ${exit.code ?? exit.signal}: ${stderr.slice(0, 1000)}`);
  let result;
  try { result = JSON.parse(stdout.trim()); }
  catch (error) { assert.fail(`modal focus recovery fixture returned invalid JSON (${Buffer.byteLength(stdout)} bytes): ${String(error.message).slice(0, 160)}`); }
  assert.equal(result.ok, true);
  assert.equal(result.target_pid, targetPid);
  assert.equal(result.dialog_handle, dialogHandle);
  assert.equal(result.filename_edit_handle, filenameEditHandle);
  assert.equal(result.distractor_pid, distractorPid);
  assert.equal(result.distractor_closed, true);
  assert.equal(result.dialog_foreground, true);
  assert.equal(result.dialog_active, true);
  assert.equal(result.filename_edit_focused, true);
  return result;
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

test('UIA captures a safe leased window and qualifies product selection in WPF and legacy WinForms pickers', {
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
  let reparseTargetRoot = null;
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
    const selectedBytes = await fs.readFile(selectedFile);
    const selectedSha256 = createHash('sha256').update(selectedBytes).digest('hex');
    reparseTargetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-picker-reparse-target-'));
    await fs.writeFile(path.join(reparseTargetRoot, path.basename(selectedFile)), selectedContents, { encoding: 'utf8', flag: 'wx' });
    const junctionPath = path.join(workspace, 'picker-junction');
    await fs.symlink(reparseTargetRoot, junctionPath, 'junction');
    const junctionStat = await fs.lstat(junctionPath);
    assert.equal(junctionStat.isSymbolicLink() || (junctionStat.attributes & 0x400) !== 0, true, 'the fixture junction is a reparse point');

    async function selectApprovedFile(pid, picker, main, filePath = selectedFile, selectionRoot = workspace) {
      return action({ op: 'uia_action', target: JSON.stringify({
        action: 'select_file', pid, window_handle: picker.window_handle, lease_id: picker.lease_id,
        selection_root: selectionRoot, file_path: filePath,
        result_window_handle: main.window_handle, result_lease_id: main.lease_id,
        verify_file_automation_id: 'fixtureSelectedPath', verify_sha256_automation_id: 'fixtureSelectedSha256'
      }) });
    }

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

    const movedWpfPicker = await moveResizePicker(pickerPid, pickerWindow.window_handle, 120, 120, 900, 620);
    console.log(`WPF_PICKER_MOVED_RESIZED=${JSON.stringify(movedWpfPicker)}`);

    await assert.rejects(
      () => selectApprovedFile(pickerPid, pickerWindow, mainWindow,
        `${workspace}${path.sep}..${path.sep}path-traversal.txt`),
      { code: 'PATH_NOT_GRANTED' },
      'literal traversal is refused before native picker input'
    );
    await assert.rejects(
      () => selectApprovedFile(pickerPid, pickerWindow, mainWindow,
        `${workspace}-escape${path.sep}similar-prefix.txt`),
      { code: 'PATH_NOT_GRANTED' },
      'similar-prefix path escapes are refused before native picker input'
    );
    await assert.rejects(
      () => selectApprovedFile(pickerPid, pickerWindow, mainWindow,
        path.join(junctionPath, path.basename(selectedFile))),
      { code: 'PATH_NOT_GRANTED' },
      'junction/reparse path escapes are refused before native picker input'
    );

    const distractorPid = await launchFixture(['-SafeScreenshotOnly']);
    const { found: distractorWindow } = await waitForWindow(distractorPid, row => row.automation_id === 'covertDesktopFixtureWindow');
    const focusDistractor = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'focus', pid: distractorPid, window_handle: distractorWindow.window_handle, lease_id: distractorWindow.lease_id
    }) });
    assert.equal(focusDistractor.assertion.pass, true, 'the unrelated eligible-looking window receives focus for the refusal test');
    await assert.rejects(
      () => selectApprovedFile(pickerPid, pickerWindow, mainWindow),
      error => {
        const diagnostic = error.diagnostic ?? {};
        assert.equal(error.code, 'UIA_FOCUS_LOST', `unexpected picker refusal: ${JSON.stringify({ code: error.code, exception_type: diagnostic.exception_type, line: diagnostic.line, input_phase: diagnostic.input_phase, picker_stage: diagnostic.file_picker?.stage })}`);
        assert.equal(error.desktopReceipt?.result, 'FAILURE');
        assert.equal(diagnostic.input_phase, 'BEFORE_INPUT');
        assert.equal(diagnostic.focus_check?.foreground_matches, false);
        assert.equal(diagnostic.focus_check?.focused_process_id, distractorPid);
        assert.doesNotMatch(JSON.stringify(diagnostic), /COVERT-FILE-PICKER-FIXTURE|upload-test\.txt/);
        return true;
      },
      'the picker refuses before sending any path characters while a different owned window has focus'
    );
    const stalePickerLease = pickerWindow.lease_id;
    await assert.rejects(
      () => selectApprovedFile(pickerPid, pickerWindow, mainWindow),
      { code: 'UIA_LEASE_INVALID' },
      'focus loss invalidates the prior picker lease before recovery'
    );
    const focusRecovery = await closeDistractorAndVerifyPicker({
      targetPid: pickerPid,
      dialogHandle: pickerWindow.window_handle,
      filenameEditHandle: wpfPickerTree.focused_element.summary.native_window_handle,
      distractorPid,
      distractorWindow
    });
    console.log(`WPF_PICKER_FOCUS_RECOVERY=${JSON.stringify(focusRecovery)}`);
    assert.equal(await readWindowsProcessIdentity(distractorPid), null, 'the exact disposable distractor process exited after WM_CLOSE');
    cleanupOutcomes.set(distractorPid, { pid: distractorPid, status: 'exited' });
    const reacquiredWindows = await discover(pickerPid);
    const reacquiredPicker = reacquiredWindows.find(row => row.window_handle === pickerWindow.window_handle);
    assert.ok(reacquiredPicker, 'the original dialog is rediscovered under its original owned process');
    assert.notEqual(reacquiredPicker.lease_id, stalePickerLease, 'rediscovery issues a new dialog lease');
    pickerWindow = reacquiredPicker;

    const wpfSelection = await selectApprovedFile(pickerPid, pickerWindow, mainWindow);
    assert.equal(wpfSelection.assertion.pass, true);
    assert.equal(wpfSelection.receipt.result, 'SUCCESS');
    const wpfDetails = JSON.parse(wpfSelection.output).details;
    assert.equal(wpfDetails.file_sha256, selectedSha256);
    assert.equal(wpfDetails.file_bytes, selectedBytes.length);
    assert.equal(wpfDetails.filename_focus_verified, true);
    assert.equal(wpfDetails.input_path_readback_verified, true);
    assert.equal(wpfDetails.path_containment, 'PASS');
    assert.equal(wpfDetails.dialog_closed, true);
    assert.equal(wpfDetails.caller_path_receipt_verified, true);
    assert.equal(wpfDetails.caller_sha256_receipt_verified, true);
    assert.equal(wpfDetails.open_dispatch, 'BM_CLICK_EXACT_OWNED_BUTTON');
    assert.equal(wpfSelection.receipt.postcondition, 'caller_file_path_and_sha256');
    await assert.rejects(
      () => selectApprovedFile(pickerPid, pickerWindow, mainWindow),
      { code: 'UIA_LEASE_INVALID' },
      'the consumed dialog lease is invalid after the native picker closes'
    );
    console.log(`WPF_PICKER_PRODUCT_SELECTION=${JSON.stringify({ path_containment: wpfDetails.path_containment, focus_verified: wpfDetails.filename_focus_verified, input_readback_verified: wpfDetails.input_path_readback_verified, open_dispatch: wpfDetails.open_dispatch, dialog_closed: wpfDetails.dialog_closed, caller_path_receipt: wpfDetails.caller_path_receipt_verified, caller_sha256_receipt: wpfDetails.caller_sha256_receipt_verified, file_sha256: wpfDetails.file_sha256, file_bytes: wpfDetails.file_bytes })}`);

    const wpfCleanup = await execute('desktop.panic', {}, handle => desktop.panic(handle));
    assert.equal(wpfCleanup.ok, true, 'the isolated WPF caller is cleaned up before the WinForms variant starts');
    for (const outcome of wpfCleanup.outcomes) cleanupOutcomes.set(outcome.pid, outcome);
    assert.equal(wpfCleanup.outcomes.some(outcome => outcome.pid === pickerPid && outcome.status === 'terminated'), true);
    assert.equal(cleanupOutcomes.get(distractorPid)?.status, 'exited');
    assert.equal(await readWindowsProcessIdentity(pickerPid), null);
    assert.equal(await readWindowsProcessIdentity(distractorPid), null);
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
    const movedWinformsPicker = await moveResizePicker(legacyPickerPid, legacyPickerWindow.window_handle, 140, 140, 860, 600);
    console.log(`WINFORMS_PICKER_MOVED_RESIZED=${JSON.stringify(movedWinformsPicker)}`);

    const outsideRoot = path.resolve(workspace, '..', `not-granted-${path.basename(workspace)}`);
    await assert.rejects(
      () => selectApprovedFile(legacyPickerPid, legacyPickerWindow, legacyMainWindow,
        path.join(outsideRoot, 'operator-file.txt'), outsideRoot),
      { code: 'PATH_NOT_GRANTED' },
      'the in-root success path still refuses a selection whose root is outside granted roots'
    );

    const winformsSelection = await selectApprovedFile(legacyPickerPid, legacyPickerWindow, legacyMainWindow);
    assert.equal(winformsSelection.assertion.pass, true);
    assert.equal(winformsSelection.receipt.result, 'SUCCESS');
    const winformsDetails = JSON.parse(winformsSelection.output).details;
    assert.equal(winformsDetails.file_sha256, selectedSha256);
    assert.equal(winformsDetails.file_bytes, selectedBytes.length);
    assert.equal(winformsDetails.filename_focus_verified, true);
    assert.equal(winformsDetails.input_path_readback_verified, true);
    assert.equal(winformsDetails.path_containment, 'PASS');
    assert.equal(winformsDetails.dialog_closed, true);
    assert.equal(winformsDetails.caller_path_receipt_verified, true);
    assert.equal(winformsDetails.caller_sha256_receipt_verified, true);
    assert.equal(winformsDetails.open_dispatch, 'BM_CLICK_EXACT_OWNED_BUTTON');
    assert.equal(winformsSelection.receipt.postcondition, 'caller_file_path_and_sha256');
    console.log(`WINFORMS_PICKER_PRODUCT_SELECTION=${JSON.stringify({ path_containment: winformsDetails.path_containment, focus_verified: winformsDetails.filename_focus_verified, input_readback_verified: winformsDetails.input_path_readback_verified, open_dispatch: winformsDetails.open_dispatch, dialog_closed: winformsDetails.dialog_closed, caller_path_receipt: winformsDetails.caller_path_receipt_verified, caller_sha256_receipt: winformsDetails.caller_sha256_receipt_verified, file_sha256: winformsDetails.file_sha256, file_bytes: winformsDetails.file_bytes })}`);
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
      if (reparseTargetRoot) await fs.rm(reparseTargetRoot, { recursive: true, force: true });
    }
  }
});
