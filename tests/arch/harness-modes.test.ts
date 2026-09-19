// tests/arch/harness-modes.test.ts
// The ONE harness / loadout contract: every mode is a typed definition over
// existing registries, statuses are truthful (no mode claims integrations that
// do not exist), and composition is deterministic and can only narrow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HarnessModeDefinition, ComposedHarnessMode } from '../../common/contracts/harness-modes.ts';
import {
  MODE_DEFINITIONS,
  composeModeDefinitions,
  composeModes,
  compositionNeverLoosens,
  getMode,
  listModes,
  ModeConflictError,
  ModeLookupError
} from '../../harness/modes.mjs';

test('every initial mode definition validates against the typed contract', () => {
  const modes = listModes();
  assert.equal(modes.length, 6);
  for (const mode of modes) {
    const parsed = HarnessModeDefinition.safeParse(mode);
    assert.equal(parsed.success, true, `${mode.mode_id} must validate`);
  }
});

test('initial statuses are truthful', () => {
  const statuses = Object.fromEntries(listModes().map(mode => [mode.mode_id, mode.status]));
  assert.equal(statuses['software-engineering'], 'AVAILABLE', 'software engineering is the strongest current mode');
  assert.equal(statuses['cybersecurity'], 'EXPERIMENTAL');
  assert.equal(statuses['business-operations'], 'PLANNED');
  assert.equal(statuses['web-production'], 'PARTIAL');
  const cybersecurity = getMode('cybersecurity');
  assert.deepEqual(cybersecurity.tool_classes, [], 'no offensive/scanning adapters are claimed');
  assert.ok(cybersecurity.prohibited_effects.includes('offensive-automation'));
  assert.ok(cybersecurity.required_integrations.length > 0, 'missing future tools are declared, not pretended');
  assert.ok(cybersecurity.checklists.some(item => item.includes('rules-of-engagement')));
});

test('unknown modes fail closed', () => {
  assert.throws(() => getMode('not-a-mode'), ModeLookupError);
});

test('composition unions loadouts, tightens budgets, and takes the weakest status', () => {
  const composed = composeModes({ primary: 'software-engineering', specializations: ['cybersecurity'] });
  assert.equal(composed.status, 'EXPERIMENTAL', 'composed status is the weakest component');
  assert.deepEqual(composed.specialization_ids, ['cybersecurity']);
  assert.ok(composed.effective.prohibited_effects.includes('offensive-automation'));
  assert.ok(composed.effective.authority_policy_refs.includes('capability.execute'));
  assert.equal(composed.effective.resource_policy.max_parallel_jobs, 1, 'tightest resource cap wins');
  assert.equal(composed.effective.resource_policy.max_context_tokens, 8192);
  const parsed = ComposedHarnessMode.safeParse(composed);
  assert.equal(parsed.success, true);
  assert.deepEqual(composed.effective.required_integrations, ['semgrep', 'trivy', 'gitleaks']);
  assert.ok(!composed.effective.optional_integrations.includes('semgrep'), 'required integrations never duplicate as optional');
});

test('composition never loosens a component constraint', () => {
  const verdict = compositionNeverLoosens({ primary: 'software-engineering', specializations: ['cybersecurity', 'research'] });
  assert.equal(verdict.ok, true, verdict.ok ? '' : verdict.reason);
});

test('composition conflicts are deterministic errors, not silent winners', () => {
  const base = MODE_DEFINITIONS[0]!;
  const second = MODE_DEFINITIONS[1]!;
  assert.throws(
    () => composeModeDefinitions([
      base,
      { ...second, model_roles: { plan: 'act', act: 'act', utility: 'utility' } }
    ]),
    ModeConflictError
  );
  assert.throws(
    () => composeModeDefinitions([
      base,
      { ...second, workflow_bundles: [{ id: 'covert-workflow-stages', version: '2' }] }
    ]),
    ModeConflictError
  );
});

test('mode list is stable and ordered by definition', () => {
  const ids = listModes().map(mode => mode.mode_id);
  assert.deepEqual(ids, ['software-engineering', 'web-production', 'cybersecurity', 'machine-learning', 'business-operations', 'research']);
});
