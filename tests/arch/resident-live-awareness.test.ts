// Resident Awareness Layer — Slice 4 acceptance tests.
// Live dogfood integration: enable gate (default OFF), deterministic SOP
// selection, no-SOP validity, constitution-once, summary policy, conditional
// capability details, budget bounds, firewall, credential safety, failure
// paths, composer integration + rollback equivalence, capability staleness,
// and the wiring/gate static checks.
//
// Hermetic: no engine, no inference. Fixture roots live in os.tmpdir(); the
// resident namespace and the frozen projection file are read-only inputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createResidentAwarenessProvider,
  awarenessEnabled,
  needsCapabilityDetails,
  capabilityFilterFor,
  classifyTask,
  selectSopsDeterministically,
  AWARENESS_ENV_FLAG
} from '../../node/src/services/resident-awareness-provider.mjs';
import { createChatContextComposer } from '../../node/src/services/chat-context.ts';
import { estimateTokens } from '../../node/src/services/history-fit.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJECTION_FILE = path.join(REPO, 'experiments', 'resident-awareness', 'results', 'arsenal-projection.json');
const CONTINUITY = '[CANONICAL CONTINUITY — system-owned; UNKNOWN means unavailable]\nproject: covert-production\nstage: REVIEW';
const AUTHORITY = 'authority: no approval recorded for push/deploy operations';
const EVIDENCE = 'evidence: ABSENT (no verification record)';

async function realProjection() {
  return JSON.parse(await fs.readFile(PROJECTION_FILE, 'utf8'));
}

function fixtureProjection() {
  return {
    summary: { total: 3, by_kind: { MODEL: 3 }, by_availability: { READY: 2, UNAVAILABLE: 1 } },
    descriptors: [
      { id: 'model-a', kind: 'MODEL', availability: 'READY', roles: ['coder'], context_limit: 4096, location: 'local' },
      { id: 'model-b', kind: 'MODEL', availability: 'READY', roles: ['chat'], context_limit: 2048, location: 'local' },
      { id: 'model-c', kind: 'MODEL', availability: 'UNAVAILABLE', roles: ['coder'], context_limit: 8192, location: 'local', secret: 'sk-SENTINEL-0000-DO-NOT-LEAK' }
    ]
  };
}

async function enabledProvider(overrides = {}) {
  return createResidentAwarenessProvider({
    workspace: REPO,
    repoRoot: REPO,
    enabled: true,
    projection: await realProjection(),
    continuity: CONTINUITY,
    taskAuthority: AUTHORITY,
    taskEvidence: EVIDENCE,
    ...overrides
  });
}

async function composeWith(providers: Record<string, unknown>, task: string) {
  const composer = createChatContextComposer({
    workspace: REPO,
    runtime: { refreshServedContext: async () => ({}), getEffectiveContext: () => 4096 } as never,
    providers: providers as never
  });
  return composer.compose({ modelId: 'liquid-dogfood-merged-q8_0', messages: [{ role: 'user', content: task }] } as never);
}

test('enable gate — default ON (internal), explicit disable, disabled provider is inert', async () => {
  assert.equal(awarenessEnabled({}), true);
  assert.equal(awarenessEnabled({ [AWARENESS_ENV_FLAG]: '1' }), true);
  assert.equal(awarenessEnabled({ [AWARENESS_ENV_FLAG]: '0' }), false);
  const off = createResidentAwarenessProvider({ workspace: REPO, repoRoot: REPO, enabled: false });
  assert.equal(off.enabled, false);
  assert.equal(await off.provider('The coding worker failed.'), '');
  assert.equal(off.getJournal().at(-1)!.reason, 'awareness disabled');
});

test('deterministic selection — strong top-2, weak none, status default, cap held', async () => {
  const provider = await enabledProvider();
  await provider.provider('The coding worker failed.');
  const strong = provider.getJournal().at(-1)!;
  assert.deepEqual(strong.selected, ['resident.handle-worker-failure', 'resident.prepare-handoff']);
  assert.equal(strong.selection_mode, 'strong');

  await provider.provider('Deploy it.');
  const authority = provider.getJournal().at(-1)!;
  assert.deepEqual(authority.selected, ['resident.request-approval']);
  assert.equal(authority.selection_mode, 'class');
  assert.equal(authority.operation_class, 'permission');

  await provider.provider('Tell me a bit about this workspace.');
  const weak = provider.getJournal().at(-1)!;
  assert.deepEqual(weak.selected, []);
  assert.equal(weak.selection_mode, 'none');

  await provider.provider('Where are we?');
  const status = provider.getJournal().at(-1)!;
  assert.deepEqual(status.selected, ['resident.report-status']);
  assert.equal(status.selection_mode, 'status-default');

  const capped = selectSopsDeterministically({
    fallback: false,
    candidates: [
      { id: 'resident.a', score: 9 }, { id: 'resident.b', score: 8 }, { id: 'resident.c', score: 7 }
    ] as never
  });
  assert.equal(capped.ids.length, 2);
});

