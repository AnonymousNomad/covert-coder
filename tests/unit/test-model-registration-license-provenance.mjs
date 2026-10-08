import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ModelRuntime } from '../../node/src/services/model-runtime.ts';

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
  return Buffer.concat([u64(Buffer.byteLength(value)), Buffer.from(value, 'utf8')]);
}

function verifiedGguf() {
  const key = ggufString('general.architecture');
  const value = ggufString('llama');
  return Buffer.concat([Buffer.from('GGUF'), u32(3), u64(0), u64(1), key, u32(8), value, Buffer.alloc(32)]);
}

test('ModelRuntime registration persists the repository license label beside the manifest license', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'covert-model-registration-provenance-'));
  try {
    const modelDir = path.join(workspace, 'models');
    const ingestedPath = path.join(workspace, '.aide', 'ingested-models.json');
    const manifestPath = path.join(modelDir, 'manifest.json');
    const filename = 'pinned-license.gguf';
    const bytes = verifiedGguf();
    const digest = createHash('sha256').update(bytes).digest('hex');
    await fs.mkdir(modelDir, { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify({ models: [] }), 'utf8');
    await fs.writeFile(path.join(modelDir, filename), bytes);
    await fs.writeFile(path.join(modelDir, `${filename}.manifest.json`), JSON.stringify({
      repo_id: 'LiquidAI/LFM2.5-2.6B-GGUF',
      filename,
      revision: 'e7caca5d835a3901a8e0d63e94009429bafafdfc',
      quant_label: 'Q4_K_M',
      size_bytes: bytes.length,
      architecture: 'llama',
      expected_sha256: digest,
      sha256: digest,
      license: 'other',
      repository_license: 'lfm1.0',
      downloaded_at: '2026-10-08T00:00:00.000Z',
      source: 'hf',
      status: 'ready'
    }), 'utf8');

    const runtime = new ModelRuntime({ workspace, modelDir, manifestPath, ingestedPath });
    await runtime.load({ sweepLegacyEngines: false });
    await runtime.register({ filename, repo_id: 'LiquidAI/LFM2.5-2.6B-GGUF' });

    const persisted = JSON.parse(await fs.readFile(ingestedPath, 'utf8'));
    const registered = persisted.find(entry => entry.id === 'pinned-license');
    assert.ok(registered);
    assert.equal(registered.sha256, digest);
    assert.equal(registered.license, 'other');
    assert.equal(registered.repository_license, 'lfm1.0');

    const recovered = new ModelRuntime({ workspace, modelDir, manifestPath, ingestedPath });
    await recovered.load({ sweepLegacyEngines: false });
    assert.equal(recovered.get('pinned-license')?.repository_license, 'lfm1.0');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
