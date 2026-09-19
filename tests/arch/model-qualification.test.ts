// tests/arch/model-qualification.test.ts
// Qualification is orthogonal to readiness: a served endpoint can still be an
// unusable configuration. These tests pin the classification, the persistence
// of failed configurations (history is evidence), identity separation, and the
// degeneracy detector — with a controlled stub engine, no real model required.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { ModelRuntime } from '../../node/src/services/model-runtime.ts';
import {
  createQualificationStore,
  isDegenerateOutput,
  runQualificationProbe,
  QualificationError
} from '../../node/src/services/model-qualification.ts';

type StubMode = 'coherent' | 'garbage' | 'empty' | 'probe-error';

interface StubState {
  mode: StubMode;
}

function createStubEngine(state: StubState): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString('utf8'); });
      req.on('end', () => {
        const route = req.url ?? '';
        if (route === '/v1/models') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: [{ id: 'stub-qualify' }] }));
          return;
        }
        if (route === '/props') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ default_generation_settings: { n_ctx: 2048 } }));
          return;
        }
        if (route === '/apply-template') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ prompt: body }));
          return;
        }
        if (route === '/tokenize') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ tokens: new Array(42).fill(1) }));
          return;
        }
        if (route === '/v1/chat/completions') {
          const payload = (() => { try { return JSON.parse(body) as { messages?: Array<{ content?: string }> }; } catch { return {}; } })();
          const prompt = payload.messages?.map(message => message.content ?? '').join('\n') ?? '';
          const isWarmup = prompt.includes('hi') && prompt.length < 40;
          if (state.mode === 'probe-error' && !isWarmup) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'synthetic runtime failure' } }));
            return;
          }
          let content: string;
          if (state.mode === 'garbage') content = 'ededededededededededededededededededededededed';
          else if (state.mode === 'empty') content = '';
          else if (prompt.includes('QUALIFY-OK')) content = 'QUALIFY-OK';
          else if (prompt.includes('JSON')) content = '{"ok":true}';
          else if (prompt.includes('2+3')) content = '5';
          else content = 'ok';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }], usage: { completion_tokens: 3 } }));
          return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{}');
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/v1`,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close(() => closeResolve()).on('error', closeReject);
          server.closeIdleConnections?.();
        })
      });
    });
  });
}

let dir: string;
const stub: StubState = { mode: 'coherent' };
let engine: { url: string; close: () => Promise<void> };

async function makeRuntime(contextTokens: number): Promise<ModelRuntime> {
  const manifestPath = path.join(dir, `manifest-${contextTokens}.json`);
  await fs.writeFile(manifestPath, JSON.stringify({
    models: [{
      id: 'stub-qualify',
      name: 'Stub Qualify',
      status: 'ready',
      roles: ['chat'],
      endpoint: engine.url,
      model: 'stub-qualify',
      artifact_uri: 'local://stub-qualify.gguf',
      context_tokens: contextTokens,
      file: path.join(dir, 'stub-qualify.gguf')
    }]
  }));
  const runtime = new ModelRuntime({
    workspace: dir,
    manifestPath,
    ingestedPath: path.join(dir, 'ingested-models.json'),
    modelDir: dir,
    logger: { info: () => {}, warn: () => {}, error: () => {} }
  });
  await runtime.load();
  return runtime;
}

before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-qualify-'));
  engine = await createStubEngine(stub);
});

after(async () => {
  await engine.close();
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

test('a coherent stub engine qualifies', async () => {
  stub.mode = 'coherent';
  const runtime = await makeRuntime(2048);
  const record = await runQualificationProbe({ runtime, modelId: 'stub-qualify', root: dir, artifactHash: 'b'.repeat(64) });
  assert.equal(record.state, 'QUALIFIED');
  assert.equal(record.failure_class, null);
  assert.equal(record.probes.filter(probe => probe.passed).length, 3);
  const evidence = await fs.stat(record.evidence_refs[0]!);
  assert.ok(evidence.isFile(), 'probe evidence is persisted');
  await runtime.stopAll();
});

test('decode-corrupt output fails qualification and the configuration is preserved', async () => {
  stub.mode = 'garbage';
  const runtime = await makeRuntime(2048);
  const store = createQualificationStore({ root: dir });
  const record = await runQualificationProbe({ runtime, modelId: 'stub-qualify', root: dir, artifactHash: 'c'.repeat(64) });
  assert.equal(record.state, 'QUALIFICATION_FAILED');
  assert.equal(record.failure_class, 'degenerate_output');
  await store.append(record);

  const restarted = createQualificationStore({ root: dir });
  const records = await restarted.read();
  const found = records.find(candidate => candidate.identity.artifact_hash === 'c'.repeat(64));
  assert.ok(found, 'failed configuration stays in history');
  assert.equal(found.state, 'QUALIFICATION_FAILED');
  await runtime.stopAll();
});

test('empty generation fails with empty_output; runtime probe errors stay UNKNOWN', async () => {
  stub.mode = 'empty';
  const runtime = await makeRuntime(2048);
  const empty = await runQualificationProbe({ runtime, modelId: 'stub-qualify', root: dir, artifactHash: 'd'.repeat(64) });
  assert.equal(empty.state, 'QUALIFICATION_FAILED');
  assert.equal(empty.failure_class, 'empty_output');

  stub.mode = 'probe-error';
  const errored = await runQualificationProbe({ runtime, modelId: 'stub-qualify', root: dir, artifactHash: 'e'.repeat(64) });
  assert.equal(errored.state, 'QUALIFICATION_UNKNOWN');
  assert.equal(errored.failure_class, 'runtime_error');
  await runtime.stopAll();
});

test('unknown models fail closed and identity separates context/profile configurations', async () => {
  stub.mode = 'coherent';
  const runtime = await makeRuntime(2048);
  await assert.rejects(
    () => runQualificationProbe({ runtime, modelId: 'not-allowlisted', root: dir }),
    (error: unknown) => error instanceof QualificationError
  );
  const narrow = await runQualificationProbe({ runtime, modelId: 'stub-qualify', root: dir, artifactHash: 'f'.repeat(64) });
  const wideRuntime = await makeRuntime(4096);
  const wide = await runQualificationProbe({ runtime: wideRuntime, modelId: 'stub-qualify', root: dir, artifactHash: 'f'.repeat(64) });
  assert.notEqual(narrow.qualification_identity, wide.qualification_identity, 'context budget is part of the qualification identity');
  await runtime.stopAll();
  await wideRuntime.stopAll();
});

test('the degeneracy detector flags corruption, not mediocre prose', () => {
  assert.equal(isDegenerateOutput('The answer is 42, but I am not fully sure.').degenerate, false);
  assert.equal(isDegenerateOutput('ededededededededededededededededededededededed').degenerate, true);
  assert.equal(isDegenerateOutput('############################################################').degenerate, true);
  assert.equal(isDegenerateOutput('tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot tot').degenerate, true);
  assert.equal(isDegenerateOutput('').degenerate, false);
});
