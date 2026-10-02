import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ModelRuntime } from '../../node/src/services/model-runtime.ts';
import { ProviderService, ProviderError } from '../../node/src/services/providers.ts';
import { CredentialStore } from '../../node/src/services/credentials.ts';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const task = 'PRIVATE SYNTHETIC TASK Ω';
const revision = 'a'.repeat(64);
type Messages = Array<{ role: string; content: string }>;
function scalarRecord(value: unknown): Record<string, string | number | boolean | null> {
  assert.ok(typeof value === 'object' && value !== null);
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, field] of Object.entries(value)) {
    if (field !== null && !['string','number','boolean'].includes(typeof field)) throw new Error('Non-scalar adapter observation');
    result[key] = field;
  }
  return result;
}
function options(observer: (value: unknown) => Promise<void>, signal?: AbortSignal) {
  return { maxTokens: 512, adapterInput: { route_id: 'local:controlled-adapter', target_revision: revision, onRequestInput: observer },
    ...(signal !== undefined ? { signal } : {}) };
}
async function tempRoot(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'covert-adapter-input-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('covert-adapter-input-'));
    await fs.rm(root,{recursive:true,force:true});
  });
  return root;
}

// Actual Runtime/controlled HTTP server. No model process, artifact, Authority
// or live inference qualification. Health/warmup requests are not mission calls.
async function localFixture(t: TestContext, stream: boolean) {
  const root = await tempRoot(t);
  const bodies: string[] = [];
  const observations: unknown[] = [];
  const server = http.createServer((req,res) => {
    let body = ''; req.on('data',chunk => { body += chunk.toString('utf8'); });
    req.on('end',() => {
      res.setHeader('content-type','application/json');
      if (req.url === '/v1/models') { res.end(JSON.stringify({data:[{id:'controlled-adapter'}]})); return; }
      if (req.url === '/props') { res.end(JSON.stringify({default_generation_settings:{n_ctx:2048}})); return; }
      if (req.url !== '/v1/chat/completions') { res.statusCode = 404; res.end('{}'); return; }
      const payload = JSON.parse(body) as {messages:Messages;stream?:boolean};
      if (payload.messages.some(message => message.content.includes('PRIVATE SYNTHETIC'))) bodies.push(body);
      if (body.length > 8000) { res.statusCode = 400; res.end('{}'); return; }
      if (payload.stream) {
        res.setHeader('content-type','text/event-stream');
        res.end('data: '+JSON.stringify({choices:[{delta:{content:'controlled response'}}]})+'\n\ndata: [DONE]\n\n'); return;
      }
      res.end(JSON.stringify({choices:[{message:{content:'controlled response'}}]}));
    });
  });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const manifestPath = path.join(root,'manifest.json');
  await fs.writeFile(manifestPath,JSON.stringify({models:[{id:'controlled-adapter',roles:['chat'],
    endpoint:`http://127.0.0.1:${address.port}/v1`,model:'controlled-adapter',artifact_uri:'local://controlled.gguf',file:'',context_tokens:2048}]}));
  const runtime = new ModelRuntime({workspace:root,manifestPath,ingestedPath:path.join(root,'ingested.json'),modelDir:root});
  await runtime.load({sweepLegacyEngines:false});
  const controller = new AbortController();
  const invoke = (messages: Messages, observer: (value: unknown) => Promise<void> = async value => { observations.push(value); }) => stream
    ? runtime.chatStream('controlled-adapter',messages,() => {},controller.signal,options(observer))
    : runtime.chat('controlled-adapter',messages,options(observer,controller.signal));
  return {root,bodies,observations,controller,invoke};
}

