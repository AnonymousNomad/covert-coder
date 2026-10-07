import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrivatePlatformStatePath } from '../../common/security/private-platform-state.mjs';

test('Windows platform record aliases including default alternate streams stay private', () => {
  for (const target of [
    '.aide/platform-projects/catalog.json', '.AIDE/PLATFORM-PROJECTS /catalog.json',
    '.aide/platform-projects-enrollment.json', '.AIDE/PLATFORM-PROJECTS-ENROLLMENT.JSON.',
    '.aide/platform-projects-enrollment.json::$DATA', '.aide/platform-projects-enrollment.json:notes',
    '.aide/cipher-laptop::$DATA/ledger.json'
  ]) assert.equal(isPrivatePlatformStatePath(target, 'win32'), true, target);
  assert.equal(isPrivatePlatformStatePath('src/project.ts', 'win32'), false);
  assert.equal(isPrivatePlatformStatePath('.aide/platform-projects-public.json', 'win32'), false);
  assert.equal(isPrivatePlatformStatePath('.aide/platform-projects-enrollment.json:notes', 'linux'), false);
});
