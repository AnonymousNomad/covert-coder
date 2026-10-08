import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeGguf } from '../../node/src/services/gguf.ts';

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function u64(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function ggufString(value) {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([u64(bytes.length), bytes]);
}

function stringArray(key, values) {
  return Buffer.concat([
    ggufString(key),
    u32(9),
    u32(8),
    u64(values.length),
    ...values.map(ggufString)
  ]);
}

test('GGUF string-array metadata keeps the buffered read window', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-gguf-buffer-'));
  t.after(async () => fs.rm(root, { recursive: true, force: true }));

  const tokens = Array.from({ length: 128 }, (_, index) => `<|fixture_${index}|>`);
  const entries = [
    Buffer.concat([ggufString('general.architecture'), u32(8), ggufString('lfm2')]),
    stringArray('tokenizer.ggml.tokens', tokens),
    Buffer.concat([ggufString('lfm2.context_length'), u32(4), u32(131072)]),
    Buffer.concat([ggufString('tokenizer.chat_template'), u32(8), ggufString('{{ messages }}')])
  ];
  const fixture = path.join(root, 'buffered-metadata.gguf');
  await fs.writeFile(fixture, Buffer.concat([
    Buffer.from('GGUF'), u32(3), u64(0), u64(entries.length), ...entries, Buffer.alloc(64)
  ]));

  const originalOpen = fs.open;
  let reads = 0;
  fs.open = async (...args) => {
    const handle = await originalOpen(...args);
    const read = handle.read.bind(handle);
    handle.read = async (...readArgs) => {
      reads += 1;
      return read(...readArgs);
    };
    return handle;
  };

  let info;
  try {
    info = await probeGguf(fixture);
  } finally {
    fs.open = originalOpen;
  }

  assert.equal(info.architecture, 'lfm2');
  assert.equal(info.contextLength, 131072);
  assert.equal(info.chatTemplate, '{{ messages }}');
  assert.ok(reads <= 8, `expected buffered metadata reads, observed ${reads}`);
});
