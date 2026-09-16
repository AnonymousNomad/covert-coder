// Platform-neutral file-URI construction contract for the language server.
// Pins the POSIX regression (a four-slash URI whose path begins with '//' is
// rejected by the language server during initialize) and keeps the Windows
// drive form valid. Pure string logic; runs identically on every host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toAbsoluteUri, toFileUri } from '../../node/src/services/lsp.ts';

test('LSP file URI construction is canonical for Windows and POSIX forms', () => {
  // Windows drive paths: three slashes, drive preserved, spaces encoded.
  assert.equal(toFileUri('C:\\aid e\\work'), 'file:///C:/aid%20e/work');
  assert.equal(toFileUri('C:\\workspace'), 'file:///C:/workspace');
  // POSIX absolute paths: exactly three slashes (no empty authority component).
  assert.equal(toFileUri('/tmp/aide ws'), 'file:///tmp/aide%20ws');
  assert.equal(toFileUri('/tmp/workspace'), 'file:///tmp/workspace');
  assert.equal(toFileUri('/'), 'file:///');
  assert.ok(!toFileUri('/tmp/workspace').startsWith('file:////'), 'POSIX form must never emit four slashes');
});

test('absolute document URIs stay canonical and relative URIs resolve against the workspace', () => {
  // Absolute document URIs pass through unchanged in both host forms.
  assert.equal(toAbsoluteUri('/tmp/aide ws', 'file:///tmp/aide%20ws/src/main.ts'), 'file:///tmp/aide%20ws/src/main.ts');
  assert.equal(toAbsoluteUri('C:\\aid e\\work', 'file:///C:/aid%20e/work/src/main.ts'), 'file:///C:/aid%20e/work/src/main.ts');
  // Relative document URIs resolve against the (host-appropriate) workspace.
  if (process.platform === 'win32') {
    assert.equal(toAbsoluteUri('C:\\aid e\\work', 'src/main.ts'), 'file:///C:/aid%20e/work/src/main.ts');
  } else {
    assert.equal(toAbsoluteUri('/tmp/aide ws', 'src/main.ts'), 'file:///tmp/aide%20ws/src/main.ts');
  }
});
