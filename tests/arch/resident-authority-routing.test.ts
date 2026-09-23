// Resident Awareness Layer — Slice 5 acceptance tests.
// Authority-routing calibration: canonical operation classes from
// common/security/operation-policy.mjs + the SOP authority_effect field,
// directive-gated class selection at the retrieval floor, positive/negative
// authority battery, over-routing guard, and the end-to-end provider path.
//
// Hermetic: no engine, no inference.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createResidentAwarenessProvider,
  selectSopsDeterministically,
  operationClassFor,
  isOperationDirective,
  canonicalAuthorityOperationKinds,
  AUTHORITY_CLASS_BY_EFFECT,
  AUTHORITY_OPERATION_RISKS
} from '../../node/src/services/resident-awareness-provider.mjs';
import { discoverResidentSops, loadResidentCatalog } from '../../node/src/services/resident-sops.mjs';
import { OPERATION_POLICY } from '../../common/security/operation-policy.mjs';
import { estimateTokens } from '../../node/src/services/history-fit.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROJECTION_FILE = path.join(REPO, 'experiments', 'resident-awareness', 'results', 'arsenal-projection.json');

const POSITIVES = ['Deploy it now.', 'Push it to main.', 'Install it.', 'Publish it.', 'Execute the migration.', 'Do a destructive cleanup.'];
const NEGATIVES = ['Explain deployment.', 'Why did deployment fail?', 'Show the deployment workflow.', 'Summarize the deployment history.'];
const AUTHORITY_SOPS = ['resident.request-approval', 'resident.explain-authority'];

async function selectionFor(request: string) {
  const discovery = await discoverResidentSops(request, { root: REPO });
  return { discovery, selection: selectSopsDeterministically(discovery) };
}

test('canonical mapping — classes derive from the operation-policy taxonomy', () => {
  const canonicalRisks = new Set<string>(Object.values(OPERATION_POLICY) as string[]);
  for (const [effect, operationClass] of Object.entries(AUTHORITY_CLASS_BY_EFFECT)) {
    assert.ok(typeof effect === 'string');
    if (operationClass !== 'evidence') assert.ok(canonicalRisks.has(operationClass), effect + ' -> ' + operationClass + ' must be a canonical risk');
  }
  const kinds = canonicalAuthorityOperationKinds();
  assert.ok(kinds.length > 0, 'the canonical taxonomy must expose authority-relevant operation kinds');
  for (const kind of kinds) assert.ok(AUTHORITY_OPERATION_RISKS.includes(OPERATION_POLICY[kind] as string));
  assert.equal(operationClassFor({ authority_effect: 'may-request-approval' }), 'permission');
  assert.equal(operationClassFor({ authority_effect: 'requires-evidence-state' }), 'evidence');
  assert.equal(operationClassFor({ authority_effect: 'none' }), null);
  assert.equal(operationClassFor(null), null);
});

test('directive detector — positive and negative forms', () => {
  for (const request of POSITIVES) assert.equal(isOperationDirective(request), true, request);
  for (const request of NEGATIVES) assert.equal(isOperationDirective(request), false, request);
  assert.equal(isOperationDirective('Tell me a bit about this workspace.'), false);
  assert.equal(isOperationDirective('Where are we?'), false);
  assert.equal(isOperationDirective('The coding worker failed.'), false);
  assert.equal(isOperationDirective('I want to build a new Android app.'), false);
  assert.equal(isOperationDirective('Can Covert build and install an Android package?'), false);
});

test('positive authority cases — request-approval is selected (strong or class)', async () => {
  for (const request of POSITIVES) {
    const { selection } = await selectionFor(request);
    assert.ok(selection.ids.includes('resident.request-approval'), request + ' -> ' + JSON.stringify(selection));
    assert.ok(['strong', 'strong+class', 'class'].includes(selection.mode), request + ' mode ' + selection.mode);
    if (selection.mode.includes('class')) assert.equal(selection.operation_class, 'permission', request);
  }
});

test('negative authority cases — no authority methodology loads', async () => {
  for (const request of NEGATIVES) {
    const { selection } = await selectionFor(request);
    for (const id of selection.ids) assert.ok(!AUTHORITY_SOPS.includes(id), request + ' must not load authority methodology; got ' + JSON.stringify(selection));
    assert.equal(selection.mode, 'none', request + ' -> ' + JSON.stringify(selection));
  }
});

test('over-routing guard — non-directive retrieval never uses the class pass', async () => {
  const { discovery, selection } = await selectionFor('Tell me a bit about this workspace.');
  assert.ok(discovery.candidates.some(candidate => candidate.id === 'resident.onboard-user'), 'retrieval fixture must expose a class-relevant candidate');
  assert.deepEqual(selection.ids, []);
  assert.equal(selection.mode, 'none');
});

test('class cap — the ≤2 selection invariant holds with the class pass', () => {
  const selection = selectSopsDeterministically({
    request: 'Deploy it now.',
    fallback: false,
    candidates: [
      { id: 'resident.request-approval', score: 2.5, authority_effect: 'may-request-approval' },
      { id: 'resident.local-vs-cloud', score: 2.5, authority_effect: 'requires-authority-state' },
      { id: 'resident.interpret-evidence', score: 2.5, authority_effect: 'requires-evidence-state' }
    ]
  } as never);
  assert.equal(selection.ids.length, 2);
  assert.equal(selection.operation_class, 'permission');
});

test('end-to-end provider — authority directive loads the request-approval body', async () => {
  const projection = JSON.parse(await fs.readFile(PROJECTION_FILE, 'utf8'));
  const provider = createResidentAwarenessProvider({
    workspace: REPO, repoRoot: REPO, enabled: true, projection,
    continuity: '[CANONICAL CONTINUITY — system-owned; UNKNOWN means unavailable]\nstage: REVIEW',
    taskAuthority: 'authority: no approval recorded for push/deploy operations',
    taskEvidence: 'evidence: ABSENT (no verification record)'
  });
  const block = await provider.provider('Deploy it now.');
  const entry = provider.getJournal().at(-1)!;
  assert.deepEqual(entry.selected, ['resident.request-approval']);
  assert.equal(entry.selection_mode, 'class');
  assert.equal(entry.operation_class, 'permission');
  assert.ok(block.includes('RESIDENT METHODOLOGY — selected'));
  assert.ok(block.includes('# resident.request-approval'));
  assert.ok(estimateTokens(block) <= 1000);
});

test('catalog revision — calibrated authority trigger coverage', async () => {
  const catalog = await loadResidentCatalog({ root: REPO });
  assert.equal((catalog as { catalog_revision?: string }).catalog_revision, '5');
  const approval = catalog.sops.find(sop => sop.id === 'resident.request-approval');
  assert.ok(approval);
  for (const trigger of ['install it', 'publish it', 'execute migration', 'destructive cleanup']) {
    assert.ok(approval!.use_when.includes(trigger), 'missing calibrated trigger: ' + trigger);
  }
  for (const request of POSITIVES) {
    const discovery = await discoverResidentSops(request, { root: REPO });
    assert.ok(discovery.candidates.some(candidate => candidate.id === 'resident.request-approval'), request + ' must retrieve request-approval');
  }
});
