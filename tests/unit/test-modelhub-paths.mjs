// Regression: Hugging Face resolve URLs must preserve repository-relative path
// separators for nested artifacts (the contract's HubFilename explicitly
// allows safe multi-segment paths).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeArtifactPath } from '../../node/src/services/modelhub.mjs';

test('flat artifact names are encoded as a single segment', () => {
  assert.equal(encodeArtifactPath('model.gguf'), 'model.gguf');
  assert.equal(encodeArtifactPath('SmolLM2-360M-Instruct-Q8_0.gguf'), 'SmolLM2-360M-Instruct-Q8_0.gguf');
});

test('nested artifact names keep separators instead of %2F', () => {
  assert.equal(encodeArtifactPath('Q4_K_M/model.gguf'), 'Q4_K_M/model.gguf');
  assert.equal(encodeArtifactPath('quants/Q8_0/sub/model.gguf'), 'quants/Q8_0/sub/model.gguf');
  assert.equal(encodeArtifactPath('Q4_K_M/model.gguf').includes('%2F'), false);
});

test('per-segment special characters are encoded without breaking structure', () => {
  assert.equal(encodeArtifactPath('my models/model v2.gguf'), 'my%20models/model%20v2.gguf');
  assert.equal(encodeArtifactPath('dir with space/файл.gguf'), 'dir%20with%20space/%D1%84%D0%B0%D0%B9%D0%BB.gguf');
  assert.equal(encodeArtifactPath('a/b#c.gguf'), 'a/b%23c.gguf');
});
