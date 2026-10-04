import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetupProfile, parseSetupProfile, setupChoiceDispositions, setupPreferenceSignature, setupWorkbenchDisposition, SETUP_PROVIDER_OPTIONS } from '../../browser/src/cockpit/setup-profile.ts';

const profile = SetupProfile.parse({ version: 2, answers: {
  workType: 'Software Engineering', secondaryWork: 'None', mode: 'LOCAL_FIRST',
  providers: ['OpenAI / compatible', 'Anthropic / Claude', 'OpenCode Go (managed connection)'], projectLocations: 'E:\\projects',
  localModelUse: 'Offline fallback', approvalStrictness: 'STRICT (every operation is approved)',
  integrations: ['GitHub'], importantWorkflows: 'review',
}, planName: 'Software Engineering', selectedModelId: 'advisory-model', stage: 10, completedAt: null });

test('draft profile roundtrips all preferences without completing setup', () => {
  assert.deepEqual(parseSetupProfile(JSON.stringify(profile)), profile);
  assert.equal(profile.completedAt, null);
  assert.equal('ready' in profile, false);
});
test('legacy completed profile migrates only as preferences, requiring new validation', () => {
  const loaded = parseSetupProfile(JSON.stringify({ version: 1, answers: profile.answers,
    planName: profile.planName, selectedModelId: profile.selectedModelId, completedAt: '2026-10-01T00:00:00Z' }));
  assert.equal(loaded?.stage, 10);
  assert.deepEqual(loaded?.answers, profile.answers);
  assert.equal('ready' in loaded!, false);
});
test('invalid, unknown-version, incomplete and unexpected credential fields fail closed', () => {
  for (const raw of ['{', '{}', JSON.stringify({ ...profile, version: 3 }),
    JSON.stringify({ ...profile, answers: { mode: 'CLOUD' } }),
    JSON.stringify({ ...profile, apiKey: 'unexpected-field' })]) assert.equal(parseSetupProfile(raw), null);
});
test('saved answers do not turn unsupported project and workflow work into active configuration', () => {
  const preferenceChoices = ['Primary / secondary work', 'Model preference', 'Providers', 'Local model use / recommendation'];
  const deferredChoices = ['Project locations', 'Approval strictness', 'Integrations', 'Recurring workflows'];
  for (const saved of [true, false]) {
    const dispositions = setupChoiceDispositions(saved);
    assert.equal(dispositions.length, 8);
    for (const choice of preferenceChoices) {
      assert.equal(dispositions.find(item => item.choice === choice)?.status, saved ? 'PLANNED' : 'DEFERRED');
    }
    for (const choice of deferredChoices) assert.equal(dispositions.find(item => item.choice === choice)?.status, 'DEFERRED');
    for (const disposition of dispositions) assert.ok(disposition.detail.length > 0);
  }
  const dispositions = setupChoiceDispositions(true);
  const projects = dispositions.find(item => item.choice === 'Project locations');
  const workflows = dispositions.find(item => item.choice === 'Recurring workflows');
  assert.match(projects?.detail ?? '', /not registered|not yet active/i);
  assert.match(workflows?.detail ?? '', /not enabled|not yet active/i);
});

test('OpenCode Go interview choice records a managed-connection preference without asserting connection or API access', () => {
  assert.ok(SETUP_PROVIDER_OPTIONS.includes('OpenCode Go (managed connection)'));
  const parsed = parseSetupProfile(JSON.stringify(profile));
  assert.deepEqual(parsed?.answers.providers, ['OpenAI / compatible', 'Anthropic / Claude', 'OpenCode Go (managed connection)']);
  const providers = setupChoiceDispositions(true).find(item => item.choice === 'Providers');
  assert.equal(providers?.status, 'PLANNED');
  assert.match(providers?.detail ?? '', /authentication.*model discovery.*route availability remain separate/i);
});

test('a current canonical workbench readback is the only setup disposition that can verify profile application', () => {
  const detail = { workbench: {
    id: 'sovereign-coder', name: 'Sovereign Coder', version: '1.0.0', description: 'Local developer workbench',
    offline_by_default: true, installed: true, enabled: false, plugins: [{ id: 'lint', enabled: false }],
    skills: [{ id: 'test', enabled: false }], mcp_servers: [{ name: 'github', transport: 'stdio' as const, offline: true, trusted: false }],
    recommended_models: [], setup: [], validated: true, issues: []
  } };
  const workProfile = setupWorkbenchDisposition('sovereign-coder', detail);
  assert.equal(workProfile.status, 'VERIFIED');
  const dispositions = setupChoiceDispositions(true, { workProfile });
  const profile = dispositions.find(item => item.choice === 'Primary / secondary work');
  assert.equal(profile?.status, 'VERIFIED');
  assert.match(profile?.detail ?? '', /plugins\/skills remain disabled/i);
  assert.equal(setupWorkbenchDisposition('sovereign-pipeline', detail).status, 'FAILED');
  assert.equal(setupWorkbenchDisposition('sovereign-coder', null).status, 'UNAVAILABLE');
});
test('a changed preference or selected advisory identity invalidates the persisted match', () => {
  const original = setupPreferenceSignature(profile.answers, profile.selectedModelId);
  assert.notEqual(setupPreferenceSignature({ ...profile.answers, mode: 'CLOUD' }, profile.selectedModelId), original);
  assert.notEqual(setupPreferenceSignature(profile.answers, 'other-model'), original);
});
