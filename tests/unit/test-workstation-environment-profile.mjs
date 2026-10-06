import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvironmentProfile, inspectEnvironmentProfile } from '../../browser/src/workstation/interactions/environment-profile.mjs';
const binding = { projectId: 'project:a', rootGeneration: 2 };
const profile = {
  version: 1, id: 'profile:rust', title: 'Rust workstation',
  layout: { version: 1, windows: [{ instanceId: 'editor:one', appRef: 'app:editor', x: 10, y: 20, width: 640, height: 400 }] },
  applications: ['app:editor'], tools: ['tool:git'],
  terminals: [{ id: 'terminal:one', profileRef: 'terminal-profile:pwsh', cwdRef: 'directory:root' }],
  modelRoles: [{ role: 'worker', modelRef: 'model:local', routeRef: 'route:local' }],
  workflowRefs: ['workflow:verify'], shortcuts: [{ id: 'shortcut:one', commandRef: 'command:search' }],
};
const raw = value => JSON.stringify(value);

test('complete profile preserves distinct references and layout without execution', () => {
  const parsed = parseEnvironmentProfile(raw(profile));
  assert.deepEqual(parsed, profile);
  assert.ok(Object.isFrozen(parsed.terminals[0]));
  const result = inspectEnvironmentProfile(raw(profile), { binding, lookupCapability: () => ({ presence: 'PRESENT' }) });
  assert.equal(result.activation, 'DISABLED');
  assert.deepEqual(result.project, binding);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.unknown, []);
  assert.equal(result.references.find(x => x.kind === 'directory').id, 'directory:root');
});

test('missing capabilities are listed without installation, grants or cloud routing', () => {
  const result = inspectEnvironmentProfile(raw(profile), { binding, lookupCapability: ({ id }) => ({ presence: id === 'model:local' ? 'MISSING' : 'PRESENT' }) });
  assert.deepEqual(result.missing, [{ kind: 'model', id: 'model:local' }]);
  assert.equal(result.activation, 'DISABLED');
  assert.equal(Object.hasOwn(result, 'permissions'), false);
  assert.equal(Object.hasOwn(result, 'execute'), false);
});

test('catalog absence and owner errors stay unknown rather than missing or ready', () => {
  const unavailable = inspectEnvironmentProfile(raw(profile), { binding });
  assert.ok(unavailable.unknown.length > 0);
  assert.deepEqual(unavailable.missing, []);
  const failed = inspectEnvironmentProfile(raw(profile), { binding, lookupCapability() { throw new Error('secret=do-not-echo'); } });
  assert.ok(failed.unknown.length > 0);
  assert.ok(!JSON.stringify(failed).includes('do-not-echo'));
});

test('present catalog entry is not an authenticated or qualified route', () => {
  const result = inspectEnvironmentProfile(raw(profile), { binding, lookupCapability: () => ({ presence: 'PRESENT', revision: 'v1' }) });
  assert.equal(result.references.find(x => x.kind === 'route').presence, 'PRESENT');
  assert.equal(result.activation, 'DISABLED');
  assert.equal(Object.hasOwn(result, 'qualified'), false);
});

test('minimal profile supplies empty declarations without inventing defaults that run', () => {
  const value = parseEnvironmentProfile(raw({ version: 1, id: 'profile:minimal', title: 'Minimal' }));
  assert.deepEqual(value.terminals, []);
  assert.deepEqual(value.modelRoles, []);
  assert.deepEqual(value.layout, { version: 1, windows: [] });
});

for (const [field, value] of [
  ['command', 'rm -rf'], ['install', ['thing']], ['credentials', { apiKey: 'secret' }],
  ['permissions', ['terminal.run']], ['cloudRouting', true], ['hooks', ['execute']],
]) test('profile field ' + field + ' is rejected rather than silently activated', () => {
  assert.throws(() => parseEnvironmentProfile(raw({ ...profile, [field]: value })), { code: 'INVALID_PROFILE' });
});

test('terminal declarations cannot carry commands or raw shell strings', () => {
  assert.throws(() => parseEnvironmentProfile(raw({ ...profile, terminals: [{ ...profile.terminals[0], command: 'curl host' }] })), { code: 'INVALID_PROFILE' });
  assert.throws(() => parseEnvironmentProfile(raw({ ...profile, terminals: [{ ...profile.terminals[0], profileRef: 'pwsh -Command rm' }] })), { code: 'INVALID_PROFILE' });
});

test('duplicate window, terminal and role identities are rejected', () => {
  for (const [key, list] of [
    ['terminals', [profile.terminals[0], profile.terminals[0]]],
    ['modelRoles', [profile.modelRoles[0], profile.modelRoles[0]]],
    ['shortcuts', [profile.shortcuts[0], profile.shortcuts[0]]],
  ]) assert.throws(() => parseEnvironmentProfile(raw({ ...profile, [key]: list })), { code: 'INVALID_PROFILE' });
  assert.throws(() => parseEnvironmentProfile(raw({ ...profile, layout: { version: 1, windows: [profile.layout.windows[0], profile.layout.windows[0]] } })), { code: 'INVALID_PROFILE' });
});

test('negative, oversized and nonfinite geometry cannot be restored', () => {
  for (const patch of [{ width: -1 }, { height: 9000 }, { x: 40000 }, { y: null }]) {
    assert.throws(() => parseEnvironmentProfile(raw({ ...profile, layout: { version: 1, windows: [{ ...profile.layout.windows[0], ...patch }] } })), { code: 'INVALID_PROFILE' });
  }
});

test('resource array and total payload sizes are bounded', () => {
  assert.throws(() => parseEnvironmentProfile(raw({ ...profile, applications: Array.from({ length: 33 }, (_, i) => 'app:' + i) })), { code: 'INVALID_PROFILE' });
  assert.throws(() => parseEnvironmentProfile('x'.repeat(66000)), { code: 'PROFILE_TOO_LARGE' });
});

test('prototype metadata and changed versions are not accepted', () => {
  assert.throws(() => parseEnvironmentProfile('{"version":1,"id":"profile:x","title":"x","__proto__":{"grant":true}}'), { code: 'INVALID_PROFILE' });
  assert.throws(() => parseEnvironmentProfile(raw({ ...profile, version: 2 })), { code: 'INVALID_PROFILE' });
});

test('inspection snapshots cannot be changed by later caller mutation', () => {
  const project = { ...binding };
  const result = inspectEnvironmentProfile(raw(profile), { binding: project, lookupCapability: () => ({ presence: 'PRESENT' }) });
  project.projectId = 'project:b';
  assert.equal(result.project.projectId, 'project:a');
  assert.ok(Object.isFrozen(result.references));
});

test('invalid or absent project binding cannot apply a profile', () => {
  assert.throws(() => inspectEnvironmentProfile(raw(profile), { binding: null }), { code: 'PROJECT_REQUIRED' });
  assert.throws(() => inspectEnvironmentProfile(raw(profile), { binding: { ...binding, rootGeneration: -1 } }), { code: 'INVALID_PROFILE' });
});