test('block composition — constitution exactly once, resident-only bodies, no secrets', async () => {
  const provider = await enabledProvider();
  const block = await provider.provider('The coding worker failed.');
  assert.equal(block.split('[RESIDENT CONSTITUTION').length - 1, 1);
  assert.ok(block.includes('CANONICAL CONTINUITY'));
  assert.ok(block.includes('RESIDENT METHODOLOGY'));
  const headings = [...block.matchAll(/^#\s+(\S+)/gm)].map(match => match[1] as string);
  assert.ok(headings.length > 0);
  for (const heading of headings) assert.ok(heading.startsWith('resident.'), 'only resident.* SOP bodies may appear: ' + heading);
  assert.ok(!/sk-[A-Za-z0-9-]{8,}/.test(block));
  assert.ok(!/password\s*[:=]|secret\s*[:=]|token\s*[:=]/i.test(block));
  assert.ok(estimateTokens(block) <= 1000, 'typical live block must stay within the 1,000-token gate');
});

test('no-SOP is valid — methodology never forced, context still canonical', async () => {
  const provider = await enabledProvider();
  const block = await provider.provider('Tell me a bit about this workspace.');
  assert.ok(!block.includes('RESIDENT METHODOLOGY — selected'));
  assert.ok(block.includes('[RESIDENT CONSTITUTION'));
  assert.ok(block.includes('CANONICAL CONTINUITY'));
});

test('summary policy — conditional omits for status, always includes; details conditional', async () => {
  const conditional = await enabledProvider({ summaryPolicy: 'conditional' });
  const statusBlock = await conditional.provider('Where are we?');
  assert.ok(!statusBlock.includes('ARSENAL — compact summary'));
  assert.ok(!statusBlock.includes('CAPABILITY DETAILS'));
  assert.equal(needsCapabilityDetails('Where are we?'), false);

  const always = await enabledProvider({ summaryPolicy: 'always' });
  const statusAlways = await always.provider('Where are we?');
  assert.ok(statusAlways.includes('ARSENAL — compact summary'));

  const modelBlock = await conditional.provider('Which model should handle this?');
  assert.ok(modelBlock.includes('ARSENAL — compact summary'));
  assert.ok(modelBlock.includes('CAPABILITY DETAILS'));
  assert.deepEqual(capabilityFilterFor('Which model should handle this?'), { kind: 'MODEL', availability: 'READY' });
  const details = conditional.getJournal().at(-1)!.capability;
  assert.ok(details !== null && details.tokens <= 300, 'capability detail budget must hold');
  assert.ok(estimateTokens(modelBlock) <= 1000);
});

test('capability details — complete descriptors only, injected fields dropped, omitted counted', async () => {
  const provider = createResidentAwarenessProvider({
    workspace: REPO, repoRoot: REPO, enabled: true, projection: fixtureProjection(),
    continuity: CONTINUITY, taskAuthority: AUTHORITY, taskEvidence: EVIDENCE
  });
  const block = await provider.provider('Which model should handle this?');
  assert.ok(block.includes('model-a'));
  assert.ok(!block.includes('SENTINEL'), 'non-canonical descriptor fields must be dropped');
  const entry = provider.getJournal().at(-1)!;
  assert.equal(entry.capability!.selected, 2);
  assert.equal(entry.capability!.omitted, 0);
});

test('capability staleness — current truth only, no remembered availability', async () => {
  const stale = fixtureProjection();
  const first = createResidentAwarenessProvider({ workspace: REPO, repoRoot: REPO, enabled: true, projection: stale, continuity: CONTINUITY, taskAuthority: AUTHORITY, taskEvidence: EVIDENCE });
  const firstBlock = await first.provider('Which model should handle this?');
  assert.ok(firstBlock.includes('model-a'));
  const changed = fixtureProjection();
  (changed.descriptors[0] as Record<string, unknown>).availability = 'UNAVAILABLE';
  const second = createResidentAwarenessProvider({ workspace: REPO, repoRoot: REPO, enabled: true, projection: changed, continuity: CONTINUITY, taskAuthority: AUTHORITY, taskEvidence: EVIDENCE });
  const secondBlock = await second.provider('Which model should handle this?');
  assert.ok(!secondBlock.includes('model-a'), 'a newly unavailable model must not survive in the block');
  assert.ok(secondBlock.includes('model-b'));
});

test('failure paths — no candidates, body unavailable, projection unavailable, envelope budget', async () => {
  const provider = await enabledProvider();
  const none = await provider.provider('xyzzy plugh quux');
  assert.ok(none.includes('[RESIDENT CONSTITUTION'));
  assert.ok(!none.includes('RESIDENT METHODOLOGY — selected'));

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-live-awareness-'));
  try {
    await fs.mkdir(path.join(root, 'skills', 'resident-sops'), { recursive: true });
    await fs.writeFile(path.join(root, 'skills', 'resident-sops', 'constitution.md'), '[RESIDENT CONSTITUTION — system-owned]\nTest constitution.', 'utf8');
    await fs.writeFile(path.join(root, 'skills', 'resident-sops', 'catalog.json'), JSON.stringify({
      schema_version: '1', namespace: 'resident', sops: [{
        id: 'resident.fixture-sop', role: 'resident', purpose: 'fixture', use_when: ['worker failed', 'fixture trigger'],
        requires: [], produces: 'x', authority_effect: 'none', body_ref: 'skills/resident-sops/resident.fixture-sop.md'
      }]
    }), 'utf8');
    const fixture = createResidentAwarenessProvider({
      workspace: root, repoRoot: root, enabled: true, projection: fixtureProjection(),
      continuity: CONTINUITY, taskAuthority: AUTHORITY, taskEvidence: EVIDENCE
    });
    const degraded = await fixture.provider('worker failed fixture trigger');
    const entry = fixture.getJournal().at(-1)!;
    assert.equal(entry.degraded, true);
    assert.ok(degraded.includes('[RESIDENT CONSTITUTION'), 'block remains valid with the body omitted');
    assert.ok(!degraded.includes('RESIDENT METHODOLOGY — selected'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }

  const noProjection = createResidentAwarenessProvider({
    workspace: REPO, repoRoot: REPO, enabled: true,
    projectionLoader: async () => { throw new Error('projection offline'); },
    continuity: CONTINUITY, taskAuthority: AUTHORITY, taskEvidence: EVIDENCE
  });
  const withoutSummary = await noProjection.provider('Which model should handle this?');
  assert.equal(noProjection.getJournal().at(-1)!.degraded, true);
  assert.ok(withoutSummary.includes('[RESIDENT CONSTITUTION'));

  const overflow = await enabledProvider({ continuity: 'continuity pressure line '.repeat(400) });
  assert.equal(await overflow.provider('Where are we?'), '');
  assert.equal(overflow.getJournal().at(-1)!.degraded, true);
});

test('composer integration — awareness block injected; disabled path is byte-identical rollback', async () => {
  const provider = await enabledProvider();
  const enabled = await composeWith({ awareness: provider.provider }, 'The coding worker failed.');
  const text = enabled.messages.map(message => message.content).join('\n');
  assert.ok(text.includes('[RESIDENT AWARENESS]'));
  assert.ok(text.includes('[RESIDENT CONSTITUTION'));
  assert.ok((enabled.harness as Record<string, unknown>).awareness_present === true);
  assert.ok(((enabled.harness as Record<string, unknown>).awareness_tokens as number) > 0);

  const baseline = await composeWith({}, 'The coding worker failed.');
  const off = createResidentAwarenessProvider({ workspace: REPO, repoRoot: REPO, enabled: false });
  const disabled = await composeWith({ awareness: off.provider }, 'The coding worker failed.');
  assert.deepEqual(disabled.messages, baseline.messages, 'disabled awareness must not change the composed context');
  assert.equal((disabled.harness as Record<string, unknown>).awareness_present, false);
});

test('wiring static check — gate is provider-owned and default-ON with explicit disable; openapi wires it', async () => {
  const providerSource = await fs.readFile(path.join(REPO, 'node', 'src', 'services', 'resident-awareness-provider.mjs'), 'utf8');
  assert.ok(providerSource.includes(AWARENESS_ENV_FLAG));
  assert.ok(providerSource.includes("!== '0'"), 'gate must disable only on an explicit 0');
  const openapiSource = await fs.readFile(path.join(REPO, 'node', 'src', 'openapi.ts'), 'utf8');
  assert.ok(openapiSource.includes('createResidentAwarenessProvider'));
  assert.ok(openapiSource.includes('awarenessProvider.enabled'));
});

test('classifyTask — deterministic journal classes', () => {
  assert.equal(classifyTask('Where are we?'), 'status');
  assert.equal(classifyTask('Continue Covert.'), 'resume');
  assert.equal(classifyTask('The coding worker failed.'), 'worker-failure');
  assert.equal(classifyTask('Did this actually pass?'), 'evidence');
  assert.equal(classifyTask('Deploy it now.'), 'authority');
  assert.equal(classifyTask('hello there'), 'other');
});
