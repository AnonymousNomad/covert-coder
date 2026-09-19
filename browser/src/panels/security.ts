// Slice 3 — SECURITY panel
// Honest-empty placeholder. No /api/security or desktop-control
// endpoint is wired to the frontend. Desktop control remains
// session-scoped, deny-by-default on the backend; the frontend never
// implies presence of authority it has not been granted.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { authorityPresentation } from '../services/authority.ts';

export interface PanelHandles {
  dispose(): void;
}

export function createSecurityPanel(parent: HTMLElement, store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'panel-content security-panel';
  root.innerHTML = `
    <header class="panel-header">
      <h2 class="panel-title">SECURITY</h2>
      <span class="panel-maturity">PARTIAL</span>
    </header>
    <section class="panel-empty">
      <div class="panel-empty-glyph" aria-hidden="true">\u2756</div>
      <h3>Explicit authority. Bounded operations.</h3>
      <p class="security-pairing" role="status"></p>
      <p>Pairing identifies this browser session. Each privileged operation still requires a separate decision bound to its exact arguments. Resident has no authority to approve work.</p>
      <p class="panel-empty-detail">Aggregate containment, pending operations, and consumed authority are not exposed here. Their absence is not a security verdict.</p>
      <button type="button" class="cockpit-mode security-settings">PROVIDER &amp; NETWORK SETTINGS</button>
    </section>
  `;
  parent.appendChild(root);

  const status = root.querySelector<HTMLElement>('.security-pairing')!;
  const paint = (): void => {
    const session = authorityPresentation();
    status.textContent = session.paired ? `PAIRED · session expires ${new Date(session.expiresAt!).toLocaleTimeString()}. No operation approval is implied.` : 'UNPAIRED / EXPIRED · reload and pair from the launch terminal.';
  };
  paint();
  const interval = window.setInterval(paint, 10000);
  root.querySelector('.security-settings')?.addEventListener('click', () => store.set(previous => ({ ...previous, panel: 'settings' })));

  return {
    dispose() {
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
