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

test('first launch opens Editor, two distinct terminals, Laptop and resources as overlapping applications', () => {
  const state = createDefaultLayoutState();
  assert.equal(state.selectedLayout, 'WORKSTATION');
  assert.deepEqual(state.windows.map(window => window.appId), ['editor', 'terminal', 'terminal', 'resources', 'cipher-laptop']);
  assert.ok(state.windows.every(window => window.bounds.x >= 0 && window.bounds.y >= 0));
});

test('corrupt or unavailable persistence fails safely to the workstation without throwing', () => {
  assert.equal(loadLayoutState(null).state.selectedLayout, 'WORKSTATION');
  const corrupt = loadLayoutState(memoryStorage('{broken-json'));
  assert.equal(corrupt.recovered, true);
  assert.equal(corrupt.state.selectedLayout, 'WORKSTATION');
  const invalid = loadLayoutState(memoryStorage(JSON.stringify({ version: 1, selectedLayout: 'CODING', startupLayout: 'CODING', windows: [{ appId: 'not-an-app' }], customWindows: null })));
  assert.equal(invalid.recovered, true);
  assert.equal(invalid.state.windows.length, 5);
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
  assert.equal(manager.snapshot().selectedLayout, 'WORKSTATION');
  assert.deepEqual(manager.snapshot().windows.map(window => window.appId), ['editor', 'terminal', 'terminal', 'resources', 'cipher-laptop']);
});

test('storage write errors are reported as unavailable rather than escaping', () => {
  assert.equal(persistLayoutState({ getItem() { return null; }, setItem() { throw new Error('storage blocked'); } }, createDefaultLayoutState()), false);
});

 test('workstation composition overlaps windows while keeping distinct terminal presentation identities',()=>{
 const state=createDefaultLayoutState();assert.equal(new Set(state.windows.map(w=>w.instanceId)).size,5);
 const editor=state.windows.find(w=>w.appId==='editor').bounds,laptop=state.windows.find(w=>w.appId==='cipher-laptop').bounds;
 assert.ok(editor.x<laptop.x+laptop.width&&laptop.x<editor.x+editor.width&&editor.y<laptop.y+laptop.height&&laptop.y<editor.y+editor.height);
 assert.deepEqual(state.windows.filter(w=>w.appId==='terminal').map(w=>w.instanceId),['terminal','terminal:2']);
});
 test('valid saved Coding and custom geometry survive cutover without silent replacement',()=>{
 const coding=createDefaultLayoutState('CODING');assert.equal(coding.windows.length,3);const loaded=loadLayoutState(memoryStorage(JSON.stringify(coding)));assert.equal(loaded.recovered,false);assert.deepEqual(loaded.state.windows,coding.windows);
 const manager=new WindowManager(coding);manager.setBounds('editor',{x:0.12,y:0.11,width:0.62,height:0.51});manager.saveLayout();manager.setStartupLayout();const saved=manager.snapshot();assert.deepEqual(loadLayoutState(memoryStorage(JSON.stringify(saved))).state,saved);
});
 test('restored windows cannot contain an executable effect, permit or terminal session identity',()=>{
 const valid=createDefaultLayoutState();for(const key of ['command','permit','session_id'])assert.equal(decodeLayoutState({...valid,windows:[{...valid.windows[0],[key]:'NEVER_EXECUTE'}]}),null);
});
 test('Connections is a registered independent application with its own window lifecycle',async()=>{
 const {APP_BY_ID}=await import('../../browser/src/desktop/app-registry.ts');const manifest=APP_BY_ID.get('connections');assert.equal(manifest?.title,'Connections');assert.equal(manifest?.maturity,'AVAILABLE');const manager=new WindowManager(createDefaultLayoutState());assert.equal(manager.open('connections'),true);manager.minimize('connections');assert.equal(manager.snapshot().windows.find(w=>w.appId==='connections').minimized,true);manager.restore('connections');manager.close('connections');assert.equal(manager.snapshot().windows.some(w=>w.appId==='connections'),false);
});