for (const stream of [false,true]) {
  test(`Runtime ${stream?'stream':'chat'} records exact original and retry bytes separately, preserving current task`,async t => {
    const f = await localFixture(t,stream);
    await f.invoke([{role:'user',content:'x'.repeat(4000)},{role:'assistant',content:'y'.repeat(4000)},{role:'user',content:task}]);
    assert.equal(f.bodies.length,2); assert.equal(f.observations.length,2);
    for (let index = 0; index < 2; index++) {
      const data = scalarRecord(f.observations[index]);
      assert.deepEqual(data,{scope:'ADAPTER_REQUEST_INPUT',adapter:'local-model-runtime',protocol:'openai-chat-completions',
        route_id:'local:controlled-adapter',target_revision:revision,requested_model:'controlled-adapter',request_index:index+1,
        body_sha256:digest(f.bodies[index]!),body_bytes:Buffer.byteLength(f.bodies[index]!,'utf8'),stream});
      assert.equal((JSON.parse(f.bodies[index]!) as {messages:Messages}).messages.at(-1)?.content,task);
    }
    assert.notEqual(scalarRecord(f.observations[0]).body_sha256,scalarRecord(f.observations[1]).body_sha256);
    assert.equal(JSON.stringify(f.observations).includes('PRIVATE SYNTHETIC'),false);
  });
}

test('Runtime failed initial observation permits health/warmup but zero mission POST',async t => {
  const f = await localFixture(t,false);
  await assert.rejects(() => f.invoke([{role:'user',content:task}],async () => { throw new Error('controlled adapter persistence failure'); }),/controlled adapter persistence failure/);
  assert.equal(f.bodies.length,0);
});

test('Runtime failed retry observation sends only the original refused request',async t => {
  const f = await localFixture(t,true);
  await assert.rejects(() => f.invoke([{role:'user',content:'x'.repeat(4000)},{role:'assistant',content:'y'.repeat(4000)},{role:'user',content:task}],async value => {
    f.observations.push(value);
    if (scalarRecord(value).request_index === 2) throw new Error('controlled retry evidence failure');
  }),/controlled retry evidence failure/);
  assert.equal(f.observations.length,2); assert.equal(f.bodies.length,1);
});

test('Runtime cancellation during adapter persistence permits zero mission POST',async t => {
  const f = await localFixture(t,true);
  await assert.rejects(() => f.invoke([{role:'user',content:task}],async () => { f.controller.abort(new Error('controlled adapter cancellation')); }),/controlled adapter cancellation/);
  assert.equal(f.bodies.length,0);
});

test('Runtime caller mutation during persistence cannot change already serialized body',async t => {
  const f = await localFixture(t,false);
  const messages = [{role:'user',content:task}];
  await f.invoke(messages,async value => { f.observations.push(value); messages[0]!.content = 'PRIVATE SYNTHETIC MUTATED'; });
  assert.equal(f.observations.length,1);
  assert.equal((JSON.parse(f.bodies[0]!) as {messages:Messages}).messages[0]!.content,task);
  assert.equal(scalarRecord(f.observations[0]).body_sha256,digest(f.bodies[0]!));
});

// Actual ProviderService with controlled fetch and synthetic in-memory key.
// No real credentials are read/persisted; no external network/provider proof.
async function providerFixture(t: TestContext, providerId: 'openai'|'anthropic', stream: boolean) {
  const root = await tempRoot(t);
  const credentials = new CredentialStore(root,{kind:'controlled',available:async () => true,
    protect:async value => value,unprotect:async value => value});
  credentials.get = async () => 'CONTROLLED_SYNTHETIC_NOT_A_KEY';
  const bodies: string[] = [];
  const observations: unknown[] = [];
  const state = { egress:true };
  const controller = new AbortController();
  const service = new ProviderService(root,{credentials,assertExternalEgressAllowed:() => {
    if (!state.egress) throw new ProviderError('FORBIDDEN','controlled egress revoked');
  },fetchFn:async (_url,init) => {
    bodies.push(String(init?.body));
    if (!stream) return Response.json(providerId==='anthropic'?{content:[{type:'text',text:'controlled response'}]}:{choices:[{message:{content:'controlled response'}}]});
    const body = providerId==='anthropic'
      ? 'event: content_block_delta\ndata: '+JSON.stringify({type:'content_block_delta',delta:{text:'controlled response'}})+'\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n'
      : 'data: '+JSON.stringify({choices:[{delta:{content:'controlled response'}}]})+'\n\ndata: [DONE]\n\n';
    return new Response(body,{headers:{'content-type':'text/event-stream'}});
  }});
  const invoke = (messages: Messages, observer: (value: unknown) => Promise<void> = async value => { observations.push(value); }) => {
    const opts = {...options(observer,controller.signal),adapterInput:{...options(observer).adapterInput,route_id:`cloud:${providerId}:controlled`}};
    return stream ? service.chatStream(providerId,'controlled',messages,() => {},opts) : service.chat(providerId,'controlled',messages,opts);
  };
  return {bodies,observations,state,controller,invoke};
}

