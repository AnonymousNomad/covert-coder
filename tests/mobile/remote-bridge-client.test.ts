import assert from 'node:assert/strict';
import test from 'node:test';
import { RemoteBridgeClient } from '../../mobile/edge/remote-bridge-client.ts';

const snapshot = {
  generated_at: 1700000000000,
  workstation: { id: 'ws-test', name: 'test', version: null },
  connection: { state: 'local-only' as const, transport: 'loopback' as const, authenticated: true, last_seen: 1700000000000, detail: 'test' },
  current_project: null,
  workflow: null,
  jobs: [],
  workers: [],
  approvals: [],
  verification: { status: 'OBSERVED', summary: 'test', evidence_refs: [] },
  activity: [],
  notifications: [],
  resident: { message: 'test', generated_at: 1700000000000 }
};

test('Edge client keeps pairing in memory and uses only bounded bridge routes', async () => {
  const calls: Array<{ path: string; headers: Headers }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    calls.push({ path: url.pathname, headers });
    if (url.pathname === '/api/edge/pair') return Response.json({ ok: true, data: { token: 't'.repeat(32), actor_id: 'actor-test', expires_at: 1700001000000 } });
    if (url.pathname === '/api/edge/status') return Response.json({ ok: true, data: { snapshot } });
    if (url.pathname === '/api/edge/command') return Response.json({ ok: true, data: { accepted: true, requires_confirmation: false, risk: 'low', reason: 'read', snapshot } });
    if (url.pathname === '/api/edge/voice/capabilities') return Response.json({ ok: true, data: { input_available: true, push_to_talk_available: true, custom_hotword_available: false, assistant_role_available: false, supported_invocations: ['in-app-push-to-talk'], limitations: [] } });
    if (url.pathname === '/api/edge/voice/command') return Response.json({ ok: true, data: { accepted: true, category: 'read', requires_confirmation: false, response_text: 'ok', snapshot } });
    return Response.json({ ok: false, error: { code: 'NOT_FOUND', message: 'unexpected route' } }, { status: 404 });
  };

  const client = new RemoteBridgeClient({ baseUrl: 'http://127.0.0.1:4777', fetchImpl });
  await assert.rejects(client.status(), /not paired/);
  await client.pair('p'.repeat(32));
  assert.equal(client.paired, true);
  await client.status();
  await client.command({ command: 'status.read' });
  await client.voiceCapabilities();
  await client.voice({ transcript: 'what is Covert doing?' });
  assert.deepEqual(calls.map(call => call.path), ['/api/edge/pair', '/api/edge/status', '/api/edge/command', '/api/edge/voice/capabilities', '/api/edge/voice/command']);
  assert.equal(calls[1]?.headers.get('authorization')?.startsWith('Bearer '), true);
  assert.equal(calls.some(call => /pty|file|terminal|shell/i.test(call.path)), false);
  client.clearSession();
  assert.equal(client.paired, false);
});
