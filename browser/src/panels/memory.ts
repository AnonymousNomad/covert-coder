// Slice 3 — MEMORY panel
// Honest phase-gated surface. Memory routes exist in the product stack, but
// this cockpit does not consume their retrieval/session contracts yet.
// This panel never invents or fabricates memory content.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { call } from '../services/api.ts';
import { MemoryDigestsResponse } from '../../../common/contracts/memory.ts';

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
      <span class="panel-maturity">PARTIAL</span>
    </header>
    <section class="panel-empty">
      <div class="panel-empty-glyph" aria-hidden="true">\u29c7</div>
      <h3>Recorded work. Explicit provenance.</h3>
      <p>Inspect day digests derived from recorded workspace events. Refreshing digests updates local memory and requires operator approval.</p>
      <p class="panel-empty-detail">Digest retrieval does not prove that a model recalled or used this information. Recall search and session pinning are not available in this surface.</p>
      <button type="button" class="cockpit-mode memory-refresh">REFRESH &amp; RETRIEVE DIGESTS</button>
    </section>
    <p class="memory-status panel-intro" role="status">NOT RETRIEVED · no memory operation requested.</p>
    <div class="memory-digests"></div>
  `;
  parent.appendChild(root);

  let alive = true;
  const button = root.querySelector<HTMLButtonElement>('.memory-refresh')!;
  const status = root.querySelector<HTMLElement>('.memory-status')!;
  const digests = root.querySelector<HTMLElement>('.memory-digests')!;
  button.addEventListener('click', () => {
    button.disabled = true;
    status.textContent = 'APPROVAL REQUIRED · refresh and retrieve workspace digests.';
    void call('/api/memory/digests', { schema: MemoryDigestsResponse }).then(result => {
      if (!alive) return;
      digests.replaceChildren();
      status.textContent = `RETRIEVED · ${result.digests.length} day digests · ${result.refreshed.length} refreshed. Model use is not established.`;
      for (const digest of result.digests) {
        const card = document.createElement('section');
        card.className = 'cc-tile';
        const title = document.createElement('h3'); title.textContent = digest.date;
        const detail = document.createElement('p');
        detail.textContent = `${digest.files_touched} files · ${digest.approvals} approvals · ${digest.rejections} rejections · ${digest.ships} recorded ships`;
        const source = document.createElement('p'); source.textContent = 'Source: workspace day digest. Ship records are not verification verdicts.';
        const list = document.createElement('ul');
        for (const highlight of digest.highlights) { const item = document.createElement('li'); item.textContent = highlight; list.appendChild(item); }
        card.append(title, detail, source, list); digests.appendChild(card);
      }
    }).catch(error => { if (alive) status.textContent = `NOT RETRIEVED · ${error instanceof Error ? error.message : String(error)}`; })
      .finally(() => { if (alive) button.disabled = false; });
  });

  return {
    dispose() {
      alive = false;
      parent.innerHTML = '';
    }
  };
}
