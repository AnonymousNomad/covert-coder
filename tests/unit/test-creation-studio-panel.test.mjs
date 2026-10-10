import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { buildCreationStudioRenderManifest } from '../../common/creation-studio-manifest.ts';

const source = await readFile(new URL('../../browser/src/panels/creation-studio.ts', import.meta.url), 'utf8');
const script = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.type = '';
    this.min = '';
    this.max = '';
    this.maxLength = 0;
    this.placeholder = '';
  }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attributes.set(key, value); }
  addEventListener(key, handler) { this.listeners.set(key, handler); }
}

const all = root => [root, ...root.children.flatMap(all)];
const byLabel = (root, label) => all(root).find(node => node.attributes.get('aria-label') === label);
const button = (root, label) => all(root).find(node => node.tag === 'button' && node.textContent === label);

function harness() {
  const parent = new Element('section');
  const document = { createElement: tag => new Element(tag) };
  const exports = {};
  vm.runInNewContext(script, {
    exports,
    document,
    require(name) {
      if (name === '../../../common/creation-studio-manifest.ts') return { buildCreationStudioRenderManifest };
      throw new Error('unexpected dependency ' + name);
    }
  });
  return { parent, handle: exports.createCreationStudioPanel(parent) };
}

test('studio creates a scene and shot while keeping execution disconnected', () => {
  const h = harness();
  assert.equal(h.handle.buildManifest().execution_state, 'GATED_NOT_CONNECTED');

  byLabel(h.parent, 'Production title').value = 'Old Republic Test';
  byLabel(h.parent, 'Production title').listeners.get('input')();

  byLabel(h.parent, 'New scene title').value = 'Ancient ruins';
  byLabel(h.parent, 'New scene summary').value = 'The opening investigation.';
  button(h.parent, 'ADD SCENE').listeners.get('click')();

  byLabel(h.parent, 'Shot prompt').value = 'Slow cinematic push through ancient ruins at dawn.';
  byLabel(h.parent, 'Shot duration seconds').value = '8';
  byLabel(h.parent, 'Shot aspect ratio').value = '2.39:1';
  byLabel(h.parent, 'Video provider ID').value = 'test-provider';
  byLabel(h.parent, 'Video model ID').value = 'test-video-model';
  button(h.parent, 'ADD SHOT').listeners.get('click')();

  const manifest = h.handle.buildManifest();
  assert.equal(manifest.production_title, 'Old Republic Test');
  assert.equal(manifest.execution_state, 'GATED_NOT_CONNECTED');
  assert.equal(manifest.total_duration_seconds, 8);
  assert.equal(manifest.shots.length, 1);
  assert.equal(manifest.shots[0].video_provider_id, 'test-provider');
  assert.equal(manifest.shots[0].video_model_id, 'test-video-model');
  assert.match(manifest.shots[0].prompt, /ancient ruins/);

  h.handle.dispose();
  assert.equal(h.parent.children.length, 0);
});
