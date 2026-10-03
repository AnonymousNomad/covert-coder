// Actual production ResidentCore in a browser; controlled API fixtures only.
// This does not qualify a live provider, model, whole app restart or RC.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
const server = await createServer({ configFile: 'browser/vite.config.ts', server: { host: '127.0.0.1', port: 0 } });
let browser;
const held = [];
let fixture;
const cases = [];
const pass = name => { cases.push(name); console.log(`PASS UI: ${name}`); };
const status = (id, state = 'running') => ({ session_id: id, state, mode: 'act', iterations: 1, mistake_count: 0, error: null,
  pending_approval: state === 'awaiting_approval' ? { approval_id: 'fixture-approval', session_id: id, tool: 'write_file', args_preview: { path: 'fixture.txt' }, risks: ['write'], preview: null, created_at: 1 } : null });
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address === 'object');
  browser = await chromium.launch(process.env.CI ? { headless: true } : { channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__resident_ownership__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><main id="host"></main>' }));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const respond = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
    const fail = detail => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'CONFLICT', message: 'controlled fixture failure', ...(detail ? { detail } : {}) } }) });
    if (url.pathname === '/api/agent/start') {
      const body = request.postDataJSON(); fixture.starts.push(body);
      if (fixture.startMode === 'refuse') return fail({ start_outcome: 'not_started', request_id: body.client_request_id });
      if (!fixture.ids.has(body.client_request_id)) fixture.ids.set(body.client_request_id, `fixture-${fixture.ids.size + 1}`);
      const result = { session_id: fixture.ids.get(body.client_request_id) };
      if (fixture.startMode === 'lost') return route.abort();
      if (fixture.startMode === 'held') { held.push(() => respond(result)); return; }
      return respond(result);
    }
    if (url.pathname === '/api/agent/status') {
      fixture.reads++;
      if (fixture.statusError) return fail();
      const id = url.searchParams.get('id');
      const result = status(fixture.mismatch ? 'foreign-fixture' : id, fixture.state);
      if (fixture.holdStatus) { held.push(() => respond(result)); return; }
      return respond(result);
    }
    if (url.pathname === '/api/agent/cancel') {
      fixture.cancels.push(request.postDataJSON());
      if (fixture.cancelError) return fail();
      if (!fixture.cancelStillRunning) fixture.state = 'aborted';
      return respond({ ok: true, state: fixture.state });
    }
    if (url.pathname === '/api/agent/decision') {
      fixture.decisions.push(request.postDataJSON());
      if (fixture.decisionError) return fail();
      fixture.state = 'done';
      return respond({ ok: true });
    }
    return fail();
  });
  async function fresh() {
    while (held.length) await held.shift()().catch(() => {});
    fixture = { starts: [], cancels: [], decisions: [], reads: 0, ids: new Map(), startMode: 'ok', state: 'running', statusError: false,
      cancelError: false, decisionError: false, cancelStillRunning: false, mismatch: false, holdStatus: false };
    await page.goto(`http://127.0.0.1:${address.port}/__resident_ownership__`);
    await page.evaluate(async () => {
      window.__AIDE_RUNTIME_CONFIG__ = { facadeOrigin: window.location.origin };
      const { api } = await import('/src/services/api.ts');
      Object.assign(api, {
        routes: async () => ({ routes: [] }), chatHistory: async () => ({ conversations: [] }),
        connections: async () => ({ routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' } }),
        modelManager: async () => ({ connections: { routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, preference: 'local-first' },
          runtime: { selected_model_id: 'controlled-local-model', health: 'HEALTHY' } }),
        fit: async () => ({ usedApprox: 0, budget: 8192, dropped: 0, truncatedSystem: false, messages: [] }),
        residentSummary: async () => { throw new Error('fixture unavailable'); }, residentContext: async () => { throw new Error('fixture unavailable'); },
        residentPush: async () => { throw new Error('fixture unavailable'); }, residentDecisions: async () => { throw new Error('fixture unavailable'); },
      });
      const { Store } = await import('/src/store/store.ts');
      const { INITIAL_STATE } = await import('/src/store/state.ts');
      const { createResidentCore } = await import('/src/cockpit/ResidentCore.ts');
      window.residentStore = new Store(structuredClone(INITIAL_STATE));
      window.mountResident = () => { window.residentProbe = createResidentCore(document.getElementById('host'), window.residentStore); };
      window.mountResident();
    });
  }
  const mount = page.locator('.cockpit-resident-composer-status');
  const send = page.locator('.cockpit-resident-send');
  const quick = page.getByRole('button', { name: 'Implement Feature; starts a governed Resident task', exact: true });
  const refresh = () => page.getByRole('button', { name: 'REFRESH TASK STATUS', exact: true }).click();
  const waitText = text => page.waitForFunction(value => document.querySelector('.cockpit-resident-composer-status')?.textContent.includes(value), text);
  async function start() {
    await page.locator('.cockpit-resident-input').fill('Controlled ownership task');
    await send.click();
  }
  async function remount() { await page.evaluate(() => { window.residentProbe.dispose(); window.mountResident(); }); }

  await fresh(); fixture.startMode = 'held'; await start();
  await page.waitForFunction(() => document.querySelector('.cockpit-resident-send').disabled);
  assert.equal(await quick.isDisabled(), true);
  await page.locator('.cockpit-resident-composer').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true })));
  assert.equal(fixture.starts.length, 1); pass('pending start blocks rapid submit and quick actions');
  fixture.startMode = 'ok'; await held.shift()(); await waitText('RUNNING');
  assert.equal(await send.isDisabled(), true); assert.equal(await quick.isDisabled(), true);
  pass('running session retains ownership and blocks replacement');
  fixture.state = 'awaiting_approval'; await refresh(); await waitText('OPERATOR DECISION REQUIRED');
  assert.equal(await send.isDisabled(), true); pass('approval pending blocks another root task');
  fixture.decisionError = true;
  await page.getByRole('button', { name: 'APPROVE ONCE', exact: true }).click(); await waitText('Resident decision failed');
  assert.equal(await send.isDisabled(), true); assert.equal(await page.getByRole('button', { name: 'Stop the running governed Resident task', exact: true }).isEnabled(), true);
  assert.deepEqual(fixture.decisions[0], { session_id: 'fixture-1', approval_id: 'fixture-approval', decision: 'approve' });
  pass('failed decision preserves exact session and Stop');
  fixture.decisionError = false; await refresh(); await waitText('OPERATOR DECISION REQUIRED');
  await page.getByRole('button', { name: 'REJECT', exact: true }).click(); await waitText('DONE');
  assert.equal(await send.isEnabled(), true); pass('terminal status permits a subsequent task');
  fixture.state = 'running'; await quick.click(); await waitText('SESSION fixture-2');
  assert.equal(fixture.ids.size, 2); pass('subsequent task uses a new correlated request');
  fixture.statusError = true; await refresh(); await waitText('status unavailable');
  assert.equal(await send.isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: 'Stop the running governed Resident task', exact: true }).isEnabled(), true);
  pass('unavailable status retains handle, retry and cancellation');
  fixture.cancelError = true;
  await page.getByRole('button', { name: 'Stop the running governed Resident task', exact: true }).click(); await waitText('cancellation failed');
  assert.deepEqual(fixture.cancels[0], { session_id: 'fixture-2' }); assert.equal(await send.isDisabled(), true);
  pass('failed cancellation cannot claim the task stopped');
  fixture.cancelError = false; fixture.statusError = false; fixture.cancelStillRunning = true;
  await page.getByRole('button', { name: 'Stop the running governed Resident task', exact: true }).click(); await waitText('RUNNING');
  assert.equal(await send.isDisabled(), true); pass('nonterminal cancellation acknowledgement keeps starts blocked');
  fixture.cancelStillRunning = false;
  await page.getByRole('button', { name: 'Stop the running governed Resident task', exact: true }).click(); await waitText('ABORTED');
  assert.equal(await send.isEnabled(), true); pass('observed abort releases presentation ownership');

  await fresh(); fixture.startMode = 'lost'; await start(); await waitText('Start outcome unknown');
  assert.equal(await send.isDisabled(), true); const original = fixture.starts[0];
  fixture.startMode = 'ok'; await page.getByRole('button', { name: 'RECOVER START RESULT', exact: true }).click(); await waitText('RUNNING');
  assert.deepEqual(fixture.starts[1], original); assert.equal(fixture.ids.size, 1);
  pass('lost response recovery resubmits the frozen same request ID');
  await remount(); await waitText('RUNNING'); assert.equal(await send.isDisabled(), true);
  assert.equal(fixture.starts.length, 2); pass('remount retrieves owned session without dispatch');

  await fresh(); fixture.startMode = 'held'; await start();
  await page.waitForFunction(() => window.residentStore.get().residentTask?.phase === 'starting');
  await remount(); await waitText('Start outcome unknown'); fixture.startMode = 'ok';
  await page.getByRole('button', { name: 'RECOVER START RESULT', exact: true }).click(); await waitText('RUNNING');
  const before = await mount.innerText(); await held.shift()();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  assert.equal(await mount.innerText(), before); assert.equal(fixture.ids.size, 1);
  pass('disposed start cannot overwrite a recovered mount');

  await fresh(); await start(); await waitText('RUNNING');
  fixture.mismatch = true; await refresh(); await waitText('identity mismatch');
  assert.equal(await send.isDisabled(), true); assert.doesNotMatch(await mount.innerText(), /SESSION foreign-fixture/);
  pass('mismatched session response fails closed without foreign adoption');
  fixture.mismatch = false; fixture.holdStatus = true; await refresh();
  await page.waitForFunction(() => document.querySelector('.cockpit-resident-composer-status').textContent.includes('SESSION fixture-1'));
  // Stop remains usable during a pending read. It aborts and invalidates that read.
  await page.getByRole('button', { name: 'Stop the running governed Resident task', exact: true }).click();
  fixture.holdStatus = false;
  while (held.length) await held.shift()().catch(() => {});
  await refresh(); await waitText('ABORTED');
  pass('cancellation remains usable during a pending status read');
  fixture.state = 'running'; fixture.holdStatus = true; await refresh();
  await remount(); fixture.holdStatus = false;
  while (held.length) await held.shift()().catch(() => {});
  await refresh(); await waitText('RUNNING');
  pass('disposed read cannot overwrite the replacement projection');

  await fresh(); fixture.startMode = 'refuse'; await start(); await waitText('Start refused before dispatch');
  assert.equal(await send.isEnabled(), true); assert.equal(fixture.ids.size, 0);
  pass('only correlated explicit pre-dispatch refusal allows a fresh start');

  await fresh();
  await page.evaluate(async () => {
    const { api } = await import('/src/services/api.ts');
    api.modelManager = async () => ({ connections: { routed_roles: { planner: 'local', coder: { provider_id: 'opencode', model_id: 'opencode-go/controlled-exact-model' }, reviewer: 'local', utility: 'local' }, preference: 'local-first' },
      runtime: { selected_model_id: null, health: 'STOPPED' } });
  });
  await start(); await waitText('RUNNING');
  assert.deepEqual(fixture.starts[0].worker, { worker: 'cloud:opencode:opencode-go/controlled-exact-model', provider: 'opencode', model: 'opencode-go/controlled-exact-model', role: 'coder' });
  assert.equal(fixture.starts[0].chat_source, 'provider');
  assert.match(await mount.innerText(), /REQUESTED WORKER.*cloud:opencode:opencode-go\/controlled-exact-model/);
  pass('project ACT external worker is sent and displayed as an exact requested target');

  await fresh();
  await page.evaluate(async () => {
    const { api } = await import('/src/services/api.ts');
    api.modelManager = async () => ({ connections: { routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, preference: 'local-first' }, runtime: { selected_model_id: null, health: 'UNKNOWN' } });
  });
  await start(); await waitText('Worker selection unavailable before dispatch');
  assert.equal(fixture.starts.length, 0); assert.equal(await send.isEnabled(), true);
  pass('unavailable exact local selection sends no task and permits correction');

  await fresh();
  await page.evaluate(async () => {
    const { api } = await import('/src/services/api.ts');
    api.modelManager = async () => ({ connections: { routed_roles: { planner: 'local', coder: { provider_id: 'opencode', model_id: 'opencode-go/controlled-exact-model' }, reviewer: 'local', utility: 'local' }, preference: 'local-only' },
      runtime: { selected_model_id: 'controlled-local-model', health: 'HEALTHY' } });
  });
  await start(); await waitText('Local-Only');
  assert.equal(fixture.starts.length, 0); assert.equal(await send.isEnabled(), true);
  pass('Local-Only does not silently replace an explicitly selected external worker');

  await fresh();
  await page.evaluate(async () => {
    const { api } = await import('/src/services/api.ts');
    api.modelManager = () => new Promise(resolve => { window.selectionResolve = resolve; });
  });
  await start(); await waitText('Reading the exact project worker');
  assert.equal(fixture.starts.length, 0); assert.equal(await send.isDisabled(), true); assert.equal(await quick.isDisabled(), true);
  await remount(); await waitText('Model selection interrupted before dispatch');
  await page.evaluate(() => window.selectionResolve({ connections: { routed_roles: { planner: 'local', coder: 'local', reviewer: 'local', utility: 'local' }, preference: 'local-first' }, runtime: { selected_model_id: 'controlled-local-model', health: 'HEALTHY' } }));
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  assert.equal(fixture.starts.length, 0); assert.equal(await send.isEnabled(), true);
  pass('disposed pending selection cannot dispatch or overwrite a replacement mount');
  await page.evaluate(() => window.residentProbe.dispose());
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ classification: 'ACTUAL_COMPONENT_CONTROLLED_API', cases: cases.length, passed: cases.length, liveModelOrProvider: false, wholeAppRestart: false, processPid: process.pid, fixturePort: address.port }));
} finally {
  while (held.length) await held.shift()().catch(() => {});
  await browser?.close();
  await server.close();
}
