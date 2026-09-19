// Tests for memory-recall.mjs (Gap #4: auto-memory)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { promises as fsp } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { createMemoryRecall } from '../../node/src/services/memory-recall.mjs';

let dir: string = '';

beforeEach(async function() {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-mem-'));
});

afterEach(async function() {
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
});

function makeEntry(i: number, opts: any = {}): any {
  return {
    session_id: 's' + i,
    ts: '2026-08-29T0' + (i % 10) + ':00:00Z',
    intent: opts.intent || 'fix chat crash',
    summary: opts.summary || 'investigated cipher engine crash',
    skills_invoked: opts.skills_invoked || ['aide-engine-lifecycle-doctrine'],
    files_touched: opts.files_touched || ['daemon/model-manager.mjs'],
    outcome: opts.outcome || 'resolved'
  };
}

test('recall returns empty list when no memories exist', async function() {
  const r = createMemoryRecall({ workspace: dir });
  const out = await r.recall('something');
  assert.equal(out.hits.length, 0);
  assert.equal(out.degraded, true);
  assert.match(out.reason!, /no memories/);
});

test('recall scores by token overlap and returns ranked hits', async function() {
  const r = createMemoryRecall({ workspace: dir });
  await r.remember(makeEntry(1, { intent: 'cipher engine crash', summary: 'cipher crash on vulkan' }));
  await r.remember(makeEntry(2, { intent: 'desktop action grammar', summary: 'added <desktop_action> parser' }));
  await r.remember(makeEntry(3, { intent: 'telegram bot connect', summary: 'connected @AIDECYPHER_bot' }));

  const out = await r.recall('cipher engine crash on vulkan');
  assert.equal(out.degraded, false);
  assert.ok(out.hits.length >= 1, 'should return at least one hit');
  assert.equal(out.hits[0]!.session_id, 's1', 'most relevant should be s1');
  assert.ok(out.hits[0]!.score > 0);
});

test('skills and file paths get field-weighted bonus over prose', async function() {
  const r = createMemoryRecall({ workspace: dir });
  await r.remember(makeEntry(1, { intent: 'fix things', summary: 'general maintenance', skills_invoked: ['unrelated-skill'] }));
  await r.remember(makeEntry(2, { intent: 'fix things', summary: 'general maintenance', skills_invoked: ['aide-engine-lifecycle-doctrine'], files_touched: ['daemon/model-manager.mjs'] }));

  const out = await r.recall('aide-engine-lifecycle-doctrine daemon/model-manager.mjs');
  assert.equal(out.hits[0]!.session_id, 's2', 'weighted fields should rank s2 first');
});

test('budget cap stops at ~800 tokens', async function() {
  const r = createMemoryRecall({ workspace: dir });
  // Add 20 memories that all match, so the budget cap has to trim
  for (let i = 0; i < 20; i++) {
    await r.remember(makeEntry(i, { intent: 'chat crash', summary: 'x'.repeat(500) }));
  }
  const out = await r.recall('chat crash');
  assert.ok(out.hits.length <= 20);
  assert.ok(out.approxTokens <= 800 + 50, 'approxTokens near budget, with small slack');
});

test('status reports count and last ts', async function() {
  const r = createMemoryRecall({ workspace: dir });
  let s = await r.status();
  assert.equal(s.count, 0);
  assert.equal(s.lastTs, null);
  await r.remember(makeEntry(1));
  s = await r.status();
  assert.equal(s.count, 1);
  assert.equal(s.lastTs, '2026-08-29T01:00:00Z');
});

test('malformed lines are skipped, valid ones still load', async function() {
  const r = createMemoryRecall({ workspace: dir });
  const memFile = path.join(dir, '.aide', 'memory', 'sessions.jsonl');
  await fsp.mkdir(path.dirname(memFile), { recursive: true });
  await fsp.writeFile(memFile,
    JSON.stringify(makeEntry(1)) + '\n' +
    'this is not json\n' +
    JSON.stringify(makeEntry(2)) + '\n'
  );
  const out = await r.recall('cipher engine crash');
  assert.equal(out.hits.length, 2, 'both valid entries should load; the malformed line should be skipped');
});

test('remember rejects entries missing required fields', async function() {
  const r = createMemoryRecall({ workspace: dir });
  await assert.rejects(function() { return r.remember({}); });
  await assert.rejects(function() { return r.remember({ session_id: 's1' }); });
});

