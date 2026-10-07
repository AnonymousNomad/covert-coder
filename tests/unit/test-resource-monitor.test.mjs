import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { WindowManager } from '../../browser/src/desktop/window-manager.ts';
import { createDefaultLayoutState, decodeLayoutState } from '../../browser/src/desktop/layout.ts';
const source = await readFile(new URL('../../browser/src/cockpit/SystemTelemetry.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
class Element {
 constructor(tag) { this.tagName = tag; this.className = ''; this.textContent = ''; this.children = []; this.style = {}; this.listeners = new Map(); this.isConnected = true; this.hidden = false; this.attributes = new Map(); }
 set innerHTML(value) { this.children = []; this.textContent = value; }
 appendChild(child) { this.children.push(child); return child; } append(...nodes) { this.children.push(...nodes); }
 setAttribute(name,value) { this.attributes.set(name,value); } addEventListener(name,callback) { this.listeners.set(name,callback); }
 closest() { return this.hostHidden ? {} : null; }
}
function all(root) { return [root, ...root.children.flatMap(all)]; }
function textOf(root) { return all(root).map(node => node.textContent).join(' '); }
const tick = async () => { for(let i=0;i<20;i++) await Promise.resolve(); };
function profile(overrides = {}) { return { totalRamBytes: 8*1024**3, freeRamBytes: 2*1024**3, logicalCpus: 8, vramBytes: 6*1024**3, freeVramBytes: 0, freeVramKnown: false, vramSource: 'nvidia-smi', tier: 'M', backend: 'vulkan', detectedAt: 60000, ...overrides }; }
function harness(provider = async () => profile()) {
 const parent = new Element('section'); const timers = new Map(); let requests = 0; let now = 62000;
 const document = { hidden: false, createElement: tag => new Element(tag) };
 const window = { setInterval(fn) { timers.set(1,fn); return 1; }, clearInterval(id) { timers.delete(id); } };
 const exports = {};
 vm.runInNewContext(script, { exports, require: name => { assert.equal(name, '../services/api.ts'); return { api: { hardwareProfile: () => { requests++; return provider(); } } }; }, document, window, Date: class extends Date { static now() { return now; } } });
 const handle = exports.createSystemTelemetry(parent, {});
 return { parent, handle, document, timers, setTime(value) { now = value; }, get requests() { return requests; }, poll() { for(const fn of timers.values()) fn(); } };
}
test('Resource Monitor is a singleton workstation application whose geometry restores without becoming project truth', () => {
 const manager = new WindowManager(createDefaultLayoutState());
 assert.equal(manager.open('resources'), true);
 manager.open('resources');
 assert.equal(manager.snapshot().windows.filter(w => w.appId === 'resources').length, 1);
 manager.setBounds('resources', { x:0.2,y:0.1,width:0.5,height:0.6 });
 const saved = decodeLayoutState(manager.snapshot());
 assert.ok(saved);
 assert.deepEqual(saved.windows.find(w => w.appId === 'resources').bounds, { x:0.2,y:0.1,width:0.5,height:0.6 });
});
test('unknown free VRAM cannot be rendered as measured 100 percent used', async () => {
 const h = harness(); await tick();
 const rows = all(h.parent).filter(node => node.tagName === 'tr');
 const vram = rows.find(row => textOf(row).includes('VRAM'));
 assert.ok(vram, 'technical resource row is present');
 assert.match(textOf(vram), /UNAVAILABLE/);
 assert.equal(all(vram).some(node => node.className.includes('telemetry-fill')), false);
 assert.match(textOf(h.parent), /CPU.*UNAVAILABLE/);
 h.handle.dispose();
});
test('cached sample age comes from owner detectedAt, and old data is explicitly stale', async () => {
 const h = harness(async () => profile({detectedAt: 1000,freeVramKnown:true,freeVramBytes:1024**3})); await tick();
 assert.match(textOf(h.parent), /STALE/);
 assert.match(textOf(h.parent), /61s/);
 h.handle.dispose();
});
test('hidden/disconnected monitor polling never repeatedly queries host hardware', async () => {
 const h = harness(); await tick(); const initial = h.requests;
 h.document.hidden = true; h.poll(); await tick(); assert.equal(h.requests, initial);
 h.document.hidden = false; h.handle.root.hostHidden = true; h.poll(); await tick(); assert.equal(h.requests, initial);
 h.handle.root.hostHidden = false; h.handle.root.isConnected = false; h.poll(); await tick(); assert.equal(h.requests, initial);
 h.handle.root.isConnected = true; h.poll(); await tick(); assert.equal(h.requests, initial+1);
 h.handle.dispose(); assert.equal(h.timers.size,0);
});
test('overlapping refreshes are coalesced and disposal cannot repaint from a late response', async () => {
 let resolve; const pending = new Promise(yes => {resolve=yes;});
 const h = harness(() => pending); h.handle.refresh(); h.poll(); await tick();
 assert.equal(h.requests,1);
 h.handle.dispose(); resolve(profile()); await tick();
 assert.equal(h.parent.children.length,0);
 assert.equal(h.timers.size,0);
});
test('failed refresh retains prior measured values but labels them stale', async () => {
 let failed = false; const h = harness(async () => { if(failed) throw new Error('unavailable'); return profile(); });
 await tick(); failed = true; await h.handle.refresh();
 assert.match(textOf(h.parent), /STALE/);
 assert.match(textOf(h.parent), /6.0.*8.0/);
 assert.match(textOf(h.parent), /unavailable/i);
 h.handle.dispose();
});

test('sample age becomes stale while a refresh never settles, including restored visibility', async () => {
 let pending = false;
 const h = harness(() => pending ? new Promise(() => {}) : Promise.resolve(profile()));
 await tick(); assert.match(textOf(h.parent), /SNAPSHOT.*2s/);
 pending = true; void h.handle.refresh(); await tick(); assert.equal(h.requests,2);
 h.setTime(112000); h.poll(); await tick();
 assert.match(textOf(h.parent), /STALE.*52s/);
 assert.equal(h.requests,2, 'pending request stays coalesced');
 h.handle.root.hostHidden = true; h.setTime(162000); h.handle.root.hostHidden = false;
 h.handle.activate();
 assert.match(textOf(h.parent), /STALE.*102s/);
 h.handle.dispose(); assert.equal(h.timers.size,0);
});