for (const providerId of ['openai','anthropic'] as const) {
  for (const stream of [false,true]) {
    test(`Provider ${providerId} ${stream?'stream':'chat'} records the exact serialized framing before fetch`,async t => {
      const f = await providerFixture(t,providerId,stream);
      await f.invoke([{role:'system',content:'PRIVATE SYNTHETIC SYSTEM Ω'},{role:'user',content:task},{role:'user',content:'PRIVATE SYNTHETIC FOLLOWUP'}]);
      assert.equal(f.bodies.length,1); assert.equal(f.observations.length,1);
      assert.deepEqual(scalarRecord(f.observations[0]),{scope:'ADAPTER_REQUEST_INPUT',adapter:'provider-service',
        protocol:providerId==='anthropic'?'anthropic-messages':'openai-chat-completions',route_id:`cloud:${providerId}:controlled`,target_revision:revision,
        requested_model:'controlled',request_index:1,body_sha256:digest(f.bodies[0]!),body_bytes:Buffer.byteLength(f.bodies[0]!,'utf8'),stream});
      const body = JSON.parse(f.bodies[0]!) as {messages:Messages;system?:string};
      assert.equal(body.messages.length,providerId==='anthropic'?1:3);
      assert.equal(typeof body.system==='string',providerId==='anthropic');
      assert.equal(JSON.stringify(f.observations).includes('PRIVATE SYNTHETIC'),false);
      assert.equal(JSON.stringify(f.observations).includes('CONTROLLED_SYNTHETIC_NOT_A_KEY'),false);
    });
  }
}

for (const stream of [false,true]) {
  test(`Provider observed ${stream?'stream':'chat'} rejects pre-cancellation before persistence or fetch`,async t => {
    const f = await providerFixture(t,'openai',stream);
    f.controller.abort();
    await assert.rejects(() => f.invoke([{role:'user',content:task}]),error => error instanceof Error && error.name==='AbortError');
    assert.equal(f.observations.length,0);
    assert.equal(f.bodies.length,0);
  });
  test(`Provider ${stream?'stream':'chat'} refuses fetch when adapter receipt persistence fails`,async t => {
    const f = await providerFixture(t,'openai',stream);
    await assert.rejects(() => f.invoke([{role:'user',content:task}],async () => { throw new Error('controlled provider receipt failure'); }),/controlled provider receipt failure/);
    assert.equal(f.bodies.length,0);
  });
  test(`Provider ${stream?'stream':'chat'} refuses late fetch after adapter cancellation`,async t => {
    const f = await providerFixture(t,'openai',stream);
    await assert.rejects(() => f.invoke([{role:'user',content:task}],async () => { f.controller.abort(new Error('controlled provider cancellation')); }),/controlled provider cancellation/);
    assert.equal(f.bodies.length,0);
  });
  test(`Provider ${stream?'stream':'chat'} rechecks egress after awaited adapter evidence`,async t => {
    const f = await providerFixture(t,'anthropic',stream);
    await assert.rejects(() => f.invoke([{role:'user',content:task}],async () => { f.state.egress = false; }),error => error instanceof ProviderError && error.code==='FORBIDDEN');
    assert.equal(f.bodies.length,0);
  });
  test(`Provider ${stream?'stream':'chat'} caller mutation cannot change the observed body bytes`,async t => {
    const f = await providerFixture(t,'openai',stream);
    const messages = [{role:'user',content:task}];
    await f.invoke(messages,async value => { f.observations.push(value); messages[0]!.content = 'PRIVATE SYNTHETIC MUTATED'; });
    assert.equal(f.observations.length,1);
    assert.equal((JSON.parse(f.bodies[0]!) as {messages:Messages}).messages[0]!.content,task);
    assert.equal(scalarRecord(f.observations[0]).body_sha256,digest(f.bodies[0]!));
  });
}
