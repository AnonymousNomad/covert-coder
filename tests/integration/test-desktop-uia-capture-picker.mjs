import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity } from '../../node/src/services/windows-process-identity.mjs';

test('UIA captures a safe leased window and fails closed when the native picker target is ambiguous', {
  skip: process.platform !== 'win32', timeout: 180000
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-desktop-uia-capture-picker-'));
  const records = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://uia-capture-fixture.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const actor = authority.authenticate(paired.token, origin);
  const desktop = createDesktopControl({ workspace, authority });
  const sessionId = `uia-capture-${process.pid}-${Date.now()}`;
  const fixture = path.resolve('tests/fixtures/desktop-uia-fixture.ps1');
  const fixturePids = [];
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
    assert.equal(captured.receipt.result, 'SUCCESS', 'bounded screenshot remains independently qualified');
    assert.doesNotMatch(JSON.stringify({ captured, records }), /FAKE-SECRET-NOT-REAL/);
  } finally {
    try {
      const panic = await execute('desktop.panic', {}, handle => desktop.panic(handle));
      assert.equal(panic.ok, true);
      assert.equal((await desktop.status()).tracked_children, 0);
      for (const pid of fixturePids) {
        assert.equal(panic.outcomes.some(outcome => outcome.pid === pid && outcome.status === 'terminated'), true, `owned fixture PID ${pid} terminated`);
        assert.equal(await readWindowsProcessIdentity(pid), null, `owned fixture PID ${pid} is absent after cleanup`);
      }
    } finally {
      authority.control.close();
      await fs.rm(workspace, { recursive: true, force: true });
    }
  }
});
