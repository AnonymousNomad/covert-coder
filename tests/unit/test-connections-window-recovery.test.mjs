import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const source = await readFile(new URL('../../browser/src/connections/connections.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.textContent = ''; this.listeners = new Map(); this.dataset = {}; this.classList = { toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  set innerHTML(value) { this.children = []; this.parts = new Map(['connections-consensus', 'connections-list', 'connections-pref'].map(id => [id, new Element(id)])); }
  querySelector(selector) { return this.parts.get(selector.slice(1)); }
  replaceChildren() { this.children = []; this.parts = new Map(); }
}
const tick = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const view = { consensus: 'OWNER OBSERVATION', preference: 'local-only', connections: [], routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' } };
function harness(read) {
  const container = new Element('section'), listeners = new Map(), exports = {}; let reads = 0, mutations = 0;
  const document = { createElement: tag => new Element(tag), addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } };
  const api = new Proxy({ connections: () => { reads++; return read(); } }, { get(target, key) { if (key in target) return target[key]; return () => { mutations++; throw new Error('read lifecycle must not invoke effects'); }; } });
  vm.runInNewContext(script, { exports, document, require: name => {
    if (name === '../services/api.ts') return { api, ApiError: class extends Error {} };
    if (name === '../services/model-access-events.ts') return { announceModelAccessChanged() { throw new Error('read lifecycle must not announce mutations'); } };
    throw new Error('unexpected dependency ' + name);
  } });
  const handle = exports.createConnectionsPanel(container, { onToast() { throw new Error('read lifecycle must not claim effects'); } });
  return { container, handle, listeners, document, createPanel: exports.createConnectionsPanel, get reads() { return reads; }, get mutations() { return mutations; } };
}
test('pairing recovers an initially unavailable retained Connections owner without executing effects', async () => {
  let paired = false;
  const h = harness(async () => { if (!paired) throw new Error('pairing required'); return view; }); await tick();
  assert.equal(h.container.querySelector('#connections-consensus').textContent, 'unavailable');
  assert.ok(h.listeners.has('covert:authority-paired')); paired = true; h.listeners.get('covert:authority-paired')(); await tick();
  assert.equal(h.container.querySelector('#connections-consensus').textContent, view.consensus);
  h.handle.activate(); await tick(); assert.equal(h.reads, 3); assert.equal(h.mutations, 0); h.handle.dispose();
  assert.equal(h.listeners.size, 0);
});
test('Settings parent teardown disposes its nested canonical Connections owner', async () => {
  const h = harness(async () => view); await tick(); h.handle.dispose();
  const settingsSource = await readFile(new URL('../../browser/src/cockpit/SettingsSurface.ts', import.meta.url), 'utf8');
  const settingsScript = ts.transpileModule(settingsSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(settingsScript, { exports, document: h.document, require: name => {
    if (name === '../connections/connections.ts') return { createConnectionsPanel: h.createPanel };
    if (name === '../providers/providers.ts') return { createProvidersPanel() {} };
    if (name === '../byok/byok.ts') return { createByokPanel: () => ({ refresh: async () => {} }) };
    throw new Error('unexpected Settings dependency ' + name);
  } });
  const settings = exports.createSettingsSurface(new Element('section'), {}, { onToast() {} }); await tick();
  assert.ok(h.listeners.has('covert:authority-paired')); const paired = h.listeners.get('covert:authority-paired'), reads = h.reads;
  settings.dispose(); assert.equal(h.listeners.size, 0); paired(); await tick(); assert.equal(h.reads, reads); assert.equal(h.mutations, 0);
});
test('reopening a Connections window retries a transient read failure on the same handle', async () => {
  let fail = true; const h = harness(async () => { if (fail) throw new Error('owner offline'); return view; }); await tick();
  fail = false; h.handle.activate(); await tick(); assert.equal(h.reads, 2);
  assert.equal(h.container.querySelector('#connections-consensus').textContent, view.consensus); assert.equal(h.mutations, 0); h.handle.dispose();
});
test('pairing during a pending failed read queues a fresh read; disposal suppresses late results', async () => {
  let first = true, rejectFirst; const pending = harness(() => { if (first) { first = false; return new Promise((resolve, fail) => { rejectFirst = fail; }); } return Promise.resolve(view); });
  pending.listeners.get('covert:authority-paired')(); rejectFirst(new Error('old unpaired read')); await tick();
  assert.equal(pending.reads, 2); assert.equal(pending.container.querySelector('#connections-consensus').textContent, view.consensus); pending.handle.dispose();
  let resolveLate; const late = harness(() => new Promise(resolve => { resolveLate = resolve; }));
  const consensus = late.container.querySelector('#connections-consensus'); late.handle.dispose(); resolveLate(view); await tick();
  assert.equal(consensus.textContent, ''); assert.equal(late.listeners.size, 0); assert.equal(late.mutations, 0);
});
