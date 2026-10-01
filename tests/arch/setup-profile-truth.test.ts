import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SetupProfile, parseSetupProfile, setupChoiceDispositions, setupPreferenceSignature } from '../../browser/src/cockpit/setup-profile.ts';

const profile = SetupProfile.parse({ version: 2, answers: {
  workType: 'Software Engineering', secondaryWork: 'None', mode: 'LOCAL_FIRST',
  providers: ['OpenAI / compatible', 'Anthropic / Claude'], projectLocations: 'E:\\projects',
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
test('every interview preference has explicit disposition and never claims provisioning', () => {
  for (const saved of [true, false]) {
    const dispositions = setupChoiceDispositions(saved);
    assert.equal(dispositions.length, 8);
    for (const disposition of dispositions) {
      assert.equal(disposition.status, saved ? 'SAVED AS PREFERENCE' : 'DEFERRED');
      assert.ok(disposition.detail.length > 0);
    }
  }
});
test('a changed preference or selected advisory identity invalidates the persisted match', () => {
  const original = setupPreferenceSignature(profile.answers, profile.selectedModelId);
  assert.notEqual(setupPreferenceSignature({ ...profile.answers, mode: 'CLOUD' }, profile.selectedModelId), original);
  assert.notEqual(setupPreferenceSignature(profile.answers, 'other-model'), original);
});
