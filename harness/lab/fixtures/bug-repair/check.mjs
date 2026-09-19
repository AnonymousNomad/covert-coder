// Objective verifier for the bug-repair benchmark task. The candidate module
// returned by the model is written next to this file as stats.mjs and this
// script is executed with plain `node check.mjs`; exit 0 means the candidate
// passes every fixture expectation.
import assert from 'node:assert/strict';
import { average, max } from './stats.mjs';

assert.equal(average([2, 4, 6]), 4);
assert.equal(average([10]), 10);
assert.equal(average([0, 0, 0]), 0);
assert.equal(max([3, 9, 4]), 9);
console.log('check-ok');
