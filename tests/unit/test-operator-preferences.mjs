import assert from 'node:assert/strict';
import { PreferenceStore, PREFERENCE_STORAGE_KEY, DEFAULT_PREFERENCES, THEME_REGISTRY, applyAppearance } from '../../browser/src/settings/preferences.mjs';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
const store = new PreferenceStore(storage);
assert.equal(store.load().status, 'empty');
assert.deepEqual(store.getEffective(), DEFAULT_PREFERENCES);

assert.deepEqual(store.set('appearance.theme', 'matrix', 'global'), { ok: true, persisted: true });
assert.equal(store.getEffective().theme, 'matrix');
assert.equal(store.getSource('appearance.theme'), 'global');
assert.deepEqual(THEME_REGISTRY.map(theme => theme.id), ['covert', 'matrix']);

assert.deepEqual(store.set('appearance.theme', 'covert', 'workspace'), { ok: false, persisted: false, reason: 'WORKSPACE_REQUIRED' });
assert.deepEqual(store.set('appearance.theme', 'covert', 'workspace', 'project-alpha'), { ok: true, persisted: true });
assert.equal(store.getEffective('project-alpha').theme, 'covert');
assert.equal(store.getEffective('project-beta').theme, 'matrix');
assert.equal(store.getEditableValue('appearance.theme', 'global', 'project-alpha'), 'matrix');
assert.equal(store.getEditableValue('appearance.theme', 'workspace', 'project-alpha'), 'covert');
assert.equal(store.getEditableValue('appearance.theme', 'workspace', 'project-beta'), 'matrix', 'a workspace without an override edits its inherited value');
assert.equal(store.getSource('appearance.theme', 'project-alpha'), 'workspace');
assert.equal(store.hasWorkspaceOverride('appearance.theme', 'project-alpha'), true);

const reloaded = new PreferenceStore(storage);
assert.equal(reloaded.load().status, 'loaded');
assert.equal(reloaded.getEffective('project-alpha').theme, 'covert');
assert.equal(reloaded.getEffective('project-beta').theme, 'matrix');
assert.deepEqual(reloaded.reset('workspace', 'project-alpha'), { ok: true, persisted: true });
assert.equal(reloaded.getEffective('project-alpha').theme, 'matrix', 'workspace reset inherits global');
assert.equal(reloaded.getSource('appearance.theme', 'project-alpha'), 'global');
assert.equal(reloaded.getEffective('project-beta').theme, 'matrix', 'reset must not mutate another workspace');

const boundedStorage = new MemoryStorage();
const bounded = new PreferenceStore(boundedStorage);
bounded.load();
bounded.set('appearance.theme', 'matrix');
bounded.set('layout.density', 'compact');
bounded.set('layout.telemetryVisible', false);
assert.deepEqual(bounded.resetSettings(['appearance.theme', 'appearance.textScale', 'appearance.effects', 'accessibility.reducedMotion']), { ok: true, persisted: true });
assert.equal(bounded.getEffective().theme, 'covert', 'appearance reset restores theme');
assert.equal(bounded.getEffective().density, 'compact', 'appearance reset preserves layout density');
assert.equal(bounded.getEffective().telemetryVisible, false, 'appearance reset preserves telemetry preference');

const envelope = JSON.parse(storage.getItem(PREFERENCE_STORAGE_KEY));
envelope.global['appearance.retiredSetting'] = 'preserve-me';
envelope.global['appearance.textScale'] = 'invalid-old-value';
storage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(envelope));
const recovered = new PreferenceStore(storage);
assert.equal(recovered.load().status, 'recovered');
assert.equal(recovered.getEffective().textScale, 'normal');
assert.equal(recovered.set('layout.density', 'compact').persisted, true);
const recoveredEnvelope = JSON.parse(storage.getItem(PREFERENCE_STORAGE_KEY));
assert.equal(recoveredEnvelope.global['appearance.retiredSetting'], 'preserve-me', 'unknown settings survive writes');
assert.equal(recoveredEnvelope.global['appearance.textScale'], 'invalid-old-value', 'invalid settings are preserved for recovery');

const futureStorage = new MemoryStorage();
futureStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify({ version: 99, global: {}, workspaces: {} }));
const future = new PreferenceStore(futureStorage);
assert.equal(future.load().status, 'unsupported');
assert.deepEqual(future.set('appearance.theme', 'matrix'), { ok: false, persisted: false, reason: 'STORAGE_NOT_WRITABLE' });
assert.equal(JSON.parse(futureStorage.getItem(PREFERENCE_STORAGE_KEY)).version, 99, 'future schema is not overwritten');

const malformedStorage = new MemoryStorage();
malformedStorage.setItem(PREFERENCE_STORAGE_KEY, '{broken');
const malformed = new PreferenceStore(malformedStorage);
assert.equal(malformed.load().status, 'invalid');
assert.equal(malformed.set('layout.density', 'compact').persisted, false);
assert.equal(malformedStorage.getItem(PREFERENCE_STORAGE_KEY), '{broken', 'malformed data remains available for recovery');

const unavailable = new PreferenceStore(null);
assert.equal(unavailable.load().status, 'unavailable');
assert.equal(unavailable.set('appearance.theme', 'matrix').persisted, false);

const root = { dataset: {}, style: { values: new Map(), getPropertyValue(key) { return this.values.get(key) ?? ''; }, setProperty(key, value) { this.values.set(key, value); } } };
applyAppearance({ ...DEFAULT_PREFERENCES, theme: 'matrix', density: 'compact', reducedMotion: true, effects: 'reduced', telemetryVisible: false, textScale: 'large' }, root);
assert.equal(root.dataset.covertTheme, 'matrix');
assert.equal(root.dataset.covertDensity, 'compact');
assert.equal(root.dataset.covertMotion, 'reduced');
assert.equal(root.dataset.covertEffects, 'reduced');
assert.equal(root.dataset.covertTelemetry, 'hidden');
assert.equal(root.style.values.get('--ck-text-scale'), '1.12');
applyAppearance(DEFAULT_PREFERENCES, root);
assert.equal(Object.hasOwn(root.dataset, 'covertTheme'), false, 'default theme clears alternate-theme selection');
assert.equal(root.dataset.covertMotion, 'system');

const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const priorCustomEvent = Object.getOwnPropertyDescriptor(globalThis, 'CustomEvent');
const appearanceEvents = [];
class EventStub {
  constructor(type, init) { this.type = type; this.detail = init.detail; }
}
Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent(event) { appearanceEvents.push(event); } } });
Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: EventStub });
try {
  const eventRoot = { dataset: {}, style: { value: '', getPropertyValue() { return this.value; }, setProperty(_key, value) { this.value = value; } } };
  applyAppearance(DEFAULT_PREFERENCES, eventRoot);
  const initialCount = appearanceEvents.length;
  applyAppearance(DEFAULT_PREFERENCES, eventRoot);
  assert.equal(appearanceEvents.length, initialCount, 'unchanged appearance does not dispatch redundant UI updates');
  applyAppearance({ ...DEFAULT_PREFERENCES, theme: 'matrix' }, eventRoot);
  assert.equal(appearanceEvents.length, initialCount + 1, 'a real appearance change notifies editor/terminal surfaces');
  assert.equal(appearanceEvents.at(-1).type, 'covert:appearancechange');
} finally {
  if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
  else delete globalThis.window;
  if (priorCustomEvent) Object.defineProperty(globalThis, 'CustomEvent', priorCustomEvent);
  else delete globalThis.CustomEvent;
}
console.log('operator preference tests passed');
