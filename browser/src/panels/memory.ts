// Slice 3 — MEMORY panel
// Honest phase-gated surface. Memory routes exist in the product stack, but
// this cockpit does not consume their retrieval/session contracts yet.
// This panel never invents or fabricates memory content.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { showToast } from '../ui/toast.ts';

export interface PanelHandles {
  dispose(): void;
}

export function createMemoryPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'panel-content memory-panel';
  root.innerHTML = `
    <header class="panel-header">
      <h2 class="panel-title">MEMORY</h2>
      <span class="panel-maturity">DEGRADED</span>
    </header>
    <section class="panel-empty">
      <div class="panel-empty-glyph" aria-hidden="true">\u29c7</div>
      <h3>Not yet integrated</h3>
      <p>Memory routes exist in the product stack, but this cockpit does not yet consume the retrieval/session contracts. No memory content is fabricated here.</p>
      <p class="panel-empty-detail">Required frontend wiring: a typed API consumer for day-digest retrieval, recall search, and session pin/expire.</p>
      <p class="panel-empty-action">Current state: PHASE-GATED · backend memory truth is not projected into this surface.</p>
    </section>
  `;
  parent.appendChild(root);

  root.addEventListener('click', () => {
    showToast(root, 'NOT_READY', 'Memory routes exist but are not yet projected into the cockpit.');
  });

  return {
    dispose() {
      parent.innerHTML = '';
    }
  };
}