test('memory is workspace-scoped, survives a new service instance, and excludes secrets', async function() {
  const other = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-mem-other-'));
  try {
    const first = createMemoryRecall({ workspace: dir });
    await first.remember({
      session_id: 'workspace-a',
      ts: '2026-09-17T10:00:00Z',
      intent: 'remember the editor preference',
      summary: 'Use the compact editor layout.',
      outcome: 'api_key=sk-test-should-not-persist Bearer bearer-secret-value'
    });
    const raw = await fsp.readFile(path.join(dir, '.aide', 'memory', 'sessions.jsonl'), 'utf8');
    assert.ok(!raw.includes('sk-test-should-not-persist'));
    assert.ok(!raw.includes('bearer-secret-value'));
    assert.match(raw, /REDACTED/);

    const restarted = createMemoryRecall({ workspace: dir });
    const recalled = await restarted.recall('compact editor layout');
    assert.equal(recalled.hits[0]?.session_id, 'workspace-a');
    const otherResult = await createMemoryRecall({ workspace: other }).recall('compact editor layout');
    assert.equal(otherResult.hits.length, 0);
    await assert.rejects(() => first.remember({ session_id: 'global', ts: '2026-09-17T11:00:00Z', scope: 'global' }));
  } finally {
    await fsp.rm(other, { recursive: true, force: true });
  }
});

test('newer validated facts supersede stale facts and failed reads are degraded', async function() {
  const r = createMemoryRecall({ workspace: dir });
  await r.remember({ session_id: 'old-pref', ts: '2026-09-17T10:00:00Z', fact_key: 'editor.theme', intent: 'editor preference', summary: 'Use light theme.' });
  await r.remember({ session_id: 'new-pref', ts: '2026-09-17T11:00:00Z', fact_key: 'editor.theme', intent: 'editor preference', summary: 'Use dark theme.' });
  const out = await r.recall('editor theme');
  assert.deepEqual(out.hits.map(hit => hit.session_id), ['new-pref']);

  const broken = path.join(dir, '.aide', 'memory', 'sessions.jsonl');
  await fsp.rm(broken, { force: true });
  await fsp.mkdir(broken, { recursive: true });
  const degraded = await r.recall('editor theme');
  assert.equal(degraded.degraded, true);
  assert.match(degraded.reason!, /storage read failed/);
});

