import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';

test('UIA enforces session ownership and approval, then verifies focus, scroll, invoke, and secret-safe inspection', { skip: process.platform !== 'win32' }, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-desktop-uia-'));
  const records = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://uia-fixture.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const actor = authority.authenticate(paired.token, origin);
  const desktop = createDesktopControl({ workspace, authority });
  let task = 0;
  let fixturePid = null;

  async function execute(kind, body, callback) {
    const input = { workspace, taskId: `desktop-uia-${++task}`, kind, args: { body } };
    const op = await authority.prepare(actor, input);
    await authority.decide(actor, op.operation_id, 'approve');
    return authority.execute(actor, op.operation_id, input, (_descriptor, handle) => callback(handle));
  }

  async function action(body) {
    const request = { ...body, approved: true };
    return execute('desktop.action', request, handle => desktop.act(request, handle));
  }

  let primaryFailure = null;
  try {
    const fixture = path.resolve('tests/fixtures/desktop-uia-fixture.ps1');
    const grants = { enabled: true, grants: { apps: ['powershell.exe'], roots: [workspace], window_titles: [] }, ttl_minutes: 5 };
    await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));
    const unapproved = { op: 'uia_action', target: JSON.stringify({ action: 'discover', pid: process.pid }), approved: false };
    await assert.rejects(
      () => execute('desktop.action', unapproved, handle => desktop.act(unapproved, handle)),
      { code: 'NO_APPROVAL' },
      'UI Automation must be refused before dispatch without action approval'
    );
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({ action: 'discover', pid: process.pid }) }),
      { code: 'UIA_TARGET_NOT_OWNED' },
      'a visible/current process is not authorized unless this session launched and retained it'
    );
    const launched = await action({ op: 'launch_app', target: 'powershell.exe', args: ['-NoProfile', '-STA', '-File', fixture], show_window: true });
    const pidMatch = /owned process (\d+)/.exec(launched.output);
    assert.ok(pidMatch, launched.output);
    fixturePid = Number(pidMatch[1]);
    assert.ok(fixturePid > 0);

    const discovered = await action({ op: 'uia_action', target: JSON.stringify({ action: 'discover', pid: fixturePid }) });
    const windows = JSON.parse(discovered.output).details.windows;
    assert.ok(windows.length > 0, discovered.output);
    let windowHandle = null;
    let windowLeaseId = null;
    let controls = [];
    const candidates = [];
    for (const candidate of windows) {
      const inspected = await action({ op: 'uia_action', target: JSON.stringify({ action: 'inspect', pid: fixturePid, window_handle: candidate.window_handle, lease_id: candidate.lease_id }) });
      const candidateControls = JSON.parse(inspected.output).details.controls;
      candidates.push({ window_handle: candidate.window_handle, automation_ids: candidateControls.map(control => control.automation_id) });
      if (candidateControls.some(control => control.automation_id === 'fixtureToggleButton') && candidateControls.some(control => control.automation_id === 'fixtureStateCheckbox') && candidateControls.some(control => control.automation_id === 'fixtureScrollViewer')) {
        windowHandle = candidate.window_handle;
        windowLeaseId = candidate.lease_id;
        controls = candidateControls;
        break;
      }
    }
    assert.ok(windowHandle !== null, JSON.stringify(candidates));
    assert.ok(controls.some(control => control.automation_id === 'fixtureToggleButton'));
    assert.ok(controls.some(control => control.automation_id === 'fixtureStateCheckbox'));
    assert.ok(controls.some(control => control.automation_id === 'fixtureScrollViewer'));
    assert.ok(!controls.some(control => control.automation_id === 'fixtureFakeSecretField'), 'password controls must be excluded from UIA inspection');
    assert.doesNotMatch(JSON.stringify(controls), /FAKE-SECRET-NOT-REAL/, 'fake credential value must never be serialized');
    const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
    const inputFocus = await action({ op: 'uia_action', target: JSON.stringify({ action: 'focus', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput' }) });
    assert.equal(inputFocus.assertion.pass, true);
    const typed = await action({ op: 'uia_action', target: JSON.stringify({ action: 'type_text', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput', text: 'COVERT-INPUT', expected_value_sha256: hash('COVERT-INPUT') }) });
    assert.equal(typed.assertion.pass, true);
    assert.doesNotMatch(typed.output, /COVERT-INPUT/, 'typed text is not returned in action output');
    const replaced = await action({ op: 'uia_action', target: JSON.stringify({ action: 'replace_text', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput', text: 'REPLACE-ME', expected_value_sha256: hash('REPLACE-ME') }) });
    assert.equal(replaced.assertion.pass, true, 'Ctrl+A replacement is followed by value-hash verification');
    const backspace = await action({ op: 'uia_action', target: JSON.stringify({ action: 'press_key', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput', verify_automation_id: 'fixtureTextInput', key: 'BACKSPACE', expected_value_sha256: hash('REPLACE-M') }) });
    assert.equal(backspace.assertion.pass, true);
    const restored = await action({ op: 'uia_action', target: JSON.stringify({ action: 'type_text', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput', text: 'E', expected_value_sha256: hash('REPLACE-ME') }) });
    assert.equal(restored.assertion.pass, true);
    const deleteKey = await action({ op: 'uia_action', target: JSON.stringify({ action: 'press_key', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput', verify_automation_id: 'fixtureStatus', key: 'DELETE', expected_value_sha256: hash('DELETE_RECEIVED') }) });
    assert.equal(deleteKey.assertion.pass, true);
    const enterKey = await action({ op: 'uia_action', target: JSON.stringify({ action: 'press_key', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput', verify_automation_id: 'fixtureStatus', key: 'ENTER', expected_value_sha256: hash('ENTER_RECEIVED') }) });
    assert.equal(enterKey.assertion.pass, true);
    const escapeKey = await action({ op: 'uia_action', target: JSON.stringify({ action: 'press_key', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput', verify_automation_id: 'fixtureStatus', key: 'ESCAPE', expected_value_sha256: hash('ESCAPE_RECEIVED') }) });
    assert.equal(escapeKey.assertion.pass, true);
    const tabKey = await action({ op: 'uia_action', target: JSON.stringify({ action: 'press_key', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureTextInput', verify_automation_id: 'fixtureTabTarget', key: 'TAB', expected_value_sha256: hash('') }) });
    assert.equal(tabKey.assertion.pass, true, 'Tab focus is checked against the next fixture control');
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({ action: 'type_text', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureFakeSecretField', text: 'FAKE-SECRET-NOT-REAL', expected_value_sha256: hash('FAKE-SECRET-NOT-REAL') }) }),
      { code: 'UIA_CONTROL_UNAVAILABLE' },
      'password controls cannot be used as desktop text targets'
    );
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({ action: 'screenshot', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId }) }),
      { code: 'UIA_SENSITIVE_WINDOW' },
      'a window containing a password field is excluded from capture'
    );
    const captureRoot = path.join(workspace, '.aide', 'desktop', 'evidence');
    const remainingCaptures = await fs.readdir(captureRoot).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
    assert.deepEqual(remainingCaptures.filter(file => file.endsWith('.png')), [], 'refused sensitive capture leaves no partial PNG');
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({ action: 'inspect', pid: fixturePid, window_handle: 1, lease_id: windowLeaseId }) }),
      error => {
        assert.equal(error.code, 'UIA_LEASE_INVALID', 'a forged HWND must be rejected by lease preflight');
        assert.equal(error.desktopReceipt?.result, 'FAILURE');
        assert.equal(error.desktopReceipt?.failure_classification, 'UIA_LEASE_INVALID');
        return true;
      },
      'a fabricated or foreign window handle must fail ownership validation before provider dispatch'
    );
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({ action: 'invoke', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'missingFixtureControl', verify_automation_id: 'fixtureStateCheckbox', expected_state: 'ON' }) }),
      { code: 'UIA_CONTROL_NOT_UNIQUE' },
      'a missing semantic control must fail without substituting a coordinate or text target'
    );

    const focused = await action({ op: 'uia_action', target: JSON.stringify({ action: 'focus', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId }) });
    assert.equal(focused.assertion.pass, true);
    const scrolled = await action({ op: 'uia_action', target: JSON.stringify({ action: 'scroll', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureScrollViewer', horizontal_percent: -1, vertical_percent: 100 }) });
    assert.equal(scrolled.assertion.pass, true);
    assert.match(scrolled.assertion.check, /uia_verified:scroll/);
    const invoked = await action({ op: 'uia_action', target: JSON.stringify({ action: 'invoke', pid: fixturePid, window_handle: windowHandle, lease_id: windowLeaseId, automation_id: 'fixtureToggleButton', verify_automation_id: 'fixtureStateCheckbox', expected_state: 'ON' }) });
    assert.equal(invoked.assertion.pass, true);
    assert.match(invoked.assertion.check, /uia_verified:invoke/);
    assert.equal(invoked.assertion.details.verified_by, 'fixtureStateCheckbox');
    assert.equal(invoked.assertion.details.automation_id, 'fixtureToggleButton');
    const stateEvents = (await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const invokeReceipt = stateEvents.findLast(event => event.type === 'desktop' && event.op === 'uia_action' && event.decision === 'executed' && event.assertion?.check === 'uia_verified:invoke');
    assert.ok(invokeReceipt, 'successful semantic operation must emit a provenance receipt');
    assert.equal(invokeReceipt.assertion.details.verified_by, 'fixtureStateCheckbox');
    assert.doesNotMatch(JSON.stringify(invokeReceipt), /FAKE-SECRET-NOT-REAL/, 'receipt must not include fake password value');
    const persistedEvidence = await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8');
    assert.doesNotMatch(persistedEvidence, /FAKE-SECRET-NOT-REAL/, 'fake credential-shaped input is absent from persistent evidence');
    assert.ok(records.some(event => event.kind === 'desktop.action' && event.decision === 'execution-succeeded'));
    assert.equal(invokeReceipt.receipt.ownership_state, 'ATTEMPT_OWNED');
    assert.equal(invokeReceipt.receipt.lease_id, windowLeaseId);
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try {
      const panic = await execute('desktop.panic', {}, handle => desktop.panic(handle));
      assert.equal(panic.ok, true);
      assert.equal((await desktop.status()).tracked_children, 0);
      if (fixturePid !== null) assert.equal(panic.outcomes.some(outcome => outcome.pid === fixturePid && outcome.status === 'terminated'), true);
    } catch (cleanupError) {
      if (!primaryFailure) throw cleanupError;
      console.error('UIA fixture cleanup failed after primary failure:', cleanupError.message);
    } finally {
      authority.control.close();
      await fs.rm(workspace, { recursive: true, force: true });
    }
  }
});
