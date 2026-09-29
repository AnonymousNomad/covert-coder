import http from 'node:http';
import { appendFileSync } from 'node:fs';

const mode = process.env.FIXTURE_MODE ?? 'success';
let activeMode = mode;
const log = process.env.FIXTURE_LOG;
const clients = new Set();

function record(event, extra = {}) {
  appendFileSync(log, JSON.stringify({ event, ...extra }) + '\n');
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function event(type, properties = {}) {
  return { id: 'evt_fixture', type, properties };
}

function emit(type, properties = {}) {
  const item = event(type, properties);
  const frame = 'data: ' + JSON.stringify(mode === 'wrapped' ? { payload: item } : item) + '\n\n';
  for (const response of clients) response.write(frame);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');

  if (url.pathname === '/provider' && request.method === 'GET') {
    const models = mode === 'catalog-missing'
      ? { 'deepseek-v4-flash': { name: 'DeepSeek V4 Flash' } }
      : { 'deepseek-v4.1-flash': { name: 'DeepSeek V4.1 Flash' } };
    return send(response, 200, { all: [{ id: 'opencode-go', models }], connected: ['opencode-go'] });
  }
  if (url.pathname === '/global/health') return send(response, 200, { healthy: true, version: '1.18.20-fixture' });
  if (url.pathname === '/provider/auth') return send(response, 200, { 'opencode-go': [{ type: 'fixture' }] });
  if (url.pathname === '/session' && request.method === 'POST') return send(response, 200, { id: 'ses_fixture' });

  if (url.pathname === '/event' && request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    clients.add(response);
    response.write('data: ' + JSON.stringify(event('server.connected')) + '\n\n');
    response.on('close', () => clients.delete(response));
    return;
  }

  if (url.pathname === '/session/ses_fixture/prompt_async' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => { body += String(chunk); });
    request.on('end', () => {
      const promptBody = JSON.parse(body);
      record('prompt', { body: promptBody });
      const promptText = promptBody.parts?.find(part => part.type === 'text')?.text ?? '';
      activeMode = mode === 'terminal-lifecycle'
        ? promptText.includes('cancel this route')
          ? 'cancel'
          : promptText.includes('provider-error path')
            ? 'provider-error'
            : promptText.includes('cleanup failure path')
              ? 'cleanup-fail'
              : 'success'
        : mode;
      response.writeHead(204);
      response.end();
      setTimeout(() => {
        emit('session.status', { sessionID: 'ses_fixture', status: { type: 'busy' } });
        if (activeMode === 'provider-error') {
          emit('session.error', { sessionID: 'ses_fixture', error: { data: { message: 'credential sentinel must not escape' } } });
          return;
        }
        emit('message.updated', { info: {
          id: 'msg_fixture',
          sessionID: 'ses_fixture',
          role: 'assistant',
          providerID: activeMode === 'mismatch' ? 'other-provider' : 'opencode-go',
          modelID: 'deepseek-v4.1-flash'
        } });
        emit('message.part.updated', { part: {
          id: 'prt_fixture', sessionID: 'ses_fixture', messageID: 'msg_fixture', type: 'text'
        } });
        emit('message.part.delta', {
          sessionID: 'ses_fixture',
          messageID: 'msg_fixture',
          partID: 'prt_fixture',
          field: 'text',
          delta: activeMode === 'cancel' || activeMode === 'timeout' ? 'first' : 'streamed '
        });
        if (activeMode !== 'cancel' && activeMode !== 'timeout') {
          emit('message.part.delta', {
            sessionID: 'ses_fixture', messageID: 'msg_fixture', partID: 'prt_fixture', field: 'text', delta: 'answer'
          });
          emit('session.idle', { sessionID: 'ses_fixture' });
        }
      }, 5);
    });
    return;
  }

  if (url.pathname === '/session/ses_fixture/message' && request.method === 'GET') {
    const text = activeMode === 'cancel' ? 'first' : 'streamed answer';
    return send(response, 200, [{
      info: {
        id: 'msg_fixture',
        sessionID: 'ses_fixture',
        role: 'assistant',
        providerID: activeMode === 'mismatch' ? 'other-provider' : 'opencode-go',
        modelID: 'deepseek-v4.1-flash'
      },
      parts: [{ id: 'prt_fixture', messageID: 'msg_fixture', type: 'text', text }]
    }]);
  }
  if (url.pathname === '/session/ses_fixture/abort' && request.method === 'POST') {
    record('abort');
    return send(response, 200, true);
  }
  if (url.pathname === '/session/ses_fixture' && request.method === 'DELETE') {
    record('delete');
    if (activeMode === 'cleanup-fail') return send(response, 500, { error: 'not cleaned' });
    return send(response, 200, true);
  }

  return send(response, 404, { error: 'not found' });
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log('opencode server listening on http://127.0.0.1:' + address.port);
});