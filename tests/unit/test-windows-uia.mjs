import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildWindowsUiaCommand, validateWindowsUiaRequest, windowsUiaAction } from '../../node/src/services/windows-uia.mjs';

const identity = { pid: 41, parentPid: 12, name: 'fixture.exe', executablePath: 'C:\\fixture.exe', createdAtUtc: '2026-09-25T18:00:00.0000000Z', windowRuntimeId: '1,2,3', windowClassName: 'FixtureWindow' };
const leaseId = '123e4567-e89b-42d3-a456-426614174000';

test('UIA requests are strict, bounded, leased, and reject secret controls/unsupported targeting', () => {
  assert.deepEqual(validateWindowsUiaRequest({ action: 'discover', pid: 41 }), { action: 'discover', pid: 41 });
  assert.throws(() => validateWindowsUiaRequest({ action: 'set_value', pid: 41, value: 'not a secret' }), /unsupported|fields/i);
  assert.throws(() => validateWindowsUiaRequest({ action: 'invoke', pid: 41, window_handle: 1, lease_id: leaseId, automation_id: 'button', verify_automation_id: 'state', expected_state: 'arbitrary visible text' }), /toggle-state/);
  assert.throws(() => validateWindowsUiaRequest({ action: 'invoke', pid: 41, window_handle: 1, lease_id: leaseId, automation_id: 'button', verify_automation_id: 'state', expected_state: 'ON', value: 'secret' }), /unsupported|fields/i);
  assert.throws(() => validateWindowsUiaRequest({ action: 'scroll', pid: 41, window_handle: 1, lease_id: leaseId, automation_id: 'list', horizontal_percent: -1, vertical_percent: 1000 }), /between -1 and 100/);
  assert.throws(() => validateWindowsUiaRequest({ action: 'type_text', pid: 41, window_handle: 1, automation_id: 'input', text: 'literal', expected_value_sha256: 'a'.repeat(64) }), /lease/);
  assert.throws(() => validateWindowsUiaRequest({ action: 'press_key', pid: 41, window_handle: 1, lease_id: leaseId, automation_id: 'input', verify_automation_id: 'status', key: 'F12', expected_value_sha256: 'a'.repeat(64) }), /unsupported/);
});

test('UIA helper binds process identity, sends only bounded payload on stdin, and returns verified result', async () => {
  const request = { action: 'invoke', pid: 41, window_handle: 123, lease_id: leaseId, automation_id: 'fixtureButton', verify_automation_id: 'fixtureState', expected_state: 'ON' };
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-uia-'));
  const helperDirectory = path.join(workspaceRoot, '.aide', 'desktop', 'helpers');
  let invocation;
  try {
    const result = await windowsUiaAction(request, identity, async (program, args, options) => {
      invocation = { program, args, options };
      const helperPath = args[args.indexOf('-File') + 1];
      assert.equal(await fs.stat(helperPath).then(stat => stat.isFile()), true);
      return JSON.stringify({ ok: true, verified: true, action: 'invoke', details: { window_handle: 123, verified_by: 'fixtureState' } });
    }, { workspaceRoot, helperDirectory });
    assert.equal(result.verified, true);
    assert.equal(invocation.program, 'powershell.exe');
    assert.deepEqual(invocation.args.slice(0, 4), ['-NoLogo', '-NoProfile', '-NonInteractive', '-File']);
    assert.ok(invocation.args.join(' ').length < 2000);
    assert.equal(invocation.args.join(' ').includes(identity.executablePath), false);
    assert.equal(invocation.options.timeout, 8000);
    const envelope = JSON.parse(invocation.options.input);
    assert.deepEqual(envelope.request, request);
    assert.deepEqual(envelope.identity, identity);
    const helperPath = invocation.args.at(-1);
    await assert.rejects(fs.stat(helperPath), { code: 'ENOENT' });
    const script = buildWindowsUiaCommand(request, identity);
    assert.match(script, /Assert-TargetIdentity/);
    assert.match(script, /Assert-TargetWindow/);
    assert.match(script, /TogglePattern/);
    assert.match(script, /Assert-LeasedWindow/);
    assert.match(script, /\$envelope\.identity/);
    assert.match(script, /stage=\$stage/);
    assert.match(script, /input_phase=\[string\]\$script:inputPhase/);
    assert.match(script, /function Get-SafeFocusSnapshot/);
    assert.match(script, /AutomationElement\]::FocusedElement/);
    assert.match(script, /focused_native_window_handle=\$focusedWindowHandle/);
    assert.match(script, /TreeWalker\]::RawViewWalker/);
    assert.match(script, /focused_element_within_window=\$focusedElementWithinWindow/);
    assert.match(script, /focused_process_id -eq \[int\]\$expected\.pid/);
    assert.match(script, /nearby_controls=\$nearbyDiagnostics/);
    const clickScript = script.slice(script.indexOf('      click {'), script.indexOf('      screenshot {'));
    assert.doesNotMatch(clickScript, /\$element\.TryGetCurrentPattern\(\[System\.Windows\.Automation\.TogglePattern\]/);
    assert.match(clickScript, /\$verifyElement\.TryGetCurrentPattern\(\[System\.Windows\.Automation\.TogglePattern\]/);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('UIA focus diagnostics identify the failed check without serializing input text', async () => {
  const request = { action: 'replace_text', pid: 41, window_handle: 123, lease_id: leaseId, automation_id: 'fixtureTextInput', text: 'FAKE-SECRET-FOCUS-DIAGNOSTIC', expected_value_sha256: 'a'.repeat(64) };
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-uia-focus-diagnostic-'));
  const diagnostic = {
    exception_type: 'RuntimeException',
    category: 'OperationStopped',
    line: 64,
    input_phase: 'BEFORE_INPUT',
    focus_check: {
      stage: 'BEFORE_INPUT',
      expected_window_handle: 123,
      foreground_window_handle: 456,
      foreground_matches: false,
      control_has_keyboard_focus: true
    }
  };
  try {
    await assert.rejects(
      windowsUiaAction(request, identity, async () => JSON.stringify({ ok: false, verified: false, action: 'replace_text', code: 'UIA_FOCUS_LOST', diagnostic }), {
        workspaceRoot,
        helperDirectory: path.join(workspaceRoot, '.aide', 'desktop', 'helpers')
      }),
      error => {
        assert.equal(error.code, 'UIA_FOCUS_LOST');
        assert.deepEqual(error.diagnostic, diagnostic);
        assert.doesNotMatch(JSON.stringify(error.diagnostic), /FAKE-SECRET-FOCUS-DIAGNOSTIC/);
        return true;
      }
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('UIA refuses identity mismatch before the helper can perform input', () => {
  assert.throws(() => buildWindowsUiaCommand({ action: 'discover', pid: 42 }, identity), /does not match/);
});

test('UIA helper refuses a helper directory outside the authorized workspace', async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-uia-root-'));
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-uia-outside-'));
  const request = { action: 'discover', pid: 41 };
  try {
    await assert.rejects(
      windowsUiaAction(request, identity, async () => { throw new Error('provider must not be called'); }, {
        workspaceRoot,
        helperDirectory: outsideRoot
      }),
      { code: 'UIA_HELPER_ROOT_INVALID' }
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    await fs.rm(outsideRoot, { recursive: true, force: true });
  }
});
