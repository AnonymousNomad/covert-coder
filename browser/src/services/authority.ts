import { AuthoritySessionResponse, AuthorityOperationResponse } from '../../../common/contracts/authority.ts';
import { Envelope } from '../../../common/errors.ts';
import { egressFetch } from './egress.ts';
import { facadeHttpUrl } from './runtime-config.ts';
import { approvalDescription } from '../ui/approval-description.ts';

// Memory only; never localStorage, URLs, workspace files or model context.
let credential: string | null = null;
let expiresAt = 0;
const format = { 'Content-Type': 'application/json', 'X-AIDE-API-Format': 'envelope-v1' };

async function control(path: string, body: unknown): Promise<unknown> {
  const response = await egressFetch(facadeHttpUrl(path), { method: 'POST', headers: withAuthority(format), body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const envelope = Envelope.parse(await response.json());
  if (!envelope.ok) throw new Error(`${envelope.error.code}: ${envelope.error.message}`);
  return envelope.data;
}
export function withAuthority(input?: HeadersInit): Headers {
  const headers = new Headers(input);
  if (credential && Date.now() < expiresAt) headers.set('Authorization', `Bearer ${credential}`);
  return headers;
}
export async function pairAuthority(proof: string): Promise<void> {
  const session = AuthoritySessionResponse.parse(await control('/api/authority/pair', { proof }));
  credential = session.token; expiresAt = session.expires_at;
}
export async function initializeAuthority(): Promise<void> {
  const host = window as unknown as { __TAURI_INTERNALS__?: { invoke(command: string): Promise<unknown> } };
  if (host.__TAURI_INTERNALS__) {
    const proof = await host.__TAURI_INTERNALS__.invoke('authority_pairing');
    if (typeof proof !== 'string' || !proof.trim()) throw new Error('Native pairing unavailable.');
    await pairAuthority(proof.trim());
    return;
  }
  const app = document.getElementById('app');
  if (!app) throw new Error('Pairing mount unavailable.');
  const emblem = new URL('../../../docs/assets/branding/covert-coder-emblem.png', import.meta.url).href;
  app.innerHTML = `<main class="cockpit-pairing"><form class="cockpit-pairing-card" aria-label="Pair Covert session">
    <img src="${emblem}" alt="Covert emblem" width="64" height="88" />
    <div class="cockpit-eyebrow">YOUR MACHINE. YOUR WORKFLOW.</div>
    <h1>COVERT CODER</h1><p>Vibe at the surface. Engineering underneath.</p>
    <h2>Connect this workbench</h2>
    <p>In the terminal running <code>npm start</code>, type <code>pair</code>. Enter the one-use code below. It expires after five minutes.</p>
    <label for="covert-pairing-code">One-use pairing code</label>
    <input id="covert-pairing-code" type="password" autocomplete="off" spellcheck="false" required />
    <button type="submit" class="cockpit-mode">PAIR SESSION</button>
    <p class="cockpit-pairing-status" role="status">Local by default. Connected by choice. Pairing does not approve individual operations.</p>
  </form></main>`;
  const form = app.querySelector<HTMLFormElement>('form')!;
  const input = app.querySelector<HTMLInputElement>('input')!;
  const button = app.querySelector<HTMLButtonElement>('button')!;
  const status = app.querySelector<HTMLElement>('[role=status]')!;
  input.focus();
  await new Promise<void>(resolve => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (button.disabled || !input.value.trim()) return;
      const proof = input.value.trim();
      input.value = '';
      button.disabled = true;
      status.textContent = 'Pairing with the local workbench…';
      void pairAuthority(proof).then(resolve).catch(() => {
        status.textContent = 'Pairing failed. Check the launch terminal and request a new code with pair.';
        button.disabled = false;
        input.focus();
      });
    });
  });
}
export function authorityPresentation(): { paired: boolean; expiresAt: number | null } {
  const paired = credential !== null && Date.now() < expiresAt;
  return { paired, expiresAt: paired ? expiresAt : null };
}
export function authenticateEventSocket(socket: WebSocket): void {
  if (!credential || Date.now() >= expiresAt) { socket.close(); return; }
  socket.send(JSON.stringify({ type: 'authenticate', token: credential }));
}
export async function approveRequest(path: string, init: RequestInit): Promise<Headers> {
  if (!credential || Date.now() >= expiresAt) throw new Error('Paired operator session required.');
  if (init.body !== undefined && typeof init.body !== 'string') throw new Error('Exact JSON operation body required.');
  const task = crypto.randomUUID();
  const operation = AuthorityOperationResponse.parse(await control('/api/authority/prepare', {
    method: init.method ?? 'GET', path, task_id: task, body: init.body === undefined ? {} : JSON.parse(init.body) as unknown
  }));
  const description = approvalDescription({ operation: operation.kind, workspace: operation.workspace, task: operation.task_id, risk: operation.risk, arguments: operation.args });
  // One explicit decision for this exact immutable operation; never approve
  // automatically because a caller or model supplied approved:true.
  const allowed = typeof window !== 'undefined' && window.confirm(`Approve this operation once?\n${description}`);
  await control('/api/authority/decision', { operation_id: operation.operation_id, decision: allowed ? 'approve' : 'reject' });
  if (!allowed) throw new Error('Operation denied; no execution authorized.');
  const headers = withAuthority(init.headers);
  headers.set('X-AIDE-Operation', operation.operation_id); headers.set('X-AIDE-Task', task);
  return headers;
}
