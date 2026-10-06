import test from 'node:test';
import assert from 'node:assert/strict';
import { TerminalViewBindings } from '../../browser/src/desktop/terminal-view-bindings.ts';
test('independent views claim distinct service sessions and cannot duplicate another live binding', () => {
 const bindings=new TerminalViewBindings();
 assert.equal(bindings.claim('terminal','session:a'),true);
 assert.equal(bindings.claim('terminal:2','session:b'),true);
 assert.equal(bindings.claim('terminal:2','session:a'),false);
 assert.equal(bindings.availableTo('terminal:2','session:a'),false);
 assert.equal(bindings.availableTo('terminal','session:a'),true);
});
test('wrong-window release cannot free another binding and one view cannot silently retarget', () => {
 const bindings=new TerminalViewBindings();
 bindings.claim('terminal','session:a');
 assert.equal(bindings.claim('terminal','session:b'),false);
 bindings.release('terminal:2','session:a');
 assert.equal(bindings.availableTo('terminal:2','session:a'),false);
 bindings.release('terminal','session:a');
 assert.equal(bindings.claim('terminal:2','session:a'),true);
});
test('presentation bindings cannot grant, start, resume, persist or stop canonical sessions', () => {
 const bindings=new TerminalViewBindings();
 for(const method of ['grant','start','resume','stop','persist']) assert.equal(typeof bindings[method],'undefined');
 assert.equal(bindings.claim('','session:a'),false);
 assert.equal(bindings.claim('terminal',''),false);
});
