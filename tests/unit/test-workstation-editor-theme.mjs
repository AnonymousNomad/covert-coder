import assert from 'node:assert/strict';
import test from 'node:test';
import { COVERT_PHOSPHOR, DEFAULT_APPEARANCE, parseTermuxPalette } from '../../browser/src/desktop/theme.ts';
import { editorThemeFor } from '../../browser/src/editor/theme.ts';

test('real editor uses the workstation palette while preserving diagnostic states', () => {
  const theme = editorThemeFor(DEFAULT_APPEARANCE);
  assert.equal(theme.colors['editor.background'], COVERT_PHOSPHOR.desktopBackground);
  assert.equal(theme.colors['editor.foreground'], COVERT_PHOSPHOR.textPrimary);
  assert.equal(theme.colors['editor.selectionBackground'], COVERT_PHOSPHOR.selectionBackground);
  assert.equal(theme.colors['editorError.foreground'], COVERT_PHOSPHOR.stateFailure);
  assert.equal(theme.colors['editorWarning.foreground'], COVERT_PHOSPHOR.stateWarning);
  assert.equal(theme.rules.find(rule => rule.token === 'keyword')?.foreground, COVERT_PHOSPHOR.accentPrimary.slice(1));
});

test('editor appearance honors an explicitly imported palette without modifying its owner', () => {
  const importedTermux = parseTermuxPalette('background=#101112\nforeground=#e0e1e2\ncolor2=#00ff00');
  const snapshot = structuredClone(importedTermux);
  const theme = editorThemeFor({ ...DEFAULT_APPEARANCE, theme: 'TERMUX_IMPORT', importedTermux });
  assert.equal(theme.colors['editor.background'], '#101112');
  assert.equal(theme.colors['editor.foreground'], '#e0e1e2');
  assert.equal(theme.rules.find(rule => rule.token === 'keyword')?.foreground, '00ff00');
  assert.deepEqual(importedTermux, snapshot);
});
