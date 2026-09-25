import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { buildWindowsUiaCommand, validateWindowsUiaRequest, windowsUiaAction } from '../../node/src/services/windows-uia.mjs';

const identity = { pid: 41, parentPid: 12, name: 'fixture.exe', executablePath: 'C:\\fixture.exe', createdAtUtc: '2026-09-25T18:00:00.0000000Z' };

test('UIA requests are strict, bounded, semantic, and reject raw text entry', () => {
  assert.deepEqual(validateWindowsUiaRequest({ action: 'discover', pid: 41 }), { action: 'discover', pid: 41 });
  assert.throws(() => validateWindowsUiaRequest({ action: 'set_value', pid: 41, value: 'not a secret' }), /unsupported|fields/i);
  assert.throws(() => validateWindowsUiaRequest({ action: 'invoke', pid: 41, window_handle: 1, automation_id: 'button', verify_automation_id: 'state', expected_state: 'arbitrary visible text' }), /toggle-state/);
  assert.throws(() => validateWindowsUiaRequest({ action: 'invoke', pid: 41, window_handle: 1, automation_id: 'button', verify_automation_id: 'state', expected_state: 'ON', value: 'secret' }), /unsupported|fields/i);
  assert.throws(() => validateWindowsUiaRequest({ action: 'scroll', pid: 41, window_handle: 1, automation_id: 'list', horizontal_percent: -1, vertical_percent: 1000 }), /between -1 and 100/);
});

test('UIA helper binds process identity, sends only bounded payload on stdin, and returns verified result', async () => {
  const request = { action: 'invoke', pid: 41, window_handle: 123, automation_id: 'fixtureButton', verify_automation_id: 'fixtureState', expected_state: 'ON' };
  let invocation;
  const result = await windowsUiaAction(request, identity, async (program, args, options) => {
    invocation = { program, args, options };
    return JSON.stringify({ ok: true, verified: true, action: 'invoke', details: { window_handle: 123, verified_by: 'fixtureState' } });
  });
  assert.equal(result.verified, true);
  assert.equal(invocation.program, 'powershell.exe');
  assert.equal(invocation.options.timeout, 8000);
  assert.deepEqual(JSON.parse(invocation.options.input), request);
  const encoded = invocation.args.at(-1);
  const script = Buffer.from(encoded, 'base64').toString('utf16le');
  assert.match(script, /Assert-TargetIdentity/);
  assert.match(script, /Assert-TargetWindow/);
  assert.match(script, /TogglePattern/);
  assert.doesNotMatch(script, /SendInput|mouse_event|keybd_event/i);
});

test('UIA refuses identity mismatch before the helper can perform input', () => {
  assert.throws(() => buildWindowsUiaCommand({ action: 'discover', pid: 42 }, identity), /does not match/);
});
