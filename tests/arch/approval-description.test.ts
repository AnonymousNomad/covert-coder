import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalDescription } from '../../browser/src/ui/approval-description.ts';

test('approval presentation redacts credentials without changing exact operation arguments', () => {
  const operation = { operation: 'capability.write', arguments: { provider: 'local-test', key: 'fixture-secret', nested: [{ api_key: 'fixture-key', path: 'settings.json' }], tokenBudget: 100 } };
  const before = JSON.stringify(operation);
  const rendered = approvalDescription(operation);
  assert.doesNotMatch(rendered, /fixture-secret|fixture-key/);
  assert.match(rendered, /local-test|settings.json/);
  assert.match(rendered, /"tokenBudget": 100/);
  assert.equal(JSON.stringify(operation), before);
});
