import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultLayoutState, decodeLayoutState } from '../../browser/src/desktop/layout.ts';
import { WindowManager } from '../../browser/src/desktop/window-manager.ts';
test('coding starts the existing editor and two distinct terminal window instances', () => {
 const state=createDefaultLayoutState();
 assert.deepEqual(state.windows.map(w=>w.appId), ['editor','terminal','terminal']);
 assert.deepEqual(state.windows.filter(w=>w.appId==='terminal').map(w=>w.instanceId),['terminal','terminal:2']);
 assert.ok(decodeLayoutState(state));
});
test('two windows of one app focus, resize, minimize and close independently', () => {
 const manager=new WindowManager(createDefaultLayoutState('MINIMAL'));
 const first=manager.openNew('terminal'), second=manager.openNew('terminal');
 assert.equal(first,'terminal'); assert.equal(second,'terminal:2');
 manager.setBounds(second,{x:0.4,y:0.3,width:0.5,height:0.4});
 const initial=manager.snapshot().windows.find(w=>w.instanceId===first);
 manager.minimize(second); manager.focus(first);
 assert.deepEqual(manager.snapshot().windows.find(w=>w.instanceId===first).bounds,initial.bounds);
 assert.equal(manager.snapshot().windows.find(w=>w.instanceId===second).minimized,true);
 manager.close(second);
 assert.equal(manager.snapshot().windows.filter(w=>w.appId==='terminal').length,1);
 assert.equal(manager.snapshot().windows.find(w=>w.instanceId===first).instanceId,first);
});
test('singleton openNew focuses its existing window and multi-instance creation is bounded', () => {
 const manager=new WindowManager(createDefaultLayoutState('MINIMAL'));
 assert.equal(manager.openNew('editor'),'editor');
 assert.equal(manager.snapshot().windows.filter(w=>w.appId==='editor').length,1);
 for(let n=0;n<8;n++) assert.ok(manager.openNew('terminal'));
 assert.equal(manager.openNew('terminal'),null);
 assert.equal(manager.open('terminal','editor'),false);
 assert.equal(manager.open('editor','editor:2'),false);
});
test('legacy layouts decode into the same identities without resetting user bounds', () => {
 const state=createDefaultLayoutState('DEBUGGING');
 for(const w of state.windows) delete w.instanceId;
 const parsed=decodeLayoutState(state);
 assert.ok(parsed); assert.equal(parsed.windows[0].instanceId,'editor');
 assert.deepEqual(parsed.windows[0].bounds,state.windows[0].bounds);
});
test('layout rejects duplicate instances, forged singleton instances and privileged saved fields', () => {
 const state=createDefaultLayoutState('MINIMAL'), editor=state.windows[0];
 assert.equal(decodeLayoutState({...state,windows:[editor,{...editor,instanceId:'editor:2'}]}),null);
 assert.equal(decodeLayoutState({...state,windows:[editor,{...editor,zIndex:2}]}),null);
 assert.equal(decodeLayoutState({...state,windows:[{...editor,grant:'run'}]}),null);
});
test('saved multi-window layout preserves instance bounds across restore and ignores invalid geometry', () => {
 const manager=new WindowManager(createDefaultLayoutState());
 manager.setBounds('terminal:2',{x:0.4,y:0.5,width:0.5,height:0.4});
 manager.saveLayout(); manager.setStartupLayout();
 const before=manager.snapshot();
 manager.setBounds('terminal:2',{x:NaN,y:0,width:0.5,height:0.4});
 assert.deepEqual(manager.snapshot(),before);
 manager.close('terminal:2'); manager.restoreStartupLayout();
 assert.deepEqual(manager.snapshot().windows,before.windows);
});
