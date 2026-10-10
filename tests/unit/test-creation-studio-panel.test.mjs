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
const textOf = root => all(root).map(node => node.textContent).join(' ');
const tick = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };

function record(revision = 1) {
  return {
    production: {
      production_id: 'production-persisted',
      title: 'Persisted Pilot',
      premise: 'Canonical premise',
      target_duration_seconds: 1200,
      status: 'DRAFT',
      execution_connection: 'NOT_CONNECTED',
      scenes: []
    },
    bible_entries: [{
      entry_id: 'hero',
      category: 'CHARACTER',
      title: 'Hero',
      content: 'Approved appearance.',
      status: 'APPROVED'
    }],
    continuity_entries: [{
      entry_id: 'light',
      scope_kind: 'PRODUCTION',
      scope_id: null,
      title: 'Lighting',
      content: 'Cold dawn light.',
      status: 'ACTIVE'
    }],
    revision,
    updated_at: '2026-10-10T01:00:00.000Z'
  };
}

function harness(options = {}) {
  const parent = new Element('section');
  const document = { createElement: tag => new Element(tag) };
  const exports = {};
  const calls = { list: 0, put: 0, inputs: [] };
  const api = {
    creationStudioList: async signal => {
      calls.list++;
      if (options.list) return options.list(signal);
      return { records: [] };
    },
    creationStudioPut: async input => {
      calls.put++;
      calls.inputs.push(input);
      if (options.put) return options.put(input);
      return {
        production: input.production,
        bible_entries: input.bible_entries,
        continuity_entries: input.continuity_entries,
        revision: input.expected_revision + 1,
        updated_at: '2026-10-10T01:01:00.000Z'
      };
    }
  };
  const window = { confirm: () => true };
  vm.runInNewContext(script, {
    exports,
    document,
    window,
    AbortController,
    Date,
    require(name) {
      if (name === '../services/api.ts') return { api };
      if (name === '../../../common/creation-studio-manifest.ts') return { buildCreationStudioRenderManifest };
      throw new Error('unexpected dependency ' + name);
    }
  });
  return { parent, handle: exports.createCreationStudioPanel(parent), calls };
}

test('studio creates a scene and shot while keeping execution disconnected', async () => {
  const h = harness();
  await tick();
  assert.match(textOf(h.parent), /NEW DRAFT.*NOT SAVED/);
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
  assert.match(textOf(h.parent), /UNSAVED CHANGES/);

  h.handle.dispose();
  assert.equal(h.parent.children.length, 0);
});

test('studio saves through the canonical owner with optimistic revision identity', async () => {
  const h = harness();
  await tick();
  byLabel(h.parent, 'Production title').value = 'Saved Pilot';
  byLabel(h.parent, 'Production title').listeners.get('input')();
  assert.equal(button(h.parent, 'SAVE PRODUCTION').disabled, false);
  button(h.parent, 'SAVE PRODUCTION').listeners.get('click')();
  await tick();

  assert.equal(h.calls.put, 1);
  assert.equal(h.calls.inputs[0].expected_revision, 0);
  assert.equal(h.calls.inputs[0].production.title, 'Saved Pilot');
  assert.equal(h.calls.inputs[0].production.execution_connection, 'NOT_CONNECTED');
  assert.match(textOf(h.parent), /SAVED REVISION 1/);
  assert.equal(button(h.parent, 'SAVE PRODUCTION').disabled, true);
  assert.equal(h.handle.buildManifest().execution_state, 'GATED_NOT_CONNECTED');
  h.handle.dispose();
});

test('studio resumes the canonical record and preserves Bible and continuity on a production save', async () => {
  const persisted = record(4);
  const h = harness({
    list: async () => ({ records: [persisted] }),
    put: async input => ({
      production: input.production,
      bible_entries: input.bible_entries,
      continuity_entries: input.continuity_entries,
      revision: 5,
      updated_at: '2026-10-10T01:02:00.000Z'
    })
  });
  await tick();
  assert.equal(byLabel(h.parent, 'Production title').value, 'Persisted Pilot');
  assert.match(textOf(h.parent), /SAVED REVISION 4/);
  assert.match(byLabel(h.parent, 'Canonical production memory').textContent, /BIBLE 1.*CONTINUITY 1/);

  byLabel(h.parent, 'Production title').value = 'Persisted Pilot Revised';
  byLabel(h.parent, 'Production title').listeners.get('input')();
  button(h.parent, 'SAVE PRODUCTION').listeners.get('click')();
  await tick();

  assert.equal(h.calls.inputs[0].expected_revision, 4);
  assert.equal(JSON.stringify(h.calls.inputs[0].bible_entries), JSON.stringify(persisted.bible_entries));
  assert.equal(JSON.stringify(h.calls.inputs[0].continuity_entries), JSON.stringify(persisted.continuity_entries));
  assert.match(textOf(h.parent), /SAVED REVISION 5/);
  h.handle.dispose();
});

