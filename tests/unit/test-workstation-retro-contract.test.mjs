import test from 'node:test';
import assert from 'node:assert/strict';
import { COVERT_PHOSPHOR, DEFAULT_APPEARANCE } from '../../browser/src/desktop/theme.ts';
const luminance = hex => {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
test('fresh workstation uses the accepted phosphor tokens and compact monospace chrome', () => {
  assert.equal(COVERT_PHOSPHOR.desktopBackground, '#060807');
  assert.equal(COVERT_PHOSPHOR.textPrimary, '#96daa1');
  assert.equal(COVERT_PHOSPHOR.accentPrimary, '#86f59b');
  assert.equal(DEFAULT_APPEARANCE.interfaceFont, 'Cascadia Mono');
  assert.equal(DEFAULT_APPEARANCE.density, 'compact');
  assert.equal(DEFAULT_APPEARANCE.glow, 'off');
  assert.equal(DEFAULT_APPEARANCE.scanlines, false);
});
test('normal, secondary and muted text meet 4.5 contrast on each opaque workstation surface', () => {
  for (const bg of ['desktopBackground', 'surfaceBackground', 'surfaceRaised', 'surfaceInset']) {
    for (const fg of ['textPrimary', 'textSecondary', 'textMuted']) {
      const values = [luminance(COVERT_PHOSPHOR[bg]), luminance(COVERT_PHOSPHOR[fg])].sort((a,b) => a-b);
      assert.ok((values[1]+0.05)/(values[0]+0.05) >= 4.5, fg+' on '+bg);
    }
  }
});
