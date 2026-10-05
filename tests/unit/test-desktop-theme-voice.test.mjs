import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COVERT_PHOSPHOR,
  DEFAULT_APPEARANCE,
  parseTermuxPalette,
  terminalThemeFor
} from '../../browser/src/desktop/theme.ts';
import {
  DEFAULT_CIPHER_PREFERENCES,
  createUnavailableSpeechInput,
  createUnavailableWakeWordEngine,
  readinessGreeting
} from '../../browser/src/desktop/cipher-voice.ts';

test('Termux palette import maps only supported local six-digit color values', () => {
  const imported = parseTermuxPalette([
    'background=#101112',
    'foreground=#e0e1e2',
    'cursor=#43d3a2',
    'color0=#000000',
    'color2=#00ff00',
    'color15=#ffffff',
    'unknown=#ff00ff'
  ].join('\n'));

  assert.equal(imported.terminalBackground, '#101112');
  assert.equal(imported.terminalForeground, '#e0e1e2');
  assert.equal(imported.cursor, '#43d3a2');
  assert.equal(imported.terminalColors[0], '#000000');
  assert.equal(imported.terminalColors[15], '#ffffff');
  assert.equal(imported.terminalColors.length, 16);
  assert.equal(imported.accentPrimary, '#00ff00');
});

test('Termux palette import rejects oversized files and retains semantic terminal roles', () => {
  assert.throws(() => parseTermuxPalette('x'.repeat(64 * 1024 + 1)), /64 KiB/);
  const theme = terminalThemeFor(DEFAULT_APPEARANCE);
  assert.equal(theme.background, COVERT_PHOSPHOR.terminalBackground);
  assert.equal(theme.green, COVERT_PHOSPHOR.terminalColors[2]);
  assert.equal(theme.brightWhite, COVERT_PHOSPHOR.terminalColors[15]);
});

test('Cipher microphone and wake-word remain off or unavailable by default', async () => {
  assert.equal(DEFAULT_CIPHER_PREFERENCES.wakeWordEnabled, false);
  assert.equal(DEFAULT_CIPHER_PREFERENCES.voiceResponses, false);
  assert.equal(DEFAULT_CIPHER_PREFERENCES.continuousListening, false);
  const input = createUnavailableSpeechInput();
  const wake = createUnavailableWakeWordEngine();
  assert.equal(input.state, 'unavailable');
  assert.equal(wake.state, 'unavailable');
  await assert.rejects(input.start(), /microphone remains off/);
  await assert.rejects(wake.start(), /not integrated/);
});

test('readiness speech is derived from the canonical readiness boolean', () => {
  assert.match(readinessGreeting({ ready: true }), /readiness reports ready/);
  assert.match(readinessGreeting({ ready: false }), /incomplete or some capabilities need attention/);
});
