import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDesktopControl } from '../../node/src/services/desktop-control.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { readWindowsProcessIdentity } from '../../node/src/services/windows-process-identity.mjs';

test('UIA classifies fixture modals, bounds approved safe interaction, and refuses foreign, unknown, or denied destructive actions', {
  skip: process.platform !== 'win32', timeout: 180000
}, async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-desktop-uia-modals-'));
  const records = [];
  const authority = createExecutionAuthority({ workspace, record: async event => { records.push(event); return { persisted: true }; } });
  const origin = 'http://uia-modal-fixture.local';
  const paired = await authority.pair(authority.control.createPairing(origin), origin);
  const actor = authority.authenticate(paired.token, origin);
  let desktop = createDesktopControl({ workspace, authority });
  const sessionId = `uia-modal-${process.pid}-${Date.now()}`;
  const fixture = path.resolve('tests/fixtures/desktop-uia-modal-fixture.ps1');
  const grants = { enabled: true, grants: { apps: ['powershell.exe'], roots: [workspace], window_titles: [] }, ttl_minutes: 5 };
  const fixturePids = [];
  const cleanupOutcomes = new Map();
  const valueHash = value => createHash('sha256').update(value, 'utf8').digest('hex');
  let task = 0;
  let primaryFailure = null;

  async function execute(kind, body, callback) {
    const input = { workspace, taskId: `desktop-uia-modal-${++task}`, kind, args: { body } };
    const operation = await authority.prepare(actor, input);
    await authority.decide(actor, operation.operation_id, 'approve');
    return authority.execute(actor, operation.operation_id, input, (_descriptor, handle) => callback(handle));
  }

  async function action(body) {
    const request = { ...body, approved: true };
    return execute('desktop.action', request, handle => desktop.act(request, handle, sessionId));
  }

  async function launchFixture(kind) {
    const result = await action({
      op: 'launch_app', target: 'powershell.exe',
      args: ['-NoProfile', '-STA', '-File', fixture, '-Kind', kind], show_window: true
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

  async function waitForWindow(pid, automationId, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const windows = await discover(pid);
      const found = windows.find(row => row.automation_id === automationId);
      if (found) return { windows, found };
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    assert.fail(`owned fixture window ${automationId} was not discovered for PID ${pid}`);
  }

  async function inspect(pid, window) {
    const result = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'inspect', pid, window_handle: window.window_handle, lease_id: window.lease_id
    }) });
    assert.equal(result.assertion.pass, true);
    return JSON.parse(result.output).details.controls;
  }

  async function resetOwnedFixtures() {
    const panic = await execute('desktop.panic', {}, handle => desktop.panic(handle));
    assert.equal(panic.ok, true);
    for (const outcome of panic.outcomes) cleanupOutcomes.set(outcome.pid, outcome);
    for (const pid of fixturePids) {
      assert.equal(await readWindowsProcessIdentity(pid), null, `exact modal fixture PID ${pid} is absent after panic`);
      if (!cleanupOutcomes.has(pid)) cleanupOutcomes.set(pid, { pid, status: 'exited' });
    }
    desktop = createDesktopControl({ workspace, authority });
    await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));
  }

  try {
    await execute('desktop.grants', grants, handle => desktop.setGrants(grants, handle));

    const safePid = await launchFixture('SAFE');
    const { found: safeModal } = await waitForWindow(safePid, 'covertExpectedSafeModal');
    const safeControls = await inspect(safePid, safeModal);
    assert.equal(safeControls.some(control => control.automation_id === 'expectedSafeActionButton' && control.control_type === 'ControlType.Button'), true);
    assert.equal(safeControls.some(control => control.automation_id === 'expectedSafeToggle' && control.control_type === 'ControlType.Button'), true);
    const safeInteraction = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'invoke', pid: safePid, window_handle: safeModal.window_handle, lease_id: safeModal.lease_id,
      automation_id: 'expectedSafeActionButton', verify_automation_id: 'expectedSafeToggle', expected_state: 'ON'
    }) });
    assert.equal(safeInteraction.assertion.pass, true);
    assert.equal(safeInteraction.receipt.result, 'SUCCESS');
    const safeInteractionDetails = JSON.parse(safeInteraction.output).details;
    assert.equal(safeInteractionDetails.automation_id, 'expectedSafeActionButton');
    assert.equal(safeInteractionDetails.verified_by, 'expectedSafeToggle');
    console.log('EXPECTED_OWNED_MODAL=PASS');

    await resetOwnedFixtures();
    const unexpectedPid = await launchFixture('UNEXPECTED');
    const { found: unexpectedModal } = await waitForWindow(unexpectedPid, 'covertUnexpectedOwnedModal');
    const unexpectedControls = await inspect(unexpectedPid, unexpectedModal);
    assert.equal(unexpectedControls.some(control => control.automation_id === 'unexpectedOwnedToggle'), true);
    const unexpectedClass = ['covertExpectedSafeModal'].includes(unexpectedModal.automation_id)
      ? 'EXPECTED_SAFE_OWNED_MODAL' : 'UNEXPECTED_OWNED_MODAL';
    assert.equal(unexpectedClass, 'UNEXPECTED_OWNED_MODAL');
    console.log('UNEXPECTED_OWNED_MODAL=INSPECTED_AND_CLASSIFIED');

    await resetOwnedFixtures();
    const unknownPid = await launchFixture('UNKNOWN');
    const { found: unknownModal } = await waitForWindow(unknownPid, 'covertUnknownModal');
    const unknownControls = await inspect(unknownPid, unknownModal);
    assert.equal(unknownControls.some(control => control.automation_id === 'unknownModalToggle'), true);
    assert.equal(['covertExpectedSafeModal', 'covertUnexpectedOwnedModal', 'covertDestructiveLikeModal'].includes(unknownModal.automation_id), false);
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({
        action: 'click', pid: unknownPid, window_handle: unknownModal.window_handle, lease_id: unknownModal.lease_id,
        automation_id: 'unlistedModalControl', verify_automation_id: 'unlistedModalControl', expected_state: 'ON'
      }) }),
      error => error.code === 'UIA_CONTROL_NOT_UNIQUE' && error.desktopReceipt?.result === 'FAILURE',
      'unknown modal controls without a verified semantic target fail closed'
    );
    console.log('UNKNOWN_MODAL=FAIL_CLOSED');

    await resetOwnedFixtures();
    const targetPid = await launchFixture('NONE');
    const { found: targetWindow } = await waitForWindow(targetPid, 'covertModalFixtureOwner');
    const foreignPid = await launchFixture('FOREIGN');
    const { found: foreignModal } = await waitForWindow(foreignPid, 'covertForeignModal');
    const foreignControls = await inspect(foreignPid, foreignModal);
    assert.equal(foreignControls.some(control => control.automation_id === 'foreignModalToggle'), true);
    const foreignFocus = await action({ op: 'uia_action', target: JSON.stringify({
      action: 'focus', pid: foreignPid, window_handle: foreignModal.window_handle, lease_id: foreignModal.lease_id
    }) });
    assert.equal(foreignFocus.assertion.pass, true);
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({
        action: 'type_text', pid: targetPid, window_handle: targetWindow.window_handle, lease_id: targetWindow.lease_id,
        automation_id: 'modalFixtureInput', text: 'COVERT_FOREIGN_MODAL_MUST_NOT_RECEIVE',
        expected_value_sha256: valueHash('COVERT_FOREIGN_MODAL_MUST_NOT_RECEIVE')
      }) }),
      error => {
        assert.equal(error.code, 'UIA_FOCUS_LOST');
        assert.equal(error.desktopReceipt?.result, 'FAILURE');
        assert.equal(error.diagnostic?.input_phase, 'SET_FOCUS');
        assert.equal(error.diagnostic?.focus_check?.stage, 'SET_FOCUS');
        assert.equal(error.diagnostic?.focus_check?.foreground_matches, false);
        assert.equal(error.diagnostic?.focus_check?.expected_window_handle, targetWindow.window_handle);
        assert.equal(error.diagnostic?.focus_check?.foreground_window_handle, foreignModal.window_handle);
        assert.doesNotMatch(JSON.stringify(error.desktopReceipt), /COVERT_FOREIGN_MODAL_MUST_NOT_RECEIVE/);
        return true;
      },
      'foreign modal focus refuses target input before dispatch'
    );
    await assert.rejects(
      () => action({ op: 'uia_action', target: JSON.stringify({
        action: 'type_text', pid: targetPid, window_handle: targetWindow.window_handle, lease_id: targetWindow.lease_id,
        automation_id: 'modalFixtureInput', text: 'COVERT_FOREIGN_MODAL_MUST_NOT_RECEIVE',
        expected_value_sha256: valueHash('COVERT_FOREIGN_MODAL_MUST_NOT_RECEIVE')
      }) }),
      { code: 'UIA_LEASE_INVALID' },
      'target lease is stale after a foreign modal takes focus'
    );
    const { found: reacquiredTargetWindow } = await waitForWindow(targetPid, 'covertModalFixtureOwner');
    assert.notEqual(reacquiredTargetWindow.lease_id, targetWindow.lease_id);
    const targetInvoke = { op: 'uia_action', target: JSON.stringify({
      action: 'invoke', pid: targetPid, window_handle: reacquiredTargetWindow.window_handle, lease_id: reacquiredTargetWindow.lease_id,
      automation_id: 'modalFixtureSafeAction', verify_automation_id: 'modalFixtureActionState', expected_state: 'ON'
    }) };
    await assert.rejects(
      () => action(targetInvoke),
      error => {
        assert.equal(error.code, 'UIA_FOCUS_LOST');
        assert.equal(error.desktopReceipt?.result, 'FAILURE');
        assert.equal(error.diagnostic?.input_phase, 'BEFORE_INVOKE');
        assert.equal(error.diagnostic?.focus_check?.stage, 'BEFORE_INVOKE');
        assert.equal(error.diagnostic?.focus_check?.foreground_matches, false);
        assert.equal(error.diagnostic?.focus_check?.expected_window_handle, targetWindow.window_handle);
        assert.equal(error.diagnostic?.focus_check?.foreground_window_handle, foreignModal.window_handle);
        return true;
      },
      'foreign modal focus refuses semantic invocation into a different owned window'
    );
    await assert.rejects(
      () => action(targetInvoke),
      { code: 'UIA_LEASE_INVALID' },
      'target lease is stale after semantic invocation is refused'
    );
    console.log('FOREIGN_MODAL=REFUSED_KEYBOARD_AND_SEMANTIC_ACTION_AND_LEASE_INVALIDATED');

    await resetOwnedFixtures();
    const destructivePid = await launchFixture('DESTRUCTIVE');
    const { found: destructiveModal } = await waitForWindow(destructivePid, 'covertDestructiveLikeModal');
    const destructiveControls = await inspect(destructivePid, destructiveModal);
    assert.equal(destructiveControls.some(control => control.automation_id === 'destructiveDeleteToggle'), true);
    const destructiveRequest = { op: 'uia_action', target: JSON.stringify({
      action: 'click', pid: destructivePid, window_handle: destructiveModal.window_handle, lease_id: destructiveModal.lease_id,
      automation_id: 'destructiveDeleteToggle', verify_automation_id: 'destructiveDeleteToggle', expected_state: 'ON'
    }), approved: true };
    const rejectedOperation = await authority.prepare(actor, {
      workspace, taskId: `desktop-uia-modal-${++task}`, kind: 'desktop.action', args: { body: destructiveRequest }
    });
    await authority.decide(actor, rejectedOperation.operation_id, 'reject');
    let destructiveCallbackRan = false;
    await assert.rejects(
      () => authority.execute(actor, rejectedOperation.operation_id, {
        workspace, taskId: `desktop-uia-modal-${task}`, kind: 'desktop.action', args: { body: destructiveRequest }
      }, () => { destructiveCallbackRan = true; }),
      error => error.code === 'CONFLICT',
      'destructive-like modal action requires explicit Authority approval'
    );
    assert.equal(destructiveCallbackRan, false, 'Authority rejection prevents UIA dispatch');
    assert.equal(records.some(record => record.operation_id === rejectedOperation.operation_id && record.decision === 'reject'), true);
    console.log('DESTRUCTIVE_LIKE_MODAL=AUTHORITY_REQUIRED');
  } catch (error) {
    primaryFailure = error;
    const location = String(error?.stack ?? '').split('\n').find(line => line.includes('test-desktop-uia-modals.mjs'))?.trim() ?? null;
    console.error(`MODAL_PRIMARY_FAILURE=${JSON.stringify({ name: error?.name, code: error?.code, location })}`);
    throw error;
  } finally {
    let cleanupFailure = null;
    try {
      const panic = await execute('desktop.panic', {}, handle => desktop.panic(handle));
      assert.equal(panic.ok, true);
      for (const outcome of panic.outcomes) cleanupOutcomes.set(outcome.pid, outcome);
      assert.equal((await desktop.status()).tracked_children, 0);
      for (const pid of fixturePids) {
        const remaining = await readWindowsProcessIdentity(pid);
        if (remaining === null && !['terminated', 'exited'].includes(cleanupOutcomes.get(pid)?.status)) {
          cleanupOutcomes.set(pid, { pid, status: 'exited' });
        }
        assert.ok(['terminated', 'exited'].includes(cleanupOutcomes.get(pid)?.status), `modal fixture PID ${pid} was terminated or exited`);
        assert.equal(remaining, null, `modal fixture PID ${pid} is absent after cleanup`);
      }
    } catch (error) {
      cleanupFailure = error;
    }
    try {
      authority.control.close();
      await fs.rm(workspace, { recursive: true, force: true });
    } catch (error) {
      cleanupFailure ??= error;
    }
    if (cleanupFailure) {
      const location = String(cleanupFailure?.stack ?? '').split('\n').find(line => line.includes('test-desktop-uia-modals.mjs'))?.trim() ?? null;
      if (primaryFailure) console.error(`MODAL_CLEANUP_FAILURE=${JSON.stringify({ name: cleanupFailure?.name, code: cleanupFailure?.code, location })}`);
      else throw cleanupFailure;
    }
  }
});
