import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity } from '../../node/src/services/windows-process-identity.mjs';

test('UIA aborts text input when focus is stolen and leaves both fixture windows unchanged', {
  skip: process.platform !== 'win32', timeout: 120000
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-desktop-uia-focus-steal-'));
  const records = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://uia-focus-steal-fixture.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const actor = authority.authenticate(paired.token, origin);
  const desktop = createDesktopControl({ workspace, authority });
  const sessionId = `uia-focus-steal-${process.pid}-${Date.now()}`;
  const fixture = path.resolve('tests/fixtures/desktop-uia-fixture.ps1');
  const fixturePids = [];
  let task = 0;
  const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');

  async function execute(kind, body, callback) {
    const input = { workspace, taskId: `desktop-uia-focus-steal-${++task}`, kind, args: { body } };
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
      args: ['-NoProfile', '-STA', '-File', fixture, '-Root', workspace, '-SafeScreenshotOnly', ...extraArgs],
      show_window: true
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

  async function waitForWindow(pid, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const windows = await discover(pid);
      const found = windows.find(row => row.automation_id === 'covertDesktopFixtureWindow');
      if (found) return found;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.fail(`leased fixture window was not discovered for PID ${pid}`);
  }

  try {
    const grants = { enabled: true, grants: { apps: ['powershell.exe'], roots: [workspace], window_titles: [] }, ttl_minutes: 5 };
    await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));

    const distractorPid = await launchFixture();
    const distractorWindow = await waitForWindow(distractorPid);
    const targetPid = await launchFixture(['-StealFocusToHandle', String(distractorWindow.window_handle)]);
    const targetWindow = await waitForWindow(targetPid);

    let focusFailure;
    try {
      await action({ op: 'uia_action', target: JSON.stringify({
        action: 'type_text', pid: targetPid,
        window_handle: targetWindow.window_handle, lease_id: targetWindow.lease_id,
        automation_id: 'fixtureTextInput', text: 'COVERT_WRONG_WINDOW_MUST_NOT_RECEIVE',
        expected_value_sha256: hash('COVERT_WRONG_WINDOW_MUST_NOT_RECEIVE')
      }) });
    } catch (error) {
      focusFailure = error;
    }
    assert.ok(focusFailure, 'focus theft must abort the input operation');
    assert.equal(focusFailure.code, 'UIA_FOCUS_LOST');
    assert.equal(focusFailure.desktopReceipt?.result, 'FAILURE');
    assert.equal(focusFailure.desktopReceipt?.failure_classification, 'UIA_FOCUS_LOST');
    assert.match(focusFailure.diagnostic?.focus_check?.stage ?? focusFailure.diagnostic?.input_phase ?? '', /BEFORE_INPUT|SET_FOCUS/);
    assert.doesNotMatch(JSON.stringify(focusFailure.desktopReceipt), /COVERT_WRONG_WINDOW_MUST_NOT_RECEIVE/);

    const targetUntouched = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'press_key', pid: targetPid,
      window_handle: targetWindow.window_handle, lease_id: targetWindow.lease_id,
      automation_id: 'fixtureTextInput', verify_automation_id: 'fixtureTextInput',
      key: 'DELETE', expected_value_sha256: hash('')
    }) });
    assert.equal(targetUntouched.assertion.pass, true, 'target input remains empty after the refused dispatch');

    const distractorUntouched = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'press_key', pid: distractorPid,
      window_handle: distractorWindow.window_handle, lease_id: distractorWindow.lease_id,
      automation_id: 'fixtureTextInput', verify_automation_id: 'fixtureTextInput',
      key: 'DELETE', expected_value_sha256: hash('')
    }) });
    assert.equal(distractorUntouched.assertion.pass, true, 'distractor input remains empty; no text leaked to the wrong window');
    assert.doesNotMatch(JSON.stringify(records), /COVERT_WRONG_WINDOW_MUST_NOT_RECEIVE/);
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
