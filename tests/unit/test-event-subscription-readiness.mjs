import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../../browser/src/services/ws.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function harness() {
 const sockets = [], timers = [];
 class Socket {
  static OPEN = 1;
  readyState = 1;
  listeners = new Map();
  constructor() { sockets.push(this); }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  send() {}
  close() { this.listeners.get('close')?.(); }
  message(raw) { this.listeners.get('message')?.({ data: JSON.stringify(raw) }); }
 }
 const exports = {};
 vm.runInNewContext(script, {
  exports, WebSocket: Socket,
  setTimeout: callback => { timers.push(callback); return timers.length; }, clearTimeout() {},
  require: name => {
   if (name.endsWith('/events.ts')) return { EventEnvelope: { safeParse: () => ({ success: false }) } };
   if (name === './authority.ts') return { authenticateEventSocket() {} };
   throw new Error('Unexpected import ' + name);
  }
 });
 return { bus: exports.connectEvents('ws://fixture'), sockets, reconnect: () => timers.shift()?.() };
}
test('a redundant channel acknowledgement cannot retrigger terminal recovery; reconnect can', () => {
 const h = harness(); let terminal = 0, project = 0;
 h.bus.subscribe('terminal', () => {});
 h.bus.onSubscribed('terminal', () => terminal++);
 h.sockets[0].message({ type: 'subscribed', channels: ['terminal'] });
 assert.equal(terminal, 0, 'an unauthenticated acknowledgement grants no readiness');
 h.sockets[0].message({ type: 'authenticated' });
 h.sockets[0].message({ type: 'subscribed', channels: ['terminal', 'unrequested'] });
 assert.equal(terminal, 1);
 h.bus.subscribe('project', () => {});
 h.bus.onSubscribed('project', () => project++);
 h.sockets[0].message({ type: 'subscribed', channels: ['terminal', 'project'] });
 assert.equal(terminal, 1, 'new application subscription must not reset an acknowledged terminal');
 assert.equal(project, 1);
 h.sockets[0].close(); h.reconnect();
 h.sockets[1].message({ type: 'authenticated' });
 h.sockets[1].message({ type: 'subscribed', channels: ['terminal', 'project'] });
 assert.equal(terminal, 2, 'a fresh authenticated connection must recover the terminal');
 assert.equal(project, 2);
 h.bus.dispose();
 assert.equal(h.bus.connected(), false, 'disposed bus is not connected');
 h.sockets[1].message({ type: 'subscribed', channels: ['terminal'] });
 assert.equal(terminal, 2, 'disposed subscription cannot recover a terminal');
});
test('removing the final channel handler invalidates its acknowledged readiness', () => {
 const h = harness(); let acknowledged = 0;
 const remove = h.bus.subscribe('terminal', () => {});
 h.bus.onSubscribed('terminal', () => acknowledged++);
 h.sockets[0].message({ type: 'authenticated' });
 h.sockets[0].message({ type: 'subscribed', channels: ['terminal'] });
 remove();
 h.bus.subscribe('terminal', () => {});
 h.sockets[0].message({ type: 'subscribed', channels: ['terminal'] });
 assert.equal(acknowledged, 2);
 h.bus.dispose();
});
test('stale socket callbacks cannot authenticate, acknowledge or disconnect a new socket', () => {
 const h = harness(); let acknowledgements = 0;
 h.bus.subscribe('terminal', () => {});
 h.bus.onSubscribed('terminal', () => acknowledgements++);
 h.sockets[0].message({ type: 'authenticated' });
 h.sockets[0].message({ type: 'subscribed', channels: ['terminal'] });
 h.sockets[0].close(); h.reconnect();
 h.sockets[0].message({ type: 'authenticated' });
 assert.equal(h.bus.connected(), false, 'retired socket cannot authenticate its successor');
 h.sockets[1].message({ type: 'authenticated' });
 h.sockets[0].message({ type: 'subscribed', channels: ['terminal'] });
 assert.equal(h.bus.subscribed('terminal'), false, 'retired socket cannot acknowledge successor subscriptions');
 h.sockets[1].message({ type: 'subscribed', channels: ['terminal'] });
 assert.equal(acknowledgements, 2);
 h.sockets[0].close();
 assert.equal(h.bus.connected(), true, 'retired close cannot disconnect the current socket');
 h.bus.dispose();
});
