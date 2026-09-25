import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWorktreePreflight } from '../../scripts/worktree-preflight.mjs';

const clean = {
  status: '',
  branch: 'resident/marathon-h1-resume',
  head: '323fdb3ae800996e19eecc6fd53b3d88bdf4a2bf',
  expectedBranch: 'resident/marathon-h1-resume',
  expectedHead: '323fdb3ae800996e19eecc6fd53b3d88bdf4a2bf'
};

test('qualification worktree preflight accepts only the expected clean revision', () => {
  assert.deepEqual(evaluateWorktreePreflight(clean), { ok: true, findings: [] });
  assert.match(evaluateWorktreePreflight({ ...clean, status: '?? untracked-output.json' }).findings[0]!, /dirty/);
  assert.match(evaluateWorktreePreflight({ ...clean, branch: 'resident/marathon-h1' }).findings[0]!, /branch mismatch/);
  assert.match(evaluateWorktreePreflight({ ...clean, head: 'f5ae9b930b68923f1c364743a3ccfff82e5819ce' }).findings[0]!, /HEAD mismatch/);
  assert.match(evaluateWorktreePreflight({ ...clean, branch: '' }).findings[0]!, /detached/);
});

test('expected branch and checkpoint are optional for the existing CI clean-tree check', () => {
  assert.deepEqual(evaluateWorktreePreflight({ status: '', branch: 'ci', head: 'a'.repeat(40) }), { ok: true, findings: [] });
});
