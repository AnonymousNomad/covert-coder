import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { TerminalViewBindings } from '../../browser/src/desktop/terminal-view-bindings.ts';

// Executes the production controller with controlled DOM, xterm and service ports.
// This proves browser lifecycle/dispatch only; it is not native PTY or Authority acceptance.
const source = await readFile(new URL('../../browser/src/panels/terminal.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
class Element {
  constructor(tag = 'div', className = '', text = '') { this.tagName = tag; this.className = className; this.textContent = text; this.children = []; this.listeners = new Map(); this.dataset = {}; this.clientWidth = 700; this.clientHeight = 240; this.isConnected = true; this.disabled = false; this.classList = { add() {}, remove() {}, toggle() {} }; }
  set innerHTML(_value) { this.children = []; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  prepend(child) { this.children.unshift(child); }
  setAttribute() {}
  add(child) { this.children.push(child); }
  remove() {}
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { if (!this.disabled) this.listeners.get('click')?.({}); }
  querySelector(selector) { return find(this, element => selector.startsWith('.') && element.className.split(' ').includes(selector.slice(1))); }
}
function find(root, predicate) { for (const child of (root.children ?? [])) { if (predicate(child)) return child; const nested = find(child, predicate); if (nested) return nested; } return null; }
const tick = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function harness() {
  const frames = new Map(); const terminals = []; const sent = []; const subscriptions = new Set(); const observers = [];
  let nextFrame = 1; let fits = 0; let openCalls = 0; let resumeCalls = 0;
  const opening = deferred(), resuming = deferred();
  const sessions = ['session:a', 'session:b'].map(sessionId => ({ sessionId, state: 'running', provider: 'native', shell: 'pwsh', owner: 'operator', createdAt: 1, exitCode: null, cleanup: 'clean' }));
  const api = {
    terminalProviders: async () => ({ providers: [{ id: 'native', label: 'Native PTY', state: 'available', detail: 'fixture', shells: [{ id: 'pwsh', label: 'PowerShell' }] }] }),
    tasksStatus: async () => ({ jobs: [] }), terminalSessions: async () => ({ sessions }),
    terminalSessionOpen: () => { openCalls++; return opening.promise; },
    terminalSessionResume: () => { resumeCalls++; return resuming.promise; },
    terminalSessionStop: () => { throw new Error('unexpected process termination'); }
  };
  class Terminal {
    constructor(options) { this.options = options; this.cols = 90; this.rows = 20; this.output = ''; terminals.push(this); }
    loadAddon() {} open(host) { this.host = host; } onData(listener) { this.input = listener; } focus() {}
    write(data) { this.output += data; } dispose() { this.disposed = true; }
  }
  const document = { createElement: tag => new Element(tag), addEventListener() {}, removeEventListener() {} };
  const window = { addEventListener() {}, removeEventListener() {}, setInterval: () => 1, clearInterval() {}, requestAnimationFrame: callback => { const id = nextFrame++; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id) };
  const ports = {
    '@xterm/xterm': { Terminal }, '@xterm/addon-fit': { FitAddon: class { fit() { fits++; } } },
    '@xterm/xterm/css/xterm.css': {}, '../services/api.ts': { api },
    '../services/ws.ts': { getSharedEvents: () => ({ send: message => sent.push(message), subscribe: (_channel, listener) => { subscriptions.add(listener); return () => subscriptions.delete(listener); } }) },
    '../../../common/contracts/terminal.ts': { TerminalEvent: { safeParse: data => ({ success: true, data }) } },
    '../desktop/theme.ts': { DEFAULT_APPEARANCE: { terminalFont: 'Cascadia Mono' }, terminalThemeFor: () => ({}) }
  };
  const exports = {};
  vm.runInNewContext(script, { exports, require: name => { assert.ok(Object.hasOwn(ports, name), `unexpected runtime import ${name}`); return ports[name]; }, document, window, Option: class { constructor(label, value) { this.label = label; this.value = value; } }, ResizeObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } } });
  const bindings = new TerminalViewBindings();
  return {
    create(viewId) { const root = new Element(); const handle = exports.createTerminalPanel(root, {}, undefined, { viewId, bindings }); return { root, handle }; },
    bindings, terminals, sent, opening, resuming, sessions, observers,
    get openCalls() { return openCalls; }, get resumeCalls() { return resumeCalls; }, get fits() { return fits; },
    event(data) { for (const listener of subscriptions) listener(data); },
    flushFrames() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); }
  };
}
test('reattach cannot transmit input or resize before confirmation; separate windows reject duplicate binding and filter output', async () => {
  const h = harness(); const first = h.create('terminal'); const second = h.create('terminal:2'); await tick();
  find(first.root, e => e.className.includes('terminal-resume-btn')).click();
  find(second.root, e => e.className.includes('terminal-resume-btn')).click();
  assert.equal(h.resumeCalls, 1);
  h.terminals[0].input('before approval'); h.flushFrames();
  assert.deepEqual(h.sent, []);
  h.resuming.resolve({ session: h.sessions[0] }); await tick();
  h.terminals[0].input('owned input');
  assert.equal(h.sent.at(-1).sessionId, 'session:a');
  assert.equal(h.sent.at(-1).action, 'input');
  h.event({ kind: 'output', sessionId: 'session:b', data: 'foreign' });
  h.event({ kind: 'output', sessionId: 'session:a', data: 'owned' });
  assert.equal(h.terminals[0].output, 'owned');
  const before = h.fits; h.observers[0].callback(); h.flushFrames();
  assert.ok(h.fits > before); assert.equal(h.sent.at(-1).action, 'resize');
  first.handle.dispose(); second.handle.dispose();
});
test('disposal during Authority reattach cancels view work; late confirmation cannot restore input or resize', async () => {
  const h = harness(); const view = h.create('terminal'); await tick();
  find(view.root, e => e.className.includes('terminal-resume-btn')).click();
  view.handle.dispose(); h.resuming.resolve({ session: h.sessions[0] }); await tick();
  h.terminals[0].input('late input'); h.flushFrames();
  assert.deepEqual(h.sent, []); assert.equal(view.root.children.length, 0);
  assert.equal(h.bindings.availableTo('terminal:2', 'session:a'), true);
  assert.equal(h.observers[0].disconnected, true);
});
test('session-open is serialized and disposal retains canonical recovery ownership without manufacturing a live view', async () => {
  const h = harness(); const view = h.create('terminal'); await tick();
  const open = find(view.root, e => e.className === 'terminal-open-btn'); open.click(); open.click();
  assert.equal(h.openCalls, 1);
  view.handle.dispose(); h.opening.resolve({ session: h.sessions[0] }); await tick();
  assert.equal(h.terminals.length, 0); assert.equal(view.root.children.length, 0);
  assert.equal(h.bindings.availableTo('terminal:2', 'session:a'), true);
});

test('mismatched reattach response never authorizes stdin or leaves a claimed display', async () => {
  const h = harness(); const view = h.create('terminal'); await tick();
  find(view.root, e => e.className.includes('terminal-resume-btn')).click();
  const terminal = h.terminals[0];
  h.resuming.resolve({ session: h.sessions[1] }); await tick();
  terminal.input('rejected identity input'); h.flushFrames();
  assert.deepEqual(h.sent, []);
  assert.equal(h.bindings.availableTo('terminal:2', 'session:a'), true);
  assert.equal(terminal.disposed, true);
  view.handle.dispose();
});
