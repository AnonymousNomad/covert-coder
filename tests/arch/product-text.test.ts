import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productText } from '../../browser/src/ui/product-text.ts';

test('product-owned legacy prose uses the public identity without changing identifiers', () => {
  assert.equal(productText('AIDE found two models.'), 'Covert Coder found two models.');
  assert.equal(productText('AIDE Sovereign Workbench configuration'), 'Covert Coder configuration');
  assert.equal(productText('X-AIDE-API-Format'), 'X-AIDE-API-Format');
  assert.equal(productText('Already Covert Coder'), 'Already Covert Coder');
});