test('newest entries remain visible and older entries remain retrievable beyond 500 entries', async function() {
  const windowDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-mem-window-'));
  try {
    const memFile = path.join(windowDir, '.aide', 'memory', 'sessions.jsonl');
    await fsp.mkdir(path.dirname(memFile), { recursive: true });
    const lines: string[] = [];
    lines.push(JSON.stringify(makeEntry(1, { intent: 'filler entry', summary: 'routine maintenance note' })));
    lines.push(JSON.stringify(makeEntry(2, { intent: 'zebra migration planning', summary: 'zebra-migration-unique completed for the legacy store' })));
    for (let i = 3; i <= 600; i++) lines.push(JSON.stringify(makeEntry(i, { intent: 'filler entry', summary: 'routine maintenance note' })));
    lines.push(JSON.stringify(makeEntry(601, { intent: 'quasar deployment task', summary: 'quasar-deploy-unique landed in the release lane' })));
    await fsp.writeFile(memFile, lines.join('\n') + '\n', 'utf8');

    const r = createMemoryRecall({ workspace: windowDir });
    const newest = await r.recall('quasar deployment release lane');
    assert.ok(newest.hits.some(hit => hit.session_id === 's601'), 'the newest entry beyond the old 500-entry window must be retrievable');
    const older = await r.recall('zebra migration legacy store');
    assert.ok(older.hits.some(hit => hit.session_id === 's2'), 'an older useful entry must remain retrievable when relevant');
    assert.ok(older.hits.length <= 5, 'hits stay bounded by topN');
    const stat = await r.status();
    assert.equal(stat.count, 601, 'status reports the honest journal total, not a window');
    assert.equal(stat.lastTs, makeEntry(601).ts, 'status lastTs is the true newest ts');
  } finally {
    await fsp.rm(windowDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('supersession resolves across the whole journal beyond the first window', async function() {
  const superDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-mem-supersede-window-'));
  try {
    const memFile = path.join(superDir, '.aide', 'memory', 'sessions.jsonl');
    await fsp.mkdir(path.dirname(memFile), { recursive: true });
    const lines: string[] = [];
    lines.push(JSON.stringify(makeEntry(1, { intent: 'filler entry', summary: 'routine maintenance note' })));
    lines.push(JSON.stringify({ session_id: 's-old', ts: '2026-09-17T01:00:00Z', fact_key: 'editor.theme', intent: 'editor preference', summary: 'Use light theme.' }));
    lines.push(JSON.stringify({ session_id: 's-target', ts: '2026-09-17T02:00:00Z', intent: 'harbor retire flag', summary: 'harbor-retire-flag tracked for removal' }));
    for (let i = 4; i <= 600; i++) lines.push(JSON.stringify(makeEntry(i, { intent: 'filler entry', summary: 'routine maintenance note' })));
    lines.push(JSON.stringify({ session_id: 's-new', ts: '2026-09-18T01:00:00Z', fact_key: 'editor.theme', intent: 'editor preference', summary: 'Use dark theme.' }));
    lines.push(JSON.stringify({ session_id: 's-claimer', ts: '2026-09-18T02:00:00Z', supersedes: ['s-target'], intent: 'harbor retire flag', summary: 'harbor-retire-flag completed and closed' }));
    await fsp.writeFile(memFile, lines.join('\n') + '\n', 'utf8');

    const r = createMemoryRecall({ workspace: superDir });
    const theme = await r.recall('editor theme preference');
    assert.deepEqual(theme.hits.map(hit => hit.session_id), ['s-new'], 'the validated newer fact must win and the stale fact must not be injected');

    const harbor = await r.recall('harbor retire flag completed');
    assert.ok(harbor.hits.some(hit => hit.session_id === 's-claimer'), 'the superseding entry remains active');
    assert.ok(!harbor.hits.some(hit => hit.session_id === 's-target'), 'an explicitly superseded entry is never injected');
  } finally {
    await fsp.rm(superDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('secret-shaped memory values never persist and never surface', async function() {
  const secretDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-mem-secrets-'));
  try {
    const r = createMemoryRecall({ workspace: secretDir });
    const memFile = path.join(secretDir, '.aide', 'memory', 'sessions.jsonl');
    const fixtures = [
      'AKIA' + 'IOSFODNN7EXAMPLE',
      'ghp_' + 'abcdefghijklmnopqrstuvwxyz123456',
      'glpat-' + 'abcdefghijklmnopqrst',
      'xoxp-' + '123456789012-abcdefabcdefabcdef',
      'Bearer ' + 'tkn-secret-abcdef123456',
      'authorization: Bearer ' + 'zzzz-secret-token-0001',
      'aws_secret_access_key = ' + 'wJalrXUtnFEMI/K7MDENG/' + 'bPxRfiCYEXAMPLEKEY',
      '-----BEGIN ' + 'RSA PRIVATE KEY' + '-----\nMIIEowIBAAKCAQEA' + '7Xk9\n-----END ' + 'RSA PRIVATE KEY' + '-----',
      'token: ' + 'prod-token-abcdef'
    ];
    for (let index = 0; index < fixtures.length; index++) {
      await r.remember({
        session_id: 'sec-' + index,
        ts: '2026-09-18T0' + (index % 10) + ':00:00Z',
        intent: 'aurora credential probe ' + index,
        summary: fixtures[index]!
      });
    }
    const raw = await fsp.readFile(memFile, 'utf8');
    for (const fixture of fixtures) assert.ok(!raw.includes(fixture), 'raw secret material must never persist: ' + fixture.slice(0, 12));
    assert.match(raw, /\[REDACTED\]/, 'redaction marker is present in the durable journal');

    const out = await r.recall('aurora credential probe');
    assert.ok(out.hits.length >= 1, 'redacted entries remain ordinary memory');
    for (const hit of out.hits) {
      const text = JSON.stringify(hit);
      for (const fixture of fixtures) assert.ok(!text.includes(fixture), 'raw secret material must never surface in recall');
    }
  } finally {
    await fsp.rm(secretDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('recall stays bounded and survives a real process restart', async function() {
  const restartDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aide-mem-restart-'));
  try {
    const r = createMemoryRecall({ workspace: restartDir });
    for (let index = 0; index < 30; index++) {
      await r.remember(makeEntry(index, { intent: 'chat crash', summary: 'x'.repeat(500) }));
    }
    await r.remember({ session_id: 'restart-anchor', ts: '2026-09-18T23:00:00Z', intent: 'compact editor layout', summary: 'Use the compact editor layout.' });

    const bounded = await r.recall('chat crash');
    assert.ok(bounded.hits.length <= 5, 'topN bounds the hit count');
    assert.ok((bounded.approxTokens ?? 0) <= 800 + 50, 'token budget bounds the payload');

    const moduleUrl = pathToFileURL(path.resolve('node/src/services/memory-recall.mjs')).href;
    const script = [
      'import { createMemoryRecall } from ' + JSON.stringify(moduleUrl) + ';',
      'const recall = createMemoryRecall({ workspace: process.argv[1] });',
      'const out = await recall.recall("compact editor layout");',
      'console.log(JSON.stringify(out.hits.map(hit => hit.session_id)));'
    ].join('\n');
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script, restartDir], { encoding: 'utf8', timeout: 60000 });
    assert.equal(child.status, 0, 'restart child exits cleanly: ' + (child.stderr ?? ''));
    assert.match(child.stdout, /restart-anchor/, 'a fresh process reads the persisted memory');
  } finally {
    await fsp.rm(restartDir, { recursive: true, force: true }).catch(() => {});
  }
});
