import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultLayoutState, decodeLayoutState, loadLayoutState, persistLayoutState } from '../../browser/src/desktop/layout.ts';
import { WindowManager } from '../../browser/src/desktop/window-manager.ts';

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem() { return value; },
    setItem(_key, next) { value = next; },
    read() { return value; }
  };
}

test('first launch opens the shared coding workstation with Workspace, Cipher, and Terminal', () => {
  const state = createDefaultLayoutState();
  assert.equal(state.selectedLayout, 'CODING');
  assert.deepEqual(state.windows.map(window => window.appId), ['editor', 'resident', 'terminal']);
  assert.ok(state.windows.every(window => window.bounds.x >= 0 && window.bounds.y >= 0));
});

test('corrupt or unavailable persistence fails safely to Coding without throwing', () => {
  assert.equal(loadLayoutState(null).state.selectedLayout, 'CODING');
  const corrupt = loadLayoutState(memoryStorage('{broken-json'));
  assert.equal(corrupt.recovered, true);
  assert.equal(corrupt.state.selectedLayout, 'CODING');
  const invalid = loadLayoutState(memoryStorage(JSON.stringify({ version: 1, selectedLayout: 'CODING', startupLayout: 'CODING', windows: [{ appId: 'not-an-app' }], customWindows: null })));
  assert.equal(invalid.recovered, true);
  assert.equal(invalid.state.windows.length, 3);
});

test('layout codec rejects invalid bounds and duplicate singleton windows', () => {
  const valid = createDefaultLayoutState();
  assert.ok(decodeLayoutState(valid));
  assert.equal(decodeLayoutState({ ...valid, windows: [{ ...valid.windows[0], bounds: { x: 0.8, y: 0.8, width: 0.5, height: 0.5 } }] }), null);
  assert.equal(decodeLayoutState({ ...valid, windows: [valid.windows[0], { ...valid.windows[0], zIndex: 3 }] }), null);
});

test('window actions preserve singleton identity, clamps, focus, and snap/maximize recovery', () => {
  const storage = memoryStorage();
  const manager = new WindowManager(createDefaultLayoutState(), storage);
  const beforeZ = manager.snapshot().windows.find(window => window.appId === 'editor').zIndex;
  assert.equal(manager.open('editor'), true);
  assert.equal(manager.snapshot().windows.filter(window => window.appId === 'editor').length, 1);
  assert.ok(manager.snapshot().windows.find(window => window.appId === 'editor').zIndex > beforeZ);
  assert.equal(manager.open('extensions'), false);

  manager.setBounds('editor', { x: 0.9, y: 0.95, width: 0.4, height: 0.4 });
  assert.deepEqual(manager.snapshot().windows.find(window => window.appId === 'editor').bounds, { x: 0.6, y: 0.6, width: 0.4, height: 0.4 });
  manager.snap('editor', 'top-right');
  assert.deepEqual(manager.snapshot().windows.find(window => window.appId === 'editor').bounds, { x: 0.5, y: 0, width: 0.5, height: 0.5 });
  manager.toggleMaximize('editor');
  assert.deepEqual(manager.snapshot().windows.find(window => window.appId === 'editor').bounds, { x: 0, y: 0, width: 1, height: 1 });
  manager.toggleMaximize('editor');
  const restored = manager.snapshot().windows.find(window => window.appId === 'editor');
  assert.deepEqual(restored.bounds, { x: 0.5, y: 0, width: 0.5, height: 0.5 });
  assert.equal(restored.snap, 'none');
  manager.minimize('editor');
  assert.equal(manager.snapshot().windows.find(window => window.appId === 'editor').minimized, true);
  manager.restore('editor');
  assert.equal(manager.snapshot().windows.find(window => window.appId === 'editor').minimized, false);
  assert.equal(JSON.parse(storage.read()).version, 1);
});

test('named layouts, custom save, startup restore, and reset remain separate from app state', () => {
  const manager = new WindowManager(createDefaultLayoutState());
  manager.selectLayout('DEBUGGING');
  assert.deepEqual(manager.snapshot().windows.map(window => window.appId), ['editor', 'terminal', 'verification']);
  manager.setBounds('editor', { x: 0.12, y: 0.18, width: 0.42, height: 0.62 });
  manager.saveLayout();
  manager.setStartupLayout();
  manager.close('terminal');
  manager.restoreStartupLayout();
  assert.equal(manager.snapshot().selectedLayout, 'CUSTOM');
  assert.equal(manager.snapshot().windows.some(window => window.appId === 'terminal'), true);
  manager.resetLayout();
  assert.equal(manager.snapshot().selectedLayout, 'CODING');
  assert.deepEqual(manager.snapshot().windows.map(window => window.appId), ['editor', 'resident', 'terminal']);
});

test('storage write errors are reported as unavailable rather than escaping', () => {
  assert.equal(persistLayoutState({ getItem() { return null; }, setItem() { throw new Error('storage blocked'); } }, createDefaultLayoutState()), false);
});
