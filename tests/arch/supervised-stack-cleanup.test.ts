import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runStartupFixture } from './supervised-stack-startup-fixture.mjs';

async function runFixture(mode: 'pairing-error' | 'success'): Promise<Record<string, unknown>> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-supervised-startup-'));
  let report: Record<string, unknown> | undefined;
  try {
    // Node isolates this test file in its own process. Keep native child
    // handles here rather than giving an extra fixture process ownership.
    report = await runStartupFixture(mode, workspace);
    assert.equal(report.fixtureCleanupConfirmed, true, 'fixture must confirm cleanup before its workspace is removed');
    return report;
  } finally {
    assert.equal(path.dirname(path.resolve(workspace)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(workspace).startsWith('covert-supervised-startup-'));
    if (report?.fixtureCleanupConfirmed === true) await fs.rm(workspace, { recursive: true, force: true });
  }
}

test('failed supervised pairing rolls back real facade and children before preserving the rejection', { timeout: 90_000, concurrency: false }, async () => {
  const report = await runFixture('pairing-error');
  console.log(JSON.stringify(report));
  assert.equal(report.healthSucceeded, true);
  assert.equal(report.childCount, 2);
  assert.equal(report.startupRejected, true);
  assert.equal(report.originalErrorPreserved, true);
  assert.equal(report.childrenExited, true, 'startup rejected while its owned children were still alive');
  assert.equal(report.facadeUnreachable, true, 'startup rejected while its facade still accepted requests');
  assert.equal(report.emergencyCleanupNeeded, false);
});

test('fresh supervised stack serves an authorized read and concurrent close shares one cleanup result', { timeout: 90_000, concurrency: false }, async () => {
  const report = await runFixture('success');
  console.log(JSON.stringify(report));
  assert.equal(report.healthSucceeded, true);
  assert.equal(report.childCount, 2);
  assert.equal(report.startupRejected, false);
  assert.equal(report.requestStatus, 200);
  assert.equal(report.closeErrorCount, 0);
  assert.equal(report.sharedClosePromise, true);
  assert.equal(report.childrenExited, true);
  assert.equal(report.facadeUnreachable, true);
  assert.equal(report.emergencyCleanupNeeded, false);
});