test('Production Bible entries are added and persisted through the canonical owner', async () => {
  const h = harness();
  await tick();

  byLabel(h.parent, 'Bible category').value = 'CHARACTER';
  byLabel(h.parent, 'Bible entry title').value = 'Shade';
  byLabel(h.parent, 'Bible entry content').value = 'Technical prodigy with a dark field jacket.';
  byLabel(h.parent, 'Bible entry status').value = 'APPROVED';
  button(h.parent, 'ADD BIBLE ENTRY').listeners.get('click')();

  assert.match(textOf(h.parent), /CHARACTER.*Shade.*APPROVED/);
  assert.match(textOf(h.parent), /UNSAVED CHANGES/);
  button(h.parent, 'SAVE PRODUCTION').listeners.get('click')();
  await tick();

  assert.equal(h.calls.put, 1);
  assert.equal(h.calls.inputs[0].bible_entries.length, 1);
  assert.equal(h.calls.inputs[0].bible_entries[0].category, 'CHARACTER');
  assert.equal(h.calls.inputs[0].bible_entries[0].title, 'Shade');
  assert.equal(h.calls.inputs[0].bible_entries[0].status, 'APPROVED');
  assert.match(h.calls.inputs[0].bible_entries[0].content, /Technical prodigy/);
  assert.match(textOf(h.parent), /SAVED REVISION 1/);
  h.handle.dispose();
});

test('Production Bible reload supports edit and removal without changing continuity or rendering state', async () => {
  const persisted = record(3);
  const h = harness({
    list: async () => ({ records: [persisted] }),
    put: async input => ({
      production: input.production,
      bible_entries: input.bible_entries,
      continuity_entries: input.continuity_entries,
      revision: input.expected_revision + 1,
      updated_at: '2026-10-10T01:03:00.000Z'
    })
  });
  await tick();

  assert.match(textOf(h.parent), /CHARACTER.*Hero.*Approved appearance/);
  assert.equal(button(h.parent, 'EDIT').disabled, false);
  button(h.parent, 'EDIT').listeners.get('click')();
  assert.equal(byLabel(h.parent, 'Bible entry title').value, 'Hero');
  assert.equal(byLabel(h.parent, 'Bible entry status').value, 'APPROVED');

  byLabel(h.parent, 'Bible entry content').value = 'Updated approved appearance.';
  byLabel(h.parent, 'Bible entry status').value = 'DRAFT';
  button(h.parent, 'SAVE BIBLE ENTRY').listeners.get('click')();
  assert.match(textOf(h.parent), /DRAFT.*Updated approved appearance/);

  button(h.parent, 'SAVE PRODUCTION').listeners.get('click')();
  await tick();
  assert.equal(h.calls.inputs[0].expected_revision, 3);
  assert.equal(h.calls.inputs[0].bible_entries[0].content, 'Updated approved appearance.');
  assert.equal(h.calls.inputs[0].bible_entries[0].status, 'DRAFT');
  assert.equal(JSON.stringify(h.calls.inputs[0].continuity_entries), JSON.stringify(persisted.continuity_entries));
  assert.equal(h.calls.inputs[0].production.execution_connection, 'NOT_CONNECTED');
  assert.equal(h.handle.buildManifest().execution_state, 'GATED_NOT_CONNECTED');

  button(h.parent, 'REMOVE').listeners.get('click')();
  assert.doesNotMatch(textOf(h.parent), /Updated approved appearance/);
  button(h.parent, 'SAVE PRODUCTION').listeners.get('click')();
  await tick();
  assert.equal(h.calls.put, 2);
  assert.equal(h.calls.inputs[1].expected_revision, 4);
  assert.equal(h.calls.inputs[1].bible_entries.length, 0);
  assert.equal(JSON.stringify(h.calls.inputs[1].continuity_entries), JSON.stringify(persisted.continuity_entries));
  h.handle.dispose();
});

test('revision conflict fails closed and requires a canonical reload before another save', async () => {
  const h = harness({
    list: async () => ({ records: [record(2)] }),
    put: async () => { throw Object.assign(new Error('stale'), { code: 'CONFLICT' }); }
  });
  await tick();
  byLabel(h.parent, 'Production title').value = 'Conflicting local edit';
  byLabel(h.parent, 'Production title').listeners.get('input')();
  button(h.parent, 'SAVE PRODUCTION').listeners.get('click')();
  await tick();

  assert.equal(h.calls.put, 1);
  assert.match(textOf(h.parent), /REVISION CONFLICT.*RELOAD REQUIRED/);
  assert.equal(button(h.parent, 'SAVE PRODUCTION').disabled, true);
  assert.equal(button(h.parent, 'RELOAD').disabled, false);
  h.handle.dispose();
});

test('failed canonical read permits local planning but keeps persistence disabled', async () => {
  const h = harness({ list: async () => { throw Object.assign(new Error('owner down'), { code: 'NOT_READY' }); } });
  await tick();
  assert.match(textOf(h.parent), /CANONICAL STATE UNAVAILABLE.*SAVE DISABLED/);
  byLabel(h.parent, 'Production title').value = 'Offline draft';
  byLabel(h.parent, 'Production title').listeners.get('input')();
  assert.equal(button(h.parent, 'SAVE PRODUCTION').disabled, true);
  assert.equal(h.calls.put, 0);
  h.handle.dispose();
});
