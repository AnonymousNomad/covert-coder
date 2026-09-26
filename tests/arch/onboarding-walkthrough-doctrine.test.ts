import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (file: string): Promise<string> => fs.readFile(path.join(root, file), 'utf8');

test('Covert onboarding uses canonical configuration owners and stays rerunnable', async () => {
  const [skill, contract, service, routes, setup, settings, shell, models, chat, walkthrough] = await Promise.all([
    read('skills/packs/aide-onboarding-walkthrough/SKILL.md'),
    read('common/contracts/onboarding.ts'),
    read('node/src/services/onboarding.mjs'),
    read('node/src/routes/onboarding.ts'),
    read('browser/src/cockpit/SetupSession.ts'),
    read('browser/src/cockpit/SettingsSurface.ts'),
    read('browser/src/cockpit/CockpitShell.ts'),
    read('browser/src/panels/models.ts'),
    read('browser/src/chat/chat.ts'),
    read('browser/src/cockpit/Walkthrough.ts')
  ]);

  assert.match(skill, /^---\r?\nname: aide-onboarding-walkthrough\r?\ndescription: /);
  for (const stage of ['welcome', 'local_intelligence', 'providers', 'workflow', 'security', 'workspace', 'verify', 'finish']) {
    assert.ok(contract.includes(`'${stage}'`), `missing canonical setup stage: ${stage}`);
    assert.ok(setup.includes(`id: '${stage}'`), `wizard does not render stage: ${stage}`);
  }
  for (const route of ['/api/onboarding/skip', '/api/onboarding/restart', '/api/onboarding/defer', '/api/onboarding/resume']) {
    assert.ok(routes.includes(route), `missing approved progress route: ${route}`);
  }
  assert.ok(contract.includes('deferred: z.boolean().default(false)'));
  assert.ok(service.includes('current.user_choices = current.user_choices') || service.includes('restarted.user_choices = current.user_choices'));
  assert.ok(setup.includes('api.onboardingDefer()'));
  assert.ok(setup.includes('api.onboardingResume()'));
  assert.ok(setup.includes('api.byokSetRouting(nextRouting)'), 'workflow choices must write through canonical routing');
  assert.ok(!setup.includes('setup-session.json'), 'configuration must not be persisted in an onboarding-only file');
  assert.ok(settings.includes("label: 'INTELLIGENCE · PROVIDERS'"));
  assert.ok(settings.includes("label: 'SETUP & ONBOARDING'"));
  assert.ok(models.includes('onManageProviders'));
  assert.ok(chat.includes('onManageProviders'));
  assert.ok(shell.includes("openSettingsSection('providers')"));
  assert.ok(!walkthrough.includes('onboardingComplete'), 'the product tour must not complete setup');
});
