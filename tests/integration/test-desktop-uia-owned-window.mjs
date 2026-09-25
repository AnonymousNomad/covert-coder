import { test } from 'node:test';
import assert from 'node:assert/strict';
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
    let controls = [];
    const candidates = [];
    for (const candidate of windows) {
      const inspected = await action({ op: 'uia_action', target: JSON.stringify({ action: 'inspect', pid: fixturePid, window_handle: candidate.window_handle }) });
      const candidateControls = JSON.parse(inspected.output).details.controls;
      candidates.push({ window_handle: candidate.window_handle, automation_ids: candidateControls.map(control => control.automation_id) });
      if (candidateControls.some(control => control.automation_id === 'fixtureToggleButton') && candidateControls.some(control => control.automation_id === 'fixtureStateCheckbox') && candidateControls.some(control => control.automation_id === 'fixtureScrollViewer')) {
        windowHandle = candidate.window_handle;
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
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({ action: 'inspect', pid: fixturePid, window_handle: 1 }) }),
      { code: 'UIA_WINDOW_OWNER_MISMATCH' },
      'a fabricated or foreign window handle must fail ownership validation'
    );
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({ action: 'invoke', pid: fixturePid, window_handle: windowHandle, automation_id: 'missingFixtureControl', verify_automation_id: 'fixtureStateCheckbox', expected_state: 'ON' }) }),
      { code: 'UIA_CONTROL_NOT_UNIQUE' },
      'a missing semantic control must fail without substituting a coordinate or text target'
    );

    const focused = await action({ op: 'uia_action', target: JSON.stringify({ action: 'focus', pid: fixturePid, window_handle: windowHandle }) });
    assert.equal(focused.assertion.pass, true);
    const scrolled = await action({ op: 'uia_action', target: JSON.stringify({ action: 'scroll', pid: fixturePid, window_handle: windowHandle, automation_id: 'fixtureScrollViewer', horizontal_percent: -1, vertical_percent: 100 }) });
    assert.equal(scrolled.assertion.pass, true);
    assert.match(scrolled.assertion.check, /uia_verified:scroll/);
    const invoked = await action({ op: 'uia_action', target: JSON.stringify({ action: 'invoke', pid: fixturePid, window_handle: windowHandle, automation_id: 'fixtureToggleButton', verify_automation_id: 'fixtureStateCheckbox', expected_state: 'ON' }) });
    assert.equal(invoked.assertion.pass, true);
    assert.match(invoked.assertion.check, /uia_verified:invoke/);
    assert.equal(invoked.assertion.details.verified_by, 'fixtureStateCheckbox');
    assert.equal(invoked.assertion.details.automation_id, 'fixtureToggleButton');
    const stateEvents = (await fs.readFile(path.join(workspace, '.aide', 'cipher-state.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    const invokeReceipt = stateEvents.findLast(event => event.type === 'desktop' && event.op === 'uia_action' && event.decision === 'executed' && event.assertion?.check === 'uia_verified:invoke');
    assert.ok(invokeReceipt, 'successful semantic operation must emit a provenance receipt');
    assert.equal(invokeReceipt.assertion.details.verified_by, 'fixtureStateCheckbox');
    assert.doesNotMatch(JSON.stringify(invokeReceipt), /FAKE-SECRET-NOT-REAL/, 'receipt must not include fake password value');
    assert.ok(records.some(event => event.kind === 'desktop.action' && event.decision === 'execution-succeeded'));
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
