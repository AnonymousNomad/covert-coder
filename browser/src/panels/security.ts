// Slice 3 — SECURITY panel
// Honest-empty placeholder. No /api/security or desktop-control
// endpoint is wired to the frontend. Desktop control remains
// session-scoped, deny-by-default on the backend; the frontend never
// implies presence of authority it has not been granted.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { showToast } from '../ui/toast.ts';

export interface PanelHandles {
  dispose(): void;
}

export function createSecurityPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'panel-content security-panel';
  root.innerHTML = `
    <header class="panel-header">
      <h2 class="panel-title">SECURITY</h2>
      <span class="panel-maturity">DISABLED</span>
    </header>
    <section class="panel-empty">
      <div class="panel-empty-glyph" aria-hidden="true">\u2756</div>
      <h3>Not yet integrated</h3>
      <p>No security surface is wired to the frontend today. Desktop control remains session-scoped and deny-by-default on the backend (<code>/api/desktop/*</code>); Telegram bridge (<code>/api/telegram/*</code>) is also not wired. Authority state is not exposed to the browser yet.</p>
      <p class="panel-empty-detail">The Security panel will become informative only after the facade exposes a read-only <code>GET /api/security/state</code> returning current capability posture (e.g., desktop enabled/disabled, panic-stop reachable, telegram paired/disabled). The frontend never grants itself authority it does not have.</p>
      <p class="panel-empty-action">Until then, this surface exists to make the absence visible.</p>
    </section>
  `;
  parent.appendChild(root);

  root.addEventListener('click', () => {
    showToast(root, 'NOT_READY', 'No aggregate read-only security posture is exposed to the cockpit.');
  });

  return {
    dispose() {
      parent.innerHTML = '';
    }
  };
}
